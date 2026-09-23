"""One live-runtime journey for every adopted primitive.

Replaces run_ten_frame_runtime.py / run_number_line_runtime.py /
run_counting_board_runtime.py, which were 61% identical and had already drifted
apart (different stderr tails, a missing ready handshake, a hardcoded grade, one
still calling a per-primitive driver, and an autonomy fix that existed in only one
of the three).

THIS FILE NAMES NO PRIMITIVE.

  - Which actions exist, who teaches, and whether the runner owns progression come
    from the PRODUCTION envelope (`/api/lumina/live-activity/capabilities`) — the
    same bytes the model is given. The harness therefore branches on exactly the
    field the model branches on, which is what "test replicates prod" buys.
  - Everything else that differs per primitive — instance id, defaults, the wording
    of a help request, what a learner action means on this board, whether a drawn
    example taught its claim — is declared in `liveJourneySpec.ts` beside the
    primitive and resolved by the mounted driver.

Python says what should happen next. TypeScript says how to do it and whether it
was right. Adding a primitive is a row in that spec, never an edit here.

Real model, real runner/reducer/runtime/grading. JSDOM paint, voice-turn boundaries
and playback are simulated. No mastery writes.
"""
import os
import argparse
import asyncio
import base64
import json
import re
import subprocess
import time
import uuid
from datetime import date
from pathlib import Path
import websockets
from run_tutor_live import get_id_token, fetch_live_context
from activity_capabilities import fetch_activity_spec, fetch_journey

ROOT = Path(__file__).resolve().parents[3]
REPORTS = ROOT / 'my-tutoring-app/qa/tutor-reports'
# Tags the shared wire owns, on top of whatever the primitive's own script declares.
SHARED_LEAK = r"User['\u2019]s message content|System['\u2019]s response|CURRENT|RUNTIME|\(not set\)|press.{0,20}check answer|wait for (?:the )?(?:student|learner) response|={4,}"


class Session:
    """Driver process + websocket, and the few generic moves both programs use."""

    def __init__(self, args, journey, spec, data, di_items, index):
        self.args, self.journey, self.spec, self.data, self.di_items, self.index = args, journey, spec, data, di_items, index
        self.events, self.state, self.started = [], None, time.monotonic()
        self.process = self.ws = None
        self.waiting_intro = False

    def record(self, kind, **fields):
        self.events.append({'type': kind, 't': round(time.monotonic() - self.started, 2), **fields})

    def exchange(self, message):
        self.process.stdin.write(json.dumps(message) + '\n'); self.process.stdin.flush()
        line = self.process.stdout.readline()
        if not line:
            raise RuntimeError('Mounted driver ended: ' + self.process.stderr.read()[-2000:])
        return json.loads(line)

    async def step(self, message):
        reply = await asyncio.to_thread(self.exchange, message)
        self.state = reply['state']
        self.observing = reply.get('observing', False)
        for output in reply['messages']:
            await self.ws.send(json.dumps(output))
            if output['type'] == 'runtime_result': self.record('runtime_result', result=output)
            elif output['type'] == 'dialogue_observation': self.record('dialogue_observation', result=output)
            elif output['type'] == 'text':
                self.record('runner_cue', text=output['content'])
                if output.get('source') == 'dialogue_progression': self.waiting_intro = True
        return reply

    async def say(self, text):
        # The host writes the start message and both hosts send it silently: the model
        # hears it, the runtime never receives it as learner words or a learner turn.
        if text.startswith('[LESSON_START]'):
            await self.ws.send(json.dumps({'type': 'text', 'content': text, 'interrupt': False}))
            self.record('host', text=text)
            return
        if self.args.audio:
            import azure.cognitiveservices.speech as speech
            from dotenv import dotenv_values
            config = dotenv_values(ROOT / 'my-tutoring-app/.env.local')
            speech_config = speech.SpeechConfig(subscription=config['AZURE_SPEECH_KEY'], region=config['AZURE_SPEECH_REGION'])
            speech_config.speech_synthesis_voice_name = 'en-US-JennyNeural'
            speech_config.set_speech_synthesis_output_format(speech.SpeechSynthesisOutputFormat.Raw16Khz16BitMonoPcm)
            synth = speech.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
            result = await asyncio.to_thread(lambda: synth.speak_text_async(text).get())
            assert result.reason == speech.ResultReason.SynthesizingAudioCompleted, 'Synthetic speech unavailable'
            await self.step({'type': 'learner_start'})
            await self.ws.send(json.dumps({'type': 'activity_start'}))
            for offset in range(0, len(result.audio_data), 3200):
                await self.ws.send(json.dumps({'type': 'audio', 'data': base64.b64encode(result.audio_data[offset:offset+3200]).decode()}))
                await asyncio.sleep(.1)
            await self.ws.send(json.dumps({'type': 'activity_end'}))
            self.record('learner_audio', text=text, bytes=len(result.audio_data))
            return
        workspace = ((self.state or {}).get('task') or {}).get('workspace')
        if workspace is not None and workspace.get('utterance') != text:
            await self.step({'type': 'utterance', 'text': text})
        await self.ws.send(json.dumps({'type': 'text', 'content': text, 'interrupt': False}))
        self.record('learner', text=text)

    async def learner(self, intent):
        """One intent; the spec turns it into this primitive's real DOM actions.

        An `answer` action is the child SPEAKING, so it has two destinations: the
        driver reduces it through the real frontend speech path, and the model has
        to actually hear it. A gesture has only the first — the model learns about
        it from the runtime state, which is the whole point of the receipt channel.
        """
        reply = await self.step({'type': 'learner', 'intent': intent, 'deferAnswers': self.args.audio})
        performed = reply.get('performed') or []
        self.record('learner_input', intent=intent, performed=performed,
                    demand=(self.state.get('task') or {}).get('demand'))
        for action in performed:
            if action['type'] == 'answer': await self.say(self.args.answer_prefix + action['text'])
        return reply

    def prompt(self, key, fallback=None):
        text = self.journey['prompts'].get(key, fallback)
        if not text: raise AssertionError(f'No "{key}" prompt declared for this primitive')
        return text

    def offers(self, action_type):
        """Is this action in the choices the MODEL was actually given this turn?"""
        return any(c['action']['type'] == action_type for c in (self.state or {}).get('choices', []))

    async def assert_example(self, spoken, artifact=None):
        """Judge the artifact that was ON SCREEN when the detour opened, not whatever
        the runtime holds now — by the time the describing turn can be judged, the
        model may already have closed its own example."""
        reply = await self.step({'type': 'assert', 'check': 'exampleTaught',
                                 'spoken': spoken, 'artifact': artifact})
        verdict = reply.get('verdict') or {}
        self.record('example_verdict', **verdict)
        assert verdict.get('skipped') or verdict.get('ok'), verdict.get('reason') or 'Example check failed'


