# P5.js Playground Architecture and Functionality

This document explains the architecture and functionality of the P5.js Playground application, a creative coding environment that allows users to write, run, and save p5.js sketches with AI assistance.

## System Overview

The P5.js Playground consists of:

1. A React frontend (`Playground.tsx`)
2. A FastAPI backend (`playground.py`)
3. An API client (`playground-api.ts`) that connects them

The application uses Google's Gemini AI to help users generate and modify p5.js code, and stores user code snippets in a Cosmos DB database.

## Key Components

### Frontend (Playground.tsx)

The frontend is a React application with the following main components:

- **Chat Interface**: For interacting with the Gemini AI
- **Code Editor**: For writing and editing p5.js code
- **Live Preview**: An iframe that renders the p5.js sketch in real-time
- **Snippet Manager**: For saving, loading, and managing code snippets

### Backend (playground.py)

The backend is a FastAPI application with endpoints for:

- **AI Code Generation**: Processes user requests via Gemini
- **Snippet Management**: CRUD operations for code snippets in Cosmos DB

### API Client (playground-api.ts)

Provides TypeScript interfaces and methods for the frontend to communicate with the backend.

## Key Functions and Workflows

### 1. Code Generation with AI

The system uses Google's Gemini 2.5 Pro model to generate p5.js code based on user prompts.

#### How it works:

1. **User Input**: User enters a prompt in the chat interface (e.g., "Create a particle system")
2. **Request Processing**:
   - Frontend calls `sendMessageAction()` which prepares the conversation history
   - `apiClient.sendToGemini()` sends the request to the backend
   - Backend's `process_playground_request()` function formats the request for Gemini
   - Backend includes the `SYSTEM_INSTRUCTIONS` to guide Gemini's responses

```javascript
// Relevant system instructions for Gemini
SYSTEM_INSTRUCTIONS = """You're an extremely proficient creative coding agent, and can code effects, games, generative art.
write javascript code assuming it's in a live p5js environment.
return the code block.
you can include a short paragraph explaining your reasoning and the result in human readable form.
there can be no external dependencies: all functions must be in the returned code.
make extra sure that all functions are either declared in the code or part of p5js.
the user can modify the code, go along with the user's changes."""
```

3. **Code Extraction**:
   - Backend extracts code from Gemini's response using `extract_code()` function
   - Explanation text is separated from the code block

4. **Rendering**:
   - Frontend receives the explanation and code
   - Code is updated in the editor with `updateCode()`
   - The sketch is automatically run in the preview iframe with `runCode()`

### 2. Code Execution

The system executes p5.js code in real-time through an iframe sandbox.

#### How it works:

1. **Code Preparation**:
   - The `runCode()` function takes the current code
   - It creates an HTML document with p5.js included from CDN
   - The document includes error handling code

2. **Execution**:
   - The HTML is injected into the iframe using `srcdoc`
   - The p5.js sketch runs immediately
   - Error messages are captured and sent back to the parent window

3. **Control**:
   - User can play/pause the sketch using `playAction()` and `stopAction()`
   - These functions use `postMessage()` to communicate with the iframe
   - The sketch can be reloaded with `reloadCodeAction()`

### 3. Saving Code Snippets

Users can save their sketches for later use.

#### How it works:

1. **Triggering Save**:
   - User clicks "Save Code" button, which calls `openSaveDialog()`
   - Dialog opens for title, description, and tags

2. **Submitting Data**:
   - `handleSaveSnippet()` validates inputs
   - Creates a `SaveCodePayload` object with the current code
   - Calls `apiClient.saveCodeSnippet()` to send to backend

3. **Backend Processing**:
   - The `/api/playground/code/save` endpoint receives the request
   - `cosmos_db.save_p5js_code()` adds the snippet to the database
   - Returns the saved snippet with generated ID and timestamps

### 4. Retrieving Code Snippets

