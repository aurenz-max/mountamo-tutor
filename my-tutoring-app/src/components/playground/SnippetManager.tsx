import React, { useState } from 'react';
import { type CodeSnippet } from '@/lib/playground-api';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Folder, Save, Play, Edit, Trash, ChevronDown, ChevronUp } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SnippetManagerProps {
  snippets: CodeSnippet[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onLoad: (snippet: CodeSnippet) => Promise<boolean>;
  onEdit: (snippet: CodeSnippet) => void;
  onDelete: (snippetId: string) => Promise<boolean>;
  onCreateNew: () => void;
}

const SnippetManager: React.FC<SnippetManagerProps> = ({
  snippets,
  isLoading,
  onRefresh,
  onLoad,
  onEdit,
  onDelete,
  onCreateNew
}) => {
  return (
    <div className="p-4 flex-1 overflow-y-auto">
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-semibold">My Saved Sketches</h3>
        <Button 
          size="sm"
          variant="outline"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : snippets.length === 0 ? (
        <EmptyState onCreateNew={onCreateNew} />
      ) : (
        <SnippetList 
          snippets={snippets} 
          onLoad={onLoad} 
          onEdit={onEdit} 
          onDelete={onDelete} 
        />
      )}
    </div>
  );
};

// Component for the empty state
const EmptyState: React.FC<{ onCreateNew: () => void }> = ({ onCreateNew }) => {
  return (
    <div className="text-center py-10 border rounded-lg">
      <Folder className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
      <p className="text-muted-foreground">No saved sketches yet</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onCreateNew}
        className="mt-4"
      >
        <Save className="h-4 w-4 mr-2" />
        Save Current Code
      </Button>
    </div>
  );
};

// Component for the list of snippets
const SnippetList: React.FC<{
  snippets: CodeSnippet[];
  onLoad: (snippet: CodeSnippet) => Promise<boolean>;
  onEdit: (snippet: CodeSnippet) => void;
  onDelete: (snippetId: string) => Promise<boolean>;
}> = ({ snippets, onLoad, onEdit, onDelete }) => {
  return (
    <div className="space-y-4">
      {snippets.map(snippet => (
        <SnippetCard 
          key={snippet.id} 
          snippet={snippet}
          onLoad={onLoad}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

// Component for an individual snippet card
const SnippetCard: React.FC<{
  snippet: CodeSnippet;
  onLoad: (snippet: CodeSnippet) => Promise<boolean>;
  onEdit: (snippet: CodeSnippet) => void;
  onDelete: (snippetId: string) => Promise<boolean>;
}> = ({ snippet, onLoad, onEdit, onDelete }) => {
  // State for showing/hiding metadata details
  const [showMetadata, setShowMetadata] = useState<boolean>(false);
  
  // Check if snippet has any syllabus metadata
  const hasMetadata = snippet.unit_id || snippet.unit_title || 
                     snippet.skill_id || snippet.skill_description ||
                     snippet.subskill_id || snippet.subskill_description;
  
  return (
    <Card key={snippet.id} className="p-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="font-medium">{snippet.title}</h4>
          {snippet.description && (
            <p className="text-sm text-muted-foreground mt-1">{snippet.description}</p>
          )}
          {snippet.tags && snippet.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {snippet.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-2">
            Last updated: {new Date(snippet.updated_at).toLocaleString()}
          </div>
          
          {/* Show Syllabus Metadata if available */}
          {hasMetadata && (
            <div className="mt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-0 h-6 text-xs text-muted-foreground flex items-center"
                onClick={() => setShowMetadata(!showMetadata)}
              >
                {showMetadata ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Hide syllabus info
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Show syllabus info
                  </>
                )}
              </Button>
              
              {showMetadata && (
                <div className="mt-2 text-xs border rounded-md p-2 bg-muted/30">
                  {snippet.unit_id && (
                    <p className="flex items-start">
                      <span className="font-medium mr-1">Unit ID:</span> {snippet.unit_id}
                    </p>
                  )}
                  {snippet.unit_title && (
                    <p className="flex items-start">
                      <span className="font-medium mr-1">Unit Title:</span> {snippet.unit_title}
                    </p>
                  )}
                  {snippet.skill_id && (
                    <p className="flex items-start">
                      <span className="font-medium mr-1">Skill ID:</span> {snippet.skill_id}
                    </p>
                  )}
                  {snippet.skill_description && (
                    <p className="flex items-start">
                      <span className="font-medium mr-1">Skill:</span> {snippet.skill_description}
                    </p>
                  )}
                  {snippet.subskill_id && (
                    <p className="flex items-start">
                      <span className="font-medium mr-1">Subskill ID:</span> {snippet.subskill_id}
                    </p>
                  )}
                  {snippet.subskill_description && (
                    <p className="flex items-start">
                      <span className="font-medium mr-1">Subskill:</span> {snippet.subskill_description}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex space-x-2">
          <Button 
            size="icon" 
            variant="ghost"
            onClick={() => onLoad(snippet)}
            title="Load snippet"
          >
            <Play className="h-4 w-4" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost"
            onClick={() => onEdit(snippet)}
            title="Edit snippet"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                size="icon" 
                variant="ghost"
                title="Delete snippet"
              >
                <Trash className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete snippet</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{snippet.title}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onDelete(snippet.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
};

export default SnippetManager;