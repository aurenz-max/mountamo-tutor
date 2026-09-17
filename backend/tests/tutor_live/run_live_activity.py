"""Real Live + existing generator smoke. Browser mount is simulated explicitly.

Run from backend: venv/Scripts/python tests/tutor_live/run_live_activity.py --runs 3
No student attempts/mastery are written. Uses the existing test-account auth helper.
"""
import argparse
import asyncio
import json
import time
from pathlib import Path

import requests
import websockets
from run_tutor_live import get_id_token
from activity_capabilities import fetch_activity_spec


async def drive(backend, frontend, token):
    events, workers = [], set()
    started = time.monotonic()
    phase, mounted, transcript_after_mount = "first", 0, False
    activity = None
    def record(kind, **fields):
        events.append({"seconds": round(time.monotonic() - started, 2), "type": kind, **fields})

    async with websockets.connect(f"{backend}/api/lumina-tutor", max_size=2**24) as ws:
        await ws.send(json.dumps({"type": "authenticate", "token": token, "session_mode": "lesson",
            "activity_sandbox": await asyncio.to_thread(fetch_activity_spec, frontend, ['number-line']),
            "primitive_context": {"primitive_type": "live-activity-sandbox", "instance_id": "empty",
                                  "primitive_data": {"workspace": "empty"}, "owns_opening": True},
            "lesson_context": {"topic": "Subtraction within 10", "grade_level": "Grade 1",
                               "ordered_components": [], "objectives": []},
        }))

        async def fulfill(event):
            nonlocal mounted, activity, transcript_after_mount
            response = await asyncio.to_thread(requests.post, f"{frontend}/api/lumina/live-activity",
                json={"request": event["args"], "gradeLevel": "Grade 1"}, timeout=110)
            if not response.ok:
                record("generation_error", status=response.status_code, body=response.text[:500])
                await ws.send(json.dumps({"type": "activity_result", "callId": event["callId"], "status": "error", "error": response.text[:500]}))
                return
            activity = response.json()
            record("generated", callId=event["callId"], activity=activity)
            mounted += 1
            transcript_after_mount = False
            await ws.send(json.dumps({"type": "activity_result", "callId": event["callId"],
                "status": "mounted", "instanceId": activity["instanceId"], "data": activity["initialState"],
                "tutoring": activity["tutoring"],
                "guidance": "The first challenge is now visible. Ask the first instruction without revealing the target answer."}))
            record("simulated_mount_ack", instanceId=activity["instanceId"])

        try:
            async with asyncio.timeout(240):
                async for raw in ws:
                    event = json.loads(raw)
                    kind = event.get("type")
                    if kind != "ai_audio": record(kind, **{k: v for k, v in event.items() if k != "type"})
                    if kind == "session_ready":
                        await ws.send(json.dumps({"type": "text", "content": "Help me understand subtraction within 10. Please show me a number line activity."}))
                    elif kind == "activity_request":
                        worker = asyncio.create_task(fulfill(event))
                        workers.add(worker)
                    elif kind == "ai_transcription" and mounted:
                        transcript_after_mount = True
                    elif kind == "ai_turn_end" and transcript_after_mount:
                        if phase == "first" and mounted == 1:
                            phase = "state"
                            transcript_after_mount = False
                            await ws.send(json.dumps({"type": "update_context", "primitive_data": {"jumpEndPoints": [2], "instruction": activity["data"]["challenges"][0]["instruction"]}}))
                            await ws.send(json.dumps({"type": "text", "content": "At what number did I just place my jump endpoint? Tell me just that number, not the answer to the exercise."}))
                        elif phase == "state":
                            phase = "second"
                            transcript_after_mount = False
                            await ws.send(json.dumps({"type": "text", "content": "Please generate another subtraction example with a new number line activity."}))
                        elif phase == "second" and mounted >= 2:
                            record("completed", mounts=mounted)
                            return events
                    if kind == "session_ended": break
        finally:
            for worker in workers:
                if not worker.done(): worker.cancel()
            outcomes = await asyncio.gather(*workers, return_exceptions=True)
            for outcome in outcomes:
                if isinstance(outcome, Exception): record("worker_error", error=str(outcome))
    return events


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--backend", default="ws://localhost:8000")
    parser.add_argument("--frontend", default="http://localhost:3000")
    args = parser.parse_args()
    token = get_id_token()
    reports = []
    path = Path(__file__).resolve().parents[3] / "my-tutoring-app/qa/tutor-reports/live-activity-sandbox-2026-09-16.json"
    for index in range(args.runs):
        try:
            events = await drive(args.backend, args.frontend, token)
        except Exception as error:
            events = [{"type": "error", "error": str(error)}]
        reports.append(events)
        path.write_text(json.dumps(reports, indent=2), encoding="utf-8")
        print(f"Run {index+1}: " + json.dumps([e for e in events if e['type'] in ('completed', 'error', 'generation_error', 'worker_error')]), flush=True)
    print(path, flush=True)


if __name__ == "__main__":
    asyncio.run(main())
