// CatapultSimulator.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw, Target } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Import p5 with no SSR to avoid window is not defined errors
const Sketch = dynamic(() => import('react-p5').then((mod) => mod.default), {
  ssr: false,
});

const CatapultSimulator = () => {
  // Game state
  const [force, setForce] = useState(100);
  const [angle, setAngle] = useState(45);
  const [mass, setMass] = useState(2);
  const [drag, setDrag] = useState(0.01);
  const [gravity, setGravity] = useState(9.8);
  const [difficulty, setDifficulty] = useState(1);
  const [score, setScore] = useState(0);
  const [isLaunched, setIsLaunched] = useState(false);
  const [resultText, setResultText] = useState('Adjust your settings and click Launch to start!');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [analytics, setAnalytics] = useState({
    initialVelocity: 0,
    distanceTraveled: 0,
    maxHeight: 0,
    flightTime: 0
  });

  // Refs for values that don't need to trigger re-renders
  const gameStateRef = useRef({
    projectilePosition: null,
    projectileVelocity: null,
    catapultPosition: { x: 15, y: 0 },
    targetPosition: null,
    targetSize: 30,
    trajectory: [],
    timeElapsed: 0,
    maxHeight: 0,
    flightTime: 0,
    distanceTraveled: 0
  });

  // p5 sketch setup
  const setup = (p5, canvasParentRef) => {
    p5.createCanvas(1000, 500).parent(canvasParentRef);
    createRandomTarget(p5);
  };

  // p5 sketch draw function
  const draw = (p5) => {
    const gameState = gameStateRef.current;
    const canvasWidth = p5.width;
    const canvasHeight = p5.height;
    const groundY = canvasHeight - 50;
    const SCALE = 10; // pixels per meter
    
    // Clear canvas
    p5.background('#f1f5f9'); // Slate-100 background
    
    // Draw ground
    p5.fill('#84cc16'); // Lime-500
    p5.noStroke();
    p5.rect(0, groundY, canvasWidth, 50);
    
    // Draw distance markings
    drawDistanceMarkings(p5, groundY, SCALE);
    
    // Draw trajectory
    if (gameState.trajectory.length > 1) {
      p5.stroke('rgba(59, 130, 246, 0.3)'); // Blue-500 with opacity
      p5.strokeWeight(2);
      p5.noFill();
      p5.beginShape();
      for (const point of gameState.trajectory) {
        p5.vertex(point.x * SCALE, groundY - point.y * SCALE);
      }
      p5.endShape();
    }
    
    // Draw catapult
    drawCatapult(p5, groundY, SCALE, isLaunched, angle);
    
    // Draw target
    if (gameState.targetPosition) {
      const targetX = gameState.targetPosition.x * SCALE;
      const targetY = groundY - gameState.targetSize / 2;
      const targetWidth = gameState.targetSize;
      
      // Draw target base
      p5.fill('#78716c'); // Stone-500
      p5.rect(targetX - targetWidth/2, groundY - 5, targetWidth, 5);
      
      // Draw target
      p5.fill('#ef4444'); // Red-500
      p5.arc(targetX, targetY, targetWidth, targetWidth, p5.PI, 0, p5.CHORD);
      
      // Draw target rings
      p5.stroke('white');
      p5.strokeWeight(2);
      p5.noFill();
      p5.arc(targetX, targetY, targetWidth * 0.7, targetWidth * 0.7, p5.PI, 0, p5.CHORD);
      p5.arc(targetX, targetY, targetWidth * 0.4, targetWidth * 0.4, p5.PI, 0, p5.CHORD);
      
      // Draw distance label
      p5.fill('#1e293b'); // Slate-800
      p5.noStroke();
      p5.textAlign(p5.CENTER);
      p5.textSize(14);
      p5.text(`${gameState.targetPosition.x.toFixed(1)}m`, targetX, groundY + 20);
    }
    
    // Draw projectile
    if (gameState.projectilePosition && gameState.projectilePosition.y >= 0) {
      const projectileX = gameState.projectilePosition.x * SCALE;
      const projectileY = groundY - gameState.projectilePosition.y * SCALE;
      const projectileRadius = 5 + mass; // Size based on mass
      
      p5.fill('#f97316'); // Orange-500
      p5.noStroke();
      p5.circle(projectileX, projectileY, projectileRadius * 2);
    }
    
    // Draw angle indicator if not launched
    if (!isLaunched) {
      const startX = gameState.catapultPosition.x * SCALE;
      const startY = groundY - 5;
      const angleInRadians = angle * p5.PI / 180;
      const lineLength = 50;
      const endX = startX + p5.cos(angleInRadians) * lineLength;
      const endY = startY - p5.sin(angleInRadians) * lineLength;
      
      p5.stroke('rgba(249, 115, 22, 0.7)'); // Orange-500 with opacity
      p5.strokeWeight(2);
      p5.drawingContext.setLineDash([5, 3]);
      p5.line(startX, startY, endX, endY);
      p5.drawingContext.setLineDash([]);
    }
    
    // Update projectile position if launched
    if (isLaunched && gameState.projectilePosition && gameState.projectilePosition.y >= 0) {
      updateProjectile();
    }
  };

  // Create a random target position based on difficulty
  const createRandomTarget = (p5) => {
    // Target distance based on difficulty
    const minDistance = 40 * difficulty;
    const maxDistance = 70 * difficulty;
    
    const targetX = minDistance + Math.random() * (maxDistance - minDistance);
    const targetY = 0; // On the ground
    
    gameStateRef.current.targetPosition = { x: targetX, y: targetY };
    
    // Adjust target size based on difficulty (smaller for higher difficulty)
    gameStateRef.current.targetSize = 40 - (difficulty * 10);
  };

  // Draw the catapult
  const drawCatapult = (p5, groundY, SCALE, isLaunched, angle) => {
    const catapultX = gameStateRef.current.catapultPosition.x * SCALE;
    const catapultY = groundY;
    
    // Draw base
    p5.fill('#7c3aed'); // Violet-600
    p5.rect(catapultX - 15, catapultY - 5, 30, 5);
    
    // Draw arm
    p5.push();
    p5.translate(catapultX, catapultY - 5);
    
    // If launched, draw arm at rest position, otherwise at the set angle
    if (isLaunched) {
      p5.rotate(-p5.PI / 4); // Rest position
    } else {
      p5.rotate(-angle * p5.PI / 180);
    }
    
    p5.rect(-3, 0, 6, -20);
    p5.pop();
    
    // Draw cup at the end of the arm
    if (!isLaunched) {
      const angleInRadians = angle * p5.PI / 180;
      const cupX = catapultX + p5.cos(angleInRadians) * -20;
      const cupY = (catapultY - 5) - p5.sin(angleInRadians) * 20;
      
      p5.fill('#7c3aed'); // Violet-600
      p5.circle(cupX, cupY, 10);
    }
  };
  
  // Draw distance markings on ground
  const drawDistanceMarkings = (p5, groundY, SCALE) => {
    p5.fill('#1e293b'); // Slate-800
    p5.textSize(12);
    p5.textAlign(p5.CENTER);
    
    for (let i = 10; i <= 150; i += 10) {
      const x = i * SCALE;
      
      // Draw tick
      p5.stroke('rgba(30, 41, 59, 0.3)'); // Slate-800 with opacity
      p5.strokeWeight(1);
      p5.line(x, groundY, x, groundY + 10);
      
      // Draw label every 20m
      if (i % 20 === 0) {
        p5.noStroke();
        p5.text(`${i}m`, x, groundY + 25);
        
        // Draw vertical grid line
        p5.stroke('rgba(30, 41, 59, 0.1)'); // Slate-800 with opacity
        p5.drawingContext.setLineDash([5, 5]);
        p5.line(x, groundY, x, 0);
        p5.drawingContext.setLineDash([]);
      }
    }
  };

  // Launch the projectile
  const launchProjectile = () => {
    const gameState = gameStateRef.current;
    
    // Calculate initial velocity from force and mass
    const initialSpeed = Math.sqrt(2 * force / mass);
    
    // Convert angle to radians
    const angleRad = angle * Math.PI / 180;
    
    // Set initial position and velocity
    gameState.projectilePosition = {
      x: gameState.catapultPosition.x,
      y: gameState.catapultPosition.y + 2 // Slightly above ground to account for catapult height
    };
    
    gameState.projectileVelocity = {
      x: initialSpeed * Math.cos(angleRad),
      y: initialSpeed * Math.sin(angleRad)
    };
    
    // Clear trajectory
    gameState.trajectory = [];
    gameState.trajectory.push({...gameState.projectilePosition});
    
    // Reset analytics
    gameState.timeElapsed = 0;
    gameState.maxHeight = 0;
    gameState.distanceTraveled = 0;
    
    // Update UI with initial velocity
    setAnalytics(prev => ({
      ...prev,
      initialVelocity: initialSpeed.toFixed(2)
    }));
    
    // Start animation
    setIsLaunched(true);
  };

  // Update projectile position with physics
  const updateProjectile = () => {
    const gameState = gameStateRef.current;
    
    // Small time step for physics calculation
    const dt = 0.1; // 100ms
    
    // Current velocity magnitude
    const vMag = Math.sqrt(
      gameState.projectileVelocity.x * gameState.projectileVelocity.x + 
      gameState.projectileVelocity.y * gameState.projectileVelocity.y
    );
    
    // Air resistance force
    const dragForceX = drag * vMag * gameState.projectileVelocity.x;
    const dragForceY = drag * vMag * gameState.projectileVelocity.y;
    
    // Update velocity with gravity and air resistance
    gameState.projectileVelocity.x -= (dragForceX / mass) * dt;
    gameState.projectileVelocity.y -= (gravity + (dragForceY / mass)) * dt;
    
    // Update position
    gameState.projectilePosition.x += gameState.projectileVelocity.x * dt;
    gameState.projectilePosition.y += gameState.projectileVelocity.y * dt;
    
    // Track trajectory
    if (gameState.projectilePosition.y >= 0) {
      gameState.trajectory.push({...gameState.projectilePosition});
      
      // Update maximum height
      if (gameState.projectilePosition.y > gameState.maxHeight) {
        gameState.maxHeight = gameState.projectilePosition.y;
      }
      
      // Update time elapsed
      gameState.timeElapsed += dt;
      gameState.flightTime = gameState.timeElapsed;
      
      // Update distance when projectile lands
      if (gameState.projectilePosition.y <= 0 && gameState.projectileVelocity.y < 0) {
        gameState.distanceTraveled = gameState.projectilePosition.x;
        
        // Check if projectile hit the target
        checkResults();
      }
    }
    
    // Update UI during flight
    setAnalytics({
      initialVelocity: analytics.initialVelocity,
      distanceTraveled: gameState.distanceTraveled.toFixed(1),
      maxHeight: gameState.maxHeight.toFixed(1),
      flightTime: gameState.flightTime.toFixed(1)
    });
  };
  
  // Check if projectile hit the target
  const checkResults = () => {
    const gameState = gameStateRef.current;
    
    // Calculate distance from target center
    const targetCenter = {
      x: gameState.targetPosition.x,
      y: gameState.targetPosition.y + gameState.targetSize / 2
    };
    
    const landingPointX = gameState.projectilePosition.x;
    const distance = Math.abs(landingPointX - targetCenter.x);
    
    // Determine hit based on target size and distance
    const maxHitDistance = gameState.targetSize / 2;
    
    let newScore = score;
    let resultMessage = '';
    
    if (distance <= maxHitDistance * 0.3) {
      // Bull's eye
      resultMessage = "Perfect hit! Bull's eye!";
      newScore += 100 * difficulty;
    } else if (distance <= maxHitDistance) {
      // Regular hit
      resultMessage = "Good shot! You hit the target!";
      newScore += 50 * difficulty;
    } else {
      // Miss - calculate how close they were
      const missDistance = (distance - maxHitDistance).toFixed(1);
      if (landingPointX < targetCenter.x) {
        resultMessage = `Missed! ${missDistance}m short of the target.`;
      } else {
        resultMessage = `Missed! ${missDistance}m past the target.`;
      }
    }
    
    setResultText(resultMessage);
    setScore(newScore);
  };
  
  // Reset the game
  const resetGame = () => {
    const gameState = gameStateRef.current;
    
    // Reset projectile state
    gameState.projectilePosition = null;
    gameState.projectileVelocity = null;
    gameState.trajectory = [];
    
    // Create a new target with current p5 instance
    if (typeof window !== 'undefined') {
      createRandomTarget();
    }
    
    // Reset UI elements
    setIsLaunched(false);
    setResultText("Adjust your settings and click Launch to start!");
    setAnalytics({
      initialVelocity: 0,
      distanceTraveled: 0,
      maxHeight: 0,
      flightTime: 0
    });
  };

  // Slider labels for each difficulty level
  const difficultyLabels = {
    1: "Easy",
    2: "Medium",
    3: "Hard"
  };

  // Format slider label with unit
  const formatLabel = (value, unit) => {
    return `${value} ${unit}`;
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-3xl font-bold text-center text-slate-800">Catapult Physics Simulator</CardTitle>
        <CardDescription className="text-center">Adjust parameters and launch your projectile to hit targets</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Canvas Container */}
        <div className="canvas-container w-full h-[500px] border border-slate-200 rounded-md overflow-hidden bg-slate-50 relative">
          <Sketch setup={setup} draw={draw} />
        </div>
        
        {/* Main Controls */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Launch Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Launch Force */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Launch Force
                  </label>
                  <span className="text-sm text-slate-500 tabular-nums">{formatLabel(force, "N")}</span>
                </div>
                <Slider
                  value={[force]}
                  min={10}
                  max={300}
                  step={1}
                  onValueChange={(vals) => setForce(vals[0])}
                />
              </div>
              
              {/* Launch Angle */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Launch Angle
                  </label>
                  <span className="text-sm text-slate-500 tabular-nums">{formatLabel(angle, "°")}</span>
                </div>
                <Slider
                  value={[angle]}
                  min={10}
                  max={80}
                  step={1}
                  onValueChange={(vals) => setAngle(vals[0])}
                />
              </div>
              
              {/* Projectile Mass */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Projectile Mass
                  </label>
                  <span className="text-sm text-slate-500 tabular-nums">{formatLabel(mass.toFixed(1), "kg")}</span>
                </div>
                <Slider
                  value={[mass]}
                  min={1}
                  max={10}
                  step={0.1}
                  onValueChange={(vals) => setMass(vals[0])}
                />
              </div>
              
              {/* Difficulty */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Difficulty
                  </label>
                  <span className="text-sm text-slate-500 tabular-nums">{difficultyLabels[difficulty]}</span>
                </div>
                <Slider
                  value={[difficulty]}
                  min={1}
                  max={3}
                  step={1}
                  onValueChange={(vals) => {
                    setDifficulty(vals[0]);
                    resetGame();
                  }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-2">
                <Button 
                  onClick={launchProjectile} 
                  disabled={isLaunched}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  <Target className="w-4 h-4 mr-2" />
                  Launch!
                </Button>
                <Button 
                  onClick={resetGame}
                  variant="outline"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="text-slate-500"
              >
                Advanced Settings
                {isAdvancedOpen ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Advanced Settings */}
        <Collapsible
          open={isAdvancedOpen}
          onOpenChange={setIsAdvancedOpen}
          className="border border-slate-200 rounded-md"
        >
          <CollapsibleContent className="px-4 py-4 space-y-4">
            <h3 className="font-medium text-sm text-slate-500">Advanced Physics Parameters</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Gravity */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Gravity
                  </label>
                  <span className="text-sm text-slate-500 tabular-nums">{formatLabel(gravity.toFixed(1), "m/s²")}</span>
                </div>
                <Slider
                  value={[gravity]}
                  min={1}
                  max={20}
                  step={0.1}
                  onValueChange={(vals) => setGravity(vals[0])}
                />
              </div>
              
              {/* Air Resistance */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Air Resistance
                  </label>
                  <span className="text-sm text-slate-500 tabular-nums">{drag.toFixed(3)}</span>
                </div>
                <Slider
                  value={[drag]}
                  min={0}
                  max={0.05}
                  step={0.001}
                  onValueChange={(vals) => setDrag(vals[0])}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
        
        {/* Results */}
        <Card className="bg-slate-50 border-l-4 border-violet-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Launch Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-center text-slate-600 italic">{resultText}</p>
            <div className="text-center">
              <Badge variant="secondary" className="text-lg py-1 px-3">Score: {score}</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-2 rounded border border-slate-200 text-sm">
                <div className="text-slate-500 mb-1">Initial Velocity</div>
                <div className="font-mono">{analytics.initialVelocity} m/s</div>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200 text-sm">
                <div className="text-slate-500 mb-1">Distance</div>
                <div className="font-mono">{analytics.distanceTraveled} m</div>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200 text-sm">
                <div className="text-slate-500 mb-1">Max Height</div>
                <div className="font-mono">{analytics.maxHeight} m</div>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200 text-sm">
                <div className="text-slate-500 mb-1">Flight Time</div>
                <div className="font-mono">{analytics.flightTime} s</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Physics Info */}
        <Card className="bg-violet-50 border-l-4 border-violet-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-violet-700">Physics Behind the Simulation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs defaultValue="formulas" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="formulas">Key Formulas</TabsTrigger>
                <TabsTrigger value="calculator">Trajectory Calculator</TabsTrigger>
              </TabsList>
              
              <TabsContent value="formulas" className="space-y-3 pt-3">
                <p className="text-sm">This simulation models projectile motion with air resistance. The key equations used are:</p>
                <div className="space-y-2">
                  <div className="font-mono bg-white p-2 rounded border border-slate-200 text-sm">Initial Velocity = √(2 × Force / Mass)</div>
                  <div className="font-mono bg-white p-2 rounded border border-slate-200 text-sm">Horizontal Position: x = v₀ × cos(θ) × t - 0.5 × C × v² × cos(θ) × t²</div>
                  <div className="font-mono bg-white p-2 rounded border border-slate-200 text-sm">Vertical Position: y = v₀ × sin(θ) × t - 0.5 × g × t² - 0.5 × C × v² × sin(θ) × t²</div>
                </div>
                <div className="space-y-1 text-sm">
                  <p>Where:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>v₀ = initial velocity</li>
                    <li>θ = launch angle</li>
                    <li>g = gravitational acceleration</li>
                    <li>t = time</li>
                    <li>C = drag coefficient</li>
                    <li>v = velocity at time t</li>
                  </ul>
                </div>
              </TabsContent>
              
              <TabsContent value="calculator" className="space-y-4 pt-3">
                <div className="flex items-center gap-2 text-slate-700">
                  <AlertCircle className="h-5 w-5 text-violet-600" />
                  <p className="text-sm">See how your current settings affect the theoretical trajectory before launching.</p>
                </div>
                
                <div className="bg-white p-4 rounded-md border border-slate-200">
                  <h4 className="font-medium text-sm mb-3">Calculated Values</h4>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                      <div className="text-xs text-slate-500 mb-1">Initial Velocity</div>
                      <div className="font-mono text-sm font-medium">
                        {Math.sqrt(2 * force / mass).toFixed(2)} m/s
                      </div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                      <div className="text-xs text-slate-500 mb-1">Theoretical Range (No Drag)</div>
                      <div className="font-mono text-sm font-medium">
                        {(() => {
                          const v0 = Math.sqrt(2 * force / mass);
                          const angleRad = angle * Math.PI / 180;
                          return ((v0 * v0 * Math.sin(2 * angleRad)) / gravity).toFixed(2);
                        })()} m
                      </div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                      <div className="text-xs text-slate-500 mb-1">Max Height (No Drag)</div>
                      <div className="font-mono text-sm font-medium">
                        {(() => {
                          const v0 = Math.sqrt(2 * force / mass);
                          const angleRad = angle * Math.PI / 180;
                          return ((v0 * v0 * Math.sin(angleRad) * Math.sin(angleRad)) / (2 * gravity)).toFixed(2);
                        })()} m
                      </div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                      <div className="text-xs text-slate-500 mb-1">Estimated Flight Time</div>
                      <div className="font-mono text-sm font-medium">
                        {(() => {
                          const v0 = Math.sqrt(2 * force / mass);
                          const angleRad = angle * Math.PI / 180;
                          return ((2 * v0 * Math.sin(angleRad)) / gravity).toFixed(2);
                        })()} s
                      </div>
                    </div>
                  </div>
                  
                  {/* Miniature Trajectory Preview */}
                  <div className="relative h-40 bg-slate-50 rounded border border-slate-200 p-2 overflow-hidden">
                    <div className="text-xs text-slate-500 absolute top-2 left-2">Theoretical Trajectory Preview</div>
                    
                    {/* Simplified React-based trajectory plot */}
                    <div className="w-full h-full relative">
                      {(() => {
                        // Calculate trajectory points
                        const points = [];
                        const v0 = Math.sqrt(2 * force / mass);
                        const angleRad = angle * Math.PI / 180;
                        const timeOfFlight = (2 * v0 * Math.sin(angleRad)) / gravity;
                        const range = (v0 * v0 * Math.sin(2 * angleRad)) / gravity;
                        const maxHeight = (v0 * v0 * Math.sin(angleRad) * Math.sin(angleRad)) / (2 * gravity);
                        
                        // Calculate ideal trajectory curve
                        for (let i = 0; i <= 20; i++) {
                          const t = (i / 20) * timeOfFlight;
                          const x = v0 * Math.cos(angleRad) * t;
                          const y = v0 * Math.sin(angleRad) * t - 0.5 * gravity * t * t;
                          if (y >= 0) {
                            points.push({ x, y });
                          }
                        }
                        
                        // Scale factors for plotting
                        const xMax = range * 1.1; // Add 10% margin
                        const yMax = maxHeight * 1.2; // Add 20% margin
                        const width = 100; // Percentage width
                        const height = 100; // Percentage height
                        
                        // Plot the trajectory
                        return (
                          <>
                            {/* X-axis */}
                            <div className="absolute bottom-0 left-0 right-0 h-px bg-slate-300"></div>
                            
                            {/* Y-axis */}
                            <div className="absolute bottom-0 left-0 top-0 w-px bg-slate-300"></div>
                            
                            {/* Target zone indicator */}
                            <div 
                              className="absolute bottom-0 w-1 h-6 bg-red-500"
                              style={{ 
                                left: `${Math.min(100, (difficulty * 55) / xMax * 100)}%`,
                              }}
                            ></div>
                            
                            {/* Trajectory curve */}
                            <svg className="absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                              <path 
                                d={points.map((p, i) => 
                                  `${i === 0 ? 'M' : 'L'} ${p.x / xMax * width} ${height - p.y / yMax * height}`
                                ).join(' ')}
                                fill="none"
                                stroke="rgba(124, 58, 237, 0.8)"
                                strokeWidth="2"
                                strokeDasharray="3,2"
                              />
                            </svg>
                            
                            {/* Projectile */}
                            <div 
                              className="absolute w-2 h-2 rounded-full bg-orange-500"
                              style={{ 
                                left: `${0}%`,
                                bottom: `${0}%`,
                              }}
                            ></div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <div className="mt-3 text-xs text-slate-500">
                    <p>Note: The actual trajectory will be affected by air resistance (drag), which can significantly reduce distance and maximum height.</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};

export default CatapultSimulator;