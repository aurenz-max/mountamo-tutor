// components/gemini-tutor/windows/ProblemWindow.tsx
import React, { useState, useEffect } from 'react';
import { Brain } from 'lucide-react';
import DraggableWindow from '../ui/DraggableWindow';

interface ProblemWindowProps {
  initialCurriculum: {
    subject: string;
    skill?: { description: string };
    subskill?: { description: string };
  };
  ageGroup: string;
  onSubmit: () => void;
}

export const ProblemWindow: React.FC<ProblemWindowProps> = ({ 
  initialCurriculum, 
  ageGroup,
  onSubmit 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [problemData, setProblemData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProblem = async () => {
    setLoading(true);
    setError(null);
    try {
      // This is a placeholder - you'll need to implement a problem generation endpoint
      // For now, let's use mock data
      setTimeout(() => {
        setProblemData({
          question: `Let's practice ${initialCurriculum.skill?.description || initialCurriculum.subject}. Work through this problem on the canvas.`,
          hints: [
            "Remember what we just discussed in the lesson",
            "Try breaking down the problem into smaller steps",
            "Think about similar examples we've covered"
          ]
        });
        setLoading(false);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load problem');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible && !problemData) {
      fetchProblem();
    }
  }, [isVisible]);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className={`p-2 rounded-lg transition-colors ${
          isVisible ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'
        } hover:bg-gray-200`}
      >
        <Brain className="w-5 h-5" />
      </button>

      {/* Window */}
      {isVisible && (
        <DraggableWindow
          id="problem"
          title="Practice Problem"
          icon={<Brain className="w-4 h-4 text-purple-600" />}
          defaultPosition={{ x: 50, y: 300 }}
          onClose={() => setIsVisible(false)}
          width="w-96"
        >
          <div className="p-4 space-y-4">
            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading problem...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 p-3 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {problemData && !loading && (
              <>
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3">
                  <p className="text-sm text-gray-800">{problemData.question}</p>
                </div>
                
                {problemData.hints && problemData.hints.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-600 mb-2">Need hints?</h4>
                    <div className="space-y-1">
                      {problemData.hints.map((hint: string, idx: number) => (
                        <details key={idx} className="bg-gray-50 rounded-lg">
                          <summary className="px-3 py-1.5 cursor-pointer text-xs text-gray-700 hover:bg-gray-100 rounded-lg">
                            Hint {idx + 1}
                          </summary>
                          <p className="px-3 pb-1.5 text-xs text-gray-600">{hint}</p>
                        </details>
                      ))}
                    </div>
                  </div>
                )}
                
                <button
                  onClick={onSubmit}
                  className="w-full py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium"
                >
                  Submit Answer
                </button>
              </>
            )}
          </div>
        </DraggableWindow>
      )}
    </>
  );
};