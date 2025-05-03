


// --- Game Settings ---
const SHAPE_TYPES = ['Circle', 'Square', 'Triangle'];
const MIN_SHAPES_ON_SCREEN = 3;
const MAX_SHAPES_ON_SCREEN = 5;
const BASE_SHAPE_SIZE = 70; // Average size, will vary slightly

let targetShapeType; // The type of shape to find ('Circle', 'Square', 'Triangle')
let shapesOnScreen = []; // Array of shape objects: { type, x, y, size, color, noiseOffsetX, noiseOffsetY }
let feedback = ""; // Feedback message
let feedbackColor = [0, 0, 100]; // Default white
let showFeedbackUntil = 0; // Timestamp for hiding feedback
let feedbackScale = 0; // For animating feedback text

// --- Style Variables ---
const BG_HUE = 150; // Tealish background
const FONT_FAMILY = 'Arial';

// --- Perlin Noise Wobble ---
const wobbleSpeed = 0.008;
const wobbleAmount = 2.5;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100); // HSB with Alpha
  textFont(FONT_FAMILY);
  textAlign(CENTER, CENTER);
  rectMode(CENTER); // Draw rectangles from their center
  generateProblem(); // Create the first shape challenge
}

function draw() {
  drawGradientBackground();

  // 1. Draw Instructions
  fill(0, 0, 15); // Dark text
  noStroke();
  textSize(36);
  textStyle(BOLD);
  text(`Find the ${targetShapeType}!`, width / 2, 70);
  textStyle(NORMAL);

  // 2. Draw the Shapes
  drawShapes();

  // 3. Draw Feedback (animated)
  if (millis() < showFeedbackUntil) {
    feedbackScale = lerp(feedbackScale, 1, 0.15);
    push();
    translate(width / 2, height - 80); // Position feedback near the bottom
    scale(feedbackScale);
    fill(feedbackColor[0], feedbackColor[1], feedbackColor[2], map(feedbackScale, 0, 1, 0, 100));
    textSize(48);
    textStyle(BOLD);
    text(feedback, 0, 0);
    pop();
    textStyle(NORMAL);
  } else {
    feedbackScale = 0; // Reset animation scale
  }

  // Update cursor
   updateCursor();
}

// --- Problem Generation ---

function generateProblem() {
  // 1. Choose a target shape
  targetShapeType = random(SHAPE_TYPES);

  // 2. Determine how many shapes to show
  let numShapes = floor(random(MIN_SHAPES_ON_SCREEN, MAX_SHAPES_ON_SCREEN + 1));
  shapesOnScreen = [];

  // 3. Create shape objects, ensuring the target shape is present
  let targetShapePlaced = false;
  for (let i = 0; i < numShapes; i++) {
    let shapeType;
    // Force the target shape if it hasn't been placed and we're near the end
    if (!targetShapePlaced && i === numShapes - 1) {
      shapeType = targetShapeType;
    } else {
      shapeType = random(SHAPE_TYPES);
    }
    if (shapeType === targetShapeType) {
      targetShapePlaced = true;
    }

    // Add the new shape object (position will be determined later)
    shapesOnScreen.push({
      type: shapeType,
      x: 0, // Placeholder
      y: 0, // Placeholder
      size: random(BASE_SHAPE_SIZE * 0.8, BASE_SHAPE_SIZE * 1.2),
      color: [random(360), random(60, 90), random(80, 100)], // Random vibrant HSB color
      noiseOffsetX: random(1000), // For wobble
      noiseOffsetY: random(1000)
    });
  }
   // Fallback: If target wasn't placed by chance, replace the first shape
   if (!targetShapePlaced && shapesOnScreen.length > 0) {
        shapesOnScreen[0].type = targetShapeType;
        console.log("Forced target shape placement.");
   }


  // 4. Position shapes trying to avoid overlap
  positionShapes();

  // 5. Reset feedback
  feedback = "";
  showFeedbackUntil = 0;
  feedbackScale = 0;
}

function positionShapes() {
    let attempts = 0;
    const maxAttemptsPerShape = 100;
    const topMargin = 120; // Below instructions
    const bottomMargin = height - 150; // Above feedback area

    for (let i = 0; i < shapesOnScreen.length; i++) {
        let placed = false;
        for(let attempt = 0; attempt < maxAttemptsPerShape; attempt++) {
            let shape = shapesOnScreen[i];
            shape.x = random(shape.size, width - shape.size);
            shape.y = random(topMargin, bottomMargin);

            let overlapping = false;
            // Check overlap only with *previously placed* shapes
            for (let j = 0; j < i; j++) {
                let otherShape = shapesOnScreen[j];
                let d = dist(shape.x, shape.y, otherShape.x, otherShape.y);
                // Check distance based on average size (approximation)
                if (d < (shape.size / 2 + otherShape.size / 2) * 1.2) { // 1.2 buffer
                    overlapping = true;
                    break;
                }
            }

            if (!overlapping) {
                placed = true;
                break; // Found a good spot for this shape
            }
        }
        if (!placed) {
            console.warn(`Could not place shape ${i} (${shapesOnScreen[i].type}) without potential overlap.`);
            // Keep the last tried position even if it overlaps slightly
        }
    }
}


// --- Drawing Functions ---

function drawGradientBackground() {
  for (let y = 0; y < height; y++) {
    let inter = map(y, 0, height, 0, 1);
    // Subtle gradient for the tealish background
    let bgColor = color(BG_HUE, lerp(40, 60, inter), lerp(95, 85, inter));
    stroke(bgColor);
    line(0, y, width, y);
  }
  noStroke();
}

