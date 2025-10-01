// components/science/mitochondria/mitochondria-simulation.tsx
import React, { useEffect, useRef } from 'react';
import p5 from 'p5';

const MitochondriaSimulation = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sketchRef = useRef<p5 | null>(null);

  useEffect(() => {
    // Only create the P5 instance once and remove when component unmounts
    if (containerRef.current && !sketchRef.current) {
      const sketch = new p5(p => {
        // Canvas dimensions
        const width = containerRef.current!.clientWidth;
        const height = containerRef.current!.clientHeight || 500; // Fallback height
        
        // Molecules
        let glucoseMolecule: any;
        let oxygenMolecules: any[] = [];
        let atpMolecules: any[] = [];
        let co2Molecules: any[] = [];
        
        // Mitochondrion properties
        const mitochondrionX = width / 2;
        const mitochondrionY = height / 2;
        const mitochondrionWidth = width * 0.6;
        const mitochondrionHeight = height * 0.5;
        const outerMembraneThickness = 10;
        const innerMembraneOffset = 30;
        
        // Particles for visual effects
        let particles: any[] = [];
        
        // Game state
        let glucoseInMitochondrion = false;
        let oxygenInMitochondrion = 0;
        let respirationActive = false;
        let respirationProgress = 0;
        let atpProduced = 0;
        let co2Produced = 0;
        
        // Colors
        const colors = {
          background: p.color(240, 248, 255),
          mitochondrionOuter: p.color(70, 130, 180, 200),
          mitochondrionInner: p.color(100, 149, 237, 150),
          cristae: p.color(30, 144, 255),
          glucose: p.color(255, 215, 0),
          oxygen: p.color(135, 206, 250),
          atp: p.color(124, 252, 0),
          co2: p.color(169, 169, 169),
          text: p.color(50, 50, 50)
        };

        class Molecule {
          x: number;
          y: number;
          size: number;
          color: p5.Color;
          label: string;
          draggable: boolean;
          isDragging: boolean;
          targetX: number | null;
          targetY: number | null;
          speedX: number;
          speedY: number;
          consumed: boolean;

          constructor(x: number, y: number, size: number, color: p5.Color, label: string, draggable = true) {
            this.x = x;
            this.y = y;
            this.size = size;
            this.color = color;
            this.label = label;
            this.draggable = draggable;
            this.isDragging = false;
            this.targetX = null;
            this.targetY = null;
            this.speedX = 0;
            this.speedY = 0;
            this.consumed = false;
          }
          
          display() {
            if (this.consumed) return;
            
            p.push();
            p.translate(this.x, this.y);
            
            // Draw molecule
            p.fill(this.color);
            p.stroke(p.color(this.color.levels[0], this.color.levels[1], this.color.levels[2], 200));
            p.strokeWeight(2);
            
            if (this.label === 'Glucose') {
              this.drawGlucose();
            } else if (this.label === 'O₂') {
              this.drawOxygen();
            } else if (this.label === 'ATP') {
              this.drawATP();
            } else if (this.label === 'CO₂') {
              this.drawCO2();
            }
            
            // Draw label
            p.fill(colors.text);
            p.noStroke();
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(this.size * 0.4);
            p.text(this.label, 0, this.size * 1.2);
            
            p.pop();
          }
          
          drawGlucose() {
            // Hexagon shape for glucose
            p.beginShape();
            for (let i = 0; i < 6; i++) {
              const angle = p.TWO_PI / 6 * i - p.PI / 6;
              const x = this.size * p.cos(angle);
              const y = this.size * p.sin(angle);
              p.vertex(x, y);
            }
            p.endShape(p.CLOSE);
            
            // Add some carbon atom details
            p.fill(0, 0, 0, 100);
            p.noStroke();
            p.ellipse(0, 0, this.size * 0.4);
          }
          
          drawOxygen() {
            // Two connected circles for O₂
            p.ellipse(-this.size * 0.4, 0, this.size * 0.8);
            p.ellipse(this.size * 0.4, 0, this.size * 0.8);
            p.stroke(255);
            p.strokeWeight(2);
            p.line(-this.size * 0.2, 0, this.size * 0.2, 0);
          }
          
          drawATP() {
            // A circle with 3 smaller attached circles
            p.ellipse(0, 0, this.size);
            p.fill(255, 255, 255, 100);
            p.ellipse(-this.size * 0.3, -this.size * 0.3, this.size * 0.4);
            p.ellipse(this.size * 0.3, -this.size * 0.3, this.size * 0.4);
            p.ellipse(0, this.size * 0.3, this.size * 0.4);
          }
          
          drawCO2() {
            // One larger circle with two smaller ones
            p.ellipse(0, 0, this.size * 0.8);
            p.ellipse(-this.size * 0.6, 0, this.size * 0.6);
            p.ellipse(this.size * 0.6, 0, this.size * 0.6);
          }
          
          isMouseOver() {
            return p.dist(p.mouseX, p.mouseY, this.x, this.y) < this.size;
          }
          
          startDrag() {
            if (this.draggable && this.isMouseOver()) {
              this.isDragging = true;
              return true;
            }
            return false;
          }
          
          drag() {
            if (this.isDragging) {
              this.x = p.mouseX;
              this.y = p.mouseY;
            }
          }
          
          stopDrag() {
            this.isDragging = false;
          }
          
          moveToTarget() {
            if (this.targetX !== null && this.targetY !== null) {
              const dx = this.targetX - this.x;
              const dy = this.targetY - this.y;
              const distance = p.sqrt(dx * dx + dy * dy);
              
              if (distance > 1) {
                this.x += dx * 0.05;
                this.y += dy * 0.05;
                return false;
              } else {
                this.x = this.targetX;
                this.y = this.targetY;
                this.targetX = null;
                this.targetY = null;
                return true;
              }
            }
            return false;
          }
          
          isInMitochondrion() {
            // Check if the molecule is within the outer membrane
            return (
              this.x > mitochondrionX - mitochondrionWidth / 2 + outerMembraneThickness &&
              this.x < mitochondrionX + mitochondrionWidth / 2 - outerMembraneThickness &&
              this.y > mitochondrionY - mitochondrionHeight / 2 + outerMembraneThickness &&
              this.y < mitochondrionY + mitochondrionHeight / 2 - outerMembraneThickness
            );
          }
          
          setTarget(x: number, y: number) {
            this.targetX = x;
            this.targetY = y;
            this.draggable = false;
          }
          
          consume() {
            this.consumed = true;
          }
        }
        
        class Particle {
          x: number;
          y: number;
          size: number;
          color: p5.Color;
          alpha: number;
          vx: number;
          vy: number;
          lifespan: number;

          constructor(x: number, y: number, color: p5.Color) {
            this.x = x;
            this.y = y;
            this.size = p.random(2, 5);
            this.color = color;
            this.alpha = 255;
            this.vx = p.random(-1, 1);
            this.vy = p.random(-1, 1);
            this.lifespan = p.random(50, 100);
          }
          
          update() {
            this.x += this.vx;
            this.y += this.vy;
            this.alpha -= 255 / this.lifespan;
            this.lifespan--;
          }
          
          display() {
            p.noStroke();
            p.fill(
              this.color.levels[0],
              this.color.levels[1], 
              this.color.levels[2],
              this.alpha
            );
            p.ellipse(this.x, this.y, this.size);
          }
          
          isDead() {
            return this.lifespan <= 0;
          }
        }
        
        p.setup = () => {
          p.createCanvas(width, height);
          p.textFont('Arial');
          
          // Create initial molecules
          glucoseMolecule = new Molecule(
            width * 0.15,
            height * 0.8,
            25,
            colors.glucose,
            'Glucose'
          );
          
          // Create some oxygen molecules
          for (let i = 0; i < 4; i++) {
            oxygenMolecules.push(
              new Molecule(
                width * 0.85,
                height * 0.3 + i * 60,
                20,
                colors.oxygen,
                'O₂'
              )
            );
          }
          
          // Create some initial particles
          for (let i = 0; i < 20; i++) {
            particles.push(
              new Particle(
                p.random(width),
                p.random(height),
                p.lerpColor(colors.background, colors.mitochondrionOuter, 0.3)
              )
            );
          }
        };
        
        p.draw = () => {
          p.background(colors.background);
          
          // Update and display particles
          for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            particles[i].display();
            if (particles[i].isDead()) {
              particles.splice(i, 1);
            }
          }
          
          // Add new particles occasionally
          if (p.frameCount % 5 === 0 && particles.length < 50) {
            particles.push(
              new Particle(
                p.random(width),
                p.random(height),
                p.lerpColor(colors.background, colors.mitochondrionOuter, 0.3)
              )
            );
          }
          
          // Draw mitochondrion
          drawMitochondrion();
          
          // Update and display glucose
          glucoseMolecule.display();
          glucoseMolecule.drag();
          
          // Check if glucose is in mitochondrion
          if (!glucoseInMitochondrion && !glucoseMolecule.consumed && glucoseMolecule.isInMitochondrion()) {
            glucoseInMitochondrion = true;
            glucoseMolecule.draggable = false;
            
            // Add some particles for effect
            for (let i = 0; i < 10; i++) {
              particles.push(
                new Particle(
                  glucoseMolecule.x,
                  glucoseMolecule.y,
                  colors.glucose
                )
              );
            }
          }
          
          // Update and display oxygen molecules
          for (let i = 0; i < oxygenMolecules.length; i++) {
            const oxygen = oxygenMolecules[i];
            if (!oxygen.consumed) {
              oxygen.display();
              oxygen.drag();
              
              // Check if oxygen is in mitochondrion
              if (oxygen.isInMitochondrion() && !oxygen.consumed && glucoseInMitochondrion) {
                oxygen.draggable = false;
                oxygen.consume();
                oxygenInMitochondrion++;
                
                // Add particles for effect
                for (let j = 0; j < 8; j++) {
                  particles.push(
                    new Particle(
                      oxygen.x,
                      oxygen.y,
                      colors.oxygen
                    )
                  );
                }
                
                // Start cellular respiration when we have enough oxygen
                if (oxygenInMitochondrion >= 2 && !respirationActive) {
                  respirationActive = true;
                  glucoseMolecule.consume();
                }
              }
            }
          }
          
          // Update and display ATP molecules
          for (let i = 0; i < atpMolecules.length; i++) {
            atpMolecules[i].display();
            atpMolecules[i].moveToTarget();
          }
          
          // Update and display CO2 molecules
          for (let i = 0; i < co2Molecules.length; i++) {
            co2Molecules[i].display();
            co2Molecules[i].moveToTarget();
          }
          
          // Process cellular respiration
          if (respirationActive) {
            processCellularRespiration();
          }
          
          // Display instructions and counts
          displayUI();
        };
        
        function drawMitochondrion() {
          // Outer membrane
          p.noFill();
          p.stroke(colors.mitochondrionOuter);
          p.strokeWeight(outerMembraneThickness);
          p.ellipse(
            mitochondrionX,
            mitochondrionY,
            mitochondrionWidth,
            mitochondrionHeight
          );
          
          // Inner membrane
          p.stroke(colors.mitochondrionInner);
          p.strokeWeight(outerMembraneThickness / 2);
          p.ellipse(
            mitochondrionX,
            mitochondrionY,
            mitochondrionWidth - innerMembraneOffset * 2,
            mitochondrionHeight - innerMembraneOffset * 2
          );
          
          // Draw cristae (inner membrane folds)
          p.stroke(colors.cristae);
          p.strokeWeight(outerMembraneThickness / 3);
          
          const cristaCount = 8;
          const innerWidth = mitochondrionWidth - innerMembraneOffset * 2;
          const innerHeight = mitochondrionHeight - innerMembraneOffset * 2;
          
          for (let i = 0; i < cristaCount; i++) {
            // Vertical position within the inner membrane
            const yOffset = p.map(i, 0, cristaCount - 1, -innerHeight / 3, innerHeight / 3);
            
            // Length of this crista
            const cristaLength = p.map(
              p.abs(yOffset),
              0,
              innerHeight / 3,
              innerWidth * 0.5,
              innerWidth * 0.3
            );
            
            // Draw from both sides
            p.beginShape();
            p.curveVertex(mitochondrionX - innerWidth / 4, mitochondrionY + yOffset);
            p.curveVertex(mitochondrionX - innerWidth / 4, mitochondrionY + yOffset);
            p.curveVertex(mitochondrionX, mitochondrionY + yOffset - 10);
            p.curveVertex(mitochondrionX + cristaLength / 4, mitochondrionY + yOffset);
            p.endShape();
            
            p.beginShape();
            p.curveVertex(mitochondrionX + innerWidth / 4, mitochondrionY + yOffset);
            p.curveVertex(mitochondrionX + innerWidth / 4, mitochondrionY + yOffset);
            p.curveVertex(mitochondrionX, mitochondrionY + yOffset + 10);
            p.curveVertex(mitochondrionX - cristaLength / 4, mitochondrionY + yOffset);
            p.endShape();
          }
          
          // Add a label
          p.fill(colors.text);
          p.noStroke();
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(16);
          p.text("Mitochondrion", mitochondrionX, mitochondrionY - mitochondrionHeight / 2 - 20);
        }
        
        function processCellularRespiration() {
          // Increment progress
          respirationProgress += 0.5;
          
          // Generate particles in the mitochondrion to indicate activity
          if (p.frameCount % 5 === 0) {
            particles.push(
              new Particle(
                mitochondrionX + p.random(-mitochondrionWidth/4, mitochondrionWidth/4),
                mitochondrionY + p.random(-mitochondrionHeight/4, mitochondrionHeight/4),
                p.lerpColor(colors.glucose, colors.oxygen, p.random())
              )
            );
          }
          
          // Produce ATP at intervals
          if (respirationProgress > 0 && respirationProgress % 30 === 0 && atpProduced < 36) {
            createATPMolecule();
          }
          
          // Produce CO2 at intervals
          if (respirationProgress > 10 && respirationProgress % 40 === 0 && co2Produced < 6) {
            createCO2Molecule();
          }
          
          // End respiration when we've produced all molecules
          if (atpProduced >= 36 && co2Produced >= 6) {
            respirationActive = false;
            
            // Create new glucose and oxygen molecules
            setTimeout(() => {
              resetSimulation();
            }, 3000);
          }
        }
        
        function createATPMolecule() {
          // Create ATP molecule from within the mitochondrion
          const atp = new Molecule(
            mitochondrionX + p.random(-50, 50),
            mitochondrionY + p.random(-30, 30),
            15,
            colors.atp,
            'ATP',
            false
          );
          
          // Set target destination outside the mitochondrion
          const angle = p.random(p.TWO_PI);
          atp.setTarget(
            mitochondrionX + p.cos(angle) * (mitochondrionWidth * 0.6),
            mitochondrionY + p.sin(angle) * (mitochondrionHeight * 0.6)
          );
          
          atpMolecules.push(atp);
          atpProduced++;
          
          // Add particles for effect
          for (let i = 0; i < 5; i++) {
            particles.push(
              new Particle(
                atp.x,
                atp.y,
                colors.atp
              )
            );
          }
        }
        
        function createCO2Molecule() {
          // Create CO2 molecule from within the mitochondrion
          const co2 = new Molecule(
            mitochondrionX + p.random(-50, 50),
            mitochondrionY + p.random(-30, 30),
            12,
            colors.co2,
            'CO₂',
            false
          );
          
          // Set target destination outside the mitochondrion
          const angle = p.random(p.TWO_PI);
          co2.setTarget(
            mitochondrionX + p.cos(angle) * (mitochondrionWidth * 0.7),
            mitochondrionY + p.sin(angle) * (mitochondrionHeight * 0.7)
          );
          
          co2Molecules.push(co2);
          co2Produced++;
          
          // Add particles for effect
          for (let i = 0; i < 5; i++) {
            particles.push(
              new Particle(
                co2.x,
                co2.y,
                colors.co2
              )
            );
          }
        }
        
        function displayUI() {
          // Display instruction text
          p.fill(colors.text);
          p.noStroke();
          p.textAlign(p.LEFT, p.TOP);
          p.textSize(14);
          
          if (!glucoseInMitochondrion) {
            p.text("Drag the glucose molecule into the mitochondrion", 20, 20);
          } else if (oxygenInMitochondrion < 2) {
            p.text("Now drag oxygen molecules into the mitochondrion", 20, 20);
          } else {
            p.text("Cellular respiration in progress!", 20, 20);
          }
          
          // Display counts
          p.textAlign(p.RIGHT, p.TOP);
          p.text(`ATP produced: ${atpProduced}`, width - 20, 20);
          p.text(`CO₂ produced: ${co2Produced}`, width - 20, 45);
          
          // Display equation
          if (respirationActive) {
            p.textAlign(p.CENTER, p.BOTTOM);
            p.textSize(16);
            p.text("C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + ~36 ATP", width / 2, height - 20);
          }
        }
        
        function resetSimulation() {
          // Reset all states
          glucoseInMitochondrion = false;
          oxygenInMitochondrion = 0;
          respirationActive = false;
          respirationProgress = 0;
          atpProduced = 0;
          co2Produced = 0;
          
          // Clear old molecules
          atpMolecules = [];
          co2Molecules = [];
          
          // Create new glucose
          glucoseMolecule = new Molecule(
            width * 0.15,
            height * 0.8,
            25,
            colors.glucose,
            'Glucose'
          );
          
          // Create new oxygen molecules
          oxygenMolecules = [];
          for (let i = 0; i < 4; i++) {
            oxygenMolecules.push(
              new Molecule(
                width * 0.85,
                height * 0.3 + i * 60,
                20,
                colors.oxygen,
                'O₂'
              )
            );
          }
        }
        
        p.mousePressed = () => {
          // Try to pick up glucose first
          if (glucoseMolecule.startDrag()) {
            return;
          }
          
          // Then try oxygen molecules
          for (let i = 0; i < oxygenMolecules.length; i++) {
            if (oxygenMolecules[i].startDrag()) {
              return;
            }
          }
        };
        
        p.mouseReleased = () => {
          glucoseMolecule.stopDrag();
          for (let i = 0; i < oxygenMolecules.length; i++) {
            oxygenMolecules[i].stopDrag();
          }
        };

        p.windowResized = () => {
          // Handle window resize if container size changes
          if (containerRef.current) {
            const newWidth = containerRef.current.clientWidth;
            const newHeight = containerRef.current.clientHeight;
            p.resizeCanvas(newWidth, newHeight);
          }
        };
      }, containerRef.current);

      sketchRef.current = sketch;
    }

    // Cleanup function to remove the P5 instance
    return () => {
      if (sketchRef.current) {
        sketchRef.current.remove();
        sketchRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      style={{ width: '100%', height: '500px' }}
      className="bg-white p-4 rounded-lg shadow-inner"
    />
  );
};

export default MitochondriaSimulation;