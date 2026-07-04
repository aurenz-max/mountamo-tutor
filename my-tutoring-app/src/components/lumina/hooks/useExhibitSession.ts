import { useState, useCallback } from 'react';
import {
  generateIntroBriefing,
  generateExhibitManifestWithObjectivesStreaming,
  buildCompleteExhibitFromManifestStreaming,
  type ManifestProgressCallback,
} from '../service/geminiClient-api';
import { GameState, type ExhibitData, type IntroBriefingData } from '../types';
import type { GradeLevel } from '../components/GradeLevelSelector';
import { fetchGenerationContext, fetchStudentPersona } from '../service/studentContext/fetchGenerationContext';
import type { StudentGenerationContext } from '../service/studentContext/types';
import { buildPulseCheckManifest, buildPulseBrief } from '../service/manifest/pulse-check-manifest';

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
  /**
   * Curriculum-launched objectives may carry their own subskill IDs (e.g. a
   * daily-session block, where each objective is a distinct subskill). When
   * present these let the personalization step skip embedding retrieval.
   */
  preBuiltObjectives?: Array<{
    id: string; text: string; verb: string; icon: string;
    subskillId?: string; skillId?: string;
    /** Canonical curriculum grade ('K'|'1'..'12') — flows to generators as ctx.grade. */
    grade?: string;
  }>;
  /**
   * Set when the lesson was launched from a single known curriculum node (the
   * browser). The whole lesson is that one subskill, so the brief's generated
   * objectives all resolve to it — no retrieval sweep needed.
   */
  curriculumContext?: { subject: string; skillId: string; subskillId: string };
  /**
   * Exhibit shape. 'lesson' (default) runs the full curated pipeline
   * (brief → manifest → build). 'pulse' is the daily measurement beat: NO
   * narrative brief, NO manifest LLM — a code-built knowledge-check over the
   * preBuiltObjectives, launched fast. Measurement, not instruction.
   */
  sessionShape?: 'lesson' | 'pulse';
  /**
   * Mid-session continuity for the curator brief: one sentence describing
   * what the student finished MOMENTS AGO in this same session ("a Social
   * Studies lesson: Places And Environments"). When present, the brief's
   * hook hands off from it and cross-day facts (streak, yesterday's session)
   * are suppressed — the day is already in motion.
   */
  sessionHandoff?: string;
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
 *
 * When `studentId` is provided, the brief's objectives are resolved against
 * the curriculum (embedding retrieval) and the student's IRT/mastery state
 * is injected into manifest generation. Personalization is strictly
 * fail-soft: any error or timeout falls back to the unpersonalized pipeline.
 */
