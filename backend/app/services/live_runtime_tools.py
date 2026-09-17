"""Development-only generic transport for a browser-owned mounted runtime.

No primitive tables, grading, mutations or capability invention live here.
"""
import asyncio
import json
from types import SimpleNamespace
from google.genai import types

RUNTIME_INSTRUCTION = """
The mounted liveRuntime packet provides executable controls for the real activity.
Use perform_runtime_action with the exact actionId ticket from a currently advertised
choice. Copy that one ticket; the bridge carries its original item and revision scope.
When the learner requests a visible change matching a choice, execute that action
before replying. A spoken hint alone does not fulfill a request to show a hint;
likewise, an explanation alone does not open an example or return the saved task.
Wait for status=visible before describing a screen change. On rejection use the
refreshed state, without retry loops. Never invent capabilities or grade tool state.
The activity's advertised teaching owner controls answers and progression. For a
runner-owned activity, its scripted judge owns answers and progression: keep
following its exact ask, correction and affirmation cues. Never demand a Check
button for a spoken-answer item. Do not advance or replace an unfinished activity.
For an explicit help request use a suitable advertised scaffold or worked example.
Once status=support is visible, the supportArtifact is a separate worked demonstration.
Its provided solution may be explained even while the saved task is unanswered;
this overrides ordinary answer-withholding advice for the example only. Use its
altText as your factual source: explain the actual values or labels and their stated
relationship in one short sentence. Do not merely announce or generically describe
an example. Keep the saved task's answer protected.
During a support detour any parent judge is suspended: discuss the example, not the
saved answer. When asked to return, execute the advertised return action. For a
tutor-owned activity, read the restored task after the visible receipt. A runner
re-asks only when the choice explicitly declares responseSpeech=runner. Never issue
a verdict for help conversation. A choice with responseSpeech=runner hands speech back to the runner:
execute it and stay silent, including after its tool result. For runner-owned
activities, do not add a completion speech: the runner owns its closing cue.
Do not narrate silent state updates. Speak no IDs, protocol tags or JSON.
"""


def runtime_tool():
    return types.Tool(function_declarations=[types.FunctionDeclaration(
        name="perform_runtime_action", behavior=types.Behavior.NON_BLOCKING,
        description="Perform one currently advertised action. Copy its exact actionId ticket from liveRuntime. The ticket is scoped to that item and revision. Wait for visible before describing a screen change.",
        parameters=types.Schema(type="OBJECT", properties={
            "actionId": types.Schema(type="STRING", description="Exact opaque ticket from a currently advertised choice. Never construct it."),
        }, required=["actionId"]),
    )])


def valid_packet(packet, epoch):
    return (isinstance(packet, dict) and packet.get("sessionEpoch") == epoch
            and type(packet.get("revision")) is int and packet["revision"] >= 0
            and ((isinstance(packet.get("instanceId"), str)
                  and isinstance(packet.get("task"), dict) and isinstance(packet["task"].get("itemId"), str))
                 or (packet.get("instanceId") is None and packet.get("task") is None
                     and packet.get("status") == "empty" and packet.get("choices") == []))
            and isinstance(packet.get("choices"), list) and len(packet["choices"]) <= 32
            and all(isinstance(a, dict) and isinstance(a.get("actionId"), str)
                    and isinstance(a.get("action"), dict) for a in packet["choices"])
            and len(json.dumps(packet)) <= 32000)


def parse_runtime_spec(spec, *, activity_enabled):
    if not activity_enabled:
        raise ValueError("Runtime controls require an activity sandbox; the connected fixture has been retired")
    if (not isinstance(spec, dict) or set(spec) != {"sessionEpoch", "initialState"}
            or not isinstance(spec.get("sessionEpoch"), str) or not 1 <= len(spec["sessionEpoch"]) <= 200
            or not valid_packet(spec.get("initialState"), spec["sessionEpoch"])):
        raise ValueError("Invalid runtime sandbox configuration")
    return spec


