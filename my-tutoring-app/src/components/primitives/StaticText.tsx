import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface StaticTextProps {
  parameters: {
    content: string;
    text_align?: 'left' | 'center' | 'right';
    font_weight?: 'normal' | 'bold';
    font_size?: 'small' | 'medium' | 'large';
  };
  disabled?: boolean;
  initialValue?: any;
  onUpdate?: (value: any, isComplete?: boolean) => void;
  showValidation?: boolean;
}

export default function StaticText({ 
  parameters,
  disabled = false
}: StaticTextProps) {
  const {
    content,
    text_align = 'left',
    font_weight = 'normal',
    font_size = 'medium'
  } = parameters;

  // Convert parameters to CSS classes
  const alignmentClass = {
    'left': 'text-left',
    'center': 'text-center', 
    'right': 'text-right'
  }[text_align];

  const weightClass = {
    'normal': 'font-normal',
    'bold': 'font-bold'
  }[font_weight];

  const sizeClass = {
    'small': 'text-sm',
    'medium': 'text-base',
    'large': 'text-lg'
  }[font_size];

  // Handle markdown-style content (basic support)
  const processContent = (text: string) => {
    // Simple markdown processing - bold text
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  };

  return (
    <Card className={`${disabled ? 'opacity-50' : ''}`}>
      <CardContent className="p-4">
        <div 
          className={`${alignmentClass} ${weightClass} ${sizeClass} text-gray-800 leading-relaxed`}
          dangerouslySetInnerHTML={{ __html: processContent(content) }}
        />
      </CardContent>
    </Card>
  );
}