Users can view and load their saved sketches.

#### How it works:

1. **Listing Snippets**:
   - When user switches to "My Snippets" tab, `loadSnippets()` is called
   - `apiClient.getCodeSnippets()` requests data from backend
   - Backend's `/api/playground/code/list` endpoint queries Cosmos DB
   - Results are displayed in a card-based interface

2. **Loading a Snippet**:
   - User clicks "Load" button on a snippet, calling `handleLoadSnippet()`
   - The code is loaded into the editor with `updateCode()`
   - The sketch automatically runs in the preview

3. **Managing Snippets**:
   - Users can edit snippets with `handleEditSnippet()`
   - Users can delete snippets with `handleDeleteSnippet()`
   - Backend endpoints handle the database operations

### 5. User Interface Components

The UI is composed of several key components for an intuitive experience.

#### Main Layout:

```
+------------------------+------------------------+
| Editor/Chat Panel      | Canvas Preview Panel   |
| (5 columns)            | (7 columns)            |
|                        |                        |
| [Tabs]                 |                        |
| - Gemini               | [Live p5.js Preview]   |
| - Code                 |                        |
| - My Snippets          |                        |
|                        |                        |
| [Content based on tab] |                        |
|                        |                        |
| [Input/controls]       | [Playback controls]    |
+------------------------+------------------------+
```

#### UI Components:

1. **Tabs**:
   - **Gemini**: Chat interface with the AI
   - **Code**: Code editor with syntax highlighting
   - **My Snippets**: List of saved code snippets

2. **Chat Interface**:
   - Message history with user/assistant messages
   - Input field for sending prompts
   - Loading states (thinking, generating, coding)

3. **Code Editor**:
   - Syntax-highlighted editor for p5.js code
   - Indicates when code has been modified but not run

4. **Preview Panel**:
   - Live running p5.js sketch
   - Controls for play, pause, reload, fullscreen
   - Error messages displayed in the sketch area

5. **Snippet Manager**:
   - Cards showing saved snippets with titles and descriptions
   - Load, edit, and delete options for each snippet
   - Dialog for saving new snippets with metadata

## Data Flow

The data flow in the application follows this pattern:

1. **User Input** → Frontend
2. **API Request** → Backend
3. **AI Processing** (if needed) → Gemini API
4. **Database Operations** (if needed) → Cosmos DB
5. **Response** → Frontend
6. **UI Update** → User sees result

## Error Handling

The system includes robust error handling:

1. **Runtime Errors**:
   - P5.js errors are captured in the iframe
   - Sent to parent window via `postMessage()`
   - Displayed to user and can be sent to Gemini for help

2. **API Errors**:
   - Try/catch blocks in all API calls
   - Detailed error messages extracted from responses
   - Displayed to user in the chat interface

3. **Backend Logging**:
   - Comprehensive logging system
   - Tracks API calls, code changes, and errors
   - Helps with debugging and monitoring

## Technical Details

### State Management

The React frontend uses `useState` hooks for managing:

- Current code and chat state
- Messages and conversation history
- Snippets and UI state (loading, dialogs)

### Real-time Preview

The live preview uses:

- `srcdoc` attribute to inject HTML into the iframe
- Custom error handling to capture p5.js errors
- `postMessage()` API for iframe communication

### API Communication

API requests follow this pattern:

```typescript
async function apiCall() {
  try {
    const response = await fetch(`${url}`, {
      method: 'METHOD',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      // Extract error message
      throw new Error(errorMessage);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}
```

## Conclusion

The P5.js Playground provides an integrated environment for creative coding with AI assistance. It combines real-time code execution, intelligent code generation, and persistent storage to create a seamless experience for users to experiment with p5.js.

The application demonstrates effective integration of:
- Frontend and backend communication
- AI-assisted code generation
- Real-time code execution in a sandbox
- Database operations for persistent storage
- Intuitive user interface for creative coding
