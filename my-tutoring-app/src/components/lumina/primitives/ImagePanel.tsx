import React, { useState, useRef, useEffect } from 'react';
import { ImageIcon, MapIcon, Beaker, BookIcon, GlobeIcon, HelpCircle, CheckCircle, XCircle } from 'lucide-react';
import { generateConceptImage } from '../service/geminiClient-api';
import { usePrimitiveEvaluation, type ImagePanelMetrics } from '../evaluation';
import html2canvas from 'html2canvas';

// Annotation data structure
export interface ImageAnnotation {
  id: string;
  label: string;
  description: string;
  category?: string;
  isKey?: boolean; // Essential for learning objective
}

// Student's placement of an annotation
export interface StudentPlacement {
  annotationId: string;
  label: string;
  position: { x: number; y: number }; // Percentage-based (0-100)
  placedAt?: number; // Timestamp
}

export interface ImagePanelData {
  title: string;
  description?: string;
  imageUrl: string | null;
  imagePrompt?: string;
  category?: 'geography' | 'history' | 'science' | 'literature' | 'art' | 'general';
  attribution?: string;
  learningObjective?: string;

  // Interactive annotation features
  annotations?: ImageAnnotation[];
  interactionMode?: 'view' | 'identify';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: any) => void;
}

interface ImagePanelProps {
  data: ImagePanelData;
  className?: string;
  onPlacementsChange?: (placements: StudentPlacement[]) => void;
}

const CATEGORY_CONFIG = {
  geography: {
    icon: MapIcon,
    bgColor: 'bg-emerald-900/30',
    textColor: 'text-emerald-300',
    borderColor: 'border-emerald-700',
    label: 'Geographic Visualization'
  },
  history: {
    icon: BookIcon,
    bgColor: 'bg-amber-900/30',
    textColor: 'text-amber-300',
    borderColor: 'border-amber-700',
    label: 'Historical Context'
  },
  science: {
    icon: Beaker,
    bgColor: 'bg-blue-900/30',
    textColor: 'text-blue-300',
    borderColor: 'border-blue-700',
    label: 'Scientific Illustration'
  },
  literature: {
    icon: BookIcon,
    bgColor: 'bg-purple-900/30',
    textColor: 'text-purple-300',
    borderColor: 'border-purple-700',
    label: 'Literary Visualization'
  },
  art: {
    icon: ImageIcon,
    bgColor: 'bg-pink-900/30',
    textColor: 'text-pink-300',
    borderColor: 'border-pink-700',
    label: 'Artistic Representation'
  },
  general: {
    icon: GlobeIcon,
    bgColor: 'bg-indigo-900/30',
    textColor: 'text-indigo-300',
    borderColor: 'border-indigo-700',
    label: 'Visual Context'
  }
};

