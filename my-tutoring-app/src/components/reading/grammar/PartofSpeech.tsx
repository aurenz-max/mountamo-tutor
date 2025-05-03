// Import React hooks
import React, { useState, useEffect, useCallback } from 'react';

// --- Data (defined outside component for stability) ---

// Define Parts of Speech categories
const partsOfSpeech = [
    { name: 'Noun', color: 'bg-red-500', hover: 'hover:bg-red-600' },
    { name: 'Pronoun', color: 'bg-orange-500', hover: 'hover:bg-orange-600' },
    { name: 'Verb', color: 'bg-green-500', hover: 'hover:bg-green-600' },
    { name: 'Adjective', color: 'bg-blue-500', hover: 'hover:bg-blue-600' }, // Includes determiners
    { name: 'Adverb', color: 'bg-purple-500', hover: 'hover:bg-purple-600' },
    { name: 'Preposition', color: 'bg-yellow-500', hover: 'hover:bg-yellow-600' },
    { name: 'Conjunction', color: 'bg-pink-500', hover: 'hover:bg-pink-600' },
    { name: 'Interjection', color: 'bg-indigo-500', hover: 'hover:bg-indigo-600' }
];

// Sample sentences with words tagged
const sentences = [
    {
        words: [
            { text: "Wow", pos: "Interjection" }, { text: ",", pos: null },
            { text: "the", pos: "Adjective" }, { text: "quick", pos: "Adjective" },
            { text: "brown", pos: "Adjective" }, { text: "fox", pos: "Noun" },
            { text: "jumps", pos: "Verb" }, { text: "over", pos: "Preposition" },
            { text: "the", pos: "Adjective" }, { text: "lazy", pos: "Adjective" },
            { text: "dog", pos: "Noun" }, { text: ".", pos: null }
        ]
    },
    {
        words: [
            { text: "She", pos: "Pronoun" }, { text: "sings", pos: "Verb" },
            { text: "beautifully", pos: "Adverb" }, { text: "and", pos: "Conjunction" },
            { text: "plays", pos: "Verb" }, { text: "the", pos: "Adjective" },
            { text: "piano", pos: "Noun" }, { text: ".", pos: null }
        ]
    },
    {
        words: [
            { text: "He", pos: "Pronoun" }, { text: "ran", pos: "Verb" },
            { text: "quickly", pos: "Adverb" }, { text: "to", pos: "Preposition" },
            { text: "the", pos: "Adjective" }, { text: "store", pos: "Noun" },
            { text: "because", pos: "Conjunction" }, { text: "it", pos: "Pronoun" },
            { text: "was", pos: "Verb" }, { text: "closing", pos: "Verb" },
            { text: ".", pos: null }
        ]
    },
     {
        words: [
            { text: "Ouch", pos: "Interjection" }, { text: "!", pos: null },
            { text: "That", pos: "Pronoun" }, { text: "really", pos: "Adverb" },
            { text: "smarted", pos: "Verb" }, { text: "!", pos: null }
        ]
    },
    {
        words: [
            { text: "The", pos: "Adjective" }, { text: "cat", pos: "Noun" },
            { text: "slept", pos: "Verb" }, { text: "soundly", pos: "Adverb" },
            { text: "under", pos: "Preposition" }, { text: "the", pos: "Adjective" },
            { text: "warm", pos: "Adjective" }, { text: "blanket", pos: "Noun" },
            { text: ".", pos: null }
        ]
    },
    {
        words: [
            { text: "The", pos: "Adjective" },
            { text: "big", pos: "Adjective" },
            { text: "dog", pos: "Noun" },
            { text: "barked", pos: "Verb" },
            { text: "loudly", pos: "Adverb" },
            { text: ".", pos: null }
        ]
    },
    {
        words: [
            { text: "Under", pos: "Preposition" },
            { text: "the", pos: "Adjective" },
            { text: "old", pos: "Adjective" },
            { text: "bridge", pos: "Noun" },
            { text: "lived", pos: "Verb" },
            { text: "a", pos: "Adjective" },
            { text: "grumpy", pos: "Adjective" },
            { text: "troll", pos: "Noun" },
            { text: ".", pos: null }
        ]
    },
    {
        words: [
            { text: "Hey", pos: "Interjection" },
            { text: ",", pos: null },
            { text: "wait", pos: "Verb" },
            { text: "for", pos: "Preposition" },
            { text: "me", pos: "Pronoun" },
            { text: "!", pos: null }
        ]
    },
    {
        words: [
            { text: "We", pos: "Pronoun" },
            { text: "ate", pos: "Verb" },
            { text: "pizza", pos: "Noun" },
            { text: ",", pos: null },
            { text: "and", pos: "Conjunction" },
            { text: "they", pos: "Pronoun" },
            { text: "had", pos: "Verb" },
            { text: "pasta", pos: "Noun" },
            { text: ".", pos: null }
        ]
    },
    {
        words: [
            { text: "Suddenly", pos: "Adverb" },
            { text: ",", pos: null },
            { text: "the", pos: "Adjective" },
            { text: "tiny", pos: "Adjective" },
            { text: "mouse", pos: "Noun" },
            { text: "scurried", pos: "Verb" },
            { text: "across", pos: "Preposition" },
            { text: "the", pos: "Adjective" },
            { text: "floor", pos: "Noun" },
            { text: ".", pos: null }
        ]
    },
    {
        words: [
            { text: "Learning", pos: "Verb" }, // Gerund as Verb for simplicity, could be Noun
            { text: "React", pos: "Noun" },
            { text: "can", pos: "Verb" }, // Modal Verb
            { text: "be", pos: "Verb" },
            { text: "challenging", pos: "Adjective" },
            { text: "but", pos: "Conjunction" },
            { text: "rewarding", pos: "Adjective" },
            { text: ".", pos: null }
        ]
    },
    {
        words: [
            { text: "Always", pos: "Adverb" },
            { text: "proofread", pos: "Verb" },
            { text: "your", pos: "Adjective" }, // Possessive Adjective
            { text: "essays", pos: "Noun" },
            { text: "carefully", pos: "Adverb" },
            { text: ".", pos: null }
        ]
    }
];