function drawShapes() {
  for (let shape of shapesOnScreen) {
    push(); // Isolate transformations and styles for each shape

    // Calculate wobble
    let wobbleX = (noise(shape.noiseOffsetX + frameCount * wobbleSpeed) - 0.5) * 2 * wobbleAmount;
    let wobbleY = (noise(shape.noiseOffsetY + frameCount * wobbleSpeed) - 0.5) * 2 * wobbleAmount;
    translate(shape.x + wobbleX, shape.y + wobbleY);

    fill(shape.color[0], shape.color[1], shape.color[2]);
    stroke(shape.color[0], shape.color[1] + 10, shape.color[2] - 20); // Darker outline
    strokeWeight(3);

    // Draw the specific shape type
    switch (shape.type) {
      case 'Circle':
        ellipse(0, 0, shape.size, shape.size);
        break;
      case 'Square':
        // rectMode is CENTER, so draw at 0,0
        rect(0, 0, shape.size, shape.size, shape.size * 0.1); // Slightly rounded corners
        break;
      case 'Triangle':
        // Equilateral triangle points relative to center (0,0)
        let h = shape.size * (sqrt(3) / 2); // Height of equilateral triangle
        triangle(
          0, -h / 1.5,          // Top point
          -shape.size / 2, h / 2.5, // Bottom left
          shape.size / 2, h / 2.5   // Bottom right
        );
        break;
    }

    pop(); // Restore previous drawing state
  }
  noStroke(); // Reset stroke
}

// --- Interaction ---

function mousePressed() {
   // Only allow clicking if feedback is not actively showing
  if (millis() < showFeedbackUntil) {
      // Optional: Allow clicking again on "Correct" to skip delay
      if (feedbackColor[0] === 120) { // 120 is the Correct Hue
          clearTimeout(); // Cancel pending new problem generation
          generateProblem();
      }
      return; // Don't process shape clicks while feedback is visible
  }


  let shapeClicked = false;
  // Iterate backwards to prioritize shapes drawn on top (visually)
  for (let i = shapesOnScreen.length - 1; i >= 0; i--) {
    let shape = shapesOnScreen[i];
    let clicked = false;

    // Check collision based on shape type
    switch (shape.type) {
      case 'Circle':
        if (dist(mouseX, mouseY, shape.x, shape.y) < shape.size / 2) {
          clicked = true;
        }
        break;
      case 'Square':
         // rectMode is CENTER
        if (mouseX > shape.x - shape.size / 2 && mouseX < shape.x + shape.size / 2 &&
            mouseY > shape.y - shape.size / 2 && mouseY < shape.y + shape.size / 2) {
           clicked = true;
        }
        break;
      case 'Triangle':
         // Use bounding box approximation for triangles for simplicity
         // A more precise point-in-triangle test is possible but more complex
         let h = shape.size * (sqrt(3) / 2);
         if (mouseX > shape.x - shape.size / 2 && mouseX < shape.x + shape.size / 2 &&
             mouseY > shape.y - h / 1.5 && mouseY < shape.y + h / 2.5) {
             // This simple bounding box is okay for non-overlapping shapes
             clicked = true;
         }
        break;
    }

    if (clicked) {
      checkAnswer(shape);
      shapeClicked = true;
      break; // Stop checking once a shape is clicked
    }
  }
}

function checkAnswer(clickedShape) {
  if (clickedShape.type === targetShapeType) {
    feedback = "Correct! 👍";
    feedbackColor = [120, 80, 90]; // Green
    showFeedbackUntil = millis() + 1500; // Show for 1.5 seconds
    feedbackScale = 0; // Reset animation
    setTimeout(generateProblem, 1500); // Load next problem after delay
  } else {
    // Give specific feedback about the wrong shape clicked
    feedback = `That's a ${clickedShape.type}. Try again!`;
    feedbackColor = [30, 90, 100]; // Orange-ish for informative wrong
    showFeedbackUntil = millis() + 2000; // Show feedback longer
    feedbackScale = 0; // Reset animation
    // Don't generate a new problem on wrong answer
  }
}

function updateCursor() {
    let onShape = false;
    if (millis() > showFeedbackUntil) { // Only check hover if no feedback showing
        for (let i = shapesOnScreen.length - 1; i >= 0; i--) {
            let shape = shapesOnScreen[i];
            let hover = false;
             switch (shape.type) {
                case 'Circle':
                    if (dist(mouseX, mouseY, shape.x, shape.y) < shape.size / 2) hover = true;
                    break;
                case 'Square':
                    if (mouseX > shape.x - shape.size / 2 && mouseX < shape.x + shape.size / 2 &&
                        mouseY > shape.y - shape.size / 2 && mouseY < shape.y + shape.size / 2) hover = true;
                    break;
                case 'Triangle':
                     let h = shape.size * (sqrt(3) / 2);
                     if (mouseX > shape.x - shape.size / 2 && mouseX < shape.x + shape.size / 2 &&
                         mouseY > shape.y - h / 1.5 && mouseY < shape.y + h / 2.5) hover = true;
                    break;
            }
            if (hover) {
                onShape = true;
                break;
            }
        }
    }
    cursor(onShape ? HAND : ARROW);
}


function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // Reposition shapes might be good on resize,
  // otherwise they could bunch up or go off-screen
  positionShapes();
}

