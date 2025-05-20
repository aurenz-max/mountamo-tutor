# P5.js AI Playground Frontend

This document outlines the structure and functionality of the P5.js AI Playground frontend, located within the `my-tutoring-app/src/app/playground/` directory.

## Purpose

The P5.js AI Playground is an interactive web application designed to help students learn creative coding with P5.js. It provides a dynamic environment where students can:
- Explore coding concepts from a predefined curriculum.
- Interact with an AI tutor (powered by Google Gemini) to generate P5.js sketches and explanations.
- Write and modify P5.js code in a live editor.
- See the results of their code in a real-time preview panel.
- Save their code snippets for future reference.
- Potentially have their work evaluated (though this is a backend feature, the frontend provides the interface).

The playground aims to make learning P5.js more engaging and accessible by combining AI assistance with hands-on coding.

## Main Components

The frontend is built using Next.js and React, with several key components forming the user interface:

### 1. `UpdatedP5jsPlayground` (`my-tutoring-app/src/components/playground/P5jsPlayground.tsx`)

This is the main orchestrating component for the playground. It integrates all other sub-components and manages the overall state and layout.
- **Responsibilities**:
    - Manages the active view (e.g., welcome, explore topics, create with AI, edit code).
    - Initializes and coordinates the custom hooks (`useP5jsCode`, `useChatWithGemini`, `useSnippets`).
    - Handles curriculum selection and triggers AI interaction based on it.
    - Provides UI elements for navigation, sketch controls (play, pause, reload), and saving snippets.
    - Displays a contextual help overlay for new users.

### 2. `ChatPanel` (`my-tutoring-app/src/components/playground/ChatPanel.tsx`)

This component provides the interface for students to interact with the AI tutor.
- **Responsibilities**:
    - Displays the conversation history between the student and the AI.
    - Shows the current state of the chat (e.g., idle, generating, thinking, coding).
    - Provides an input field for students to send messages to the AI.

### 3. `ImprovedCodeEditor` (`my-tutoring-app/src/components/playground/ImprovedCodeEditor.tsx`)

This component is a sophisticated code editor for writing and modifying P5.js sketches.
- **Responsibilities**:
    - Displays the P5.js code with syntax highlighting.
    - Allows users to edit the code directly.
    - Can be set to read-only mode, for example, while the AI is generating code.
    - Shows visual indication if the code has been changed.

### 4. `PreviewPanel` (`my-tutoring-app/src/components/playground/PreviewPanel.tsx`)

This component is responsible for rendering the P5.js sketch based on the current code.
- **Responsibilities**:
    - Executes the P5.js code in an iframe to isolate it.
    - Displays the visual output of the sketch.
    - Handles reloading the sketch when new code is provided or when requested by the user.
    - Reports runtime errors from the P5.js sketch back to the main playground component.

### 5. `ImprovedSyllabusSelector` (`my-tutoring-app/src/components/tutoring/SyllabusSelector.tsx`)

This component allows students to browse and select learning topics from a structured curriculum.
- **Responsibilities**:
    - Fetches and displays the curriculum structure (units, skills, subskills).
    - Allows users to navigate the curriculum and select a specific topic.
    - Passes the selected curriculum data to the `UpdatedP5jsPlayground` component to inform the AI tutor.

## Custom Hooks

The playground utilizes several custom React hooks to encapsulate and manage complex logic:

### 1. `useP5jsCode` (`my-tutoring-app/src/components/playground/hooks/useP5jsCode.ts`)

Manages the state and lifecycle of the P5.js code and the sketch preview.
- **Responsibilities**:
    - Stores the current P5.js code and its syntax-highlighted HTML representation.
    - Tracks whether the code has changed or needs to be reloaded in the preview.
    - Manages the running state of the sketch (playing or paused).
    - Provides functions to update, edit, play, stop, reload, and clear the code/sketch.
    - Registers the iframe reference for the `PreviewPanel`.
    - Handles runtime errors from the P5.js sketch.

