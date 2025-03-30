// UserContentPreloader.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext'; // Assuming you have an auth context

const UserContentPreloader = () => {
  const { user } = useAuth();
  const [recommendedContent, setRecommendedContent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState(null);
  
  // Load user's recommended content on component mount
  useEffect(() => {
    if (user) {
      // First check if we have cached content in localStorage
      const cachedContent = localStorage.getItem(`user_${user.id}_recommended_content`);
      const cachedTimestamp = localStorage.getItem(`user_${user.id}_content_timestamp`);
      
      // Check if we have valid cached content (less than 1 hour old)
      if (cachedContent && cachedTimestamp) {
        const isStillValid = (Date.now() - parseInt(cachedTimestamp)) < (60 * 60 * 1000);
        
        if (isStillValid) {
          setRecommendedContent(JSON.parse(cachedContent));
          setIsLoading(false);
          return;
        }
      }
      
      // If no valid cache, fetch from server
      fetchRecommendedContent();
    }
  }, [user]);
  
  const fetchRecommendedContent = async () => {
    setIsLoading(true);
    try {
      // Fetch user's recent activity and preferences
      const userPrefs = await fetch(`/api/users/${user.id}/preferences`);
      const userPrefsData = await userPrefs.json();
      
      // Fetch recommended content based on user preferences
      const response = await fetch(`/api/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          subjectPreferences: userPrefsData.subjectPreferences,
          skillLevel: userPrefsData.skillLevel,
          recentlyViewed: userPrefsData.recentlyViewed
        })
      });
      
      const recommendations = await response.json();
      
      // Cache the recommendations in localStorage
      localStorage.setItem(
        `user_${user.id}_recommended_content`, 
        JSON.stringify(recommendations)
      );
      localStorage.setItem(
        `user_${user.id}_content_timestamp`, 
        Date.now().toString()
      );
      
      // Update state with recommendations
      setRecommendedContent(recommendations);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleContentSelect = (content) => {
    setSelectedContent(content);
    
    // Save this selection to user history
    if (user) {
      fetch(`/api/users/${user.id}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contentId: content.id,
          timestamp: Date.now(),
          contentType: content.type
        })
      });
    }
  };
  
  if (isLoading) {
    return <div className="loading-spinner">Loading your personalized content...</div>;
  }
  
  if (selectedContent) {
    return (
      <div className="content-viewer">
        <h2>{selectedContent.title}</h2>
        <div className="problem-container">
          {selectedContent.problems.map(problem => (
            <div key={problem.id} className="problem-card">
              <h3>Problem {problem.id}</h3>
              <p>{problem.description}</p>
              {/* Problem interaction components */}
            </div>
          ))}
        </div>
        <button onClick={() => setSelectedContent(null)}>
          Back to recommendations
        </button>
      </div>
    );
  }
  
  return (
    <div className="content-recommendations">
      <h2>Recommended for You</h2>
      <div className="recommendation-cards">
        {recommendedContent?.map(content => (
          <div 
            key={content.id} 
            className="recommendation-card"
            onClick={() => handleContentSelect(content)}
          >
            <h3>{content.title}</h3>
            <p>{content.description}</p>
            <div className="meta-info">
              <span>Subject: {content.subject}</span>
              <span>Skill: {content.skill}</span>
              <span>Difficulty: {content.difficulty}</span>
            </div>
          </div>
        ))}
      </div>
      <button onClick={fetchRecommendedContent}>Refresh Recommendations</button>
    </div>
  );
};

export default UserContentPreloader;