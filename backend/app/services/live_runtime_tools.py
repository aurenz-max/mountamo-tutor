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
A support choice states its purpose: pick the one that fits what the learner is missing,
and prefer a text reminder when that is enough.
Once status=support is visible, the supportArtifact is a separate worked demonstration.
Its provided solution may be explained even while the saved task is unanswered;
this overrides ordinary answer-withholding advice for the example only. Use its
altText as your factual source and teach it in ONE turn, before you stop speaking:
nobody will prompt you between its parts. When it has frames it is an explanation in
steps, so say every step in order, one short sentence each, in that same turn; when it
has none, one short sentence carries it. Either way state the actual values or labels
and the relationship they make, say nothing the drawing does not show, and never merely
announce or generically describe an example. Keep the saved task's answer protected.
During a support detour any parent judge is suspended: discuss the example, not the
saved answer. When asked to return, execute the advertised return action. For a
tutor-owned activity, read the restored task after the visible receipt. A runner
re-asks only when the choice explicitly declares responseSpeech=runner. Never issue
a verdict for help conversation. A choice with responseSpeech=runner hands speech back to the runner:
execute it and stay silent, including after its tool result. For runner-owned
activities, do not add a completion speech: the runner owns its closing cue.
Do not narrate silent state updates. Speak no IDs, protocol tags or JSON.
Speak only to the learner. Never read internal notes, delimiters, or stage directions
such as "Wait for student response" aloud; simply stop speaking and listen.