const ImagePanel: React.FC<ImagePanelProps> = ({ data, className = '', onPlacementsChange }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isWallpaperMode, setIsWallpaperMode] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  // Interactive annotation state
  const [studentPlacements, setStudentPlacements] = useState<StudentPlacement[]>([]);
  const [draggedAnnotation, setDraggedAnnotation] = useState<ImageAnnotation | null>(null);
  const [hoveredPlacement, setHoveredPlacement] = useState<string | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Evaluation state
  const [evaluationFeedback, setEvaluationFeedback] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Extract evaluation props
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Initialize evaluation hook (only if interactive mode with annotations)
  const isInteractive = data.interactionMode === 'identify' && data.annotations && data.annotations.length > 0;

  // Use evaluation system when interactive mode is enabled
  // If instanceId is not provided, generate one (for standalone testing)
  const evaluation = isInteractive ? usePrimitiveEvaluation<ImagePanelMetrics>({
    primitiveType: 'image-panel',
    instanceId: instanceId || `image-panel-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  }) : null;

  const { submitResult, hasSubmitted } = evaluation || {};

  const category = data.category || 'general';
  const config = CATEGORY_CONFIG[category];
  const IconComponent = config.icon;

  const toggleWallpaperMode = () => {
    setIsWallpaperMode(!isWallpaperMode);
  };

  // Notify parent when placements change
  useEffect(() => {
    if (onPlacementsChange) {
      onPlacementsChange(studentPlacements);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentPlacements]);

  // Handle drag start from annotation card
  const handleDragStart = (annotation: ImageAnnotation) => {
    setDraggedAnnotation(annotation);
  };

  // Handle drop on image
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggedAnnotation || !imageContainerRef.current) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Check if this annotation is already placed
    const existingIndex = studentPlacements.findIndex(
      p => p.annotationId === draggedAnnotation.id
    );

    const newPlacement: StudentPlacement = {
      annotationId: draggedAnnotation.id,
      label: draggedAnnotation.label,
      position: { x, y },
      placedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      // Update existing placement
      const updated = [...studentPlacements];
      updated[existingIndex] = newPlacement;
      setStudentPlacements(updated);
    } else {
      // Add new placement
      setStudentPlacements([...studentPlacements, newPlacement]);
    }

    setDraggedAnnotation(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Remove a placement
  const handleRemovePlacement = (annotationId: string) => {
    setStudentPlacements(studentPlacements.filter(p => p.annotationId !== annotationId));
  };

  // Check if annotation is already placed
  const isAnnotationPlaced = (annotationId: string) => {
    return studentPlacements.some(p => p.annotationId === annotationId);
  };

  // Handle on-demand image generation
  const handleGenerateImage = async () => {
    if (!data.imagePrompt || isLoading || generatedImageUrl) return;

    setIsLoading(true);
    setImageError(false);

    try {
      const url = await generateConceptImage(data.imagePrompt);
      if (url) {
        setGeneratedImageUrl(url);
      } else {
        setImageError(true);
      }
    } catch (error) {
      console.error('Failed to generate image:', error);
      setImageError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Capture annotated image for LLM evaluation
  const captureAnnotatedImage = async (): Promise<string> => {
    if (!imageContainerRef.current) {
      throw new Error('Image container ref not available');
    }

    try {
      const canvas = await html2canvas(imageContainerRef.current, {
        useCORS: true,
        allowTaint: true,
      });
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Failed to capture annotated image:', error);
      throw error;
    }
  };

  // Normalize score with "safe harbor" for high scores
  // Accounts for minor placement variations in otherwise strong performance
  const normalizeScore = (avgScore: number): number => {
    if (avgScore >= 80) return 100;  // 80%+ shows strong understanding
    if (avgScore >= 70) return 80;   // 70-80% shows good understanding
    if (avgScore >= 60) return 70;   // 60-70% shows adequate understanding
    if (avgScore >= 50) return 60;   // 50-60% shows basic understanding
    if (avgScore >= 40) return 50;   // 40-50% shows partial understanding
    if (avgScore >= 30) return 40;   // 30-40% shows limited understanding
    if (avgScore >= 20) return 30;   // 20-30% shows minimal understanding
    return Math.max(20, avgScore);   // Below 20% return actual score with 20% floor
  };

  // Build ImagePanelMetrics from evaluation results
  const buildImagePanelMetrics = (evaluation: any): ImagePanelMetrics => {
    const annotationResults = (data.annotations || []).map(annotation => {
      const placement = studentPlacements.find(p => p.annotationId === annotation.id);

      // Match by label (more robust than ID matching since LLM sees the label)
      // Fallback to ID matching if available
      const evalResult = evaluation.annotationResults.find((r: any) =>
        r.label === annotation.label || r.annotationId === annotation.id
      );

      // Get proximity score and determine if placement is correct
      const proximityScore = evalResult?.proximityScore || 0;
      // Consider placement correct if proximity score >= 70 (as per evaluation guidelines)
      // Key concepts require >= 75
      const threshold = annotation.isKey ? 75 : 70;
      const placementCorrect = proximityScore >= threshold;

      return {
        annotationId: annotation.id,
        label: annotation.label,
        isKey: annotation.isKey || false,
        expectedRegion: evalResult?.expectedRegion,
        studentPosition: placement?.position || null,
        placementCorrect,
        proximityScore,
      };
    });

    const correctCount = annotationResults.filter(r => r.placementCorrect).length;
    const totalCount = annotationResults.length;
    const placedCount = studentPlacements.length;

    // Calculate raw average proximity score (0-100 scale)
    const avgProximity = totalCount > 0
      ? annotationResults.reduce((sum, r) => sum + r.proximityScore, 0) / totalCount
      : 0;

    // Apply safe harbor normalization to reward strong overall performance
    // despite minor placement variations (e.g., off-center labels)
    const accuracy = normalizeScore(avgProximity);

    // Final success requires ALL annotations placed AND ALL meeting threshold
    const finalSuccess = placedCount === totalCount && correctCount === totalCount;

    return {
      type: 'image-panel',
      allAnnotationsPlaced: placedCount === totalCount,
      finalSuccess,
      totalAnnotations: totalCount,
      correctAnnotations: correctCount,
      incorrectAnnotations: totalCount - correctCount,
      unplacedAnnotations: totalCount - placedCount,
      annotationAccuracy: accuracy,
      annotationResults,
      averageProximityScore: avgProximity,
      llmEvaluationUsed: true,
      llmConfidence: evaluation.confidence,
      llmFeedback: evaluation.overallFeedback,
    };
  };

  // Handle evaluation submission
  const handleEvaluateAnnotations = async () => {
    if (hasSubmitted) {
      console.log('Already submitted evaluation');
      return;
    }

    setIsEvaluating(true);

    try {
      // Capture image with student placements rendered
      const imageBase64 = await captureAnnotatedImage();

      // Call LLM evaluation service via API
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluateImageAnnotations',
          params: {
            imageBase64,
            annotations: data.annotations,
            studentPlacements,
            learningObjective: data.learningObjective || 'Identify key features in the image',
          }
        })
      });

      if (!response.ok) {
        throw new Error('Evaluation request failed');
      }

      const evaluation = await response.json();
      setEvaluationFeedback(evaluation);

      // Build and submit metrics to evaluation service
      const metrics = buildImagePanelMetrics(evaluation);
      const success = metrics.finalSuccess;
      const score = metrics.annotationAccuracy;

      if (submitResult) {
        submitResult(success, score, metrics, { studentPlacements, evaluation });
      }
    } catch (error) {
      console.error('Evaluation error:', error);
      alert('Failed to evaluate annotations. Please try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Use either the provided imageUrl or the generated one
  const displayImageUrl = data.imageUrl || generatedImageUrl;

  // Show component even without imageUrl if we have imagePrompt
  if (!displayImageUrl && !data.imagePrompt && !isLoading) return null;

  return (
    <div className={`w-full mx-auto animate-fade-in ${isWallpaperMode ? 'fixed inset-0 z-50 bg-slate-950/95 p-8 m-0 overflow-y-auto' : 'max-w-4xl mb-16'} ${className}`}>
      <div className={`bg-slate-800/50 border ${config.borderColor} rounded-xl overflow-hidden shadow-2xl`}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 bg-slate-800/80 cursor-pointer border-b border-slate-700 hover:bg-slate-800 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-3">
            <div className={`p-2 ${config.bgColor} rounded-lg ${config.textColor}`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-slate-100">{data.title}</h3>
              {data.description && (
                <p className="text-xs text-slate-400 mt-0.5">{data.description}</p>
              )}
            </div>
          </div>
          <button className="text-xs font-medium text-slate-400 hover:text-indigo-300 transition-colors uppercase tracking-wider">
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="relative w-full bg-slate-900/50 min-h-[200px] flex items-center justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                 <div className={`w-12 h-12 border-4 ${config.borderColor} border-opacity-30 border-t-current ${config.textColor} rounded-full animate-spin mb-4`}></div>
                 <p className="text-slate-400 font-medium">Generating visualization...</p>
                 {data.imagePrompt && (
                   <p className="text-xs text-slate-600 mt-2 max-w-md">"{data.imagePrompt}"</p>
                 )}
              </div>
            ) : imageError || !displayImageUrl ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className={`p-4 ${config.bgColor} rounded-full mb-4`}>
                  <IconComponent className={`w-8 h-8 ${config.textColor}`} />
                </div>
                <p className="text-slate-400 font-medium">
                  {imageError ? 'Unable to load image' : 'Visual Concept'}
                </p>
                {data.imagePrompt && (
                  <div className="mt-4 max-w-2xl">
                    <p className="text-sm text-slate-300 leading-relaxed mb-4">
                      {data.imagePrompt}
                    </p>
                    {!imageError && (
                      <button
                        onClick={handleGenerateImage}
                        className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 mx-auto ${config.bgColor} ${config.textColor} border ${config.borderColor} hover:scale-105 active:scale-95`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        Generate Visual
                      </button>
                    )}
                    <p className="text-xs text-slate-500 italic mt-3">
                      {imageError ? 'Image generation failed. Please try again.' : 'Click to generate an AI image for this concept'}
                    </p>
                  </div>
                )}
              </div>
            ) : displayImageUrl ? (
              <div className="w-full">
                {/* Interactive Mode with Annotations */}
                {isInteractive ? (
                  <div className="flex flex-col lg:flex-row gap-4 p-4">
                    {/* Annotation Cards Panel */}
                    <div className="lg:w-80 flex-shrink-0 space-y-3">
                      <div className={`p-3 ${config.bgColor} rounded-lg border ${config.borderColor}`}>
                        <h4 className={`text-sm font-bold ${config.textColor} mb-1`}>Learning Objective</h4>
                        <p className="text-xs text-slate-300">
                          {data.learningObjective || 'Drag and drop labels to identify features in the image'}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-2">
                          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Annotations ({studentPlacements.length}/{data.annotations?.length || 0})
                          </span>
                        </div>

                        {data.annotations?.map((annotation) => {
                          const placed = isAnnotationPlaced(annotation.id);
                          return (
                            <div
                              key={annotation.id}
                              draggable
                              onDragStart={() => handleDragStart(annotation)}
                              className={`p-3 rounded-lg border-2 cursor-move transition-all ${
                                placed
                                  ? 'bg-green-900/20 border-green-700 opacity-60'
                                  : `${config.bgColor} ${config.borderColor} hover:scale-[1.02] active:scale-95`
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    {placed ? (
                                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                                    ) : (
                                      <HelpCircle className={`w-4 h-4 ${config.textColor} flex-shrink-0`} />
                                    )}
                                    <span className={`text-sm font-bold ${placed ? 'text-green-300' : config.textColor}`}>
                                      {annotation.label}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-300 leading-relaxed">
                                    {annotation.description}
                                  </p>
                                  {annotation.category && (
                                    <span className="inline-block mt-2 px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-xs">
                                      {annotation.category}
                                    </span>
                                  )}
                                </div>
                                {placed && (
                                  <button
                                    onClick={() => handleRemovePlacement(annotation.id)}
                                    className="text-slate-400 hover:text-red-400 transition-colors"
                                    title="Remove placement"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {studentPlacements.length === data.annotations?.length && (
                        <div className="p-3 bg-green-900/20 border-2 border-green-700 rounded-lg">
                          <div className="flex items-center gap-2 text-green-400 text-sm font-bold">
                            <CheckCircle className="w-5 h-5" />
                            All annotations placed!
                          </div>
                          <p className="text-xs text-slate-300 mt-1">
                            Ready to submit for evaluation
                          </p>
                        </div>
                      )}

                      {/* Evaluation Feedback Panel */}
                      {evaluationFeedback && (
                        <div className="mt-4 p-4 bg-slate-900/80 border-2 border-cyan-500 rounded-lg">
                          <h4 className="text-sm font-bold text-cyan-400 mb-2">Evaluation Results</h4>
                          <p className="text-xs text-slate-300 mb-3">{evaluationFeedback.overallFeedback}</p>

                          <div className="space-y-2">
                            {evaluationFeedback.annotationResults.map((result: any) => (
                              <div
                                key={result.annotationId}
                                className={`p-2 rounded border-2 ${
                                  result.placementCorrect
                                    ? 'bg-green-900/20 border-green-700'
                                    : 'bg-orange-900/20 border-orange-700'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold text-slate-200">{result.label}</span>
                                  <span className="text-xs text-slate-400">{result.proximityScore}/100</span>
                                </div>
                                <p className="text-xs text-slate-300">{result.reasoning}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Evaluate Button */}
                      {isInteractive && studentPlacements.length === data.annotations?.length && !hasSubmitted && (
                        <button
                          onClick={handleEvaluateAnnotations}
                          disabled={isEvaluating}
                          className={`w-full mt-4 p-3 rounded-lg font-bold transition-all ${
                            isEvaluating
                              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white'
                          }`}
                        >
                          {isEvaluating ? 'Evaluating with AI...' : 'Submit for Evaluation'}
                        </button>
                      )}
                    </div>

                    {/* Image with Drop Zone */}
                    <div className="flex-1 relative">
                      <div
                        ref={imageContainerRef}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        className={`relative rounded-lg overflow-hidden border-4 ${
                          draggedAnnotation ? 'border-cyan-500 border-dashed' : 'border-slate-700'
                        } transition-colors`}
                      >
                        <img
                          src={displayImageUrl}
                          alt={data.title}
                          className="w-full h-auto object-contain bg-slate-900"
                          onError={() => setImageError(true)}
                          loading="lazy"
                          draggable={false}
                        />

                        {/* Placed annotation markers */}
                        {studentPlacements.map((placement) => (
                          <div
                            key={placement.annotationId}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                            style={{
                              left: `${placement.position.x}%`,
                              top: `${placement.position.y}%`,
                            }}
                            onClick={() => handleRemovePlacement(placement.annotationId)}
                            onMouseEnter={() => setHoveredPlacement(placement.annotationId)}
                            onMouseLeave={() => setHoveredPlacement(null)}
                          >
                            {/* Marker pin */}
                            <div className="relative">
                              <div className="w-8 h-8 bg-cyan-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center animate-bounce-slow">
                                <HelpCircle className="w-4 h-4 text-white" />
                              </div>

                              {/* Label popup on hover */}
                              {hoveredPlacement === placement.annotationId && (
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 border-2 border-cyan-500 rounded-lg shadow-xl z-10">
                                  <div className="text-xs font-bold text-cyan-400 mb-1">
                                    {placement.label}
                                  </div>
                                  <div className="text-xs text-slate-300">
                                    Click marker to remove
                                  </div>
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                    <div className="w-2 h-2 bg-cyan-500 rotate-45"></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Drag instruction overlay */}
                        {draggedAnnotation && (
                          <div className="absolute inset-0 bg-cyan-500/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                            <div className="bg-slate-900/90 px-6 py-4 rounded-lg border-2 border-cyan-500">
                              <p className="text-cyan-400 font-bold text-lg">Drop here to place</p>
                              <p className="text-slate-300 text-sm mt-1">"{draggedAnnotation.label}"</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard View Mode (existing implementation) */
                  <div className="relative w-full group">
                    {/* Wallpaper Mode Toggle Button */}
                    <button
                      onClick={toggleWallpaperMode}
                      className="absolute top-4 right-4 px-4 py-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 transition-all flex items-center gap-2 z-20"
                      title={isWallpaperMode ? 'Exit Wallpaper Mode' : 'Enter Wallpaper Mode'}
                    >
                      {isWallpaperMode ? (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                          <span className="hidden sm:inline">Exit Wallpaper</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                          </svg>
                          <span className="hidden sm:inline">Wallpaper Mode</span>
                        </>
                      )}
                    </button>

                    <img
                      src={displayImageUrl || ''}
                      alt={data.title}
                      className={`w-full h-auto object-contain transition-transform duration-700 group-hover:scale-[1.01] ${isWallpaperMode ? 'max-h-[90vh]' : 'max-h-[500px]'}`}
                      onError={() => setImageError(true)}
                      loading="lazy"
                    />
                    {/* Hover overlay with details */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="space-y-2">
                        {data.imagePrompt && (
                          <p className="text-xs text-slate-300 font-mono">
                            <span className={`${config.textColor} font-bold`}>VISUALIZATION:</span> {data.imagePrompt}
                          </p>
                        )}
                        {data.attribution && (
                          <p className="text-xs text-slate-400 italic">
                            {data.attribution}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Category badge */}
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className={`px-3 py-1 ${config.bgColor} ${config.textColor} rounded-full text-xs font-medium backdrop-blur-sm`}>
                        {config.label}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImagePanel;
