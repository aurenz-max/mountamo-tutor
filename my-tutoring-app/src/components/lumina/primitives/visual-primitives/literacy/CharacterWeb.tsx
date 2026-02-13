'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { CharacterWebMetrics } from '../../../evaluation/types';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface CharacterProfile {
  characterId: string;
  name: string;
  description: string;               // Brief context about the character
  suggestedTraits: string[];          // Traits students should identify
  traitEvidence: Record<string, string>; // trait -> text evidence passage
}

export interface CharacterRelationship {
  fromCharacterId: string;
  toCharacterId: string;
  relationshipType: string;           // friend, rival, family, mentor, etc.
  description: string;                // How they relate
}

export interface CharacterWebData {
  title: string;
  gradeLevel: string;
  storyContext: string;               // Brief story summary for reference

  characters: CharacterProfile[];
  relationships: CharacterRelationship[];

  // Character change prompt (Phase 3)
  changePrompt: string;               // e.g. "How does [character] change from beginning to end?"
  changeCharacterId: string;          // Which character the change question targets
  expectedChange: string;             // Model answer for the change

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<CharacterWebMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface CharacterWebProps {
  data: CharacterWebData;
  className?: string;
}

// ============================================================================
// Types
// ============================================================================

type WebPhase = 'profile' | 'connect' | 'analyze' | 'review';

interface StudentTrait {
  trait: string;
  evidence: string;
}

interface StudentRelationship {
  fromId: string;
  toId: string;
  type: string;
}

// ============================================================================
// Constants
// ============================================================================

const RELATIONSHIP_COLORS: Record<string, string> = {
  friend: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
  rival: 'bg-rose-500/20 border-rose-500/40 text-rose-300',
  family: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
  mentor: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  enemy: 'bg-red-500/20 border-red-500/40 text-red-300',
  ally: 'bg-teal-500/20 border-teal-500/40 text-teal-300',
};

const RELATIONSHIP_TYPES = ['friend', 'rival', 'family', 'mentor', 'enemy', 'ally'];

// ============================================================================
// Component
// ============================================================================

const CharacterWeb: React.FC<CharacterWebProps> = ({ data, className }) => {
  const {
    title, gradeLevel, storyContext, characters, relationships,
    changePrompt, changeCharacterId, expectedChange,
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;

  const [currentPhase, setCurrentPhase] = useState<WebPhase>('profile');
  const [activeCharacterIdx, setActiveCharacterIdx] = useState(0);
  const [studentTraits, setStudentTraits] = useState<Record<string, StudentTrait[]>>({});
  const [studentRelationships, setStudentRelationships] = useState<StudentRelationship[]>([]);
  const [changeText, setChangeText] = useState('');
  const [newTraitText, setNewTraitText] = useState('');
  const [newEvidenceText, setNewEvidenceText] = useState('');
  const [connectFromId, setConnectFromId] = useState('');
  const [connectToId, setConnectToId] = useState('');
  const [connectType, setConnectType] = useState('friend');

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<CharacterWebMetrics>({
    primitiveType: 'character-web',
    instanceId: instanceId || `character-web-${Date.now()}`,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Phase navigation
  const phases: WebPhase[] = ['profile', 'connect', 'analyze', 'review'];
  const phaseLabels: Record<WebPhase, string> = {
    profile: 'Profile',
    connect: 'Connect',
    analyze: 'Analyze',
    review: 'Review',
  };

  const nextPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx < phases.length - 1) setCurrentPhase(phases[idx + 1]);
  };
  const prevPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx > 0) setCurrentPhase(phases[idx - 1]);
  };

  // Add trait to current character
  const addTrait = useCallback(() => {
    if (!newTraitText.trim()) return;
    const charId = characters[activeCharacterIdx]?.characterId;
    if (!charId) return;
    setStudentTraits(prev => ({
      ...prev,
      [charId]: [...(prev[charId] || []), { trait: newTraitText.trim(), evidence: newEvidenceText.trim() }],
    }));
    setNewTraitText('');
    setNewEvidenceText('');
  }, [newTraitText, newEvidenceText, activeCharacterIdx, characters]);

