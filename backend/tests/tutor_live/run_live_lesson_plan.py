"""Planned live lesson drive (LIVE_LESSON_ROADMAP phase 1, LA-02/LA-03).

Real backend, real Gemini Live, real plan bridge. The browser is SIMULATED and
labeled as such: mount receipts, the ten-frame DI runner's cues (production
strings from scripts/live-lesson-plan-fixture.mjs), NumberLine's check cues and
completion report, and text student answers. It checks the planned route and
the handoff between a DI-runner item and a tutor-led item. It does not test
the microphone, ASR, VAD or audio playback.

Run from backend with both servers up (package paths are relative to my-tutoring-app):
  venv/Scripts/python tests/tutor_live/run_live_lesson_plan.py --package qa/lesson-bench/packages/<file>.json
No student attempts or mastery are written.
"""
import argparse
import asyncio
import json
import subprocess
import time
import uuid
from pathlib import Path

import websockets
from run_tutor_live import classify_di_verdict, get_id_token

APP = Path(__file__).resolve().parents[3] / "my-tutoring-app"
NUMBER_LINE_GUIDANCE = ("The number line is now visible. Use the first challenge instruction. Targets and operations are "
                        "tutor reference: do not reveal answers. Let the student place points or make jumps and use "
                        "component feedback as correctness evidence.")


def load_fixture(package, objectives):
    out = subprocess.run(["node", "scripts/live-lesson-plan-fixture.mjs", package, *objectives], cwd=APP,
                         capture_output=True, text=True, encoding="utf-8", timeout=180, shell=False)
    if out.returncode:
        raise RuntimeError(out.stderr[-2000:])
    return json.loads(out.stdout)


def line_state(item, index):
    challenge = item["data"]["challenges"][index]
    return {**item["initialState"], "currentChallengeIndex": index, "instruction": challenge["instruction"],
            "challengeType": challenge["type"], "targetValues": challenge["targetValues"],
            "placedPoints": [], "jumpEndPoints": [], "attemptNumber": 1}


