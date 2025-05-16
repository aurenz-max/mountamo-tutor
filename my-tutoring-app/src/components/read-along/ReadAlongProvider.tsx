import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '@/components/ui/use-toast';

// Create context
const ReadAlongContext = createContext();

export const useReadAlong = () => {
  const context = useContext(ReadAlongContext);
  if (!context) {
    throw new Error('useReadAlong must be used within a ReadAlongProvider');
  }
  return context;
};

export const ReadAlongProvider = ({ children }) => {
  const { toast } = useToast();
  const [readingHistory, setReadingHistory] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [savedReadAlongs, setSavedReadAlongs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load saved read-alongs from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('savedReadAlongs');
    if (saved) {
      try {
        setSavedReadAlongs(JSON.parse(saved));
      } catch (error) {
        console.error('Error parsing saved read-alongs:', error);
      }
    }
  }, []);

  // Save to local storage when saved read-alongs change
  useEffect(() => {
    if (savedReadAlongs.length > 0) {
      localStorage.setItem('savedReadAlongs', JSON.stringify(savedReadAlongs));
    }
  }, [savedReadAlongs]);

  const generateReadAlong = async (options = {}) => {
    setLoading(true);
    try {
      const endpoint = options.sessionId 
        ? '/api/v1/read-along' 
        : '/api/v1/read-along/direct';
      
      const payload = {
        ...(options.sessionId && { session_id: options.sessionId }),
        student_id: options.studentId || 1,
        student_grade: options.studentGrade || 'kindergarten',
        student_interests: options.studentInterests || ['animals'],
        reading_level: options.readingLevel || 1,
        theme: options.theme || undefined,
        with_image: options.withImage !== undefined ? options.withImage : true
      };
      
      const response = await axios.post(endpoint, payload);
      
      if (response.data.status === 'success') {
        const newReadAlong = response.data.data;
        
        // Add to history
        setReadingHistory(prev => [...prev, newReadAlong]);
        
        toast({
          title: 'Read-Along Generated',
          description: 'Your read-along content is ready',
        });
        
        return newReadAlong;
      } else {
        toast({
          title: 'Error',
          description: response.data.message || 'Failed to generate read-along content',
          variant: 'destructive',
        });
        return null;
      }
    } catch (error) {
      console.error('Error generating read-along:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to generate read-along content',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const saveReadAlong = (readAlong) => {
    if (!readAlong) return;
    
    // Add timestamp and ID if not present
    const toSave = {
      ...readAlong,
      savedAt: new Date().toISOString(),
      savedId: readAlong.savedId || `saved-${Date.now()}`
    };
    
    setSavedReadAlongs(prev => [...prev, toSave]);
    
    toast({
      title: 'Read-Along Saved',
      description: 'You can access it in your saved collection',
    });
    
    return toSave;
  };

  const deleteSavedReadAlong = (savedId) => {
    setSavedReadAlongs(prev => prev.filter(item => item.savedId !== savedId));
    
    toast({
      title: 'Read-Along Deleted',
      description: 'The saved read-along has been removed',
    });
  };

  // Value object to be provided by the context
  const value = {
    activeSessionId,
    setActiveSessionId,
    readingHistory,
    savedReadAlongs,
    loading,
    generateReadAlong,
    saveReadAlong,
    deleteSavedReadAlong
  };

  return (
    <ReadAlongContext.Provider value={value}>
      {children}
    </ReadAlongContext.Provider>
  );
};

export default ReadAlongProvider;