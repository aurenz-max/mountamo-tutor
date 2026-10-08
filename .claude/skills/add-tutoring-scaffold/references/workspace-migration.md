# A `tutoring` block on a workspace primitive

The catalog `tutoring` block and the teaching workspace are two channels to the tutor. Only one of
them reaches a given session:

| Session | What the tutor receives | `tutoring` block |
|---|---|---|
| Unbound: the family declares no `teachingWorkspace`, or `workspaceBinding` refused this mount | `LuminaAIContext` sends the catalog `tutoring` block | live |
| Bound to the workspace (`lessonWorkspacePlan.ts`, `workspaceAdapter`) | `teachingWorkspace.guidance` + `WORKSPACE_DOCTRINE`, and the `liveRuntime` packet (task, scene facts, learner, levers) | sent as `tutoring: null`, dead |

So the block's status follows from how the component is exported:

| Export | Can a session be unbound? | The block |
|---|---|---|
| no `teachingWorkspace` in the catalog | always unbound | the tutor's only primitive-specific text. `/add-tutoring-scaffold` owns it. |
| `withWorkspaceOnly('<id>', ...)` | no: an unbound mount shows the needs-the-tutor card and opens no session | dead. Delete it. |
| `withWorkspaceController('<id>', ...)` | yes: the scripted fallback runs when the binding refuses (no pin match, not exactly one objective, empty pool) | live on that fallback. Keep it until the fallback is retired, then delete it. |

Read the component's export, not the catalog: both kinds declare `teachingWorkspace`. Census on
2026-10-04: 104 entries have only a block, 47 are workspace-only, 11 are controllers.

## Do not add a block to a workspace primitive

If the catalog entry declares `teachingWorkspace`, `/add-tutoring-scaffold` does not apply. A
workspace-only family needs no block at all. A tutor that sounds generic on the workspace path is
fixed in the workspace (task, scene facts, guidance, levers), never by adding scaffold text the
session does not receive.

## Delete the block when the family goes workspace-only

`/add-live-tutor-tools` deletes the block in the same slice that exports the family with
`withWorkspaceOnly` (WB-5, 2026-10-04: word-builder's runner block survived a month in the catalog
because W1 step 4 said to leave `tutoring` alone). Before deleting it, move anything still true
into the workspace:

| Scaffold field | Where it goes on the workspace | Rule |
|---|---|---|
| `taskDescription` | `workspaceAssignment(item).task` and `workspaceScene` facts | Code builds both per item; nothing is interpolated from `{{key}}`. |
| `contextKeys` | `workspaceScene(item, view).facts` | Facts state what is drawn and asked, never the answer, and a board count only where the board is the asked quantity. |
| `scaffoldingLevels` level 1-3 | levers (`/add-support-tiers`): help and simplify | A rung that changes only what the tutor says is not a lever. Drop text rungs. |
| `commonStruggles` | `teachingWorkspace.misses` (gesture) or the assignment's spoken `misses` | Name the wrong answer, not a scripted reply. The tutor chooses the response and the levers. |
| `aiDirectives`: domain rules (what is hidden, what never to say, what the tutor cannot do) | `teachingWorkspace.guidance` | Domain sentences only. 2000-char cap shared with the doctrine. |
| `aiDirectives`: protocol (`[XX_ITEM]`/`[XX_HEAR]` tags, "Say exactly", "Yes"/"My turn" openers, correction caps, "the application decides") | nothing | The observer commits outcomes and the runtime owns progression. These are runner sentinels; drop them. |
| `studentPrompts` | nothing, unless a consumer is verified on the bound path | `CuratorCompanion` reads them only from the catalog. |
| component `sendText('[TAG] ...')` moments | `commitGesture` / `commitCheck`, and the shared lifecycle's host messages | No per-moment narration trigger. A host-written non-silent message passes `author: 'host'`. |

Then:

1. Delete the block. Leave a short comment in its place: the date, the finding id, and where its
   rules now live.
2. Re-base any test that pinned the block's prose (`checkDiCatalogEntry`, scripted-correction rung
   tests, sentinel scans) to assert the block is absent. Log the re-base in the primitive's
   contract changelog (`docs/contracts/<id>.md`).
3. Run the primitive's tests, `components/live-activity`, `service/manifest`, and
   `typecheck:lumina`. A dead block reached no tutor, so deleting it needs no Live or replay run.
