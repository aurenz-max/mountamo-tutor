import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectLabel, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Loader2, Book } from 'lucide-react';
import { useReadAlong } from './ReadAlongProvider';
import { useSession } from '@/context/session-context'; // Adjust path as needed

const ReadAlongModal = ({ trigger, onReadAlongGenerated }) => {
  const { activeSession } = useSession();
  const { generateReadAlong, loading } = useReadAlong();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    readingLevel: 1,
    theme: '',
    withImage: true
  });

  const handleSubmit = async () => {
    const options = {
      sessionId: activeSession?.id,
      studentId: activeSession?.student_id || 1,
      readingLevel: formData.readingLevel,
      theme: formData.theme || undefined,
      withImage: formData.withImage,
      studentGrade: 'kindergarten', // Default to kindergarten for now
      studentInterests: activeSession?.interests || ['animals', 'space']
    };

    const generatedReadAlong = await generateReadAlong(options);
    
    if (generatedReadAlong) {
      if (onReadAlongGenerated) {
        onReadAlongGenerated(generatedReadAlong);
      }
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Book className="mr-2 h-4 w-4" />
            New Read-Along
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Read-Along</DialogTitle>
          <DialogDescription>
            Generate a read-along with age-appropriate text and illustrations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="reading-level" className="text-right">
              Reading Level
            </Label>
            <Select 
              value={formData.readingLevel.toString()} 
              onValueChange={(val) => setFormData({...formData, readingLevel: parseInt(val)})}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Reading Level</SelectLabel>
                  <SelectItem value="1">Beginner</SelectItem>
                  <SelectItem value="2">Developing</SelectItem>
                  <SelectItem value="3">Advancing</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="theme" className="text-right">
              Theme
            </Label>
            <Input
              id="theme"
              placeholder="Animals, Space, etc."
              className="col-span-3"
              value={formData.theme}
              onChange={(e) => setFormData({...formData, theme: e.target.value})}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="with-image" className="text-right">
              Include Image
            </Label>
            <div className="col-span-3 flex items-center space-x-2">
              <Checkbox 
                id="with-image" 
                checked={formData.withImage} 
                onCheckedChange={(checked) => setFormData({...formData, withImage: !!checked})} 
              />
              <label 
                htmlFor="with-image"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Generate an illustration for the text
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Book className="mr-2 h-4 w-4" />
                Generate Read-Along
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReadAlongModal;