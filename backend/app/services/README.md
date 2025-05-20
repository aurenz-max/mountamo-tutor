# GeminiService

The `GeminiService` class is responsible for managing interactions with the Gemini API. This includes handling audio streaming, tool calls, and session management.

## Purpose

The primary purpose of `GeminiService` is to provide a high-level interface for connecting to and interacting with Google's Gemini model. It encapsulates the complexities of managing audio streams, handling tool calls made by the Gemini model, and maintaining session-specific context.

## Public Methods

### Session Management

- **`initialize_session(session_id: str, session_metadata: Dict[str, Any]) -> None`**:
  Initializes the service for a specific session. This method sets up session-specific state, including the session ID and metadata. It should be called before `connect`.

- **`reset_session() -> bool`**:
  Resets the current session state. This includes closing any active Gemini session, clearing input queues, and resetting session-related variables.

- **`shutdown() -> None`**:
  Signals the service to stop its operations, particularly the audio streaming loop. It also triggers a session reset.

### Connection

- **`connect(session_id: str, unified_prompt: str, session_metadata: Dict[str, Any], tool_config: Optional[Dict[str, Any]] = None, voice_name: str = "Leda") -> None`**:
  Establishes a connection to the Gemini model. This method initializes the session, configures the Gemini client, and starts the bidirectional audio stream.
    - `session_id`: Unique identifier for the session.
    - `unified_prompt`: The system prompt to guide the Gemini model.
    - `session_metadata`: Dictionary containing metadata relevant to the session.
    - `tool_config`: Optional configuration for tools that Gemini can call (e.g., `TOOL_CREATE_PROBLEM`, `TOOL_PROBLEM_VISUAL`).
    - `voice_name`: The name of the prebuilt voice to be used for Gemini's audio responses.

### Audio Handling

- **`stream() -> AsyncGenerator[bytes, None]`**:
  An asynchronous generator that streams audio data from the input queue to the Gemini API. This method is primarily used internally by the `connect` method.

- **`receive(frame: tuple[int, np.ndarray]) -> None`**:
  Processes incoming audio frames from the user. The audio data is put into an input queue for the `stream` method and can also be forwarded to an external speech recognition service (like Azure Speech Service) for transcription.

### Tool Calls

These methods are designed to be called by the Gemini model through its tool-calling feature. They allow Gemini to request actions or information from the application.

- **`create_problem(recommendation_data: Optional[Dict] = None, objectives_data: Optional[Dict] = None) -> Dict[str, Any]`**:
  Handles a tool call from Gemini to generate a practice problem. It uses the `GeminiProblemIntegration` service and session metadata to create a relevant problem. The result, including problem text and answer, is returned.

- **`get_categories() -> Dict[str, Any]`**:
  Handles a tool call from Gemini to retrieve the available image categories for visual scene creation. This method relies on the `GeminiImageIntegration` service.

- **`get_objects(category: str) -> Dict[str, Any]`**:
  Handles a tool call from Gemini to get available objects within a specific image category. This method also relies on the `GeminiImageIntegration` service and provides suggestions if an exact category match is not found.

- **`find_images(category: Optional[str] = None, object_type: Optional[str] = None) -> Dict[str, Any]`**:
  *(Note: This method is defined in the `TOOL_PROBLEM_VISUAL` constant but not explicitly implemented as a distinct public method in the provided `GeminiService` class code. It's assumed to be handled by the visual integration or a more generic tool call handler if invoked by Gemini.)*
  The conceptual purpose is to find images matching a category and/or object type.

- **`create_scene(category: str, object_type: str, count: int, layout: str = "grid", title: Optional[str] = None, description: Optional[str] = None) -> Dict[str, Any]`**:
  Handles a tool call from Gemini to create a visual scene with specified objects, layout, and other parameters. It uses `GeminiImageIntegration` to generate the scene and can perform category validation and suggestions.

### Callbacks

- **`register_scene_callback(callback: Callable[[Dict[str, Any]], Awaitable[None]]) -> None`**:
  Registers an asynchronous callback function that will be invoked when a new visual scene is created (typically via a `create_scene` tool call). The callback receives the scene data.

- **`register_problem_callback(callback: Callable[[Dict[str, Any]], Awaitable[None]]) -> None`**:
  Registers an asynchronous callback function that will be invoked when new problem data is available (typically after a `create_problem` tool call). The callback receives the problem data.

## Important Class Variables and Configurations

- **`audio_service: AudioService`**:
  An instance of `AudioService` used for managing and playing back audio responses from Gemini.

- **`azure_speech_service: Optional[AzureSpeechService]`**:
  An optional instance of `AzureSpeechService` for performing speech-to-text transcription of both user and Gemini audio.

- **`visual_integration: Optional[GeminiImageIntegration]`**:
  An optional instance of `GeminiImageIntegration` used for handling visual tool calls related to image categories, objects, and scene creation.

- **`problem_integration: GeminiProblemIntegration`**:
  An instance of `GeminiProblemIntegration` (obtained via dependency injection) responsible for the logic of creating practice problems.

- **`input_queue: asyncio.Queue`**:
  An asynchronous queue used to buffer incoming audio data from the user before it's streamed to Gemini.

- **`quit: asyncio.Event`**:
  An event used to signal the service to terminate its operations gracefully.

- **`session_reset_event: asyncio.Event`**:
  An event used to signal that the current session is being reset.

- **`_current_session_id: Optional[str]`**:
  Stores the ID of the currently active session.

- **`session_metadata: Optional[Dict[str, Any]]`**:
  Stores metadata associated with the current session.

- **`TOOL_CREATE_PROBLEM` and `TOOL_PROBLEM_VISUAL` (Constants)**:
  These dictionaries define the structure of tool configurations passed to the Gemini API, declaring the functions that Gemini can request to call (e.g., `create_problem`, `get_categories`, `create_scene`). They specify the function names, descriptions, and parameters.
```
