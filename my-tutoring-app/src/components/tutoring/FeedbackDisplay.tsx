import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import ProblemReader from './ProblemReader';

// const FeedbackDisplay = ({ feedback }) => {
//   if (!feedback?.review) return null;

//   return (
//     <div className="space-y-4">
//       <Alert>
//         <ProblemReader 
//           text={feedback.review.feedback.praise}
//           contentType="feedback"
//           autoRead={true}
//         />
//         <AlertDescription className="space-y-2 whitespace-pre-wrap">
//           {/* Praise */}
//           {feedback.review.feedback.praise && (
//             <p className="text-green-600">{feedback.review.feedback.praise}</p>
//           )}
          
//           {/* Guidance */}
//           {feedback.review.feedback.guidance && (
//             <p className="text-blue-600">{feedback.review.feedback.guidance}</p>
//           )}
          
//           {/* Encouragement */}
//           {feedback.review.feedback.encouragement && (
//             <p className="text-purple-600">{feedback.review.feedback.encouragement}</p>
//           )}
          
//           {/* Next Steps */}
//           {feedback.review.feedback.next_steps && (
//             <p className="text-gray-600">{feedback.review.feedback.next_steps}</p>
//           )}
          
//           <div className="text-xs text-gray-400 mt-1">AI-generated</div>
//         </AlertDescription>
//       </Alert>
      
//       <div className="p-4 border rounded-lg space-y-2 bg-gray-50">
//         <div className="font-medium">Teacher's Notes:</div>
//         <div className="text-sm space-y-2">
//           <div>
//             <strong>Observation:</strong>{' '}
//             {feedback.review.observation.canvas_description}
//           </div>
//           <div>
//             <strong>Analysis:</strong>{' '}
//             {feedback.review.analysis.understanding}
//           </div>
//           <div>
//             <strong>Score:</strong> {feedback.review.evaluation}/10
//             <div className="text-xs text-gray-400">AI-generated</div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default FeedbackDisplay;