// components/gemini-tutor/windows/ChatWindow.tsx
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Sparkles } from 'lucide-react';
import DraggableWindow from '../ui/DraggableWindow';
import RiveAnimation from '@/components/rive/RiveAnimation';

interface ChatWindowProps {
  messages: Array<{ id: number; type: string; content: string; }>;
  onSendMessage: (message: string) => void;
  isResponding?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSendMessage, isResponding = false }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [currentAnimation, setCurrentAnimation] = useState('Idle 1');
  const [clickCount, setClickCount] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Array of fun responses when clicking the tutor
  const clickResponses = [
    "Hi there! 👋 Click on me anytime if you need help!",
    "That tickles! 😄 What can I help you with?",
    "You found my secret button! 🎯 Ready to learn something new?",
    "Beep boop! 🤖 Just kidding, I'm here to help!",
    "Hey! Need a hint? Just ask! 💡",
    "You're doing great! Keep it up! 🌟",
    "High five! ✋ Let's solve some problems together!",
  ];
  
  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Animate based on tutor state
  useEffect(() => {
    if (isResponding) {
      setCurrentAnimation('Talking 1');
    } else if (currentAnimation === 'Talking 1') {
      setCurrentAnimation('Idle 1');
    }
  }, [isResponding]);

  // Special animations for certain events
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      if (lastMessage.type === 'user') {
        setCurrentAnimation('Question');
        animationTimeoutRef.current = setTimeout(() => {
          setCurrentAnimation(isResponding ? 'Talking 1' : 'Idle 1');
        }, 2000);
      }
      
      if (lastMessage.type === 'assistant' && 
          (lastMessage.content.toLowerCase().includes('hello') || 
           lastMessage.content.toLowerCase().includes('hi '))) {
        setCurrentAnimation('Wave');
        animationTimeoutRef.current = setTimeout(() => {
          setCurrentAnimation('Idle 1');
        }, 3000);
      }
      
      if (lastMessage.type === 'assistant' && 
          (lastMessage.content.toLowerCase().includes('great job') || 
           lastMessage.content.toLowerCase().includes('well done') ||
           lastMessage.content.toLowerCase().includes('excellent'))) {
        setCurrentAnimation('Happy Smile');
        animationTimeoutRef.current = setTimeout(() => {
          setCurrentAnimation('Idle 1');
        }, 3000);
      }
    }
  }, [messages, isResponding]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      onSendMessage(messageInput);
      setMessageInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTutorClick = () => {
    // Clear any existing animation timeout
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    // Play a happy animation
    setCurrentAnimation('Happy Smile');
    
    // Show sparkles effect
    setShowTooltip(true);
    
    // Send a fun message from the tutor
    const responseIndex = clickCount % clickResponses.length;
    const tutorResponse = clickResponses[responseIndex];
    
    // Add a delay to make it feel more natural
    setTimeout(() => {
      onSendMessage(`[Tutor]: ${tutorResponse}`);
    }, 500);
    
    // Increment click count for variety
    setClickCount(prev => prev + 1);
    
    // Return to idle after animation
    animationTimeoutRef.current = setTimeout(() => {
      setCurrentAnimation('Idle 1');
      setShowTooltip(false);
    }, 2000);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className={`p-2 rounded-lg transition-colors ${
          isVisible ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
        } hover:bg-gray-200`}
      >
        <MessageCircle className="w-5 h-5" />
      </button>

      {/* Window */}
      {isVisible && (
        <DraggableWindow
          id="chat"
          title="Chat with Tutor"
          icon={<MessageCircle className="w-4 h-4 text-gray-600" />}
          defaultPosition={{ x: window.innerWidth - 420, y: window.innerHeight - 580 }}
          onClose={() => setIsVisible(false)}
          width="w-96"
          height="h-[500px]"
        >
          <div className="flex flex-col h-full">
            {/* Fixed Tutor Header - This stays at the top */}
            <div className="flex-shrink-0 bg-gradient-to-b from-blue-50 to-white dark:from-gray-800 dark:to-gray-900 p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-center">
                <div className="relative">
                  {/* Tooltip/Effect when clicking */}
                  {showTooltip && (
                    <div className="absolute -top-2 -right-2 animate-ping">
                      <Sparkles className="w-6 h-6 text-yellow-400" />
                    </div>
                  )}
                  
                  {/* Clickable animation container */}
                  <div 
                    className="w-24 h-24 rounded-full overflow-hidden bg-white dark:bg-gray-800 shadow-lg cursor-pointer transform transition-transform hover:scale-105 active:scale-95"
                    onClick={handleTutorClick}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleTutorClick();
                      }
                    }}
                  >
                    <RiveAnimation 
                      animationName={currentAnimation}
                      src="/animations/elemental.riv"
                    />
                  </div>
                  
                  {/* Click hint on first load */}
                  {clickCount === 0 && (
                    <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      Click me! 👆
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Scrollable Messages Area - This scrolls independently */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.type === 'user' || msg.content.startsWith('[Tutor]:') 
                      ? 'justify-end' 
                      : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      msg.type === 'user'
                        ? 'bg-blue-500 text-white rounded-br-none'
                        : msg.content.startsWith('[Tutor]:')
                        ? 'bg-purple-500 text-white rounded-bl-none'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-bl-none'
                    }`}
                  >
                    <p className="text-sm">
                      {msg.content.replace('[Tutor]: ', '')}
                    </p>
                  </div>
                </div>
              ))}
              
              {/* Typing indicator */}
              {isResponding && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2 rounded-bl-none">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            {/* Fixed Input Area - This stays at the bottom */}
            <div className="flex-shrink-0 p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={isResponding}
                />
                <button
                  onClick={handleSendMessage}
                  className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isResponding || !messageInput.trim()}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </DraggableWindow>
      )}
    </>
  );
};