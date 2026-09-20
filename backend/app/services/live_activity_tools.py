"""Opt-in sandbox bridge: Live requests, browser generation/mount, streamed state.

The receive loop never waits for generation. Only a matching mount receipt gives
the model permission to teach from new content. No learning records are written.

Still used by LiveActivitySandbox for activity creation and prepared lesson mounts.
Current-task help lives in live_runtime_tools. The host supplies activity and visual
capabilities; this module only correlates requests and browser receipts.
"""
import asyncio
import json
import re
import uuid
from google.genai import types
# Only session/ownership protocol belongs here. Activity content, modes and
# guidance are supplied by the host's registered adapters.
SANDBOX_INSTRUCTION = """
Lead a short, warm tutoring conversation in English unless asked otherwise.
The host's available activities and visual descriptions are authoritative.
On [LESSON_START], execute the requested start immediately; do not greet or
invent content before status=mounted. request_activity generates an activity.
A preparing receipt is not visibility: give at most one short strategy sentence
only when its teachingOwner is tutor, then wait. A failed request is not a reason
to retry in a loop. The mounted receipt supplies actual state and guidance.
When teachingOwner=di-runner, wait silently for its scripted opening. Follow its
exact question, correction, affirmation and closing cues and judging contracts;
these override general style advice. Never invent a verdict or advance its items.
When teachingOwner=tutor, teach the current task without revealing its answer.
Use advance_activity only for an activity advertising canAdvance, after checked
correctness; the browser validates it. Wait for advanced before describing movement.
For direct visuals, use only advertised tools. They replace the workspace and
clear previous work; never replace an unfinished activity to provide help.
Mounted direct visuals advertise highlightCount; highlight_visual points using
zero-based indices without changing work. Do not point out an unanswered target.
Student state updates are silent reference, not triggers to narrate or mark correct.
Use runtime help actions when advertised. Speak one question at a time and never
read protocol tags or identifiers aloud. Never claim practice updated mastery.
"""

PLAN_INSTRUCTION = """
This lesson has prepared activities in the supplied order. Use start_plan_item
with the next unfinished itemId; do not generate replacements. On [LESSON_START],
start the first item immediately without greeting or describing unseen content.
Only an item_complete receipt hands you the next activity: follow its guidance
once, without repeating praise. An empty nextItemId means close the lesson briefly
without starting or offering another activity. Rejections are not retry-loop triggers.
"""


PLAN_ITEM_ID = re.compile(r"item-[1-9][0-9]?")


def parse_plan(value, enabled_primitives):
    """Validate the browser's plan summary. Identities and purpose only: no content."""
    if value is None:
        return None
    items = value.get("items") if isinstance(value, dict) else None
    if (not isinstance(value, dict) or set(value) - {"topic", "items"} or not isinstance(value.get("topic"), str)
            or len(value["topic"]) > 300 or not isinstance(items, list) or not 1 <= len(items) <= 8):
        raise ValueError("invalid lesson plan")
    fields = {"itemId", "primitiveId", "title", "evalMode", "objective"}
    for item in items:
        if (not isinstance(item, dict) or set(item) != fields
                or any(not isinstance(item[k], str) or not 0 < len(item[k]) <= 500 for k in fields)
                or not PLAN_ITEM_ID.fullmatch(item["itemId"]) or item["primitiveId"] not in enabled_primitives):
            raise ValueError("invalid lesson plan item")
    if len({item["itemId"] for item in items}) != len(items):
        raise ValueError("duplicate lesson plan item")
    return {"topic": value["topic"], "items": [dict(item) for item in items]}


