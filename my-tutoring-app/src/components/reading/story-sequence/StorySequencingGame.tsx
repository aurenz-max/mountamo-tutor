import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Define story data
const stories = [
  {
    id: 'planting-seed',
    title: 'Growing a Plant',
    scenes: [
      {
        id: 'scene1',
        image: '/api/placeholder/200/150',
        caption: 'First, the child plants the seed in soil.',
        correctPosition: 0
      },
      {
        id: 'scene2',
        image: '/api/placeholder/200/150',
        caption: 'Next, the child waters the seed every day.',
        correctPosition: 1
      },
      {
        id: 'scene3',
        image: '/api/placeholder/200/150',
        caption: 'Then, a small sprout grows from the soil.',
        correctPosition: 2
      },
      {
        id: 'scene4',
        image: '/api/placeholder/200/150',
        caption: 'Finally, the plant grows big with flowers!',
        correctPosition: 3
      }
    ]
  },
  {
    id: 'making-sandwich',
    title: 'Making a Sandwich',
    scenes: [
      {
        id: 'scene1',
        image: '/api/placeholder/200/150',
        caption: 'First, the child gets bread and ingredients.',
        correctPosition: 0
      },
      {
        id: 'scene2',
        image: '/api/placeholder/200/150',
        caption: 'Next, the child puts cheese on the bread.',
        correctPosition: 1
      },
      {
        id: 'scene3',
        image: '/api/placeholder/200/150',
        caption: 'Then, the child adds lettuce and tomato.',
        correctPosition: 2
      },
      {
        id: 'scene4',
        image: '/api/placeholder/200/150',
        caption: 'Finally, the child puts the top bread slice on.',
        correctPosition: 3
      }
    ]
  },
  {
    id: 'bedtime-routine',
    title: 'Bedtime Routine',
    scenes: [
      {
        id: 'scene1',
        image: '/api/placeholder/200/150',
        caption: 'First, the child brushes their teeth.',
        correctPosition: 0
      },
      {
        id: 'scene2',
        image: '/api/placeholder/200/150',
        caption: 'Next, the child puts on pajamas.',
        correctPosition: 1
      },
      {
        id: 'scene3',
        image: '/api/placeholder/200/150',
        caption: 'Then, the child reads a bedtime story.',
        correctPosition: 2
      },
      {
        id: 'scene4',
        image: '/api/placeholder/200/150',
        caption: 'Finally, the child goes to sleep.',
        correctPosition: 3
      }
    ]
  }
];

// Sortable Item Component
const SortableItem = ({ id, caption, image }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  
  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="bg-white rounded-lg shadow-md p-3 mb-3 cursor-move border-2 border-gray-200 hover:border-blue-400 transition-colors duration-200"
      {...attributes} 
      {...listeners}
    >
      <div className="flex items-center">
        <div className="flex-shrink-0 mr-3">
          <img 
            src={image} 
            alt={caption} 
            className="w-20 h-16 object-cover rounded-md"
          />
        </div>
        <p className="text-lg">{caption}</p>
      </div>
    </div>
  );
};

