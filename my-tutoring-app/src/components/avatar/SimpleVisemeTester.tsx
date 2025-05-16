// components/avatar/SimpleVisemeTester.tsx
import React, { useState } from 'react';

// Oculus viseme names with display labels
const OCULUS_VISEMES = [
  { id: 0, name: 'viseme_sil', label: 'Silence' },
  { id: 10, name: 'viseme_PP', label: 'PP (p,b,m)' },
  { id: 11, name: 'viseme_FF', label: 'FF (f,v)' },
  { id: 12, name: 'viseme_TH', label: 'TH' },
  { id: 13, name: 'viseme_DD', label: 'DD (t,d,n)' },
  { id: 14, name: 'viseme_kk', label: 'KK (k,g)' },
  { id: 15, name: 'viseme_CH', label: 'CH (sh,j)' },
  { id: 16, name: 'viseme_SS', label: 'SS (s,z)' },
  { id: 17, name: 'viseme_nn', label: 'NN' },
  { id: 18, name: 'viseme_RR', label: 'RR' },
  { id: 1, name: 'viseme_aa', label: 'AA' },
  { id: 4, name: 'viseme_E', label: 'E (ee)' },
  { id: 6, name: 'viseme_I', label: 'I (ih)' },
  { id: 7, name: 'viseme_O', label: 'O (oh)' },
  { id: 8, name: 'viseme_U', label: 'U (oo)' }
];

interface SimpleVisemeTesterProps {
  visemeHandler: any;
}

const SimpleVisemeTester: React.FC<SimpleVisemeTesterProps> = ({ visemeHandler }) => {
  const [currentViseme, setCurrentViseme] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  // Test an individual viseme
  const testViseme = (visemeId: number) => {
    if (!visemeHandler) {
      console.error('No viseme handler available');
      return;
    }
    
    visemeHandler.testViseme(visemeId);
    
    // Update UI state
    const viseme = OCULUS_VISEMES.find(v => v.id === visemeId);
    setCurrentViseme(viseme?.name || '');
  };

  // Test all visemes in sequence
  const testAllVisemes = () => {
    if (!visemeHandler) {
      console.error('No viseme handler available');
      return;
    }
    
    setIsPlaying(true);
    
    // Calculate total play time to know when to finish
    const delay = 500; // ms between visemes
    const totalTime = OCULUS_VISEMES.length * delay + 100;
    
    visemeHandler.testAllVisemes(delay);
    
    // Reset playing state after complete
    setTimeout(() => {
      setIsPlaying(false);
    }, totalTime);
  };

  // Reset to silence
  const resetToSilence = () => {
    if (!visemeHandler) return;
    
    visemeHandler.resetToSilence();
    setCurrentViseme('viseme_sil');
  };

  if (!visemeHandler) {
    return (
      <div style={{ padding: '10px', backgroundColor: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '4px' }}>
        <p>No viseme handler available. Make sure the avatar is loaded and has viseme capabilities.</p>
      </div>
    );
  }

  return (
    <div style={{ 
      backgroundColor: '#f5f5f5', 
      border: '1px solid #ddd', 
      borderRadius: '8px',
      padding: '12px',
      width: '300px',
      fontSize: '14px'
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Simple Viseme Tester</h3>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span>Current: <strong>{currentViseme || 'None'}</strong></span>
        <button 
          onClick={resetToSilence}
          style={{
            padding: '4px 8px',
            backgroundColor: '#757575',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reset
        </button>
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '8px',
        marginBottom: '16px'
      }}>
        {OCULUS_VISEMES.map(viseme => (
          <button
            key={viseme.id}
            onClick={() => testViseme(viseme.id)}
            style={{
              padding: '8px 4px',
              backgroundColor: currentViseme === viseme.name ? '#4caf50' : '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
            title={viseme.name}
          >
            {viseme.label}
          </button>
        ))}
      </div>
      
      <button
        onClick={testAllVisemes}
        disabled={isPlaying}
        style={{
          padding: '8px 16px',
          backgroundColor: isPlaying ? '#bdbdbd' : '#ff9800',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          width: '100%',
          fontSize: '14px',
          cursor: isPlaying ? 'not-allowed' : 'pointer'
        }}
      >
        {isPlaying ? 'Testing Visemes...' : 'Test All Visemes'}
      </button>
      
      <div style={{ marginTop: '12px', fontSize: '12px', color: '#757575' }}>
        <p style={{ margin: '0' }}>Note: Testing visemes will return to silence state after a short delay.</p>
      </div>
    </div>
  );
};

export default SimpleVisemeTester;