def parse_activity_spec(value):
    """Validate a bounded host capability envelope, without a Python primitive catalog."""
    if (not isinstance(value, dict) or set(value) - {"activities", "visuals", "plan"}
            or not isinstance(value.get("activities"), list) or not isinstance(value.get("visuals"), list)
            or not 1 <= len(value["activities"]) + len(value["visuals"]) <= 32
            or len(json.dumps(value)) > 32000):
        raise ValueError("Invalid activity capability envelope")
    activities, visuals = {}, {}
    for offer in value["activities"]:
        if (not isinstance(offer, dict) or set(offer) != {"primitiveId", "modes", "teachingOwner", "canAdvance", "guidance"}
                or not isinstance(offer["primitiveId"], str) or not re.fullmatch(r"[a-z][a-z0-9-]{0,79}", offer["primitiveId"])
                or offer["primitiveId"] in activities or not isinstance(offer["modes"], list) or not 1 <= len(offer["modes"]) <= 32
                or any(not isinstance(mode, str) or not re.fullmatch(r"[a-z][a-z0-9_-]{0,63}", mode) for mode in offer["modes"])
                or len(set(offer["modes"])) != len(offer["modes"])
                or offer["teachingOwner"] not in ("tutor", "di-runner") or type(offer["canAdvance"]) is not bool
                or (offer["teachingOwner"] == "di-runner" and offer["canAdvance"])
                or not isinstance(offer["guidance"], str) or not 1 <= len(offer["guidance"]) <= 2000):
            raise ValueError("Invalid activity offer")
        activities[offer["primitiveId"]] = offer
    reserved = {"perform_runtime_action", "request_activity", "advance_activity", "start_plan_item", "highlight_visual"}
    for offer in value["visuals"]:
        if (not isinstance(offer, dict) or set(offer) != {"name", "primitiveId", "description", "parameters"}
                or not isinstance(offer["name"], str) or not re.fullmatch(r"[a-z][a-z0-9_]{0,63}", offer["name"])
                or offer["name"] in reserved or offer["name"] in visuals
                or not isinstance(offer["primitiveId"], str) or not re.fullmatch(r"[a-z][a-z0-9-]{0,79}", offer["primitiveId"])
                or offer["primitiveId"] in activities or any(v["primitiveId"] == offer["primitiveId"] for v in visuals.values())
                or not isinstance(offer["description"], str) or not 1 <= len(offer["description"]) <= 2000
                or not isinstance(offer["parameters"], dict) or offer["parameters"].get("type") != "OBJECT"
                or len(json.dumps(offer["parameters"])) > 8000):
            raise ValueError("Invalid visual offer")
        types.Schema.model_validate(offer["parameters"])
        visuals[offer["name"]] = offer
    plan = parse_plan(value.get("plan"), activities)
    if plan and (visuals or any(item["evalMode"] not in activities[item["primitiveId"]]["modes"] for item in plan["items"])):
        raise ValueError("Planned items must use advertised modes and cannot enable replacing visuals")
    return {"activities": list(activities.values()), "visuals": list(visuals.values()), **({"plan": plan} if plan else {})}


def activity_instruction(spec):
    return (SANDBOX_INSTRUCTION + (PLAN_INSTRUCTION + "\nLesson plan: " + json.dumps(spec["plan"]) if spec.get("plan") else "")
            + "\nAvailable activities: " + json.dumps(spec["activities"]))


ADVANCE_DECLARATION = types.FunctionDeclaration(
    name="advance_activity", behavior=types.Behavior.NON_BLOCKING,
    description="Advance a mounted activity advertising canAdvance after checked correctness. The browser validates scope and returns visible state. Does not generate content.",
    parameters=types.Schema(type="OBJECT", properties={
        "instanceId": types.Schema(type="STRING"),
        "challengeIndex": types.Schema(type="INTEGER", description="Current zero-based challenge index, before advancing."),
    }, required=["instanceId", "challengeIndex"]),
)
HIGHLIGHT_DECLARATION = types.FunctionDeclaration(
    name="highlight_visual", behavior=types.Behavior.NON_BLOCKING,
    description="Point to zero-based indices on a mounted direct visual. Use its highlightCount as the bound; [] clears pointing. Wait for updated before describing it.",
    parameters=types.Schema(type="OBJECT", properties={"instanceId": types.Schema(type="STRING"),
        "indices": types.Schema(type="ARRAY", items=types.Schema(type="INTEGER"))}, required=["instanceId", "indices"]),
)


