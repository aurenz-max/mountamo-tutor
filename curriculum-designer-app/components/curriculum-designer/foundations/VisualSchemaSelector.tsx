'use client';

/**
 * Visual Schema Selector
 * Checkbox list of available visual schemas grouped by category
 */

import { useState, useMemo } from 'react';
import { Search, X, ChevronDown, ChevronRight, Info, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useVisualSchemas } from '@/lib/curriculum-authoring/foundations-hooks';
import type { VisualSchemaCategory } from '@/types/foundations';

interface VisualSchemaSelectorProps {
  selectedSchemas: string[];
  onChange: (schemas: string[]) => void;
}

export function VisualSchemaSelector({
  selectedSchemas,
  onChange,
}: VisualSchemaSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const { data: visualSchemas, isLoading } = useVisualSchemas();

  // Filter schemas based on search query
  const filteredCategories = useMemo(() => {
    if (!visualSchemas) return [];
    if (!searchQuery) return visualSchemas.categories;

    const query = searchQuery.toLowerCase();
    return visualSchemas.categories
      .map((category) => ({
        ...category,
        schemas: category.schemas.filter((schema) =>
          schema.toLowerCase().includes(query)
        ),
      }))
      .filter((category) => category.schemas.length > 0);
  }, [visualSchemas, searchQuery]);

  // Toggle category expansion
  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  // Expand all categories
  const expandAll = () => {
    if (!visualSchemas) return;
    setExpandedCategories(new Set(visualSchemas.categories.map((c) => c.category)));
  };

  // Collapse all categories
  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  // Toggle schema selection
  const handleToggleSchema = (schema: string) => {
    if (selectedSchemas.includes(schema)) {
      onChange(selectedSchemas.filter((s) => s !== schema));
    } else {
      onChange([...selectedSchemas, schema]);
    }
  };

  // Select all schemas
  const selectAll = () => {
    if (!visualSchemas) return;
    onChange(visualSchemas.all_schemas);
  };

  // Clear all selections
  const clearAll = () => {
    onChange([]);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading visual schemas...</span>
      </div>
    );
  }

  if (!visualSchemas) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No visual schemas available
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>Visual Schema Selection</CardTitle>
          <CardDescription>
            Select visual schemas recommended by AI or add your own. These guide problem generation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search schemas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Selection Summary */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {selectedSchemas.length} of {visualSchemas.all_schemas.length} selected
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Collapse All
              </Button>
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={clearAll}>
                Clear All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schema Categories */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-2">
          {filteredCategories.map((category) => (
            <Collapsible
              key={category.category}
              open={expandedCategories.has(category.category)}
              onOpenChange={() => toggleCategory(category.category)}
            >
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {expandedCategories.has(category.category) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <CardTitle className="text-base">{category.category}</CardTitle>
                        <Badge variant="secondary">
                          {category.schemas.filter((s) => selectedSchemas.includes(s)).length}/{category.schemas.length}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription className="text-left">
                      {category.description}
                    </CardDescription>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="grid gap-3">
                      {category.schemas.map((schema) => (
                        <div
                          key={schema}
                          className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            id={`schema-${schema}`}
                            checked={selectedSchemas.includes(schema)}
                            onCheckedChange={() => handleToggleSchema(schema)}
                          />
                          <label
                            htmlFor={`schema-${schema}`}
                            className="flex-1 text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {schema}
                          </label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>

      {/* No results */}
      {filteredCategories.length === 0 && searchQuery && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No schemas match "{searchQuery}"
          </CardContent>
        </Card>
      )}
    </div>
  );
}
