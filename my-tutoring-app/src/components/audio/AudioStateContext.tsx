'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type AudioState = {
  isGeminiSpeaking: boolean;
  isUserSpeaking: boolean;
};

type AudioStateContextType = {
  audioState: AudioState;
  setAudioState: React.Dispatch<React.SetStateAction<AudioState>>;
};

const defaultState: AudioState = {
  isGeminiSpeaking: false,
  isUserSpeaking: false,
};

const AudioStateContext = createContext<AudioStateContextType | undefined>(undefined);

export const AudioStateProvider = ({ children }: { children: ReactNode }) => {
  const [audioState, setAudioState] = useState<AudioState>(defaultState);

  return (
    <AudioStateContext.Provider value={{ audioState, setAudioState }}>
      {children}
    </AudioStateContext.Provider>
  );
};

export const useAudioState = () => {
  const context = useContext(AudioStateContext);
  if (context === undefined) {
    throw new Error('useAudioState must be used within an AudioStateProvider');
  }
  return context;
};