def activity_tool(spec):
    activities, plan = spec["activities"], spec.get("plan")
    declarations = []
    if plan:
        declarations.append(types.FunctionDeclaration(name="start_plan_item", behavior=types.Behavior.NON_BLOCKING,
            description="Show the next prepared activity from the lesson plan. No generation. Only the next unfinished item can start; wait for mounted.",
            parameters=types.Schema(type="OBJECT", properties={"itemId": types.Schema(type="STRING",
                enum=[item["itemId"] for item in plan["items"]])}, required=["itemId"])))
    elif activities:
        declarations.append(types.FunctionDeclaration(name="request_activity", behavior=types.Behavior.NON_BLOCKING,
            description="Generate an advertised activity. Use its supported mode and teaching owner from Available activities. Reports preparing, mounted and student state.",
            parameters=types.Schema(type="OBJECT", properties={
                "primitiveId": types.Schema(type="STRING", enum=[a["primitiveId"] for a in activities]),
                "mode": types.Schema(type="STRING", enum=list(dict.fromkeys(mode for a in activities for mode in a["modes"]))),
                "topic": types.Schema(type="STRING", description="The learner's specific topic."),
                "intent": types.Schema(type="STRING", description="Teaching objective, operation and numeric constraints."),
            }, required=["primitiveId", "topic", "intent", "mode"])))
    if any(a["canAdvance"] for a in activities): declarations.append(ADVANCE_DECLARATION)
    for visual in spec["visuals"]:
        declarations.append(types.FunctionDeclaration(name=visual["name"], description=visual["description"],
            behavior=types.Behavior.NON_BLOCKING, parameters=types.Schema.model_validate(visual["parameters"])))
    if spec["visuals"]: declarations.append(HIGHLIGHT_DECLARATION)
    return types.Tool(function_declarations=declarations)


