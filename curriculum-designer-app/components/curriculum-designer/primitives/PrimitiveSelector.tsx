'use client';

import { useState, useMemo } from 'react';
import { usePrimitives } from '@/lib/curriculum-authoring/hooks';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Loader2, Search, X, ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { Primitive, PrimitiveCategory } from '@/types/curriculum-authoring';

interface PrimitiveSelectorProps {
  selectedPrimitiveIds: string[];
  onSelectionChange: (primitiveIds: string[]) => void;
}

const categoryLabels: Record<PrimitiveCategory, string> = {
  'foundational': 'Foundational (K-1)',
  'math': 'Math Visuals',
  'science': 'Science Visuals',
  'language-arts': 'Language Arts',
  'abcs': 'ABCs/Early Literacy',
};

const categoryOrder: PrimitiveCategory[] = [
  'foundational',
  'math',
  'science',
  'language-arts',
  'abcs',
];

export function PrimitiveSelector({
  selectedPrimitiveIds,
  onSelectionChange,
}: PrimitiveSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<PrimitiveCategory>>(
    new Set(categoryOrder)
  );

  const { data: primitives, isLoading } = usePrimitives();

  // Group primitives by category
  const groupedPrimitives = useMemo(() => {
    if (!primitives) return {} as Record<PrimitiveCategory, Primitive[]>;

    return primitives.reduce((acc, primitive) => {
      if (!acc[primitive.category]) {
        acc[primitive.category] = [];
      }
      acc[primitive.category].push(primitive);
      return acc;
    }, {} as Record<PrimitiveCategory, Primitive[]>);
  }, [primitives]);

  // Filter primitives based on search query
  const filteredGroupedPrimitives = useMemo(() => {
    if (!searchQuery) return groupedPrimitives;

    const query = searchQuery.toLowerCase();
    const filtered = {} as Record<PrimitiveCategory, Primitive[]>;

    Object.entries(groupedPrimitives).forEach(([category, prims]) => {
      const matchingPrims = prims.filter(
        (p) =>
          p.primitive_name.toLowerCase().includes(query) ||
          p.primitive_id.toLowerCase().includes(query) ||
          p.best_for?.toLowerCase().includes(query) ||
          p.avoid_for?.toLowerCase().includes(query)
      );

      if (matchingPrims.length > 0) {
        filtered[category as PrimitiveCategory] = matchingPrims;
      }
    });

    return filtered;
  }, [groupedPrimitives, searchQuery]);

  // Get selected primitives for display
  const selectedPrimitives = useMemo(() => {
    if (!primitives) return [];
    return primitives.filter((p) => selectedPrimitiveIds.includes(p.primitive_id));
  }, [primitives, selectedPrimitiveIds]);

  const handleTogglePrimitive = (primitiveId: string) => {
    if (selectedPrimitiveIds.includes(primitiveId)) {
      onSelectionChange(selectedPrimitiveIds.filter((id) => id !== primitiveId));
    } else {
      onSelectionChange([...selectedPrimitiveIds, primitiveId]);
    }
  };

  const handleRemovePrimitive = (primitiveId: string) => {
    onSelectionChange(selectedPrimitiveIds.filter((id) => id !== primitiveId));
  };

  const toggleCategory = (category: PrimitiveCategory) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className="space-y-3">
      {/* Selected Primitives */}
      {selectedPrimitives.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-gray-600">Selected ({selectedPrimitives.length})</Label>
          <div className="flex flex-wrap gap-2">
            {selectedPrimitives.map((primitive) => (
              <Badge
                key={primitive.primitive_id}
                variant="secondary"
                className="flex items-center gap-1 pl-2 pr-1 py-1"
              >
                <span className="text-xs">{primitive.primitive_name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => handleRemovePrimitive(primitive.primitive_id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="space-y-2">
        <Label htmlFor="primitive-search" className="text-xs text-gray-600">
          Search Primitives
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="primitive-search"
            placeholder="Search by name, type, or usage..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Primitives List */}
      <div className="border rounded-lg">
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : Object.keys(filteredGroupedPrimitives).length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-gray-500">
                {searchQuery ? 'No matching primitives found' : 'No primitives available'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {categoryOrder
                .filter((category) => filteredGroupedPrimitives[category])
                .map((category) => (
                  <Collapsible
                    key={category}
                    open={expandedCategories.has(category)}
                    onOpenChange={() => toggleCategory(category)}
                  >
                    <CollapsibleTrigger className="w-full p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {expandedCategories.has(category) ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                          <span className="font-medium text-sm">{categoryLabels[category]}</span>
                          <Badge variant="outline" className="text-xs">
                            {filteredGroupedPrimitives[category].length}
                          </Badge>
                        </div>
                        <span className="text-xs text-gray-500">
                          {
                            filteredGroupedPrimitives[category].filter((p) =>
                              selectedPrimitiveIds.includes(p.primitive_id)
                            ).length
                          }{' '}
                          selected
                        </span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="divide-y">
                        {filteredGroupedPrimitives[category].map((primitive) => (
                          <div
                            key={primitive.primitive_id}
                            className="p-3 pl-11 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                id={`primitive-${primitive.primitive_id}`}
                                checked={selectedPrimitiveIds.includes(primitive.primitive_id)}
                                onCheckedChange={() => handleTogglePrimitive(primitive.primitive_id)}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <label
                                  htmlFor={`primitive-${primitive.primitive_id}`}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <span className="text-sm font-medium">
                                    {primitive.primitive_name}
                                  </span>
                                  {(primitive.best_for || primitive.avoid_for || primitive.example) && (
                                    <HoverCard>
                                      <HoverCardTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-4 w-4 p-0"
                                        >
                                          <Info className="h-3 w-3 text-gray-400" />
                                        </Button>
                                      </HoverCardTrigger>
                                      <HoverCardContent className="w-80" side="right">
                                        <div className="space-y-2">
                                          <h4 className="font-semibold text-sm">
                                            {primitive.primitive_name}
                                          </h4>
                                          {primitive.best_for && (
                                            <div>
                                              <p className="text-xs font-medium text-green-700">
                                                Best for:
                                              </p>
                                              <p className="text-xs text-gray-600">
                                                {primitive.best_for}
                                              </p>
                                            </div>
                                          )}
                                          {primitive.avoid_for && (
                                            <div>
                                              <p className="text-xs font-medium text-red-700">
                                                Avoid for:
                                              </p>
                                              <p className="text-xs text-gray-600">
                                                {primitive.avoid_for}
                                              </p>
                                            </div>
                                          )}
                                          {primitive.example && (
                                            <div>
                                              <p className="text-xs font-medium text-blue-700">
                                                Example:
                                              </p>
                                              <p className="text-xs text-gray-600 italic">
                                                {primitive.example}
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      </HoverCardContent>
                                    </HoverCard>
                                  )}
                                </label>
                                <code className="text-xs text-gray-500">
                                  {primitive.primitive_id}
                                </code>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
