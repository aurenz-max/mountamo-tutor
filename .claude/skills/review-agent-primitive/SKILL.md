---
name: review-agent-primitive
description: >-
  Review one agent primitive (or the current diff, or every agent author) against the agent kit and the /agent-primitive
  invariants — one loop, the look stage, the run record, displays, levers, computed keys and difficulty, shortcuts, open
  content, what the child produces, teaching quality measured against deep-dive (plan as contract, capability reach, a
  blind reader in the child's order, a teacher's read), ratchets and verification — and name the exact change each gap needs. Use after any
  agent-primitive work (/agent-primitive, a new block, a port onto the kit) or before building a new subject author.
  Read-only: fixes go through /agent-primitive; tutor wiring is /review-live-wiring.
---

# Review agent primitive

Checks that an agent primitive is built the one way the kit allows, and names the change for every place it is not. It
exists so a lesson learned on one agent primitive is not learned again on the next (USER 2026-11-08). The rules are in
`.claude/skills/agent-primitive/SKILL.md`; read it first. The guard test
`my-tutoring-app/src/components/lumina/service/agent-kit/agentKit.guard.test.ts` is the authority: where this skill and
the test disagree, the test is right and this skill is stale (fix the skill).

**Deep-dive is the reference for teaching quality (USER 2026-11-09):** the lowest-slop agent primitive and the widest in
what it can show and ask. A primitive can pass every harness item and still be slop, so items 19-25 hold every agent
primitive to what deep-dive does. Before judging them, read `service/core/deep-dive-agent/`: `agent-prompt.ts` (what good
is), `lesson.ts` (the outline contract and shapes), `review.ts` (the reader), `blocks.ts` (the block tools and counted checks).
Two limits on that:
- It is the reference for items 19-25 only. Deep-dive still owes the kit port, look stage and run record (DD-16), levers
  (DD-8), computed difficulty and one catalog mode. Report those as CHANGE; its quality does not excuse them.
- Its outline contract, in-order reader and shapes live only in its own files. When another primitive needs one, the
  change is to move it into the kit (a Framework gap), never to copy it (I14, I16).

**Arguments:** `/review-agent-primitive <primitive-id>` · `/review-agent-primitive changed` (every agent author the
working tree touches) · `/review-agent-primitive all` (one row per author). Read-only. Free: no model calls.

## 1. Gather (free)

```bash
cd "<abs>/my-tutoring-app" && npm test -- src/components/lumina/service/agent-kit
cd "<abs>/my-tutoring-app" && npm run test:primitive -- <id>
```

Then read the author (`service/**/agent-<x>.ts`), its checks and world module, its component, boss and workspace, its
catalog entry, the newest saved payload's `agentDebug` (`run`, `look`, `events`, `advisories`), and
`docs/contracts/<id>.md` if it exists. For `all`, list authors with: grep `runAuthor<|runItemLoop\(` plus `LEGACY` in the
guard test.

## 2. The checklist

Give each item a verdict: **PASS**, **CHANGE** (state the edit: file, what goes, what replaces it), or **N/A** (why).

**The harness (one way to run)**

1. **One loop (I14).** The author calls `runAuthor` or `runItemLoop`, and is not in `LEGACY`. No `functionDeclarations`
   in the primitive's files. A primitive-level retry, deadline or status echo is a CHANGE: the loop owns those.
