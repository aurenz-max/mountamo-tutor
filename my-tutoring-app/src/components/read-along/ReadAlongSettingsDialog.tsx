import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Book } from 'lucide-react'

interface ReadAlongSettingsDialogProps {
  open: boolean
  setOpen: (open: boolean) => void
  onGenerate: (options: any) => void
  loading: boolean
  disabled: boolean
}

export default function ReadAlongSettingsDialog({
  open,
  setOpen,
  onGenerate,
  loading,
  disabled
}: ReadAlongSettingsDialogProps) {
  const [formData, setFormData] = useState({
    studentId: 1,
    studentGrade: 'kindergarten',
    readingLevel: 1,
    theme: '',
    withImage: true,
    studentInterests: ['animals', 'space', 'dinosaurs']
  })

  const handleSubmit = () => {
    onGenerate(formData)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <Book className="mr-2 h-4 w-4" />
          New Read-Along
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Read-Along</DialogTitle>
          <DialogDescription>
            Customize your read-along settings and generate new content.
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
          <Button onClick={handleSubmit} disabled={loading || disabled}>
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
  )
}