# ── The two phase programs. One per execution family, selected by the envelope. ──

async def tutor_led(s):
    """The tutor asks; the component grades a gesture plus Check. Linear script."""
    async def turn(label, prompt=None, until=lambda st: True):
        if prompt:
            await s.say(prompt); s.record('phase', phase=label)
        transcript = ''
        async with asyncio.timeout(55):
            while True:
                try: event = json.loads(await asyncio.wait_for(s.ws.recv(), .15))
                except asyncio.TimeoutError:
                    await s.step({'type': 'poll'}); continue
                kind = event.get('type')
                if kind == 'runtime_command':
                    s.record('runtime_command', phase=label, command=event['command'])
                    await s.step({'type': 'command', 'command': event['command']})
                elif kind == 'ai_transcription':
                    transcript += event.get('content', '')
                    await s.step({'type': 'output', 'text': event.get('content', '')})
                elif kind == 'ai_turn_end':
                    await s.step({'type': 'end'})
                    if transcript.strip():
                        s.record('tutor', phase=label, text=transcript, state=s.state)
                        print(f'Run {s.index} {label}: {transcript[:170]}', flush=True)
                        if until(s.state): return transcript
                        transcript = ''
                elif kind in ('error', 'session_ended', 'session_resuming'):
                    raise RuntimeError(event.get('message', kind))
                elif kind in ('activity_command', 'activity_request'):
                    raise AssertionError('Model bypassed the mounted runtime: ' + kind)

    # THE RUNTIME'S OWN ITEM ID IS THE AUTHORITY, never the payload's challenge list.
    # A judged item is not a challenge: number-sequencer, number-bond, ordinal-line,
    # compare-objects, place-value and shape-sorter all expand ONE generated challenge
    # into several judged asks with derived ids (`seq1` -> `seq1:1-answer`), so
    # `challenges[0]['id']` is not what `task.itemId` reports and "did it advance?"
    # became "is this a different string?". Ten-frame and counting-board happened to
    # keep the challenge id, which is why this held for three primitives and no more.
    async with asyncio.timeout(30):
        while json.loads(await s.ws.recv()).get('type') != 'session_ready': pass
    await s.step({'type': 'poll'})
    first_id = s.state['task']['itemId']
    await turn('opening', s.prompt('opening'))
    await s.learner('wrong')
    assert s.state['task']['evidence']['correctness'] == 'incorrect', 'Actual component did not reject the wrong response'
    s.record('checked_wrong', state=s.state)
    await turn('wrong')
    assert s.state['task']['itemId'] == first_id, 'Wrong answer advanced the task'
    blank = lambda st: st['task']['evidence']['correctness'] == 'unknown'
    if blank(s.state):
        assert any(e['type'] == 'runtime_command' and e['command']['action']['type'] == 'retry' for e in s.events), \
            'Response vanished without a retry command'
        s.record('autonomous_action', action='retry',
                 note='Allowed action executed before it was requested; intervention policy reviewed separately')
    else:
        await turn('retry', s.prompt('retry'), blank)
    await turn('replay', s.prompt('replay'))
    reply = await s.step({'type': 'poll'})
    if 'promptFocused' in reply['dom']:
        assert reply['dom']['promptFocused'], 'Replay did not focus the mounted instruction'
    await turn('hint', s.prompt('hint'), lambda st: st['task']['support']['level'] == 1)
    assert (await s.step({'type': 'poll'}))['dom']['reminder'], 'Reminder was reported without a painted line'
    await turn('fade', s.prompt('fade'), lambda st: st['task']['support']['level'] == 0)
    await s.learner('wrong')
    saved = s.state['task']['demand']
    # A family that truthfully advertises no worked example declares that by omitting
    # the `example` prompt. Check the absence rather than crash on it.
    if not s.journey['prompts'].get('example'):
        assert not s.offers('request_support'),             'Journey declares no example, but the adapter advertised a detour'
        s.record('no_detour_by_design', choices=[c['action']['type'] for c in s.state['choices']])
    else:
        spoken = await turn('example', s.prompt('example'), lambda st: st['status'] == 'support')
        s.record('saved', state=s.state)
        await s.assert_example(spoken, s.state['supportArtifact'])
        await turn('return', s.prompt('return'), lambda st: st['status'] == 'active')
        assert s.state['task']['itemId'] == first_id and s.state['task']['demand'] == saved, 'Return changed the saved work'
    await s.learner('correct')
    await turn('advance', until=lambda st: st['task']['itemId'] != first_id)
    assert s.state['task']['demand'] != saved, 'Transfer item inherited work'
    await s.learner('correct')
    await turn('complete')
    reply = await s.step({'type': 'poll'})
    assert s.state['status'] == 'completed' and reply['submissions'] == 1
    s.record('complete', state=s.state, submissions=reply['submissions'])
    required = {'retry', 'replay', 'scaffold', 'advance'}
    if s.journey['prompts'].get('example'): required |= {'request_support', 'return'}
    called = {e['command']['action']['type'] for e in s.events if e['type'] == 'runtime_command'}
    assert required <= called, 'Missing model actions: ' + str(required - called)


async def judged_runner(s):
    """A judged runner asks, judges and advances. Reactive: the model may act unprompted."""
    # THE RUNTIME'S OWN ITEM ID IS THE AUTHORITY, never the payload's challenge list.
    # A judged item is not a challenge: number-sequencer, number-bond, ordinal-line,
    # compare-objects, place-value and shape-sorter all expand ONE generated challenge
    # into several judged asks with derived ids (`seq1` -> `seq1:1-answer`), so
    # `challenges[0]['id']` is not what `task.itemId` reports and "did it advance?"
    # became "is this a different string?". Ten-frame and counting-board happened to
    # keep the challenge id, which is why this held for three primitives and no more.
    # Captured from the first state the runner reports, for the same reason.
    first_id, answered = None, 0
    phase, transcript, saved, spoken_at_open, artifact =         'starting' if s.args.startup else 'opening', '', None, '', None
    async with asyncio.timeout(300):
        while True:
            try: event = json.loads(await asyncio.wait_for(s.ws.recv(), .15))
            except asyncio.TimeoutError:
                reply = await s.step({'type': 'poll'})
                if reply['submissions']:
                    s.record('complete', state=s.state, submissions=reply['submissions']); break
                continue
            kind = event.get('type')
            # Latch the runner's own first item as soon as it reports one.
            if first_id is None and (s.state or {}).get('task'):
                first_id = s.state['task']['itemId']
            if kind == 'session_ready':
                s.record('ready')
                if s.args.startup:
                    await s.say(f"[LESSON_START] Begin a {s.args.primitive} lesson in {s.args.mode} mode for "
                                f"{s.args.grade}. Call request_activity now; the mounted runner will speak the "
                                "opening. Do not greet first.")
                else: await s.step({'type': 'start'})
            elif kind == 'activity_request' and s.args.startup:
                assert event['args']['primitiveId'] == s.args.primitive and event['args']['mode'] == s.args.mode
                s.record('activity_request', request=event['args'])
                await s.step({'type': 'mount', 'data': s.data, 'evalMode': s.args.mode, 'diItems': s.di_items})
                await asyncio.sleep(.08)
                mounted = await s.step({'type': 'poll'})
                assert s.state['visibleRevision'] == s.state['revision'], 'Mount was not painted'
                await s.ws.send(json.dumps({'type': 'activity_result', 'callId': event['callId'], 'status': 'mounted',
                    'instanceId': s.journey['instanceId'], 'primitiveId': s.args.primitive,
                    'data': mounted['activityState'], 'tutoring': s.args.tutoring}))
                s.record('mounted_generated_payload', state=s.state)
            elif kind == 'activity_ready' and s.args.startup:
                s.record('activity_ready'); phase = 'opening'; await s.step({'type': 'start'})
            elif kind == 'runtime_command':
                s.record('runtime_command', phase=phase, command=event['command'])
                await s.step({'type': 'command', 'command': event['command']})
                action = event['command']['action']['type']
                # The COMMAND owns the phase, not the narration that follows it: the
                # model may open and close the example inside a single turn, and a
                # program that waits for the next tutor turn never sees the saved work.
                if action == 'request_support' and s.state['status'] == 'support':
                    saved = s.state['task']['demand']
                    artifact = s.state['supportArtifact']
                    s.record('saved', state=s.state)
                    if phase == 'example': phase = 'ask-return'
                if action == 'return' and s.state['status'] == 'active':
                    if phase in ('example', 'ask-return'):
                        s.record('autonomous_action', action='return', phase=phase,
                                 note='Tutor closed its own example unprompted; permitted, recorded, not failed')
                    phase = 'reask'
            elif kind == 'ai_transcription':
                transcript += event.get('content', '')
                await s.step({'type': 'output', 'text': event.get('content', '')})
            elif kind == 'ai_turn_end':
                reply = await s.step({'type': 'end'})
                if not transcript.strip(): continue
                s.record('tutor', phase=phase, text=transcript, state=s.state)
                print(f'Run {s.index} {phase}: {transcript[:150]}', flush=True)
                said, transcript = transcript, ''
                # EVERY turn spoken while the example is open, not the last one. A
                # framed example is taught over its steps, and keeping only the final
                # turn scored a tutor that taught all three as if it had said one.
                if s.state['status'] == 'support':
                    spoken_at_open = (spoken_at_open + ' ' + said).strip()
                if reply['submissions']:
                    s.record('complete', state=s.state, submissions=reply['submissions']); break
                if phase == 'opening':
                    await s.learner('warmup')
                    phase = 'wrong'; await s.learner('wrong')
                elif phase == 'wrong':
                    assert said.lower().startswith('my turn'), 'Wrong spoken answer was not corrected'
                    assert s.state['task']['itemId'] == first_id, 'Wrong answer advanced the actual component'
                    # Work AFTER the correction, not before it. A DI correction restores a
                    # clean working surface, so warm-up done before the wrong answer is gone
                    # by the time the detour opens — and comparing an empty board to an empty
                    # board proved nothing about preservation.
                    await s.learner('warmup')
                    phase = 'hint'; await s.say(s.prompt('hint'))
                elif phase == 'hint':
                    if not s.state['task']['support']['level']: continue
                    assert reply['dom']['reminder'], 'Reminder was reported without a painted line'
                    # NOT EVERY FAMILY HAS A WORKED EXAMPLE, and the ones that do not are
                    # the majority. `LiveRuntimeSurface` draws one row of counters and
                    # states HOW MANY; a primitive that teaches sequence, position,
                    # classification, form or handwriting has no honest drawing there and
                    # advertises none. A journey declares that by omitting the `example`
                    # prompt, and the absence is then CHECKED rather than crashed on.
                    if not s.journey['prompts'].get('example'):
                        assert not s.offers('request_support'),                             'Journey declares no example, but the adapter advertised a detour'
                        s.record('no_detour_by_design', choices=[c['action']['type'] for c in s.state['choices']])
                        phase = 'right'; await s.learner('correct')
                    else:
                        phase = 'example'; await s.say(s.prompt('example'))
                elif phase == 'example':
                    continue  # the command handler advances this phase
                elif phase == 'ask-return':
                    phase = 'return'; await s.say(s.prompt('return'))
                elif phase == 'return':
                    if s.state['status'] == 'support': continue
                    phase = 'reask'
                elif phase == 'reask':
                    assert s.state['task']['itemId'] == first_id, 'Return changed the item'
                    assert s.state['task']['demand'] == saved, 'Return changed the saved work'
                    s.record('preserved', demand=saved, vacuous=not any(
                        isinstance(v, int) and v > 0 for v in (saved or {}).values()))
                    phase = 'right'; await s.learner('correct')
                elif phase == 'right':
                    if s.state['task']['itemId'] != first_id: phase = 'next-ask'
                elif phase == 'next-ask':
                    phase = 'finishing'; await s.learner('correct')
                elif phase == 'finishing':
                    # A SESSION IS AS MANY JUDGED ASKS AS THE PAYLOAD PRODUCED, not two.
                    # A count-from challenge expands into one ask per continuation step,
                    # so assuming a second item was the last one left the runner asking a
                    # third while the program waited for a closing that could not come.
                    # The loop's own `submissions` check is the exit; this only bounds it.
                    answered += 1
                    assert answered <= 12, 'Session did not close within its item cap'
                    if s.state['task'] and not s.state['task']['completed']:
                        await s.learner('correct')
            elif kind in ('error', 'session_ended', 'session_resuming'):
                raise RuntimeError(event.get('message', kind))
    if s.journey['prompts'].get('example'):
        assert saved is not None, 'The prepared example never opened'
        await s.assert_example(spoken_at_open, artifact)
    # No tutor progression exists on this family; a request for one would have been refused.
    assert not any(e['command']['action']['type'] in ('advance', 'retry')
                   for e in s.events if e['type'] == 'runtime_command'), \
        'The model was offered progression this runner owns'


