// lib/p5jsExamples.ts

/**
 * Interface for P5js example sketches
 */
export interface P5jsExample {
    title: string;
    description: string;
    thumbnail: string; // Type of thumbnail (ball, color, shapes, particles, etc.)
    code: string;
    tags?: string[];
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    conceptDomain?: string;
  }
  
  /**
   * Library of example P5js sketches
   */
  export const EXAMPLE_SKETCHES: P5jsExample[] = [
    {
      title: 'Bouncing Ball',
      description: 'Physics simulation with a simple bouncing ball',
      thumbnail: 'ball',
      difficulty: 'beginner',
      conceptDomain: 'Motion',
      tags: ['physics', 'animation', 'variables'],
      code: `// Bouncing Ball Animation
  let x = 200;
  let y = 100;
  let xSpeed = 4;
  let ySpeed = 3;
  let radius = 30;
  
  function setup() {
    createCanvas(windowWidth, windowHeight);
  }
  
  function draw() {
    background(220);
    
    // Update position
    x = x + xSpeed;
    y = y + ySpeed;
    
    // Check for bouncing
    if (x > width - radius || x < radius) {
      xSpeed = -xSpeed;
    }
    if (y > height - radius || y < radius) {
      ySpeed = -ySpeed;
    }
    
    // Draw the ball
    fill(41, 98, 255);
    noStroke();
    ellipse(x, y, radius * 2, radius * 2);
  }`
    },
    {
      title: 'Color Mixer',
      description: 'Interactive color mixing with mouse position',
      thumbnail: 'color',
      difficulty: 'beginner',
      conceptDomain: 'Color',
      tags: ['interaction', 'color', 'mapping'],
      code: `// Color Mixer
  function setup() {
    createCanvas(windowWidth, windowHeight);
    noStroke();
  }
  
  function draw() {
    background(220);
    
    // Use mouse position to control colors
    let r = map(mouseX, 0, width, 0, 255);
    let g = map(mouseY, 0, height, 0, 255);
    let b = map(mouseX + mouseY, 0, width + height, 255, 0);
    
    // Draw a gradient background
    for (let i = 0; i < width; i += 20) {
      for (let j = 0; j < height; j += 20) {
        let rGrad = map(i, 0, width, 0, r);
        let gGrad = map(j, 0, height, 0, g);
        
        fill(rGrad, gGrad, b, 150);
        rect(i, j, 20, 20);
      }
    }
    
    // Draw center shape
    fill(r, g, b);
    ellipse(width/2, height/2, 200, 200);
    
    // Display RGB values
    fill(255);
    textSize(16);
    text(\`R: \${Math.floor(r)} G: \${Math.floor(g)} B: \${Math.floor(b)}\`, width/2 - 80, height - 50);
  }`
    },
    {
      title: 'Interactive Shapes',
      description: 'Click to create random shapes on canvas',
      thumbnail: 'shapes',
      difficulty: 'intermediate',
      conceptDomain: 'Interactivity',
      tags: ['mouse', 'objects', 'arrays'],
      code: `// Interactive Shapes
  let shapes = [];
  
  function setup() {
    createCanvas(windowWidth, windowHeight);
  }
  
  function draw() {
    background(220);
    
    // Draw all shapes
    for (let shape of shapes) {
      fill(shape.color);
      noStroke();
      
      if (shape.type === 'circle') {
        ellipse(shape.x, shape.y, shape.size, shape.size);
      } else if (shape.type === 'square') {
        rectMode(CENTER);
        rect(shape.x, shape.y, shape.size, shape.size);
      } else if (shape.type === 'triangle') {
        triangle(
          shape.x, shape.y - shape.size/2,
          shape.x - shape.size/2, shape.y + shape.size/2,
          shape.x + shape.size/2, shape.y + shape.size/2
        );
      }
    }
    
    // Instructions
    fill(0);
    textSize(16);
    text('Click anywhere to add a random shape', 20, 30);
  }
  
  function mousePressed() {
    // Add a new shape when clicked
    let shapeTypes = ['circle', 'square', 'triangle'];
    let newShape = {
      x: mouseX,
      y: mouseY,
      size: random(20, 100),
      type: random(shapeTypes),
      color: color(random(255), random(255), random(255), 200)
    };
    
    shapes.push(newShape);
    
    // Limit the number of shapes to prevent slowdown
    if (shapes.length > 50) {
      shapes.shift();
    }
  }`
    },
    {
      title: 'Particle System',
      description: 'Dynamic particle system with motion',
      thumbnail: 'particles',
      difficulty: 'advanced',
      conceptDomain: 'Physics',
      tags: ['particles', 'vectors', 'animation'],
      code: `// Particle System
  let particles = [];
  
  function setup() {
    createCanvas(windowWidth, windowHeight);
    // Create initial particles
    for (let i = 0; i < 50; i++) {
      particles.push(createParticle());
    }
  }
  
  function draw() {
    background(0, 20); // Slight trail effect
    
    // Update and display particles
    for (let i = particles.length - 1; i >= 0; i--) {
      let p = particles[i];
      
      p.update();
      p.display();
      
      // Remove particles that are off screen
      if (p.isDead()) {
        particles.splice(i, 1);
      }
    }
    
    // Add new particles
    if (frameCount % 5 === 0) {
      particles.push(createParticle());
    }
  }
  
  function createParticle() {
    return {
      position: createVector(random(width), random(height)),
      velocity: createVector(random(-2, 2), random(-2, 2)),
      acceleration: createVector(0, 0.05),
      size: random(4, 12),
      color: color(random(100, 255), random(100, 255), random(200, 255)),
      lifespan: 255,
      
      update: function() {
        this.velocity.add(this.acceleration);
        this.position.add(this.velocity);
        this.lifespan -= 2;
      },
      
      display: function() {
        noStroke();
        fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], this.lifespan);
        ellipse(this.position.x, this.position.y, this.size, this.size);
      },
      
      isDead: function() {
        return this.lifespan < 0 || 
               this.position.x < -this.size || 
               this.position.x > width + this.size ||
               this.position.y > height + this.size;
      }
    };
  }`
    },
    {
      title: 'Sine Wave Visualization',
      description: 'Interactive visualization of sine waves',
      thumbnail: 'wave',
      difficulty: 'intermediate',
      conceptDomain: 'Trigonometry',
      tags: ['math', 'waves', 'animation'],
      code: `// Sine Wave Visualization
  let angle = 0;
  let waveAmplitude = 75;
  let period = 500;
  let dx;
  
  function setup() {
    createCanvas(windowWidth, windowHeight);
    dx = (TWO_PI / period) * 10;
    noFill();
    stroke(0);
    strokeWeight(2);
  }
  
  function draw() {
    background(230);
    
    // Use mouse position to control amplitude and period
    waveAmplitude = map(mouseY, 0, height, 10, 150);
    period = map(mouseX, 0, width, 100, 1000);
    dx = (TWO_PI / period) * 10;
    
    // Draw the sine wave
    beginShape();
    for (let x = 0; x < width; x += 5) {
      let y = height/2 + sin(angle + x * dx) * waveAmplitude;
      vertex(x, y);
    }
    endShape();
    
    // Animate the wave
    angle += 0.05;
    
    // Draw controls
    fill(0);
    noStroke();
    textSize(16);
    text('Move mouse horizontally to change frequency', 20, 30);
    text('Move mouse vertically to change amplitude', 20, 55);
    text(\`Amplitude: \${waveAmplitude.toFixed(1)}\`, 20, height - 50);
    text(\`Period: \${period.toFixed(1)}\`, 20, height - 25);
  }`
    }
  ];
  
  // Default empty code template
  export const EMPTY_CODE = `function setup() {
    // Setup code goes here.
    createCanvas(windowWidth, windowHeight);
  }
  
  function draw() {
    // Frame drawing code goes here.
    background(220);
    
    // Add your drawing code here
    fill(41, 98, 255);
    noStroke();
    ellipse(mouseX, mouseY, 60, 60);
  }`;
  
  /**
   * Helper function to get examples by tag
   */
  export function getExamplesByTag(tag: string): P5jsExample[] {
    return EXAMPLE_SKETCHES.filter(example => 
      example.tags && example.tags.includes(tag.toLowerCase())
    );
  }
  
  /**
   * Helper function to get examples by difficulty
   */
  export function getExamplesByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): P5jsExample[] {
    return EXAMPLE_SKETCHES.filter(example => example.difficulty === difficulty);
  }
  
  /**
   * Helper function to get examples by concept domain
   */
  export function getExamplesByConceptDomain(domain: string): P5jsExample[] {
    return EXAMPLE_SKETCHES.filter(example => 
      example.conceptDomain && example.conceptDomain.toLowerCase() === domain.toLowerCase()
    );
  }
  
  export default EXAMPLE_SKETCHES;