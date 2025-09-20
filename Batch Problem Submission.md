● Frontend Implementation Guide: Batch Problem Submission

  Phase 1: Add Batch Submission API Method

  1. Update authApiClient.ts

  Add the batch submission method after the existing submitProblem method:

  // Add after existing problem submission methods
  async submitProblemBatch(request: {
    assessment_context?: {
      assessment_id: string;
      subject: string;
      student_id: number;
    };
    submissions: Array<{
      subject: string;
      problem: any;
      solution_image?: string;
      skill_id: string;
      student_answer?: string;
      canvas_used?: boolean;
      subskill_id?: string;
      primitive_response?: any;
    }>;
  }) {
    return this.post('/api/problems/submit-batch', request);
  }

  Phase 2: Update Assessment Submission Logic

  2. Modify Assessment Player Component

  In AssessmentPlayer.tsx, update the submission logic:

  // Current assessment submission
  const submitAssessment = async (answers) => {
    return await authApi.submitAssessment(subject, {
      assessment_id,
      answers,
      time_taken_minutes
    });
  };

  // NEW: Batch submission approach
  const submitAssessmentBatch = async (assessment, answers) => {
    const submissions = assessment.problems.map(problem => ({
      subject: assessment.subject,
      problem: problem,
      skill_id: problem.skill_id,
      subskill_id: problem.subskill_id,
      student_answer: answers[problem.id]?.student_answer,
      primitive_response: answers[problem.id]?.primitive_response
    }));

    return await authApi.submitProblemBatch({
      assessment_context: {
        assessment_id: assessment.assessment_id,
        subject: assessment.subject,
        student_id: userProfile.student_id
      },
      submissions
    });
  };

  3. Add Feature Flag for Gradual Rollout

  // Add to your config or environment
  const USE_BATCH_SUBMISSION = process.env.NEXT_PUBLIC_USE_BATCH_SUBMISSION === 'true';

  const handleSubmitAssessment = async () => {
    if (USE_BATCH_SUBMISSION) {
      return await submitAssessmentBatch(assessment, answers);
    } else {
      return await submitAssessmentOriginal(answers);
    }
  };

  Phase 3: Update Results Display Components

  4. Create New Batch Results Component

  Create BatchAssessmentResults.tsx:

  interface BatchAssessmentResultsProps {
    batchSubmission: {
      batch_id: string;
      submission_results: Array<{
        problem_id: string;
        review: {
          observation: { selected_answer: string; work_shown: string };
          analysis: { understanding: string; approach: string };
          evaluation: { score: number; justification: string };
          feedback: { praise: string; guidance: string; encouragement: string };
        };
        score: number;
        correct: boolean;
      }>;
      // ... engagement data from decorator
      xp_earned: number;
      level_up: boolean;
      current_streak: number;
    };
  }

  const BatchAssessmentResults = ({ batchSubmission }: BatchAssessmentResultsProps) => {
    return (
      <div>
        {/* Engagement Summary */}
        <EngagementSummary
          xpEarned={batchSubmission.xp_earned}
          levelUp={batchSubmission.level_up}
          currentStreak={batchSubmission.current_streak}
        />

        {/* Individual Problem Reviews */}
        {batchSubmission.submission_results.map(result => (
          <ProblemReviewCard
            key={result.problem_id}
            problemId={result.problem_id}
            review={result.review}
            score={result.score}
            isCorrect={result.correct}
          />
        ))}
      </div>
    );
  };

  5. Reuse Existing Problem Display Components

  // Reuse your existing ProblemRenderer from practice problems
  const ProblemReviewCard = ({ problemId, review, score, isCorrect }) => {
    return (
      <ProblemRenderer
        problemId={problemId}
        feedback={review}
        isSubmitted={true}
        showCorrectAnswer={true}
        score={score}
        // Same props as practice problems!
      />
    );
  };

  Phase 4: Update Assessment Summary

  6. Modify Assessment Summary Component

  Update getAssessmentSummary response handling:

  const AssessmentSummary = ({ assessmentId }) => {
    const [summary, setSummary] = useState(null);

    useEffect(() => {
      const fetchSummary = async () => {
        const result = await authApi.getAssessmentSummary(assessmentId);

        // Check if batch_submission exists (new format)
        if (result.batch_submission) {
          // Use new batch submission format
          setDisplayMode('batch');
          setSummary({
            ...result,
            problemReviews: result.batch_submission.submission_results
          });
        } else {
          // Fallback to old format
          setDisplayMode('legacy');
          setSummary(result);
        }
      };

      fetchSummary();
    }, [assessmentId]);

    return displayMode === 'batch' ?
      <BatchAssessmentResults batchSubmission={summary.batch_submission} /> :
      <LegacyAssessmentResults summary={summary} />;
  };

  Phase 5: Error Handling & Fallback

  7. Add Robust Error Handling

  const handleBatchSubmission = async () => {
    try {
      const result = await submitAssessmentBatch(assessment, answers);

      if (result.failed_submissions?.length > 0) {
        // Handle partial failures
        showPartialErrorMessage(result.failed_submissions);
      }

      // Process successful submissions
      processEngagementRewards(result);

    } catch (error) {
      // Fallback to original assessment submission
      console.warn("Batch submission failed, falling back to original flow");
      return await submitAssessmentOriginal(answers);
    }
  };

  Implementation Timeline

  Week 1: API Integration

  - Add submitProblemBatch to authApiClient.ts
  - Add feature flag for batch submission
  - Test API connection with simple batch request

  Week 2: Assessment Player Updates

  - Update assessment submission logic
  - Add fallback to original submission method
  - Test both submission paths

  Week 3: Results Display

  - Create BatchAssessmentResults component
  - Reuse existing ProblemRenderer components
  - Update assessment summary page

  Week 4: Testing & Polish

  - A/B test batch vs original submission
  - Performance testing
  - Error handling refinement

  Key Benefits for Frontend

  1. Component Reuse: Same ProblemRenderer for practice and assessments
  2. Consistent UX: Identical feedback format across all contexts
  3. Engagement Integration: Automatic XP/streaks via backend decorator
  4. Gradual Migration: Feature flag allows safe rollout
  5. Error Recovery: Fallback to original system if batch fails

  Testing Checklist

  - Batch submission works with MCQ problems
  - Batch submission works with fill-in-blank problems
  - Engagement rewards display correctly
  - Error handling works for partial failures
  - Fallback to original submission works
  - Results display matches practice problem format
  - Performance is acceptable for 15+ problem batches

  This approach gives you the "just works" experience from the PRD while maintaining backward compatibility and    
   allowing incremental rollout.