import { useState, useCallback } from 'react';
import {
  generateIntroBriefing,
  generateExhibitManifestWithObjectivesStreaming,
  buildCompleteExhibitFromManifestStreaming,
  type ManifestProgressCallback,
} from '../service/geminiClient-api';
import { GameState, type ExhibitData, type IntroBriefingData } from '../types';
import type { GradeLevel } from '../components/GradeLevelSelector';

export interface ComponentStatus {
  id: string;
  name: string;
  status: 'pending' | 'building' | 'completed';
  index: number;
  total: number;
  title?: string;
  intent?: string;
  objectiveId?: string;
  objectiveText?: string;
  objectiveVerb?: string;
}

export interface ExhibitProgress {
  message: string;
  thoughts: string[];
  componentStatuses: ComponentStatus[];
}

export interface GenerateOptions {
  topic: string;
  gradeLevel: GradeLevel;
  preBuiltObjectives?: Array<{ id: string; text: string; verb: string; icon: string }>;
}

export interface ExhibitSession {
  phase: GameState;
  brief: IntroBriefingData | null;
  exhibit: ExhibitData | null;
  progress: ExhibitProgress;
  generate: (options: GenerateOptions) => Promise<void>;
  reset: () => void;
}

/**
 * useExhibitSession — encapsulates the 3-step lesson pipeline:
 *   1. Curator brief  (generateIntroBriefing)
 *   2. Manifest        (generateExhibitManifestWithObjectivesStreaming)
 *   3. Exhibit build   (buildCompleteExhibitFromManifestStreaming)
 *
 * Returns stable `generate` and `reset` callbacks. All intermediate state
 * (loading messages, thinking, component build progress) is exposed through
 * the `progress` object so the caller can render a loading screen.
 */
export function useExhibitSession(): ExhibitSession {
  const [phase, setPhase] = useState<GameState>(GameState.IDLE);
  const [brief, setBrief] = useState<IntroBriefingData | null>(null);
  const [exhibit, setExhibit] = useState<ExhibitData | null>(null);
  const [message, setMessage] = useState('');
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [componentStatuses, setComponentStatuses] = useState<ComponentStatus[]>([]);

  const generate = useCallback(async (options: GenerateOptions) => {
    const { topic, gradeLevel, preBuiltObjectives } = options;
    if (!topic.trim()) return;

    setPhase(GameState.GENERATING);
    setMessage(`Curating exhibit: ${topic.substring(0, 30)}...`);
    setThoughts([]);
    setComponentStatuses([]);
    setBrief(null);

    try {
      // STEP 1: Curator brief
      setMessage('🎯 Generating lesson introduction...');
      let generatedBrief = await generateIntroBriefing(topic, gradeLevel);
      console.log('📚 Curator brief generated:', generatedBrief);

      let objectives = generatedBrief.objectives;

      if (preBuiltObjectives) {
        // Lesson Group Builder path — replace Gemini's objectives with user's selections,
        // but keep all the other brief content (hook, big idea, mindset, roadmap, etc.)
        objectives = preBuiltObjectives as typeof generatedBrief.objectives;
        generatedBrief = { ...generatedBrief, objectives: preBuiltObjectives as typeof generatedBrief.objectives };
        console.log('📚 Overriding objectives with lesson group selections:', objectives);
      }

      setBrief(generatedBrief);

      // STEP 2: Manifest generation with streaming
      setMessage('📋 Generating exhibit blueprint...');

      const manifestCallbacks: ManifestProgressCallback = {
        onProgress: (msg: string) => {
          console.log('🔄 Manifest Progress:', msg);
          setMessage(msg);
        },
        onThinking: (thought: string) => {
          console.log('🧠 AI Thinking:', thought);
          setThoughts(prev => [...prev.slice(-4), thought]);
        },
        onPartialManifest: (partial) => {
          console.log('📦 Partial Manifest:', partial);
        },
      };

      const manifest = await generateExhibitManifestWithObjectivesStreaming(
        topic,
        gradeLevel,
        objectives,
        manifestCallbacks
      );
      console.log('🗺️ Manifest generated based on learning objectives');

      // STEP 3: Build complete exhibit from manifest (with real streaming progress)
      setMessage('🎨 Building components in parallel...');
      setThoughts([]);

      // Initialize all components as "building" — they're all in-flight in parallel
      const totalComponents = manifest.layout?.length || 0;
      const initialStatuses: ComponentStatus[] = (manifest.layout || []).map((item, index) => ({
        id: item.instanceId,
        name: item.componentId,
        status: 'building' as const,
        index: index + 1,
        total: totalComponents,
        title: item.title,
        intent: item.intent,
        objectiveId: item.config?.objectiveId,
        objectiveText: item.config?.objectiveText,
        objectiveVerb: item.config?.objectiveVerb,
      }));
      setComponentStatuses(initialStatuses);

      // Stream real build progress — each component marked complete as it actually finishes
      const data = await buildCompleteExhibitFromManifestStreaming(
        manifest,
        generatedBrief,
        {
          onComponentComplete: (event) => {
            setComponentStatuses(prev => prev.map(c =>
              c.id === event.instanceId
                ? { ...c, status: 'completed' as const }
                : c
            ));
          },
        }
      );

      setExhibit(data);
      setPhase(GameState.PLAYING);
    } catch (error) {
      console.error(error);
      setPhase(GameState.ERROR);
    }
  }, []);

  const reset = useCallback(() => {
    setPhase(GameState.IDLE);
    setBrief(null);
    setExhibit(null);
    setMessage('');
    setThoughts([]);
    setComponentStatuses([]);
  }, []);

  return {
    phase,
    brief,
    exhibit,
    progress: { message, thoughts, componentStatuses },
    generate,
    reset,
  };
}
