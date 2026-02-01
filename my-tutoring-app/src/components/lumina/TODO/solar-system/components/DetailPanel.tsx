import React, { useState, useEffect, useRef } from 'react';
import { CelestialBody, ChatMessage } from '../types';
import { getPlanetFact, chatWithPlanet } from '../services/geminiService';
import { X, MessageCircle, Info, Thermometer, Ruler, Clock, Orbit } from 'lucide-react';

interface DetailPanelProps {
  body: CelestialBody;
  onClose: () => void;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({ body, onClose }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'chat'>('info');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [funFact, setFunFact] = useState<string | null>(null);
  const [loadingFact, setLoadingFact] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChatHistory([{ role: 'model', text: `Hi! I'm ${body.name}. Ask me anything about myself!` }]);
    setFunFact(null);
    setInputMessage('');
    
    // Fetch a fun fact on open
    setLoadingFact(true);
    getPlanetFact(body.name).then(fact => {
        setFunFact(fact);
        setLoadingFact(false);
    });
  }, [body]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMsg = inputMessage;
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setInputMessage('');
    
    setChatHistory(prev => [...prev, { role: 'model', text: 'Thinking...', isLoading: true }]);

    const response = await chatWithPlanet(body.name, userMsg);
    
    setChatHistory(prev => {
        const newHist = prev.filter(msg => !msg.isLoading);
        return [...newHist, { role: 'model', text: response }];
    });
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-slate-900/95 backdrop-blur-xl border-l border-slate-700 text-white shadow-2xl z-50 flex flex-col transition-all duration-300 transform translate-x-0">
      
      {/* Header */}
      <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800">
        <h2 className="text-3xl font-bold space-font text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">{body.name}</h2>
        <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
          <X className="w-6 h-6 text-slate-400 hover:text-white" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button 
          onClick={() => setActiveTab('info')}
          className={`flex-1 py-3 font-medium text-sm transition-colors flex items-center justify-center gap-2 ${activeTab === 'info' ? 'bg-slate-800 text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
        >
          <Info className="w-4 h-4" /> Data
        </button>
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 font-medium text-sm transition-colors flex items-center justify-center gap-2 ${activeTab === 'chat' ? 'bg-slate-800 text-purple-400 border-b-2 border-purple-400' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
        >
          <MessageCircle className="w-4 h-4" /> Talk to {body.name}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {activeTab === 'info' ? (
          <div className="space-y-6">
            
            {/* Visual Header */}
            <div className="flex justify-center py-4">
              <div 
                className="w-32 h-32 rounded-full shadow-2xl shadow-blue-500/20 animate-pulse"
                style={{ background: body.textureGradient }}
              />
            </div>

            <p className="text-slate-300 leading-relaxed text-sm">{body.description}</p>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Ruler className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">Radius</span>
                </div>
                <div className="text-lg font-mono font-semibold">{body.radiusKm.toLocaleString()} km</div>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Thermometer className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">Temp</span>
                </div>
                <div className="text-lg font-mono font-semibold">{body.temperatureC}°C</div>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">Day Length</span>
                </div>
                <div className="text-lg font-mono font-semibold">{body.rotationPeriodHours}h</div>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Orbit className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">Year Length</span>
                </div>
                <div className="text-lg font-mono font-semibold">{body.orbitalPeriodDays} days</div>
              </div>
            </div>

            {/* Fun Fact Section */}
            <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 p-5 rounded-xl border border-indigo-500/30">
              <h3 className="font-bold text-indigo-300 mb-2 flex items-center gap-2">
                ✨ Did you know?
              </h3>
              {loadingFact ? (
                <div className="animate-pulse h-4 bg-indigo-500/20 rounded w-3/4"></div>
              ) : (
                <div className="text-sm text-indigo-100/90 whitespace-pre-line">
                  {funFact || "Asking the stars..."}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex-1 space-y-4 mb-4">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2 mt-auto">
              <input 
                type="text" 
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask a question..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
              />
              <button 
                onClick={handleSendMessage}
                disabled={!inputMessage.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};