'use client';

import React, { useEffect, useState } from 'react';
import SimulationCanvas from './SimulationCanvas';

function KonvaContainer(props) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div style={{ width: props.containerWidth, height: props.containerHeight, backgroundColor: '#f0f0f0', border: '2px solid black' }}>
      <p style={{ textAlign: 'center', paddingTop: '120px' }}>Loading simulation...</p>
    </div>;
  }

  return <SimulationCanvas {...props} />;
}

export default KonvaContainer;