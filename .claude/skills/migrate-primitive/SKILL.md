# Migrate Lumina Primitive to shadcn/ui

This skill guides the migration of existing Lumina primitives from custom div-based styling to shadcn/ui components while preserving all functionality and maintaining Lumina theming.

## Required Reading

Before starting, read the full migration guide:
- `my-tutoring-app/src/components/lumina/docs/MIGRATING_TO_SHADCN.md`

## When to Use This Skill

Use this skill when:
- Migrating an existing Lumina primitive to use shadcn/ui components
- Reducing component complexity and line count
- Standardizing UI patterns across primitives
- Improving accessibility and keyboard navigation
- Simplifying maintenance by removing custom state management

**DO NOT use this skill for:**
- Creating new primitives (use the `primitive` skill instead)
- Migrating non-visual primitives with complex game logic
- Quick fixes or bug fixes to existing primitives

## Migration Benefits

**Before (custom code):**
- 500+ lines of manual styling
- Custom state management for accordions
- Inconsistent hover effects and transitions
- Difficult for LLMs to edit without breaking JSX
- Manual accessibility implementation

**After (shadcn/ui):**
- 60-100 lines for same functionality
- Built-in accessibility and animations
- Consistent patterns across all primitives
- Easier to maintain and extend
- Automatic keyboard navigation

## Step-by-Step Migration Workflow

### Phase 1: Preparation

1. **Ask the user which primitive to migrate**
   - Get the full file path or component name
   - Confirm the domain (astronomy, biology, physics, etc.)

2. **Read the current primitive**
   - Read the full component file
   - Identify custom patterns that need migration:
     - Container divs → Card components
     - Custom expandable sections → Accordion
     - Custom buttons → Button components
     - Custom labels/badges → Badge components
     - Manual hover handlers and inline styles

3. **Analyze complexity**
   - Count current lines of code
   - Identify state variables used for UI (especially expand/collapse state)
   - Note any custom event handlers that can be removed
   - Identify sections that can use Accordion

### Phase 2: Migration

4. **Create the migrated component**
   - Add shadcn/ui imports at the top:
     ```tsx
     import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
     import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
     import { Button } from '@/components/ui/button';
     import { Badge } from '@/components/ui/badge';
     import { Separator } from '@/components/ui/separator';
     ```

5. **Replace containers**
   - Convert outer container divs to Card components
   - Use CardHeader, CardTitle, CardDescription, CardContent for structure
   - Apply Lumina theming: `className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl"`

6. **Replace expandable sections**
   - Remove state: `const [expandedSection, setExpandedSection] = useState<string | null>(null);`
   - Remove toggle functions
   - Replace button + conditional content with Accordion
   - Set `defaultValue` for initially open section
   - Apply Lumina theming to AccordionItem and AccordionTrigger

7. **Replace buttons**
   - Convert all `<button>` elements to `<Button variant="ghost">`
   - Remove inline `style` props
   - Remove `onMouseEnter`/`onMouseLeave` handlers
   - Apply Lumina theming: `className="bg-white/5 border border-white/20 hover:bg-white/10"`

8. **Replace badges/labels**
   - Convert custom label divs to Badge components
   - Apply Lumina theming: `className="bg-slate-800/50 border-slate-700/50 text-orange-300"`

9. **Clean up**
   - Remove unused state variables
   - Remove unused helper functions (toggle handlers)
   - Remove inline style props
   - Remove manual hover effect handlers
   - Simplify nested divs now handled by components

### Phase 3: Verification

10. **Write the complete migrated file**
    - Use the Write tool to replace the entire component file
    - IMPORTANT: Write the complete file in one operation to avoid broken JSX

11. **Run type check**
    - Execute: `cd my-tutoring-app && npx tsc --noEmit`
    - Fix any TypeScript errors before proceeding

12. **Report results**
    - Original line count vs. new line count
    - Lines saved and percentage reduction
    - State variables removed
    - Custom handlers removed
    - List of shadcn components now used

### Phase 4: Testing Reminder

13. **Remind the user to test**
    - All expandable sections still work
    - Buttons still trigger correct actions
    - Visual appearance matches Lumina design
    - Keyboard navigation works (tab through accordions)
    - No console errors in browser
    - Component renders correctly in the tester

## Common Migration Patterns

### Pattern 1: Container Divs → Card

```tsx
// Before
<div className="w-full glass-panel rounded-2xl overflow-hidden shadow-2xl border border-white/10">
  <div className="p-6 sm:p-8">
    <div className="mb-6">
      <h3 className="text-2xl font-bold text-slate-100 mb-1">{data.title}</h3>
      <p className="text-sm text-slate-400">{data.description}</p>
    </div>
    {/* content */}
  </div>
</div>

// After
<Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl">
  <CardHeader>
    <CardTitle className="text-slate-100">{data.title}</CardTitle>
    <CardDescription className="text-slate-400">{data.description}</CardDescription>
  </CardHeader>
  <CardContent>
    {/* content */}
  </CardContent>
</Card>
```

