import { useState, useCallback } from 'react';
import apiClient from '@/lib/playground-api';
import { ChatState } from '../P5jsPlayground';

interface Message {
  role: string;
  text: string;
  thinking?: string;
}

/**
 * Custom hook for interacting with the Gemini AI API
 */
export function useChatWithGemini(
  code: string,
  codeHasChanged: boolean,
  updateCode: (newCode: string) => Promise<void>,
  selectedCurriculum = null
) {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatState, setChatState] = useState<ChatState>(ChatState.IDLE);
  
  // Function to add a message to the chat
  const addMessage = useCallback((role: string, text: string, thinking?: string): Message => {
    const newMessage: Message = {
      role,
      text,
      thinking
    };
    
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);
  
  // Function to update a specific message
  const updateMessage = useCallback((messageToUpdate: Message, updates: Partial<Message>) => {
    setMessages(prevMessages => {
      return prevMessages.map(msg => {
        if (msg === messageToUpdate) {
          return { ...msg, ...updates };
        }
        return msg;
      });
    });
  }, []);
  
  // Function to send message to the Gemini API
  const sendMessage = useCallback(async (message: string, role: string = 'user') => {
    if (chatState !== ChatState.IDLE) return;
  
    setChatState(ChatState.GENERATING);
    
    // Skip if message is empty
    if (!message.trim()) {
      setChatState(ChatState.IDLE);
      return;
    }
    
    // Add user message to the chat (if it's a user message)
    if (role === 'user') {
      addMessage(role, message);
    }
    
    try {
      // Prepare conversation history (only user and assistant messages)
      const conversationHistory = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, text: m.text }));
      
      // Extract curriculum information if available
      let curriculumInfo = null;
      if (selectedCurriculum) {
        curriculumInfo = {
          subject: selectedCurriculum.subject,
          unit: selectedCurriculum.unit?.title,
          skill: selectedCurriculum.skill?.description,
          subskill: selectedCurriculum.subskill?.description,
        };
      }
      
      // Prepare the payload
      const payload = {
        message,
        role,
        code,
        codeHasChanged,
        conversationHistory,
        curriculumInfo  // Add the curriculum information to the payload
      };
      
      // Log the payload for debugging
      console.log('Sending to Gemini API:', {
        messageLength: message.length,
        codeLength: code?.length || 0,
        historyLength: conversationHistory.length,
        codeHasChanged,
        curriculumSelected: !!curriculumInfo
      });
      
      // Change to thinking state
      setChatState(ChatState.THINKING);
      
      // Create a placeholder message for the response
      const responseMessage = addMessage('assistant', 'Processing your request...');
      
      // Call the API
      const data = await apiClient.sendToGemini(payload);
      
      // Change to coding state
      setChatState(ChatState.CODING);
      
      // Update the placeholder message with the actual response
      if (data.thinking_info && data.thinking_info.trim()) {
        updateMessage(responseMessage, {
          text: data.explanation || 'Done',
          thinking: data.thinking_info
        });
      } else {
        updateMessage(responseMessage, {
          text: data.explanation || 'Done'
        });
      }
      
      // Update code if received
      if (data.code && data.code.trim()) {
        console.log('Received code update:', {
          length: data.code.length,
          firstLine: data.code.split('\n')[0]
        });
        
        await updateCode(data.code);
      } else {
        console.log('No code update in response');
        
        if (data.explanation && data.explanation.includes("no code update")) {
          console.log('Model explicitly mentioned no code update');
        }
        
        addMessage('system', 'There is no new code update.');
      }
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      addMessage('error', `Error: ${error.message}`);
    }
    
    // Reset chat state
    setChatState(ChatState.IDLE);
  }, [addMessage, chatState, code, codeHasChanged, messages, updateCode, updateMessage, selectedCurriculum]);
  
  return {
    messages,
    chatState,
    sendMessage,
    addMessage
  };
}

export default useChatWithGemini;