2. **Look stage.** A `runAuthor` author gives `look` (`grade`, `view`). `view` returns the child's first screen with no
   key: ask, HTML through `childPage`, the same screen in words, and `design` when the activity allows something a
   reader would call a shortcut. A hand-written blind reader or screenshot path in the primitive is a CHANGE: it moves
   to the stage. **Where the primitive's reader does more than the stage, the CHANGE is to raise the stage first:** a port
   never lowers what the child gets (deep-dive's reader judges the whole lesson in order; `readView` reads one screen).
   An entry in `NO_LOOK` needs a reason that is still true.
3. **The view is honest.** Print one view for a saved payload and open the image. A shuffled bench is shown as it ships,
   and everything the child reads is present. State what the view leaves out (life-lab: its beak, foot and moth drawings).
4. **Run record.** A real payload's `agentDebug.run` has the cost, seconds, rounds and look counts. `look.ran` is true,
   `look.unread` is 0 or explained, and `look.skipped` is absent. If the look is skipped for time, the budget is a CHANGE.
5. **Displays (I15).** The author passes `displays` to the record and has a `DisplayCapability` with all eight wiring
   steps from `/agent-primitive`. Entries in `NO_DISPLAYS` need a reason that is still true. `svg` is on a menu only if
   the author sees its drawing.
6. **Levers (I13).** Authored in the item's own fields through `LeverCapability`. A lever menu or a per-mode lever table
   in app code is a CHANGE. A real item carries a help that changes the screen and a simplify that lowers the score.

**The agent's freedom**

7. **Teaching decisions (I1).** Fill the decision table: at least two non-wording rows belong to the agent.
8. **World and goal (I3).** No writer per mode and no task enum. Grep the tool schema. One writer per kind of block is
   a palette the agent composes and passes (deep-dive's `write_chart`, `write_mini_sim`).
9. **Open content (I12).** Every enum in the schema is structure (a rule kind, a goal kind) or a CHANGE. A content list
   is a cache and never refuses an id. A fact code cannot compute goes to an independent reader.
10. **Breadth (I2).** A `*.coverage` or fixture row per claimed standard passes every check.

**What code owns**

11. **Key (I4).** No tool field names the right option where code can compute it. The validator re-derives the key.
12. **Shortcuts (I5).** A solver asks how a child wins without the skill. Each rule has a test that builds the shortcut.
13. **Difficulty (I6).** Computed from structure and returned with every write. A tier miss blocks while the budget
    lasts. A test builds every kind of item at easy, medium and hard.
14. **Variety (I7).** A session-level rule, with a test.
15. **Objective in, label out (I9).** The author takes the topic or objective and is not in `MODE_INPUT`. One catalog
    mode. Code reads the skill and standards from the finished item as a label, and a label never refuses an item. The
    look stage has an `objective`. A second eval mode, or a pin that limits what the agent may build, is a CHANGE.
16. **Bounds (I10).** Ranges come from the lesson. Read any decline in a real run for what it exposes.
17. **What the child produces (I11).** A production field per item, one pure `<x>Spoken` module, no key or miss in the tool.
    Then run `/review-live-wiring <id>` for the boss wiring: this skill does not repeat it.
18. **Three faces (I8).** Every block renders and grades, can be built by a tool, and is described to the tutor with no key.

**Teaching quality (deep-dive is the reference)**

19. **Plan as contract (I17).** The agent states the key ideas first, and each part names what it teaches or tests. Code
    refuses an idea nothing teaches, a check before its teaching and a section that only checks, each with a test. When
    parts build on each other, one author sees them all. A primitive that only practises is N/A on teaching order, but
    says what taught the skill and names what each item practises.
20. **Capability reach (I18).** Table what the agent can show and what the child can do, marked used or unused in real
    runs. A topic the catalog claims that needs a missing capability is a CHANGE (add it to the kit). The prompt says
    what good output is, with a test for it, and when each capability fits. When nothing fits, the agent can record the
    need and teach with what exists.
21. **Reader in the child's order (I19).** A blind reader meets the work as the child does: in sequence, with what is
    hidden until answered hidden, and no key. It answers, and code compares. It reports what cannot be answered from what
    came before, what is given away, wrong options no child would pick and essential ideas left out. Reader rounds are
    capped, and what remains ships as an advisory. A reader that sees only one screen at a time is a CHANGE when parts
    build on each other.
22. **Runs differ (I20).** Code varies what the agent is offered per run and the agent chooses the fit, with an "own"
    option. Run several generations on one topic, or read saved ones: the same structure each time is a CHANGE.
23. **Counted checks (I21).** Code counts what it can on every field the child reads: sentence length for the grade,
    math that renders, arithmetic that is true. Wrong options are written apart from the answer and code orders them.
24. **Spending and failure (I22).** Slow work starts only after a part passes its checks. A part that cannot build is
    dropped and reported, never shipped blank. The author is told its time budget. A loop change has before and after
    numbers on fixed topics.
25. **A teacher's read.** Read one saved generation top to bottom, as a teacher choosing whether to use it. Name each
    part that exists only for variety, repeats an earlier part, is true but teaches nothing, or could be answered without
    the idea. Each finding is a CHANGE, and a finding that recurs becomes a check or a reader rule (I16). Passing the
    code checks is not a pass here.

**Closing**

26. **Ratchets.** `LEGACY`, `NO_DISPLAYS` and `NO_LOOK` only shrink. A change that moved an author removes its entries
    in the same slice.
27. **Verification.** Kit tests and `test:primitive` green; `typecheck:lumina` 0; one real generation read item by item
    (report the spend from `agentDebug.run.costUsd`). Live stays with the user: ask only under `/review-live-wiring` item 13.

## 3. Report

One table per primitive: `# | item | verdict | change`. Then:
- **Next executor:** `/agent-primitive <id>` for the build, `/add-live-tutor-tools <id>` for tutor mechanics, `/eval-fix`
  for content. If the user asked for the fix in the same request, run the executor yourself; otherwise queue it (`/pm`).
- **Framework gaps:** a lesson that lives only in one primitive, or only as a sentence in a skill. **A lesson is closed
  when it is a kit stage or a guard** (USER 2026-11-08). Name the stage or guard it should become.

For `all`, one row per author: `author | loop | look | run record | displays | levers | teaching (19-25) | first change`, sorted by the
change that reaches the most authors. Keep it to the table and three lines of findings.
