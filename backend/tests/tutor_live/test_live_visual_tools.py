from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase, TestCase
from app.services.live_activity_tools import LiveActivityTools, activity_tool, parse_activity_spec
from activity_test_spec import spec


class VisualContractTest(TestCase):
    def test_only_host_advertised_tools_are_declared(self):
        self.assertEqual(len(activity_tool(spec()).function_declarations), 2)
        offer = spec(visuals=True); offer['activities'] = []
        declarations = activity_tool(parse_activity_spec(offer)).function_declarations
        self.assertEqual({d.name for d in declarations}, {'show_shapes', 'highlight_visual'})
        self.assertTrue(all(d.behavior.value == 'NON_BLOCKING' for d in declarations))
        self.assertEqual(declarations[0].parameters.required, ['count'])


class VisualBridgeTest(IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.events, self.replies = [], []
        async def emit(event): self.events.append(event)
        async def reply(response): self.replies.append(response)
        self.bridge = LiveActivityTools(emit, reply, spec(visuals=True))

    async def asyncTearDown(self):
        await self.bridge.reset()

    async def show(self):
        await self.bridge.call(SimpleNamespace(id='show', name='show_shapes', args={'count': 6}))
        self.assertEqual(self.events[-1]['type'], 'activity_visual')
        self.assertEqual(self.events[-1]['toolName'], 'show_shapes')
        self.assertEqual(self.events[-1]['args'], {'count': 6})
        self.assertNotIn('data', self.events[-1])  # Python does not construct renderer state.
        self.assertFalse(self.replies)
        await self.bridge.result({'callId': 'show', 'status': 'mounted', 'instanceId': 'visual',
                                  'data': {'shapes': 6}, 'highlightCount': 6})

    async def test_mount_and_silent_state_use_original_tool_name(self):
        await self.show()
        self.assertEqual(self.replies[-1].name, 'show_shapes')
        self.assertEqual(self.replies[-1].response['primitiveId'], 'test-shapes')
        self.assertEqual(self.replies[-1].response['highlightCount'], 6)
        await self.bridge.state('visual', {'selected': [1]})
        self.assertEqual(self.replies[-1].name, 'show_shapes')
        self.assertEqual(self.replies[-1].scheduling.value, 'SILENT')

    async def test_pointing_is_correlated_and_cannot_advance_a_visual(self):
        await self.show()
        await self.bridge.call(SimpleNamespace(id='point', name='highlight_visual', args={'instanceId': 'visual', 'indices': [2]}))
        self.assertEqual(self.events[-1]['type'], 'activity_highlight')
        await self.bridge.command_result({'callId': 'point', 'instanceId': 'visual', 'status': 'updated', 'state': {'highlightedIndices': [2]}})
        self.assertEqual(self.replies[-1].name, 'highlight_visual')
        await self.bridge.call(SimpleNamespace(id='bad', name='highlight_visual', args={'instanceId': 'visual', 'indices': [6]}))
        self.assertEqual(self.replies[-1].response['status'], 'rejected')
        await self.bridge.call(SimpleNamespace(id='next', name='advance_activity', args={'instanceId': 'visual', 'challengeIndex': 0}))
        self.assertEqual(self.replies[-1].response['status'], 'rejected')

    async def test_disabled_visual_tool_cannot_dispatch(self):
        self.bridge.visuals = {}
        await self.bridge.call(SimpleNamespace(id='disabled', name='show_shapes', args={'count': 6}))
        self.assertFalse(self.events)
        self.assertEqual(self.replies[-1].response['status'], 'error')

    async def test_direct_visual_supersedes_generation_and_rejects_its_late_mount(self):
        await self.bridge.call(SimpleNamespace(id='generate', name='request_activity', args={
            'primitiveId': 'number-line', 'topic': 'subtract', 'intent': 'practice', 'mode': 'jump'}))
        await self.bridge.call(SimpleNamespace(id='direct', name='show_shapes', args={'count': 4}))
        self.assertEqual(self.replies[-1].name, 'request_activity')
        self.assertEqual(self.replies[-1].response['status'], 'cancelled')
        self.assertFalse(await self.bridge.result({'callId': 'generate', 'status': 'mounted', 'instanceId': 'old', 'data': {}}))
        self.assertTrue(await self.bridge.result({'callId': 'direct', 'status': 'mounted', 'instanceId': 'shapes', 'data': {'shapes': 4}, 'highlightCount': 4}))
        self.assertEqual(self.replies[-1].name, 'show_shapes')

    async def test_host_validation_failure_never_claims_a_visible_visual(self):
        await self.bridge.call(SimpleNamespace(id='bad', name='show_shapes', args={'count': -1}))
        self.assertFalse(await self.bridge.result({'callId': 'bad', 'status': 'error', 'error': 'Invalid count'}))
        self.assertEqual(self.replies[-1].response['status'], 'error')
        self.assertIsNone(self.bridge.active)
        await self.bridge.call(SimpleNamespace(id='missing-bound', name='show_shapes', args={'count': 4}))
        self.assertFalse(await self.bridge.result({'callId': 'missing-bound', 'status': 'mounted', 'instanceId': 'x', 'data': {}}))
