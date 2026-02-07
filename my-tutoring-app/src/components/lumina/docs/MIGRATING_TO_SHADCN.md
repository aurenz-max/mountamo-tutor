# Migrating Existing Primitives to shadcn/ui + Lumina Theming

This guide shows how to refactor existing Lumina primitives to use shadcn/ui components while preserving all functionality. The goal is to simplify code, improve consistency, and reduce maintenance overhead.

## Why Migrate?

**Before (custom code):**
- 500+ lines of manual styling
- Custom state management for accordions
- Inconsistent hover effects and transitions
- Difficult for LLMs to edit without breaking JSX

**After (shadcn/ui):**
- 60-100 lines for same functionality
- Built-in accessibility and animations
- Consistent patterns across all primitives
- Easier to maintain and extend

## Migration Checklist

For each primitive you're migrating:

- [ ] Add shadcn/ui imports
- [ ] Replace custom containers with `Card` components
- [ ] Replace custom buttons with `Button` components
- [ ] Replace custom expandable sections with `Accordion`
- [ ] Replace custom badges/labels with `Badge`
- [ ] Apply Lumina theming classes
- [ ] Remove custom state management (if using Accordion)
- [ ] Remove inline styles and manual hover handlers
- [ ] Test that all functionality still works

## Common Migration Patterns

### Pattern 1: Container Divs → Card Components

**Before:**
```tsx
<div className="w-full glass-panel rounded-2xl overflow-hidden shadow-2xl border border-white/10">
  <div className="p-6 sm:p-8">
    <div className="mb-6">
      <h3 className="text-2xl font-bold text-slate-100 mb-1">
        {data.title}
      </h3>
      <p className="text-sm text-slate-400">
        {data.description}
      </p>
    </div>
    {/* content */}
  </div>
</div>
```

**After:**
```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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

### Pattern 2: Custom Expandable Sections → Accordion

**Before:**
```tsx
const [expandedSection, setExpandedSection] = useState<string | null>(null);

const toggleSection = (section: string) => {
  setExpandedSection(expandedSection === section ? null : section);
};

<button
  onClick={() => toggleSection('taxonomy')}
  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/70"
>
  <div className="flex items-center gap-2">
    <Users className="w-4 h-4 text-orange-300" />
    <span className="text-sm font-mono text-slate-300 uppercase">Taxonomy</span>
  </div>
  {expandedSection === 'taxonomy' ? (
    <ChevronUp className="w-4 h-4 text-slate-400" />
  ) : (
    <ChevronDown className="w-4 h-4 text-slate-400" />
  )}
</button>

{expandedSection === 'taxonomy' && (
  <div className="mt-3 p-5 rounded-xl bg-slate-800/30 border border-slate-700/50">
    {/* content */}
  </div>
)}
```

**After:**
```tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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

**Remove:**
- State: `const [expandedSection, setExpandedSection] = useState<string | null>(null);`
- Toggle function: `const toggleSection = ...`
- All `onClick` handlers for expand/collapse

### Pattern 3: Custom Buttons → Button Component

**Before:**
```tsx
<button
  onClick={handleGenerateImage}
  className="group px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 bg-white/5 text-orange-300 border border-white/20 hover:bg-white/10 hover:scale-105"
  style={{ boxShadow: '0 8px 24px rgba(249, 115, 22, 0.3)' }}
  onMouseEnter={(e) => {
    e.currentTarget.style.boxShadow = '0 8px 24px rgba(249, 115, 22, 0.3)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.boxShadow = '';
  }}
>
  <Image className="w-5 h-5" />
  Generate Visual
</button>
```

**After:**
```tsx
import { Button } from '@/components/ui/button';

<Button
  onClick={handleGenerateImage}
  variant="ghost"
  className="bg-white/5 text-orange-300 border border-white/20 hover:bg-white/10"
>
  <Image className="w-4 h-4 mr-2" />
  Generate Visual
</Button>
```

**Remove:**
- Inline `style` props
- Manual `onMouseEnter`/`onMouseLeave` handlers
- Manual `boxShadow` manipulation

### Pattern 4: Custom Labels → Badge Component

**Before:**
```tsx
<div
  className="px-4 py-2 rounded-full text-xs font-mono uppercase tracking-wider text-orange-300 bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800/70"
  style={{ boxShadow: '0 4px 16px rgba(249, 115, 22, 0.3)' }}
  onMouseEnter={(e) => {
    e.currentTarget.style.boxShadow = '0 4px 16px rgba(249, 115, 22, 0.3)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.boxShadow = '';
  }}
>
  {data.kingdom}
</div>
```

