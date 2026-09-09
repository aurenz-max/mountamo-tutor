# Prompt audit — 2026-09-09

Run via `/claude-api prompt-audit` (non-interactive). Nothing was applied; every edit below is a proposal.

## Assumptions (Step 0)

- **Scope:** no file was named, so the scope is the whole working tree's prompt surface (Step 1 inventory).
- **Provider:** the product runs on Gemini (`google-genai`, `@google/genai`): 346 files call it, 400 model-ID references use the repo's own aliases `gemini-flash-latest` / `gemini-flash-lite-latest`. This is recorded as a non-Anthropic marker. No Gemini file is proposed for a switch to the Anthropic SDK. One Anthropic SDK file exists: `backend/app/services/anthropic.py` (`anthropic==0.45.0`).
- **Target model, per surface:**
  - Claude Code layer (`CLAUDE.md`, `AGENTS.md`, `lumina/CLAUDE.md`, 32 `SKILL.md`): **Claude Fable 5.1**, the model executing these files in this repo.
  - Anthropic SDK file: **Claude Opus 5** (this skill's default; the repo documents no migration target).
  - Gemini-facing prompts (backend endpoints/services, 295 `gemini-*.ts` generators, 44 `aiDirectives` catalogs, Gemini Live tutor prompts): no Claude target applies. Findings there are limited to defects verifiable in code or by a live call (dead routes, model IDs that 404). Pressure-language and scaffold rows are recorded as `flag` at low confidence.
- The memory directory (`~/.claude/projects/.../memory`) is outside the tree and was not audited.

## Inventory (Step 1)

| Surface | Files | Lines | Target |
|---|---|---|---|
| `CLAUDE.md`, `AGENTS.md`, `my-tutoring-app/src/components/lumina/CLAUDE.md` | 3 | 108 | Fable 5.1 |
| `.claude/skills/*/SKILL.md` (+1 reference file) | 33 | 9,750 | Fable 5.1 |
| `.claude/settings.json` (permissions only), `.claude/workflows/migrate-engineering.js` | 2 | — | Fable 5.1 |
| `backend/app/services/anthropic.py` | 1 | 134 | Opus 5 |
| Backend Gemini prompt builders (`lumina_tutor.py`, `practice_tutor.py`, `education.py`, `playground.py`, `daily_briefing_live.py`, `review.py`, `gemini_generate.py`, …) | 11 | 7,311 | Gemini (flag only) |
| Backend `generate_content` call sites | ~19 files | — | Gemini (flag only) |
| Frontend generators `lumina/service/**/gemini-*.ts` | 295 | ~42k (top 115) | Gemini (flag only) |
| Catalog `aiDirectives` (tutor scaffolds) | 44 | — | Gemini (flag only) |

## Provenance (Step 2)

- All 32 skills were created 2026-02 → 2026-09 and last edited 2026-03 → 2026-09, i.e. written for Claude Code on Claude 4.x/5-era models. No retired Claude model name appears in any skill or rule file. Nearly every `MUST`/`NEVER` in the skill bodies sits next to the incident that motivated it (keep-list item 5 / §1e), so pressure language is not the problem in this repo. The dated material is **history narrative and migration-relative phrasing** (Group 1d / Group 2).
- `backend/app/services/anthropic.py`: last edit 2025-05-02. Model `claude-3-7-sonnet-20250219`, `temperature=0.6`, `max_tokens=2048`, `response.content[0].text`.
- `backend/app/api/endpoints/gemini.py`: last edit 2025-07-12; imported in `main.py` but never mounted (no `include_router`, no other importer).
- `backend/app/services/llm_briefing_content_selector.py`: no importer anywhere in `backend/app`; carries two retired IDs.
- `practice_tutor.py` 2025-11-20; `lumina_tutor.py` 2026-09-05 (active).

**Live probes (read-only `models.get` / `models.retrieve`, run with the repo's keys):**

| Model ID | Result |
|---|---|
| `gemini-2.5-flash-preview-05-20` | 404 NOT_FOUND |
| `gemini-2.0-flash-exp` | 404 NOT_FOUND |
| `gemini-flash-latest` | OK |
| `claude-3-7-sonnet-20250219` | 404 |
| `claude-3-5-haiku-20241022` | 404 |
| `claude-opus-5` | OK |

## Summary

| Group | High | Medium | Low / flag |
|---|---|---|---|
| 1 Dated prompt text | 1 | 6 | 3 |
| 2 Brittle skill files | 1 | 4 | 0 |
| 3 Tool / trigger descriptions | 0 | 1 | 0 |
| 4 Request config & architecture | 6 | 1 | 2 |
| **Total** | **8** | **12** | **5** |

Highest impact:

1. **Student-work review on the mounted `assessments` route is a two-stage dead path.** `review.py` calls `gemini-2.5-flash-preview-05-20` (404), catches the error, and falls back to `AnthropicService` because `backend/.env` sets `DEFAULT_AI_REVIEW_SERVICE="anthropic"`. That service pins `claude-3-7-sonnet-20250219` (404). Every review therefore fails twice and returns the error path. (H1, H2, H4)
2. **Six more backend call sites pin the same 404 Gemini preview ID**, and two files pin `gemini-2.0-flash-exp` (404). The repo's own convention is `gemini-flash-latest`. (H5, H6)
3. **`CLAUDE.md` contradicts two skills.** It tells sessions to run "publish → deploy" (no deploy endpoint exists) and to "follow the `ADDING_PRIMITIVES.md` checklist exactly" while `/primitive` says "DO NOT read `ADDING_PRIMITIVES.md`". Disagreeing duplicates are the one kind the keep-list says to reconcile. (H7, M1)

The Claude-facing surface is otherwise clean: no `<scratchpad>` / "think step by step" instructions, no prefill, no `budget_tokens`, no update suppressors, no anti-formatting rules, no grader vocabulary, no cadence reminders, no retired Claude names.

---

## Findings (Step 5) — ordered by confidence

### High

**H1** — `backend/app/services/anthropic.py:12`
- Evidence: `self.model = "claude-3-7-sonnet-20250219"` (and the commented `claude-3-5-haiku-20241022` on line 11)
- Pattern: Group 4 API fossil; Group 1d pinned model name
- Why obsolete: the ID returns 404 today (probed). Reachable at runtime via `assessments` → `ReviewService._fallback_review` → `AIServiceFactory("anthropic")`.
- Action: `rewrite` → `claude-opus-5` (hunk 1)

**H2** — `backend/app/services/anthropic.py:29`
- Evidence: `temperature=0.6` (with the comment "Add this line to fix the temperature setting")
- Pattern: Group 1b sampling-parameter fossil
- Why obsolete: `temperature` is removed on Claude Opus 5 (400). Remove with the model change or the rewritten call fails.
- Action: `remove` (hunk 1)

**H3** — `backend/app/services/anthropic.py:108`
- Evidence: `session_model = "claude-3-5-haiku-20241022"`
- Pattern: Group 4 API fossil
- Why obsolete: 404 (probed). The comment "Always use haiku for summaries for performance" is the author's intent, so keep Haiku: `claude-haiku-4-5`. `temperature=0.3` on line 128 is still legal on Haiku 4.5 and is left in place.
- Action: `rewrite` (hunk 1)

**H4** — `backend/app/services/review.py:29`
- Evidence: `self.model_id = 'gemini-2.5-flash-preview-05-20'` (used at lines 125 and 514)
- Pattern: Group 4 API fossil (Gemini file; ID edit only)
- Why obsolete: 404 (probed); on the mounted `assessments` route; the repo's convention is `gemini-flash-latest`.
- Action: `rewrite` (hunk 2)

**H5** — `backend/app/services/gemini_read_along.py:100`; `backend/app/services/llm_briefing_content_selector.py:244,375,407,416-417`
- Evidence: `model="models/gemini-2.0-flash-exp"` (image modality); `model="gemini-2.0-flash-exp"`, `model="gemini-2.5-flash-lite-preview-06-17"`
- Pattern: Group 4 API fossil
- Why obsolete: `gemini-2.0-flash-exp` 404s (probed). `gemini_read_along.py` is wired through `core/session_manager.py`; the selector file has no importer at all (dead).
- Action: `rewrite` read-along to the repo's image model `gemini-3.1-flash-lite-image` (hunk 3); `remove` the dead selector file, or rewrite its three IDs if it is kept.

**H6** — `backend/app/generators/practice_problems.py:156,289`; `backend/app/generators/reading_content.py:56,113`; `backend/app/schemas/reading_content.py:154`; `backend/app/services/ai_assessment_service.py:199`; `backend/app/generators/content.py:161`; `backend/app/p5js metadata.py:127`
- Evidence: `model='gemini-2.5-flash-preview-05-20'` (and a `Field(default=...)` label in `content.py`)
- Pattern: Group 4 API fossil
- Why obsolete: 404 (probed). `ai_assessment_service` sits behind the mounted `assessments` router; the generators are reached through `content_generation_service`. `p5js metadata.py` has a space in its module name and cannot be imported (dead).
- Action: `rewrite` → `gemini-flash-latest` (hunk 4)

**H7** — `CLAUDE.md:89`
- Evidence: "All curriculum changes go through: edit draft → `lineage-check` → publish → deploy."
- Pattern: Group 2 volatile specifics; disagreeing duplicate (keep-list 8) of `curriculum-author/SKILL.md:47,124` ("There is NO `/deploy` endpoint")
- Why obsolete: verified — `backend/app/api/endpoints/curriculum.py` has no deploy route. A session following CLAUDE.md literally (Fable 5.1 follows rule files closely) will look for a step that does not exist.
- Action: `rewrite` (hunk 5)

**H8** — `backend/app/main.py:7` + `backend/app/api/endpoints/gemini.py` (921 lines)
- Evidence: `gemini` in the endpoint import tuple; file pins `gemini-2.0-flash-exp` ×3 and `temperature/top_p/top_k`
- Pattern: Group 4 fossil / dead code
- Why obsolete: imported but never mounted, no other importer, untouched since 2025-07-12. It is the first thing a grep for "the Gemini endpoint" finds.
- Action: `remove` (hunk 6; the file deletion is the user's call)

### Medium

**M1** — `CLAUDE.md:35` vs `.claude/skills/primitive/SKILL.md:42`
- Evidence: CLAUDE.md: "Follow the `ADDING_PRIMITIVES.md` checklist exactly." Skill: "**DO NOT read `ADDING_PRIMITIVES.md` or `ADDING_TUTORING_SCAFFOLD.md`** — those are 1500+ lines of reference docs meant for humans. Everything you need is in this skill file."
- Pattern: Group 2 duplicated info that disagrees; stale figure (the two docs are 1,204 + 499 lines)
- Why obsolete: the skill is the executor and was written to be self-contained; CLAUDE.md predates it (2025-08) and now sends the model to a doc the skill forbids. Current models reconcile by spending effort, not by picking one.
- Action: `rewrite` CLAUDE.md to point at the skill; drop the line count in the skill (hunk 7)

**M2** — `.claude/skills/curriculum-author/SKILL.md:45,47,124,385`
- Evidence: "grade is **now** required…", "it **no longer** exists and returns 404", "(**Older docs** describing a two-step publish→deploy are stale…)", "Use `/api/agent/` not `/api/graph-agent/` — the latter returns 404."
- Pattern: Group 1d migration-relative phrasing
- Why obsolete: the text is a diff against a prompt version the model never saw; it implies phantom alternatives (`/deploy`, `/graph-agent`) the model then has to rule out. Write the current rule only.
- Action: `rewrite` (hunk 8)

**M3** — `.claude/skills/student-data-loop/SKILL.md:71,143,159,182,193,219,228,246,261,334-335,337,345`
- Evidence: "(the 2026-07-02 slice)", "CONVERGED 2026-07-03", "**Removed 2026-07-03**", "tsc baseline 1101 as of 2026-07-03 … dropped from 1417", "Known Rough Edges (checked 2026-07-02)"
- Pattern: Group 2 history narratives / time-sensitive content; the tsc number disagrees with `ship/SKILL.md:75` ("~1040")
- Why obsolete: the dates carry no rule; the frozen baseline number is wrong two months later and conflicts with the skill that owns the gate.
- Action: `rewrite` (hunk 9; the same date-drop applies to the lines not shown)

**M4** — `.claude/skills/student-data-loop/SKILL.md:325`; `.claude/skills/topic-trace/SKILL.md:46`
- Evidence: `C:\Users\xbox3\miniforge-pypy3\envs\py311env\python.exe`; `/c/Users/xbox3/miniforge-pypy3/envs/py311env/python`
- Pattern: Group 2 volatile specifics (hardcoded machine path); disagrees with CLAUDE.md **Commands** (`backend/venv/Scripts/python`)
- Why obsolete: two interpreters are named for the same job. `backend/venv/Scripts/python.exe` exists and ran this audit's probe (google-genai, anthropic, dotenv all import).
- Action: `rewrite` (hunk 10)

**M5** — `.claude/skills/add-di-loop/SKILL.md:185,222,263`
- Evidence: "**This is the instruction this skill got wrong**… The old text told you…"; "this skill **used to say nothing** because the first two ports never had to ask"; "(12 files hand-copied it … **before** `…testkit.ts` **existed**)"
- Pattern: Group 1d migration-relative phrasing; Group 2 history narrative
- Why obsolete: the rule and its reason are load-bearing (keep); the framing as a correction of earlier text is not. Keep the incident as the reason, drop the archaeology.
- Action: `rewrite` (hunk 11)

**M6** — `.claude/skills/primitive-contract/SKILL.md:152-160`
- Evidence: "The old Phase 2b emitted a G-series wishlist per contract … **9 contracts emitted 26 gaps (20 still open)** … a coin-counter audit found 5 of its 6 gaps…"
- Pattern: Group 2 history narrative
- Why obsolete: the rule ("derive no improvement queue") stands on its stated reason; the counts and the coin-counter audit are archaeology.
- Action: `rewrite` (hunk 12)

**M7** — `.claude/skills/tutor-test/SKILL.md:82`
- Evidence: "It used to mean a mic sitting; it is now machine-driven."
- Pattern: Group 1d migration-relative phrasing
- Action: `rewrite` (hunk 13)

**M8** — `.claude/skills/add-voice-control/SKILL.md:136`
- Evidence: "that shape was ruled out and deleted 2026-07-05."
- Pattern: Group 2 history narrative with date
- Action: `rewrite` (hunk 14)

**M9** — `.claude/skills/primitive/SKILL.md:299,316,517`
- Evidence: "**IMPORTANT — Required Fields Manifest:**", "**IMPORTANT: The generator is NOT built here.**", "**CRITICAL SCHEMA RULES:**"
- Pattern: Group 1a pressure language with no adjacent reason (the file has 21 emphasis markers; these three are headers)
- Why obsolete: when several instructions are each marked critical the markers stop carrying information; the reasoned ones (e.g. line 159, line 484) keep their weight better without these.
- Action: `rewrite` (hunk 15)

**M10** — `backend/app/services/anthropic.py:31,131`
- Evidence: `return response.content[0].text.strip()`; `max_tokens=2048`
- Pattern: Group 4 migration checklist
- Why obsolete: thinking is on by default on Claude Opus 5, so `content[0]` is normally a thinking block and `.text` raises. `stop_reason: "refusal"` is never checked.
- Action: `rewrite` (folded into hunk 1)

**M11** — `backend/app/services/gemini_generate.py:190-212`; `backend/app/services/curriculum_mapping_service.py:333-346`; `backend/app/services/llm_briefing_content_selector.py:229`
- Evidence: two fence-stripping branches plus a regex retry (`re.sub(r'^```(?:json)?\s*'…)`); "Return ONLY a JSON object … Return ONLY valid JSON, no explanation" with no response schema on the call
- Pattern: Group 1b JSON-forcing scaffold replaced by an API feature
- Why obsolete: the repo already uses Gemini structured output (`response_mime_type="application/json"` + `response_schema`, e.g. `review.py:125`, and every frontend generator). These three paths hand-parse instead. Gemini file: replacement named here, no code in the diff.
- Action: `replace-with-API-feature` — set `response_mime_type`/`response_schema` on the `GenerateContentConfig` and delete the fence-stripping branches.

**M12** — 29 of 32 `SKILL.md` files have no frontmatter `description` (only `eval-fix`, `curriculum-fit`, `curriculum-lumina-audit` do)
- Evidence: routing text is the H1 alone, e.g. "primitive: Add New Lumina Primitive", "pm: PM — Portfolio Reconciliation & Planning"
- Pattern: Group 3 under-described trigger text (vague one-liner)
- Why obsolete: the description is what routes a request to the skill; one noun phrase gives no when-to-use / when-not-to-use. This is the one place the audit adds text.
- Action: `add` (hunk 16 covers four skills as the pattern; apply to the rest)

### Low / flag (no edit proposed)

**L1** — `backend/app/api/endpoints/lumina_tutor.py:648-653` `_IMPORTANT_BLOCK`: "BE PATIENT - learning takes time", "ENCOURAGE mistakes as learning opportunities" are generic virtues (§1c padding) beside two real constraints. Gemini Live prompt — `flag`.

**L2** — `backend/app/api/endpoints/practice_tutor.py:194,233-237`: "you MUST immediately call the `send_answer_feedback` tool", "**MANDATORY RULES:**" (§1a booster in tool-steering text; 2025-11). Gemini Live prompt — `flag`.

**L3** — ~10 generators/judges say "Return ONLY valid JSON" beside a `responseSchema` (e.g. `gemini-manifest.ts:409`, `gemini-choice-judge.ts:178`, the `gemini-di-*` wrappers). Redundant under structured output, harmless. Gemini — `flag`.

**L4** — `backend/requirements.txt:86` `anthropic==0.45.0`: the current SDK is 1.x. Out of this audit's scope; `/claude-api upgrade python` is the route. Refusal fallbacks (`fallbacks: "default"`) are not added in hunk 1 because the pinned SDK has no typed support for the parameter — add them after the upgrade.

**L5** — Token accounting: one file in the whole tree reads `usage_metadata`. Group 4 recommends per-surface cost visibility before any cleanup is measured. `flag`.

**Checked and kept (false positives):**
- "Let's think step by step" in `catalog/calendar.ts:107`, `engineering.ts:602`, `math.ts:5421` are scripted hint lines spoken to the child, not reasoning incantations.
- Numeric caps in generators ("at most 12 words", "max 16 words") are reader-band constraints for K-2 children — audience context, not §1f output shaping.
- 584 `NEVER` / 449 `MUST` across generator prompts are schema-contract statements ("tallerBarLabel MUST equal bar0Label"); the repo's flash-lite drop evidence makes them tested fixes (keep-list 4, 5).
- "Anti-Patterns (DO NOT)" lists in `curriculum-author` and `lumina-portfolio` each carry a reason (§1e). `AGENTS.md`'s subagent rule is a reasoned constraint. `lumina/CLAUDE.md:5` is one reasoned marker in a 9-line file.
- Numbered phases in skills are real order dependencies (typecheck after edit, publish after lineage-check), not §1c choreography for judgment.

---

## Proposed diff (Step 6)

One hunk per finding. Gemini files receive model-ID edits only.

### Hunk 1 — H1, H2, H3, M10: `backend/app/services/anthropic.py`

```diff
@@ class AnthropicService(BaseAIService):
     def __init__(self):
         self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
-        #self.model = "claude-3-5-haiku-20241022"
-        self.model = "claude-3-7-sonnet-20250219"
+        self.model = "claude-opus-5"
+
+    @staticmethod
+    def _text_of(response) -> str:
+        # Thinking is on by default on Claude Opus 5, so content[0] is usually a
+        # thinking block. Collect the text blocks; surface a refusal instead of
+        # returning an empty string.
+        if response.stop_reason == "refusal":
+            raise RuntimeError(f"Claude declined the request: {response.stop_details}")
+        return "".join(b.text for b in response.content if b.type == "text").strip()
 
     async def generate_response(
@@
-            response = await self.client.messages.create(
-                model=self.model,
-                max_tokens=2048,
-                messages=prompt if isinstance(prompt, list) else [{"role": "user", "content": prompt}],
-                system=system_instructions if system_instructions else "You are a friendly and encouraging kindergarten tutor.",
-                # Add this line to fix the temperature setting:
-                temperature=0.6
-            )
-            return response.content[0].text.strip()
+            response = await self.client.messages.create(
+                model=self.model,
+                max_tokens=16000,
+                messages=prompt if isinstance(prompt, list) else [{"role": "user", "content": prompt}],
+                system=system_instructions if system_instructions else "You are a friendly and encouraging kindergarten tutor.",
+            )
+            return self._text_of(response)
@@ async def summarize_session
             # Always use haiku for summaries for performance
-            session_model = "claude-3-5-haiku-20241022"
+            session_model = "claude-haiku-4-5"
@@
             response = await self.client.messages.create(
                 model=session_model,
-                max_tokens=600,  # Shorter summary
+                max_tokens=1024,
                 messages=messages,
                 system=system_instructions,
                 temperature=0.3  # Lower temperature for more consistent summaries
             )
-            
-            return response.content[0].text.strip()
+            return self._text_of(response)
```

Alternative the user may prefer: since `DEFAULT_AI_SERVICE="gemini"` and this class is only reached as the review fallback, retire the class and point `DEFAULT_AI_REVIEW_SERVICE` at `gemini`. That is a product decision, so the diff makes the file valid instead.

### Hunk 2 — H4: `backend/app/services/review.py`

```diff
@@ -29
-            self.model_id = 'gemini-2.5-flash-preview-05-20'
+            self.model_id = 'gemini-flash-latest'
```

### Hunk 3 — H5: `backend/app/services/gemini_read_along.py`

```diff
@@ -100
-                    model="models/gemini-2.0-flash-exp",
+                    model="models/gemini-3.1-flash-lite-image",
```

`backend/app/services/llm_briefing_content_selector.py` has no importer: `git rm` it. If it is kept, replace `gemini-2.0-flash-exp` (375, 417) with `gemini-flash-latest` and `gemini-2.5-flash-lite-preview-06-17` (244, 407, 416) with `gemini-flash-lite-latest`.

### Hunk 4 — H6: the same ID in six files

```diff
--- backend/app/generators/practice_problems.py (156, 289)
--- backend/app/generators/reading_content.py (56, 113)
--- backend/app/schemas/reading_content.py (154)
--- backend/app/services/ai_assessment_service.py (199)
-                model='gemini-2.5-flash-preview-05-20',
+                model='gemini-flash-latest',
--- backend/app/generators/content.py
@@ -161
-    generated_by: str = Field(default="gemini-2.5-flash-preview-05-20")
+    generated_by: str = Field(default="gemini-flash-latest")
```

`backend/app/p5js metadata.py` cannot be imported (space in the module name) — delete it or rename it; the ID edit alone does nothing.

### Hunk 5 — H7: `CLAUDE.md:89`

```diff
-**Draft-first rule:** NEVER edit `curriculum_published` directly. All curriculum changes go through: edit draft → `lineage-check` → publish → deploy. The publish pipeline in `draft_curriculum_service.py` is the ONLY writer to `curriculum_published`.
+**Draft-first rule:** NEVER edit `curriculum_published` directly. All curriculum changes go through: edit draft → `lineage-check` → publish. `publish` is one atomic call that also deploys and publishes edges; there is no `/deploy` endpoint. The publish pipeline in `draft_curriculum_service.py` is the ONLY writer to `curriculum_published`.
```

### Hunk 6 — H8: `backend/app/main.py:7` + dead endpoint

```diff
 from .api.endpoints import (
-    auth, competency, curriculum, problems, learning_paths, gemini, analytics,
+    auth, competency, curriculum, problems, learning_paths, analytics,
```

Then `git rm backend/app/api/endpoints/gemini.py` (921 lines, never mounted).

### Hunk 7 — M1: `CLAUDE.md:35` and `.claude/skills/primitive/SKILL.md:42`

```diff
--- CLAUDE.md
-When building new primitives, always use the Gemini generator pattern — never hardcode test data. Follow the established registration pattern: component, types, catalog entry, generator, and tester. Follow the `ADDING_PRIMITIVES.md` checklist exactly. Create all files before moving to verification.
+When building new primitives, always use the Gemini generator pattern — never hardcode test data. Follow the established registration pattern: component, types, catalog entry, generator, and tester. `/primitive` is the executable checklist; `ADDING_PRIMITIVES.md` is the human reference behind it, not a second list to follow. Create all files before moving to verification.
--- .claude/skills/primitive/SKILL.md
-**DO NOT read `ADDING_PRIMITIVES.md` or `ADDING_TUTORING_SCAFFOLD.md`** — those are 1500+ lines of reference docs meant for humans. Everything you need is in this skill file.
+**Do not read `ADDING_PRIMITIVES.md` or `ADDING_TUTORING_SCAFFOLD.md` during this skill** — they are long reference docs written for humans, and this skill is their executable form.
```

### Hunk 8 — M2: `.claude/skills/curriculum-author/SKILL.md`

```diff
@@ -45
-> **CRITICAL — grade is now required on every publishing/graph read.** The grade-scoping refactor added a required `grade` query param. Every `publishing/*` and `subjects/{id}/knowledge-graph` call needs `?grade=X` (e.g. `?grade=2`). Calls without it return HTTP 422 `Field required: query.grade`.
+> **Every `publishing/*` and `subjects/{id}/knowledge-graph` call takes a required `grade` query param** (e.g. `?grade=2`). Calls without it return HTTP 422 `Field required: query.grade`.
@@ -47
-> **There is NO `/deploy` endpoint.** `publish` is a single atomic operation that copies drafts to `curriculum_published`, sets `is_draft=false` on edges, and updates the version record. The backend JIT-flattens the graph on first read — no separate deploy, no flatten call. (Older docs describing a two-step publish→deploy are stale and will 404 on `/deploy`.)
+> **`publish` is the whole release.** It copies drafts to `curriculum_published`, sets `is_draft=false` on edges, and updates the version record; the backend JIT-flattens the graph on first read. There is no `/deploy` or flatten call.
@@ -124
-**IMPORTANT:** One atomic call. `publish` already deploys to `curriculum_published` and publishes edges. Do NOT call a `/deploy` endpoint — it no longer exists and returns 404. Publish also triggers a non-blocking BQ sync in the background.
+One atomic call: `publish` writes `curriculum_published`, publishes edges, and starts a non-blocking BQ sync. There is no `/deploy` endpoint.
@@ -385
-**IMPORTANT:** Use `/api/agent/` not `/api/graph-agent/` — the latter returns 404.
+The route prefix is `/api/agent/`.
```

### Hunk 9 — M3: `.claude/skills/student-data-loop/SKILL.md`

```diff
@@ -71
-### 4. L2 read model (the 2026-07-02 slice)
+### 4. L2 read model
@@ -219
-## Grade of Record — students/{id}.grade_level (added 2026-07-04)
+## Grade of Record — students/{id}.grade_level
@@ -261
-**Removed 2026-07-03** (deleted in the lesson-entry-contract slice):
+**Removed — do not resurrect:**
@@ -334,335
-- Frontend: tsc baseline 1101 as of 2026-07-03 (`./node_modules/.bin/tsc
-  --noEmit`); dropped from 1417 when the dead `archive/` folders were deleted.
+- Frontend: run the tsc line from CLAUDE.md **Commands** and compare against the
+  count before your change; `typecheck:lumina` must stay at 0 (`/ship` owns the gate).
@@ -337
-## Known Rough Edges (checked 2026-07-02)
+## Known Rough Edges
@@ -344,345
-  frontend `getRecommendations` and `GET /ai-recommendations` were removed
-  2026-07-03; the BigQuery endpoint survives only for legacy routes.
+  frontend `getRecommendations` and `GET /ai-recommendations` are gone; the
+  BigQuery endpoint survives only for legacy routes.
```

Apply the same date-drop to lines 143, 159, 182, 193, 228, 246 (`CONVERGED 2026-07-03:` → `Converged:`; `shipped 2026-07-03` → `shipped`; `As of 2026-07-04 the daily` → `The daily`).

### Hunk 10 — M4: interpreter path

```diff
--- .claude/skills/student-data-loop/SKILL.md
@@ -325,327
-- Python: `C:\Users\xbox3\miniforge-pypy3\envs\py311env\python.exe` for
-  py_compile / `import app.main` / pytest (67 pass baseline; 10
-  test_planning_service failures + test_dag_analysis import are pre-existing).
+- Python: `backend/venv/Scripts/python` (the interpreter in CLAUDE.md **Commands**) for
+  py_compile / `import app.main` / pytest. Compare failures against the run before
+  your change, not a remembered count.
--- .claude/skills/topic-trace/SKILL.md
@@ -46
-cd backend && /c/Users/xbox3/miniforge-pypy3/envs/py311env/python -c "
+cd backend && venv/Scripts/python -c "
```

### Hunk 11 — M5: `.claude/skills/add-di-loop/SKILL.md`

```diff
@@ -185
-**This is the instruction this skill got wrong, so read it before you reach for a menu.** The old text told you a blocked class "gets closed by on-screen cards" — it stood through eleven ports, and letter-spotter is where it did real damage: all three modes tapped, and a five-year-old sat through a DI session with nothing to say, in front of a mic orb reading "I'm listening". A blocked or awkward class means the JUDGE has a problem. It says nothing about what the child should do.
+**A blocked or awkward response class means the JUDGE has a problem. It says nothing about what the child should do.** Closing a blocked class with on-screen cards is the failure to avoid: on letter-spotter it left all three modes tapped and a five-year-old with nothing to say, in front of a mic orb reading "I'm listening".
@@ -222
-`submitGestureAttempt` is the easy half; deciding WHEN to call it is the design, and this skill used to say nothing because the first two ports never had to ask. Their shapes handed them the answer: cvc-speller's third letter fills the last slot, counting-board's single tap IS the whole answer. Ten-frame's `build` broke that — ten cells, a target of five, **no terminal state** — leaving only a button (deleted by doctrine) or the voice (unbenched for a placement).
+`submitGestureAttempt` is the easy half; deciding WHEN to call it is the design. Some shapes hand you the answer (cvc-speller's third letter fills the last slot; counting-board's single tap IS the whole answer). Ten-frame's `build` does not — ten cells, a target of five, **no terminal state** — leaving only a button (deleted by doctrine) or the voice (unbenched for a placement).
@@ -263
-One pure `__tests__/<Primitive>.di-script.test.ts`. **The plumbing is one import now — do not re-type it** (12 files hand-copied it and grew three divergent spoken-line parsers before `hooks/judgedScriptContract.testkit.ts` existed): `expect(checkPackGates(pack)).toEqual([])`
+One pure `__tests__/<Primitive>.di-script.test.ts`. **Import the plumbing from `hooks/judgedScriptContract.testkit.ts`; never re-type it** — hand copies drift (they once produced three divergent spoken-line parsers): `expect(checkPackGates(pack)).toEqual([])`
```

### Hunk 12 — M6: `.claude/skills/primitive-contract/SKILL.md:152-160`

```diff
-The old Phase 2b emitted a G-series wishlist per contract and said outright that
-"gaps are the contract's queue-feeding surface." It worked exactly as written, which
-was the problem: **9 contracts emitted 26 gaps (20 still open)**, and at that rate
-deriving contracts across the catalog manufactures ~500 open items by construction.
-The yield was poor — a coin-counter audit found 5 of its 6 gaps read as open queue
-items but only ~1.5 had real value (the rest were narrow, failure-path-only, or not
-primitive work at all). Worse, a well-specified gap list is the cheapest thing for a
-session to pull, so the most-worked primitive kept winning pulls regardless of demand
-([[worked-primitives-self-select]]).
+Why: a contract that also emits a gap list manufactures open items by construction,
+most of them narrow, failure-path-only, or not primitive work at all — and a
+well-specified gap list is the cheapest thing for a session to pull, so the
+most-worked primitive keeps winning pulls regardless of demand
+([[worked-primitives-self-select]]).
```

### Hunk 13 — M7: `.claude/skills/tutor-test/SKILL.md:82`

```diff
-It used to mean a mic sitting; it is now machine-driven.
+It is machine-driven (`--di`); no mic sitting is required.
```

### Hunk 14 — M8: `.claude/skills/add-voice-control/SKILL.md:136`

```diff
-- **Don't** recreate `useSpokenTurn`-style windows/dormancy-strikes — that shape was ruled out and deleted 2026-07-05.
+- **Don't** recreate turn windows or dormancy strikes (the deleted `useSpokenTurn` shape) — the open-mic ruling replaces them ([[open-mic-over-turn-windows]]).
```

### Hunk 15 — M9: `.claude/skills/primitive/SKILL.md`

```diff
@@ -299
-**IMPORTANT — Required Fields Manifest:** Before proceeding to Phase 3, create a structured list like this:
+**Required Fields Manifest.** Before Phase 3, create a structured list like this:
@@ -316
-**IMPORTANT: The generator is NOT built here.** It gets its own focused phase next.
+The generator is not built here; it gets its own phase next.
@@ -517
-**CRITICAL SCHEMA RULES:**
+**Schema rules:**
```

### Hunk 16 — M12: skill frontmatter (pattern; four examples)

```diff
--- .claude/skills/primitive/SKILL.md
+---
+name: primitive
+description: >-
+  Birth a new Lumina primitive at L0 — component, types, catalog entry, Gemini
+  generator, and tester — in phases. Use when a curriculum demand has no primitive
+  or the user asks to build, scaffold, or add a visual primitive. Not for raising an
+  existing primitive's layer (the /add-* skills) or kit migration (/migrate-primitive).
+---
 # Add New Lumina Primitive
--- .claude/skills/ship/SKILL.md
+---
+name: ship
+description: >-
+  Turn the working tree into verified, sliced, pushed commits and keep main fresh.
+  Use when the user says ship, commit, or push, or asks what is uncommitted. Runs the
+  typecheck gates before slicing and never commits over a red typecheck:lumina.
+---
 # Ship — Verify, Slice, Commit, Push
--- .claude/skills/pm/SKILL.md
+---
+name: pm
+description: >-
+  Portfolio reconciliation and planning over WORKSTREAMS.md and the owning queues:
+  pull the top item of an active stream, file a new finding with its executor skill,
+  or close work in the queue. Use for "what's next", queue updates, and reconciling
+  stale reports against queues.
+---
 # PM — Portfolio Reconciliation & Planning
--- .claude/skills/tutor-test/SKILL.md
+---
+name: tutor-test
+description: >-
+  Verify a primitive's tutoring scaffold reaches the Gemini Live tutor intact —
+  catalog block, {{key}} interpolation, and with --di the judged loop — driven
+  headlessly. Use after wiring or editing a tutoring block, or when the tutor goes
+  silent or off-script on one primitive.
+---
 # Tutor Test — Verify the AI Tutoring Connection for a Primitive
```

Apply the same shape (what it does, when to use, when not to) to the remaining 25 skills without a `description`.

---

## Verification plan (Step 7)

- Hunks 1-4: exercise the flow, not the type check. Submit one drawn answer through `assessments` and confirm the primary Gemini path returns a review (no `_fallback_review` log line). Force the fallback once (temporarily bad Gemini key) and confirm the Anthropic path returns text.
- Hunk 6: `venv/Scripts/python -c "import app.main"` after the import edit, then boot uvicorn.
- Hunks 5, 7-16: read-only docs. Grep the tree for `/deploy`, `graph-agent`, `miniforge`, and `1500+` after applying so no other file still carries the removed claim.
- Out-of-band dependency check done: no test, classifier, or log parser matches on any of the removed strings.
