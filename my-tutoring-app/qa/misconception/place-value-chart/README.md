# Place-value misconception pilot

Run from `my-tutoring-app` with frontend on localhost:3000 and backend on 127.0.0.1:8000:

```powershell
node scripts/probe-place-value-misconception.mjs --store --live
```

Prerequisites: installed npm dependencies; Gemini configuration for the frontend; backend Firestore access; Python environment with backend requirements; existing Live harness Firebase credentials in its configured `content-pipeline/.env`. Never paste credentials into the command. Override service URLs with `PVC_FRONTEND` / `PVC_BACKEND` and Python with `PVC_PYTHON` if needed. The Live harness currently uses its default websocket URL.

Without `--store --live`, the command runs real D/G and in-memory R only. `--diagnosis-run <previous-run.json>` reuses saved real D responses (source run recorded) while rerunning G; it does not call those responses new diagnoses. Each invocation creates a timestamped folder with sanitized synthetic evidence, raw outputs, hashes, compiled items, verdicts and a readable report. Failed runs remain available.

For a single same-content Live drive:

```powershell
# From backend; replace <run-id> and payload number with a TARGETED draw.
& 'C:/Users/xbox3/miniforge-pypy3/envs/py311env/python.exe' -u tests/tutor_live/run_tutor_live.py --component place-value-chart --di --di-wrong signature --di-input '../my-tutoring-app/qa/misconception/place-value-chart/<run-id>/payload-1.json' --runs 1
```

The local POST tutor-test route validates the payload and rebuilds cues with the production adapter/compiler. The report records its SHA-256. `--di-independent-item 'pvc-3::value'` omits that item's initial wrong response so its correct answer precedes correction. It is synthetic first-response behavior, not measured learner improvement. `--di-cap` tests existing cap behavior.

Open `artifacts/math-pedagogy-review/index.html` and import a run's `run.json` in the place-value results panel. The viewer works offline. Its imported timestamp is visible; reports older than one day are labeled old. It never treats fixtures as live passes.

## Open production gates

Published Grade 3 `NBT003-02-a` addresses three-digit digit worth. Compare mode selects four-digit numbers. A reviewed matching curriculum objective or an explicitly authorized mode/scope revision is needed before an honest production lesson demonstration. No curriculum was changed by this pilot.

Browser inventory returned no browsers in this session. Once a browser is available, use a disposable student and the resolved objective to drive repeated bare-digit failures to the actual cap, inspect emitted evidence and stored composite identity, generate the following lesson through generation context, and inspect the matched submission and subsequent active-context read. Existing microphone acceptance remains under HUMAN-CHECKS #113 / #63.

The existing product rule resolves after a matched tagged score ≥80; this is not durable mastery or delayed transfer. In-memory R, real-store S4, and text-driven Live each prove only their named boundary.
