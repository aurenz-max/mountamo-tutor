import React, { useEffect, useState, useCallback } from 'react';
import { Key } from 'lucide-react';

interface ApiKeyCheckerProps {
  onKeySelected: () => void;
}

const ApiKeyChecker: React.FC<ApiKeyCheckerProps> = ({ onKeySelected }) => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const checkKey = useCallback(async () => {
    try {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
        if (selected) {
          onKeySelected();
        }
      } else {
        // Fallback for environments where the wrapper might not exist yet or dev mode
        // We assume valid if env var is present, but for this specific app requirement 
        // regarding Veo/Imagen models, the wrapper is usually key.
        // If not running in the specific workshop environment, we might default to true 
        // if we assume process.env.API_KEY is set.
        setHasKey(true);
        onKeySelected();
      }
    } catch (e) {
      console.error("Error checking API key:", e);
      setHasKey(false);
    } finally {
      setLoading(false);
    }
  }, [onKeySelected]);

  useEffect(() => {
    checkKey();
  }, [checkKey]);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success after closing dialog as per instructions
      setHasKey(true);
      onKeySelected();
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-400">
        <div className="animate-pulse">Checking permissions...</div>
      </div>
    );
  }

  if (hasKey) {
    return null; // Render nothing if key is present, let parent render app
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-900 px-4 text-center">
      <div className="mb-8 max-w-md space-y-6 rounded-2xl bg-slate-800 p-8 shadow-2xl ring-1 ring-white/10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/10 ring-1 ring-indigo-500/50">
          <Key className="h-8 w-8 text-indigo-400" />
        </div>
        
        <div>
          <h2 className="mb-2 text-2xl font-bold text-white">API Key Required</h2>
          <p className="text-slate-400">
            To use the high-quality image generation features (Gemini 3 Pro Image), 
            you need to select a paid API key.
          </p>
        </div>

        <button
          onClick={handleSelectKey}
          className="w-full rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition-all hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-800"
        >
          Select API Key
        </button>

        <p className="text-xs text-slate-500">
          Learn more about billing at{' '}
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline"
          >
            ai.google.dev/gemini-api/docs/billing
          </a>
        </p>
      </div>
    </div>
  );
};

export default ApiKeyChecker;