class LiveActivityTools:
    def __init__(self, emit, reply, spec, timeout=120):
        self.emit, self.reply, self.timeout = emit, reply, timeout
        self.activities = {a["primitiveId"]: a for a in spec["activities"]}
        self.visuals = {v["name"]: v for v in spec["visuals"]}
        plan = spec.get("plan")
        self.plan = plan
        self.plan_items = {item["itemId"]: item for item in plan["items"]} if plan else {}
        self.pending_item = None
        self.active_item = None
        # Mounted instances whose completion the browser has already reported.
        self.completed = set()
        self.pending = None
        self.pending_request = None
        self.active = None
        self.timer = None
        self.seen = set()
        self.command = None
        self.command_timer = None
        self.call_names = {}
        self.pending_type = None
        self.active_type = None
        self.visual_size = 0
        self.command_name = "advance_activity"

    async def finish_command(self, status, **data):
        command, self.command = self.command, None
        if self.command_timer and self.command_timer is not asyncio.current_task():
            self.command_timer.cancel()
        self.command_timer = None
        if command:
            await self.reply(types.FunctionResponse(id=command[0], name=self.command_name,
                response={"status": status, **data}, scheduling="WHEN_IDLE"))

    async def advance(self, call):
        args = call.args or {}
        index = args.get("challengeIndex")
        if (not self.activities.get(self.active_type, {}).get("canAdvance") or not self.active or args.get("instanceId") != self.active[1]
                or type(index) is not int or index < 0 or self.command or len(self.seen) > 100):
            await self.reply(types.FunctionResponse(id=call.id, name=call.name,
                response={"status": "rejected", "error": "No matching mounted activity, invalid index, or another advance is pending."},
                scheduling="WHEN_IDLE"))
            return
        self.command = (call.id, self.active[1])
        self.command_name = "advance_activity"
        await self.emit({"type": "activity_command", "callId": call.id,
                         "instanceId": self.active[1], "challengeIndex": index})
        self.command_timer = asyncio.create_task(self.expire_command(call.id))

    async def show_visual(self, call):
        # Parameters are interpreted/validated by the host's visual adapter.
        args, offer = call.args or {}, self.visuals[call.name]
        if not isinstance(args, dict) or len(json.dumps(args)) > 8000:
            await self.reply(types.FunctionResponse(id=call.id, name=call.name,
                response={"status": "error", "error": "Invalid visual parameters"}, scheduling="WHEN_IDLE"))
            return
        await self.cancel_pending("superseded")
        self.pending, self.pending_type = call.id, offer["primitiveId"]
        await self.emit({"type": "activity_visual", "callId": call.id, "toolName": call.name, "args": args,
                         "instanceId": "visual-" + str(uuid.uuid4())})
        self.timer = asyncio.create_task(self.expire(call.id))

    async def highlight(self, call):
        args = call.args or {}
        indices = args.get("indices")
        if (not self.active or self.active_type not in {v["primitiveId"] for v in self.visuals.values()} or args.get("instanceId") != self.active[1]
                or self.command or not isinstance(indices, list) or len(indices) > self.visual_size
                or any(type(i) is not int or not 0 <= i < self.visual_size for i in indices)):
            await self.reply(types.FunctionResponse(id=call.id, name=call.name,
                response={"status": "rejected", "error": "Use indices on the matching mounted direct visual; another command may be pending."}, scheduling="WHEN_IDLE"))
            return
        self.command = (call.id, self.active[1])
        self.command_name = call.name
        await self.emit({"type": "activity_highlight", "callId": call.id,
                         "instanceId": self.active[1], "indices": sorted(set(indices))})
        self.command_timer = asyncio.create_task(self.expire_command(call.id))

    async def expire_command(self, call_id):
        await asyncio.sleep(10)
        if self.command and self.command[0] == call_id:
            await self.finish_command("rejected", error="Screen advance was not acknowledged. Read current state before retrying.")

    async def command_result(self, message):
        if (not self.command or self.command != (message.get("callId"), message.get("instanceId"))
                or not self.active or self.active[1] != message.get("instanceId")):
            return False
        status = message.get("status")
        allowed = ("updated", "rejected") if self.command_name == "highlight_visual" else ("advanced", "complete", "rejected")
        if status not in allowed or not isinstance(message.get("state"), dict):
            await self.finish_command("rejected", error="Invalid screen receipt")
            return False
        await self.finish_command(status, instanceId=message["instanceId"], state=message["state"],
                                  error=str(message.get("error", ""))[:300])
        return True

    async def start_plan_item(self, call):
        item_id = (call.args or {}).get("itemId")
        item = self.plan_items.get(item_id) if isinstance(item_id, str) else None
        if not item or len(self.seen) > 100:
            await self.reply(types.FunctionResponse(id=call.id, name=call.name, scheduling="WHEN_IDLE",
                response={"status": "rejected", "error": "Unknown plan item."}))
            return
        await self.cancel_pending("superseded")
        self.pending, self.pending_type, self.pending_item = call.id, item["primitiveId"], item["itemId"]
        # Prepared content: the browser mounts it directly, so there is no preparing receipt.
        await self.emit({"type": "activity_request", "callId": call.id, "args": {"planItemId": item["itemId"]}})
        self.timer = asyncio.create_task(self.expire(call.id))

    async def item_complete(self, message):
        """Relay the browser's completion report for the mounted plan item, once.
        Known phase-1 gap (LIVE_LESSON_ROADMAP): this receipt is not coordinated
        with the primitive's own completion cue or a DI runner's closing line."""
        instance, next_id = message.get("instanceId"), message.get("nextItemId") or ""
        if (not self.plan or not self.active or self.active != (message.get("callId"), instance)
                or instance in self.completed or message.get("itemId") != self.active_item
                or not isinstance(next_id, str) or (next_id and next_id not in self.plan_items)):
            return False
        self.completed.add(instance)
        following = self.plan_items.get(next_id)
        outcome = message.get("outcome") if isinstance(message.get("outcome"), dict) else {}
        await self.respond(
            self.active[0], "item_complete", continuing=True, scheduling="WHEN_IDLE",
            itemId=self.active_item, nextItemId=next_id, nextTitle=following["title"] if following else "",
            outcome={k: outcome[k] for k in ("disposition", "allCorrect", "score") if k in outcome},
            guidance=(f'This activity is finished. Say one short sentence that moves on to "{following["title"]}", '
                      f'then call start_plan_item with itemId {next_id}. Do not describe its content before it is mounted.')
            if following else "The planned lesson is finished. Say one short closing sentence. Do not start or offer another activity.")
        return True

    async def respond(self, call_id, status, *, continuing=False, scheduling="SILENT", **data):
        await self.reply(types.FunctionResponse(
            id=call_id, name=self.call_names.get(call_id, "request_activity"), response={"status": status, **data},
            will_continue=continuing, scheduling=scheduling,
        ))

    def stop_timer(self):
        if self.timer and self.timer is not asyncio.current_task():
            self.timer.cancel()
        self.timer = None

    async def cancel_pending(self, reason):
        call_id, self.pending = self.pending, None
        self.pending_request = None
        self.stop_timer()
        if call_id:
            await self.emit({"type": "activity_cancelled", "callId": call_id, "reason": reason})
            await self.respond(call_id, "cancelled", reason=reason)

    async def call(self, call):
        if not call.id or call.id in self.seen:
            return
        self.seen.add(call.id)
        self.call_names[call.id] = call.name
        if not isinstance(call.args or {}, dict):
            await self.reply(types.FunctionResponse(id=call.id, name=call.name,
                response={"status": "error", "error": "Tool arguments must be an object"}))
            return
        if self.plan:
            if call.name == "start_plan_item":
                await self.start_plan_item(call)
            elif call.name == "advance_activity":
                await self.advance(call)
            else:
                await self.reply(types.FunctionResponse(id=call.id, name=call.name, response={
                    "status": "error", "error": "Only start_plan_item and advance_activity are available in this lesson."}))
            return
        if self.visuals and len(self.seen) <= 100:
            if call.name in self.visuals:
                await self.show_visual(call)
                return
            if call.name == "highlight_visual":
                await self.highlight(call)
                return
        if call.name == "advance_activity":
            await self.advance(call)
            return
        args = call.args or {}
        primitive = args.get("primitiveId")
        offer = self.activities.get(primitive) if isinstance(primitive, str) else None
        if (not offer or call.name != "request_activity" or len(self.seen) > 100
                or args.get("mode") not in offer["modes"]
                or any(not isinstance(args.get(k), str) or not 1 <= len(args[k].strip()) <= 1000
                       for k in ("topic", "intent"))):
            await self.reply(types.FunctionResponse(id=call.id, name=call.name,
                response={"status": "error", "error": "Unsupported activity request"}))
            return
        request = {k: args[k].strip() for k in ("primitiveId", "topic", "intent", "mode")}
        if self.pending and request == self.pending_request:
            # A fresh model call ID is not a fresh learner request. Keep the
            # generation already in flight and its original mount correlation.
            await self.respond(call.id, "already_preparing", scheduling="SILENT",
                               originalCallId=self.pending, visible=False)
            return
        await self.cancel_pending("superseded")
        self.pending = call.id
        self.pending_request = request
        self.pending_type = primitive
        # NON_BLOCKING alone leaves the standard Live model waiting silently.
        # A continuing response gives it a conversational turn while generation
        # runs. This is progress only; the later mount receipt still owns visibility.
        await self.respond(call.id, "preparing", continuing=True, scheduling="SILENT" if offer["teachingOwner"] == "di-runner" else "WHEN_IDLE",
                           teachingOwner=offer["teachingOwner"], topic=args["topic"], intent=args["intent"], visible=False)
        await self.emit({"type": "activity_request", "callId": call.id,
                         "args": request})
        self.timer = asyncio.create_task(self.expire(call.id))

    async def expire(self, call_id):
        await asyncio.sleep(self.timeout)
        if self.pending == call_id:
            await self.cancel_pending("generation or mount timed out")

    async def result(self, message):
        call_id = message.get("callId")
        if not call_id or call_id != self.pending:
            return False
        self.pending = None
        self.pending_request = None
        item, self.pending_item = self.pending_item, None
        self.stop_timer()
        status = message.get("status")
        data = message.get("data")
        plan_item = message.get("planItem")
        if self.plan and status == "mounted" and (not isinstance(plan_item, dict) or plan_item.get("itemId") != item):
            status, message = "error", {"error": "The mounted activity does not match the requested plan item."}
        is_visual = self.pending_type in {v["primitiveId"] for v in self.visuals.values()}
        size = message.get("highlightCount")
        if status == "mounted" and is_visual and (type(size) is not int or not 0 <= size <= 256):
            status, message = "error", {"error": "Visual mount must report its highlightCount"}
        if status != "mounted" or not isinstance(data, dict) or not message.get("instanceId"):
            await self.respond(call_id, "error" if not self.plan else "rejected", scheduling="WHEN_IDLE",
                               error=str(message.get("error", "Activity did not mount"))[:500])
            return False
        if self.active:
            await self.finish_command("rejected", error="Activity replaced")
            await self.respond(self.active[0], "replaced")
        self.active = (call_id, message["instanceId"])
        self.active_type = self.pending_type
        self.active_item = item
        self.visual_size = size if is_visual else 0
        offer = self.activities.get(self.active_type, {})
        owner = offer.get("teachingOwner", "tutor")
        described = {"planItem": {k: str(plan_item[k])[:500] for k in ("itemId", "title", "intent", "evalMode", "objective")
                                  if k in plan_item}} if self.plan else {}
        await self.respond(call_id, "mounted", continuing=True, scheduling="SILENT" if owner == "di-runner" else "WHEN_IDLE",
                           teachingOwner=owner, canAdvance=offer.get("canAdvance", False), highlightCount=self.visual_size,
                           instanceId=message["instanceId"], primitiveId=self.active_type,
                           data=data, guidance=message.get("guidance") or offer.get("guidance", ""), **described)
        if owner == "di-runner":
            await self.emit({"type": "activity_ready", "callId": call_id,
                             "instanceId": message["instanceId"], "primitiveId": self.active_type})
        return True

    async def state(self, instance_id, state):
        if self.active and self.active[1] == instance_id:
            await self.respond(self.active[0], "student_state", continuing=True,
                               instanceId=instance_id, state=state)

    async def runtime_state(self, state):
        """Deliver browser controls to voice turns through the open activity stream.

        SILENT updates change model context without taking the conversational floor.
        Text-only state attachment cannot reach a learner speaking over audio.
        """
        if self.active and self.active[1] == state.get("instanceId"):
            await self.state(self.active[1], {"liveRuntime": state})

    async def cancelled_by_model(self, ids):
        if self.command and self.command[0] in ids:
            self.command = None
            if self.command_timer:
                self.command_timer.cancel()
                self.command_timer = None
        if self.pending in ids:
            call_id, self.pending = self.pending, None
            self.stop_timer()
            await self.emit({"type": "activity_cancelled", "callId": call_id, "reason": "model cancelled"})
        if self.active and self.active[0] in ids:
            self.active = None

    async def reset(self):
        # A new Gemini connection must never receive an old connection's results.
        self.stop_timer()
        self.command = None
        if self.command_timer:
            self.command_timer.cancel()
            self.command_timer = None
        if self.pending:
            await self.emit({"type": "activity_cancelled", "callId": self.pending, "reason": "session reconnecting"})
        self.pending = self.active = None
        self.pending_request = None
        self.active_type = self.pending_item = self.active_item = None
