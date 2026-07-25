# Lumina — UI / Styling

Lumina has a UI kit at `my-tutoring-app/src/components/lumina/ui/` (glass aesthetic) — see `ui/index.ts` for the component list and `ui/tokens.ts` for design tokens.

**IMPORTANT: build primitive UI from the Lumina kit — not raw shadcn, not custom div patterns.** `/migrate-primitive` exists to move older raw-shadcn primitives onto the kit; never author new code that would need migrating.

**The kit is the frame only, never the interaction surface.** Headers, cards, buttons, feedback, counters, prompts come from the kit; the core manipulative (canvas, draggable objects, simulation) is bespoke per primitive.

For surfaces the kit doesn't cover, fall back to shadcn/ui with Lumina theming: glass `bg-slate-900/40 border-white/10 backdrop-blur-xl`, text `text-slate-100` (primary) / `text-slate-400` (secondary) / `text-slate-600` (muted).
