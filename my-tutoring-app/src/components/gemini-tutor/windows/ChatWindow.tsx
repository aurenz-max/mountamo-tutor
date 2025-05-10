// components/gemini-tutor/windows/ChatWindow.tsx
import React, { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import DraggableWindow from '../ui/DraggableWindow';

interface ChatWindowProps {
  messages: Array<{ id: number; type: string; content: string; }>;
  onSendMessage: (message: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSendMessage }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [messageInput, setMessageInput] = useState('');

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
          title="Chat"
          icon={<MessageCircle className="w-4 h-4 text-gray-600" />}
          defaultPosition={{ x: window.innerWidth - 420, y: window.innerHeight - 480 }}
          onClose={() => setIsVisible(false)}
          width="w-96"
          height="h-96"
        >
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      msg.type === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSendMessage}
                  className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
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