### Pattern 2: Custom Expandable → Accordion

```tsx
// Before
const [expandedSection, setExpandedSection] = useState<string | null>(null);
const toggleSection = (section: string) => {
  setExpandedSection(expandedSection === section ? null : section);
};

<button onClick={() => toggleSection('taxonomy')} className="...">
  <span>Taxonomy</span>
  {expandedSection === 'taxonomy' ? <ChevronUp /> : <ChevronDown />}
</button>
{expandedSection === 'taxonomy' && <div>{/* content */}</div>}

// After
<Accordion type="single" collapsible defaultValue="taxonomy">
  <AccordionItem value="taxonomy" className="border-white/10">
    <AccordionTrigger className="text-slate-300 hover:text-slate-100 hover:no-underline">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-orange-300" />
        <span className="text-sm font-medium">Taxonomy</span>
      </div>
    </AccordionTrigger>
    <AccordionContent className="pt-3">
      {/* content */}
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

### Pattern 3: Custom Buttons → Button

```tsx
// Before
<button
  onClick={handleAction}
  className="group px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 bg-white/5 text-orange-300 border border-white/20 hover:bg-white/10 hover:scale-105"
  style={{ boxShadow: '0 8px 24px rgba(249, 115, 22, 0.3)' }}
  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '...' }}
  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '' }}
>
  <Icon className="w-5 h-5" />
  Button Text
</button>

// After
<Button
  onClick={handleAction}
  variant="ghost"
  className="bg-white/5 text-orange-300 border border-white/20 hover:bg-white/10"
>
  <Icon className="w-4 h-4 mr-2" />
  Button Text
</Button>
```

### Pattern 4: Custom Labels → Badge

```tsx
// Before
<div className="px-4 py-2 rounded-full text-xs font-mono uppercase tracking-wider text-orange-300 bg-slate-800/50 border border-slate-700/50">
  {label}
</div>

// After
<Badge className="bg-slate-800/50 border-slate-700/50 text-orange-300">
  {label}
</Badge>
```

## Lumina Theming Reference

Apply these classes to shadcn components:

### Cards
```tsx
<Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl">
```

### Accordion
```tsx
<AccordionItem value="section" className="border-white/10">
  <AccordionTrigger className="text-slate-300 hover:text-slate-100 hover:no-underline">
```

### Buttons
```tsx
<Button variant="ghost" className="bg-white/5 border border-white/20 hover:bg-white/10">
```

### Badges
```tsx
<Badge className="bg-slate-800/50 border-slate-700/50 text-orange-300">
```

### Text Colors
- Primary: `text-slate-100`, `text-slate-200`
- Secondary: `text-slate-300`, `text-slate-400`
- Muted: `text-slate-500`, `text-slate-600`
- Accent: `text-orange-300`, `text-emerald-300`, etc.

## Priority Migration Order

Migrate primitives in this order:

1. **Display cards** (OrganismCard, SpeciesProfile) — High visual impact, simple migration
2. **Info panels** (ConceptCard, CuratorBrief) — Moderate complexity
3. **Interactive displays** (ClassificationSorter, LifeCycleSequencer) — Test shadcn with interactions
4. **Complex primitives** (HabitatDiorama, BodySystemExplorer) — Only after pattern is established

## Success Metrics

After migration, verify:
- ✅ 70-90% reduction in component lines
- ✅ No custom state for expand/collapse
- ✅ No inline styles or manual hover handlers
- ✅ Consistent theming across all sections
- ✅ Improved keyboard accessibility
- ✅ TypeScript compiles without errors
- ✅ Component renders correctly in tester

## Important Notes

- **ALWAYS write the complete migrated file in one operation** to avoid broken JSX
- **Do NOT skip the type check** — run `npx tsc --noEmit` before considering the migration complete
- **Keep simple attribute displays as styled divs** — don't over-componentize
- **Preserve all functionality** — this is purely visual/structural refactoring
- **Test keyboard navigation** — Accordion components provide built-in keyboard support

## Reference Files

- Migration guide: `my-tutoring-app/src/components/lumina/docs/MIGRATING_TO_SHADCN.md`
- Example migrated primitive: `lumina/primitives/visual-primitives/biology/OrganismCard.tsx` (if available)
- shadcn components: `my-tutoring-app/src/components/ui/*`

## Common Questions

**Q: Should I migrate all primitives at once?**
A: No. Migrate one primitive at a time, test thoroughly, then move to the next.

**Q: What if my primitive has unique styling needs?**
A: You can still extend shadcn components with custom classes. Use shadcn for structure, Lumina theming via Tailwind.

**Q: Will this break existing functionality?**
A: No. The migration is purely visual/structural. All event handlers, props, and logic remain the same.

**Q: Can I mix custom divs and shadcn components?**
A: Yes. For simple displays, styled divs are fine. Use shadcn for major structural components.
