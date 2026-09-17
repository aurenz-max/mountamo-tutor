"""Planned live lesson bridge (LIVE_LESSON_ROADMAP phase 1): start, mount, completion handoff."""
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase, TestCase

from app.services.live_activity_tools import LiveActivityTools, activity_tool, parse_plan, activity_instruction
from activity_test_spec import spec

PLAN = {"topic": "Add and take away", "items": [
    {"itemId": "item-1", "primitiveId": "ten-frame", "title": "Double ten frame", "evalMode": "operate", "objective": "Act out stories"},
    {"itemId": "item-2", "primitiveId": "number-line", "title": "Number line hops", "evalMode": "jump", "objective": "Explain a number sentence"},
]}


class ParsePlanTest(TestCase):
    def test_accepts_identities_only_and_rejects_content_or_unknown_primitives(self):
        self.assertEqual(parse_plan(PLAN, ["ten-frame", "number-line"])["items"][1]["itemId"], "item-2")
        self.assertIsNone(parse_plan(None, ["ten-frame"]))
        bad = [
            {**PLAN, "extra": 1},
            {"topic": "x", "items": []},
            {"topic": "x", "items": [{**PLAN["items"][0], "data": {"challenges": []}}]},
            {"topic": "x", "items": [{**PLAN["items"][0], "itemId": "ten-frame"}]},
            {"topic": "x", "items": [PLAN["items"][0], PLAN["items"][0]]},
        ]
        for value in bad:
            with self.assertRaises(ValueError):
                parse_plan(value, ["ten-frame", "number-line"])
        with self.assertRaises(ValueError):
            parse_plan(PLAN, ["ten-frame"])

    def test_plan_tools_replace_generation_and_instruction_lists_the_plan(self):
        plan = parse_plan(PLAN, ["ten-frame", "number-line"])
        names = [d.name for d in activity_tool(spec(runner=True, plan=plan)).function_declarations]
        self.assertEqual(names, ["start_plan_item", "advance_activity"])
        start = activity_tool(spec(runner=True, plan=plan)).function_declarations[0]
        self.assertEqual(start.behavior.value, "NON_BLOCKING")
        self.assertEqual(start.parameters.properties["itemId"].enum, ["item-1", "item-2"])
        text = activity_instruction(spec(runner=True, plan=plan))
        self.assertIn('"itemId": "item-2"', text)
        self.assertIn("teachingOwner", text)
        self.assertIn("do not generate replacements", text)


class PlanBridgeTest(IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.events, self.replies = [], []
        async def emit(v): self.events.append(v)
        async def reply(v): self.replies.append(v)
        self.bridge = LiveActivityTools(emit, reply, spec(runner=True, plan=parse_plan(PLAN, ["ten-frame", "number-line"])), timeout=5)

    async def asyncTearDown(self):
        await self.bridge.reset()

    def start(self, call_id, item_id):
        return self.bridge.call(SimpleNamespace(id=call_id, name="start_plan_item", args={"itemId": item_id}))

    async def mount(self, call_id, item_id, instance):
        return await self.bridge.result({"callId": call_id, "status": "mounted", "instanceId": instance, "data": {"x": 1},
                                         "planItem": {"itemId": item_id, "title": "t", "intent": "i", "evalMode": "m", "objective": "o"}})

    async def test_start_mounts_prepared_content_without_a_preparing_turn(self):
        await self.start("s1", "item-1")
        self.assertEqual(self.events[-1], {"type": "activity_request", "callId": "s1", "args": {"planItemId": "item-1"}})
        self.assertEqual(self.replies, [])
        self.assertFalse(await self.mount("s1", "item-2", "frame"))  # mismatched item
        self.assertEqual(self.replies[-1].response["status"], "rejected")
        await self.start("s2", "item-1")
        self.assertTrue(await self.mount("s2", "item-1", "frame"))
        mounted = self.replies[-1]
        self.assertEqual((mounted.name, mounted.response["status"], mounted.scheduling.value), ("start_plan_item", "mounted", "SILENT"))
        self.assertEqual(mounted.response["planItem"]["itemId"], "item-1")
        self.assertEqual(self.events[-1]["type"], "activity_ready")

    async def test_unknown_items_and_generation_tools_are_rejected(self):
        await self.start("s1", "item-9")
        self.assertEqual(self.replies[-1].response["status"], "rejected")
        await self.bridge.call(SimpleNamespace(id="g", name="request_activity", args={"primitiveId": "number-line"}))
        self.assertEqual(self.replies[-1].response["status"], "error")
        self.assertEqual(self.events, [])
        await self.start("s2", "item-1")
        await self.bridge.result({"callId": "s2", "status": "error", "error": "Only the next planned activity can start."})
        self.assertEqual(self.replies[-1].response, {"status": "rejected", "error": "Only the next planned activity can start."})

    async def test_completion_report_is_relayed_once_for_the_mounted_item(self):
        await self.start("s1", "item-1")
        await self.mount("s1", "item-1", "frame")
        complete = {"callId": "s1", "instanceId": "frame", "itemId": "item-1", "nextItemId": "item-2",
                    "outcome": {"disposition": "completed", "allCorrect": False, "score": 83, "junk": "x"}}
        self.assertFalse(await self.bridge.item_complete({**complete, "instanceId": "other"}))
        self.assertFalse(await self.bridge.item_complete({**complete, "itemId": "item-2"}))
        self.assertFalse(await self.bridge.item_complete({**complete, "nextItemId": "item-7"}))
        self.assertTrue(await self.bridge.item_complete(complete))
        self.assertFalse(await self.bridge.item_complete(complete))
        receipt = self.replies[-1]
        self.assertEqual((receipt.name, receipt.response["status"], receipt.scheduling.value), ("start_plan_item", "item_complete", "WHEN_IDLE"))
        self.assertEqual((receipt.response["nextItemId"], receipt.response["nextTitle"]), ("item-2", "Number line hops"))
        self.assertEqual(receipt.response["outcome"], {"disposition": "completed", "allCorrect": False, "score": 83})
        self.assertIn("start_plan_item with itemId item-2", receipt.response["guidance"])
        await self.start("s2", "item-2")
        self.assertTrue(await self.mount("s2", "item-2", "line"))
        self.assertEqual(self.replies[-2].response["status"], "replaced")
        self.assertTrue(await self.bridge.item_complete({"callId": "s2", "instanceId": "line", "itemId": "item-2", "nextItemId": ""}))
        self.assertIn("planned lesson is finished", self.replies[-1].response["guidance"])

    async def test_number_line_advance_receipts_keep_their_spoken_scheduling(self):
        await self.start("s1", "item-2")
        await self.mount("s1", "item-2", "line")
        for index, status in ((0, "advanced"), (1, "complete")):
            await self.bridge.call(SimpleNamespace(id=f"adv{index}", name="advance_activity", args={"instanceId": "line", "challengeIndex": index}))
            self.assertTrue(await self.bridge.command_result({"callId": f"adv{index}", "instanceId": "line", "status": status, "state": {}}))
            self.assertEqual((self.replies[-1].response["status"], self.replies[-1].scheduling.value), (status, "WHEN_IDLE"))
