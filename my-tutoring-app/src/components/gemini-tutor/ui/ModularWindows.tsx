import React, { useState } from 'react';
import { MessageCircle, Book, Brain, Send } from 'lucide-react';
import DraggableWindow from './DraggableWindow';

interface ModularWindowsProps {
  messages: Array<{ id: number; type: string; content: string; }>;
  onSendMessage?: (message: string) => void;
  onSubmitProblem?: () => void;
  lessonContent?: {
    title: string;
    sections: Array<{
      heading: string;
      content?: string;
      bullets?: string[];
    }>;
  };
  currentProblem?: {
    question: string;
    hints?: string[];
  };
}

const ModularWindows: React.FC<ModularWindowsProps> = ({
  messages = [],
  onSendMessage,
  onSubmitProblem,
  lessonContent,
  currentProblem,
}) => {
  const [showChat, setShowChat] = useState(true);
  const [showLesson, setShowLesson] = useState(false);
  const [showProblem, setShowProblem] = useState(false);
  const [messageInput, setMessageInput] = useState('');

  const handleSendMessage = () => {
    if (messageInput.trim() && onSendMessage) {
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
      {/* Chat Window */}
      {showChat && (
        <DraggableWindow
          id="chat"
          title="Chat"
          icon={<MessageCircle className="w-4 h-4 text-gray-600" />}
          defaultPosition={{ x: window.innerWidth - 420, y: window.innerHeight - 480 }}
          onClose={() => setShowChat(false)}
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

      {/* Lesson Window */}
      {showLesson && lessonContent && (
        <DraggableWindow
          id="lesson"
          title={lessonContent.title}
          icon={<Book className="w-4 h-4 text-blue-600" />}
          defaultPosition={{ x: 50, y: 100 }}
          onClose={() => setShowLesson(false)}
          width="w-96"
        >
          <div className="p-4 space-y-4">
            {lessonContent.sections.map((section, idx) => (
              <div key={idx}>
                <h3 className="text-sm font-semibold text-gray-800 mb-1">{section.heading}</h3>
                {section.content && <p className="text-sm text-gray-600 mb-2">{section.content}</p>}
                {section.bullets && (
                  <ul className="space-y-1">
                    {section.bullets.map((bullet, bidx) => (
                      <li key={bidx} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </DraggableWindow>
      )}

      {/* Problem Window */}
      {showProblem && currentProblem && (
        <DraggableWindow
          id="problem"
          title="Problem"
          icon={<Brain className="w-4 h-4 text-purple-600" />}
          defaultPosition={{ x: 50, y: 300 }}
          onClose={() => setShowProblem(false)}
          width="w-96"
        >
          <div className="p-4 space-y-4">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3">
              <p className="text-sm text-gray-800">{currentProblem.question}</p>
            </div>
            
            {currentProblem.hints && currentProblem.hints.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-600 mb-2">Need hints?</h4>
                <div className="space-y-1">
                  {currentProblem.hints.map((hint, idx) => (
                    <details key={idx} className="bg-gray-50 rounded-lg">
                      <summary className="px-3 py-1.5 cursor-pointer text-xs text-gray-700 hover:bg-gray-100 rounded-lg">
                        Hint {idx + 1}
                      </summary>
                      <p className="px-3 pb-1.5 text-xs text-gray-600">{hint}</p>
                    </details>
                  ))}
                </div>
              </div>
            )}
            
            <button
              onClick={onSubmitProblem}
              className="w-full py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium"
            >
              Submit Answer
            </button>
          </div>
        </DraggableWindow>
      )}

      {/* Control triggers - could be in your main UI */}
      <div className="fixed bottom-4 left-4 flex gap-2">
        <button
          onClick={() => setShowChat(!showChat)}
          className={`p-2 rounded-lg transition-colors ${
            showChat ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
          } hover:bg-gray-200`}
        >
          <MessageCircle className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowLesson(!showLesson)}
          className={`p-2 rounded-lg transition-colors ${
            showLesson ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
          } hover:bg-gray-200`}
        >
          <Book className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowProblem(!showProblem)}
          className={`p-2 rounded-lg transition-colors ${
            showProblem ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'
          } hover:bg-gray-200`}
        >
          <Brain className="w-5 h-5" />
        </button>
      </div>
    </>
  );
};

export default ModularWindows;