**After:**
```tsx
import { Badge } from '@/components/ui/badge';

<Badge className="bg-slate-800/50 border-slate-700/50 text-orange-300">
  {data.kingdom}
</Badge>
```

### Pattern 5: Nested Cards/Sections

**Before:**
```tsx
<div className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:border-slate-600/70 hover:bg-slate-800/50 transition-all">
  <div className="flex items-start gap-3">
    <MapPin className="w-4 h-4 text-orange-300 mt-0.5" />
    <div className="flex-1">
      <div className="text-xs font-mono text-slate-500 uppercase">Habitat</div>
      <div className="text-sm text-slate-200">{data.habitat}</div>
    </div>
  </div>
</div>
```

**After:**
```tsx
<div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 hover:border-slate-600/70 transition-all">
  <div className="flex items-start gap-2">
    <MapPin className="w-4 h-4 text-orange-300 mt-1" />
    <div>
      <p className="text-xs text-slate-500 uppercase">Habitat</p>
      <p className="text-sm text-slate-200">{data.habitat}</p>
    </div>
  </div>
</div>
```

**Note:** For simple attribute displays, keep as styled divs rather than full Cards to avoid over-componentizing.

### Pattern 6: Multiple Accordion Sections

**Before:**
```tsx
const [expandedSection, setExpandedSection] = useState<string | null>(null);

// Classification section
<button onClick={() => toggleSection('classification')}>...</button>
{expandedSection === 'classification' && <div>...</div>}

// Adaptations section
<button onClick={() => toggleSection('adaptations')}>...</button>
{expandedSection === 'adaptations' && <div>...</div>}

// Diet section
<button onClick={() => toggleSection('diet')}>...</button>
{expandedSection === 'diet' && <div>...</div>}
```

**After:**
```tsx
<Accordion type="single" collapsible defaultValue="classification">
  <AccordionItem value="classification" className="border-white/10">
    <AccordionTrigger className="text-slate-300 hover:text-slate-100 hover:no-underline">
      <div className="flex items-center gap-2">
        <Leaf className="w-4 h-4 text-orange-300" />
        Classification
      </div>
    </AccordionTrigger>
    <AccordionContent>...</AccordionContent>
  </AccordionItem>

  <AccordionItem value="adaptations" className="border-white/10">
    <AccordionTrigger className="text-slate-300 hover:text-slate-100 hover:no-underline">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-orange-300" />
        Adaptations
      </div>
    </AccordionTrigger>
    <AccordionContent>...</AccordionContent>
  </AccordionItem>

  <AccordionItem value="diet" className="border-white/10">
    <AccordionTrigger className="text-slate-300 hover:text-slate-100 hover:no-underline">
      <div className="flex items-center gap-2">
        <Utensils className="w-4 h-4 text-orange-300" />
        Diet
      </div>
    </AccordionTrigger>
    <AccordionContent>...</AccordionContent>
  </AccordionItem>
</Accordion>
```

**Benefits:**
- Single `Accordion` wrapper handles all sections
- No state management needed
- Keyboard navigation built-in
- Only one section open at a time automatically

## Step-by-Step Migration Process

### Step 1: Add Imports

Add shadcn/ui component imports at the top of your file:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
```

### Step 2: Identify Patterns

Scan your component for:
- Container divs with `glass-panel` or similar styling → `Card`
- Buttons with custom styling → `Button`
- Expandable sections with state management → `Accordion`
- Label/badge divs → `Badge`
- Horizontal dividers → `Separator`

### Step 3: Replace Containers

Start with the outermost container and work inward:

```tsx
// Find this:
<div className="w-full glass-panel rounded-2xl...">
  <div className="p-6">
    <div className="mb-6">
      <h3>Title</h3>
      <p>Description</p>
    </div>
    {/* content */}
  </div>
</div>

// Replace with:
<Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl">
  <CardHeader>
    <CardTitle className="text-slate-100">Title</CardTitle>
    <CardDescription className="text-slate-400">Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* content */}
  </CardContent>
</Card>
```

### Step 4: Replace Expandable Sections

Look for state like `const [expandedSection, setExpandedSection] = useState(...)`:

1. Remove the state declaration
2. Remove the toggle function
3. Replace all button + conditional content with `Accordion`
4. Use `defaultValue` prop to set which section is open by default

### Step 5: Replace Buttons

Find all `<button>` elements and replace with `<Button>`:

1. Add `variant="ghost"` for transparent buttons
2. Move common classes to `className`
3. Remove inline `style` props
4. Remove `onMouseEnter`/`onMouseLeave` handlers
5. Use lucide-react icons with `mr-2` spacing

### Step 6: Replace Badges

Find label/category divs:

```tsx
// Find:
<div className="px-4 py-2 rounded-full text-xs...">Label</div>