def spoken_words(text):
    """A tutor turn holds speech, not only provider markup such as `<no speech>{pause}`, which can
    also arrive cut off (`<no `). The frontend observer skips markup-only turns (DialogueObserver);
    a journey that took one as the tutor's reply answered twice before the tutor spoke."""
    return bool(re.search(r'\w', re.sub(r'<[^>]*(?:>|$)|\{[^}]*(?:\}|$)', '', text)))


async def teaching_workspace(s):
    """Natural learner requests against shared workspace facts, without requested tool names."""
    async def turn(label, prompt=None, until=lambda state: True):
        if prompt:
            await s.say(prompt)
        transcript = ''
        ended = False
        async with asyncio.timeout(55):
            while True:
                try:
                    event = json.loads(await asyncio.wait_for(s.ws.recv(), .15))
                except asyncio.TimeoutError:
                    await s.step({'type': 'poll'})
                    if ended and not s.observing and not s.waiting_intro and until(s.state): return
                    continue
                kind = event.get('type')
                if kind == 'user_transcription':
                    s.record('provider_transcript', text=event.get('content'), finished=event.get('finished'))
                    await s.step({'type': 'audio_fragment', 'text': event.get('content', ''), 'finished': event.get('finished', False)})
                if kind == 'runtime_command':
                    s.record('runtime_command', phase=label, command=event['command'])
                    reply = await s.step({'type': 'command', 'command': event['command']})
                    if reply['dom'].get('demonstration', 0):
                        s.record('visible_demonstration', state=s.state, dom=reply['dom'])
                elif kind == 'ai_transcription':
                    ended = False
                    transcript += event.get('content', '')
                    await s.step({'type': 'output', 'text': event.get('content', '')})
                elif kind == 'ai_turn_end':
                    await s.step({'type': 'end'})
                    ended = ended or spoken_words(transcript)
                    if spoken_words(transcript):
                        s.record('tutor', phase=label, text=transcript, state=s.state)
                        print(f'Run {s.index} {label}: {transcript[:200]}', flush=True)
                        s.waiting_intro = False
                        if not s.observing and until(s.state):
                            return
                        transcript = ''
                elif kind in ('error', 'session_ended', 'session_resuming'):
                    raise RuntimeError(event.get('message', kind))
                elif kind == 'activity_request' and s.args.startup:
                    assert not s.state.get('task'), 'Tutor replaced the unfinished workspace'
                    assert event['args']['primitiveId'] == s.args.primitive and event['args']['mode'] == s.args.mode
                    s.record('activity_request', request=event['args'])
                    await s.step({'type': 'mount', 'data': s.data, 'evalMode': s.args.mode, 'diItems': s.di_items})
                    await asyncio.sleep(.08)
                    mounted = await s.step({'type': 'poll'})
                    assert s.state['visibleRevision'] == s.state['revision']
                    await s.ws.send(json.dumps({'type': 'activity_result', 'callId': event['callId'], 'status': 'mounted',
                        'instanceId': s.journey['instanceId'], 'primitiveId': s.args.primitive,
                        'data': mounted['activityState'], 'tutoring': mounted.get('tutoring', s.args.tutoring)}))
                    s.record('mounted_generated_payload', state=s.state)
                elif kind in ('activity_request', 'activity_command'):
                    raise AssertionError('Tutor replaced the unfinished workspace')

    async with asyncio.timeout(30):
        while json.loads(await s.ws.recv()).get('type') != 'session_ready':
            pass
    await s.step({'type': 'poll'})
    if s.args.startup:
        await turn('startup', f'[LESSON_START] Begin a {s.args.primitive} lesson in {s.args.mode} mode. Call request_activity now. Teach from the mounted workspace.',
                   lambda st: bool(st.get('task')))
    if s.args.lesson_entry:
        await turn('lesson-entry', '[LESSON_START] The current lesson workspace is mounted. Call observe_runtime for its task and ongoing state updates, then teach naturally.')
    first = s.state['task']['itemId']
    if not s.args.progression_only:
        await turn('opening', s.prompt('opening'))
        await turn('help', 'Can you help me?')
        assert s.state['task']['evidence']['attemptNumber'] == 0, 'Help was graded as a learner answer'
        assert s.state['task']['itemId'] == first, 'Help advanced the item'
        # Whether a demonstration EXISTS is read from the production envelope, like
        # every other per-primitive fact here. A mode can legitimately offer none:
        # letter-sound-link's tapped direction draws only the two answer options, so
        # marking either one would answer for the child and the workspace publishes
        # no `demonstrate`. Asserting a visible demonstration there tested the
        # harness's assumption rather than the tutor.
        offers_demonstration = any(c.get('action', {}).get('operation') == 'demonstrate'
                                   for c in s.state.get('choices', []))
        if offers_demonstration:
            if not any(e['type'] == 'visible_demonstration' for e in s.events):
                await turn('show', 'Can you show me what you mean?')
            assert any(e['type'] == 'visible_demonstration' for e in s.events), 'Help never changed the actual board'
            assert s.state['task']['evidence']['attemptNumber'] == 0, 'Demonstration became a learner attempt'
        else:
            s.record('no_demonstration_offered', state=s.state)
    await s.learner('wrong')
    # A tutor may respond with guidance instead of a verdict. Speech is now
    # recorded from that verdict, so an ungraded exchange must remain open for
    # the learner's next answer rather than making this driver wait forever.
    await turn('wrong')
    assert s.state['task']['itemId'] == first
    assert s.state['task']['evidence']['correctness'] != 'correct', 'Incorrect answer received success credit'
    s.record('checked_wrong' if s.state['task']['evidence']['correctness'] == 'incorrect'
             else 'guidance_without_verdict', state=s.state)
    async def press(action, until):
        # A checked item stays closed until feedback reopens it or the learner uses the shell's
        # own Try again / Next challenge button, as a child does on screen. Recorded apart from
        # observer transitions so a report can tell the two apart.
        await s.step({'type': 'learner_progress', 'action': action})
        s.record('learner_pressed', action=action, state=s.state)
        # The press itself reopens or advances the item; a child then just acts. Waiting for the
        # tutor to speak again hangs when it has already re-asked (the retry-path timeout).
        if not until(s.state):
            await turn(action + '-pressed', until=until)
    if s.state['task']['phase'] != 'working':
        await turn('retry', 'Let me try that again.')
        if s.state['task']['phase'] != 'working':
            await press('retry', lambda st: st['task']['phase'] == 'working')
    await s.learner('correct')
    await turn('correct', until=lambda st: st['task']['itemId'] != first or st['task']['evidence']['correctness'] == 'correct')
    if s.state['task']['itemId'] == first:
        await turn('advance', 'I am ready for the next one.')
        if s.state['task']['itemId'] == first:
            await press('advance', lambda st: st['task']['itemId'] != first)
    assert s.state['task']['evidence']['attemptNumber'] == 0, 'Fresh item inherited an attempt'
    second = s.state['task']['itemId']
    await s.learner('correct')
    # A committed success can advance before any packet shows it as `correct`, so the next
    # item appearing is the same outcome; waiting only for `correct` timed out every
    # shape-sorter journey (workspace-doctrine-2026-09-21.md).
    await turn('transfer', until=lambda st: st['status'] in ('closing', 'completed')
               or st['task']['itemId'] != second or st['task']['evidence']['correctness'] == 'correct')
    # Only the last item's outcome completes a workspace lesson; no tutor tool ends it early,
    # so a longer payload is answered through rather than asked to finish.
    for _ in range(12):
        if (s.state['status'] in ('closing', 'completed') or not s.state.get('task')
                or s.state['task']['evidence']['correctness'] == 'correct'):
            break
        current = s.state['task']['itemId']
        await s.learner('correct')
        await turn('remaining', until=lambda st: st['status'] in ('closing', 'completed')
                   or st['task']['itemId'] != current)
    if s.state['status'] != 'completed':
        await turn('finish', 'I am ready to finish.', lambda st: st['status'] == 'completed')
    reply = await s.step({'type': 'poll'})
    assert s.state['status'] == 'completed'
    assert reply['submissions'] == 0, 'The isolated driver must not write student evaluations'
    s.record('complete', state=s.state, submissions=reply['submissions'], persistence='session-only')


