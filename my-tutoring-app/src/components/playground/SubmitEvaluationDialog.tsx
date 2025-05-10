// components/playground/SubmitEvaluationDialog.tsx
import React, { useState } from 'react';
import { AlertCircle, X, Send, Code, MessageSquare } from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface SubmitEvaluationDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (exerciseId: string) => void;
  codePreview: string;
  messageCount: number;
  selectedCurriculum: any;
  isSubmitting: boolean;
}

const SubmitEvaluationDialog: React.FC<SubmitEvaluationDialogProps> = ({
  open,
  onClose,
  onSubmit,
  codePreview,
  messageCount,
  selectedCurriculum,
  isSubmitting
}) => {
  const [exerciseId, setExerciseId] = useState("");
  
  // Generate a default exercise ID based on curriculum if available
  React.useEffect(() => {
    if (selectedCurriculum) {
      const subskill = selectedCurriculum.subskill?.description || "";
      const skill = selectedCurriculum.skill?.description || "";
      const unit = selectedCurriculum.unit?.title || "";
      
      // Create a slug from the most specific curriculum item
      const baseText = subskill || skill || unit;
      if (baseText) {
        const slug = baseText
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 20);
        
        const timestamp = new Date().toISOString().split('T')[0];
        setExerciseId(`${slug}-${timestamp}`);
      }
    }
  }, [selectedCurriculum]);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit Work for Evaluation</DialogTitle>
          <DialogDescription>
            Your work will be reviewed and evaluated based on concept mastery, implementation, and creativity.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Label htmlFor="exercise-id" className="text-sm font-medium">
            Exercise ID
          </Label>
          <Input 
            id="exercise-id"
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            placeholder="e.g., project-visualization-shapes"
            className="mt-1"
            required
          />
          
          <div className="mt-4 space-y-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-md flex-shrink-0">
                <Code className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="text-sm font-medium">Code Submission</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Your current P5.js code ({codePreview.split('\n').length} lines)
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-md flex-shrink-0">
                <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h4 className="text-sm font-medium">Chat Interactions</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {messageCount} messages will be included in your submission
                </p>
              </div>
            </div>
            
            {selectedCurriculum && (
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-md flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h4 className="text-sm font-medium">Learning Topic</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {selectedCurriculum.subskill?.description || 
                     selectedCurriculum.skill?.description || 
                     selectedCurriculum.unit?.title || 
                     "No topic selected"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between items-center">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => onSubmit(exerciseId)}
            disabled={!exerciseId || isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSubmitting ? (
              <>
                <span className="animate-pulse mr-2">•</span>
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit for Evaluation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SubmitEvaluationDialog;