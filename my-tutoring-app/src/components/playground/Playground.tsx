'use client'; 

import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { markedHighlight } from 'marked-highlight';
import apiClient from '@/lib/playground-api';
import { type CodeSnippet, type SaveCodePayload } from '@/lib/playground-api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw,
  Play,
  Square,
  Trash2,
  Send,
  Pencil,
  Maximize,
  Save,
  Folder,
  Trash,
  Edit,
  X,
  Check,
  Plus
} from 'lucide-react';
import CodeEditor from './CodeEditor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

// Markdown formatting function with syntax highlighting
marked.use(markedHighlight({
  async: true,
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
}));

// Chat state enums
enum ChatState {
  IDLE,
  GENERATING,
  THINKING,
  CODING,
}

const EMPTY_CODE = `function setup() {
  // Setup code goes here.
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  // Frame drawing code goes here.
  background(220);
  
  // Add your drawing code here
  fill(41, 98, 255);
  noStroke();
  ellipse(mouseX, mouseY, 60, 60);
}`;

const p5jsCdnUrl = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.3/p5.min.js';

// The main component
export default function P5jsPlayground() {
  // Get student ID from user session or context
  // For this example, we'll use a placeholder
  const studentId = 1001; // Replace with actual user ID from auth context
  
  const [chatState, setChatState] = useState<ChatState>(ChatState.IDLE);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>("gemini");
  const [inputMessage, setInputMessage] = useState<string>('');
  const [code, setCode] = useState<string>(EMPTY_CODE);
  const [messages, setMessages] = useState<Array<any>>([]);
  const [codeHasChanged, setCodeHasChanged] = useState<boolean>(true);
  const [codeNeedsReload, setCodeNeedsReload] = useState<boolean>(false);
  const [codeSyntaxHtml, setCodeSyntaxHtml] = useState<string>('');
  
  // New state for code snippets
  const [snippets, setSnippets] = useState<CodeSnippet[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState<boolean>(false);
  const [currentSnippet, setCurrentSnippet] = useState<SaveCodePayload>({
    title: '',
    code: '',
    description: '',
    tags: []
  });
  const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState<string>('');
  const [snippetError, setSnippetError] = useState<string>('');

  const anchorRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastErrorRef = useRef<string>('');
  const reportedErrorRef = useRef<boolean>(false);

  // Function to load snippets
  const loadSnippets = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getCodeSnippets(studentId);
      setSnippets(data);
    } catch (error) {
      console.error('Error loading snippets:', error);
      addMessage('error', `Error loading snippets: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load snippets when the user switches to the My Snippets tab
  useEffect(() => {
    if (activeTab === 'snippets') {
      loadSnippets();
    }
  }, [activeTab]);

  // Function to get code block from message
  const getCode = (text: string) => {
    const startMark = '```javascript';
    const codeStart = text.indexOf(startMark);
    let codeEnd = text.lastIndexOf('```');

    if (codeStart > -1) {
      if (codeEnd < 0) {
        codeEnd = undefined;
      }
      return text.substring(codeStart + startMark.length, codeEnd);
    }
    return '';
  };

  // Function to handle runtime errors
  const runtimeErrorHandler = (errorMessage: string) => {
    reportedErrorRef.current = true;

    if (lastErrorRef.current !== errorMessage) {
      addMessage('system-ask', errorMessage);
    }
    lastErrorRef.current = errorMessage;
  };

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (msg: MessageEvent) => {
      if (msg.data && typeof msg.data === 'string') {
        try {
          const message = JSON.parse(msg.data).message;
          runtimeErrorHandler(message);
        } catch (e) {
          console.error(e);
        }
      }
    };

    window.addEventListener('message', handleMessage, false);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Run code in iframe with improved canvas size
  const runCode = (codeToRun: string) => {
    reportedErrorRef.current = false;
    lastErrorRef.current = '';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>p5.js Sketch</title>
          <style>
              body { 
                margin: 0; 
                padding: 0; 
                overflow: hidden; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                height: 100vh; 
                width: 100vw;
                background-color: #ffffff; 
              }
              canvas { 
                display: block; 
                margin: 0 auto; 
              }
              .console { 
                position: absolute; 
                bottom: 0; 
                left: 0; 
                width: 100%; 
                background: rgba(0, 0, 0, 0.8); 
                padding: 1em; 
                margin: 0; 
                color: #f44336; 
                font-family: 'Consolas', monospace; 
                border-top: 2px solid #f44336; 
              }
          </style>
          <script src="${p5jsCdnUrl}"></script>
          <script>
            window.addEventListener('message', (event) => {
                if (event.data === 'stop' && typeof noLoop === 'function') { 
                  noLoop(); 
                  console.log('Sketch stopped (noLoop)'); 
                } else if (event.data === 'resume' && typeof loop === 'function') { 
                  loop(); 
                  console.log('Sketch resumed (loop)'); 
                }
            }, false);
            
            // Capture console errors and forward them to the parent window
            window.onerror = function(message, source, lineno, colno, error) {
              parent.postMessage(
                JSON.stringify({
                  message: 'Error: ' + message + ' (Line: ' + lineno + ', Col: ' + colno + ')'
                }),
                '*'
              );
              return true;
            };
            
            // Enhanced createCanvas to support flexible sizing
            const originalCreateCanvas = window.createCanvas;
            window.createCanvas = function() {
              let args = Array.from(arguments);
              
              // Make canvas use full container size if windowWidth/windowHeight is used
              if (args[0] === windowWidth) {
                args[0] = window.innerWidth;
              }
              if (args[1] === windowHeight) {
                args[1] = window.innerHeight;
              }
              
              return originalCreateCanvas.apply(this, args);
            };

            // Handle window resize
            window.addEventListener('resize', function() {
              if (typeof windowResized === 'function') {
                windowResized();
              }
            });
            
            // Capture console.log output
            const originalConsoleLog = console.log;
            console.log = function() {
              originalConsoleLog.apply(console, arguments);
            };
          </script>
      </head>
      <body>
          <script>
              // Basic error handling within the iframe
              try {
                  ${codeToRun}
              } catch (error) {
                  console.error("Error in sketch:", error);
                  parent.postMessage(
                    JSON.stringify({
                      message: error.toString()
                    }),
                    '*'
                  );
                  document.body.innerHTML = '<pre class="console">Error: ' + error.message + '\\n\\nCheck the browser console for details or ask Gemini to fix it.</pre>';
              }
          </script>
      </body>
      </html>
    `;

    if (iframeRef.current) {
      iframeRef.current.setAttribute('srcdoc', htmlContent);
    }
    setCodeNeedsReload(false);
  };

  // Function to update code
  const updateCode = async (newCode: string) => {
    setCode(newCode);
    runCode(newCode);

    const formattedCode = await marked.parse('```javascript\n' + newCode + '\n```');
    setCodeSyntaxHtml(formattedCode);
  };

  // Function to add message
  const addMessage = (role: string, message: string) => {
    const newMessage = {
      role,
      text: message,
      thinking: '',
    };

    setMessages((prev) => [...prev, newMessage]);
    setTimeout(() => scrollToTheEnd(), 100);
    
    return newMessage;
  };

  // Function to scroll to the end of messages
  const scrollToTheEnd = () => {
    if (anchorRef.current) {
      anchorRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    }
  };

  // Function to handle saving a snippet
  const handleSaveSnippet = async () => {
    try {
      // Validate inputs
      if (!currentSnippet.title.trim()) {
        setSnippetError('Title is required');
        return;
      }

      setIsLoading(true);
      
      // Prepare the payload
      const payload: SaveCodePayload = {
        title: currentSnippet.title.trim(),
        code: code,
        description: currentSnippet.description?.trim() || '',
        tags: currentSnippet.tags || []
      };
      
      // Determine if we're creating a new snippet or updating an existing one
      let result;
      if (editingSnippetId) {
        result = await apiClient.updateCodeSnippet(editingSnippetId, payload, studentId);
        addMessage('system', `Snippet "${payload.title}" has been updated.`);
      } else {
        result = await apiClient.saveCodeSnippet(payload, studentId);
        addMessage('system', `Snippet "${payload.title}" has been saved.`);
      }
      
      // Reset the form
      setCurrentSnippet({
        title: '',
        code: '',
        description: '',
        tags: []
      });
      setTagInput('');
      setEditingSnippetId(null);
      setSaveDialogOpen(false);
      setSnippetError('');
      
      // Refresh the snippets list
      await loadSnippets();
      
      // Switch to the snippets tab
      setActiveTab('snippets');
    } catch (error) {
      console.error('Error saving snippet:', error);
      setSnippetError(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to load a snippet
  const handleLoadSnippet = async (snippet: CodeSnippet) => {
    try {
      setIsLoading(true);
      
      // Load the code
      await updateCode(snippet.code);
      
      // Switch to the code tab
      setActiveTab('code');
      
      addMessage('system', `Loaded snippet: "${snippet.title}"`);
      setCodeHasChanged(false);
    } catch (error) {
      console.error('Error loading snippet:', error);
      addMessage('error', `Error loading snippet: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to delete a snippet
  const handleDeleteSnippet = async (snippetId: string) => {
    try {
      setIsLoading(true);
      
      const result = await apiClient.deleteCodeSnippet(snippetId, studentId);
      
      if (result.success) {
        addMessage('system', 'Snippet deleted successfully');
        
        // Refresh the snippets list
        await loadSnippets();
      } else {
        addMessage('error', 'Failed to delete snippet');
      }
    } catch (error) {
      console.error('Error deleting snippet:', error);
      addMessage('error', `Error deleting snippet: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to edit a snippet
  const handleEditSnippet = (snippet: CodeSnippet) => {
    setCurrentSnippet({
      title: snippet.title,
      code: snippet.code,
      description: snippet.description || '',
      tags: snippet.tags || []
    });
    setEditingSnippetId(snippet.id);
    setSaveDialogOpen(true);
  };

  // Function to add a tag
  const handleAddTag = () => {
    if (tagInput.trim() && !currentSnippet.tags?.includes(tagInput.trim())) {
      setCurrentSnippet(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  // Function to remove a tag
  const handleRemoveTag = (tag: string) => {
    setCurrentSnippet(prev => ({
      ...prev,
      tags: prev.tags?.filter(t => t !== tag) || []
    }));
  };

  // Function to send message to backend using the apiClient
  const sendMessageAction = async (message?: string, role?: string) => {
    if (chatState !== ChatState.IDLE) return;
  
    setChatState(ChatState.GENERATING);
  
    let msg = '';
    if (message) {
      msg = message.trim();
    } else {
      msg = inputMessage.trim();
      setInputMessage('');
    }
  
    if (msg.length === 0) {
      setChatState(ChatState.IDLE);
      return;
    }
  
    const msgRole = role ? role.toLowerCase() : 'user';
  
    if (msgRole === 'user' && msg) {
      addMessage(msgRole, msg);
    }
  
    // Call the backend API using our apiClient
    try {
      // Filter out system messages from history to keep only user-assistant exchanges
      const conversationHistory = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, text: m.text }));
  
      // Simplified approach - always send the current code
      // The backend will always include the code in the user's message
      const payload = {
        message: msg,
        role: msgRole,
        code: code,  // Always send the current code
        codeHasChanged: codeHasChanged,
        conversationHistory: conversationHistory
      };
  
      // Log payload for debugging
      console.log('Sending to Gemini API:', {
        messageLength: msg.length,
        codeLength: code?.length || 0,
        historyLength: conversationHistory.length || 0,
        codeHasChanged: codeHasChanged
      });
  
      // Start with "thinking" state
      setChatState(ChatState.THINKING);
      
      // Create a message with thinking placeholder
      const responseMessage = addMessage('assistant', 'Processing your request...');
      
      // Use the apiClient to call the backend
      const data = await apiClient.sendToGemini(payload);
      
      // Set to coding state
      setChatState(ChatState.CODING);
      
      // Update the message with the actual response
      if (responseMessage) {
        // Update messages to include thinking info if available
        if (data.thinking_info && data.thinking_info.trim().length > 0) {
          // Update the message to include thinking info
          setMessages(prevMessages => {
            return prevMessages.map(msg => {
              if (msg === responseMessage) {
                return {
                  ...msg,
                  text: data.explanation || 'Done',
                  thinking: data.thinking_info
                };
              }
              return msg;
            });
          });
        } else {
          // Just update the text if no thinking info is provided
          setMessages(prevMessages => {
            return prevMessages.map(msg => {
              if (msg === responseMessage) {
                return {
                  ...msg,
                  text: data.explanation || 'Done'
                };
              }
              return msg;
            });
          });
        }
      }
      
      // Check if we got code back
      if (data.code && data.code.trim().length > 0) {
        console.log('Received code update:', {
          length: data.code.length,
          firstLine: data.code.split('\n')[0]
        });
        
        // Update code with the new version
        await updateCode(data.code);
      } else {
        // Log when no code update is received
        console.log('No code update in response');
        
        // Check if "no code update" is explicitly mentioned in the explanation
        if (data.explanation && data.explanation.includes("no code update")) {
          console.log('Model explicitly mentioned no code update');
        }
        
        addMessage('system', 'There is no new code update.');
      }
  
      setCodeHasChanged(false);
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      addMessage('error', `Error: ${error.message}`);
    }
  
    setChatState(ChatState.IDLE);
    scrollToTheEnd();
    
    // Focus back on the input field
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };
  // Actions
  const playAction = () => {
    if (isRunning) return;
    if (codeHasChanged) {
      runCode(code);
    }
    setIsRunning(true);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage('resume', '*');
    }
  };

  const stopAction = () => {
    if (!isRunning) return;
    setIsRunning(false);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage('stop', '*');
    }
  };

  const clearAction = () => {
    updateCode(EMPTY_CODE);
    setMessages([]);
    setCodeHasChanged(true);
  };

  const codeEditedAction = async (newCode: string) => {
    if (chatState !== ChatState.IDLE) return;

    setCode(newCode);
    setCodeHasChanged(true);
    setCodeNeedsReload(true);

    const formattedCode = await marked.parse('```javascript\n' + newCode + '\n```');
    setCodeSyntaxHtml(formattedCode);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      sendMessageAction();
    }
  };

  const reloadCodeAction = () => {
    runCode(code);
    setIsRunning(true);
  };
  
  const toggleFullScreen = () => {
    const previewPanel = document.querySelector('.preview-panel');
    if (!previewPanel) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      previewPanel.requestFullscreen();
    }
  };
  
  const openSaveDialog = () => {
    // Initialize with current code
    setCurrentSnippet(prev => ({
      ...prev,
      code: code,
      title: prev.title || generateTitleFromCode(code)
    }));
    setSaveDialogOpen(true);
  };
  
  const generateTitleFromCode = (code: string): string => {
    // Try to extract a title from the code comments
    const lines = code.split('\n').map(line => line.trim());
    
    // Look for comments at the top of the file
    for (const line of lines) {
      if (line.startsWith('//')) {
        const comment = line.substring(2).trim();
        if (comment.length > 3 && comment.length < 50) {
          return comment;
        }
      }
    }
    
    // Default title if no good comment is found
    return `P5js Sketch - ${new Date().toLocaleDateString()}`;
  };

  // Welcome message
  useEffect(() => {
    addMessage('assistant', 'Welcome to P5.js Playground! Ask me to create interactive graphics and animations for you. I can help you with p5.js code or explain how things work.');
  }, []);

  // Initialize on mount
  useEffect(() => {
    updateCode(EMPTY_CODE);
  }, []);

  return (
    <div className="h-full w-full">
      <div className="grid grid-cols-12 gap-4 h-full">
        {/* Editor/Chat Panel */}
        <div className="col-span-5 h-full flex flex-col">
          <Card className="h-full flex flex-col overflow-hidden">
            <Tabs defaultValue="gemini" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="px-4 pt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="gemini" className="flex-1">
                    Gemini
                  </TabsTrigger>
                  <TabsTrigger value="code" className="flex-1">
                    Code {codeHasChanged && <Pencil className="h-4 w-4 ml-1 inline" />}
                  </TabsTrigger>
                  <TabsTrigger value="snippets" className="flex-1">
                    My Snippets
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="gemini" className="flex-1 flex flex-col overflow-hidden m-0 p-0">
                <div className="flex-1 overflow-y-auto px-4 py-2">
                  {messages.map((msg, index) => (
                    <div key={index} className={`mb-4 p-3 rounded-lg ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground ml-8' 
                        : msg.role === 'assistant' 
                          ? 'bg-muted border mr-8'
                          : 'bg-muted/50 text-center mx-8 text-sm'
                    }`}>
                      {msg.thinking && (
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer font-medium">Thinking Info</summary>
                          <div className="p-2 mt-1 bg-background/80 rounded text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                            {msg.thinking}
                          </div>
                        </details>
                      )}
                      <div className="text-sm">
                        {msg.text}
                      </div>
                      {msg.role === 'system-ask' && (
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="mt-2"
                          onClick={() => sendMessageAction(msg.text, 'SYSTEM')}
                        >
                          Improve
                        </Button>
                      )}
                    </div>
                  ))}
                  <div ref={anchorRef} />
                </div>

                <Separator />
                
                <div className="p-4">
                  {chatState !== ChatState.IDLE && (
                    <div className="flex items-center text-sm text-muted-foreground mb-2">
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      {chatState === ChatState.GENERATING ? 'Generating...' : 
                       chatState === ChatState.THINKING ? 'Thinking...' : 
                       'Coding...'}
                    </div>
                  )}
                  <div className="flex space-x-2">
                    <Input
                      ref={inputRef}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      placeholder="Ask Gemini to create p5.js code for you..."
                      disabled={chatState !== ChatState.IDLE}
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      disabled={chatState !== ChatState.IDLE || inputMessage.trim() === ''}
                      onClick={() => sendMessageAction()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="code" className="flex-1 flex flex-col overflow-hidden m-0 p-0">
                <div className="p-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openSaveDialog}
                    disabled={chatState !== ChatState.IDLE}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Code
                  </Button>
                </div>
                {/* Replace the broken code editor with our fixed one */}
                <CodeEditor 
                  code={code}
                  onChange={codeEditedAction}
                  readOnly={chatState !== ChatState.IDLE}
                  codeSyntaxHtml={codeSyntaxHtml}
                />
              </TabsContent>
              
              <TabsContent value="snippets" className="flex-1 flex flex-col overflow-hidden m-0 p-0">
                <div className="p-4 flex-1 overflow-y-auto">
                  <div className="mb-4 flex justify-between items-center">
                    <h3 className="text-lg font-semibold">My Saved Sketches</h3>
                    <Button 
                      size="sm"
                      variant="outline"
                      onClick={() => loadSnippets()}
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
                    <div className="text-center py-10 border rounded-lg">
                      <Folder className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No saved sketches yet</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openSaveDialog}
                        className="mt-4"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Current Code
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {snippets.map(snippet => (
                        <Card key={snippet.id} className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
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
                            </div>
                            <div className="flex space-x-2">
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => handleLoadSnippet(snippet)}
                                title="Load snippet"
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => handleEditSnippet(snippet)}
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
                                      onClick={() => handleDeleteSnippet(snippet.id)}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Canvas Preview Panel */}
        <div className="col-span-7 h-full flex flex-col preview-panel">
          <Card className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 relative">
              <iframe
                ref={iframeRef}
                className="absolute inset-0 w-full h-full border-0"
                title="P5.js Canvas Preview"
              />
            </div>
            
            <Separator />
            
            <div className="p-2 flex items-center justify-center space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={reloadCodeAction}
                      className={codeNeedsReload ? "border-amber-500" : ""}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reload code changes</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={playAction}
                      disabled={isRunning}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Run sketch</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={stopAction}
                      disabled={!isRunning}
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Stop sketch</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={toggleFullScreen}
                    >
                      <Maximize className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Toggle fullscreen</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={clearAction}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reset playground</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </Card>
        </div>
      </div>
      
      {/* Save Snippet Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSnippetId ? 'Edit Snippet' : 'Save Snippet'}</DialogTitle>
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
                onChange={(e) => setCurrentSnippet(prev => ({ ...prev, title: e.target.value }))}
                placeholder="My awesome sketch"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={currentSnippet.description}
                onChange={(e) => setCurrentSnippet(prev => ({ ...prev, description: e.target.value }))}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
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
                        onClick={() => handleRemoveTag(tag)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            {snippetError && (
              <div className="text-red-500 text-sm">{snippetError}</div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSnippet} disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {editingSnippetId ? 'Update' : 'Save'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}