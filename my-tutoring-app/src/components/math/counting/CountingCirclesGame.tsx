// components/games/counting/CountingCirclesGame.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import p5 from 'p5';

interface CountingCirclesGameProps {
  className?: string;
}

const CountingCirclesGame: React.FC<CountingCirclesGameProps> = ({ className }) => {
  const sketchRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<p5 | null>(null);

  // On component mount, create the p5 sketch
  useEffect(() => {
    // Only create p5 instance once and when the ref is available
    if (!sketchRef.current || p5InstanceRef.current) return;

    // Define the p5 sketch
    const sketch = (p: p5) => {
      // --- Difficulty Settings ---
      const difficultySettings = {
        Beginner: { min: 1, max: 5, circleSize: 60, buttonSize: 75, buttonSpacing: 25 },
        Intermediate: { min: 3, max: 8, circleSize: 55, buttonSize: 70, buttonSpacing: 20 },
        Advanced: { min: 5, max: 12, circleSize: 50, buttonSize: 65, buttonSpacing: 15 },
      };
      let currentDifficulty = 'Beginner'; // Default difficulty
      let MIN_CIRCLES = difficultySettings[currentDifficulty].min;
      let MAX_CIRCLES = difficultySettings[currentDifficulty].max;
      let CIRCLE_DIAMETER = difficultySettings[currentDifficulty].circleSize;
      let BUTTON_WIDTH = difficultySettings[currentDifficulty].buttonSize;
      let BUTTON_HEIGHT = difficultySettings[currentDifficulty].buttonSize;
      let BUTTON_SPACING = difficultySettings[currentDifficulty].buttonSpacing;

      let targetCount; // The correct number of circles to count
      let circlePositions = []; // Stores {x, y, noiseOffsetX, noiseOffsetY}
      let numberButtons = []; // Stores number button properties {label, x, y, w, h}
      let difficultyButtons = []; // Stores difficulty button properties {label, x, y, w, h}
      let feedback = ""; // Feedback message ("Correct!", "Try Again!")
      let feedbackColor = [0, 0, 100]; // Color for feedback text
      let showFeedbackUntil = 0; // Timestamp until feedback should be hidden
      let feedbackScale = 0; // For animating feedback text size (0 to 1)
      let lastClickTime = 0; // Track time of last click for button animation
      let clickedButtonIndex = -1; // Index of the number button just clicked
      let timeoutId = null; // Store timeout ID for cleanup

      // --- Style Variables ---
      const BG_HUE = 210;
      const CIRCLE_HUE = 55;
      const BUTTON_HUE = 180; // Number buttons
      const DIFF_BUTTON_HUE = 280; // Difficulty buttons (purple-ish)
      const CORRECT_HUE = 120;
      const WRONG_HUE = 0;
      const FONT_FAMILY = 'Arial';
      const ABSOLUTE_MAX_CIRCLES = 12; // Max needed for pre-allocation

      p.setup = () => {
        // Get the parent container's width, use a fixed height for the game
        const parentWidth = sketchRef.current?.clientWidth || window.innerWidth;
        const parentHeight = 600; // Fixed height
        p.createCanvas(parentWidth, parentHeight);
        p.colorMode(p.HSB, 360, 100, 100, 100);
        p.textFont(FONT_FAMILY);
        p.textAlign(p.CENTER, p.CENTER);

        // Pre-allocate circle position objects based on the absolute maximum
        for (let i = 0; i < ABSOLUTE_MAX_CIRCLES; i++) {
          circlePositions.push({ 
            x: 0, 
            y: 0, 
            noiseOffsetX: p.random(1000), 
            noiseOffsetY: p.random(1000) 
          });
        }

        createDifficultyButtons();
        setupDifficulty(currentDifficulty); // Initialize with default difficulty
      };

      p.draw = () => {
        drawGradientBackground();

        // Draw Difficulty Buttons first
        drawDifficultyButtons();

        // Instruction text - adjusted Y position
        p.fill(0, 0, 20);
        p.noStroke();
        p.textSize(34);
        p.textStyle(p.NORMAL);
        p.text("How many yellow circles?", p.width / 2, 100); // Moved down slightly

        drawCircles();
        drawNumberButtons(); // Renamed from drawButtons

        // Draw feedback (animated)
        if (p.millis() < showFeedbackUntil) {
          feedbackScale = p.lerp(feedbackScale, 1, 0.15);
          p.push();
          p.translate(p.width / 2, p.height / 2 + 80); // Adjusted Y position
          p.scale(feedbackScale);
          p.fill(feedbackColor[0], feedbackColor[1], feedbackColor[2], p.map(feedbackScale, 0, 1, 0, 100));
          p.textSize(52);
          p.textStyle(p.BOLD);
          p.text(feedback, 0, 0);
          p.pop();
          p.textStyle(p.NORMAL);
        } else {
          feedbackScale = 0;
        }
      };

      // --- Setup and State Management ---
      function setupDifficulty(level) {
        console.log("Setting difficulty to:", level);
        currentDifficulty = level;
        const settings = difficultySettings[level];
        MIN_CIRCLES = settings.min;
        MAX_CIRCLES = settings.max;
        CIRCLE_DIAMETER = settings.circleSize;
        BUTTON_WIDTH = settings.buttonSize;
        BUTTON_HEIGHT = settings.buttonSize;
        BUTTON_SPACING = settings.buttonSpacing;

        createNumberButtons(); // Recreate buttons for the new range/size
        generateQuestion(); // Generate a question with the new range
        feedback = ""; // Clear feedback
        showFeedbackUntil = 0;
        feedbackScale = 0;
        clickedButtonIndex = -1;
      }

      function createDifficultyButtons() {
        difficultyButtons = [];
        const levels = Object.keys(difficultySettings); // ["Beginner", "Intermediate", "Advanced"]
        const btnW = 150;
        const btnH = 45;
        const spacing = 20;
        const totalWidth = levels.length * btnW + (levels.length - 1) * spacing;
        let startX = (p.width - totalWidth) / 2;
        const btnY = 20; // Position near the top

        levels.forEach((level, index) => {
          difficultyButtons.push({
            label: level,
            x: startX + index * (btnW + spacing),
            y: btnY,
            w: btnW,
            h: btnH
          });
        });
      }


      function createNumberButtons() {
        numberButtons = [];
        // Calculate total width needed based on MAX_CIRCLES for the current difficulty
        const numButtons = MAX_CIRCLES; // We need buttons up to the max possible count
        let totalButtonWidth = numButtons * BUTTON_WIDTH + (numButtons - 1) * BUTTON_SPACING;
        let startX = (p.width - totalButtonWidth) / 2;
        let buttonY = p.height - BUTTON_HEIGHT - 40; // Position near the bottom, adjust based on size

        for (let i = 1; i <= numButtons; i++) {
          numberButtons.push({
            label: i,
            x: startX + (i - 1) * (BUTTON_WIDTH + BUTTON_SPACING),
            y: buttonY,
            w: BUTTON_WIDTH,
            h: BUTTON_HEIGHT
          });
        }
      }


      // --- Drawing Functions ---
      function drawGradientBackground() {
        for (let y = 0; y < p.height; y++) {
          let inter = p.map(y, 0, p.height, 0, 1);
          let bgColor = p.color(BG_HUE, p.lerp(30, 50, inter), p.lerp(98, 90, inter));
          p.stroke(bgColor);
          p.line(0, y, p.width, y);
        }
        p.noStroke();
      }

      function drawDifficultyButtons() {
        p.textSize(20);
        p.textStyle(p.BOLD);
        let mouseOverDiffButton = false;

        for (let btn of difficultyButtons) {
          let isCurrent = btn.label === currentDifficulty;
          let isHover = (p.mouseX > btn.x && p.mouseX < btn.x + btn.w &&
                        p.mouseY > btn.y && p.mouseY < btn.y + btn.h);

          if(isHover) mouseOverDiffButton = true;

          // Styling: Highlight current, different hover
          let btnFillHue = DIFF_BUTTON_HUE;
          let btnFillSat = isCurrent ? 80 : (isHover ? 65 : 55);
          let btnFillBri = isCurrent ? 90 : (isHover ? 95 : 85);
          let btnStrokeHue = DIFF_BUTTON_HUE;
          let btnStrokeSat = 90;
          let btnStrokeBri = isCurrent ? 60 : 75;
          let btnStrokeWeight = isCurrent ? 3 : 2;

          p.fill(btnFillHue, btnFillSat, btnFillBri);
          p.stroke(btnStrokeHue, btnStrokeSat, btnStrokeBri);
          p.strokeWeight(btnStrokeWeight);
          p.rect(btn.x, btn.y, btn.w, btn.h, 8); // Slightly rounded corners

          p.fill(0, 0, 100); // White text
          p.noStroke();
          p.text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
        }
        p.textStyle(p.NORMAL); // Reset
        if(mouseOverDiffButton) p.cursor(p.HAND); // Show hand cursor over difficulty buttons
      }


      function drawCircles() {
        const wobbleSpeed = 0.01;
        const wobbleAmount = 3;

        p.fill(CIRCLE_HUE, 85, 100);
        p.stroke(CIRCLE_HUE, 100, 80);
        p.strokeWeight(p.map(CIRCLE_DIAMETER, 50, 60, 3, 4)); // Scale stroke weight slightly

        // Only draw the target number of circles
        for (let i = 0; i < targetCount; i++) {
          let pos = circlePositions[i];
          let wobbleX = (p.noise(pos.noiseOffsetX + p.frameCount * wobbleSpeed) - 0.5) * 2 * wobbleAmount;
          let wobbleY = (p.noise(pos.noiseOffsetY + p.frameCount * wobbleSpeed) - 0.5) * 2 * wobbleAmount;
          p.ellipse(pos.x + wobbleX, pos.y + wobbleY, CIRCLE_DIAMETER, CIRCLE_DIAMETER);
        }
        p.noStroke();
      }

      function drawNumberButtons() {
        let mouseOverNumButton = false;

        for (let i = 0; i < numberButtons.length; i++) {
          let btn = numberButtons[i];
          let isHover = (p.mouseX > btn.x && p.mouseX < btn.x + btn.w &&
                        p.mouseY > btn.y && p.mouseY < btn.y + btn.h);
          let isClicked = (i === clickedButtonIndex && p.millis() < lastClickTime + 150);

          if (isHover) mouseOverNumButton = true;

          // Use BUTTON_HUE defined globally
          let btnFillHue = BUTTON_HUE;
          let btnFillSat = isHover ? 75 : 65;
          let btnFillBri = isHover ? 95 : 90;
          let btnStrokeHue = BUTTON_HUE;
          let btnStrokeSat = 85;
          let btnStrokeBri = isClicked ? 60 : 70;
          let btnStrokeWeight = isClicked ? 4 : 2;
          let yOffset = isClicked ? 2 : 0;

          p.fill(btnFillHue, btnFillSat, btnFillBri);
          p.stroke(btnStrokeHue, btnStrokeSat, btnStrokeBri);
          p.strokeWeight(btnStrokeWeight);
          p.rect(btn.x, btn.y + yOffset, btn.w, btn.h, 12);

          p.fill(0, 0, 100);
          p.noStroke();
          p.textSize(p.map(BUTTON_WIDTH, 65, 75, 34, 40)); // Scale text size with button size
          p.textStyle(p.BOLD);
          p.text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + yOffset);
          p.textStyle(p.NORMAL);
        }

        // Set cursor only if not over difficulty buttons
        if(mouseOverNumButton && !(p.mouseX < difficultyButtons[difficultyButtons.length-1].x + difficultyButtons[difficultyButtons.length-1].w && p.mouseY < difficultyButtons[0].y + difficultyButtons[0].h)) {
          p.cursor(p.HAND);
        } else if (!mouseOverNumButton && !(p.mouseX < difficultyButtons[difficultyButtons.length-1].x + difficultyButtons[difficultyButtons.length-1].w && p.mouseY < difficultyButtons[0].y + difficultyButtons[0].h)) {
          p.cursor(p.ARROW);
        }
      }

      // --- Logic Functions ---
      function generateQuestion() {
        targetCount = p.floor(p.random(MIN_CIRCLES, MAX_CIRCLES + 1));
        let attempts = 0;
        const maxAttempts = 500; // Increase attempts slightly for denser packing
        let placedCircles = 0;

        const topMargin = 150; // Below instruction/difficulty buttons
        const bottomMargin = p.height - BUTTON_HEIGHT - 80; // Above number buttons

        // Reset positions for circles that might be used
        for(let i=0; i < MAX_CIRCLES; i++) {
          circlePositions[i].x = -1000; // Move unused ones off-screen initially
          circlePositions[i].y = -1000;
        }

        while (placedCircles < targetCount && attempts < maxAttempts) {
          let newPos = {
            x: p.random(CIRCLE_DIAMETER, p.width - CIRCLE_DIAMETER),
            y: p.random(topMargin, bottomMargin)
          };
          let overlapping = false;
          // Only check against circles already placed in *this* round
          for (let j = 0; j < placedCircles; j++) {
            let existingPos = circlePositions[j];
            let d = p.dist(newPos.x, newPos.y, existingPos.x, existingPos.y);
            // Allow slightly closer placement for higher difficulties/smaller circles
            let safeDist = CIRCLE_DIAMETER;
            if (currentDifficulty === 'Beginner') {
              safeDist *= 1.5;
            } else if (currentDifficulty === 'Intermediate') {
              safeDist *= 1.3;
            } else {
              safeDist *= 1.2;
            }
            
            if (d < safeDist) {
              overlapping = true;
              break;
            }
          }
          if (!overlapping) {
            circlePositions[placedCircles].x = newPos.x;
            circlePositions[placedCircles].y = newPos.y;
            placedCircles++;
          }
          attempts++;
        }
        
        if (attempts >= maxAttempts && placedCircles < targetCount) {
          console.warn(`Could only place ${placedCircles}/${targetCount} circles without overlap.`);
          targetCount = placedCircles; // Adjust target if placement failed
          if(targetCount < MIN_CIRCLES && MIN_CIRCLES > 0) { // Handle edge case where placement fails badly
            console.warn("Placement failed significantly, generating new question.");
            generateQuestion(); // Try again immediately
            return;
          }
        }

        feedback = "";
        showFeedbackUntil = 0;
        feedbackScale = 0;
        clickedButtonIndex = -1;
      }

      p.mousePressed = () => {
        // 1. Check Difficulty Buttons First
        for (let btn of difficultyButtons) {
          if (p.mouseX > btn.x && p.mouseX < btn.x + btn.w &&
              p.mouseY > btn.y && p.mouseY < btn.y + btn.h) {
            if (btn.label !== currentDifficulty) { // Only react if changing difficulty
              if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
                timeoutId = null;
              }
              setupDifficulty(btn.label);
            }
            return; // Stop processing click here
          }
        }

        // 2. Check Number Buttons (only if feedback not showing or allowing skip)
        if (p.millis() > showFeedbackUntil || (feedback !== "" && feedbackColor[0] === CORRECT_HUE)) {
          if (p.millis() < showFeedbackUntil && feedbackColor[0] === CORRECT_HUE) {
            if (timeoutId !== null) {
              window.clearTimeout(timeoutId);
              timeoutId = null;
            }
            generateQuestion();
            return;
          }

          if (p.millis() > showFeedbackUntil) {
            for (let i = 0; i < numberButtons.length; i++) {
              let btn = numberButtons[i];
              if (p.mouseX > btn.x && p.mouseX < btn.x + btn.w &&
                  p.mouseY > btn.y && p.mouseY < btn.y + btn.h) {
                clickedButtonIndex = i;
                lastClickTime = p.millis();
                checkAnswer(btn.label);
                break;
              }
            }
          }
        }
      };

      function checkAnswer(clickedNumber) {
        if (clickedNumber === targetCount) {
          feedback = "Correct! 🎉";
          feedbackColor = [CORRECT_HUE, 80, 90];
          showFeedbackUntil = p.millis() + 1800;
          feedbackScale = 0;
          timeoutId = window.setTimeout(generateQuestion, 1800);
        } else {
          feedback = "Try Again!";
          feedbackColor = [WRONG_HUE, 80, 100];
          showFeedbackUntil = p.millis() + 1800;
          feedbackScale = 0;
        }
      }

      p.windowResized = () => {
        if (!sketchRef.current) return;
        
        const parentWidth = sketchRef.current.clientWidth;
        p.resizeCanvas(parentWidth, p.height);
        
        // Recalculate positions for both sets of buttons
        createDifficultyButtons();
        createNumberButtons();
      };
    };

    // Create new p5 instance
    const p5Instance = new p5(sketch, sketchRef.current);
    p5InstanceRef.current = p5Instance;

    // Cleanup on component unmount
    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
        p5InstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={sketchRef} 
      className={`w-full h-[600px] bg-white relative ${className || ''}`}
      style={{ touchAction: 'none' }} // Prevents scrolling on touch devices when interacting with canvas
    />
  );
};

export default CountingCirclesGame;