export function useExhibitSession(studentId?: string): ExhibitSession {
  const [phase, setPhase] = useState<GameState>(GameState.IDLE);
  const [brief, setBrief] = useState<IntroBriefingData | null>(null);
  const [exhibit, setExhibit] = useState<ExhibitData | null>(null);
  const [message, setMessage] = useState('');
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [componentStatuses, setComponentStatuses] = useState<ComponentStatus[]>([]);

  const generate = useCallback(async (options: GenerateOptions) => {
    const { topic, gradeLevel, preBuiltObjectives, curriculumContext } = options;
    if (!topic.trim()) return;

    setPhase(GameState.GENERATING);
    setMessage(`Curating exhibit: ${topic.substring(0, 30)}...`);
    setThoughts([]);
    setComponentStatuses([]);
    setBrief(null);

    // PULSE SHAPE — the daily measurement beat. Deterministic and fast: no
    // persona, no curator brief, no manifest LLM. A code-built manifest holds
    // one orchestrated knowledge-check spanning the block's objectives, each
    // problem attributing to its own objective's subskill. The exhibit opens
    // straight on the check (no intro card is emitted without a curatorBrief).
    if (options.sessionShape === 'pulse' && preBuiltObjectives?.length) {
      try {
        setMessage('⚡ Preparing your Daily Pulse — a few quick wins…');
        const pulseBrief = buildPulseBrief(topic, gradeLevel, preBuiltObjectives);
        setBrief(pulseBrief);
        const manifest = buildPulseCheckManifest(topic, gradeLevel, preBuiltObjectives);

        const pulseStatuses: ComponentStatus[] = (manifest.layout || []).map((item, index) => ({
          id: item.instanceId,
          name: item.componentId,
          status: 'building' as const,
          index: index + 1,
          total: manifest.layout?.length || 1,
          title: item.title,
          intent: item.intent,
        }));
        setComponentStatuses(pulseStatuses);

        const data = await buildCompleteExhibitFromManifestStreaming(
          manifest,
          pulseBrief,
          {
            onComponentComplete: (event) => {
              setComponentStatuses(prev => prev.map(c =>
                c.id === event.instanceId ? { ...c, status: 'completed' as const } : c
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
      return;
    }

    try {
      // STEP 0: Lightweight persona fetch (name + last session) so the brief can
      // greet by name. Pure identity — no objectives, no curriculum retrieval —
      // so it's safe to run before the brief exists. Fail-soft: null ⇒ the brief
      // greets generically, exactly as it did before.
      const persona = studentId
        ? await fetchStudentPersona(studentId, topic)
        : null;

      // STEP 1: Curator brief
      setMessage('🎯 Generating lesson introduction...');
      let generatedBrief = await generateIntroBriefing(
        topic, gradeLevel, persona, options.sessionHandoff
      );
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

      // STEP 1.5: Resolve objectives → curriculum subskills → student state.
      // This is the personalization seam: the brief's objectives carry enough
      // signal for scoped embedding retrieval, and the resolved subskills key
      // into the student's competency/mastery/IRT state. Null on any failure
      // — the manifest then generates exactly as before.
      let studentContext: StudentGenerationContext | null = null;
      if (studentId) {
        setMessage('🎓 Personalizing for this student...');

        // Curriculum-launched lessons already know their subskill(s), so they
        // pass the IDs and the backend skips embedding retrieval. Two shapes:
        //  • preBuiltObjectives carry per-objective subskill IDs (multi-subskill
        //    block/group) → forward them per objective.
        //  • a single curriculumContext (browser launch) → the whole lesson is
        //    one subskill; the backend applies it to every brief objective.
        // Free-form (neither present) falls through to the retrieval sweep.
        const contextObjectives = preBuiltObjectives
          ? preBuiltObjectives.map(o => ({
              id: o.id, text: o.text, verb: o.verb,
              subskillId: o.subskillId, skillId: o.skillId,
            }))
          : objectives;

        studentContext = await fetchGenerationContext({
          studentId,
          topic,
          gradeLevel,
          subject: generatedBrief.subject,
          objectives: contextObjectives,
          // Lesson-level node only applies when objectives don't carry their own.
          curriculumContext: preBuiltObjectives ? undefined : curriculumContext,
          // STEP 0 already fetched the persona (it's identical across calls), so
          // tell the backend not to rebuild it — only fall back to building it
          // here if STEP 0 came back empty (transient failure).
          includePersona: !persona,
        });

        // Re-attach the persona STEP 0 fetched: the backend skipped it above, so
        // inject it here for the manifest's student-voice block.
        if (studentContext && persona && !studentContext.studentProfile) {
          studentContext = { ...studentContext, studentProfile: persona };
        }

        // Persist the objective→subskill resolution this call just computed:
        // stamp curriculum IDs onto the objectives so submissions attribute
        // per objective (ExhibitContext → usePrimitiveEvaluation) and the
        // manifest flatten stamps per-component/per-KC-problem attribution
        // keys. preBuiltObjectives already carry IDs (kept via ??); this makes
        // free-form and single-subskill browser lessons attribution-complete too.
        if (studentContext?.objectives?.length) {
          const resolvedById = new Map(
            studentContext.objectives
              .filter(o => o.subskillId)
              .map(o => [o.objectiveId, o])
          );
          if (resolvedById.size > 0) {
            objectives = objectives.map(o => {
              const r = resolvedById.get(o.id);
              return r
                ? { ...o, subskillId: o.subskillId ?? r.subskillId, skillId: o.skillId ?? r.skillId }
                : o;
            });
            generatedBrief = { ...generatedBrief, objectives };
            setBrief(generatedBrief);
          }
        }
      }

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
        manifestCallbacks,
        studentContext
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
  }, [studentId]);

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
