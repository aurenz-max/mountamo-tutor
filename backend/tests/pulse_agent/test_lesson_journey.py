"""Meaningful integration gates: block aggregation, attribution, production fan-out/parity."""
import json
import logging
from pathlib import Path
import unittest

from .lesson_journey import group_submissions, replay_run

SNAPSHOT = Path(__file__).resolve().parents[3] / 'my-tutoring-app/qa/lesson-bench/journeys/curriculum-k.json'


class JourneyBridgeTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        logging.getLogger('app.services.competency').setLevel(logging.ERROR)
        self.snapshot = json.loads(SNAPSHOT.read_text(encoding='utf-8'))
        self.subskill, self.loc = next((sid, loc) for sid, loc in self.snapshot['curriculum']['subskill_index'].items()
                                      if loc['subskill_description'].startswith('Letter-Sound Group 1:'))

    def event(self, number=0):
        return {'instanceId': 'block', 'itemId': f'item-{number}', 'componentId': 'di-letter-sounds',
                'skillId': self.loc['skill_id'], 'subskillId': self.subskill, 'evalMode': 'letter_sound',
                'firstCorrect': True, 'finalCorrect': True, 'independent': False, 'accessible': True,
                'responseRoute': 'echo'}

    def test_blocks_are_not_inflated_into_multiple_lifecycle_submissions(self):
        submissions, skipped = group_submissions([self.event(i) for i in range(5)], self.snapshot['curriculum']['subskill_index'])
        self.assertEqual(len(submissions), 1)
        self.assertEqual(submissions[0]['parts'], 5)
        self.assertEqual(submissions[0]['independentParts'], 0)
        self.assertFalse(skipped)

    def test_unknown_lineage_and_inaccessible_interactions_are_never_submitted(self):
        unknown = self.event(); unknown['skillId'] = 'wrong-parent'
        absent = self.event(1); absent['accessible'] = False
        submissions, skipped = group_submissions([unknown, absent], self.snapshot['curriculum']['subskill_index'])
        self.assertFalse(submissions)
        self.assertEqual(len(skipped), 2)

    async def test_real_fanout_profile_selector_and_replay_parity_are_exercised(self):
        run = {'profile': 'echo-only', 'seed': 42, 'lessons': [{'lessonId': 'one', 'packageId': 'test-package',
               'decision': 'INSUFFICIENT_EVIDENCE', 'attempts': [self.event(i) for i in range(4)]}]}
        result = await replay_run(run, self.snapshot)
        self.assertEqual(result['submissions'], 1)
        self.assertTrue(result['rollupParity']['match'])
        self.assertEqual(result['rollupParity']['attempts_replayed'], 1)
        lesson = result['timeline'][0]
        self.assertEqual(lesson['supportedSuccess'], ['block'])
        self.assertEqual(lesson['profile']['totals']['total_attempts'], 1)
        self.assertTrue(lesson['lifecycles'])
        self.assertIsInstance(lesson['nextTargets'], dict)


if __name__ == '__main__':
    unittest.main()
