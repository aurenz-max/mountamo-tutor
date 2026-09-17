from copy import deepcopy
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase, TestCase
from unittest.mock import AsyncMock
from app.services.live_activity_tools import parse_activity_spec, activity_tool, activity_instruction, LiveActivityTools
from activity_test_spec import activity, spec


class CapabilityContractTest(TestCase):
    def test_rejects_legacy_config_conflicting_ownership_and_tool_collisions(self):
        values = [{'enabledPrimitives': ['ten-frame']}, {}, {'activities': [], 'visuals': []}]
        duplicate = spec(); duplicate['activities'].append(duplicate['activities'][0]); values.append(duplicate)
        conflict = spec(runner=True); conflict['activities'][1]['canAdvance'] = True; values.append(conflict)
        collision = spec(visuals=True); collision['visuals'][0]['name'] = 'perform_runtime_action'; values.append(collision)
        bad_schema = spec(visuals=True); bad_schema['visuals'][0]['parameters'] = {'type': 'UNSUPPORTED'}; values.append(bad_schema)
        for value in values:
            with self.subTest(value=value), self.assertRaises(ValueError): parse_activity_spec(value)

    def test_generic_session_prompt_contains_host_guidance_without_backend_tag_tables(self):
        value = {'activities': [activity('new-family', 'di-runner', ['explore'])], 'visuals': []}
        value['activities'][0]['guidance'] = 'Follow the host-provided exploration cue.'
        parsed = parse_activity_spec(value)
        self.assertEqual(parsed, value)
        text = activity_instruction(parsed)
        self.assertIn('host-provided exploration cue', text)
        for obsolete in ['[TF_', 'number-line', 'ten-frame', 'show_counters', 'show_fraction']:
            self.assertNotIn(obsolete, text)
        declarations = activity_tool(parsed).function_declarations
        self.assertEqual([d.name for d in declarations], ['request_activity'])
        self.assertEqual(declarations[0].parameters.properties['primitiveId'].enum, ['new-family'])
        self.assertEqual(declarations[0].parameters.properties['mode'].enum, ['explore'])

    def test_plan_validates_modes_against_the_same_host_offers(self):
        value = spec()
        value['plan'] = {'topic': 'Prepared work', 'items': [{'itemId': 'item-1', 'primitiveId': 'number-line',
            'title': 'Task', 'evalMode': 'jump', 'objective': 'Practice'}]}
        self.assertEqual(parse_activity_spec(value)['plan'], value['plan'])
        wrong = deepcopy(value); wrong['plan']['items'][0]['evalMode'] = 'invented'
        with self.assertRaises(ValueError): parse_activity_spec(wrong)


class GenericOwnerTest(IsolatedAsyncioTestCase):
    async def test_unknown_runner_family_gets_silent_mount_and_ready_without_python_registration(self):
        value = parse_activity_spec({'activities': [activity('new-family', 'di-runner', ['explore'])], 'visuals': []})
        emit, reply = AsyncMock(), AsyncMock()
        bridge = LiveActivityTools(emit, reply, value)
        try:
            await bridge.call(SimpleNamespace(id='open', name='request_activity', args={
                'primitiveId': 'new-family', 'mode': 'explore', 'topic': 'Shapes', 'intent': 'Explore shapes'}))
            self.assertEqual(reply.call_args.args[0].scheduling.value, 'SILENT')
            await bridge.result({'callId': 'open', 'status': 'mounted', 'instanceId': 'fresh', 'data': {}})
            self.assertEqual(reply.call_args.args[0].scheduling.value, 'SILENT')
            self.assertEqual(emit.call_args.args[0], {'type': 'activity_ready', 'callId': 'open', 'instanceId': 'fresh', 'primitiveId': 'new-family'})
            await bridge.call(SimpleNamespace(id='advance', name='advance_activity', args={'instanceId': 'fresh', 'challengeIndex': 0}))
            self.assertEqual(reply.call_args.args[0].response['status'], 'rejected')
        finally:
            await bridge.reset()
