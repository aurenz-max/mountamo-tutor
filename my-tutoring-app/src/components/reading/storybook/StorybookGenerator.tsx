'use client';

import React, { useState } from 'react';

// Types for the form and response
interface StoryBookFormData {
  theme: string;
  ageGroup: string;
  mainCharacter: string;
}

interface StoryBookPage {
  text: string;
  image: string;
  interactiveDescription: string;
  activity: string;
}

// Updated interfaces to match the new endpoint
interface StorybookResponse {
  status: string;
  session_id: string;
  model: string;
  storybook: {
    pages: StorybookResponsePage[];
  };
}

interface StorybookResponsePage {
  page_number: number;
  text: string;
  image?: string;
  image_mime_type?: string;
}

// Card option interfaces
interface ThemeOption {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface AgeGroupOption {
  id: string;
  name: string;
  emoji: string;
}

interface CharacterOption {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

const StoryBookGenerator: React.FC = () => {
  // Define the step states
  enum Step {
    AgeSelect,
    ThemeSelect,
    CharacterSelect,
    GeneratingStory,
    ViewStory
  }

  const [currentStep, setCurrentStep] = useState<Step>(Step.AgeSelect);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [storyBook, setStoryBook] = useState<StoryBookPage[] | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [storyTitle, setStoryTitle] = useState<string>("Your Amazing Story");
  
  // Form state
  const [formData, setFormData] = useState<StoryBookFormData>({
    theme: '',
    ageGroup: '',
    mainCharacter: '',
  });

  // Age group options
  const ageGroupOptions: AgeGroupOption[] = [
    { id: '4-6', name: 'Little Readers (4-6)', emoji: '🧸' },
    { id: '7-9', name: 'Growing Readers (7-9)', emoji: '📚' },
    { id: '10-12', name: 'Big Kid Readers (10-12)', emoji: '🚀' }
  ];

  // Theme options
  const themeOptions: ThemeOption[] = [
    { id: 'space', name: 'Space Adventure', emoji: '🚀', color: 'bg-indigo-500' },
    { id: 'dinosaurs', name: 'Dinosaur World', emoji: '🦖', color: 'bg-green-500' },
    { id: 'ocean', name: 'Ocean Explorer', emoji: '🐙', color: 'bg-blue-500' },
    { id: 'fairytale', name: 'Magic Kingdom', emoji: '🏰', color: 'bg-purple-500' },
    { id: 'jungle', name: 'Jungle Safari', emoji: '🦁', color: 'bg-yellow-600' },
    { id: 'farm', name: 'Farm Friends', emoji: '🐄', color: 'bg-red-500' },
    { id: 'construction', name: 'Building Site', emoji: '🚜', color: 'bg-yellow-500' },
    { id: 'cars', name: 'Racing Cars', emoji: '🏎️', color: 'bg-red-600' }
  ];

  // Character options - Add a "Random Character" option at the beginning
  const characterOptions: CharacterOption[] = [
    { id: 'random', name: 'Surprise Me!', emoji: '✨', color: 'bg-gradient-to-r from-purple-500 to-pink-500' },
    { id: 'astronaut', name: 'Brave Astronaut', emoji: '👨‍🚀', color: 'bg-blue-500' },
    { id: 'dragon', name: 'Friendly Dragon', emoji: '🐉', color: 'bg-red-500' },
    { id: 'fairy', name: 'Magical Fairy', emoji: '🧚', color: 'bg-pink-500' },
    { id: 'knight', name: 'Brave Knight', emoji: '🛡️', color: 'bg-gray-500' },
    { id: 'tiger', name: 'Curious Tiger', emoji: '🐯', color: 'bg-orange-500' },
    { id: 'robot', name: 'Helpful Robot', emoji: '🤖', color: 'bg-teal-500' },
    { id: 'rabbit', name: 'Hopping Rabbit', emoji: '🐰', color: 'bg-purple-400' },
    { id: 'bear', name: 'Adventure Bear', emoji: '🐻', color: 'bg-amber-700' }
  ];

  // Handle age group selection
  const handleAgeSelect = (ageId: string) => {
    setFormData({
      ...formData,
      ageGroup: ageId
    });
    setCurrentStep(Step.ThemeSelect);
  };

  // Handle theme selection
  const handleThemeSelect = (themeId: string) => {
    const selectedTheme = themeOptions.find(theme => theme.id === themeId);
    if (selectedTheme) {
      setFormData({
        ...formData,
        theme: selectedTheme.name
      });
      setCurrentStep(Step.CharacterSelect);
    }
  };

  // Handle character selection - Updated to handle "random" character selection
  const handleCharacterSelect = (characterId: string) => {
    if (characterId === 'random') {
      // For the random option, we don't set a main character - backend will generate one
      setFormData({
        ...formData,
        mainCharacter: '' // Set to empty to make it optional
      });
      
      // Add a small delay before generating story to ensure form state is updated
      setTimeout(() => {
        handleGenerateStory();
      }, 100);
    } else {
      const selectedCharacter = characterOptions.find(char => char.id === characterId);
      if (selectedCharacter) {
        setFormData({
          ...formData,
          mainCharacter: selectedCharacter.name
        });
        
        // Add a small delay before generating story to ensure form state is updated
        setTimeout(() => {
          handleGenerateStory();
        }, 100);
      }
    }
  };

  // Updated function to parse the new API response format
  const parseStoryBookResponse = (response: StorybookResponse): StoryBookPage[] => {
    const pages: StoryBookPage[] = [];
    
    // Check if we have a valid response with pages
    if (!response || !response.storybook || !response.storybook.pages || response.storybook.pages.length === 0) {
      console.error("Invalid response format or empty pages array");
      return [{
        text: "We're having trouble creating your story. Please try again!",
        image: '',
        interactiveDescription: 'Tap the restart button to try again',
        activity: 'Can you think of a different character or theme?'
      }];
    }
    
    // Process each page in the response
    response.storybook.pages.forEach(page => {
      let imageUrl = '';
      let cleanedText = page.text || '';
      
      // Clean up any formatting markers in the text (like **Page 6** **Text:**)
      cleanedText = cleanedText.replace(/\*\*Page \d+\*\* \*\*Text:\*\*/g, '');
      
      // If this page has an image, convert it to data URL
      if (page.image && page.image_mime_type) {
        imageUrl = `data:${page.image_mime_type};base64,${page.image}`;
      }
      
      // Create StoryBookPage object with default values for interactive elements
      pages.push({
        text: cleanedText,
        image: imageUrl,
        interactiveDescription: 'Tap characters to hear sounds and see animations',
        activity: 'What do you think happens next?'
      });
    });
    
    console.log(`Created ${pages.length} pages from API response`);
    return pages;
  };

  // Generate a better title based on the theme and character
  const generateStoryTitle = (character: string, theme: string): string => {
    // If no character was provided (random), create a theme-only title
    if (!character) {
      const themeOptions = [
        `A Magical ${theme}`,
        `The Amazing ${theme}`,
        `Journey to the ${theme}`,
        `Adventures in ${theme}`,
        `Discover the ${theme}`
      ];
      return themeOptions[Math.floor(Math.random() * themeOptions.length)];
    }
    
    // Remove possessive form if present
    const cleanCharacter = character.replace(/'s$/, '');
    
    // Extract just the theme name without "Adventure" if present
    const themeName = theme.replace(/\s?Adventure$/, '');
    
    // Create variations of titles
    const titleVariations = [
      `${cleanCharacter}'s ${themeName} Adventure`,
      `The ${themeName} Journey with ${cleanCharacter}`,
      `${cleanCharacter} Explores the ${themeName}`,
      `${cleanCharacter} and the Amazing ${themeName}`
    ];
    
    // Return a random variation
    return titleVariations[Math.floor(Math.random() * titleVariations.length)];
  };

  // Submit form to generate storybook
  const handleGenerateStory = async () => {
    // Guard clause to prevent double execution
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);
    setCurrentStep(Step.GeneratingStory);
    
    try {
      // Create request object - only include main_character if it's not empty
      const requestBody: any = {
        theme: formData.theme,
        age_group: formData.ageGroup
      };
      
      // Only add main_character if it's provided
      if (formData.mainCharacter) {
        requestBody.main_character = formData.mainCharacter;
      }
      
      console.log("Generating story with data:", requestBody);
      
      // Use correct API endpoint with updated parameters
      const response = await fetch('http://localhost:8000/api/gemini/generate_storybook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data: StorybookResponse = await response.json();
      
      // Check if we got a valid response before parsing
      if (!data || !data.storybook || !data.storybook.pages || data.storybook.pages.length === 0) {
        throw new Error("Received empty response from API");
      }
      
      const parsedStoryBook = parseStoryBookResponse(data);
      
      // Check if we have valid pages
      if (!parsedStoryBook || parsedStoryBook.length === 0) {
        throw new Error("Failed to parse storybook content");
      }
      
      // Generate a creative title based on theme and character
      setStoryTitle(generateStoryTitle(formData.mainCharacter, formData.theme));
      
      setStoryBook(parsedStoryBook);
      setCurrentPage(0);
      setCurrentStep(Step.ViewStory);
    } catch (err) {
      console.error("Story generation error:", err);
      setError(`Failed to generate storybook: ${err instanceof Error ? err.message : String(err)}`);
      // Go back to character selection instead of theme selection
      setCurrentStep(Step.CharacterSelect);
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation functions
  const goToNextPage = () => {
    if (storyBook && currentPage < storyBook.length - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Restart the process
  const handleRestart = () => {
    setFormData({
      theme: '',
      ageGroup: '',
      mainCharacter: '',
    });
    setStoryBook(null);
    setStoryTitle("Your Amazing Story");
    setCurrentStep(Step.AgeSelect);
  };

  // Render age group selection step
  const renderAgeSelection = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-purple-600 mb-3">Create Your Storybook!</h1>
        <h2 className="text-3xl font-bold text-gray-700">How Old Are You?</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
        {ageGroupOptions.map(age => (
          <button 
            key={age.id}
            onClick={() => handleAgeSelect(age.id)}
            className="bg-white rounded-3xl shadow-xl overflow-hidden cursor-pointer transform transition duration-300 hover:scale-105 hover:shadow-2xl p-8 border-8 border-blue-300 hover:border-blue-500 flex flex-col items-center group"
          >
            <div className="relative mb-6">
              <span className="text-8xl group-hover:animate-bounce">{age.emoji}</span>
              <div className="absolute -inset-4 bg-blue-100/50 rounded-full -z-10 scale-0 group-hover:scale-100 transition-transform duration-300"></div>
            </div>
            <h3 className="font-bold text-2xl text-center text-blue-800">{age.name}</h3>
          </button>
        ))}
      </div>
    </div>
  );

  // Render theme selection step
  const renderThemeSelection = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-purple-600 mb-3">Create Your Storybook!</h1>
        <h2 className="text-3xl font-bold text-gray-700 mb-2">Pick a Story Theme</h2>
        <p className="text-center text-2xl text-gray-600">What kind of adventure do you want?</p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-8">
        {themeOptions.map(theme => (
          <button 
            key={theme.id}
            onClick={() => handleThemeSelect(theme.id)}
            className={`${theme.color} text-white rounded-3xl shadow-xl overflow-hidden cursor-pointer transform transition duration-300 hover:scale-105 hover:shadow-2xl p-6 flex flex-col items-center group relative`}
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <span className="text-7xl mb-4 group-hover:animate-pulse">{theme.emoji}</span>
            <h3 className="font-bold text-xl text-center">{theme.name}</h3>
          </button>
        ))}
      </div>
      
      <div className="flex justify-center mt-10">
        <button 
          onClick={() => setCurrentStep(Step.AgeSelect)}
          className="px-8 py-4 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 text-xl font-bold flex items-center shadow-md transition-all duration-300 hover:shadow-lg"
        >
          <span className="mr-3">◀</span> Go Back
        </button>
      </div>
    </div>
  );

  // Render character selection step
  const renderCharacterSelection = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-purple-600 mb-3">Create Your Storybook!</h1>
        <h2 className="text-3xl font-bold text-gray-700 mb-2">Choose Your Character</h2>
        <p className="text-center text-2xl text-gray-600">Who will go on the {formData.theme}?</p>
        <p className="text-center text-lg text-purple-600 mt-2">
          Choose "Surprise Me!" to let the story create its own character!
        </p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mt-8">
        {characterOptions.map(character => {
          // Special styling for the "random" option
          const isRandom = character.id === 'random';
          
          return (
            <button 
              key={character.id}
              onClick={() => handleCharacterSelect(character.id)}
              className={`${character.color} text-white rounded-3xl shadow-xl overflow-hidden cursor-pointer transform transition duration-300 hover:scale-105 hover:shadow-2xl p-6 flex flex-col items-center group relative ${isRandom ? 'md:col-span-3 border-4 border-yellow-300' : ''}`}
            >
              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl"></div>
              <div className="relative">
                <span className={`text-7xl mb-4 z-10 relative group-hover:scale-110 transition-transform duration-300 ${isRandom ? 'animate-pulse' : ''}`}>{character.emoji}</span>
                <div className="absolute bottom-2 -inset-x-2 h-4 bg-black/10 blur-md rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <h3 className="font-bold text-xl text-center">{character.name}</h3>
            </button>
          );
        })}
      </div>
      
      <div className="flex justify-center mt-10">
        <button 
          onClick={() => setCurrentStep(Step.ThemeSelect)}
          className="px-8 py-4 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 text-xl font-bold flex items-center shadow-md transition-all duration-300 hover:shadow-lg"
        >
          <span className="mr-3">◀</span> Go Back
        </button>
      </div>
    </div>
  );

  // Render generating story step
  const renderGeneratingStory = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative mb-10">
        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center">
          <div className="w-32 h-32 bg-purple-400/30 rounded-full animate-ping"></div>
        </div>
        <div className="relative flex items-center justify-center z-10">
          <span className="text-8xl animate-bounce delay-100">✨</span>
          <span className="text-9xl animate-pulse">🪄</span>
          <span className="text-8xl animate-bounce delay-300">✨</span>
        </div>
      </div>
      
      <h2 className="text-4xl font-bold text-center text-purple-600 mb-4">Story Magic in Progress!</h2>
      <p className="text-center text-2xl max-w-xl mx-auto">
        {formData.mainCharacter 
          ? `We're creating your amazing adventure with ${formData.mainCharacter} in a magical ${formData.theme.toLowerCase()}!`
          : `We're creating your amazing adventure in a magical ${formData.theme.toLowerCase()}!`
        }
      </p>
      
      {error ? (
        <div className="mt-10 p-8 bg-red-50 text-red-700 rounded-2xl border-3 border-red-300 max-w-lg shadow-lg">
          <div className="flex items-center mb-4">
            <span className="text-4xl mr-4">😕</span>
            <p className="text-xl font-bold">Oops! Our story wizard needs a break.</p>
          </div>
          <p className="mt-2 text-lg">Let's try again with a different character or theme!</p>
          <button 
            onClick={() => setCurrentStep(Step.CharacterSelect)}
            className="mt-6 px-6 py-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition duration-300 shadow-md font-medium text-lg w-full"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="w-80 h-8 bg-gray-200 rounded-full mt-12 overflow-hidden shadow-inner p-1">
          <div className="h-full w-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-full animate-pulse relative">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_1.5s_infinite]"></div>
          </div>
        </div>
      )}
    </div>
  );

  // Render view story step
  const renderViewStory = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-purple-600">
          {/* Clean up title if it has formatting markers */}
          {storyTitle.replace(/'s\s+/g, ' ')}
        </h2>
        <button
          onClick={handleRestart}
          className="px-6 py-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 text-lg font-bold transition duration-300 transform hover:scale-105 shadow-lg"
        >
          Make Another Story! 🪄
        </button>
      </div>
      
      {storyBook && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border-4 border-purple-300">
          {/* Page Navigation */}
          <div className="flex justify-between items-center mb-8">
            <span className="text-xl font-bold text-purple-500">
              Page {currentPage + 1} of {storyBook.length}
            </span>
            <div>
              <button
                onClick={goToPrevPage}
                disabled={currentPage === 0}
                className={`px-6 py-3 bg-blue-500 text-white rounded-full mr-4 text-xl flex items-center font-medium shadow-md transition duration-300 ${currentPage === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600 hover:shadow-lg'}`}
              >
                <span className="mr-1">◀</span> Back
              </button>
              <button
                onClick={goToNextPage}
                disabled={currentPage === storyBook.length - 1}
                className={`px-6 py-3 bg-blue-500 text-white rounded-full text-xl flex items-center font-medium shadow-md transition duration-300 ${currentPage === storyBook.length - 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600 hover:shadow-lg'}`}
              >
                Next <span className="ml-1">▶</span>
              </button>
            </div>
          </div>
          
          {/* Page Content */}
          <div className="flex flex-col md:flex-row gap-8">
            {/* Image Section */}
            <div className="md:w-1/2">
              {storyBook[currentPage].image ? (
                <div className="relative overflow-hidden rounded-3xl shadow-xl transform transition-transform duration-300 hover:scale-102">
                  <img
                    src={storyBook[currentPage].image}
                    alt={`Page ${currentPage + 1} illustration`}
                    className="w-full h-auto border-8 border-blue-200 rounded-3xl"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-500/10"></div>
                </div>
              ) : (
                <div className="w-full h-80 bg-gradient-to-br from-purple-100 to-blue-100 rounded-3xl flex items-center justify-center border-8 border-blue-200 shadow-xl">
                  <div className="animate-pulse text-center">
                    <div className="text-5xl mb-3">🖼️</div>
                    <span className="text-gray-500 text-xl font-medium">Loading illustration...</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Text Section */}
            <div className="md:w-1/2">
              <div className="prose max-w-none">
                <div className="text-2xl mb-8 font-medium leading-relaxed text-gray-800">
                  {/* Clean up any formatting markers in the text */}
                  {storyBook[currentPage].text.replace(/\*\*Page \d+\*\* \*\*Text:\*\*/g, '').trim()}
                </div>
                
                <div className="mt-6 p-5 bg-blue-100 rounded-2xl border-3 border-blue-300 shadow-md transform transition-transform duration-300 hover:shadow-lg">
                  <h3 className="font-bold text-blue-700 mb-3 text-xl flex items-center">
                    <span className="mr-2">👆</span> Touch and Play:
                  </h3>
                  <p className="text-lg text-blue-800">{storyBook[currentPage].interactiveDescription}</p>
                </div>
                
                <div className="mt-6 p-5 bg-green-100 rounded-2xl border-3 border-green-300 shadow-md transform transition-transform duration-300 hover:shadow-lg">
                  <h3 className="font-bold text-green-700 mb-3 text-xl flex items-center">
                    <span className="mr-2">🤔</span> Fun Question:
                  </h3>
                  <p className="text-lg text-green-800">{storyBook[currentPage].activity}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Add animation keyframes for shimmer effect
  const ShimmerKeyframes = () => (
    <style jsx global>{`
      @keyframes shimmer {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(100%);
        }
      }
      
      .hover\:scale-102:hover {
        transform: scale(1.02);
      }
      
      .border-3 {
        border-width: 3px;
      }
    `}</style>
  );

  // Render the current step
  const renderCurrentStep = () => {
    return (
      <>
        <ShimmerKeyframes />
        {(() => {
          switch (currentStep) {
            case Step.AgeSelect:
              return renderAgeSelection();
            case Step.ThemeSelect:
              return renderThemeSelection();
            case Step.CharacterSelect:
              return renderCharacterSelection();
            case Step.GeneratingStory:
              return renderGeneratingStory();
            case Step.ViewStory:
              return renderViewStory();
            default:
              return renderAgeSelection();
          }
        })()}
      </>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl bg-gradient-to-b from-purple-50 to-blue-50 min-h-screen rounded-3xl shadow-xl">
      <div className="py-8 px-6">
        {renderCurrentStep()}
      </div>
    </div>
  );
};

export default StoryBookGenerator;