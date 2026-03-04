# Evaluation Pipeline Architecture

## Problem Statement

The evaluation pipeline has a **subskill ID reliability problem**. When a lesson or problem originates from the curriculum service, we have the canonical `subject/skill_id/subskill_id` metadata — but it gets lost at multiple handoff points, causing:

1. **Hallucinated IDs**: Gemini invents plausible-looking subskill IDs (e.g., `SCI.K.01.01`) that don't exist in the curriculum graph
2. **Fallback ID cascades**: When the frontend doesn't provide real IDs, the backend falls back to `{primitive_type}_skill` / `{primitive_type}_subskill`, which then triggers the `CurriculumMappingService` AI-based guesser — a slower, less reliable path
3. **Data fragmentation**: Mastery lifecycle docs end up with mismatched IDs — diagnostic uses curriculum graph IDs (`SCI001-03-A`), practice uses Gemini-hallucinated IDs (`SCI.K.01.01`), and some use fallback IDs (`knowledge-check_subskill`)

## Current Pipeline (Data Flow Trace)

### The Happy Path (Daily Session Driver)

This is the ONE path where IDs flow correctly end-to-end:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. DailyLessonPlan loads blocks from /api/daily-activities             │
│    Each block has: { subject, subskills: [{ subskill_id }] }          │
│                                                                        │
│ 2. App.tsx handleBlockStart() extracts IDs:                            │
│    const subskillId = block.subskills[0].subskill_id   // "RF.K.2.C" │
│    const skillId = subskillId.substring(0, lastDot)     // "RF.K.2"   │
│    setCurriculumContext({ subject, skillId, subskillId })              │
│                                                                        │
│ 3. EvaluationProvider receives as props:                               │
│    curriculumSubject={curriculumContext.subject}                       │
│    curriculumSkillId={curriculumContext.skillId}                       │
│    curriculumSubskillId={curriculumContext.subskillId}                 │
│                                                                        │
│ 4. usePrimitiveEvaluation resolves IDs:                                │
│    resolvedSkillId = skillId || context.curriculumSkillId              │
│    resolvedSubskillId = subskillId || context.curriculumSubskillId    │
│                                                                        │
│ 5. evaluationApi.convertToProblemSubmission sends:                     │
│    { skill_id: "RF.K.2", subskill_id: "RF.K.2.C", subject: "Reading"}│
│                                                                        │
│ 6. Backend submission_service receives real IDs                        │
│    → competency_service gets correct subskill_id                       │
│    → mastery_lifecycle_engine writes correct doc                       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Why this works**: The daily session planner reads subskill IDs from Firestore (canonical source), passes them through `curriculumContext` state → `EvaluationProvider` props → `usePrimitiveEvaluation` fallback resolution → backend submission.

### The Broken Paths

#### Practice Mode (PracticeModeEnhanced.tsx)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. User picks subject + quest → generatePracticeManifestAndHydrate     │
│    Topic string: "Addition within 20"                                  │
│    ❌ NO curriculum IDs available — quest is Gemini-generated          │
│                                                                        │
│ 2. EvaluationProvider wraps with: localOnly={true}                     │
│    ❌ No curriculumSkillId / curriculumSubskillId props                │
│                                                                        │
│ 3. usePrimitiveEvaluation resolves:                                    │
│    resolvedSkillId = undefined || undefined → undefined                │
│    resolvedSubskillId = undefined || undefined → undefined             │
│                                                                        │
│ 4. evaluationApi.convertToProblemSubmission:                           │
│    skill_id = undefined || `${primitiveType}_skill`    // FALLBACK     │
│    subskill_id = undefined || `${primitiveType}_subskill` // FALLBACK  │
│    subject = 'auto'                                    // TRIGGERS AI  │
│                                                                        │
│ 5. Backend: detects fallback IDs → CurriculumMappingService           │
│    AI guesses: "SCI.K.01.01" — may or may not exist in curriculum     │
│    → mastery_lifecycle doc created with hallucinated ID                │
└─────────────────────────────────────────────────────────────────────────┘
```

**Note**: Practice mode currently uses `localOnly={true}` so evaluations don't reach the backend. But when `localOnly` is removed (for real tracking), this path will produce garbage IDs.

#### Diagnostic Placement (DiagnosticSession.tsx)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Backend sends ProbeRequest with canonical IDs:                      │
│    { subskill_id: "SCI001-03-A", subject: "Science", ... }           │
│                                                                        │
│ 2. Frontend generates practice items via Gemini:                       │
│    generatePracticeManifestAndHydrateStreaming(probe.description, ...) │
│    ❌ Gemini doesn't know about probe.subskill_id                     │
│                                                                        │
│ 3. EvaluationProvider wraps with: localOnly={true}                     │
│    ❌ No curriculumSkillId / curriculumSubskillId props                │
│                                                                        │
│ 4. Probe results submitted via diagnosticApi.submitProbeResult         │
│    ✅ Uses correct probe.subskill_id ("SCI001-03-A")                  │
│    ✅ Backend correctly classifies and seeds mastery lifecycle          │
│                                                                        │
│ 5. BUT: if localOnly were removed, individual item evals would         │
│    submit with hallucinated IDs from Gemini-generated content          │
└─────────────────────────────────────────────────────────────────────────┘
```

**The diagnostic probe-result path works** because it bypasses the evaluation pipeline entirely and calls a dedicated API. But the individual practice items don't carry the probe's canonical IDs.

#### Exhibit Mode (CurriculumBrowser → Generate → Play)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. CurriculumBrowser provides: { subject, skillId, subskillId }       │
│    ✅ Canonical IDs from curriculum service                            │
│                                                                        │
│ 2. App.tsx passes to EvaluationProvider:                               │
│    curriculumSubject={curriculumContext.subject}                       │
│    curriculumSkillId={curriculumContext.skillId}                       │
│    curriculumSubskillId={curriculumContext.subskillId}                 │
│                                                                        │
│ 3. Works correctly — same as daily session path                        │
│    ✅ Real IDs flow through to backend                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## Root Cause Analysis

