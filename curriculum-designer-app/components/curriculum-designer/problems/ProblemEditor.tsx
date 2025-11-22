'use client';

import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateProblem } from '@/lib/curriculum-authoring/problems-hooks';
import type { ProblemInDB, MultipleChoiceProblem, TrueFalseProblem, FillInBlanksProblem, ShortAnswerProblem, Difficulty } from '@/types/problems';

interface ProblemEditorProps {
  problem: ProblemInDB;
  onClose: () => void;
}

export function ProblemEditor({ problem, onClose }: ProblemEditorProps) {
  const [formData, setFormData] = useState(problem.problem_json as any);
  const updateMutation = useUpdateProblem();

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        problemId: problem.problem_id,
        updates: {
          problem_json: formData,
        },
      });
      onClose();
    } catch (error) {
      console.error('Failed to update problem:', error);
    }
  };

  // Render form based on problem type
  const renderForm = () => {
    if (problem.problem_type === 'multiple_choice') {
      const mc = formData as MultipleChoiceProblem;
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="question">Question</Label>
            <Textarea
              id="question"
              value={mc.question_text}
              onChange={(e) =>
                setFormData({ ...mc, question_text: e.target.value })
              }
              rows={3}
            />
          </div>

          <div>
            <Label>Options (4 required)</Label>
            <div className="space-y-2">
              {mc.options.map((option, index) => (
                <Input
                  key={index}
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...mc.options];
                    newOptions[index] = e.target.value;
                    setFormData({ ...mc, options: newOptions });
                  }}
                  placeholder={`Option ${String.fromCharCode(65 + index)}`}
                />
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="correct-answer">Correct Answer</Label>
            <Select
              value={mc.correct_answer_index.toString()}
              onValueChange={(value) =>
                setFormData({ ...mc, correct_answer_index: parseInt(value) })
              }
            >
              <SelectTrigger id="correct-answer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mc.options.map((option, index) => (
                  <SelectItem key={index} value={index.toString()}>
                    {String.fromCharCode(65 + index)}. {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="explanation">Explanation</Label>
            <Textarea
              id="explanation"
              value={mc.explanation}
              onChange={(e) =>
                setFormData({ ...mc, explanation: e.target.value })
              }
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select
              value={mc.difficulty}
              onValueChange={(value: Difficulty) =>
                setFormData({ ...mc, difficulty: value })
              }
            >
              <SelectTrigger id="difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    if (problem.problem_type === 'true_false') {
      const tf = formData as TrueFalseProblem;
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="statement">Statement</Label>
            <Textarea
              id="statement"
              value={tf.statement}
              onChange={(e) =>
                setFormData({ ...tf, statement: e.target.value })
              }
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="correct-answer">Correct Answer</Label>
            <Select
              value={tf.correct_answer.toString()}
              onValueChange={(value) =>
                setFormData({ ...tf, correct_answer: value === 'true' })
              }
            >
              <SelectTrigger id="correct-answer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">True</SelectItem>
                <SelectItem value="false">False</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="explanation">Explanation</Label>
            <Textarea
              id="explanation"
              value={tf.explanation}
              onChange={(e) =>
                setFormData({ ...tf, explanation: e.target.value })
              }
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select
              value={tf.difficulty}
              onValueChange={(value: Difficulty) =>
                setFormData({ ...tf, difficulty: value })
              }
            >
              <SelectTrigger id="difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    if (problem.problem_type === 'fill_in_blanks') {
      const fib = formData as FillInBlanksProblem;
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="question">Question (use {'{blank}'} for blanks)</Label>
            <Textarea
              id="question"
              value={fib.question_text}
              onChange={(e) =>
                setFormData({ ...fib, question_text: e.target.value })
              }
              rows={3}
            />
          </div>

          <div>
            <Label>Correct Answers</Label>
            <div className="space-y-2">
              {fib.blanks.map((blank, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={blank}
                    onChange={(e) => {
                      const newBlanks = [...fib.blanks];
                      newBlanks[index] = e.target.value;
                      setFormData({ ...fib, blanks: newBlanks });
                    }}
                    placeholder={`Blank ${index + 1}`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newBlanks = fib.blanks.filter((_, i) => i !== index);
                      setFormData({ ...fib, blanks: newBlanks });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setFormData({ ...fib, blanks: [...fib.blanks, ''] })
                }
              >
                Add Blank
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="explanation">Explanation</Label>
            <Textarea
              id="explanation"
              value={fib.explanation}
              onChange={(e) =>
                setFormData({ ...fib, explanation: e.target.value })
              }
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select
              value={fib.difficulty}
              onValueChange={(value: Difficulty) =>
                setFormData({ ...fib, difficulty: value })
              }
            >
              <SelectTrigger id="difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    if (problem.problem_type === 'short_answer') {
      const sa = formData as ShortAnswerProblem;
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="question">Question</Label>
            <Textarea
              id="question"
              value={sa.question_text}
              onChange={(e) =>
                setFormData({ ...sa, question_text: e.target.value })
              }
              rows={3}
            />
          </div>

          <div>
            <Label>Sample Answers</Label>
            <div className="space-y-2">
              {sa.sample_answers.map((answer, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={answer}
                    onChange={(e) => {
                      const newAnswers = [...sa.sample_answers];
                      newAnswers[index] = e.target.value;
                      setFormData({ ...sa, sample_answers: newAnswers });
                    }}
                    placeholder={`Answer ${index + 1}`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newAnswers = sa.sample_answers.filter((_, i) => i !== index);
                      setFormData({ ...sa, sample_answers: newAnswers });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setFormData({ ...sa, sample_answers: [...sa.sample_answers, ''] })
                }
              >
                Add Answer
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="explanation">Explanation</Label>
            <Textarea
              id="explanation"
              value={sa.explanation}
              onChange={(e) =>
                setFormData({ ...sa, explanation: e.target.value })
              }
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select
              value={sa.difficulty}
              onValueChange={(value: Difficulty) =>
                setFormData({ ...sa, difficulty: value })
              }
            >
              <SelectTrigger id="difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    return <p>Unsupported problem type</p>;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Problem</DialogTitle>
        </DialogHeader>

        <div className="py-4">{renderForm()}</div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              'Saving...'
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