class Drive:
    def __init__(self, ws, fixture):
        self.ws, self.fx = ws, fixture
        self.items = {i["itemId"]: i for i in fixture["items"]}
        self.order = [i["itemId"] for i in fixture["items"]]
        self.started = time.monotonic()
        self.events, self.done_items = [], set()
        self.active = None
        self.marker = 0.0          # a turn only counts if its speech began after this
        self.turn_text, self.turn_first = "", None
        self.finished_at = None

    def record(self, kind, **fields):
        self.events.append({"t": round(time.monotonic() - self.started, 2), "type": kind, **fields})

    async def send(self, message, provokes_turn=True):
        if provokes_turn:
            self.marker = time.monotonic()
        await self.ws.send(json.dumps(message))
        if message["type"] != "update_context":
            self.record("sent", message={k: v for k, v in message.items() if k not in ("data", "tutoring")})

    async def on_request(self, event):
        item_id = (event.get("args") or {}).get("planItemId")
        following = next((i for i in self.order if i not in self.done_items), None)
        if item_id != following or (self.active and self.active["itemId"] == item_id):
            await self.send({"type": "activity_result", "callId": event["callId"], "status": "error",
                             "error": f"Only the next planned activity can start: {following}." if following
                             else "The planned lesson is finished."}, provokes_turn=False)
            self.record("rejected_start", itemId=item_id, expected=following)
            return
        item = self.items[item_id]
        instance = f"live-plan-{item_id}-{uuid.uuid4()}"
        self.active = {"itemId": item_id, "callId": event["callId"], "instanceId": instance, "item": item,
                       "phase": "await_ready" if item["teachingOwner"] == "di-runner" else "intro",
                       "index": 0, "wrong_done": False, "correct": False, "completed": False}
        self.marker = time.monotonic()
        await self.send({"type": "activity_result", "callId": event["callId"], "status": "mounted", "instanceId": instance,
                         "primitiveId": item["primitiveId"], "data": item["initialState"], "tutoring": item["tutoring"],
                         "guidance": NUMBER_LINE_GUIDANCE, "planItem": item["planItem"]}, provokes_turn=False)
        self.record("simulated_mount", itemId=item_id, primitiveId=item["primitiveId"], instanceId=instance)

    async def complete_item(self):
        a = self.active
        a["completed"] = True
        self.done_items.add(a["itemId"])
        following = next((i for i in self.order if i not in self.done_items), "")
        if not following:
            self.finished_at = time.monotonic()
        await self.send({"type": "plan_item_complete", "callId": a["callId"], "instanceId": a["instanceId"],
                         "itemId": a["itemId"], "nextItemId": following,
                         "outcome": {"itemId": a["itemId"], "disposition": "completed", "allCorrect": True, "score": 100}},
                        provokes_turn=False)

    # ── ten-frame: the judged runner, replayed from its production cues ──
    async def di_cue(self, index):
        di = self.active["item"]["diPlan"]
        item = di["items"][index]
        await self.send({"type": "update_context", "primitive_data": {"activity": di["activityLine"], **item["context"]},
                         "student_progress": None}, provokes_turn=False)
        await self.send({"type": "text", "content": item["cue"], "scripted": True})

    async def di_turn(self, text):
        a, di = self.active, self.active["item"]["diPlan"]
        item = di["items"][a["index"]] if a["index"] < len(di["items"]) else None
        if a["phase"] == "ask":
            wrong = a["index"] == 0 and not a["wrong_done"]
            a["wrong_done"] = a["wrong_done"] or wrong
            a["answered"] = "wrong" if wrong else "right"
            a["phase"] = "verdict"
            await self.send({"type": "text", "content": item["answers"]["plainWrong" if wrong else "correct"]})
        elif a["phase"] == "verdict":
            verdict = classify_di_verdict(text, di["sentinels"])
            self.record("di_verdict", item=item["id"], answered=a["answered"], verdict=verdict, text=text)
            if a["answered"] == "wrong":
                a["answered"] = "right"
                await self.send({"type": "text", "content": item["answers"]["correct"]})
                return
            a["index"] += 1
            if a["index"] < len(di["items"]):
                a["phase"] = "ask"
                await self.di_cue(a["index"])
            else:
                if not a["completed"]:
                    await self.complete_item()
                a["phase"] = "closing"
                await self.send({"type": "text", "content": di["completeCue"], "scripted": True})
        elif a["phase"] == "closing":
            a["phase"] = "await_next"

    def di_transcript(self):
        # The runner finishes (and reports completion) as the last affirmation streams, before its turn ends.
        a = self.active
        di = a["item"]["diPlan"]
        if (a["phase"] == "verdict" and a["answered"] == "right" and a["index"] == len(di["items"]) - 1
                and not a["completed"] and classify_di_verdict(self.turn_text, di["sentinels"]) == "affirm"):
            return self.complete_item()
        return None

    # ── number line: tutor-led, advance_activity owns progression ──
    async def line_turn(self):
        a = self.active
        challenges = a["item"]["data"]["challenges"]
        if a["phase"] != "intro":
            return
        challenge = challenges[a["index"]]
        targets = challenge["targetValues"]
        if a["index"] == 0 and not a["wrong_done"]:
            a["wrong_done"] = True
            await self.send({"type": "update_context", "primitive_data": {"jumpEndPoints": [targets[0] + 1]}}, provokes_turn=False)
            await self.send({"type": "text", "content": f'[ANSWER_INCORRECT] Challenge: "{challenge["instruction"]}". Student placed: []. '
                             f'Target: [{", ".join(map(str, targets))}]. Attempt 1. Give a hint without revealing the answer.'})
            return
        a["correct"] = True
        a["phase"] = "await_advance"
        await self.send({"type": "update_context", "primitive_data": {"jumpEndPoints": targets}}, provokes_turn=False)
        await self.send({"type": "text", "content": f'[ANSWER_CORRECT] Student correctly completed "{challenge["instruction"]}". '
                         f'Attempts: {2 if a["index"] == 0 else 1}. Congratulate briefly.'})
        if a["index"] == len(challenges) - 1:
            await self.send({"type": "text", "content": f"[ALL_COMPLETE] Phase scores: Jump 100%. Overall: 100%. {len(challenges)} challenges completed. Give encouraging phase-specific feedback."})
            await self.complete_item()

    async def on_command(self, event):
        a = self.active
        ok = (a and a["item"]["primitiveId"] == "number-line" and event.get("instanceId") == a["instanceId"]
              and event.get("challengeIndex") == a["index"] and a["correct"])
        count = len(a["item"]["data"]["challenges"]) if a else 0
        if not ok:
            state = line_state(a["item"], a["index"]) if a and a["item"]["primitiveId"] == "number-line" else {}
            await self.send({"type": "activity_command_result", "callId": event["callId"], "instanceId": event.get("instanceId"),
                             "status": "rejected", "state": state, "error": "Finish and check the current challenge before advancing. The index must match."},
                            provokes_turn=False)
            self.record("advance_rejected", challengeIndex=event.get("challengeIndex"))
            return
        last = a["index"] == count - 1
        if not last:
            a["index"] += 1
        a["correct"] = False
        a["phase"] = "done" if last else "intro"
        await self.send({"type": "activity_command_result", "callId": event["callId"], "instanceId": a["instanceId"],
                         "status": "complete" if last else "advanced", "state": line_state(a["item"], a["index"])})

    async def run(self, timeout):
        """Until the timeout, or 25s after the last item reports completion (its closing turn and any stray calls)."""
        deadline = self.started + timeout
        while True:
            end = min(deadline, self.finished_at + 25) if self.finished_at else deadline
            if time.monotonic() >= end:
                if not self.finished_at:
                    raise TimeoutError
                return
            try:
                raw = await asyncio.wait_for(self.ws.recv(), end - time.monotonic())
            except asyncio.TimeoutError:
                continue
            event = json.loads(raw)
            kind = event.get("type")
            if kind == "ai_audio":
                continue
            if kind != "ai_transcription":
                self.record(kind, **{k: v for k, v in event.items() if k not in ("type", "data")})
            if kind == "session_ready":
                plan = self.fx["items"]
                await self.send({"type": "text", "content": f"[LESSON_START] Begin the planned lesson now. Call start_plan_item with itemId {plan[0]['itemId']}. Do not greet first or describe the activity before it is mounted.", "interrupt": False, "scripted": False})
            elif kind == "activity_request":
                await self.on_request(event)
            elif kind == "activity_ready":
                if self.active and self.active["instanceId"] == event.get("instanceId") and self.active["phase"] == "await_ready":
                    self.active["phase"] = "ask"
                    await self.di_cue(0)
            elif kind == "activity_command":
                await self.on_command(event)
            elif kind == "ai_transcription":
                if self.turn_first is None:
                    self.turn_first = time.monotonic()
                self.turn_text += event.get("content", "")
                if self.active and self.active["item"]["teachingOwner"] == "di-runner":
                    pending = self.di_transcript()
                    if pending:
                        await pending
            elif kind == "ai_turn_end":
                text, first = self.turn_text.strip(), self.turn_first
                self.turn_text, self.turn_first = "", None
                counted = bool(text) and first is not None and first > self.marker
                self.record("turn", text=text, counted=counted,
                            active=self.active and {"itemId": self.active["itemId"], "phase": self.active["phase"], "index": self.active["index"]})
                if not counted or not self.active:
                    continue
                if self.active["item"]["teachingOwner"] == "di-runner":
                    await self.di_turn(text)
                else:
                    await self.line_turn()
            if kind == "session_ended":
                return