  // Remove trait
  const removeTrait = useCallback((charId: string, index: number) => {
    setStudentTraits(prev => ({
      ...prev,
      [charId]: (prev[charId] || []).filter((_, i) => i !== index),
    }));
  }, []);

  // Add relationship
  const addRelationship = useCallback(() => {
    if (!connectFromId || !connectToId || connectFromId === connectToId) return;
    // Avoid duplicates
    const exists = studentRelationships.some(r =>
      (r.fromId === connectFromId && r.toId === connectToId) ||
      (r.fromId === connectToId && r.toId === connectFromId)
    );
    if (exists) return;
    setStudentRelationships(prev => [...prev, { fromId: connectFromId, toId: connectToId, type: connectType }]);
    setConnectFromId('');
    setConnectToId('');
  }, [connectFromId, connectToId, connectType, studentRelationships]);

  // Calculate metrics
  const calculateMetrics = useCallback(() => {
    const totalCharactersProfiled = characters.filter(c => (studentTraits[c.characterId] || []).length > 0).length;
    const allTraits = Object.values(studentTraits).flat();
    const traitsWithEvidence = allTraits.filter(t => t.evidence.length > 10).length;
    const traitsTotal = allTraits.length;
    const relationshipsIdentified = studentRelationships.length;
    const relationshipsTotal = relationships.length;
    const characterChangeIdentified = changeText.trim().length > 15;

    // Depth based on evidence quality
    let analysisDepth: 'surface' | 'moderate' | 'deep' = 'surface';
    if (traitsWithEvidence >= 3 && characterChangeIdentified) analysisDepth = 'moderate';
    if (traitsWithEvidence >= 5 && characterChangeIdentified && relationshipsIdentified >= relationshipsTotal) analysisDepth = 'deep';

    return {
      totalCharactersProfiled,
      traitsWithEvidence,
      traitsTotal,
      relationshipsIdentified,
      relationshipsTotal,
      characterChangeIdentified,
      analysisDepth,
    };
  }, [studentTraits, studentRelationships, relationships, characters, changeText]);

  // Submit evaluation
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    const m = calculateMetrics();

    // Score: traits (35%) + relationships (25%) + change (20%) + evidence (20%)
    const traitScore = m.traitsTotal >= 3 ? 35 : Math.round((m.traitsTotal / 3) * 35);
    const relScore = m.relationshipsTotal > 0 ? Math.round((m.relationshipsIdentified / m.relationshipsTotal) * 25) : 25;
    const changeScore = m.characterChangeIdentified ? 20 : 0;
    const evidenceScore = m.traitsTotal > 0 ? Math.round((m.traitsWithEvidence / m.traitsTotal) * 20) : 0;
    const score = traitScore + relScore + changeScore + evidenceScore;

    const metrics: CharacterWebMetrics = {
      type: 'character-web',
      charactersProfiled: m.totalCharactersProfiled,
      charactersRequired: characters.length,
      traitsWithEvidence: m.traitsWithEvidence,
      traitsTotal: m.traitsTotal,
      relationshipsIdentified: m.relationshipsIdentified,
      relationshipsTotal: m.relationshipsTotal,
      characterChangeIdentified: m.characterChangeIdentified,
      analysisDepth: m.analysisDepth,
      attemptsCount: 1,
    };

