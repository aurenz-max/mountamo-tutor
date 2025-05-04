import React from 'react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, Play, Square, Trash2, Maximize } from 'lucide-react';

interface PlaybackControlsProps {
  isRunning: boolean;
  codeNeedsReload: boolean;
  onReload: () => void;
  onPlay: () => void;
  onStop: () => void;
  onClear: () => void;
  onToggleFullscreen: () => void;
}

const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isRunning,
  codeNeedsReload,
  onReload,
  onPlay,
  onStop,
  onClear,
  onToggleFullscreen
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="outline" 
            size="icon"
            onClick={onReload}
            className={codeNeedsReload ? "border-amber-500" : ""}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Reload code changes</p>
        </TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="outline" 
            size="icon"
            onClick={onPlay}
            disabled={isRunning}
          >
            <Play className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Run sketch</p>
        </TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="outline" 
            size="icon"
            onClick={onStop}
            disabled={!isRunning}
          >
            <Square className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Stop sketch</p>
        </TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="outline" 
            size="icon"
            onClick={onToggleFullscreen}
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Toggle fullscreen</p>
        </TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="outline" 
            size="icon"
            onClick={onClear}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Reset playground</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default PlaybackControls;