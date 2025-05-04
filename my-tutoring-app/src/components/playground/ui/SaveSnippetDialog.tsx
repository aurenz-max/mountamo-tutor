import React from 'react';
import { type SaveCodePayload } from '@/lib/playground-api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Check, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface SaveSnippetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSnippet: SaveCodePayload;
  setCurrentSnippet: (snippet: SaveCodePayload) => void;
  tagInput: string;
  setTagInput: (tag: string) => void;
  onAddTag: (tag: string) => boolean;
  onRemoveTag: (tag: string) => void;
  onSave: () => Promise<boolean>;
  isEditing: boolean;
  error: string;
  isLoading: boolean;
}

const SaveSnippetDialog: React.FC<SaveSnippetDialogProps> = ({
  open,
  onOpenChange,
  currentSnippet,
  setCurrentSnippet,
  tagInput,
  setTagInput,
  onAddTag,
  onRemoveTag,
  onSave,
  isEditing,
  error,
  isLoading
}) => {
  // Handle tag input keydown (Enter to add)
  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };
  
  // Handle adding a tag
  const handleAddTag = () => {
    if (onAddTag(tagInput)) {
      setTagInput('');
    }
  };

  // Handle metadata field updates
  const updateMetadataField = (field: string, value: string) => {
    setCurrentSnippet({
      ...currentSnippet,
      [field]: value
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Snippet' : 'Save Snippet'}</DialogTitle>
          <DialogDescription>
            Save your p5.js code for future use
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={currentSnippet.title}
              onChange={(e) => setCurrentSnippet({
                ...currentSnippet,
                title: e.target.value
              })}
              placeholder="My awesome sketch"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={currentSnippet.description}
              onChange={(e) => setCurrentSnippet({
                ...currentSnippet,
                description: e.target.value
              })}
              placeholder="A brief description of what this sketch does"
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (optional)</Label>
            <div className="flex space-x-2">
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag"
                onKeyDown={handleTagKeyDown}
              />
              <Button type="button" size="sm" onClick={handleAddTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {currentSnippet.tags && currentSnippet.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {currentSnippet.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-4 w-4 p-0" 
                      onClick={() => onRemoveTag(tag)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          
          {/* Syllabus Metadata Section (Collapsible) */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="syllabus-metadata">
              <AccordionTrigger className="text-sm">
                Syllabus Metadata (optional)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  {/* Unit Information */}
                  <div className="space-y-2">
                    <Label htmlFor="unit_id">Unit ID</Label>
                    <Input
                      id="unit_id"
                      value={currentSnippet.unit_id || ''}
                      onChange={(e) => updateMetadataField('unit_id', e.target.value)}
                      placeholder="e.g., UNIT-123"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="unit_title">Unit Title</Label>
                    <Input
                      id="unit_title"
                      value={currentSnippet.unit_title || ''}
                      onChange={(e) => updateMetadataField('unit_title', e.target.value)}
                      placeholder="e.g., Introduction to Programming"
                    />
                  </div>
                  
                  {/* Skill Information */}
                  <div className="space-y-2">
                    <Label htmlFor="skill_id">Skill ID</Label>
                    <Input
                      id="skill_id"
                      value={currentSnippet.skill_id || ''}
                      onChange={(e) => updateMetadataField('skill_id', e.target.value)}
                      placeholder="e.g., SKILL-456"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="skill_description">Skill Description</Label>
                    <Textarea
                      id="skill_description"
                      value={currentSnippet.skill_description || ''}
                      onChange={(e) => updateMetadataField('skill_description', e.target.value)}
                      placeholder="e.g., Creating interactive animations"
                      rows={2}
                    />
                  </div>
                  
                  {/* Subskill Information */}
                  <div className="space-y-2">
                    <Label htmlFor="subskill_id">Subskill ID</Label>
                    <Input
                      id="subskill_id"
                      value={currentSnippet.subskill_id || ''}
                      onChange={(e) => updateMetadataField('subskill_id', e.target.value)}
                      placeholder="e.g., SUBSKILL-789"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="subskill_description">Subskill Description</Label>
                    <Textarea
                      id="subskill_description"
                      value={currentSnippet.subskill_description || ''}
                      onChange={(e) => updateMetadataField('subskill_description', e.target.value)}
                      placeholder="e.g., Working with shapes and colors"
                      rows={2}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                {isEditing ? 'Update' : 'Save'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveSnippetDialog;