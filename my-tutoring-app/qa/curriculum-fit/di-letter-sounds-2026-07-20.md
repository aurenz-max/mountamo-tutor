# Curriculum-Fit: di-letter-sounds — 2026-07-20

**Domain → Subject:** di (new family) → probed as LANGUAGE_ARTS (the primitive's
real subject: K phonics). The `di` catalog domain has no `subject_for_domain`
mapping yet; letter-sounds is Language Arts, so the probe ran against LA @ K.
**Query (embedded):** "Live-judged Direct Instruction for continuous letter SOUNDS (not letter names)…"

## Results

| Grade | Verdict | Best cosine | Coherence | Top match |
|-------|---------|-------------|-----------|-----------|
| K | ABSTAIN (diffuse) | 0.788 | 2/5 | LANGUAGE_ARTS…rng2mqi5w **"Letter-Sound Correspondence — Group 1: s, a, t, i, p, n"** |

Top-5 (all K Language Arts, all in the phonics cluster):
1. 0.788 Letter-Sound Correspondence — Group 1 (s, a, t, i, p, n)  ← the exact home
2. 0.772 Phoneme Isolation — beginning sound
3. 0.769 Onset-Rime Blending & Segmentation
4. 0.769 Letter-Sound Correspondence — Group 4 (j, z, w, v, y…)
5. 0.767 Phoneme Isolation — ending sound

## Diagnosis & Recommendation

**Effective verdict: HOME FOUND (healthy).** The mechanical verdict is "diffuse"
only because the coherence test wants ≥3/5 of the top-5 to share ONE skill family,
and K phonics is a dense cluster of closely-adjacent skills (Letter-Sound
Correspondence, Phoneme Isolation, Onset-Rime Blending) that a letter-sounds DI
primitive legitimately serves. The top-1 is the *correct concept* — "Letter-Sound
Correspondence" — at 0.788 (well above τ=0.60), and two of the top-5 are the two
Letter-Sound Correspondence groups. This is broad usefulness across the phonics
cluster, not homelessness.

- **NOT a curriculum gap** — the letter-sound skill exists and matches strongly.
- **NOT a thin description** — the correct concept is top-1.
- Matches the DI BACKLOG prediction ("K phonics — the STARVED GK band… should find
  real unmet demand"): multiple K letter-sound/phoneme skills route here.

**Action:** none required for birth. Follow-up (not blocking): add a
`subject_for_domain('di') → LANGUAGE_ARTS` mapping in the retrieval matcher so DI
primitives probe/attribute without the `--domain literacy` workaround. Route
student credit to **Letter-Sound Correspondence** (top-1) as the primary home.
