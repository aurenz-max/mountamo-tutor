import asyncio
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock
from app.services.live_runtime_tools import LiveRuntimeTools, CombinedLiveTools, parse_runtime_spec, runtime_tool, RUNTIME_INSTRUCTION


def packet(revision=1):
    return {"sessionEpoch": "test", "revision": revision, "visibleRevision": revision, "instanceId": "mounted",
            "task": {"itemId": "one"}, "choices": [{"actionId": f"test/{revision}/0", "action": {"type": "point", "targetId": "start"}}]}


class RuntimeToolsTest(IsolatedAsyncioTestCase):
    async def test_ticket_carries_original_scope_and_cannot_retarget_after_state_changes(self):
        call = SimpleNamespace(id='ticket', name='perform_runtime_action', args={'actionId': 'test/1/0'})
        await self.bridge.call(call)
        command = self.events[-1]['command']
        self.assertEqual((command['sessionEpoch'], command['instanceId'], command['itemId'], command['expectedRevision']), ('test', 'mounted', 'one', 1))
        await self.bridge.reset()
        newer = packet(2); newer['task']['itemId'] = 'two'
        self.bridge.update(newer)
        await self.bridge.call(SimpleNamespace(id='old-ticket', name='perform_runtime_action', args={'actionId': 'test/1/0'}))
        self.assertEqual(self.replies[-1].response['status'], 'stale')
        self.assertEqual(len([event for event in self.events if event['type'] == 'runtime_command']), 1)

    async def test_empty_host_can_connect_then_publish_its_real_mount(self):
        empty = {"sessionEpoch": "test", "revision": 0, "instanceId": None, "task": None, "status": "empty", "choices": []}
        spec = parse_runtime_spec({"sessionEpoch": "test", "initialState": empty}, activity_enabled=True)
        bridge = LiveRuntimeTools(AsyncMock(), AsyncMock(), spec)
        await bridge.call(self.call())
        self.assertEqual(bridge.reply.call_args.args[0].response['status'], 'stale')
        self.assertTrue(bridge.update(packet()))
        await bridge.call(self.call('mounted'))
        self.assertEqual(bridge.emit.call_args.args[0]['type'], 'runtime_command')
        await bridge.reset()

    async def test_combined_surface_routes_each_call_and_cancels_both(self):
        activity, runtime = AsyncMock(), AsyncMock()
        combined = CombinedLiveTools(activity, runtime)
        runtime_call = self.call(); activity_call = SimpleNamespace(name='request_activity')
        await combined.call(runtime_call); await combined.call(activity_call)
        runtime.call.assert_awaited_once_with(runtime_call)
        activity.call.assert_awaited_once_with(activity_call)
        await combined.cancelled_by_model(['cancel']); await combined.reset()
        for bridge in (activity, runtime):
            bridge.cancelled_by_model.assert_awaited_once_with(['cancel'])
            bridge.reset.assert_awaited_once()

    async def test_runtime_prompt_preserves_the_scripted_judge(self):
        self.assertIn('judge owns answers and progression', RUNTIME_INSTRUCTION)
        self.assertNotIn('press Check answer', RUNTIME_INSTRUCTION)

    async def test_retired_fixture_connection_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'require an activity sandbox'):
            parse_runtime_spec({"sessionEpoch": "test", "initialState": packet()}, activity_enabled=False)

    async def test_retired_full_scope_command_and_malformed_args_are_rejected(self):
        legacy = {"sessionEpoch": "test", "instanceId": "mounted", "itemId": "one",
                  "expectedRevision": 1, "actionId": "test/1/0"}
        for index, args in enumerate([legacy, {}, None, [], 'test/1/0', {'actionId': 1}]):
            await self.bridge.call(SimpleNamespace(id=f'invalid-{index}', name='perform_runtime_action', args=args))
            self.assertEqual(self.replies[-1].response['status'], 'invalid')
        self.assertFalse(self.events)

    async def asyncSetUp(self):
        self.events, self.replies = [], []
        async def emit(event): self.events.append(event)
        async def reply(response): self.replies.append(response)
        self.bridge = LiveRuntimeTools(emit, reply, {"sessionEpoch": "test", "initialState": packet()}, timeout=.02)

    async def asyncTearDown(self):
        await self.bridge.reset()

    def call(self, id="c", **args):
        return SimpleNamespace(id=id, name="perform_runtime_action", args={
            "actionId": "test/1/0", **args})

    async def test_dispatches_exact_host_action_waits_for_visible(self):
        await self.bridge.call(self.call())
        command = self.events[-1]["command"]
        self.assertEqual(command["action"], {"type": "point", "targetId": "start"})
        self.assertEqual(command["expectedRevision"], 1)
        self.assertFalse(self.replies)
        self.assertFalse(await self.bridge.result({"commandId": "other", "status": "visible", "state": packet(2)}))
        self.assertFalse(await self.bridge.result({"commandId": "c", "status": "visible", "state": packet(1)}))
        self.assertTrue(await self.bridge.result({"commandId": "c", "status": "visible", "state": packet(2)}))
        self.assertEqual(self.replies[-1].response["status"], "visible")
        self.assertEqual(self.replies[-1].scheduling.value, "WHEN_IDLE")

    async def test_stale_and_unadvertised_actions_never_emit(self):
        await self.bridge.call(self.call(actionId="test/0/0"))
        self.assertEqual(self.replies[-1].response["status"], "stale")
        await self.bridge.call(self.call("d", actionId="invented"))
        self.assertEqual(self.replies[-1].response["status"], "stale")
        self.assertFalse(self.events)

    async def test_only_successful_runner_handoff_silences_tool_response(self):
        state = packet(); state['choices'][0]['responseSpeech'] = 'runner'
        self.bridge.update(state)
        await self.bridge.call(self.call())
        await self.bridge.result({'commandId': 'c', 'status': 'visible', 'state': packet(2)})
        self.assertEqual(self.replies[-1].scheduling.value, 'SILENT')
        state = packet(2); state['choices'][0]['responseSpeech'] = 'runner'
        self.bridge.update(state)
        await self.bridge.call(self.call('failed', actionId='test/2/0'))
        await self.bridge.result({'commandId': 'failed', 'status': 'failed', 'state': packet(2)})
        self.assertEqual(self.replies[-1].scheduling.value, 'WHEN_IDLE')

    async def test_duplicate_concurrent_timeout_and_late_receipt(self):
        await self.bridge.call(self.call())
        await self.bridge.call(self.call())
        self.assertEqual(len(self.events), 1)
        await self.bridge.call(self.call("d"))
        self.assertEqual(self.replies[-1].response["status"], "blocked")
        await asyncio.sleep(.04)
        self.assertEqual(self.events[-1]["type"], "runtime_cancelled")
        self.assertEqual(self.replies[-1].response["status"], "timeout")
        self.assertFalse(await self.bridge.result({"commandId": "c", "status": "visible", "state": packet(2)}))

    async def test_model_cancel_and_reset(self):
        await self.bridge.call(self.call())
        await self.bridge.cancelled_by_model(["c"])
        self.assertIsNone(self.bridge.pending)
        self.assertFalse(self.replies)
        await self.bridge.call(self.call("next"))
        await self.bridge.reset()
        self.assertIsNone(self.bridge.pending)

    async def test_packets_cannot_rewind_epoch_or_revision_and_visible_requires_paint(self):
        self.assertTrue(self.bridge.update(packet(2)))
        self.assertFalse(self.bridge.update(packet(1)))
        bad = packet(3); bad["sessionEpoch"] = "old"
        self.assertFalse(self.bridge.update(bad))
        await self.bridge.call(self.call(actionId="test/2/0"))
        bad = packet(3); bad["visibleRevision"] = None
        self.assertFalse(await self.bridge.result({"commandId": "c", "status": "visible", "state": bad}))

    async def test_config_and_nonblocking_declaration(self):
        self.assertEqual(runtime_tool().function_declarations[0].behavior.value, "NON_BLOCKING")
        schema = runtime_tool().function_declarations[0].parameters
        self.assertEqual(set(schema.properties), {'actionId'})
        self.assertEqual(schema.required, ['actionId'])
        spec = {"sessionEpoch": "test", "initialState": packet()}
        self.assertEqual(parse_runtime_spec(spec, activity_enabled=True), spec)
        for bad in [None, {}, {**spec, "extra": True}, {**spec, "sessionEpoch": "old"}]:
            with self.assertRaises(ValueError): parse_runtime_spec(bad, activity_enabled=True)

    async def test_later_student_state_supersedes_an_older_visible_receipt(self):
        await self.bridge.call(self.call())
        self.bridge.update(packet(3))
        self.assertTrue(await self.bridge.result({"commandId": "c", "status": "visible", "state": packet(2)}))
        self.assertEqual(self.replies[-1].response["status"], "superseded")
        self.assertEqual(self.replies[-1].response["liveRuntime"]["revision"], 3)
