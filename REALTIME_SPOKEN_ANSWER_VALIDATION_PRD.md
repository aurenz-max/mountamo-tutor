# PRD: Real-time Spoken Answer Validation via Gemini Live Tool Call

**Version:** 1.0
**Date:** 2025-11-16
**Author:** Gemini Agent

## 1. Overview

This document outlines the requirements for a new feature that provides students with real-time feedback on spoken answers during a live tutoring session. When a student verbally answers a question, the system will transcribe their speech, use a Gemini-powered LLM to evaluate the answer's correctness, and trigger a tool call to send an immediate "Correct" or "Incorrect" notification to the frontend. This creates a more interactive and responsive learning experience.

## 2. Problem Statement

In the current live tutoring system, feedback on student responses can be delayed or may require manual intervention. Students lack immediate confirmation when they answer a question correctly, which can slow down the learning process and reduce engagement. We need an automated way to instantly validate a student's spoken answer and notify them of the result.

## 3. Goals and Objectives

- **Primary Goal:** To provide students with immediate, automated feedback on their spoken answers.
- **Objectives:**
    - Increase student engagement and motivation.
    - Accelerate the learning feedback loop.
    - Reduce the need for manual feedback from a human tutor in certain scenarios.
    - Leverage the capabilities of Gemini Live and its tool-calling functions to create a seamless, real-time experience.

## 4. User Story

**As a student** in a live practice session,
**When I** speak the answer to a question,
**I want to** receive immediate visual confirmation if my answer is correct,
**So that I** can confidently move on to the next question and feel a sense of accomplishment.

## 5. Functional Requirements

### 5.1. High-Level Flow

1.  **Session Start:** The backend initiates a "Gemini Live" tutoring session. Gemini is provided with the current question and the specific criteria for a correct answer. It is also equipped with a new tool: `send_answer_feedback`.
2.  **Audio Capture (Frontend):** The frontend captures the student's spoken response as an audio stream.
3.  **Audio Streaming (Frontend -> Backend):** The audio stream is sent to the backend via a WebSocket connection.
4.  **Transcription (Backend):** The backend receives the audio and uses a real-time Speech-to-Text (STT) service to transcribe it.
5.  **Evaluation (Backend -> Gemini):** The transcribed text is passed to the active Gemini Live session.
6.  **Tool Call (Gemini -> Backend):** Gemini evaluates the transcribed text against the known correct answer. If the answer is deemed correct, Gemini invokes the `send_answer_feedback` tool with a "correct" status.
7.  **Notification (Backend -> Frontend):** The backend, upon receiving the tool call from Gemini, sends a formatted message (e.g., JSON) over the WebSocket to the frontend, indicating the answer was correct.
8.  **UI Update (Frontend):** The frontend receives the notification and displays a "Correct" indicator to the student (e.g., a green checkmark, a toast message).

### 5.2. Backend Requirements

- **New Tool Definition:** A new tool, `send_answer_feedback`, must be defined and made available to the Gemini LLM.
    - **Tool Name:** `send_answer_feedback`
    - **Description:** "Sends a notification to the user interface about the correctness of their answer. Use this tool ONLY when you have evaluated the user's spoken response and determined if it is correct or incorrect."
    - **Parameters:**
        - `is_correct` (boolean, required): `true` if the answer is correct, `false` otherwise.
        - `feedback_message` (string, optional): A brief, encouraging message for the student (e.g., "Great job!", "That's it!").
- **WebSocket API:**
    - The WebSocket connection must handle the incoming audio stream from the frontend.
    - It must be able to send outgoing messages to the frontend. A new message type should be defined for answer feedback.
    - **Example Message (Backend to Frontend):**
      ```json
      {
        "type": "answer_feedback",
        "payload": {
          "is_correct": true,
          "message": "Correct!"
        }
      }
      ```
- **State Management:** The practice session handler (`practice_tutor.py` or similar) must manage the state, including the current question, the expected answer/criteria, and the active Gemini Live session.
- **STT Integration:** A real-time Speech-to-Text service must be integrated to handle the audio stream.

### 5.3. Gemini (LLM) Requirements

- **Prompt Engineering:** The system prompt for the Gemini Live session must be updated.
    - It must be given the context of the question and the rules for what constitutes a correct answer.
    - It must be explicitly instructed to use the `send_answer_feedback` tool as soon as it determines the user's answer is correct.
    - **Example Prompt Snippet:**
      > "You are a friendly and encouraging tutor. The user is about to answer the following question: 'What is the capital of France?'. The only correct answer is 'Paris'. When the user says 'Paris', you MUST immediately call the `send_answer_feedback` tool with `is_correct=true`."

### 5.4. Frontend Requirements

- **Audio Handling:**
    - Implement microphone access and audio recording.
    - Stream the captured audio data to the backend WebSocket endpoint.
- **WebSocket Client:**
    - Listen for `answer_feedback` messages from the backend.
- **UI Feedback:**
    - When a message with `is_correct: true` is received, display a clear and positive visual indicator.
    - The indicator should be temporary and non-disruptive (e.g., a 2-second animation).

## 6. Technical Implementation Guidance

- **Location:** The core logic for handling the session and tool call will likely reside in or be called from `backend/app/api/endpoints/practice_tutor.py`.
- **Gemini SDK:** The implementation should use the `google-generativeai` Python library, specifically leveraging the `GenerativeModel.start_chat(enable_automatic_function_calling=True)` or similar functionality to handle the tool call.
- **Tool Implementation:** The Python function that implements the `send_answer_feedback` tool will be responsible for sending the JSON payload over the appropriate WebSocket connection to the client.

## 7. Success Metrics

- **Feature Adoption:** Percentage of live tutoring sessions where the automated feedback is triggered.
- **Student Engagement:** Measure session duration and completion rates for practice sets using this feature.
- **Performance:**
    - **Latency:** The time from when the student finishes speaking the correct answer to when the "Correct" UI appears should be less than 2 seconds.
    - **Accuracy:** The system should have a high accuracy rate in correctly identifying the right answer.

## 8. Out of Scope for V1

- Partial credit for incomplete or partially correct answers.
- Detailed explanations for why an answer is incorrect.
- Support for multi-part answers.
- Grading of subjective or open-ended questions.