async def drive(backend, token, fixture, timeout):
    async with websockets.connect(f"{backend}/api/lumina-tutor", max_size=2**24) as ws:
        await ws.send(json.dumps({"type": "authenticate", "token": token, "session_mode": "lesson",
            "activity_sandbox": {**fixture['activitySpec'], 'plan': fixture['tutorPlan']},
            "primitive_context": {"primitive_type": "live-activity-sandbox", "instance_id": "empty-workspace",
                                  "primitive_data": {"workspace": "empty", "gradeLevel": fixture["gradeLevel"], "lessonPlan": fixture["planId"]},
                                  "owns_opening": True},
            "lesson_context": {"topic": fixture["topic"], "grade_level": fixture["gradeLevel"], "ordered_components": [], "objectives": []},
        }))
        d = Drive(ws, fixture)
        try:
            await d.run(timeout)
            d.record("completed")
        except TimeoutError:
            d.record("timeout", active=d.active and {"itemId": d.active["itemId"], "phase": d.active["phase"], "index": d.active["index"]})
        return d.events


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--package", required=True)
    parser.add_argument("--objective", action="append", default=[])
    parser.add_argument("--runs", type=int, default=1)
    parser.add_argument("--reverse", action="store_true", help="run the plan items in reverse (synthetic) order")
    parser.add_argument("--timeout", type=int, default=420)
    parser.add_argument("--backend", default="ws://localhost:8000")
    parser.add_argument("--out", default=str(APP / "qa/tutor-reports/live-lesson-plan-2026-09-16.json"))
    args = parser.parse_args()
    fixture = load_fixture(args.package, args.objective)
    if args.reverse:
        # Synthetic order (labeled in the report): exercises the tutor-led -> DI-runner handoff.
        fixture["items"].reverse()
        for n, item in enumerate(fixture["items"], 1):
            item["itemId"] = item["planItem"]["itemId"] = f"item-{n}"
        fixture["tutorPlan"]["items"] = [{"primitiveId": i["primitiveId"], **i["planItem"]} for i in fixture["items"]]
        for entry in fixture["tutorPlan"]["items"]:
            entry.pop("intent")
    token = get_id_token()
    report = {"package": args.package, "order": "reversed (synthetic)" if args.reverse else "manifest", "plan": fixture["tutorPlan"], "unavailable": fixture["unavailable"],
              "simulated": ["browser mount receipts", "DI runner cues (production strings)", "NumberLine check cues",
                            "completion reports", "text student answers"], "runs": []}
    for index in range(args.runs):
        try:
            events = await drive(args.backend, token, fixture, args.timeout)
        except Exception as error:  # noqa: BLE001 - a failed run is evidence, not a crash
            events = [{"type": "error", "error": repr(error)}]
        report["runs"].append(events)
        Path(args.out).write_text(json.dumps(report, indent=2), encoding="utf-8")
        summary = [e for e in events if e["type"] in ("completed", "timeout", "error", "rejected_start", "simulated_mount", "advance_rejected")]
        print(f"Run {index + 1}: {json.dumps(summary)}", flush=True)
    print(args.out, flush=True)


if __name__ == "__main__":
    asyncio.run(main())
