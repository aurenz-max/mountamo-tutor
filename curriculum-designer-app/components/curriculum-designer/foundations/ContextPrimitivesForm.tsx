'use client';

/**
 * Context Primitives Form
 * Edits 11 types of variety elements for problem generation
 */

import { useState } from 'react';
import { Plus, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ContextPrimitives, Character, ComparisonPair, Category, Attribute } from '@/types/foundations';

interface ContextPrimitivesFormProps {
  data: ContextPrimitives;
  onChange: (data: ContextPrimitives) => void;
  subjectId: string;
}

export function ContextPrimitivesForm({ data, onChange, subjectId }: ContextPrimitivesFormProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    concrete_objects: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Simple string array handlers
  const addStringItem = (field: keyof ContextPrimitives, value: string) => {
    if (!value.trim()) return;
    const currentArray = data[field] as string[];
    onChange({
      ...data,
      [field]: [...currentArray, value.trim()],
    });
  };

  const removeStringItem = (field: keyof ContextPrimitives, index: number) => {
    const currentArray = data[field] as string[];
    onChange({
      ...data,
      [field]: currentArray.filter((_, i) => i !== index),
    });
  };

  // Character handlers
  const addCharacter = (character: Character) => {
    if (!character.name.trim()) return;
    onChange({
      ...data,
      characters: [...data.characters, character],
    });
  };

  const removeCharacter = (index: number) => {
    onChange({
      ...data,
      characters: data.characters.filter((_, i) => i !== index),
    });
  };

  // Comparison pair handlers
  const addComparisonPair = (pair: ComparisonPair) => {
    if (!pair.attribute.trim() || pair.examples.length === 0) return;
    onChange({
      ...data,
      comparison_pairs: [...data.comparison_pairs, pair],
    });
  };

  const removeComparisonPair = (index: number) => {
    onChange({
      ...data,
      comparison_pairs: data.comparison_pairs.filter((_, i) => i !== index),
    });
  };

  // Category handlers
  const addCategory = (category: Category) => {
    if (!category.name.trim() || category.items.length === 0) return;
    onChange({
      ...data,
      categories: [...data.categories, category],
    });
  };

  const removeCategory = (index: number) => {
    onChange({
      ...data,
      categories: data.categories.filter((_, i) => i !== index),
    });
  };

  // Sequence handlers
  const addSequence = (sequence: string[]) => {
    if (sequence.length === 0) return;
    onChange({
      ...data,
      sequences: [...data.sequences, sequence],
    });
  };

  const removeSequence = (index: number) => {
    onChange({
      ...data,
      sequences: data.sequences.filter((_, i) => i !== index),
    });
  };

  // Attribute handlers
  const addAttribute = (attribute: Attribute) => {
    if (!attribute.name.trim() || attribute.values.length === 0) return;
    onChange({
      ...data,
      attributes: [...data.attributes, attribute],
    });
  };

  const removeAttribute = (index: number) => {
    onChange({
      ...data,
      attributes: data.attributes.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-3">
      {/* Simple String Arrays */}
      <SimpleStringSection
        title="Concrete Objects"
        description="Physical objects (buildings, furniture, toys, etc.)"
        items={data.concrete_objects}
        placeholder="e.g., bicycle, desk, building"
        isOpen={openSections.concrete_objects}
        onToggle={() => toggleSection('concrete_objects')}
        onAdd={(value) => addStringItem('concrete_objects', value)}
        onRemove={(index) => removeStringItem('concrete_objects', index)}
      />

      <SimpleStringSection
        title="Living Things"
        description="Animals, plants, organisms"
        items={data.living_things}
        placeholder="e.g., dog, oak tree, butterfly"
        isOpen={openSections.living_things}
        onToggle={() => toggleSection('living_things')}
        onAdd={(value) => addStringItem('living_things', value)}
        onRemove={(index) => removeStringItem('living_things', index)}
      />

      <SimpleStringSection
        title="Locations"
        description="Settings and places"
        items={data.locations}
        placeholder="e.g., park, school, beach"
        isOpen={openSections.locations}
        onToggle={() => toggleSection('locations')}
        onAdd={(value) => addStringItem('locations', value)}
        onRemove={(index) => removeStringItem('locations', index)}
      />

      <SimpleStringSection
        title="Tools"
        description="Instruments and equipment"
        items={data.tools}
        placeholder="e.g., hammer, microscope, calculator"
        isOpen={openSections.tools}
        onToggle={() => toggleSection('tools')}
        onAdd={(value) => addStringItem('tools', value)}
        onRemove={(index) => removeStringItem('tools', index)}
      />

      {/* Characters Section */}
      <CharactersSection
        characters={data.characters}
        isOpen={openSections.characters}
        onToggle={() => toggleSection('characters')}
        onAdd={addCharacter}
        onRemove={removeCharacter}
      />

      <SimpleStringSection
        title="Scenarios"
        description="Situations and contexts"
        items={data.scenarios}
        placeholder="e.g., birthday party, science fair, field trip"
        isOpen={openSections.scenarios}
        onToggle={() => toggleSection('scenarios')}
        onAdd={(value) => addStringItem('scenarios', value)}
        onRemove={(index) => removeStringItem('scenarios', index)}
      />

      {/* Comparison Pairs Section */}
      <ComparisonPairsSection
        pairs={data.comparison_pairs}
        isOpen={openSections.comparison_pairs}
        onToggle={() => toggleSection('comparison_pairs')}
        onAdd={addComparisonPair}
        onRemove={removeComparisonPair}
      />

      {/* Categories Section */}
      <CategoriesSection
        categories={data.categories}
        isOpen={openSections.categories}
        onToggle={() => toggleSection('categories')}
        onAdd={addCategory}
        onRemove={removeCategory}
      />

      {/* Sequences Section */}
      <SequencesSection
        sequences={data.sequences}
        isOpen={openSections.sequences}
        onToggle={() => toggleSection('sequences')}
        onAdd={addSequence}
        onRemove={removeSequence}
      />

      <SimpleStringSection
        title="Action Words"
        description="Verbs for problem contexts"
        items={data.action_words}
        placeholder="e.g., measure, compare, calculate"
        isOpen={openSections.action_words}
        onToggle={() => toggleSection('action_words')}
        onAdd={(value) => addStringItem('action_words', value)}
        onRemove={(index) => removeStringItem('action_words', index)}
      />

      {/* Attributes Section */}
      <AttributesSection
        attributes={data.attributes}
        isOpen={openSections.attributes}
        onToggle={() => toggleSection('attributes')}
        onAdd={addAttribute}
        onRemove={removeAttribute}
      />
    </div>
  );
}

// Simple String Section Component
function SimpleStringSection({
  title,
  description,
  items,
  placeholder,
  isOpen,
  onToggle,
  onAdd,
  onRemove,
}: {
  title: string;
  description: string;
  items: string[];
  placeholder: string;
  isOpen: boolean;
  onToggle: () => void;
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
}) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    onAdd(newItem);
    setNewItem('');
  };

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle className="text-base">{title}</CardTitle>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
            </div>
            <CardDescription className="text-left">{description}</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            <div className="flex flex-wrap gap-2">
              {items.map((item, index) => (
                <Badge key={index} variant="secondary" className="text-sm py-1 px-3">
                  {item}
                  <button
                    onClick={() => onRemove(index)}
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder={placeholder}
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
              />
              <Button onClick={handleAdd} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Characters Section Component
function CharactersSection({
  characters,
  isOpen,
  onToggle,
  onAdd,
  onRemove,
}: {
  characters: Character[];
  isOpen: boolean;
  onToggle: () => void;
  onAdd: (character: Character) => void;
  onRemove: (index: number) => void;
}) {
  const [newCharacter, setNewCharacter] = useState<Character>({ name: '', age: undefined, role: '' });

  const handleAdd = () => {
    onAdd(newCharacter);
    setNewCharacter({ name: '', age: undefined, role: '' });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle className="text-base">Characters</CardTitle>
                <Badge variant="secondary">{characters.length}</Badge>
              </div>
            </div>
            <CardDescription className="text-left">People with names, ages, and roles</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-2">
              {characters.map((char, index) => (
                <div key={index} className="flex items-center gap-2 p-2 border rounded">
                  <div className="flex-1 text-sm">
                    <span className="font-semibold">{char.name}</span>
                    {char.age && <span className="text-muted-foreground"> ({char.age})</span>}
                    {char.role && <span className="text-muted-foreground"> - {char.role}</span>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onRemove(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="space-y-2 p-3 border rounded bg-muted/50">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="char-name">Name*</Label>
                  <Input
                    id="char-name"
                    placeholder="e.g., Maria"
                    value={newCharacter.name}
                    onChange={(e) => setNewCharacter({ ...newCharacter, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="char-age">Age</Label>
                  <Input
                    id="char-age"
                    type="number"
                    placeholder="e.g., 10"
                    value={newCharacter.age || ''}
                    onChange={(e) => setNewCharacter({ ...newCharacter, age: e.target.value ? parseInt(e.target.value) : undefined })}
                  />
                </div>
                <div>
                  <Label htmlFor="char-role">Role</Label>
                  <Input
                    id="char-role"
                    placeholder="e.g., student"
                    value={newCharacter.role || ''}
                    onChange={(e) => setNewCharacter({ ...newCharacter, role: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleAdd} size="sm" disabled={!newCharacter.name.trim()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Character
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Comparison Pairs Section Component
function ComparisonPairsSection({
  pairs,
  isOpen,
  onToggle,
  onAdd,
  onRemove,
}: {
  pairs: ComparisonPair[];
  isOpen: boolean;
  onToggle: () => void;
  onAdd: (pair: ComparisonPair) => void;
  onRemove: (index: number) => void;
}) {
  const [newPair, setNewPair] = useState<ComparisonPair>({ attribute: '', examples: [] });
  const [newExample, setNewExample] = useState('');

  const handleAdd = () => {
    onAdd(newPair);
    setNewPair({ attribute: '', examples: [] });
  };

  const addExample = () => {
    if (!newExample.trim()) return;
    setNewPair({ ...newPair, examples: [...newPair.examples, newExample.trim()] });
    setNewExample('');
  };

  const removeExample = (index: number) => {
    setNewPair({ ...newPair, examples: newPair.examples.filter((_, i) => i !== index) });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle className="text-base">Comparison Pairs</CardTitle>
                <Badge variant="secondary">{pairs.length}</Badge>
              </div>
            </div>
            <CardDescription className="text-left">Attributes with example pairs for comparison</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-2">
              {pairs.map((pair, index) => (
                <div key={index} className="p-2 border rounded">
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-semibold text-sm">{pair.attribute}</span>
                    <Button variant="ghost" size="sm" onClick={() => onRemove(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {pair.examples.map((ex, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {ex}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 p-3 border rounded bg-muted/50">
              <div>
                <Label htmlFor="pair-attr">Attribute*</Label>
                <Input
                  id="pair-attr"
                  placeholder="e.g., Size"
                  value={newPair.attribute}
                  onChange={(e) => setNewPair({ ...newPair, attribute: e.target.value })}
                />
              </div>
              <div>
                <Label>Examples</Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {newPair.examples.map((ex, i) => (
                    <Badge key={i} variant="secondary">
                      {ex}
                      <button onClick={() => removeExample(i)} className="ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., small, large"
                    value={newExample}
                    onChange={(e) => setNewExample(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addExample()}
                  />
                  <Button onClick={addExample} size="sm" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button onClick={handleAdd} size="sm" disabled={!newPair.attribute.trim() || newPair.examples.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                Add Comparison
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Categories Section Component
function CategoriesSection({
  categories,
  isOpen,
  onToggle,
  onAdd,
  onRemove,
}: {
  categories: Category[];
  isOpen: boolean;
  onToggle: () => void;
  onAdd: (category: Category) => void;
  onRemove: (index: number) => void;
}) {
  const [newCategory, setNewCategory] = useState<Category>({ name: '', items: [] });
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    onAdd(newCategory);
    setNewCategory({ name: '', items: [] });
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    setNewCategory({ ...newCategory, items: [...newCategory.items, newItem.trim()] });
    setNewItem('');
  };

  const removeItem = (index: number) => {
    setNewCategory({ ...newCategory, items: newCategory.items.filter((_, i) => i !== index) });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle className="text-base">Categories</CardTitle>
                <Badge variant="secondary">{categories.length}</Badge>
              </div>
            </div>
            <CardDescription className="text-left">Named groups with items</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-2">
              {categories.map((cat, index) => (
                <div key={index} className="p-2 border rounded">
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-semibold text-sm">{cat.name}</span>
                    <Button variant="ghost" size="sm" onClick={() => onRemove(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {cat.items.map((item, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 p-3 border rounded bg-muted/50">
              <div>
                <Label htmlFor="cat-name">Category Name*</Label>
                <Input
                  id="cat-name"
                  placeholder="e.g., Fruits"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Items</Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {newCategory.items.map((item, i) => (
                    <Badge key={i} variant="secondary">
                      {item}
                      <button onClick={() => removeItem(i)} className="ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., apple, banana, orange"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addItem()}
                  />
                  <Button onClick={addItem} size="sm" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button onClick={handleAdd} size="sm" disabled={!newCategory.name.trim() || newCategory.items.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Sequences Section Component
function SequencesSection({
  sequences,
  isOpen,
  onToggle,
  onAdd,
  onRemove,
}: {
  sequences: string[][];
  isOpen: boolean;
  onToggle: () => void;
  onAdd: (sequence: string[]) => void;
  onRemove: (index: number) => void;
}) {
  const [newSequence, setNewSequence] = useState<string[]>([]);
  const [newStep, setNewStep] = useState('');

  const handleAdd = () => {
    onAdd(newSequence);
    setNewSequence([]);
  };

  const addStep = () => {
    if (!newStep.trim()) return;
    setNewSequence([...newSequence, newStep.trim()]);
    setNewStep('');
  };

  const removeStep = (index: number) => {
    setNewSequence(newSequence.filter((_, i) => i !== index));
  };

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle className="text-base">Sequences</CardTitle>
                <Badge variant="secondary">{sequences.length}</Badge>
              </div>
            </div>
            <CardDescription className="text-left">Ordered steps, timelines, or procedures</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-2">
              {sequences.map((seq, index) => (
                <div key={index} className="p-2 border rounded">
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-semibold text-sm">Sequence {index + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => onRemove(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <ol className="list-decimal list-inside text-sm space-y-1">
                    {seq.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
            <div className="space-y-2 p-3 border rounded bg-muted/50">
              <Label>Build Sequence</Label>
              {newSequence.length > 0 && (
                <ol className="list-decimal list-inside text-sm space-y-1 mb-2">
                  {newSequence.map((step, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span>{step}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeStep(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Add step..."
                  value={newStep}
                  onChange={(e) => setNewStep(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addStep()}
                />
                <Button onClick={addStep} size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={handleAdd} size="sm" disabled={newSequence.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                Add Sequence
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Attributes Section Component
function AttributesSection({
  attributes,
  isOpen,
  onToggle,
  onAdd,
  onRemove,
}: {
  attributes: Attribute[];
  isOpen: boolean;
  onToggle: () => void;
  onAdd: (attribute: Attribute) => void;
  onRemove: (index: number) => void;
}) {
  const [newAttribute, setNewAttribute] = useState<Attribute>({ name: '', values: [] });
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    onAdd(newAttribute);
    setNewAttribute({ name: '', values: [] });
  };

  const addValue = () => {
    if (!newValue.trim()) return;
    setNewAttribute({ ...newAttribute, values: [...newAttribute.values, newValue.trim()] });
    setNewValue('');
  };

  const removeValue = (index: number) => {
    setNewAttribute({ ...newAttribute, values: newAttribute.values.filter((_, i) => i !== index) });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle className="text-base">Attributes</CardTitle>
                <Badge variant="secondary">{attributes.length}</Badge>
              </div>
            </div>
            <CardDescription className="text-left">Properties with possible values</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-2">
              {attributes.map((attr, index) => (
                <div key={index} className="p-2 border rounded">
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-semibold text-sm">{attr.name}</span>
                    <Button variant="ghost" size="sm" onClick={() => onRemove(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {attr.values.map((val, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {val}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 p-3 border rounded bg-muted/50">
              <div>
                <Label htmlFor="attr-name">Attribute Name*</Label>
                <Input
                  id="attr-name"
                  placeholder="e.g., Color"
                  value={newAttribute.name}
                  onChange={(e) => setNewAttribute({ ...newAttribute, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Possible Values</Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {newAttribute.values.map((val, i) => (
                    <Badge key={i} variant="secondary">
                      {val}
                      <button onClick={() => removeValue(i)} className="ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., red, blue, green"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addValue()}
                  />
                  <Button onClick={addValue} size="sm" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button onClick={handleAdd} size="sm" disabled={!newAttribute.name.trim() || newAttribute.values.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                Add Attribute
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
