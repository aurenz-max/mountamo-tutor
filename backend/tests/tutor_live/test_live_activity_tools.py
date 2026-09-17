import asyncio
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from app.services.live_activity_tools import LiveActivityTools, activity_tool
from activity_test_spec import activity, spec


class ActivityToolsTest(IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.events, self.replies = [], []
        async def emit(v): self.events.append(v)
        async def reply(v): self.replies.append(v)
        self.bridge = LiveActivityTools(emit, reply, spec(), timeout=0.03)

    async def asyncTearDown(self):
        await self.bridge.reset()

    def call(self, id="a", **args):
        return SimpleNamespace(id=id, name="request_activity", args={
            "primitiveId": "number-line", "topic": "Subtract within 10",
            "intent": "Practice moving left", "mode": "jump", **args})

    async def test_waits_for_mount_then_streams_state_silently(self):
        await self.bridge.call(self.call())
        self.assertEqual(self.events[0]["type"], "activity_request")
        self.assertEqual(len(self.replies), 1)
        self.assertEqual(self.replies[0].response["status"], "preparing")
        self.assertFalse(self.replies[0].response["visible"])
        self.assertTrue(self.replies[0].will_continue)
        self.assertEqual(self.replies[0].scheduling.value, "WHEN_IDLE")
        self.assertNotIn("data", self.replies[0].response)
        await self.bridge.result({"callId": "wrong", "status": "mounted", "data": {}, "instanceId": "x"})
        self.assertEqual(len(self.replies), 1)
        await self.bridge.result({"callId": "a", "status": "mounted", "data": {"range": [0, 10]}, "instanceId": "x"})
        self.assertEqual(self.replies[-1].response["status"], "mounted")
        self.assertTrue(self.replies[-1].will_continue)
        self.assertEqual(self.replies[-1].scheduling.value, "WHEN_IDLE")
        await self.bridge.state("x", {"placedPoints": [3]})
        self.assertEqual(self.replies[-1].scheduling.value, "SILENT")
        self.assertEqual(self.replies[-1].response["state"], {"placedPoints": [3]})

    async def test_superseded_and_duplicate_requests_cannot_mount(self):
        await self.bridge.call(self.call())
        await self.bridge.call(self.call())
        self.assertEqual(len(self.events), 1)
        await self.bridge.call(self.call("b"))
        self.assertEqual(self.replies[-2].response["status"], "cancelled")
        self.assertFalse(await self.bridge.result({"callId": "a", "status": "mounted", "data": {}, "instanceId": "stale"}))
        self.assertEqual(self.bridge.pending, "b")

    async def test_timeout_and_model_cancellation_reject_late_results(self):
        await self.bridge.call(self.call())
        await asyncio.sleep(0.05)
        self.assertIsNone(self.bridge.pending)
        self.assertIn("timed out", self.events[-1]["reason"])
        await self.bridge.call(self.call("b"))
        await self.bridge.cancelled_by_model(["b"])
        self.assertFalse(await self.bridge.result({"callId": "b", "status": "mounted", "data": {}, "instanceId": "late"}))

    async def test_error_is_returned_and_new_mount_closes_previous_stream(self):
        await self.bridge.call(self.call())
        await self.bridge.result({"callId": "a", "status": "error", "error": "generation failed"})
        self.assertEqual(self.replies[-1].response["status"], "error")
        await self.bridge.call(self.call("b"))
        await self.bridge.result({"callId": "b", "status": "mounted", "data": {}, "instanceId": "b1"})
        await self.bridge.call(self.call("c"))
        await self.bridge.result({"callId": "c", "status": "mounted", "data": {}, "instanceId": "c1"})
        self.assertEqual(self.replies[-2].response["status"], "replaced")
        before = len(self.replies)
        await self.bridge.state("b1", {})
        self.assertEqual(len(self.replies), before)

    async def test_allowlist_and_nonblocking_contract(self):
        self.assertEqual(activity_tool(spec()).function_declarations[0].behavior.value, "NON_BLOCKING")
        await self.bridge.call(self.call(primitiveId="arbitrary-react"))
        self.assertFalse(self.events)
        self.assertEqual(self.replies[-1].response["status"], "error")

    async def test_reset_discards_pending_and_stream(self):
        await self.bridge.call(self.call())
        await self.bridge.reset()
        self.assertIsNone(self.bridge.pending)
        self.assertFalse(await self.bridge.result({"callId": "a", "status": "mounted", "data": {}, "instanceId": "late"}))

    async def test_advance_waits_for_matching_screen_receipt_and_rejects_stale_instance(self):
        await self.bridge.call(self.call())
        await self.bridge.result({"callId": "a", "status": "mounted", "data": {}, "instanceId": "screen"})
        advance = SimpleNamespace(id="next", name="advance_activity", args={"instanceId": "screen", "challengeIndex": 0})
        before = len(self.replies)
        await self.bridge.call(advance)
        self.assertEqual(self.events[-1]["type"], "activity_command")
        self.assertEqual(len(self.replies), before)
        await self.bridge.call(advance)  # duplicate cannot dispatch twice
        self.assertEqual(len([e for e in self.events if e["type"] == "activity_command"]), 1)
        self.assertFalse(await self.bridge.command_result({"callId": "next", "instanceId": "old", "status": "advanced", "state": {}}))
        self.assertTrue(await self.bridge.command_result({"callId": "next", "instanceId": "screen", "status": "advanced", "state": {"currentChallengeIndex": 1}}))
        self.assertEqual(self.replies[-1].name, "advance_activity")
        self.assertEqual(self.replies[-1].response["state"]["currentChallengeIndex"], 1)
        await self.bridge.call(SimpleNamespace(id="bad", name="advance_activity", args={"instanceId": "old", "challengeIndex": 1}))
        self.assertEqual(self.replies[-1].response["status"], "rejected")

    async def test_advance_cancel_and_reset_drop_late_receipts(self):
        self.bridge.active = ("generation", "screen")
        self.bridge.active_type = "number-line"
        await self.bridge.call(SimpleNamespace(id="next", name="advance_activity", args={"instanceId": "screen", "challengeIndex": 0}))
        await self.bridge.cancelled_by_model(["next"])
        self.assertIsNone(self.bridge.command)
        self.assertFalse(await self.bridge.command_result({"callId": "next", "instanceId": "screen", "status": "advanced", "state": {}}))
        await self.bridge.call(SimpleNamespace(id="next2", name="advance_activity", args={"instanceId": "screen", "challengeIndex": 0}))
        await self.bridge.reset()
        self.assertIsNone(self.bridge.command)
        self.assertIsNone(self.bridge.command_timer)

    async def test_ten_frame_hands_off_silently_to_its_di_runner(self):
        self.bridge.activities['ten-frame'] = activity('ten-frame', 'di-runner', ['make_ten'])
        await self.bridge.call(self.call(primitiveId="ten-frame", mode="make_ten"))
        self.assertEqual(self.replies[-1].scheduling.value, "SILENT")
        self.assertFalse(await self.bridge.result({"callId": "stale", "status": "mounted", "instanceId": "frame", "data": {}}))
        self.assertTrue(await self.bridge.result({"callId": "a", "status": "mounted", "instanceId": "frame", "data": {"challengeType": "make_ten"}}))
        self.assertEqual(self.replies[-1].scheduling.value, "SILENT")
        self.assertEqual(self.events[-1], {"type": "activity_ready", "callId": "a", "instanceId": "frame", "primitiveId": "ten-frame"})
        await self.bridge.call(SimpleNamespace(id="next", name="advance_activity", args={"instanceId": "frame", "challengeIndex": 0}))
        self.assertEqual(self.replies[-1].response["status"], "rejected")
