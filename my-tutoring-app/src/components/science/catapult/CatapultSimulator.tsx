// pages/catapult.js
import { useEffect, useRef } from 'react';
import Head from 'next/head';
import styles from './Catapult.module.css';

const CatapultSimulator = () => {
  const canvasRef = useRef(null);
  const simulatorRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const initializeSimulator = () => {
      // DOM elements
      const forceSlider = document.getElementById('forceSlider');
      const forceValue = document.getElementById('forceValue');
      const angleSlider = document.getElementById('angleSlider');
      const angleValue = document.getElementById('angleValue');
      const massSlider = document.getElementById('massSlider');
      const massValue = document.getElementById('massValue');
      const dragSlider = document.getElementById('dragSlider');
      const dragValue = document.getElementById('dragValue');
      const gravitySlider = document.getElementById('gravitySlider');
      const gravityValue = document.getElementById('gravityValue');
      const difficultySlider = document.getElementById('difficultySlider');
      const difficultyValue = document.getElementById('difficultyValue');
      const launchButton = document.getElementById('launchButton');
      const resetButton = document.getElementById('resetButton');
      const resultText = document.getElementById('resultText');
      const scoreElement = document.getElementById('score');
      const initialVelocityElement = document.getElementById('initialVelocity');
      const distanceTraveledElement = document.getElementById('distanceTraveled');
      const maxHeightElement = document.getElementById('maxHeight');
      const flightTimeElement = document.getElementById('flightTime');

      // Game state
      const gameState = {
        force: 100,
        angle: 45,
        mass: 2,
        drag: 0.01,
        gravity: 9.8,
        difficulty: 1,
        score: 0,
        projectilePosition: null,
        projectileVelocity: null,
        catapultPosition: { x: 15, y: 0 },
        targetPosition: null,
        targetSize: 30,
        isLaunched: false,
        animationId: null,
        trajectory: [],
        timeElapsed: 0,
        maxHeight: 0,
        flightTime: 0,
        distanceTraveled: 0,
      };

      const SCALE = 10;
      const COLORS = {
        sky: '#e6f7ff',
        ground: '#8bc34a',
        catapult: '#795548',
        projectile: '#ff5722',
        target: '#f44336',
        trajectory: 'rgba(33, 150, 243, 0.3)',
      };

      function resizeCanvas() {
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        if (gameState.targetPosition) drawScene();
      }

      function setupEventListeners() {
        window.addEventListener('resize', resizeCanvas);

        forceSlider.addEventListener('input', function () {
          gameState.force = parseInt(this.value);
          forceValue.textContent = gameState.force;
        });

        angleSlider.addEventListener('input', function () {
          gameState.angle = parseInt(this.value);
          angleValue.textContent = gameState.angle;
          drawScene();
        });

        massSlider.addEventListener('input', function () {
          gameState.mass = parseFloat(this.value);
          massValue.textContent = gameState.mass.toFixed(1);
        });

        dragSlider.addEventListener('input', function () {
          gameState.drag = parseFloat(this.value);
          dragValue.textContent = gameState.drag.toFixed(3);
        });

        gravitySlider.addEventListener('input', function () {
          gameState.gravity = parseFloat(this.value);
          gravityValue.textContent = gameState.gravity.toFixed(1);
        });

        difficultySlider.addEventListener('input', function () {
          gameState.difficulty = parseInt(this.value);
          difficultyValue.textContent = gameState.difficulty;
          resetGame();
        });

        launchButton.addEventListener('click', function () {
          if (!gameState.isLaunched) {
            launchProjectile();
            this.disabled = true;
          }
        });

        resetButton.addEventListener('click', function () {
          resetGame();
          launchButton.disabled = false;
        });
      }

      function initGame() {
        resizeCanvas();
        setupEventListeners();
        createRandomTarget();
        drawScene();
        updateUIValues();
        launchButton.disabled = false;
      }

      function createRandomTarget() {
        const minDistance = 40 * gameState.difficulty;
        const maxDistance = 70 * gameState.difficulty;
        const targetX = minDistance + Math.random() * (maxDistance - minDistance);
        const targetY = 0;
        gameState.targetPosition = { x: targetX, y: targetY };
        gameState.targetSize = 40 - gameState.difficulty * 10;
      }

      function launchProjectile() {
        const initialSpeed = Math.sqrt((2 * gameState.force) / gameState.mass);
        const angleRad = (gameState.angle * Math.PI) / 180;
        gameState.projectilePosition = {
          x: gameState.catapultPosition.x,
          y: gameState.catapultPosition.y + 2,
        };
        gameState.projectileVelocity = {
          x: initialSpeed * Math.cos(angleRad),
          y: initialSpeed * Math.sin(angleRad),
        };
        gameState.trajectory = [{ ...gameState.projectilePosition }];
        gameState.timeElapsed = 0;
        gameState.maxHeight = 0;
        gameState.distanceTraveled = 0;
        initialVelocityElement.textContent = initialSpeed.toFixed(2);
        gameState.isLaunched = true;
        if (gameState.animationId) cancelAnimationFrame(gameState.animationId);
        animate();
      }

      function animate() {
        updateProjectile();
        drawScene();
        if (gameState.isLaunched && gameState.projectilePosition.y >= 0) {
          gameState.animationId = requestAnimationFrame(animate);
        } else {
          checkResults();
        }
      }

      function updateProjectile() {
        const dt = 0.1;
        const vMag = Math.sqrt(
          gameState.projectileVelocity.x * gameState.projectileVelocity.x +
            gameState.projectileVelocity.y * gameState.projectileVelocity.y
        );
        const dragForceX = gameState.drag * vMag * gameState.projectileVelocity.x;
        const dragForceY = gameState.drag * vMag * gameState.projectileVelocity.y;
        gameState.projectileVelocity.x -= (dragForceX / gameState.mass) * dt;
        gameState.projectileVelocity.y -=
          (gameState.gravity + dragForceY / gameState.mass) * dt;
        gameState.projectilePosition.x += gameState.projectileVelocity.x * dt;
        gameState.projectilePosition.y += gameState.projectileVelocity.y * dt;

        if (gameState.projectilePosition.y >= 0) {
          gameState.trajectory.push({ ...gameState.projectilePosition });
          if (gameState.projectilePosition.y > gameState.maxHeight) {
            gameState.maxHeight = gameState.projectilePosition.y;
          }
          gameState.timeElapsed += dt;
          gameState.flightTime = gameState.timeElapsed;
          if (gameState.projectilePosition.y <= 0 && gameState.projectileVelocity.y < 0) {
            gameState.distanceTraveled = gameState.projectilePosition.x;
          }
        }
        updateUIValues();
      }

      function checkResults() {
        const targetCenter = {
          x: gameState.targetPosition.x,
          y: gameState.targetPosition.y + gameState.targetSize / 2,
        };
        const landingPointX = gameState.projectilePosition.x;
        const distance = Math.abs(landingPointX - targetCenter.x);
        const maxHitDistance = gameState.targetSize / 2;

        if (distance <= maxHitDistance * 0.3) {
          resultText.textContent = "Perfect hit! Bull's eye!";
          gameState.score += 100 * gameState.difficulty;
        } else if (distance <= maxHitDistance) {
          resultText.textContent = "Good shot! You hit the target!";
          gameState.score += 50 * gameState.difficulty;
        } else {
          const missDistance = (distance - maxHitDistance).toFixed(1);
          resultText.textContent =
            landingPointX < targetCenter.x
              ? `Missed! ${missDistance}m short of the target.`
              : `Missed! ${missDistance}m past the target.`;
        }
        scoreElement.textContent = `Score: ${gameState.score}`;
        updateUIValues();
      }

      function resetGame() {
        if (gameState.animationId) {
          cancelAnimationFrame(gameState.animationId);
          gameState.animationId = null;
        }
        gameState.projectilePosition = null;
        gameState.projectileVelocity = null;
        gameState.isLaunched = false;
        gameState.trajectory = [];
        createRandomTarget();
        resultText.textContent = "Adjust your settings and click Launch to start!";
        initialVelocityElement.textContent = "0";
        distanceTraveledElement.textContent = "0";
        maxHeightElement.textContent = "0";
        flightTimeElement.textContent = "0";
        launchButton.disabled = false;
        drawScene();
      }

      function updateUIValues() {
        distanceTraveledElement.textContent = gameState.distanceTraveled.toFixed(1);
        maxHeightElement.textContent = gameState.maxHeight.toFixed(1);
        flightTimeElement.textContent = gameState.flightTime.toFixed(1);
      }

      function drawScene() {
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const groundY = canvasHeight - 50;

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = COLORS.sky;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = COLORS.ground;
        ctx.fillRect(0, groundY, canvasWidth, 50);
        drawDistanceMarkings(groundY);

        if (gameState.trajectory.length > 1) {
          ctx.beginPath();
          ctx.moveTo(
            gameState.trajectory[0].x * SCALE,
            groundY - gameState.trajectory[0].y * SCALE
          );
          for (let i = 1; i < gameState.trajectory.length; i++) {
            ctx.lineTo(
              gameState.trajectory[i].x * SCALE,
              groundY - gameState.trajectory[i].y * SCALE
            );
          }
          ctx.strokeStyle = COLORS.trajectory;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        drawCatapult(groundY);

        if (gameState.targetPosition) {
          const targetX = gameState.targetPosition.x * SCALE;
          const targetY = groundY - gameState.targetSize / 2;
          const targetWidth = gameState.targetSize;
          const targetHeight = gameState.targetSize;

          ctx.fillStyle = '#8d6e63';
          ctx.fillRect(targetX - targetWidth / 2, groundY - 5, targetWidth, 5);
          ctx.fillStyle = COLORS.target;
          ctx.beginPath();
          ctx.arc(targetX, targetY, targetWidth / 2, 0, Math.PI, true);
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(targetX, targetY, targetWidth / 2 * 0.7, 0, Math.PI, true);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(targetX, targetY, targetWidth / 2 * 0.4, 0, Math.PI, true);
          ctx.stroke();
          ctx.fillStyle = '#333';
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`${gameState.targetPosition.x.toFixed(1)}m`, targetX, groundY + 20);
        }

        if (gameState.projectilePosition && gameState.projectilePosition.y >= 0) {
          const projectileX = gameState.projectilePosition.x * SCALE;
          const projectileY = groundY - gameState.projectilePosition.y * SCALE;
          const projectileRadius = 5 + gameState.mass;
          ctx.fillStyle = COLORS.projectile;
          ctx.beginPath();
          ctx.arc(projectileX, projectileY, projectileRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        if (!gameState.isLaunched) {
          const startX = gameState.catapultPosition.x * SCALE;
          const startY = groundY - 5;
          const angleInRadians = (gameState.angle * Math.PI) / 180;
          const lineLength = 50;
          const endX = startX + Math.cos(angleInRadians) * lineLength;
          const endY = startY - Math.sin(angleInRadians) * lineLength;
          ctx.strokeStyle = 'rgba(255, 87, 34, 0.7)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 3]);
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      function drawCatapult(groundY) {
        const catapultX = gameState.catapultPosition.x * SCALE;
        const catapultY = groundY;
        ctx.fillStyle = COLORS.catapult;
        ctx.fillRect(catapultX - 15, catapultY - 5, 30, 5);
        ctx.fillStyle = COLORS.catapult;
        ctx.save();
        ctx.translate(catapultX, catapultY - 5);
        if (gameState.isLaunched) {
          ctx.rotate(-Math.PI / 4);
        } else {
          ctx.rotate(-gameState.angle * Math.PI / 180);
        }
        ctx.fillRect(-3, 0, 6, -20);
        ctx.restore();
        if (!gameState.isLaunched) {
          const angleInRadians = (gameState.angle * Math.PI) / 180;
          const cupX = catapultX + Math.cos(angleInRadians) * -20;
          const cupY = catapultY - 5 - Math.sin(angleInRadians) * 20;
          ctx.fillStyle = '#5d4037';
          ctx.beginPath();
          ctx.arc(cupX, cupY, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      function drawDistanceMarkings(groundY) {
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        for (let i = 10; i <= 150; i += 10) {
          const x = i * SCALE;
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, groundY);
          ctx.lineTo(x, groundY + 10);
          ctx.stroke();
          if (i % 20 === 0) {
            ctx.fillText(`${i}m`, x, groundY + 25);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(x, groundY);
            ctx.lineTo(x, 0);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }

      return { init: initGame };
    };

    simulatorRef.current = initializeSimulator();
    simulatorRef.current.init();

    return () => {
      if (simulatorRef.current && gameState.animationId) {
        cancelAnimationFrame(gameState.animationId);
      }
      window.removeEventListener('resize', resizeCanvas);
      // Note: You may want to remove other event listeners here for full cleanup
    };
  }, []);

  return (
    <>
      <Head>
        <title>Catapult Physics Simulator</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <div className={styles.container}>
        <h1>Catapult Physics Simulator</h1>
        <div className={styles.gameArea}>
          <div className={styles.canvasContainer}>
            <canvas ref={canvasRef} id="gameCanvas" />
          </div>
          <div className={styles.controls}>
            <div className={styles.controlGroup}>
              <h3>Catapult Settings</h3>
              <div className={styles.controlItem}>
                <label htmlFor="forceSlider">Launch Force</label>
                <div className={styles.sliderContainer}>
                  <input
                    type="range"
                    id="forceSlider"
                    min="10"
                    max="300"
                    defaultValue="100"
                  />
                  <span id="forceValue" className={styles.valueDisplay}>
                    100
                  </span>
                  <span>N</span>
                </div>
              </div>
              <div className={styles.controlItem}>
                <label htmlFor="angleSlider">Launch Angle</label>
                <div className={styles.sliderContainer}>
                  <input
                    type="range"
                    id="angleSlider"
                    min="10"
                    max="80"
                    defaultValue="45"
                  />
                  <span id="angleValue" className={styles.valueDisplay}>
                    45
                  </span>
                  <span>°</span>
                </div>
              </div>
            </div>
            <div className={styles.controlGroup}>
              <h3>Projectile Settings</h3>
              <div className={styles.controlItem}>
                <label htmlFor="massSlider">Projectile Mass</label>
                <div className={styles.sliderContainer}>
                  <input
                    type="range"
                    id="massSlider"
                    min="1"
                    max="10"
                    defaultValue="2"
                    step="0.1"
                  />
                  <span id="massValue" className={styles.valueDisplay}>
                    2.0
                  </span>
                  <span>kg</span>
                </div>
              </div>
              <div className={styles.controlItem}>
                <label htmlFor="dragSlider">Air Resistance</label>
                <div className={styles.sliderContainer}>
                  <input
                    type="range"
                    id="dragSlider"
                    min="0"
                    max="0.05"
                    defaultValue="0.01"
                    step="0.001"
                  />
                  <span id="dragValue" className={styles.valueDisplay}>
                    0.01
                  </span>
                </div>
              </div>
            </div>
            <div className={styles.controlGroup}>
              <h3>Simulation Controls</h3>
              <div className={styles.controlItem}>
                <div className={styles.buttonGroup}>
                  <button id="launchButton">Launch!</button>
                  <button id="resetButton">Reset</button>
                </div>
              </div>
              <div className={styles.controlItem}>
                <label htmlFor="gravitySlider">Gravity</label>
                <div className={styles.sliderContainer}>
                  <input
                    type="range"
                    id="gravitySlider"
                    min="1"
                    max="20"
                    defaultValue="9.8"
                    step="0.1"
                  />
                  <span id="gravityValue" className={styles.valueDisplay}>
                    9.8
                  </span>
                  <span>m/s²</span>
                </div>
              </div>
              <div className={styles.controlItem}>
                <label htmlFor="difficultySlider">Target Difficulty</label>
                <div className={styles.sliderContainer}>
                  <input
                    type="range"
                    id="difficultySlider"
                    min="1"
                    max="3"
                    defaultValue="1"
                    step="1"
                  />
                  <span id="difficultyValue" className={styles.valueDisplay}>
                    1
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.results}>
            <h3>Launch Results</h3>
            <div id="resultText" className={styles.message}>
              Adjust your settings and click Launch to start!
            </div>
            <div id="score" className={styles.score}>
              Score: 0
            </div>
            <div id="analytics">
              <div>
                Initial Velocity: <span id="initialVelocity">0</span> m/s
              </div>
              <div>
                Distance Traveled: <span id="distanceTraveled">0</span> m
              </div>
              <div>
                Maximum Height: <span id="maxHeight">0</span> m
              </div>
              <div>
                Flight Time: <span id="flightTime">0</span> s
              </div>
            </div>
          </div>
          <div className={styles.physicsInfo}>
            <h3>Physics Behind the Simulation</h3>
            <p>
              This simulation models projectile motion with air resistance. The key
              equations used are:
            </p>
            <div className={styles.physicsFormula}>
              Initial Velocity = √(2 × Force / Mass)
            </div>
            <div className={styles.physicsFormula}>
              Horizontal Position: x = v₀ × cos(θ) × t - 0.5 × C × v² × cos(θ) × t²
            </div>
            <div className={styles.physicsFormula}>
              Vertical Position: y = v₀ × sin(θ) × t - 0.5 × g × t² - 0.5 × C × v² ×
              sin(θ) × t²
            </div>
            <p>Where:</p>
            <ul>
              <li>v₀ = initial velocity</li>
              <li>θ = launch angle</li>
              <li>g = gravitational acceleration</li>
              <li>t = time</li>
              <li>C = drag coefficient</li>
              <li>v = velocity at time t</li>
            </ul>
            <p>
              Try different combinations of force, angle, mass, and air resistance to
              see how they affect the projectile's trajectory!
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default CatapultSimulator;