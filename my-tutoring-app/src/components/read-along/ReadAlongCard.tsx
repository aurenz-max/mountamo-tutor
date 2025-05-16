import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, BookmarkCheck, Play, Share } from 'lucide-react';
import { useReadAlong } from './ReadAlongProvider';
import { cn } from '@/lib/utils';

const ReadAlongCard = ({ readAlong, onSelect, isActive = false }) => {
  const { saveReadAlong, savedReadAlongs } = useReadAlong();
  
  // Check if this read-along is already saved
  const isSaved = savedReadAlongs.some(
    saved => saved.id === readAlong.id
  );
  
  // Extract the first paragraph for preview
  const previewText = readAlong.text_content.split('\n')[0];
  
  // Function to handle save button click
  const handleSave = (e) => {
    e.stopPropagation();
    saveReadAlong(readAlong);
  };
  
  // Calculate reading level label
  const getReadingLevelLabel = (level) => {
    switch(level) {
      case 1: return 'Beginner';
      case 2: return 'Developing';
      case 3: return 'Advancing';
      default: return 'Beginner';
    }
  };
  
  return (
    <Card 
      className={cn(
        "overflow-hidden transition-colors cursor-pointer hover:border-primary/50",
        isActive && "border-primary"
      )}
      onClick={() => onSelect && onSelect(readAlong)}
    >
      <div className="flex flex-col h-full">
        {readAlong.image_base64 && (
          <div className="aspect-[16/9] w-full bg-muted relative overflow-hidden">
            <img 
              src={`data:${readAlong.mime_type || 'image/png'};base64,${readAlong.image_base64}`}
              alt="Read-along illustration"
              className="object-cover w-full h-full"
            />
          </div>
        )}
        <CardHeader className={!readAlong.image_base64 ? "pt-6" : "pt-4"}>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="line-clamp-1">
                {readAlong.title || "Read-Along Story"}
              </CardTitle>
              <CardDescription>
                {readAlong.theme ? `Theme: ${readAlong.theme}` : "Interactive reading practice"}
              </CardDescription>
            </div>
            <Badge variant="outline" className="h-6">
              {getReadingLevelLabel(readAlong.reading_level || 1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-grow">
          <p className="text-muted-foreground line-clamp-3 text-sm">
            {previewText}
          </p>
        </CardContent>
        <CardFooter className="flex justify-between pt-2 pb-4">
          <Button variant="outline" size="sm" onClick={() => onSelect && onSelect(readAlong)}>
            <Play className="h-4 w-4 mr-2" />
            Read
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleSave} disabled={isSaved}>
              {isSaved ? (
                <BookmarkCheck className="h-4 w-4" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm">
              <Share className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </div>
    </Card>
  );
};

export default ReadAlongCard;