    submitEvaluation(score >= 50, score, metrics, {
      studentTraits, studentRelationships, changeText,
    });
  }, [hasSubmittedEvaluation, calculateMetrics, characters, submitEvaluation, studentTraits, studentRelationships, changeText]);

  // Render progress bar
  const renderProgress = () => (
    <div className="flex items-center gap-2 mb-4">
      {phases.map((phase, i) => {
        const isActive = phase === currentPhase;
        const phaseIdx = phases.indexOf(currentPhase);
        const isCompleted = i < phaseIdx;
        return (
          <React.Fragment key={phase}>
            {i > 0 && <div className={`h-0.5 w-6 ${isCompleted || isActive ? 'bg-emerald-500/60' : 'bg-slate-600/40'}`} />}
            <div className={`px-2 py-1 rounded text-xs font-medium border ${
              isCompleted ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : isActive ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
              : 'bg-slate-700/20 border-slate-600/30 text-slate-500'
            }`}>
              {phaseLabels[phase]}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  const activeChar = characters[activeCharacterIdx];
  const activeTraits = activeChar ? (studentTraits[activeChar.characterId] || []) : [];

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">Grade {gradeLevel}</Badge>
              <Badge variant="outline" className="bg-violet-500/10 border-violet-500/30 text-violet-300 text-xs">{characters.length} Characters</Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {renderProgress()}

        {/* Story Context */}
        <div className="rounded-lg bg-white/5 border border-white/10 p-3">
          <p className="text-xs text-slate-500 mb-1">Story:</p>
          <p className="text-slate-300 text-sm">{storyContext}</p>
        </div>

        {/* Phase 1: Profile */}
        {currentPhase === 'profile' && (
          <div className="space-y-3">
            {/* Character tabs */}
            <div className="flex gap-2">
              {characters.map((c, i) => {
                const hasTraits = (studentTraits[c.characterId] || []).length > 0;
                return (
                  <button
                    key={c.characterId}
                    onClick={() => setActiveCharacterIdx(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      i === activeCharacterIdx
                        ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                        : hasTraits
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {c.name} {hasTraits && `(${(studentTraits[c.characterId] || []).length})`}
                  </button>
                );
              })}
            </div>

            {/* Active character profile */}
            {activeChar && (
              <div className="space-y-3">
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <p className="text-sm text-slate-300">{activeChar.description}</p>
                  <p className="text-xs text-slate-500 mt-2">Hint: Look for traits like: {activeChar.suggestedTraits.join(', ')}</p>
                </div>

                {/* Existing traits */}
                {activeTraits.length > 0 && (
                  <div className="space-y-1.5">
                    {activeTraits.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg bg-violet-500/10 border border-violet-500/30 p-2">
                        <div className="flex-1">
                          <p className="text-sm text-violet-200 font-medium">{t.trait}</p>
                          {t.evidence && <p className="text-xs text-slate-400 mt-0.5 italic">&ldquo;{t.evidence}&rdquo;</p>}
                        </div>
                        <button onClick={() => removeTrait(activeChar.characterId, i)} className="text-white/30 hover:text-white/60 text-xs">x</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add trait */}
                <div className="space-y-2">
                  <input
                    value={newTraitText}
                    onChange={e => setNewTraitText(e.target.value)}
                    placeholder="Character trait (e.g. brave, selfish, curious)..."
                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40"
                  />
                  <textarea
                    value={newEvidenceText}
                    onChange={e => setNewEvidenceText(e.target.value)}
                    placeholder="Text evidence (quote or paraphrase from the story)..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40 resize-none"
                  />
                  <Button variant="ghost" onClick={addTrait} disabled={!newTraitText.trim()}
                    className="bg-violet-500/20 border border-violet-500/40 hover:bg-violet-500/30 text-violet-300 text-xs">
                    Add Trait
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" onClick={nextPhase}
                disabled={Object.values(studentTraits).flat().length < 2}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Next: Connect Characters
              </Button>
            </div>
          </div>
        )}

        {/* Phase 2: Connect */}
        {currentPhase === 'connect' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Define how the characters relate to each other:</p>

            {/* Existing relationships */}
            {studentRelationships.length > 0 && (
              <div className="space-y-1.5">
                {studentRelationships.map((rel, i) => {
                  const from = characters.find(c => c.characterId === rel.fromId);
                  const to = characters.find(c => c.characterId === rel.toId);
                  const colorClass = RELATIONSHIP_COLORS[rel.type] || 'bg-slate-500/20 border-slate-500/40 text-slate-300';
                  return (
                    <div key={i} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${colorClass}`}>
                      <span className="text-sm font-medium">{from?.name || rel.fromId}</span>
                      <span className="text-xs opacity-50">—</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-black/20">{rel.type}</span>
                      <span className="text-xs opacity-50">—</span>
                      <span className="text-sm font-medium">{to?.name || rel.toId}</span>
                      <button onClick={() => setStudentRelationships(prev => prev.filter((_, j) => j !== i))} className="ml-auto text-white/30 hover:text-white/60 text-xs">x</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add relationship */}
            {characters.length >= 2 && (
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <p className="text-xs text-slate-500 mb-1">From:</p>
                  <select value={connectFromId} onChange={e => setConnectFromId(e.target.value)}
                    className="px-2 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-200 text-sm">
                    <option value="">Select...</option>
                    {characters.map(c => <option key={c.characterId} value={c.characterId}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Relationship:</p>
                  <select value={connectType} onChange={e => setConnectType(e.target.value)}
                    className="px-2 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-200 text-sm">
                    {RELATIONSHIP_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">To:</p>
                  <select value={connectToId} onChange={e => setConnectToId(e.target.value)}
                    className="px-2 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-200 text-sm">
                    <option value="">Select...</option>
                    {characters.filter(c => c.characterId !== connectFromId).map(c => (
                      <option key={c.characterId} value={c.characterId}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <Button variant="ghost" onClick={addRelationship} disabled={!connectFromId || !connectToId}
                  className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300 text-xs">
                  Add
                </Button>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
              <Button variant="ghost" onClick={nextPhase} disabled={studentRelationships.length === 0}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Next: Analyze Change
              </Button>
            </div>
          </div>
        )}

        {/* Phase 3: Analyze */}
        {currentPhase === 'analyze' && (
          <div className="space-y-3">
            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <p className="text-sm text-slate-300">{changePrompt}</p>
            </div>
            <textarea
              value={changeText}
              onChange={e => setChangeText(e.target.value)}
              placeholder="Describe how the character changed and why..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40 resize-none"
            />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
              <Button variant="ghost" onClick={nextPhase} disabled={changeText.trim().length < 10}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Review
              </Button>
            </div>
          </div>
        )}

        {/* Phase 4: Review */}
        {currentPhase === 'review' && (
          <div className="space-y-4">
            {/* Character nodes visualization */}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(characters.length, 3)}, 1fr)` }}>
              {characters.map(c => {
                const traits = studentTraits[c.characterId] || [];
                return (
                  <div key={c.characterId} className="rounded-lg bg-violet-500/10 border border-violet-500/30 p-3">
                    <p className="text-sm font-bold text-violet-200">{c.name}</p>
                    {traits.length > 0 ? (
                      <ul className="mt-1 space-y-0.5">
                        {traits.map((t, i) => (
                          <li key={i} className="text-xs text-slate-300">
                            {t.trait} {t.evidence && <span className="text-slate-500 italic">— &ldquo;{t.evidence.slice(0, 40)}...&rdquo;</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-600 mt-1">No traits added</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Relationships */}
            {studentRelationships.length > 0 && (
              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                <p className="text-xs text-slate-500 mb-1">Relationships:</p>
                {studentRelationships.map((rel, i) => {
                  const from = characters.find(c => c.characterId === rel.fromId);
                  const to = characters.find(c => c.characterId === rel.toId);
                  return (
                    <p key={i} className="text-xs text-slate-300">
                      {from?.name} <span className="text-slate-500">— {rel.type} —</span> {to?.name}
                    </p>
                  );
                })}
              </div>
            )}

            {/* Change analysis */}
            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <p className="text-xs text-slate-500 mb-1">Character Change:</p>
              <p className="text-sm text-slate-300">{changeText || <span className="italic text-slate-600">Not written</span>}</p>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Edit</Button>
              {!hasSubmittedEvaluation ? (
                <Button variant="ghost" onClick={submitFinalEvaluation}
                  className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300">
                  Submit
                </Button>
              ) : (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center w-full">
                  <p className="text-emerald-300 font-semibold">Character Web Complete!</p>
                  <p className="text-slate-400 text-sm mt-1">
                    {Object.values(studentTraits).flat().length} traits | {studentRelationships.length} relationships | {changeText.trim() ? 'Change identified' : 'No change'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CharacterWeb;