The system has **three separate ID resolution strategies** with no unified contract:

| Strategy | Source | Reliability | Used By |
|---|---|---|---|
| **Explicit curriculum IDs** | Firestore curriculum graph → EvaluationProvider props | Reliable | Daily session, CurriculumBrowser exhibits |
| **AI curriculum mapping** | CurriculumMappingService on backend | Unreliable (hallucinated IDs) | Practice mode fallback, any submission without explicit IDs |
| **Diagnostic probe IDs** | DAG analysis engine | Reliable | Diagnostic placement (probe-result endpoint only) |

The fundamental issue: **curriculum context is set at the session/provider level, not at the item level.** The `EvaluationProvider` has ONE set of `curriculumSkillId` / `curriculumSubskillId` for the entire session. But a session may contain items from multiple subskills (e.g., a diagnostic probe tests one subskill, then the next probe tests a different one).

## Recommended Fix: `useCurriculumContext` Hook

### Design Principle

**Every renderable item should carry its own curriculum metadata.** Instead of relying on a session-level context that may or may not be set, embed the canonical IDs directly in the item data that flows to the renderer.

### Implementation: Three-Layer Resolution

```
Layer 1 (Item-level):    item.curriculumIds?.subskillId     ← most specific
Layer 2 (Context-level): EvaluationProvider.curriculumSubskillId  ← session-level
Layer 3 (Fallback):      CurriculumMappingService AI guess   ← backend last resort
```

### Concrete Changes

#### 1. Extend `HydratedPracticeItem` with curriculum metadata

```typescript
// types.ts — add to HydratedPracticeItem
export interface CurriculumIds {
  subject: string;
  skillId: string;
  subskillId: string;
  source: 'curriculum' | 'planner' | 'diagnostic' | 'inferred';
}

export interface HydratedPracticeItem {
  manifestItem: PracticeManifestItem;
  visualData?: any;
  problemData?: ProblemData;
  curriculumIds?: CurriculumIds;  // ← NEW: item-level IDs
}
```

#### 2. Stamp curriculum IDs at hydration time

Whoever creates a `HydratedPracticeItem` must attach `curriculumIds` if they know the canonical source. This happens in three places:

**Daily Session Driver** (App.tsx `handleBlockStart`):
```typescript
// Already has block.subskills — stamp onto each item
hydratedItems.forEach(item => {
  item.curriculumIds = {
    subject: block.subject,
    skillId: derivedSkillId,
    subskillId: block.subskills[0].subskill_id,
    source: 'planner',
  };
});
```

**Diagnostic Session** (useDiagnosticSession.ts):
```typescript
// Probe carries canonical IDs — stamp onto generated items
const items = await generateProbeItems(probe);
items.forEach(item => {
  item.curriculumIds = {
    subject: probe.subject,
    skillId: probe.skill_id,
    subskillId: probe.subskill_id,
    source: 'diagnostic',
  };
});
```

**Practice Mode** (PracticeModeEnhanced.tsx):
```typescript
// No canonical IDs available — leave undefined
// Backend will use CurriculumMappingService as last resort
```

#### 3. `PracticeManifestRenderer` passes IDs to evaluation

```typescript
// PracticeManifestRenderer.tsx — when building evaluation props
const mergedData = {
  ...innerData,
  instanceId: manifestItem.instanceId,
  onEvaluationSubmit: handleVisualEvaluation,
  allowInteraction: true,
  // NEW: pass curriculum IDs so usePrimitiveEvaluation can use them
  skillId: item.curriculumIds?.skillId,
  subskillId: item.curriculumIds?.subskillId,
};
```

#### 4. `usePrimitiveEvaluation` resolution order stays the same

The hook already resolves `skillId || context.curriculumSkillId`. With item-level IDs now flowing through, the resolution becomes:

```
1. Component prop (item.curriculumIds.subskillId via data.subskillId)
2. EvaluationProvider context (session-level fallback)
3. undefined → backend CurriculumMappingService (last resort)
```

### Migration Path

1. **Add `CurriculumIds` type** — no breaking changes
2. **Stamp IDs in diagnostic probe generation** — immediate fix for the diagnostic pipeline
3. **Stamp IDs in daily session driver** — already partially done (line 412-424 of App.tsx), extend to item level
4. **Update `PracticeManifestRenderer`** to read `item.curriculumIds` and pass to primitives
5. **Practice mode** — remains without IDs until we have a curriculum-aware quest system

### What This Fixes

| Scenario | Before | After |
|---|---|---|
| Diagnostic probe item | No IDs → fallback | Probe's canonical `subskill_id` stamped on each item |
| Daily session lesson item | Session-level IDs (first subskill only) | Per-item subskill IDs |
| Practice mode item | No IDs → AI hallucination | Same (no canonical source yet) |
| CurriculumBrowser exhibit | Session-level IDs | Item-level IDs (from curriculum context) |

### Future: Eliminating the AI Fallback

The `CurriculumMappingService` should be a **diagnostic tool**, not a production path. Once all entry points stamp canonical IDs:

1. Daily session → planner provides IDs ✅
2. Diagnostic → probe provides IDs ✅ (after fix)
3. CurriculumBrowser → user selected IDs ✅
4. Practice mode → needs curriculum-aware quest generation (future work)

When practice mode is wired to the curriculum (quests generated from the prerequisite graph instead of free-form Gemini), ALL paths will have canonical IDs and the AI fallback becomes truly a fallback, not the norm.