// Main Story Sequencing Game Component
const StorySequencingGame = () => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [scenes, setScenes] = useState([]);
  const [isCorrect, setIsCorrect] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completedStories, setCompletedStories] = useState([]);
  
  // Set up DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Initialize with shuffled scenes
  useEffect(() => {
    if (stories[currentStoryIndex]) {
      const shuffledScenes = [...stories[currentStoryIndex].scenes];
      
      // Fisher-Yates shuffle algorithm
      for (let i = shuffledScenes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledScenes[i], shuffledScenes[j]] = [shuffledScenes[j], shuffledScenes[i]];
      }
      
      setScenes(shuffledScenes);
      setIsCorrect(null);
      setShowFeedback(false);
      setCompleted(false);
    }
  }, [currentStoryIndex]);
  
  // Handle drag end
  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setScenes((scenes) => {
        const oldIndex = scenes.findIndex((scene) => scene.id === active.id);
        const newIndex = scenes.findIndex((scene) => scene.id === over.id);
        
        return arrayMove(scenes, oldIndex, newIndex);
      });
    }
  };
  
  // Check sequence order
  const checkSequence = () => {
    const isSequenceCorrect = scenes.every((scene, index) => scene.correctPosition === index);
    setIsCorrect(isSequenceCorrect);
    setShowFeedback(true);
    
    if (isSequenceCorrect) {
      // Add to completed stories if not already there
      if (!completedStories.includes(currentStoryIndex)) {
        setCompletedStories([...completedStories, currentStoryIndex]);
      }
      setCompleted(true);
    }
  };
  
  // Move to next story
  const nextStory = () => {
    const nextIndex = (currentStoryIndex + 1) % stories.length;
    setCurrentStoryIndex(nextIndex);
  };
  
  // Try again (reshuffles current story)
  const tryAgain = () => {
    const shuffledScenes = [...scenes];
    for (let i = shuffledScenes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledScenes[i], shuffledScenes[j]] = [shuffledScenes[j], shuffledScenes[i]];
    }
    setScenes(shuffledScenes);
    setIsCorrect(null);
    setShowFeedback(false);
  };
  
  // Current story data
  const currentStory = stories[currentStoryIndex];
  
  return (
    <div className="bg-blue-50 rounded-lg shadow-lg p-6 max-w-xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-blue-800">Story Sequencing</h1>
        <p className="text-lg text-blue-600 mt-2">Put the story in the right order!</p>
        
        {/* Story selector */}
        <div className="flex justify-center mt-4 gap-2">
          {stories.map((story, index) => (
            <button
              key={story.id}
              onClick={() => setCurrentStoryIndex(index)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${
                currentStoryIndex === index 
                  ? 'bg-blue-600 text-white' 
                  : completedStories.includes(index)
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {story.title}
            </button>
          ))}
        </div>
      </div>
      
      {/* Current story title */}
      <div className="bg-white rounded-lg p-4 mb-6 text-center shadow-md">
        <h2 className="text-2xl font-bold text-purple-700">{currentStory.title}</h2>
      </div>
      
      {/* Drag and drop container */}
      <div className="mb-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={scenes.map(scene => scene.id)} strategy={verticalListSortingStrategy}>
            {scenes.map((scene) => (
              <SortableItem 
                key={scene.id} 
                id={scene.id} 
                caption={scene.caption} 
                image={scene.image} 
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      
      {/* Buttons */}
      <div className="flex justify-center gap-4">
        <button
          onClick={checkSequence}
          className="px-5 py-2 bg-purple-600 text-white font-medium rounded-full hover:bg-purple-700 transition-colors duration-200 text-lg"
          disabled={showFeedback && isCorrect}
        >
          Check My Answer
        </button>
        
        {completed && (
          <button
            onClick={nextStory}
            className="px-5 py-2 bg-green-600 text-white font-medium rounded-full hover:bg-green-700 transition-colors duration-200 text-lg"
          >
            Next Story
          </button>
        )}
        
        {showFeedback && !isCorrect && (
          <button
            onClick={tryAgain}
            className="px-5 py-2 bg-orange-500 text-white font-medium rounded-full hover:bg-orange-600 transition-colors duration-200 text-lg"
          >
            Try Again
          </button>
        )}
      </div>
      
      {/* Feedback */}
      {showFeedback && (
        <div className={`mt-6 p-4 rounded-lg text-center text-lg ${
          isCorrect ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
        }`}>
          {isCorrect ? (
            <div>
              <p className="font-bold">Great job! 🎉</p>
              <p>You put the story in the right order!</p>
            </div>
          ) : (
            <div>
              <p className="font-bold">Not quite right.</p>
              <p>Try again! Think about what happens first, next, then, and last.</p>
            </div>
          )}
        </div>
      )}
      
      {/* Story progress indicator */}
      <div className="mt-6 flex justify-center">
        <div className="bg-gray-200 h-2 w-full max-w-xs rounded-full overflow-hidden">
          <div 
            className="bg-blue-600 h-full" 
            style={{ width: `${(completedStories.length / stories.length) * 100}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default StorySequencingGame;