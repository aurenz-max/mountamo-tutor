import { useState, useCallback } from 'react';
import apiClient from '@/lib/playground-api';
import { type CodeSnippet, type SaveCodePayload } from '@/lib/playground-api';
import SaveSnippetDialog from '../ui/SaveSnippetDialog';

/**
 * Custom hook for managing code snippets
 */
export function useSnippets(
  studentId: number,
  currentCode: string,
  updateCode: (newCode: string) => Promise<void>,
  addSystemMessage: (role: string, message: string) => void
) {
  // State
  const [snippets, setSnippets] = useState<CodeSnippet[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState<boolean>(false);
  const [currentSnippet, setCurrentSnippet] = useState<SaveCodePayload>({
    title: '',
    code: '',
    description: '',
    tags: [],
    // Initialize syllabus metadata fields
    unit_id: '',
    unit_title: '',
    skill_id: '',
    skill_description: '',
    subskill_id: '',
    subskill_description: ''
  });
  const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState<string>('');
  const [snippetError, setSnippetError] = useState<string>('');

  // Function to load snippets
  const loadSnippets = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getCodeSnippets(studentId);
      setSnippets(data);
    } catch (error) {
      console.error('Error loading snippets:', error);
      addSystemMessage('error', `Error loading snippets: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [studentId, addSystemMessage]);

  // Function to save a snippet
  const saveSnippet = useCallback(async (snippet: SaveCodePayload) => {
    try {
      // Validate inputs
      if (!snippet.title.trim()) {
        setSnippetError('Title is required');
        return false;
      }

      setIsLoading(true);
      
      // Prepare the payload
      const payload: SaveCodePayload = {
        title: snippet.title.trim(),
        code: snippet.code,
        description: snippet.description?.trim() || '',
        tags: snippet.tags || [],
        // Include syllabus metadata fields
        unit_id: snippet.unit_id?.trim() || undefined,
        unit_title: snippet.unit_title?.trim() || undefined,
        skill_id: snippet.skill_id?.trim() || undefined,
        skill_description: snippet.skill_description?.trim() || undefined,
        subskill_id: snippet.subskill_id?.trim() || undefined,
        subskill_description: snippet.subskill_description?.trim() || undefined
      };
      
      // Determine if we're creating a new snippet or updating an existing one
      let result;
      if (editingSnippetId) {
        result = await apiClient.updateCodeSnippet(editingSnippetId, payload, studentId);
        addSystemMessage('system', `Snippet "${payload.title}" has been updated.`);
      } else {
        result = await apiClient.saveCodeSnippet(payload, studentId);
        addSystemMessage('system', `Snippet "${payload.title}" has been saved.`);
      }
      
      // Reset the form
      setCurrentSnippet({
        title: '',
        code: '',
        description: '',
        tags: [],
        unit_id: '',
        unit_title: '',
        skill_id: '',
        skill_description: '',
        subskill_id: '',
        subskill_description: ''
      });
      setTagInput('');
      setEditingSnippetId(null);
      setSaveDialogOpen(false);
      setSnippetError('');
      
      // Refresh the snippets list
      await loadSnippets();
      return true;
    } catch (error) {
      console.error('Error saving snippet:', error);
      setSnippetError(`Error: ${error.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [addSystemMessage, editingSnippetId, loadSnippets, studentId]);

  // Function to load a snippet
  const loadSnippet = useCallback(async (snippet: CodeSnippet) => {
    try {
      setIsLoading(true);
      
      // Load the code
      await updateCode(snippet.code);
      
      addSystemMessage('system', `Loaded snippet: "${snippet.title}"`);
      return true;
    } catch (error) {
      console.error('Error loading snippet:', error);
      addSystemMessage('error', `Error loading snippet: ${error.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [addSystemMessage, updateCode]);

  // Function to delete a snippet
  const deleteSnippet = useCallback(async (snippetId: string) => {
    try {
      setIsLoading(true);
      
      const result = await apiClient.deleteCodeSnippet(snippetId, studentId);
      
      if (result.success) {
        addSystemMessage('system', 'Snippet deleted successfully');
        
        // Refresh the snippets list
        await loadSnippets();
        return true;
      } else {
        addSystemMessage('error', 'Failed to delete snippet');
        return false;
      }
    } catch (error) {
      console.error('Error deleting snippet:', error);
      addSystemMessage('error', `Error deleting snippet: ${error.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [addSystemMessage, loadSnippets, studentId]);

  // Function to edit a snippet
  const editSnippet = useCallback((snippet: CodeSnippet) => {
    // Set the form data including syllabus metadata fields
    setCurrentSnippet({
      title: snippet.title,
      code: snippet.code,
      description: snippet.description || '',
      tags: snippet.tags || [],
      unit_id: snippet.unit_id || '',
      unit_title: snippet.unit_title || '',
      skill_id: snippet.skill_id || '',
      skill_description: snippet.skill_description || '',
      subskill_id: snippet.subskill_id || '',
      subskill_description: snippet.subskill_description || ''
    });
    setEditingSnippetId(snippet.id);
    setSaveDialogOpen(true);
  }, []);

  // Function to add a tag
  const addTag = useCallback((tag: string) => {
    if (tag.trim() && !currentSnippet.tags?.includes(tag.trim())) {
      setCurrentSnippet(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tag.trim()]
      }));
      return true;
    }
    return false;
  }, [currentSnippet.tags]);

  // Function to remove a tag
  const removeTag = useCallback((tag: string) => {
    setCurrentSnippet(prev => ({
      ...prev,
      tags: prev.tags?.filter(t => t !== tag) || []
    }));
  }, []);

  // Render the save dialog
  const renderSaveDialog = useCallback(() => {
    return (
      <SaveSnippetDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        currentSnippet={currentSnippet}
        setCurrentSnippet={setCurrentSnippet}
        tagInput={tagInput}
        setTagInput={setTagInput}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onSave={() => saveSnippet(currentSnippet)}
        isEditing={!!editingSnippetId}
        error={snippetError}
        isLoading={isLoading}
      />
    );
  }, [saveDialogOpen, currentSnippet, tagInput, addTag, removeTag, saveSnippet, editingSnippetId, snippetError, isLoading]);

  return {
    snippets,
    isLoading,
    saveDialogOpen,
    setSaveDialogOpen,
    currentSnippet,
    setCurrentSnippet,
    tagInput,
    setTagInput,
    snippetError,
    setSnippetError,
    editingSnippetId,
    setEditingSnippetId,
    loadSnippets,
    saveSnippet,
    loadSnippet,
    deleteSnippet,
    editSnippet,
    addTag,
    removeTag,
    renderSaveDialog
  };
}

export default useSnippets;