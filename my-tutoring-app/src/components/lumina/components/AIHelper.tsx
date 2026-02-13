'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useLuminaAI } from '../hooks/useLuminaAI';
import type { ComponentId } from '../types';
import { Bot, Mic, MicOff, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface AIHelperProps {
  primitiveType: ComponentId;
  instanceId: string;
  primitiveData: any;
  enabled?: boolean;
  exhibitId?: string;
  topic?: string;
  gradeLevel?: string;
}

type HintLevel = 1 | 2 | 3;

export const AIHelper: React.FC<AIHelperProps> = ({
  primitiveType,
  instanceId,
  primitiveData,
  enabled = true,
  exhibitId,
  topic,
  gradeLevel,
}) => {
  const {
    requestHint,
    sendText,
    startListening,
    stopListening,
    isConnected,
    isAIResponding,
    isListening,
    conversation,
    aiMetrics,
  } = useLuminaAI({
    primitiveType,
    instanceId,
    primitiveData,
    enabled,
    exhibitId,
    topic,
    gradeLevel,
  });

  const [isOpen, setIsOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation]);

  const hintLevelInfo = {
    1: {
      label: 'Small Hint',
      description: 'A gentle nudge in the right direction',
      icon: '💡',
      color: 'blue'
    },
    2: {
      label: 'Medium Hint',
      description: 'More specific guidance on the concept',
      icon: '🔍',
      color: 'yellow'
    },
    3: {
      label: 'Big Hint',
      description: 'Detailed explanation without the answer',
      icon: '🎯',
      color: 'orange'
    }
  };

  const handleGetHint = (level: HintLevel) => {
    requestHint(level, primitiveData);
  };

  const handleSendText = () => {
    if (textInput.trim()) {
      sendText(textInput);
      setTextInput('');
    }
  };

  const handleToggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const totalHints = aiMetrics.hintsGiven.level1 + aiMetrics.hintsGiven.level2 + aiMetrics.hintsGiven.level3;

  return (
    <div className="fixed bottom-8 right-8 z-50">
      {/* Helper Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full font-bold shadow-2xl hover:shadow-indigo-500/50 transition-all duration-300 hover:scale-110 active:scale-95 flex items-center gap-3"
        >
          <span className="text-2xl">
            <Bot className="w-6 h-6" />
          </span>
          <span>AI Helper</span>
          {totalHints > 0 && (
            <Badge className="absolute -top-2 -right-2 bg-purple-500 hover:bg-purple-600">
              {totalHints}
            </Badge>
          )}
          {/* Pulse Animation */}
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full blur opacity-30 group-hover:opacity-60 animate-pulse"></div>
        </button>
      )}

      {/* Helper Panel */}
      {isOpen && (
        <Card className="w-96 max-h-[600px] overflow-hidden backdrop-blur-xl bg-slate-900/90 border-white/10 shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="w-8 h-8 text-white" />
              <div>
                <h3 className="text-white font-bold text-lg">Lumina AI Helper</h3>
                <p className="text-indigo-200 text-xs flex items-center gap-2">
                  {isConnected ? (
                    <>
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      Connected
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                      Connecting...
                    </>
                  )}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setIsOpen(false)}
              variant="ghost"
              size="icon"
              className="text-white hover:text-indigo-200 hover:bg-white/10"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          {/* Conversation History */}
          <ScrollArea className="h-64 p-4" ref={scrollRef}>
            {conversation.length === 0 && (
              <div className="p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl">
                <p className="text-slate-300 text-sm leading-relaxed">
                  👋 Hi! I'm your Lumina AI assistant. I can help you understand this activity better.
                  Choose a hint level below, or ask me a question!
                </p>
              </div>
            )}

            {conversation.map((msg, i) => (
              <div
                key={i}
                className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl p-3 ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800/50 border border-slate-700 text-slate-200'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.isAudio && (
                    <span className="text-xs opacity-70 mt-1 block">
                      <Mic className="w-3 h-3 inline mr-1" />
                      Voice
                    </span>
                  )}
                </div>
              </div>
            ))}

            {isAIResponding && (
              <div className="mb-3 flex justify-start">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Hint Level Buttons */}
          <div className="p-4 border-t border-slate-700 space-y-2">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">
              Request Hint
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([1, 2, 3] as HintLevel[]).map((level) => {
                const info = hintLevelInfo[level];
                const used = aiMetrics.hintsGiven[`level${level}` as keyof typeof aiMetrics.hintsGiven];

                return (
                  <Button
                    key={level}
                    onClick={() => handleGetHint(level)}
                    disabled={!isConnected || isAIResponding}
                    variant="ghost"
                    className={`relative flex flex-col items-center gap-1 h-auto py-3 bg-white/5 border ${
                      used > 0
                        ? 'border-indigo-500/50 bg-indigo-500/10'
                        : 'border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-2xl">{info.icon}</span>
                    <span className="text-xs text-slate-300">{info.label.split(' ')[0]}</span>
                    {used > 0 && (
                      <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center bg-indigo-500">
                        {used}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Text Input */}
          <div className="p-4 border-t border-slate-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                placeholder="Ask a question..."
                disabled={!isConnected}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm disabled:opacity-50"
              />
              <Button
                onClick={handleSendText}
                disabled={!isConnected || !textInput.trim()}
                size="icon"
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Voice Input Button */}
          <div className="p-4 border-t border-slate-700">
            <Button
              onClick={handleToggleVoice}
              disabled={!isConnected}
              variant={isListening ? 'destructive' : 'default'}
              className={`w-full ${
                isListening
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-4 h-4 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Ask with Voice
                </>
              )}
            </Button>
          </div>

          {/* Metrics Display */}
          {aiMetrics.totalInteractions > 0 && (
            <div className="px-4 pb-4 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Total hints: {totalHints}</span>
                <span>Interactions: {aiMetrics.totalInteractions}</span>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default AIHelper;