When the activity is tutor-owned, YOU choose how to teach from its current facts.
Respond naturally to questions and requests for help; these are not answer attempts.
Use workspace objects and their selected states to notice what the learner actually did.
Workspace actions accept `targets` only when their description asks for them.
When workspace.progression=observer and demand.response=speech, you judge the learner's
spoken answer against the assignment and communicate the verdict naturally. The transcript
is fallible supporting context. Do not wait for a checked result: the host observes your
completed feedback and records the spoken outcome. For gestures, read workspace.lastResponse
for the activity's checked result. Never call a recording action. The host handles retry/advance.
Acknowledge success or invite
another attempt naturally. Do not call retry/advance or request a replacement activity.
A question about readiness or explanation keeps the current task open. Otherwise, use
only progression choices actually advertised by the activity.
Pointing and demonstrations are teaching, not learner work. Adapt, ask a small question,
wait for the learner, and inspect the changed state before choosing your next action.
Do not turn every help request into a repeated question or advance after repeated mistakes.
For activities without observer progression, use an advertised retry to reopen a checked
item, and advance only after a checked success and a useful teaching exchange. An assisted success is not evidence of independent mastery.
"""


MOVE_INSTRUCTION = """
compose_move is how you HELP. A support is a teaching move, and a move is worth making only
when it changes what the child can see or do about the obstacle they actually have. A second
drawing of the model already on their screen is not help, however correct it is.
Diagnose first, from liveRuntime: the task, its values in `demand`, and what the child has
done and said. Then send four things. `obstacle`: what this child is missing, in your own
words. `delta`: what will be different from their screen, from liveRuntime.moveOptions.deltas.
`representation`: which model the help uses, from liveRuntime.moveOptions; asking for the one
already on screen is refused unless your delta compares or works a process. `nextAction`: the
one thing the child will do next, which you say out loud when the move appears.
Supply the numbers in `values`: two counts for a contrast, the start and the change for
re-represent and model-process (with `operation`), and every count drawn for illustrate
(with `description`, the literal picture). No number may be this task's own value or answer.
The pictures are built from your numbers, so say what the captions say and nothing more.
The cheapest move is attend: draw the child's attention to named parts of their OWN work, from
liveRuntime.moveOptions.attentionTargets, and say what to do with them. Name every part the move
covers, not just one. It draws nothing new and costs no detour, so reach for it before anything
that puts a second thing on screen. The list you are given already excludes anything that would
give away what this item is asking for; if a move comes back ANSWER_REVEAL, you asked for a part
that IS the answer, so attend to something else or make a different move.
Prefer the cheapest move that fits. Every delta but illustrate appears at once; illustrate
takes about fifteen seconds, so use it only for something no shape can draw, such as a story
or a real object, and say one short sentence while it draws.
After status=visible, name what changed in one sentence, connect it to the method in one more,
then say your nextAction and hand the task back. If the move is refused, read the reason, make
a cheaper move or carry on with words. One detour per item.
"""

MOVE_DELTAS = ["attend", "reveal-aid", "microstep", "re-represent", "contrast", "model-process", "illustrate"]
MOVE_OPERATIONS = ["make-ten", "subtract", "count"]


def runtime_tool(spec=None):
    """The move tool carries the closed lists as enums; `representation` is checked live.

    The deltas and operations cannot change during a session, so they are enums here. Which
    representations exist depends on the mounted primitive, which is not known when the tools
    are declared, so the browser refuses an unavailable one and names the allowed set.
    """
    moves = [types.FunctionDeclaration(
        name="compose_move", behavior=types.Behavior.NON_BLOCKING,
        description="Make one teaching move on the obstacle you diagnosed. Name what the child is missing, what will be different from their screen, and the one thing they do next.",
        parameters=types.Schema(type="OBJECT", properties={
            "obstacle": types.Schema(type="STRING", description="What THIS child is missing, in your own words, e.g. 'does not see the empty spaces as a quantity to count'."),
            "delta": types.Schema(type="STRING", enum=MOVE_DELTAS, description="What will be different from their screen. Use one currently listed in liveRuntime.moveOptions.deltas."),
            "representation": types.Schema(type="STRING", description="Which model the help uses, from liveRuntime.moveOptions. The one already on screen is refused unless the delta compares or works a process."),
            "nextAction": types.Schema(type="STRING", description="The one observable thing the child does next, e.g. 'count the empty spaces out loud'. Say it when the move appears."),
            "values": types.Schema(type="ARRAY", items=types.Schema(type="INTEGER"), description="contrast: the two counts. re-represent and model-process: the start and the change. illustrate: every count drawn. None may be this task's value or answer."),
            "operation": types.Schema(type="STRING", enum=MOVE_OPERATIONS, description="Required by re-represent and model-process: which process the counters show."),
            "description": types.Schema(type="STRING", description="illustrate only: the literal picture. Which objects, exactly how many, how arranged, what is highlighted."),
            "targets": types.Schema(type="ARRAY", items=types.Schema(type="STRING"), description="attend only: which parts of the child's OWN work to draw attention to, copied from liveRuntime.moveOptions.attentionTargets. Send every part the move covers, e.g. all the empty spaces. An attend draws nothing new, so send empty values."),
        }, required=["obstacle", "delta", "representation", "nextAction", "values"]),
    )] if spec and spec.get("teachingMoves") else []
    observe = [types.FunctionDeclaration(
        name="observe_runtime", behavior=types.Behavior.NON_BLOCKING,
        description="Read the mounted lesson workspace and subscribe to silent task updates. Call at lesson entry or after reconnect. This does not grade, advance, or change the screen.",
        parameters=types.Schema(type="OBJECT", properties={}),
    )] if spec and spec.get("lesson") else []
    return types.Tool(function_declarations=observe + moves + [types.FunctionDeclaration(
        name="perform_runtime_action", behavior=types.Behavior.NON_BLOCKING,
        description="Perform one currently advertised action. Copy its exact actionId ticket from liveRuntime. The ticket is scoped to that item and revision. Wait for visible before describing a screen change.",
        parameters=types.Schema(type="OBJECT", properties={
            "actionId": types.Schema(type="STRING", description="Exact opaque ticket from a currently advertised choice. Never construct it."),
            "targets": types.Schema(type="ARRAY", items=types.Schema(type="STRING"), description="Workspace actions only: IDs of visible objects from task.workspace.objects. Empty list clears a demonstration."),
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


def parse_runtime_spec(spec, *, activity_enabled, lesson_enabled=False):
    if not activity_enabled and not lesson_enabled:
        raise ValueError("Runtime controls require an activity sandbox; the connected fixture has been retired")
    if (not isinstance(spec, dict) or not {"sessionEpoch", "initialState"} <= set(spec) <= {"sessionEpoch", "initialState", "teachingMoves"}
            or not isinstance(spec.get("teachingMoves", False), bool)
            or not isinstance(spec.get("sessionEpoch"), str) or not 1 <= len(spec["sessionEpoch"]) <= 200
            or not valid_packet(spec.get("initialState"), spec["sessionEpoch"])):
        raise ValueError("Invalid runtime sandbox configuration")
    return {**spec, "lesson": True} if lesson_enabled else spec


class LiveRuntimeTools:
    def __init__(self, emit, reply, spec, timeout=8, picture_timeout=60):
        self.emit, self.reply, self.timeout, self.picture_timeout = emit, reply, timeout, picture_timeout
        self.lesson = bool(spec.get("lesson"))
        self.observation_call = None
        self.moves = bool(spec.get("teachingMoves"))
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

    async def publish_observation(self, *, initial=False):
        if self.observation_call:
            await self.reply(types.FunctionResponse(id=self.observation_call.id, name="observe_runtime",
                response={"status": "observing", "liveRuntime": self.state}, will_continue=True,
                scheduling="WHEN_IDLE" if initial else "SILENT"))

    async def call(self, call):
        if call.id in self.seen:
            return
        if len(self.seen) >= 256:
            await self.respond(call, "blocked", reason="Session command budget exhausted")
            return
        self.seen.add(call.id)
        args = call.args or {}
        if call.name == "observe_runtime":
            if not self.lesson or args:
                await self.respond(call, "invalid")
                return
            if self.observation_call:
                await self.reply(types.FunctionResponse(id=self.observation_call.id, name="observe_runtime",
                    response={"status": "replaced"}, will_continue=False, scheduling="SILENT"))
            self.observation_call = call
            await self.publish_observation(initial=True)
            return
        if call.name == "compose_move":
            await self.compose(call, args)
            return
        if (call.name != "perform_runtime_action" or not isinstance(args, dict)
                or not {"actionId"} <= set(args) <= {"actionId", "targets"} or not isinstance(args["actionId"], str)
                or ("targets" in args and not (isinstance(args["targets"], list) and len(args["targets"]) <= 30
                    and all(isinstance(t, str) and 0 < len(t) <= 200 for t in args["targets"])
                    and len(set(args["targets"])) == len(args["targets"])))):
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
        action = dict(choice["action"])
        parameters = {k: args[k] for k in ("targets",) if k in args}
        if parameters and action.get("type") != "workspace":
            await self.respond(call, "invalid", reason="This action takes no workspace parameters")
            return
        if action.get("type") == "workspace":
            action["input"] = parameters
        scope = {"sessionEpoch": self.epoch, "instanceId": self.state["instanceId"],
                 "itemId": self.state["task"]["itemId"], "expectedRevision": self.state["revision"]}
        self.pending = SimpleNamespace(id=call.id, name=call.name, args=scope, response_speech=choice.get("responseSpeech"))
        self.timer = asyncio.create_task(self.expire(call.id))
        await self.emit({"type": "runtime_command", "command": {
            **scope, "commandId": call.id, "action": action}})

    async def compose(self, call, args):
        """Relay the tutor's own move. The browser refuses it, builds it, and shows it.

        Nothing here knows a primitive, a representation or a shape: the four fields and the
        numbers travel as the tutor sent them, and the mounted adapter is the one place that
        can say whether this move redraws the task or the model already on screen.
        """
        text = lambda v, n: isinstance(v, str) and 0 < len(v.strip()) <= n
        fields = {"obstacle", "delta", "representation", "nextAction", "values"}
        if (not self.moves or not isinstance(args, dict) or not fields <= set(args) <= fields | {"operation", "description", "targets"}
                or args["delta"] not in MOVE_DELTAS or not text(args["obstacle"], 300) or not text(args["nextAction"], 200)
                or not text(args["representation"], 60)
                or not isinstance(args["values"], list) or len(args["values"]) > 6
                or not all(type(n) is int and 0 <= n <= 20 for n in args["values"])
                or ("operation" in args and args["operation"] not in MOVE_OPERATIONS)
                or ("description" in args and not text(args["description"], 600))
                or ("targets" in args and not (isinstance(args["targets"], list) and 1 <= len(args["targets"]) <= 12
                                               and all(text(t, 100) for t in args["targets"])))):
            await self.respond(call, "invalid", reason="Give obstacle, delta, representation, nextAction and values; operation for a process, description only for a drawn picture")
            return
        if self.pending:
            await self.respond(call, "blocked", reason="Another action is awaiting its browser receipt")
            return
        options = self.state.get("moveOptions")
        if not self.state.get("task") or not options:
            await self.respond(call, "blocked", reason="A composed move is not available now. Use an advertised choice or words.")
            return
        if args["delta"] not in options.get("deltas", []):
            await self.respond(call, "blocked", reason=f"Available deltas here: {', '.join(options.get('deltas', []))}")
            return
        scope = {"sessionEpoch": self.epoch, "instanceId": self.state["instanceId"],
                 "itemId": self.state["task"]["itemId"], "expectedRevision": self.state["revision"]}
        # A drawn picture is the only slow carrier; every other move commits at once.
        timeout = self.picture_timeout if args["delta"] == "illustrate" else self.timeout
        self.pending = SimpleNamespace(id=call.id, name=call.name, args=scope, response_speech=None)
        self.timer = asyncio.create_task(self.expire(call.id, timeout))
        move = {k: args[k].strip() for k in ("obstacle", "delta", "representation", "nextAction")}
        move["values"] = list(args["values"])
        if "operation" in args:
            move["operation"] = args["operation"]
        if "description" in args:
            move["description"] = args["description"].strip()
        if "targets" in args:
            move["targets"] = [t.strip() for t in args["targets"]]
        await self.emit({"type": "runtime_compose_move", "commandId": call.id, "scope": scope, "move": move})

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

    async def expire(self, call_id, timeout=None):
        await asyncio.sleep(timeout or self.timeout)
        if self.pending and self.pending.id == call_id:
            call = self.pending
            self.clear_pending()
            await self.emit({"type": "runtime_cancelled", "commandId": call_id})
            await self.respond(call, "timeout", reason="Browser did not confirm visibility")

    async def cancelled_by_model(self, ids):
        if self.observation_call and self.observation_call.id in ids:
            self.observation_call = None
        if self.pending and self.pending.id in ids:
            call_id = self.pending.id
            self.clear_pending()
            await self.emit({"type": "runtime_cancelled", "commandId": call_id})

    async def reset(self):
        self.observation_call = None
        if self.pending:
            await self.emit({"type": "runtime_cancelled", "commandId": self.pending.id})
        self.clear_pending()


class CombinedLiveTools:
    """Compose existing transport surfaces; each bridge retains its own protocol."""
    def __init__(self, activity, runtime):
        self.activity, self.runtime = activity, runtime

    async def call(self, call):
        state = getattr(self.runtime, 'state', {})
        if (call.name == 'request_activity' and state.get('task')
                and state.get('status') not in ('empty', 'completed', 'stopped')):
            await self.runtime.respond(call, 'blocked', reason='An unfinished activity is already mounted. Use its current runtime choices; do not request a replacement.')
            return
        await (self.runtime if call.name in ("perform_runtime_action", "compose_move", "observe_runtime") else self.activity).call(call)

    async def cancelled_by_model(self, ids):
        await self.activity.cancelled_by_model(ids)
        await self.runtime.cancelled_by_model(ids)

    async def reset(self):
        await self.activity.reset()
        await self.runtime.reset()
