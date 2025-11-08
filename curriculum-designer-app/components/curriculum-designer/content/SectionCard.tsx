'use client';

/**
 * SectionCard Component
 * Displays an individual reading content section with actions for editing and regeneration
 */

import { useState } from 'react';
import { Pencil, RefreshCw, Eye, Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useRegenerateSection } from '@/lib/curriculum-authoring/content-hooks';
import type { ReadingSection } from '@/types/content';

interface SectionCardProps {
  section: ReadingSection;
  subskillId: string;
  versionId?: string;
  onEdit?: (section: ReadingSection) => void;
  onVisualClick?: (section: ReadingSection) => void;
}

export function SectionCard({
  section,
  subskillId,
  versionId = 'v1',
  onEdit,
  onVisualClick,
}: SectionCardProps) {
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPrimitives, setShowPrimitives] = useState(false);

  const regenerateMutation = useRegenerateSection();

  const handleRegenerate = async () => {
    try {
      await regenerateMutation.mutateAsync({
        subskillId,
        sectionId: section.section_id,
        versionId,
        customPrompt: customPrompt || undefined,
      });
      setCustomPrompt('');
      setShowCustomPrompt(false);
    } catch (error) {
      console.error('Failed to regenerate section:', error);
    }
  };

  // Helper to get primitive count by type
  const getPrimitiveTypeCounts = () => {
    const counts: Record<string, number> = {};
    section.interactive_primitives.forEach((primitive) => {
      counts[primitive.type] = (counts[primitive.type] || 0) + 1;
    });
    return counts;
  };

  const primitiveTypeCounts = getPrimitiveTypeCounts();
  const totalPrimitives = section.interactive_primitives.length;

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                Section {section.section_order}
              </Badge>
              {section.has_visual_snippet && (
                <Badge variant="default" className="bg-purple-500 text-xs">
                  <Eye className="w-3 h-3 mr-1" />
                  Has Visual
                </Badge>
              )}
              {totalPrimitives > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {totalPrimitives} Interactive{totalPrimitives !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <CardTitle className="text-xl">{section.heading}</CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Content */}
        <div className="prose prose-sm max-w-none">
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {section.content_text}
          </p>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Key Terms ({section.key_terms.length})</h4>
            <div className="flex flex-wrap gap-1">
              {section.key_terms.length > 0 ? (
                section.key_terms.map((term, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {term}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-gray-400">None</span>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Concepts ({section.concepts_covered.length})</h4>
            <div className="flex flex-wrap gap-1">
              {section.concepts_covered.length > 0 ? (
                section.concepts_covered.map((concept, index) => (
                  <Badge key={index} variant="outline" className="text-xs bg-green-50">
                    {concept}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-gray-400">None</span>
              )}
            </div>
          </div>
        </div>

        {/* Interactive Primitives Preview */}
        {totalPrimitives > 0 && (
          <Collapsible open={showPrimitives} onOpenChange={setShowPrimitives}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span className="text-sm font-medium">
                  Interactive Elements ({totalPrimitives})
                </span>
                {showPrimitives ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(primitiveTypeCounts).map(([type, count]) => (
                  <div
                    key={type}
                    className="p-2 border rounded-lg bg-gray-50 text-xs"
                  >
                    <div className="font-medium capitalize">
                      {type.replace(/_/g, ' ')}
                    </div>
                    <div className="text-gray-500">{count} item{count !== 1 ? 's' : ''}</div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Regeneration Success */}
        {regenerateMutation.isSuccess && (
          <Alert>
            <AlertDescription>
              Section regenerated successfully!
            </AlertDescription>
          </Alert>
        )}

        {/* Regeneration Error */}
        {regenerateMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              Failed to regenerate: {(regenerateMutation.error as Error)?.message || 'Unknown error'}
            </AlertDescription>
          </Alert>
        )}

        {/* Custom Prompt Input */}
        {showCustomPrompt && (
          <div className="space-y-2 pt-2 border-t">
            <label className="text-sm font-medium text-gray-700">
              Custom Regeneration Instructions (optional)
            </label>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="E.g., 'Add more examples with toys', 'Make it simpler', 'Focus on real-world applications'"
              rows={2}
              className="text-sm"
            />
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        {/* Edit Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit?.(section)}
          disabled={regenerateMutation.isPending}
        >
          <Pencil className="w-4 h-4 mr-2" />
          Edit
        </Button>

        {/* Regenerate Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (showCustomPrompt) {
              handleRegenerate();
            } else {
              setShowCustomPrompt(true);
            }
          }}
          disabled={regenerateMutation.isPending}
        >
          {regenerateMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Regenerating...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              {showCustomPrompt ? 'Confirm Regenerate' : 'Regenerate'}
            </>
          )}
        </Button>

        {/* Cancel Custom Prompt */}
        {showCustomPrompt && !regenerateMutation.isPending && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowCustomPrompt(false);
              setCustomPrompt('');
            }}
          >
            Cancel
          </Button>
        )}

        {/* Visual Snippet Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onVisualClick?.(section)}
          disabled={regenerateMutation.isPending}
          className="ml-auto"
        >
          {section.has_visual_snippet ? (
            <>
              <Eye className="w-4 h-4 mr-2" />
              View Visual
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Visual
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