PROGRAMS = {'tutor': tutor_led, 'di-runner': judged_runner}


async def drive(args, token, live, index):
    journey, spec = args.journey, args.activity_spec
    activity = next(a for a in spec['activities'] if a['primitiveId'] == args.primitive)
    s = Session(args, journey, spec, {**live['generatedData'],
        'challenges': live['generatedData']['challenges'][:2]},
        [i for i in (live.get('diPlan') or {}).get('items', [])], index)
    assert len(s.data['challenges']) == 2, 'Probe needs two generated challenges'
    s.process = subprocess.Popen(['node', 'scripts/primitive-runtime-driver.mjs', str(uuid.uuid4()), args.primitive],
        cwd=ROOT/'my-tutoring-app', env={**os.environ, 'LIVE_FRONTEND': args.frontend}, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, text=True, encoding='utf-8')
    try:
        ready = json.loads(await asyncio.wait_for(asyncio.to_thread(s.process.stdout.readline), 60))
        assert ready['ready'] and ready['journey']['primitiveId'] == args.primitive
        mounted = await asyncio.to_thread(s.exchange,
            {'type': 'poll' if args.startup else 'mount', 'data': s.data, 'evalMode': args.mode, 'diItems': s.di_items})
        s.state = mounted['state']
        async with websockets.connect(args.backend + '/api/lumina-tutor', max_size=2**24) as ws:
            s.ws = ws
            empty = {'primitive_type': 'live-activity-sandbox', 'instance_id': 'empty-workspace',
                     'primitive_data': {'workspace': 'empty'}, 'owns_opening': True,
                     'audio_input': {'manual_activity': True}}
            mountedctx = {'primitive_type': args.primitive, 'instance_id': journey['instanceId'],
                          'primitive_data': {**(mounted['activityState'] or live.get('primitiveData', {})), 'teachingGuidance': activity['guidance']},
                          'tutoring': mounted.get('tutoring', args.tutoring), 'grade_level': args.grade, 'owns_opening': True,
                          'audio_input': {'manual_activity': True}}
            await ws.send(json.dumps({'type': 'authenticate', 'token': token, 'session_mode': 'lesson',
                **({'runtime_lesson': {'sessionEpoch': s.state['sessionEpoch'], 'initialState': s.state}} if args.lesson_entry else {
                    'runtime_sandbox': {'sessionEpoch': s.state['sessionEpoch'], 'initialState': s.state}, 'activity_sandbox': spec}),
                'primitive_context': empty if args.startup else mountedctx,
                'lesson_context': {'topic': args.topic, 'grade_level': args.grade,
                                   'objectives': [], 'ordered_components': []}}))
            workspace = journey.get('execution') == 'workspace' or bool((s.state.get('task') or {}).get('workspace'))
            await (teaching_workspace(s) if workspace else PROGRAMS[activity['teachingOwner']](s))
        receipts = [e['result'] for e in s.events if e['type'] == 'runtime_result']
        # Real audio can finish an answer while the model is choosing an action
        # from the prior working state. A scoped refusal is correct in that race.
        # The progression-only journey still requires no credit for the wrong
        # answer, successful correction, a
        # fresh item, settled completion and visible advance receipts.
        commands = {e['command']['commandId']: e['command'] for e in s.events if e['type'] == 'runtime_command'}
        safe_stale = lambda r: (args.progression_only and r['status'] == 'stale'
            and r['state']['revision'] > commands[r['commandId']]['expectedRevision'])
        assert (receipts or workspace) and all(r['status'] == 'visible' or safe_stale(r) for r in receipts), 'An action did not reach visible'
        if workspace:
            observations = [e['result'] for e in s.events if e['type'] == 'dialogue_observation']
            answered = sum(e['type'] == 'learner_input' and e.get('intent') == 'correct' for e in s.events)
            assert sum(e['status'] == 'visible' and e['transition'] == 'advance' for e in observations) == answered, \
                'Every correct answer must reach a visible observer advance'
            assert all(c['action']['type'] not in ('advance', 'retry') for c in commands.values()), 'Progression still depended on tutor tool calls'
        elif args.progression_only:
            assert sum(r['status'] == 'visible' and commands[r['commandId']]['action']['type'] == 'advance' for r in receipts) == 2, 'Both checked advances must reach visible'
        assert any(e['type'] == 'complete' and e['state']['status'] == 'completed' for e in s.events), 'No settled completion'
        assert next(e for e in s.events if e['type'] == 'complete')['submissions'] == (0 if workspace else 1), 'Unexpected completion writes'
        leak = re.compile('|'.join([SHARED_LEAK, *(re.escape(t) for t in journey['leakTokens'])]), re.I)
        for turn in [e['text'] for e in s.events if e['type'] == 'tutor']:
            assert not leak.search(turn), 'Protocol leakage or button-only grading: ' + turn[:120]
        return {'passed': True, 'primitiveId': args.primitive, 'events': s.events}
    except Exception as error:
        s.record('failure', reason=repr(error), state=s.state)
        return {'passed': False, 'primitiveId': args.primitive, 'events': s.events}
    finally:
        s.process.stdin.close()
        try: await asyncio.to_thread(s.process.wait, timeout=5)
        except subprocess.TimeoutExpired: s.process.terminate(); await asyncio.to_thread(s.process.wait)


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--primitive', required=True, help='A primitive with a row in liveJourneySpec.ts')
    parser.add_argument('--runs', type=int, default=3)
    parser.add_argument('--backend', default='ws://localhost:8000')
    parser.add_argument('--frontend', default='http://localhost:3000')
    parser.add_argument('--mode'); parser.add_argument('--grade'); parser.add_argument('--topic')
    parser.add_argument('--input', type=Path)
    parser.add_argument('--output', type=Path, help='Keep a separate report for a verification run')
    parser.add_argument('--startup', action='store_true',
                        help='Exercise the real activity-request and silent mount handoff first (judged runners)')
    parser.add_argument('--lesson-entry', action='store_true', help='Use the ordinary lesson runtime protocol without activity generation tools; mounted host layout is covered separately')
    parser.add_argument('--audio', action='store_true', help='Use synthetic learner audio and actual provider transcription for workspace journeys')
    parser.add_argument('--answer-prefix', default='', help='Natural conversational preface for actual spoken answers; requires --audio')
    parser.add_argument('--progression-only', action='store_true', help='Reproduce wrong answer, correction, next challenge and finish without a help detour')
    args = parser.parse_args()
    if args.lesson_entry and args.startup: parser.error('--lesson-entry uses prepared content; do not combine with --startup')
    if args.answer_prefix and not args.audio: parser.error('--answer-prefix requires --audio so the actual provider transcript owns submission')

    # The production envelope the model is given, and — separately, never mixed into
    # it — the harness journey. Both are served from the host registry; neither is
    # restated here.
    args.activity_spec = fetch_activity_spec(args.frontend, [args.primitive])
    args.journey = fetch_journey(args.frontend, args.primitive)
    defaults = args.journey['defaults']
    args.mode = args.mode or defaults['mode']
    args.grade = args.grade or defaults['grade']
    args.topic = args.topic or defaults['topic']

    token = get_id_token()
    live = json.loads(args.input.read_text(encoding='utf-8')) if args.input else fetch_live_context(
        args.frontend, args.primitive, args.topic, args.grade, args.mode, di=defaults['di'])
    args.tutoring = live.get('tutoring')
    # Mode is part of the name: a take_away run used to overwrite the count payload,
    # so a later --input replay silently drove the wrong lesson.
    # A blend pin (`a|b`) is a legal mode but `|` is not a legal Windows filename character.
    stem = f"{args.primitive}-runtime-{args.mode.replace('|', '+')}"
    stamp = date.today().isoformat()
    (REPORTS/f'{stem}-payload-{stamp}.json').write_text(json.dumps(live, indent=2), encoding='utf-8')
    report = args.output or REPORTS/f'{stem}-live-{stamp}.json'
    runs = []
    for index in range(1, args.runs + 1):
        result = await drive(args, token, live, index); runs.append(result)
        report.write_text(json.dumps(runs, indent=2), encoding='utf-8')
        print(f'Run {index}: {"PASS" if result["passed"] else "FAIL"}', flush=True)
    print(report, flush=True)
    return 0 if all(run['passed'] for run in runs) else 1

if __name__ == '__main__': raise SystemExit(asyncio.run(main()))