class LiveRuntimeTools:
    def __init__(self, emit, reply, spec, timeout=8):
        self.emit, self.reply, self.timeout = emit, reply, timeout
        self.epoch = spec["sessionEpoch"]
        self.state = spec["initialState"]
        self.pending = None
        self.timer = None
        self.seen = set()

    def update(self, packet):
        if not valid_packet(packet, self.epoch) or packet["revision"] < self.state["revision"]:
            return False
        self.state = packet
        return True

    async def respond(self, call, status, scheduling="WHEN_IDLE", **extra):
        await self.reply(types.FunctionResponse(id=call.id, name=call.name,
            response={"status": status, "liveRuntime": self.state, **extra}, scheduling=scheduling))

    async def call(self, call):
        if call.id in self.seen:
            return
        if len(self.seen) >= 256:
            await self.respond(call, "blocked", reason="Session command budget exhausted")
            return
        self.seen.add(call.id)
        args = call.args or {}
        if (call.name != "perform_runtime_action" or not isinstance(args, dict)
                or set(args) != {"actionId"} or not isinstance(args["actionId"], str)):
            await self.respond(call, "invalid")
            return
        if self.pending:
            await self.respond(call, "blocked", reason="Another action is awaiting its browser receipt")
            return
        choice = next((c for c in self.state["choices"] if c["actionId"] == args["actionId"]), None)
        prefix = f"{self.epoch}/{self.state['revision']}/"
        if (not choice or not self.state.get("task") or not args["actionId"].startswith(prefix)
                or not args["actionId"][len(prefix):].isdigit()):
            await self.respond(call, "stale", reason="That ticket is no longer advertised. Use the refreshed choices.")
            return
        scope = {"sessionEpoch": self.epoch, "instanceId": self.state["instanceId"],
                 "itemId": self.state["task"]["itemId"], "expectedRevision": self.state["revision"]}
        self.pending = SimpleNamespace(id=call.id, name=call.name, args=scope, response_speech=choice.get("responseSpeech"))
        self.timer = asyncio.create_task(self.expire(call.id))
        await self.emit({"type": "runtime_command", "command": {
            **scope, "commandId": call.id, "action": choice["action"]}})

    async def result(self, message):
        call = self.pending
        if not call or message.get("commandId") != call.id:
            return False
        packet = message.get("state")
        status = message.get("status")
        if (not valid_packet(packet, self.epoch) or packet["instanceId"] != call.args["instanceId"]
                or status not in {"visible", "invalid", "stale", "duplicate", "conflict", "unsupported", "blocked", "failed", "superseded", "timeout", "cancelled"}
                or (status == "visible" and (packet.get("visibleRevision") != packet["revision"]
                    or packet["revision"] <= call.args["expectedRevision"]))):
            return False
        if packet["revision"] < self.state["revision"] or packet["instanceId"] != self.state["instanceId"]:
            status = "superseded"
        else:
            self.update(packet)
        self.clear_pending()
        await self.respond(call, status, scheduling='SILENT' if status == 'visible' and call.response_speech == 'runner' else 'WHEN_IDLE',
                           reason=message.get("reason"), elapsedMs=message.get("elapsedMs"))
        return True

    def clear_pending(self):
        self.pending = None
        if self.timer and self.timer is not asyncio.current_task():
            self.timer.cancel()
        self.timer = None

    async def expire(self, call_id):
        await asyncio.sleep(self.timeout)
        if self.pending and self.pending.id == call_id:
            call = self.pending
            self.clear_pending()
            await self.emit({"type": "runtime_cancelled", "commandId": call_id})
            await self.respond(call, "timeout", reason="Browser did not confirm visibility")

    async def cancelled_by_model(self, ids):
        if self.pending and self.pending.id in ids:
            call_id = self.pending.id
            self.clear_pending()
            await self.emit({"type": "runtime_cancelled", "commandId": call_id})

    async def reset(self):
        if self.pending:
            await self.emit({"type": "runtime_cancelled", "commandId": self.pending.id})
        self.clear_pending()


class CombinedLiveTools:
    """Compose existing transport surfaces; each bridge retains its own protocol."""
    def __init__(self, activity, runtime):
        self.activity, self.runtime = activity, runtime

    async def call(self, call):
        await (self.runtime if call.name == "perform_runtime_action" else self.activity).call(call)

    async def cancelled_by_model(self, ids):
        await self.activity.cancelled_by_model(ids)
        await self.runtime.cancelled_by_model(ids)

    async def reset(self):
        await self.activity.reset()
        await self.runtime.reset()
