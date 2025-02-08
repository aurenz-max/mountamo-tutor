// useGeminiService.ts
import { useCallback, useRef } from 'react';
import { useWebSocket } from './use-websocket';

type ContentType = 'problem' | 'feedback';

export const useGeminiService = () => {
  const { sendMessage, readyState, lastMessage, messages } = useWebSocket();
  const setupSent = useRef(false);

  const isConnected = useCallback(() => {
    return readyState === WebSocket.OPEN;
  }, [readyState]);

  const resetSession = useCallback(async () => {
    if (isConnected()) {
      sendMessage("ResetSession");
    }
  }, [isConnected, sendMessage]);

  const sendToGemini = useCallback((text: string) => {
    if (isConnected()) {
      sendMessage(text);
    }
  }, [isConnected, sendMessage]);

  const textToSpeech = useCallback(async (text: string, contentType: ContentType = 'problem') => {
    await resetSession(); // Reset before new problem/feedback
    const contentPrompts = {
      problem: "You are a teacher, please read this problem exactly, do not explain the answer. PROBLEM:",
      feedback: "You are a supportive teacher providing feedback. Please read this feedback exactly. FEEDBACK:",
    };

    const prompt = contentPrompts[contentType];
    sendToGemini(`${prompt} ${text}`);
  }, [sendToGemini, resetSession]);

  return {
    isConnected,
    textToSpeech,
    resetSession,
    readyState,
    lastMessage,
    messages
  };
};