// --- React Component ---

// Default export for use as a Next.js page or component
export default function PartsOfSpeechTutor() {
    // --- State Variables ---
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);
    const [selectedWordIndex, setSelectedWordIndex] = useState(null); // Index of the selected word
    const [wordStatuses, setWordStatuses] = useState({}); // Stores status (correct/incorrect) for each word index
    const [score, setScore] = useState(0);
    const [totalWordsInCurrentSentence, setTotalWordsInCurrentSentence] = useState(0);
    const [identifiedWordsCount, setIdentifiedWordsCount] = useState(0);
    const [message, setMessage] = useState({ text: '', type: '', show: false }); // For user feedback

    // --- Memoized Derived State ---
    // Avoid recalculating current sentence data on every render unless index changes
    const currentSentenceData = React.useMemo(() => {
        return currentSentenceIndex >= 0 ? sentences[currentSentenceIndex] : null;
    }, [currentSentenceIndex]);

    // --- Effects ---
    // Load the first sentence when the component mounts
    useEffect(() => {
        loadNextSentence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array ensures this runs only once on mount

    // Effect to manage the message display timeout
    useEffect(() => {
        if (message.show) {
            const timer = setTimeout(() => {
                setMessage({ text: '', type: '', show: false });
            }, message.type === 'error' ? 2500 : 1500); // Longer display for errors/correct POS info
            return () => clearTimeout(timer); // Cleanup timer on unmount or if message changes
        }
    }, [message]);

    // --- Functions ---

    // Function to show temporary messages
    const showMessage = useCallback((text, type = 'info') => {
        setMessage({ text, type, show: true });
    }, []);

    // Load and display a sentence
    const loadSentence = useCallback((index) => {
        setCurrentSentenceIndex(index);
        const sentenceData = sentences[index];
        setSelectedWordIndex(null); // Reset selection
        setScore(0); // Reset score
        setIdentifiedWordsCount(0); // Reset identified count

        // Calculate total words needing identification
        const countableWords = sentenceData.words.filter(word => word.pos).length;
        setTotalWordsInCurrentSentence(countableWords);

        // Reset word statuses for the new sentence
        const initialStatuses = {};
        sentenceData.words.forEach((word, idx) => {
            if (word.pos) {
                initialStatuses[idx] = 'unidentified'; // Mark as needing identification
            }
        });
        setWordStatuses(initialStatuses);

        showMessage(`Sentence ${index + 1} loaded!`);
    }, [showMessage]); // Include showMessage in dependencies


    // Load the next sentence (or cycle back to the first)
     const loadNextSentence = useCallback(() => {
        setCurrentSentenceIndex(prevIndex => {
            const nextIndex = (prevIndex + 1) % sentences.length;
            loadSentence(nextIndex); // Call loadSentence directly with the calculated next index
            return nextIndex; // Return the new index for the state update
        });
    }, [loadSentence]); // Depend on loadSentence


    // Handle clicking on a word
    const handleWordClick = (wordIndex) => {
        // Ignore clicks if the word is already correctly identified
        if (wordStatuses[wordIndex] === 'correct') {
            showMessage("This word is already identified correctly!");
            return;
        }
        // Set the selected word index
        setSelectedWordIndex(wordIndex);
        // Clear 'incorrect' status when a word is re-selected
        if (wordStatuses[wordIndex] === 'incorrect') {
             setWordStatuses(prev => ({ ...prev, [wordIndex]: 'unidentified' }));
        }
    };

    // Handle clicking on a POS button
    const handlePosGuess = (guessedPos) => {
        if (selectedWordIndex === null || !currentSentenceData) {
            showMessage("Please select a word first!", 'error');
            return;
        }

        const correctPos = currentSentenceData.words[selectedWordIndex].pos;
        const wordText = currentSentenceData.words[selectedWordIndex].text;

        if (guessedPos === correctPos) {
            // Correct guess
            setWordStatuses(prev => ({ ...prev, [selectedWordIndex]: 'correct' }));
            setScore(prev => prev + 1);
            setIdentifiedWordsCount(prev => {
                const newCount = prev + 1;
                // Check for sentence completion after state update
                 if (newCount === totalWordsInCurrentSentence) {
                    showMessage("Sentence complete! Click 'Next Sentence'.", 'success');
                } else {
                    showMessage("Correct!", 'success');
                }
                return newCount;
            });
            setSelectedWordIndex(null); // Deselect word after correct guess

        } else {
            // Incorrect guess
            setWordStatuses(prev => ({ ...prev, [selectedWordIndex]: 'incorrect' }));
            showMessage(`Incorrect. "${wordText}" is a ${correctPos}.`, 'error');
            // Keep the word selected for another try
        }
    };

    // Check if all words are identified to enable the 'Next Sentence' button
    const isSentenceComplete = identifiedWordsCount === totalWordsInCurrentSentence && totalWordsInCurrentSentence > 0;

    // --- Render ---
    return (
        <>
            {/* Include keyframes for shake animation - needs to be global or in a CSS module ideally */}
            <style jsx global>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .shake-animation {
                    animation: shake 0.5s;
                }
            `}</style>

            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-lg max-w-3xl w-full text-center mx-auto my-8">
                <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-gray-800">Identify the Parts of Speech</h1>
                <p className="text-gray-600 mb-6">Click on a word in the sentence below, then click the button for the correct part of speech.</p>

                {/* Sentence Display Area */}
                <div className="text-lg sm:text-xl border border-gray-300 p-4 rounded-md mb-6 min-h-[60px] flex items-center justify-center flex-wrap bg-white">
                    {currentSentenceData ? (
                        currentSentenceData.words.map((wordData, index) => {
                            // Determine styling based on word status and selection
                            let wordClass = 'mx-1'; // Base class for spacing
                            if (wordData.pos) {
                                wordClass = `sentence-word cursor-pointer px-1 py-0.5 rounded transition-colors duration-200 border border-transparent ${wordClass}`;
                                const status = wordStatuses[index];

                                if (index === selectedWordIndex && status !== 'correct') {
                                    wordClass += ' bg-blue-100 border-blue-400'; // Selected style
                                } else if (status === 'correct') {
                                    wordClass += ' bg-green-100 text-green-800 border-green-400 cursor-default'; // Correct style
                                } else if (status === 'incorrect') {
                                    wordClass += ' bg-red-100 text-red-800 border-red-400 shake-animation'; // Incorrect style
                                } else {
                                     wordClass += ' hover:bg-gray-100'; // Default hover for unidentified
                                }
                            } else {
                                 wordClass += ' text-gray-700'; // Punctuation style
                            }

                            return (
                                <span
                                    key={index}
                                    className={wordClass}
                                    onClick={wordData.pos ? () => handleWordClick(index) : undefined} // Only add onClick if it's a word to identify
                                >
                                    {wordData.text}
                                </span>
                            );
                        })
                    ) : (
                        <span className="text-gray-400">Loading sentence...</span>
                    )}
                </div>

                {/* Part of Speech Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    {partsOfSpeech.map(pos => (
                        <button
                            key={pos.name}
                            onClick={() => handlePosGuess(pos.name)}
                            disabled={selectedWordIndex === null} // Disable if no word is selected
                            className={`w-full px-3 py-2 text-white rounded-md shadow ${pos.color} ${pos.hover} transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {pos.name}
                        </button>
                    ))}
                </div>

                {/* Controls and Score */}
                <div className="flex flex-col sm:flex-row items-center justify-between">
                    <div className="mb-4 sm:mb-0">
                        <span className="font-semibold text-gray-700">Score: </span>
                        <span className="font-bold text-blue-600">{score}</span> /
                        <span className="font-semibold text-gray-700">{totalWordsInCurrentSentence}</span>
                    </div>
                    <button
                        id="nextSentenceButton"
                        onClick={loadNextSentence}
                        disabled={!isSentenceComplete} // Enable only when sentence is complete
                        className="px-5 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next Sentence
                    </button>
                </div>
            </div>

            {/* Message Box */}
            {message.show && (
                <div
                    className={`fixed bottom-5 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-md text-white text-sm shadow-lg z-50 ${
                        message.type === 'error' ? 'bg-red-600' : message.type === 'success' ? 'bg-green-600' : 'bg-gray-800'
                    }`}
                >
                    {message.text}
                </div>
            )}
        </>
    );
}
