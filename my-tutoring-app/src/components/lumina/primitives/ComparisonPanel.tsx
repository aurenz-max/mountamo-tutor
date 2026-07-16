'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ComparisonData } from '../types';
import { generateConceptImage } from '../service/geminiClient-api';
import {
  usePrimitiveEvaluation,
  type ComparisonPanelMetrics,
  type PrimitiveEvaluationResult,
} from '../evaluation';
import { useLuminaAI } from '../hooks/useLuminaAI';
import { SoundManager } from '../utils/SoundManager';
import { isPreReaderGrade } from '../utils/kindergartenMode';
import { PreReaderSelfCheck } from './shared/PreReaderSelfCheck';
import {
  LuminaButton,
  LuminaCallout,
  LuminaPanel,
  LuminaSectionLabel,
} from '../ui';

interface ComparisonPanelProps {
  data: ComparisonData;
}

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({ data }) => {
  const [image1, setImage1] = useState<string | null>(null);
  const [image2, setImage2] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<1 | 2 | null>(null);
  const [selectedItem, setSelectedItem] = useState<1 | 2 | null>(null);

  // Exploration tracking
  const [item1Clicked, setItem1Clicked] = useState(false);
  const [item2Clicked, setItem2Clicked] = useState(false);
  const [explorationStartTime] = useState(Date.now());

  // Gate state
  const [currentGateIndex, setCurrentGateIndex] = useState(0);
  const [gateAnswer, setGateAnswer] = useState<boolean | null>(null);
  const [gateSubmitted, setGateSubmitted] = useState(false);
  const [gateResults, setGateResults] = useState<Array<{
    gateIndex: number;
    question: string;
    correctAnswer: boolean;
    studentAnswer: boolean;
    isCorrect: boolean;
    attemptNumber: number;
    timeToAnswer: number;
  }>>([]);
  const [gateAttemptStartTime, setGateAttemptStartTime] = useState<number | null>(null);
  const [gateAttemptCounts, setGateAttemptCounts] = useState<Record<number, number>>({});

  // AI trigger guards (prevent double-firing)
  const hasTriggeredItem1Ref = useRef(false);
  const hasTriggeredItem2Ref = useRef(false);
  const hasTriggeredGateOpenRef = useRef(false);
  const hasTriggeredSynthesisRef = useRef(false);
  const hasTriggeredFinalCardsRef = useRef(false);
  const hasTriggeredPreStartRef = useRef(false);

  // Evaluation integration
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Pre-reader (kindergarten / PRE band) treatment: the graded gate becomes a
  // picture true/false (tap 👍/👎, no Submit) the tutor reads aloud, and adult
  // chrome (Option A/B badges, VS badge, "Comprehension Check N of M", the prose
  // synthesis labels) is hidden. Driven by the generator-stamped gradeLevel.
  const preReader = isPreReaderGrade(data.gradeLevel);

  const resolvedInstanceId = instanceId || `comparison-panel-${Date.now()}`;

  const {
    submitResult,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<ComparisonPanelMetrics>({
    primitiveType: 'comparison-panel',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const gates = data.gates || [];
  const hasGates = gates.length > 0;
  const currentGate = gates[currentGateIndex];
  const allGatesCompleted = currentGateIndex >= gates.length;

  // Progressive reveal logic
  const bothItemsExplored = item1Clicked && item2Clicked;
  const canShowFirstGate = hasGates && bothItemsExplored && currentGateIndex === 0;
  const canShowSynthesis = !hasGates || (currentGateIndex > 0 || allGatesCompleted);
  // PRE walks EVERY gate (the reader path only gates on the first); a new branch,
  // so the reader-mode reveal logic above is untouched.
  const canShowPreGate = hasGates && bothItemsExplored && !allGatesCompleted && !!currentGate;

  // --- AI Tutoring Integration ---
  const aiPrimitiveData = {
    title: data.title,
    item1Name: data.item1.name,
    item2Name: data.item2.name,
    item1Explored: item1Clicked,
    item2Explored: item2Clicked,
    currentGateIndex,
    totalGates: gates.length,
    currentGateQuestion: currentGate?.question || '',
    allGatesCompleted,
  };

  const { sendText } = useLuminaAI({
    primitiveType: 'comparison-panel',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    exhibitId,
  });

  // PRE ORIENT: on mount, tell the non-reader to tap each picture. Durable carrier
  // is the catalog [COMPARE_START] directive (survives the lesson one-sentence cap).
  useEffect(() => {
    if (preReader && !hasTriggeredPreStartRef.current) {
      hasTriggeredPreStartRef.current = true;
      sendText(
        `[COMPARE_START] The student is comparing "${data.item1.name}" and "${data.item2.name}". `
        + `Warmly tell them to tap each of the two pictures to hear about it.`,
        { silent: true },
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preReader]);

  // AI trigger: Item explored
  useEffect(() => {
    if (item1Clicked && !hasTriggeredItem1Ref.current) {
      hasTriggeredItem1Ref.current = true;
      const isSecond = item2Clicked;
      if (preReader) {
        // Silent background trigger (like [ITEM_EXPLORED]/[ACTIVITY_START]): it must
        // not claim mic focus, but the tutor still SPEAKS the read-aloud in response
        // to the catalog PRE-READER READ-ALOUD directive (which survives the cap).
        sendText(
          `[ITEM_READ_ALOUD] Read this card aloud to the child, word for word, warmly and simply: `
          + `"${data.item1.name}". Two things about it: ${data.item1.points.slice(0, 2).join('; ')}. `
          + (isSecond
            ? `They have now tapped both pictures — tell them they are ready for the question.`
            : `Then invite them to tap the other picture.`),
          { silent: true },
        );
      } else {
        sendText(
          `[ITEM_EXPLORED] The student just explored "${data.item1.name}" (Option A). ` +
          `Key features: ${data.item1.points.slice(0, 2).join('; ')}. ` +
          (isSecond
            ? `Both items are now explored. Congratulate them and prepare them for the comprehension check.`
            : `This is the first card explored. Walk them through the material and build curiosity about "${data.item2.name}".`),
          { silent: true }
        );
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item1Clicked]);

  useEffect(() => {
    if (item2Clicked && !hasTriggeredItem2Ref.current) {
      hasTriggeredItem2Ref.current = true;
      const isSecond = item1Clicked;
      if (preReader) {
        sendText(
          `[ITEM_READ_ALOUD] Read this card aloud to the child, word for word, warmly and simply: `
          + `"${data.item2.name}". Two things about it: ${data.item2.points.slice(0, 2).join('; ')}. `
          + (isSecond
            ? `They have now tapped both pictures — tell them they are ready for the question.`
            : `Then invite them to tap the other picture.`),
          { silent: true },
        );
      } else {
        sendText(
          `[ITEM_EXPLORED] The student just explored "${data.item2.name}" (Option B). ` +
          `Key features: ${data.item2.points.slice(0, 2).join('; ')}. ` +
          (isSecond
            ? `Both items are now explored. Congratulate them and prepare them for the comprehension check.`
            : `This is the first card explored. Walk them through the material and build curiosity about "${data.item1.name}".`),
          { silent: true }
        );
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item2Clicked]);

  // AI trigger: Gate opened (both items explored, first gate visible). Reader-mode
  // only — at PRE the picture gate owns its own read-aloud on view (see renderPreGate).
  useEffect(() => {
    if (!preReader && bothItemsExplored && hasGates && currentGate && !hasTriggeredGateOpenRef.current) {
      hasTriggeredGateOpenRef.current = true;
      sendText(
        `[GATE_OPENED] A true/false comprehension check has appeared. ` +
        `Question: "${currentGate.question}". ` +
        `Read the question aloud and encourage the student to think carefully before answering. ` +
        `Do NOT hint at the answer.`,
        { silent: true }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothItemsExplored]);

  useEffect(() => {
    let mounted = true;

    const fetchImages = async () => {
        if(!data.item1.visualPrompt || !data.item2.visualPrompt) return;

        const p1 = generateConceptImage(`A futuristic, abstract symbolic representation of: ${data.item1.visualPrompt}. Blue and Cyan lighting scheme. Minimalist.`);
        const p2 = generateConceptImage(`A futuristic, abstract symbolic representation of: ${data.item2.visualPrompt}. Red and Orange lighting scheme. Minimalist.`);

        const [url1, url2] = await Promise.all([p1, p2]);

        if (mounted) {
            if (url1) setImage1(url1);
            if (url2) setImage2(url2);
        }
    };

    fetchImages();
    return () => { mounted = false; };
  }, [data.item1.visualPrompt, data.item2.visualPrompt]);

  const handleItemClick = (itemNumber: 1 | 2) => {
    SoundManager.tap();
    setSelectedItem(selectedItem === itemNumber ? null : itemNumber);

    if (itemNumber === 1 && !item1Clicked) {
      setItem1Clicked(true);
    } else if (itemNumber === 2 && !item2Clicked) {
      setItem2Clicked(true);
    }

    // Start gate timer when both items explored for the first time
    if (!item1Clicked || !item2Clicked) {
      if ((itemNumber === 1 && item2Clicked) || (itemNumber === 2 && item1Clicked)) {
        setGateAttemptStartTime(Date.now());
      }
    }
  };

  const handleGateAnswer = (answer: boolean) => {
    if (gateSubmitted) return;
    SoundManager.select();
    setGateAnswer(answer);
  };

  const handleGateSubmit = () => {
    if (gateAnswer === null || !currentGate) return;

    const isCorrect = gateAnswer === currentGate.correctAnswer;
    const attemptNumber = (gateAttemptCounts[currentGateIndex] || 0) + 1;
    const timeToAnswer = gateAttemptStartTime ? Date.now() - gateAttemptStartTime : 0;

    // Record this gate result
    const newResult = {
      gateIndex: currentGateIndex,
      question: currentGate.question,
      correctAnswer: currentGate.correctAnswer,
      studentAnswer: gateAnswer,
      isCorrect,
      attemptNumber,
      timeToAnswer,
    };

    setGateResults([...gateResults, newResult]);
    setGateAttemptCounts({
      ...gateAttemptCounts,
      [currentGateIndex]: attemptNumber,
    });
    setGateSubmitted(true);

    // Immediate per-gate feedback
    if (isCorrect) {
      SoundManager.playCorrect();
    } else {
      SoundManager.playIncorrect();
    }

    // AI trigger: Gate answer feedback
    if (isCorrect) {
      sendText(
        `[GATE_CORRECT] The student answered "${gateAnswer ? 'True' : 'False'}" — correct! ` +
        `Question was: "${currentGate.question}". Attempt #${attemptNumber}. ` +
        `Briefly celebrate their understanding.`,
        { silent: true }
      );
    } else {
      sendText(
        `[GATE_INCORRECT] The student answered "${gateAnswer ? 'True' : 'False'}" but that's incorrect. ` +
        `Question was: "${currentGate.question}". Attempt #${attemptNumber}. ` +
        `Encourage them to re-read the material and try again. Do NOT reveal the answer.`,
        { silent: true }
      );
    }

    // If correct, advance after a brief moment to show feedback
    if (isCorrect) {
      setTimeout(() => {
        const nextIndex = currentGateIndex + 1;
        setCurrentGateIndex(nextIndex);
        setGateAnswer(null);
        setGateSubmitted(false);
        setGateAttemptStartTime(Date.now());

        // Submit evaluation if all gates completed
        if (nextIndex >= gates.length) {
          submitEvaluation([...gateResults, newResult]);
        }
      }, 2000);
    }
  };

  // PRE gate pass: PreReaderSelfCheck is eliminate-until-correct and owns the
  // wrong-tap RECOVER beat, so onResult fires once (correct) per gate. Record the
  // result, celebrate, advance, and submit on the final gate. Walks all gates.
  const handlePreGatePass = (attempts: number) => {
    if (!currentGate) return;
    const timeToAnswer = gateAttemptStartTime ? Date.now() - gateAttemptStartTime : 0;
    const newResult = {
      gateIndex: currentGateIndex,
      question: currentGate.question,
      correctAnswer: currentGate.correctAnswer,
      studentAnswer: currentGate.correctAnswer,
      isCorrect: true,
      attemptNumber: attempts,
      timeToAnswer,
    };
    const updated = [...gateResults, newResult];
    setGateResults(updated);

    sendText(
      `[GATE_CORRECT] The pre-reader answered the picture true/false correctly `
      + `("${currentGate.question}"). Briefly celebrate in ONE warm sentence.`,
      { silent: true },
    );

    const nextIndex = currentGateIndex + 1;
    setCurrentGateIndex(nextIndex);
    setGateAttemptStartTime(Date.now());
    if (nextIndex >= gates.length) {
      submitEvaluation(updated);
    }
  };

  // AI trigger: All gates completed → synthesis unlocked
  useEffect(() => {
    if (allGatesCompleted && hasGates && !hasTriggeredSynthesisRef.current) {
      hasTriggeredSynthesisRef.current = true;
      sendText(
        `[SYNTHESIS_UNLOCKED] The student completed all ${gates.length} comprehension gates! ` +
        `The synthesis section is now revealed. Main insight: "${data.synthesis.mainInsight}". ` +
        `Walk them through the synthesis — mention the key differences and similarities. ` +
        `Be celebratory and engaging.`,
        { silent: true }
      );

      // AI trigger: Final cards (When to Use + Common Misconception) — delayed so synthesis speech finishes
      if (data.synthesis.whenToUse || data.synthesis.commonMisconception) {
        setTimeout(() => {
          if (!hasTriggeredFinalCardsRef.current) {
            hasTriggeredFinalCardsRef.current = true;
            const parts: string[] = [];
            if (data.synthesis.whenToUse) {
              parts.push(
                `"When to Use Each": ${data.item1.name} — ${data.synthesis.whenToUse.item1Context}; ` +
                `${data.item2.name} — ${data.synthesis.whenToUse.item2Context}.`
              );
            }
            if (data.synthesis.commonMisconception) {
              parts.push(`"Common Misconception": ${data.synthesis.commonMisconception}.`);
            }
            sendText(
              `[FINAL_CARDS] Now walk the student through the final sections. ` +
              parts.join(' ') + ' ' +
              `Help the student understand when each option is best and clear up any misconception.`,
              { silent: true }
            );
          }
        }, 8000);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGatesCompleted]);

  const handleGateReset = () => {
    setGateAnswer(null);
    setGateSubmitted(false);
    setGateAttemptStartTime(Date.now());
  };

  const submitEvaluation = (allResults: typeof gateResults) => {
    if (hasSubmittedEvaluation) return;

    const totalAttempts = allResults.length;
    const firstAttemptCorrect = allResults.filter(r => r.isCorrect && r.attemptNumber === 1).length;
    const correctAnswers = new Set(allResults.filter(r => r.isCorrect).map(r => r.gateIndex)).size;

    const firstAttemptSuccessRate = gates.length > 0 ? (firstAttemptCorrect / gates.length) * 100 : 0;
    const overallAccuracy = totalAttempts > 0 ? (correctAnswers / gates.length) * 100 : 0;
    const timeSpentExploring = gateAttemptStartTime ? gateAttemptStartTime - explorationStartTime : 0;

    const metrics: ComparisonPanelMetrics = {
      type: 'comparison-panel',
      item1Explored: item1Clicked,
      item2Explored: item2Clicked,
      bothItemsExplored: item1Clicked && item2Clicked,
      totalGates: gates.length,
      gatesCompleted: correctAnswers,
      gateAttempts: totalAttempts,
      gateResults: allResults,
      firstAttemptSuccessRate,
      overallAccuracy,
      timeSpentExploring,
      sectionsRevealed: correctAnswers + 1, // Items + unlocked sections
    };

    const success = correctAnswers === gates.length;
    const score = overallAccuracy;

    submitResult(success, score, metrics, {
      studentWork: {
        gateResults: allResults,
        explorationPattern: { item1Clicked, item2Clicked },
      },
    });
  };

  const isGateCorrect = gateSubmitted && gateAnswer === currentGate?.correctAnswer;

  return (
    <div className="w-full max-w-7xl mx-auto my-20 animate-fade-in">
      {/* Header (adult chrome — hidden for pre-readers) */}
      {!preReader && (
        <div className="flex items-center gap-4 mb-10 justify-center">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
          </div>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white tracking-tight">Comparative Analysis</h2>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
              <p className="text-xs text-purple-400 font-mono uppercase tracking-wider">Side-by-Side Comparison</p>
            </div>
          </div>
        </div>
      )}

      {/* Introduction (text — hidden for pre-readers; the tutor voices framing) */}
      {!preReader && data.intro && (
        <div className="mb-8 text-center max-w-3xl mx-auto">
          <p className="text-slate-300 font-light leading-relaxed">{data.intro}</p>
        </div>
      )}

      {/* Exploration Prompt (text instructions — hidden for pre-readers; the tutor
          voices "tap each picture" via [COMPARE_START]) */}
      {!preReader && hasGates && !bothItemsExplored && (
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl max-w-2xl mx-auto">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div>
              <p className="text-sm text-blue-300 font-medium mb-1">Click to explore both options</p>
              <p className="text-xs text-slate-400">
                {!item1Clicked && !item2Clicked && "Click on each card to read about both options before proceeding"}
                {item1Clicked && !item2Clicked && "Great! Now explore the second option"}
                {!item1Clicked && item2Clicked && "Great! Now explore the first option"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* Item 1 Card */}
        <div
          className={`glass-panel rounded-3xl border overflow-hidden transition-all duration-500 cursor-pointer group
            ${selectedItem === 1 ? 'border-blue-500/60 ring-4 ring-blue-500/20' : 'border-blue-500/20 hover:border-blue-500/40'}
            ${hoveredItem === 2 ? 'opacity-60 scale-[0.98]' : 'hover:scale-[1.02]'}
            ${item1Clicked ? 'ring-2 ring-green-500/30' : ''}
          `}
          onClick={() => handleItemClick(1)}
          onMouseEnter={() => setHoveredItem(1)}
          onMouseLeave={() => setHoveredItem(null)}
        >
          {/* Image Section */}
          <div className="relative h-72 overflow-hidden bg-slate-900">
            <div className="absolute inset-0 transition-all duration-700 group-hover:scale-110">
              {image1 ? (
                <img src={image1} alt={data.item1.name} className="w-full h-full object-cover opacity-80" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-900/40 to-slate-900 animate-pulse"></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
            </div>

            {/* Label Badge (adult chrome — hidden for pre-readers) */}
            {!preReader && (
              <div className="absolute top-4 left-4 px-3 py-1 bg-blue-500/30 border border-blue-400/40 rounded-full backdrop-blur-md">
                <span className="text-xs font-mono uppercase tracking-wider text-blue-300">Option A</span>
              </div>
            )}

            {/* Explored Indicator */}
            {item1Clicked && (
              <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-green-500/30 border border-green-400 flex items-center justify-center">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            )}

            {/* Glow effect on hover */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          </div>

          {/* Content Section */}
          <div className="p-8">
            <h3 className={`font-bold text-blue-300 mb-3 flex items-center gap-2 ${preReader ? 'text-3xl' : 'text-2xl'}`}>
              {data.item1.name}
              {selectedItem === 1 && (
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
              )}
            </h3>
            {!preReader && (
              <p className="text-sm text-slate-400 leading-relaxed mb-6">{data.item1.description}</p>
            )}

            {/* Key Points */}
            <div className="space-y-2.5">
              {!preReader && (
                <div className="text-[10px] uppercase tracking-widest text-blue-500/70 font-bold mb-3 flex items-center gap-2">
                  <span className="w-3 h-px bg-blue-500/50"></span>
                  Key Features
                </div>
              )}
              {data.item1.points.map((point, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 hover:border-blue-500/20 transition-all group/point"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 group-hover/point:scale-150 transition-transform"></div>
                  <span className={`text-slate-200 leading-relaxed flex-1 ${preReader ? 'text-lg' : 'text-sm'}`}>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Item 2 Card */}
        <div
          className={`glass-panel rounded-3xl border overflow-hidden transition-all duration-500 cursor-pointer group
            ${selectedItem === 2 ? 'border-orange-500/60 ring-4 ring-orange-500/20' : 'border-orange-500/20 hover:border-orange-500/40'}
            ${hoveredItem === 1 ? 'opacity-60 scale-[0.98]' : 'hover:scale-[1.02]'}
            ${item2Clicked ? 'ring-2 ring-green-500/30' : ''}
          `}
          onClick={() => handleItemClick(2)}
          onMouseEnter={() => setHoveredItem(2)}
          onMouseLeave={() => setHoveredItem(null)}
        >
          {/* Image Section */}
          <div className="relative h-72 overflow-hidden bg-slate-900">
            <div className="absolute inset-0 transition-all duration-700 group-hover:scale-110">
              {image2 ? (
                <img src={image2} alt={data.item2.name} className="w-full h-full object-cover opacity-80" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-orange-900/40 to-slate-900 animate-pulse"></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
            </div>

            {/* Label Badge (adult chrome — hidden for pre-readers) */}
            {!preReader && (
              <div className="absolute top-4 right-4 px-3 py-1 bg-orange-500/30 border border-orange-400/40 rounded-full backdrop-blur-md">
                <span className="text-xs font-mono uppercase tracking-wider text-orange-300">Option B</span>
              </div>
            )}

            {/* Explored Indicator */}
            {item2Clicked && (
              <div className="absolute top-4 left-4 w-6 h-6 rounded-full bg-green-500/30 border border-green-400 flex items-center justify-center">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            )}

            {/* Glow effect on hover */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          </div>

          {/* Content Section */}
          <div className="p-8">
            <h3 className={`font-bold text-orange-300 mb-3 flex items-center gap-2 ${preReader ? 'text-3xl' : 'text-2xl'}`}>
              {data.item2.name}
              {selectedItem === 2 && (
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></div>
              )}
            </h3>
            {!preReader && (
              <p className="text-sm text-slate-400 leading-relaxed mb-6">{data.item2.description}</p>
            )}

            {/* Key Points */}
            <div className="space-y-2.5">
              {!preReader && (
                <div className="text-[10px] uppercase tracking-widest text-orange-500/70 font-bold mb-3 flex items-center gap-2">
                  <span className="w-3 h-px bg-orange-500/50"></span>
                  Key Features
                </div>
              )}
              {data.item2.points.map((point, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/10 hover:border-orange-500/20 transition-all group/point"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 group-hover/point:scale-150 transition-transform"></div>
                  <span className={`text-slate-200 leading-relaxed flex-1 ${preReader ? 'text-lg' : 'text-sm'}`}>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* VS Indicator (adult chrome — hidden for pre-readers) */}
      {!preReader && (
        <div className="flex items-center justify-center -my-3 relative z-10">
          <div className="w-14 h-14 rounded-full bg-slate-800/90 backdrop-blur-md border-2 border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.3)] flex items-center justify-center">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">VS</span>
          </div>
        </div>
      )}

      {/* ── PRE (pre-reader) picture true/false gate ──────────────────────────
          Tap 👍 / 👎 = choose (no Submit); the tutor reads the statement aloud on
          first view and from the 🔊 button; a wrong tap gives an eyes-free spoken
          hint. Reuses the shared PreReaderSelfCheck (a boolean gate is a 2-option
          self-check). No "Comprehension Check N of M" chrome. */}
      {preReader && canShowPreGate && (
        <div className="mt-8 mb-8 max-w-2xl mx-auto animate-fade-in">
          <PreReaderSelfCheck
            key={currentGateIndex}
            question={currentGate.question}
            options={['Yes, that is right', 'No, that is wrong']}
            optionEmojis={['👍', '👎']}
            correctIndex={currentGate.correctAnswer ? 0 : 1}
            accent="cyan"
            readAloudMessage={
              `[GATE_READ_ALOUD] A pre-reader cannot read this. Read the statement aloud, word for word: `
              + `"${currentGate.question}". Then say: tap the thumbs up if it is right, or the thumbs down if it is wrong. `
              + `Never say or hint whether it is true or false.`
            }
            retryTag="[GATE_RETRY]"
            onAskTutor={(msg) => sendText(msg)}
            onResult={(correct, attempts) => { if (correct) handlePreGatePass(attempts); }}
          />
        </div>
      )}

      {/* Comprehension Gate (reader mode) */}
      {!preReader && hasGates && canShowFirstGate && !gateSubmitted && currentGate && (
        <div className="mt-8 mb-8 animate-fade-in">
          <div className="glass-panel rounded-3xl border border-yellow-500/30 p-8 bg-yellow-500/5 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30">
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-bold text-yellow-300">Comprehension Check {currentGateIndex + 1} of {gates.length}</h4>
                <p className="text-xs text-slate-400">Answer correctly to continue</p>
              </div>
            </div>

            <p className="text-xl text-white mb-6 leading-relaxed">{currentGate.question}</p>

            {/* True/False Buttons */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                { value: true, label: 'True', icon: '✓' },
                { value: false, label: 'False', icon: '✗' }
              ].map(({ value, label, icon }) => (
                <button
                  key={label}
                  onClick={() => handleGateAnswer(value)}
                  className={`p-6 rounded-xl border transition-all duration-300 ${
                    gateAnswer === value
                      ? 'border-blue-500 bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                      : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">{icon}</span>
                    <span className="text-lg font-bold text-slate-200">{label}</span>
                  </div>
                </button>
              ))}
            </div>

            <LuminaButton
              tone="primary"
              onClick={handleGateSubmit}
              disabled={gateAnswer === null}
              className="w-full rounded-full font-bold tracking-wide"
            >
              Submit Answer
            </LuminaButton>
          </div>
        </div>
      )}

      {/* Gate Feedback (reader mode — PRE feedback lands on the tapped tile) */}
      {!preReader && hasGates && gateSubmitted && currentGate && (
        <div className="mt-8 mb-8 animate-fade-in">
          <div className={`glass-panel rounded-3xl border p-8 max-w-3xl mx-auto ${
            isGateCorrect
              ? 'border-green-500/30 bg-green-500/5'
              : 'border-red-500/30 bg-red-500/5'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                isGateCorrect
                  ? 'bg-green-500/20 border-green-500/30'
                  : 'bg-red-500/20 border-red-500/30'
              }`}>
                <svg className={`w-6 h-6 ${isGateCorrect ? 'text-green-400' : 'text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isGateCorrect ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  )}
                </svg>
              </div>
              <h4 className={`text-lg font-bold ${isGateCorrect ? 'text-green-300' : 'text-red-300'}`}>
                {isGateCorrect ? 'Correct!' : 'Not quite'}
              </h4>
            </div>

            <p className="text-slate-300 leading-relaxed mb-4">{currentGate.rationale}</p>

            {!isGateCorrect && (
              <LuminaButton
                tone="subtle"
                onClick={handleGateReset}
                className="rounded-full font-medium tracking-wide"
              >
                Try Again
              </LuminaButton>
            )}

            {isGateCorrect && (
              <p className="text-sm text-green-400 italic">Unlocking next section...</p>
            )}
          </div>
        </div>
      )}

      {/* Synthesis Section (reader mode — prose wall; hidden for pre-readers, who
          hear the [SYNTHESIS_UNLOCKED] walkthrough spoken instead) */}
      {!preReader && canShowSynthesis && (
        <div className="mt-8 glass-panel rounded-3xl border border-purple-500/20 p-8 md:p-10 relative overflow-hidden animate-fade-in">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>

          <div className="relative z-10">
            <LuminaSectionLabel accent="purple" className="mb-6">
              Synthesis &amp; Analysis
            </LuminaSectionLabel>

            {/* Main Insight */}
            <div className="mb-8 pl-7">
              <div className="text-xs uppercase tracking-widest text-purple-500/70 font-bold mb-3 flex items-center gap-2">
                <span className="w-3 h-px bg-purple-500/50"></span>
                Key Insight
              </div>
              <p className="text-xl text-white leading-relaxed font-light italic">
                &ldquo;{data.synthesis.mainInsight}&rdquo;
              </p>
            </div>

            {/* Differences & Similarities Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Differences */}
              <LuminaCallout
                accent="rose"
                label="Key Differences"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                }
              >
                <ul className="space-y-2.5">
                  {data.synthesis.keyDifferences.map((diff, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-200">
                      <span className="text-rose-400 mt-1 flex-shrink-0">&#9656;</span>
                      <span className="leading-relaxed">{diff}</span>
                    </li>
                  ))}
                </ul>
              </LuminaCallout>

              {/* Similarities */}
              <LuminaCallout
                accent="emerald"
                label="Key Similarities"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                }
              >
                <ul className="space-y-2.5">
                  {data.synthesis.keySimilarities.map((sim, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-200">
                      <span className="text-emerald-400 mt-1 flex-shrink-0">&#9656;</span>
                      <span className="leading-relaxed">{sim}</span>
                    </li>
                  ))}
                </ul>
              </LuminaCallout>
            </div>

            {/* When to Use */}
            {data.synthesis.whenToUse && (
              <LuminaCallout
                accent="blue"
                label="When to Use Each"
                className="mb-8"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </svg>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <LuminaPanel accent="blue">
                    <div className="text-xs font-mono uppercase tracking-wider text-blue-300 mb-2 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                      {data.item1.name}
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">{data.synthesis.whenToUse.item1Context}</p>
                  </LuminaPanel>
                  <LuminaPanel accent="orange">
                    <div className="text-xs font-mono uppercase tracking-wider text-orange-300 mb-2 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                      {data.item2.name}
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">{data.synthesis.whenToUse.item2Context}</p>
                  </LuminaPanel>
                </div>
              </LuminaCallout>
            )}

            {/* Common Misconception */}
            {data.synthesis.commonMisconception && (
              <LuminaCallout
                accent="amber"
                label="Common Misconception"
                italic
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                }
              >
                {data.synthesis.commonMisconception}
              </LuminaCallout>
            )}
          </div>
        </div>
      )}

      {/* Interactive Hint (only if no gates) */}
      {!preReader && !hasGates && !selectedItem && (
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500 font-mono">
            Click on either card to highlight and focus
          </p>
        </div>
      )}

      {/* Completion Message — wordless celebration for pre-readers */}
      {allGatesCompleted && hasGates && (
        preReader ? (
          <div className="mt-6 text-center animate-fade-in" role="status" aria-label="All done">
            <div className="text-6xl">🎉</div>
          </div>
        ) : (
          <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl max-w-2xl mx-auto text-center animate-fade-in">
            <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span className="font-bold text-sm">Comparison Complete!</span>
            </div>
            <p className="text-xs text-slate-400">
              You&apos;ve successfully explored and understood this comparison
            </p>
          </div>
        )
      )}
    </div>
  );
};