// Replace:
<Badge className="bg-slate-800/50 border-slate-700/50 text-orange-300">Label</Badge>
```

### Step 7: Clean Up

Remove:
- Unused state variables
- Unused helper functions (toggle handlers)
- Inline style props
- Manual hover effect handlers
- Complex nested divs that are now handled by components

### Step 8: Test

Verify:
- [ ] All expandable sections still work
- [ ] Buttons still trigger correct actions
- [ ] Visual appearance matches Lumina design
- [ ] Keyboard navigation works (tab through accordions)
- [ ] No console errors
- [ ] TypeScript compiles without errors

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

### Backgrounds
- Cards: `bg-slate-900/40`, `bg-slate-800/30`
- Nested sections: `bg-black/20`, `bg-slate-900/60`
- Borders: `border-white/10`, `border-slate-700/50`

### Effects
- Glass: `backdrop-blur-xl`, `backdrop-blur-sm`
- Hover: `hover:bg-white/10`, `hover:border-white/20`

## Example: Before and After

### Before (OrganismCard.tsx - 544 lines)

```tsx
const OrganismCard: React.FC<OrganismCardProps> = ({ data, className = '' }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="w-full glass-panel rounded-2xl overflow-hidden shadow-2xl border border-white/10">
      <div className="p-6 sm:p-8">
        <div className="mb-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-slate-100 mb-1">
                {organism.commonName}
              </h3>
              <p className="text-sm font-serif italic text-slate-400">
                {organism.scientificName}
              </p>
            </div>
            <div className="ml-4">
              <div className="px-4 py-2 rounded-full text-xs font-mono uppercase text-orange-300 bg-slate-800/50 border border-slate-700/50">
                {organism.kingdom}
              </div>
            </div>
          </div>
        </div>

        {/* 400+ more lines of custom divs, buttons, and state management */}
      </div>
    </div>
  );
};
```

### After (OrganismCard.tsx - ~80 lines)

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

const OrganismCard: React.FC<OrganismCardProps> = ({ data, className = '' }) => {
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl text-slate-100">
              {organism.commonName}
            </CardTitle>
            <p className="text-sm italic text-slate-400">
              {organism.scientificName}
            </p>
          </div>
          <Badge className="bg-slate-800/50 border-slate-700/50 text-orange-300">
            {organism.kingdom}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Attributes grid */}

        <Accordion type="single" collapsible defaultValue="classification">
          <AccordionItem value="classification" className="border-white/10">
            <AccordionTrigger className="text-slate-300 hover:text-slate-100 hover:no-underline">
              Classification
            </AccordionTrigger>
            <AccordionContent>
              {/* classification content */}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};
```

**Lines saved: 464 lines (85% reduction)**

## Common Questions

### Q: Should I migrate all primitives at once?

**A:** No. Migrate one primitive at a time, test thoroughly, then move to the next. This reduces risk and makes it easier to track any issues.

### Q: What if my primitive has unique styling needs?

**A:** You can still extend shadcn components with custom classes. The goal is to use shadcn for structure (Card, Accordion, Button) while applying Lumina theming via Tailwind classes.

### Q: Can I mix custom divs and shadcn components?

**A:** Yes. For simple attribute displays or data grids, styled divs are fine. Use shadcn for major structural components (containers, expandable sections, buttons).

### Q: Will this break existing functionality?

**A:** No. The migration is purely visual/structural. All event handlers, props, and logic remain the same.

### Q: Should I migrate non-visual primitives?

**A:** Focus on visual/display primitives first (OrganismCard, SpeciesProfile, etc.). Skip interactive primitives with complex game logic until you're comfortable with the pattern.

## Priority Migration List

Migrate in this order:

1. **Display cards** (OrganismCard, SpeciesProfile) - High visual impact, simple migration
2. **Info panels** (ConceptCard, CuratorBrief) - Moderate complexity
3. **Interactive displays** (ClassificationSorter, LifeCycleSequencer) - Test shadcn with interactions
4. **Complex primitives** (HabitatDiorama, BodySystemExplorer) - Only after pattern is established

## Success Metrics

After migration, you should see:
- ✅ 70-90% reduction in component lines
- ✅ No custom state for expand/collapse
- ✅ No inline styles or manual hover handlers
- ✅ Consistent theming across all sections
- ✅ Improved keyboard accessibility
- ✅ Easier to edit and maintain
