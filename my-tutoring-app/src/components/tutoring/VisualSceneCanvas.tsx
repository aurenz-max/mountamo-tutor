import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const VisualSceneCanvas = ({ sessionId, onSceneDeleted }) => {
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch scenes on component mount and when sessionId changes
  useEffect(() => {
    if (sessionId) {
      fetchScenes();
    }
  }, [sessionId]);

  const fetchScenes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/visual/session/${sessionId}/scenes`);
      const data = await response.json();
      
      if (data.status === 'success') {
        setScenes(data.scenes);
      } else {
        setError('Failed to load scenes');
      }
    } catch (err) {
      setError('Error connecting to server');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteScene = async (sceneId) => {
    try {
      const response = await fetch(`/api/visual/scene/${sessionId}/${sceneId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        // Remove the scene from state
        setScenes(prev => prev.filter(scene => scene.scene_id !== sceneId));
        
        // Notify parent component
        if (onSceneDeleted) {
          onSceneDeleted(sceneId);
        }
      } else {
        setError('Failed to delete scene');
      }
    } catch (err) {
      setError('Error connecting to server');
      console.error(err);
    }
  };

  const renderSceneContent = (scene) => {
    if (scene.content_type === 'counting_scene') {
      return (
        <div className="p-4 bg-gray-50 rounded mt-2">
          <div className="flex flex-wrap gap-4 justify-center">
            {Array.from({ length: scene.data.count }).map((_, index) => (
              <div key={index} className="object-container">
                {scene.data.image_data.type === 'svg' ? (
                  <div 
                    dangerouslySetInnerHTML={{ __html: scene.data.image_data.data_uri }}
                    className="w-16 h-16"
                  />
                ) : (
                  <img 
                    src={scene.data.image_data.data_uri} 
                    alt={scene.data.object_type}
                    className="w-16 h-16 object-contain"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center mt-4 font-medium">
            {scene.data.count} {scene.data.object_type}
          </div>
        </div>
      );
    } else if (scene.content_type === 'multi_object_scene') {
      return (
        <div className="p-4 bg-gray-50 rounded mt-2">
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(scene.data.object_counts).map(([objectId, count]) => (
              <div key={objectId} className="text-center">
                <div className="bg-white p-2 rounded shadow-sm">
                  <span className="font-medium">{count}x</span> {objectId.split('_').slice(-1)[0]}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    } else if (scene.content_type === 'svg_scene') {
      return (
        <div 
          dangerouslySetInnerHTML={{ __html: scene.data.svg_content }}
          className="p-4 bg-gray-50 rounded mt-2"
        />
      );
    }
    
    return (
      <div className="p-4 bg-gray-100 rounded mt-2 text-center">
        Unknown scene type: {scene.content_type}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Visual Scenes</CardTitle>
        <CardDescription>
          Interactive visual content for the tutoring session
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {loading && <div className="text-center py-4">Loading scenes...</div>}
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {!loading && scenes.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No scenes created yet. Use the image browser to create one!
          </div>
        )}
        
        <div className="space-y-6">
          {scenes.map((scene) => (
            <div key={scene.scene_id} className="border rounded p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">
                    {scene.title || 
                     (scene.content_type === 'counting_scene' 
                      ? `${scene.data.count} ${scene.data.object_type}` 
                      : `Scene ${scene.scene_id}`)}
                  </h3>
                  {scene.description && (
                    <p className="text-gray-500 text-sm">{scene.description}</p>
                  )}
                </div>
                <Button 
                  variant="destructive"
                  onClick={() => deleteScene(scene.scene_id)}
                  size="sm"
                >
                  Delete
                </Button>
              </div>
              
              {renderSceneContent(scene)}
            </div>
          ))}
        </div>
        
        <div className="mt-4 flex justify-center">
          <Button onClick={fetchScenes} variant="outline">
            Refresh Scenes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default VisualSceneCanvas;