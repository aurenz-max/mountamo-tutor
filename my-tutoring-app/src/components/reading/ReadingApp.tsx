'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { visualContentApi } from '@/lib/visualContentApi';

// Import p5 with no SSR
const Sketch = dynamic(() => import('react-p5').then((mod) => mod.default), {
  ssr: false
});

const ReadingApp = () => {
  const [categories, setCategories] = useState([]);
  const [currentCategory, setCurrentCategory] = useState('');
  const [categoryImages, setCategoryImages] = useState([]);
  const [currentImage, setCurrentImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionId] = useState(`session_${Math.random().toString(36).substr(2, 9)}`);
  const [userSpoke, setUserSpoke] = useState(false);
  const [animatedText, setAnimatedText] = useState('');
  const [textParticles, setTextParticles] = useState([]);
  const [recognizedText, setRecognizedText] = useState('');
  
  // Gemini TTS WebSocket state
  const [ttsWebSocketConnected, setTtsWebSocketConnected] = useState(false);
  const [ttsStatus, setTtsStatus] = useState('idle');
  const [logs, setLogs] = useState([]);
  const [queueSize, setQueueSize] = useState(0);
  
  // Refs
  const cycleTimerRef = useRef(null);
  const p5Ref = useRef(null);
  const recognitionRef = useRef(null);
  
  // TTS WebSocket and Audio refs
  const websocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const audioSourceRef = useRef(null);
  const isPlayingAudioRef = useRef(false);

  // Add a logging function for better debugging
  const addLog = (message) => {
    console.log(`[TTS] ${message}`);
    setLogs(prev => [...prev.slice(-19), `${new Date().toISOString().substr(11, 8)}: ${message}`]);
  };

  // Initialize Speech Recognition and TTS WebSocket
  useEffect(() => {
    console.log('[Init] Initializing ReadingApp component');
    
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event) => {
        const spokenText = event.results[0][0].transcript.trim().toLowerCase();
        setRecognizedText(spokenText);
        checkSpeechMatch(spokenText);
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setError('Speech recognition failed');
        setUserSpoke(false);
      };
      
      recognitionRef.current = recognition;
      console.log('[Init] Speech recognition initialized');
    } else {
      console.warn('[Init] Speech recognition not available in this browser');
    }
    
    // Initialize AudioContext for TTS
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      addLog(`AudioContext initialized with sample rate: ${audioContextRef.current.sampleRate}`);
      
      // Resume the AudioContext (to avoid auto-suspension)
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().then(() => {
          addLog('AudioContext resumed during initialization');
        });
      }
    } catch (err) {
      addLog(`Error initializing AudioContext: ${err}`);
      setError('Failed to initialize audio playback');
    }
    
    // Connect to Gemini TTS WebSocket
    addLog('Connecting to Gemini TTS WebSocket');
    connectTtsWebSocket();

    const fetchCategories = async () => {
      try {
        console.log('[Init] Fetching visual categories');
        setLoading(true);
        const response = await visualContentApi.getVisualCategories();
        if (response.status === 'success' && response.categories) {
          console.log(`[Init] Retrieved ${response.categories.length} categories`);
          setCategories(response.categories);
          if (response.categories.length > 0) {
            console.log(`[Init] Setting initial category to: ${response.categories[0]}`);
            setCurrentCategory(response.categories[0]);
          }
        }
      } catch (err) {
        console.error('[Init] Error fetching categories:', err);
        setError('Failed to load categories');
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();

    // User interaction to ensure AudioContext starts
    const handleUserInteraction = async () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        addLog('AudioContext resumed after user interaction');
      }
      document.removeEventListener('click', handleUserInteraction);
    };
    
    document.addEventListener('click', handleUserInteraction);

    return () => {
      if (cycleTimerRef.current) {
        clearTimeout(cycleTimerRef.current);
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
        addLog('AudioContext closed');
      }
      
      if (websocketRef.current) {
        websocketRef.current.close();
        addLog('WebSocket connection closed');
      }
      
      document.removeEventListener('click', handleUserInteraction);
    };
  }, []);

  // Connect to Gemini TTS WebSocket with improved retry logic
  const connectTtsWebSocket = (retryCount = 0, maxRetries = 3) => {
    if (websocketRef.current) {
      addLog('Closing existing WebSocket connection');
      websocketRef.current.close();
    }
    
    try {
      const connectionState = retryCount > 0 
        ? `Retrying TTS WebSocket connection (${retryCount}/${maxRetries})...` 
        : 'Connecting to Gemini TTS WebSocket...';
      addLog(connectionState);
      
      // Show connecting status
      setTtsStatus('connecting');

      const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
      const ws = new WebSocket(`${wsBaseUrl}/api/tts/stream`);
      websocketRef.current = ws;
      
      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          addLog('WebSocket connection timed out');
          ws.close();
          
          // Retry logic
          if (retryCount < maxRetries) {
            addLog(`Retrying connection (${retryCount + 1}/${maxRetries})...`);
            connectTtsWebSocket(retryCount + 1, maxRetries);
          } else {
            addLog('Max retries reached, using browser TTS as fallback');
            setTtsStatus('failed');
            setTtsWebSocketConnected(false);
          }
        }
      }, 5000); // 5-second timeout
      
      ws.onopen = () => {
        addLog('Gemini TTS WebSocket connection established');
        clearTimeout(connectionTimeout);
        setTtsWebSocketConnected(true);
        setTtsStatus('connected');
        setError('');
      };
      
      ws.onclose = (event) => {
        addLog(`Gemini TTS WebSocket connection closed: ${event.code}`);
        clearTimeout(connectionTimeout);
        setTtsWebSocketConnected(false);
        setTtsStatus('disconnected');
        
        // Auto-reconnect when connection is lost (not on manual close)
        if (event.code !== 1000 && event.code !== 1001) {
          // Reconnect after a delay
          setTimeout(() => {
            if (retryCount < maxRetries) {
              connectTtsWebSocket(retryCount + 1, maxRetries);
            }
          }, 2000 + (retryCount * 1000)); // Increase delay with each retry
        }
      };
      
      ws.onerror = (event) => {
        addLog('Gemini TTS WebSocket error');
        // Don't set error message here, as onclose will also be called
        setTtsStatus('error');
      };
      
      ws.onmessage = async (event) => {
        try {
          // Parse the response
          const data = JSON.parse(event.data);
          
          if (data.status === 'starting') {
            setTtsStatus('synthesizing');
            addLog('Started audio synthesis');
            
            // Clear the queue when starting new synthesis
            audioQueueRef.current = [];
            setQueueSize(0);
            if (audioSourceRef.current) {
              audioSourceRef.current.stop();
              audioSourceRef.current = null;
            }
            isPlayingAudioRef.current = false;
          } else if (data.type === 'audio') {
            // Process audio data
            addLog(`Received audio data chunk`);
            await processPCMFromBase64(
              data.data,
              data.sampleRate || 24000,
              data.channels || 1
            );
          } else if (data.error) {
            addLog(`TTS error: ${data.error}`);
            setTtsStatus('error');
          }
        } catch (e) {
          addLog(`Failed to parse TTS message: ${e}`);
        }
      };
    } catch (err) {
      addLog(`Failed to connect to TTS WebSocket: ${err}`);
      if (retryCount < maxRetries) {
        setTimeout(() => connectTtsWebSocket(retryCount + 1, maxRetries), 1000);
      } else {
        setTtsStatus('failed');
      }
    }
  };

  // Process PCM audio from base64 and add to queue - improved with better error handling
  const processPCMFromBase64 = async (
    base64Data,
    sampleRate = 24000, 
    channels = 1
  ) => {
    if (!audioContextRef.current) {
      addLog('Cannot process audio: AudioContext not initialized');
      return;
    }

    try {
      // Decode base64
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      addLog(`Decoded audio: ${bytes.length} bytes`);

      // Convert bytes to float32 samples (assuming 16-bit PCM little-endian)
      const samples = new Float32Array(bytes.length / 2);
      const view = new DataView(bytes.buffer);

      for (let i = 0; i < samples.length; i++) {
        // Read 16-bit value and convert to float
        const int16Value = view.getInt16(i * 2, true); // true = little-endian
        // Convert to float32 (-1.0 to 1.0)
        samples[i] = int16Value / 32768.0;
      }

      // Create an AudioBuffer with the correct sample rate
      const audioBuffer = audioContextRef.current.createBuffer(
        channels, 
        samples.length, 
        sampleRate
      );

      // Fill the buffer with our samples
      const channelData = audioBuffer.getChannelData(0);
      channelData.set(samples);
      
      // Add to queue
      audioQueueRef.current.push(audioBuffer);
      setQueueSize(audioQueueRef.current.length);
      addLog(`Added to queue, size: ${audioQueueRef.current.length}`);
      
      // Start playback if not already playing
      if (!isPlayingAudioRef.current) {
        isPlayingAudioRef.current = true;
        playNextInQueue();
      }
    } catch (err) {
      addLog(`Error processing audio: ${err}`);
    }
  };

  // Play next audio in queue - improved with better error handling
  const playNextInQueue = async () => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) {
      isPlayingAudioRef.current = false;
      setQueueSize(0);
      return;
    }
    
    try {
      // Make sure audio context is running
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        addLog('AudioContext resumed before playback');
      }
      
      const audioBuffer = audioQueueRef.current.shift();
      if (!audioBuffer) return;
      
      // Update queue size in UI
      setQueueSize(audioQueueRef.current.length);
      
      addLog(`Playing buffer: ${audioBuffer.duration.toFixed(2)}s, remaining: ${audioQueueRef.current.length}`);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      // When this audio chunk ends
      source.onended = () => {
        addLog('Audio segment ended');
        audioSourceRef.current = null;
        
        // Play next chunk
        setTimeout(playNextInQueue, 0);
      };
      
      source.start(0);
      audioSourceRef.current = source;
      isPlayingAudioRef.current = true;
    } catch (err) {
      addLog(`Error during audio playback: ${err}`);
      isPlayingAudioRef.current = false;
      
      // Try the next one in case of error
      setTimeout(playNextInQueue, 0);
    }
  };

  // Speak using Gemini TTS - improved with better connection handling
  const speakWithGemini = (text) => {
    if (!text || text.trim() === '') {
      addLog('Empty text passed to speakWithGemini, skipping TTS');
      return;
    }
    
    addLog(`Speaking: "${text}" using Gemini TTS`);
    
    // Track connection attempt and set fallback timer
    let connectionAttemptMade = false;
    let fallbackTimer = null;
    
    // If not connected, try to reconnect
    if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
      addLog('WebSocket not connected, attempting to connect...');
      setTtsStatus('connecting');
      connectTtsWebSocket();
      connectionAttemptMade = true;
      
      // Set a timeout to check if connection succeeded
      setTimeout(() => {
        if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
          addLog(`WebSocket connected, sending text: "${text}"`);
          try {
            websocketRef.current.send(JSON.stringify({ text }));
          } catch (err) {
            addLog(`Error sending text to WebSocket: ${err}`);
            speakWithBrowser(text);
          }
        } else {
          addLog('Could not connect to TTS WebSocket, falling back to browser speech');
          setTtsStatus('failed');
          // Fall back to browser speech synthesis
          speakWithBrowser(text);
        }
      }, 2000); // Give it 2 seconds to connect
    } else {
      // Already connected, send the text to the WebSocket
      addLog(`WebSocket connected (state: ${websocketRef.current.readyState}), sending text: "${text}"`);
      try {
        websocketRef.current.send(JSON.stringify({ text }));
      } catch (err) {
        addLog(`Error sending text to WebSocket: ${err}`);
        speakWithBrowser(text);
      }
    }
    
    // Set a fallback timer in case TTS doesn't respond
    fallbackTimer = setTimeout(() => {
      addLog(`Fallback timer triggered, ttsStatus: ${ttsStatus}`);
      if (ttsStatus === 'connecting' || connectionAttemptMade) {
        addLog('TTS did not respond in time, falling back to browser speech');
        speakWithBrowser(text);
      }
    }, 5000); // Wait 5 seconds for TTS to respond
    
    // Return a cleanup function
    return () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
    };
  };

  // Fallback to browser speech synthesis if Gemini TTS fails
  const speakWithBrowser = (text) => {
    if ('speechSynthesis' in window && text) {
      addLog(`Using browser speech synthesis for: "${text}"`);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Stop audio playback
  const stopPlayback = () => {
    addLog('Stopping audio playback');
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
    
    // Clear the queue
    audioQueueRef.current = [];
    setQueueSize(0);
    addLog('Cleared audio queue');
    setTtsStatus('idle');
    isPlayingAudioRef.current = false;
  };

  useEffect(() => {
    if (!currentCategory) return;

    const fetchCategoryImages = async () => {
      try {
        // Clear any existing timer to prevent stale cycles
        if (cycleTimerRef.current) {
          clearTimeout(cycleTimerRef.current);
        }

        setLoading(true);
        console.log(`Fetching images for category: ${currentCategory}`);
        const response = await visualContentApi.getVisualImages(currentCategory);
        
        if (response.status === 'success' && Array.isArray(response.images)) {
          console.log(`Fetched ${response.images.length} images for ${currentCategory}`);
          setCategoryImages(response.images);
          
          // Select a random image to start
          if (response.images.length > 0) {
            const randomIndex = Math.floor(Math.random() * response.images.length);
            fetchImageDetails(response.images[randomIndex].id);
          } else {
            setCurrentImage(null);
            setAnimatedText('');
          }
        } else {
          throw new Error('Failed to load images for category');
        }
      } catch (err) {
        console.error(`Error fetching images for category ${currentCategory}:`, err);
        setError(`Failed to load images for ${currentCategory}`);
        setCategoryImages([]);
        setCurrentImage(null);
        setAnimatedText('');
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryImages();

    // Cleanup on category change or unmount
    return () => {
      if (cycleTimerRef.current) {
        clearTimeout(cycleTimerRef.current);
      }
      setCategoryImages([]); // Clear images when category changes
      setCurrentImage(null); // Clear current image
      setAnimatedText(''); // Clear animated text
    };
  }, [currentCategory]);

  const fetchImageDetails = async (imageId) => {
    try {
      setLoading(true);
      const response = await visualContentApi.getVisualImage(imageId);
      if (response.status === 'success' && response.image) {
        setCurrentImage(response.image);
        
        // Parse the file name
        if (response.image.name) {
          let displayText = response.image.name;
          addLog(`Processing image name: "${displayText}"`);
          
          let identifier = "";
          
          // First try the standard parsing approach
          if (displayText.includes('-')) {
            // Step 1: Remove everything before the hyphen
            const afterHyphen = displayText.split('-').slice(1).join('-');
            
            // Step 2: Remove "ALPHABET" or "NUMBER"
            let cleanedText = afterHyphen.replace(/^(ALPHABET|NUMBER)\s*/, '');
            
            // Step 3: Keep only the first word (the identifier)
            const identifierMatch = cleanedText.match(/^\w+/);
            identifier = identifierMatch ? identifierMatch[0] : cleanedText;
          } else {
            // Alternative parsing if no hyphen found
            // Try to extract any word sequence
            const wordMatch = displayText.match(/([A-Za-z]+)/);
            identifier = wordMatch ? wordMatch[0] : "";
            
            // If still empty, try to find any sequence of letters or numbers
            if (!identifier) {
              const anyCharMatch = displayText.match(/([A-Za-z0-9]+)/);
              identifier = anyCharMatch ? anyCharMatch[0] : "";
            }
          }
          
          // If we have a non-empty identifier, use it
          if (identifier && identifier.trim() !== "") {
            addLog(`Extracted identifier: "${identifier}"`);
            setAnimatedText(identifier);
            
            // Use Gemini TTS 
            speakWithGemini(identifier);
          } else {
            // Fallback to using the whole filename if we couldn't extract a proper identifier
            const fallbackText = displayText.replace(/\.[^/.]+$/, ""); // Remove file extension
            addLog(`Using fallback text: "${fallbackText}"`);
            setAnimatedText(fallbackText);
            
            if (fallbackText && fallbackText.trim() !== "") {
              speakWithGemini(fallbackText);
            } else {
              addLog("No valid text found to speak");
            }
          }
        } else {
          addLog("Image has no name property");
        }
        
        startCycleTimer();
      }
    } catch (err) {
      console.error('Error fetching image details:', err);
      setError('Failed to load image');
    } finally {
      setLoading(false);
    }
  };

  const cycleToNextImage = () => {
    if (categoryImages.length <= 1) return;
    
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * categoryImages.length);
    } while (
      currentImage && 
      categoryImages[randomIndex].id === currentImage.id && 
      categoryImages.length > 1
    );
    
    console.log(`Cycling to next image in category: ${currentCategory}`);
    fetchImageDetails(categoryImages[randomIndex].id);
  };

  const startCycleTimer = () => {
    if (cycleTimerRef.current) {
      clearTimeout(cycleTimerRef.current);
    }
    
    const cycleTime = 4000 + Math.random() * 1000;
    cycleTimerRef.current = setTimeout(() => {
      cycleToNextImage();
    }, cycleTime);
  };

  const handleUserSpeak = () => {
    if (recognitionRef.current) {
      setUserSpoke(true);
      setRecognizedText('');
      recognitionRef.current.start();
    } else {
      setError('Speech recognition not supported in this browser');
    }
  };

  const checkSpeechMatch = (spokenText) => {
    const targetText = animatedText.toLowerCase().trim();
    
    if (spokenText === targetText) {
      createParticleEffect();
      setTimeout(() => {
        setUserSpoke(false);
        cycleToNextImage();
      }, 2000);
    } else {
      setError(`Try again! You said "${spokenText}", expected "${targetText}"`);
      setTimeout(() => {
        setUserSpoke(false);
        setError('');
      }, 2000);
    }
  };

  const createParticleEffect = () => {
    if (p5Ref.current) {
      const p5Instance = p5Ref.current;
      const particles = [];
      const particleCount = 50;
      const centerX = p5Instance.width / 2;
      const centerY = p5Instance.height / 2;

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: centerX,
          y: centerY,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10,
          size: Math.random() * 20 + 10,
          color: p5Instance.color(
            Math.random() * 255,
            Math.random() * 255,
            Math.random() * 255
          ),
          alpha: 255,
          text: animatedText.charAt(Math.floor(Math.random() * animatedText.length))
        });
      }
      setTextParticles(particles);
    }
  };

  const handleCategoryChange = (e) => {
    const newCategory = e.target.value;
    console.log(`Category changed to: ${newCategory}`);
    setCurrentCategory(newCategory);
  };

  const setup = (p5, canvasParentRef) => {
    p5Ref.current = p5;
    p5.createCanvas(canvasParentRef.offsetWidth, 500).parent(canvasParentRef);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.frameRate(30);
  };

  const draw = (p5) => {
    p5.background(250);
    
    if (currentImage && currentImage.data_uri) {
      if (currentImage.type === 'svg') {
        const container = document.getElementById('svg-container');
        if (container) {
          container.innerHTML = currentImage.data_uri;
          const svg = container.querySelector('svg');
          if (svg) {
            const x = p5.width / 2 - 100;
            const y = p5.height / 2 - 150;
            p5.drawingContext.drawImage(svg, x, y, 200, 200);
          }
        }
      } else {
        const img = p5.imgs && p5.imgs[currentImage.id];
        if (img) {
          const imgWidth = Math.min(img.width, 300);
          const imgHeight = Math.min(img.height, 300);
          p5.image(img, p5.width / 2 - imgWidth / 2, 50, imgWidth, imgHeight);
        }
      }
    }

    if (!userSpoke && animatedText) {
      p5.textSize(40);
      p5.fill(0);
      const yOffset = Math.sin(p5.frameCount * 0.05) * 5;
      p5.text(animatedText, p5.width / 2, p5.height - 100 + yOffset);
    }

    if (textParticles.length > 0) {
      textParticles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.2;
        particle.alpha -= 2;

        if (particle.alpha > 0) {
          p5.fill(
            p5.red(particle.color),
            p5.green(particle.color),
            p5.blue(particle.color),
            particle.alpha
          );
          p5.textSize(particle.size);
          p5.text(particle.text, particle.x, particle.y);
        }
      });
      setTextParticles(prev => prev.filter(p => p.alpha > 0));
    }
  };

  const preload = (p5) => {
    p5.imgs = {};
    if (currentImage && currentImage.data_uri && currentImage.type !== 'svg') {
      p5.imgs[currentImage.id] = p5.loadImage(currentImage.data_uri);
    }
  };

  return (
    <div className="bg-white min-h-screen">
      <div id="svg-container" className="hidden"></div>
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-6">Reading Practice</h1>
        
        <div className="mb-6">
          <label htmlFor="category-select" className="block text-sm font-medium text-gray-700 mb-1">
            Select Category
          </label>
          <select
            id="category-select"
            value={currentCategory}
            onChange={handleCategoryChange}
            disabled={loading || categories.length === 0}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        
        {/* TTS Status Indicator */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center text-sm">
            <span className="mr-2">TTS:</span>
            <span className={`h-2 w-2 rounded-full mr-1 ${ttsWebSocketConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className={
              ttsStatus === 'connected' ? 'text-green-500' :
              ttsStatus === 'synthesizing' ? 'text-blue-500' :
              ttsStatus === 'error' ? 'text-red-500' :
              'text-gray-500'
            }>
              {ttsStatus === 'connected' ? 'Connected' :
              ttsStatus === 'synthesizing' ? 'Speaking' :
              ttsStatus === 'error' ? 'Error' :
              ttsStatus === 'disconnected' ? 'Disconnected' : 'Idle'}
            </span>
            
            {!ttsWebSocketConnected && (
              <button 
                onClick={connectTtsWebSocket}
                className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Connect
              </button>
            )}
          </div>
          
          {/* Queue Size Indicator */}
          <div className="text-sm text-gray-500">
            Queue: {queueSize} chunks
            {isPlayingAudioRef.current && <span className="ml-2 text-green-500">▶ Playing</span>}
          </div>
        </div>
        
        <div className="w-full h-[500px] rounded-lg border-2 border-gray-200 overflow-hidden relative mb-6">
          {!loading && (
            <Sketch
              setup={setup}
              draw={draw}
              preload={preload}
            />
          )}
          
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-80">
              <div className="text-xl text-blue-600 font-medium">Loading...</div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-100 bg-opacity-80">
              <div className="text-xl text-red-600 font-medium p-4 text-center">{error}</div>
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-4 justify-center mb-6">
          <button
            className="px-5 py-2 bg-green-500 text-white font-medium rounded-lg shadow hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            onClick={handleUserSpeak}
            disabled={loading || !currentImage}
          >
            Speak the Word
          </button>
          
          <button
            className="px-5 py-2 bg-blue-500 text-white font-medium rounded-lg shadow hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            onClick={cycleToNextImage}
            disabled={loading || categoryImages.length <= 1}
          >
            Next Image
          </button>
          
          <button
            className="px-5 py-2 bg-red-500 text-white font-medium rounded-lg shadow hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            onClick={stopPlayback}
            disabled={!isPlayingAudioRef.current}
          >
            Stop Audio
          </button>
          
          <button
            className="px-5 py-2 bg-purple-500 text-white font-medium rounded-lg shadow hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            onClick={() => speakWithGemini(animatedText)}
            disabled={!animatedText}
          >
            Repeat Word
          </button>
        </div>
        
        {recognizedText && (
          <div className="mt-4 text-center text-gray-600">
            You said: "{recognizedText}"
          </div>
        )}
        
        {/* Debug Logs Section (Collapsible) */}
        <div className="mt-6">
          <details className="bg-gray-50 rounded-lg p-2">
            <summary className="cursor-pointer font-medium">TTS Debug Logs</summary>
            <div className="bg-gray-100 p-3 rounded-md mt-2 max-h-40 overflow-y-auto text-xs font-mono">
              {logs.length === 0 ? (
                <div className="text-gray-500">No logs yet</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">{log}</div>
                ))
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

export default ReadingApp;