### 2. `useChatWithGemini` (`my-tutoring-app/src/components/playground/hooks/useChatWithGemini.ts`)

Manages the chat interaction with the backend Gemini AI service.
- **Responsibilities**:
    - Stores the history of chat messages.
    - Tracks the current state of the chat interaction (e.g., `ChatState.IDLE`, `ChatState.GENERATING`).
    - Provides a function (`sendMessage`) to send user messages to the backend.
    - Updates the P5.js code via `updateCode` (from `useP5jsCode`) when the AI provides new code.
    - Can incorporate selected curriculum context into messages sent to the AI.

### 3. `useSnippets` (`my-tutoring-app/src/components/playground/hooks/useSnippets.ts`)

Manages the functionality related to saving, loading, and deleting P5.js code snippets.
- **Responsibilities**:
    - Stores the list of saved code snippets for the current student.
    - Handles loading snippets from the backend.
    - Provides functions to save new snippets, load existing snippets into the editor, and delete snippets.
    - Manages the state of the "Save Snippet" dialog.
    - Interacts with the `apiClient` to persist snippet data.

## Backend Interaction (`GeminiService`)

The frontend communicates with the backend, specifically the `GeminiService`, primarily through the `/api/playground/gemini` endpoint. This interaction is facilitated by the `apiClient` module (`my-tutoring-app/src/lib/playground-api.ts`).

- **Flow**:
    1. When a user sends a message in the `ChatPanel` (e.g., asking the AI to create a sketch based on a selected curriculum topic), the `useChatWithGemini` hook is invoked.
    2. The `sendMessage` function within `useChatWithGemini` constructs a payload (`GeminiPayload`) containing the user's message, current code (if any), code change status, and conversation history.
    3. This payload is sent to the `/api/playground/gemini` endpoint using the `apiClient.sendToGemini` method.
    4. On the backend, this request is typically routed to a handler that interacts with the `GeminiService`. The `GeminiService` processes the request, potentially calls the actual Google Gemini API, and may use its tool-calling capabilities (e.g., to generate problem descriptions or visual scenes, though the P5.js generation is the core here).
    5. The backend `GeminiService` then sends a response (`GeminiResponse`) back to the frontend, which includes an explanation and the generated P5.js code.
    6. The `useChatWithGemini` hook receives this response. It updates the chat messages with the AI's explanation and uses the `updateCode` function (from `useP5jsCode`) to load the new P5.js code into the editor and trigger a preview refresh.

## Other Functionalities

### Code Snippet Management

- Users can save their P5.js sketches as snippets.
- The `useSnippets` hook and `apiClient` handle CRUD (Create, Read, Update, Delete) operations for snippets, interacting with backend endpoints like:
    - `POST /api/playground/code/save`
    - `GET /api/playground/code/list`
    - `GET /api/playground/code/{snippetId}`
    - `PUT /api/playground/code/{snippetId}`
    - `DELETE /api/playground/code/{snippetId}`
- Snippets can include a title, description, tags, and potentially link to curriculum metadata.

### Student Evaluations (Brief Mention)

- The `playground-api.ts` module includes interfaces and `apiClient` methods for student work evaluation (`StudentEvaluationRequest`, `StudentEvaluationResponse`, `evaluateStudentWork`, etc.).
- This suggests a backend capability to assess student-submitted code and interactions. While the detailed implementation of the evaluation UI is not fully covered here, the API contracts indicate that the playground can submit data for evaluation and potentially display results.
    - `POST /api/playground/evaluate`
    - `GET /api/playground/evaluations`
    - `GET /api/playground/evaluations/{evaluationId}`

## Page Structure (`my-tutoring-app/src/app/playground/page.tsx`)

The main entry point for the playground page (`page.tsx`) uses Next.js dynamic import for the `UpdatedP5jsPlayground` component. This ensures that the P5.js related components, which are client-side intensive, are only loaded on the client, not during server-side rendering. The page also includes basic layout elements like links to P5.js references and a footer.
