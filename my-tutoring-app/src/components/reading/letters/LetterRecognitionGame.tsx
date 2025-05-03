'use client';

import React, { useState, useEffect } from 'react';

const LetterRecognitionGame = () => {
  // Game states
  const [currentLetter, setCurrentLetter] = useState(null);
  const [options, setOptions] = useState([]);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [gameMode, setGameMode] = useState('uppercase-to-lowercase'); // or 'lowercase-to-uppercase'
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Letter data with examples and images
  const letters = [
    { uppercase: 'A', lowercase: 'a', word: 'Apple', color: 'bg-red-500' },
    { uppercase: 'B', lowercase: 'b', word: 'Ball', color: 'bg-blue-500' },
    { uppercase: 'C', lowercase: 'c', word: 'Cat', color: 'bg-orange-500' },
    { uppercase: 'D', lowercase: 'd', word: 'Dog', color: 'bg-yellow-500' },
    { uppercase: 'E', lowercase: 'e', word: 'Elephant', color: 'bg-green-500' },
    { uppercase: 'F', lowercase: 'f', word: 'Fish', color: 'bg-purple-500' },
    { uppercase: 'G', lowercase: 'g', word: 'Goat', color: 'bg-pink-500' },
    { uppercase: 'H', lowercase: 'h', word: 'Hat', color: 'bg-indigo-500' },
    { uppercase: 'I', lowercase: 'i', word: 'Ice cream', color: 'bg-blue-400' },
    { uppercase: 'J', lowercase: 'j', word: 'Juice', color: 'bg-orange-400' },
    { uppercase: 'K', lowercase: 'k', word: 'Kite', color: 'bg-red-400' },
    { uppercase: 'L', lowercase: 'l', word: 'Lion', color: 'bg-yellow-400' },
    { uppercase: 'M', lowercase: 'm', word: 'Mouse', color: 'bg-gray-500' },
    { uppercase: 'N', lowercase: 'n', word: 'Nest', color: 'bg-brown-500' },
    { uppercase: 'O', lowercase: 'o', word: 'Octopus', color: 'bg-blue-300' },
    { uppercase: 'P', lowercase: 'p', word: 'Pig', color: 'bg-pink-400' },
    { uppercase: 'Q', lowercase: 'q', word: 'Queen', color: 'bg-purple-400' },
    { uppercase: 'R', lowercase: 'r', word: 'Rabbit', color: 'bg-gray-400' },
    { uppercase: 'S', lowercase: 's', word: 'Sun', color: 'bg-yellow-300' },
    { uppercase: 'T', lowercase: 't', word: 'Tree', color: 'bg-green-400' },
    { uppercase: 'U', lowercase: 'u', word: 'Umbrella', color: 'bg-blue-600' },
    { uppercase: 'V', lowercase: 'v', word: 'Violin', color: 'bg-brown-400' },
    { uppercase: 'W', lowercase: 'w', word: 'Whale', color: 'bg-blue-700' },
    { uppercase: 'X', lowercase: 'x', word: 'X-ray', color: 'bg-gray-600' },
    { uppercase: 'Y', lowercase: 'y', word: 'Yo-yo', color: 'bg-red-600' },
    { uppercase: 'Z', lowercase: 'z', word: 'Zebra', color: 'bg-black' }
  ];

  // Initialize the game
  useEffect(() => {
    startNewRound();
  }, [gameMode]);

  // Start a new round with a random letter and answer options
  const startNewRound = () => {
    setFeedback(null);
    setShowSuccess(false);
    
    // Select a random letter
    const targetIndex = Math.floor(Math.random() * letters.length);
    const target = letters[targetIndex];
    
    // Determine question and options based on game mode
    const questionLetter = gameMode === 'uppercase-to-lowercase' ? target.uppercase : target.lowercase;
    const correctAnswer = gameMode === 'uppercase-to-lowercase' ? target.lowercase : target.uppercase;
    
    setCurrentLetter({ 
      display: questionLetter, 
      correct: correctAnswer,
      word: target.word,
      color: target.color
    });
    
    // Create options (1 correct, 3 wrong)
    let wrongOptions = [];
    while (wrongOptions.length < 3) {
      const randomIndex = Math.floor(Math.random() * letters.length);
      if (randomIndex !== targetIndex) {
        const wrongOption = gameMode === 'uppercase-to-lowercase' 
          ? letters[randomIndex].lowercase 
          : letters[randomIndex].uppercase;
        
        if (!wrongOptions.includes(wrongOption) && wrongOption !== correctAnswer) {
          wrongOptions.push(wrongOption);
        }
      }
    }
    
    // Combine and shuffle options
    const allOptions = [correctAnswer, ...wrongOptions];
    for (let i = allOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
    }
    
    setOptions(allOptions);
  };

  // Handle option selection
  const handleOptionClick = (selectedOption) => {
    if (feedback) return; // Prevent multiple selections while feedback is displayed
    
    setAttempts(attempts + 1);
    
    if (selectedOption === currentLetter.correct) {
      // Correct answer
      setScore(score + 1);
      setFeedback({ 
        message: `Good job! "${currentLetter.display}" and "${selectedOption}" are the same letter!`, 
        isCorrect: true 
      });
      setShowSuccess(true);
      
      // Move to next question after delay
      setTimeout(() => {
        startNewRound();
      }, 2000);
    } else {
      // Wrong answer
      setFeedback({ 
        message: `Try again! "${currentLetter.display}" matches with "${currentLetter.correct}".`, 
        isCorrect: false 
      });
      
      // Clear feedback after delay but keep same question
      setTimeout(() => {
        setFeedback(null);
      }, 2000);
    }
  };

  // Switch game mode
  const toggleGameMode = () => {
    setGameMode(gameMode === 'uppercase-to-lowercase' ? 'lowercase-to-uppercase' : 'uppercase-to-lowercase');
    setScore(0);
    setAttempts(0);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Letter Match Game</h1>
        <p className="text-gray-600 text-xl mb-2">
          {gameMode === 'uppercase-to-lowercase'
            ? "Match the uppercase letter to its lowercase letter!"
            : "Match the lowercase letter to its uppercase letter!"}
        </p>
        <div className="mt-4 flex justify-center space-x-2">
          <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-lg">
            Score: {score}
          </div>
          <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-lg">
            Tries: {attempts}
          </div>
        </div>
      </div>

      {/* Game Mode Toggle */}
      <div className="mb-6 text-center">
        <button 
          onClick={toggleGameMode}
          className="bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded-full transition duration-200 text-lg"
        >
          Switch to {gameMode === 'uppercase-to-lowercase' ? 'Lowercase → Uppercase' : 'Uppercase → Lowercase'}
        </button>
      </div>

      {/* Current Letter Display */}
      {currentLetter && (
        <div className="flex justify-center mb-8">
          <div className={`${currentLetter.color} text-white rounded-lg p-4 shadow-lg w-32 h-32 flex items-center justify-center`}>
            <span className="text-7xl font-bold">{currentLetter.display}</span>
          </div>
        </div>
      )}

      {/* Success Animation */}
      {showSuccess && currentLetter && (
        <div className="text-center mb-6 animate-bounce">
          <p className="text-2xl font-bold text-green-600">{currentLetter.word}!</p>
        </div>
      )}

      {/* Options */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleOptionClick(option)}
            className={`w-full py-4 px-6 text-center text-4xl font-bold rounded-lg shadow transition duration-200 
              ${feedback && option === currentLetter.correct ? 'bg-green-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            disabled={!!feedback}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`p-4 rounded-lg mb-6 text-center text-lg ${
          feedback.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {feedback.message}
        </div>
      )}
    </div>
  );
};

export default LetterRecognitionGame;