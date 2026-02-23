/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, RotateCcw, Info, Globe } from 'lucide-react';

// --- Types & Constants ---

type GameState = 'START' | 'PLAYING' | 'ROUND_END' | 'WIN' | 'GAMEOVER';
type Language = 'zh' | 'en';

interface Point {
  x: number;
  y: number;
}

interface Entity {
  id: string;
  x: number;
  y: number;
}

interface EnemyRocket extends Entity {
  targetX: number;
  targetY: number;
  speed: number;
  progress: number; // 0 to 1
}

interface Interceptor extends Entity {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  speed: number;
  progress: number;
}

interface Explosion extends Entity {
  radius: number;
  maxRadius: number;
  growthRate: number;
  isShrinking: boolean;
}

interface City extends Entity {
  isDestroyed: boolean;
}

interface Turret extends Entity {
  isDestroyed: boolean;
  missiles: number;
  maxMissiles: number;
}

const WIN_SCORE = 1000;
const POINTS_PER_ROCKET = 20;
const EXPLOSION_MAX_RADIUS = 40;
const EXPLOSION_GROWTH = 1.5;

const TRANSLATIONS = {
  zh: {
    title: "Tina 星空防御",
    start: "开始游戏",
    restart: "再玩一次",
    win: "胜利！你守护了星系",
    gameover: "防线崩溃 - 任务失败",
    score: "得分",
    missiles: "导弹",
    round: "关卡",
    instructions: "点击屏幕拦截敌方火箭。预判它们的路径！",
    winMsg: "恭喜！你达到了 1000 分。",
    lossMsg: "所有炮台已被摧毁。",
    nextRound: "下一轮",
  },
  en: {
    title: "Tina Starry Defense",
    start: "Start Game",
    restart: "Play Again",
    win: "Victory! Galaxy Defended",
    gameover: "Defense Breached - Mission Failed",
    score: "Score",
    missiles: "Missiles",
    round: "Round",
    instructions: "Click to intercept enemy rockets. Lead your targets!",
    winMsg: "Congratulations! You reached 1000 points.",
    lossMsg: "All turrets have been destroyed.",
    nextRound: "Next Round",
  }
};

// --- Game Component ---

export default function TinaNovaDefense() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [lang, setLang] = useState<Language>('zh');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Game Entities
  const enemiesRef = useRef<EnemyRocket[]>([]);
  const interceptorsRef = useRef<Interceptor[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const citiesRef = useRef<City[]>([]);
  const turretsRef = useRef<Turret[]>([]);
  const enemiesSpawnedInRound = useRef(0);
  const enemiesDestroyedInRound = useRef(0);
  
  const t = TRANSLATIONS[lang];

  // Initialize Entities
  const initLevel = useCallback((w: number, h: number, isNewGame: boolean) => {
    if (isNewGame) {
      setScore(0);
      setRound(1);
      
      // Cities
      const cities: City[] = [];
      const cityPositions = [0.15, 0.25, 0.35, 0.65, 0.75, 0.85];
      cityPositions.forEach((p, i) => {
        cities.push({ id: `city-${i}`, x: w * p, y: h - 40, isDestroyed: false });
      });
      citiesRef.current = cities;

      // Turrets
      const turrets: Turret[] = [
        { id: 't-left', x: w * 0.05, y: h - 50, isDestroyed: false, missiles: 20, maxMissiles: 20 },
        { id: 't-mid', x: w * 0.5, y: h - 50, isDestroyed: false, missiles: 40, maxMissiles: 40 },
        { id: 't-right', x: w * 0.95, y: h - 50, isDestroyed: false, missiles: 20, maxMissiles: 20 },
      ];
      turretsRef.current = turrets;
    } else {
      // Replenish missiles and repair turrets
      turretsRef.current = turretsRef.current.map(t => ({
        ...t,
        isDestroyed: false,
        missiles: t.maxMissiles
      }));
    }

    enemiesRef.current = [];
    interceptorsRef.current = [];
    explosionsRef.current = [];
    enemiesSpawnedInRound.current = 0;
    enemiesDestroyedInRound.current = 0;
  }, []);

  // Handle Resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({ width: clientWidth, height: clientHeight });
        if (gameState === 'START') {
          initLevel(clientWidth, clientHeight, true);
        }
      }
    };

    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) observer.observe(containerRef.current);
    updateSize();
    return () => observer.disconnect();
  }, [gameState, initLevel]);

  const endRound = useCallback(() => {
    // Calculate bonus
    const remainingMissiles = turretsRef.current.reduce((acc, t) => acc + (t.isDestroyed ? 0 : t.missiles), 0);
    const bonus = remainingMissiles * 5;
    setScore(prev => {
      const newScore = prev + bonus;
      if (newScore >= WIN_SCORE) {
        setGameState('WIN');
        return newScore;
      }
      return newScore;
    });
    setGameState('ROUND_END');
  }, []);

  const nextRound = () => {
    setRound(prev => prev + 1);
    initLevel(dimensions.width, dimensions.height, false);
    setGameState('PLAYING');
  };

  // Game Loop
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let spawnTimer = 0;

    const loop = (time: number) => {
      const dt = (time - lastTime) / 16.67; // Normalize to ~60fps
      lastTime = time;

      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;

      // Clear
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Spawn Enemies
      const maxEnemies = 10 + round * 5;
      if (enemiesSpawnedInRound.current < maxEnemies) {
        spawnTimer += dt;
        const spawnInterval = Math.max(15, 80 - round * 8);
        if (spawnTimer > spawnInterval) {
          spawnTimer = 0;
          const targets = [...citiesRef.current, ...turretsRef.current].filter(t => !t.isDestroyed);
          if (targets.length > 0) {
            const target = targets[Math.floor(Math.random() * targets.length)];
            enemiesRef.current.push({
              id: Math.random().toString(),
              x: Math.random() * dimensions.width,
              y: 0,
              targetX: target.x,
              targetY: target.y,
              speed: (0.001 + (round * 0.0003)) * 2,
              progress: 0
            });
            enemiesSpawnedInRound.current++;
          }
        }
      } else if (enemiesRef.current.length === 0 && explosionsRef.current.length === 0) {
        // Round Complete
        endRound();
      }

      // Update Enemies
      enemiesRef.current = enemiesRef.current.filter(enemy => {
        enemy.progress += enemy.speed * dt;
        enemy.x = enemy.x + (enemy.targetX - enemy.x) * (enemy.speed * dt / (1 - enemy.progress + 0.0001));
        enemy.y = enemy.y + (enemy.targetY - enemy.y) * (enemy.speed * dt / (1 - enemy.progress + 0.0001));

        // Draw Watermelon Enemy
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(enemy.progress * 15); // Rotation effect
        
        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#4caf50';

        // Watermelon Body
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 11, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#2d5a27';
        ctx.fill();
        
        // Stripes
        ctx.strokeStyle = '#1b3a1a';
        ctx.lineWidth = 1.5;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 3, -9);
          ctx.quadraticCurveTo(i * 5, 0, i * 3, 9);
          ctx.stroke();
        }
        ctx.restore();

        // Cool Trail
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(76, 175, 80, 0.4)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        const trailLen = 0.08;
        ctx.moveTo(enemy.x, enemy.y);
        ctx.lineTo(
          enemy.x - (enemy.targetX - enemy.x) * trailLen, 
          enemy.y - (enemy.targetY - enemy.y) * trailLen
        );
        ctx.stroke();

        // Check Hit
        if (enemy.progress >= 1) {
          // Impact!
          const targetCity = citiesRef.current.find(c => Math.abs(c.x - enemy.targetX) < 5 && Math.abs(c.y - enemy.targetY) < 5);
          if (targetCity) targetCity.isDestroyed = true;
          
          const targetTurret = turretsRef.current.find(t => Math.abs(t.x - enemy.targetX) < 5 && Math.abs(t.y - enemy.targetY) < 5);
          if (targetTurret) targetTurret.isDestroyed = true;

          // Check GameOver
          if (turretsRef.current.every(t => t.isDestroyed)) {
            setGameState('GAMEOVER');
          }

          return false;
        }
        return true;
      });

      // Update Interceptors
      interceptorsRef.current = interceptorsRef.current.filter(missile => {
        missile.progress += missile.speed * dt;
        const curX = missile.startX + (missile.targetX - missile.startX) * missile.progress;
        const curY = missile.startY + (missile.targetY - missile.startY) * missile.progress;
        missile.x = curX;
        missile.y = curY;

        // Draw Target X
        ctx.beginPath();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        const s = 3;
        ctx.moveTo(missile.targetX - s, missile.targetY - s);
        ctx.lineTo(missile.targetX + s, missile.targetY + s);
        ctx.moveTo(missile.targetX + s, missile.targetY - s);
        ctx.lineTo(missile.targetX - s, missile.targetY + s);
        ctx.stroke();

        // Draw Interceptor
        ctx.beginPath();
        ctx.strokeStyle = '#44ff44';
        ctx.lineWidth = 1;
        ctx.moveTo(missile.startX, missile.startY);
        ctx.lineTo(curX, curY);
        ctx.stroke();

        if (missile.progress >= 1) {
          // Create Explosion
          explosionsRef.current.push({
            id: Math.random().toString(),
            x: missile.targetX,
            y: missile.targetY,
            radius: 2,
            maxRadius: EXPLOSION_MAX_RADIUS,
            growthRate: EXPLOSION_GROWTH,
            isShrinking: false
          });
          return false;
        }
        return true;
      });

      // Update Explosions
      explosionsRef.current = explosionsRef.current.filter(exp => {
        if (!exp.isShrinking) {
          exp.radius += exp.growthRate * dt;
          if (exp.radius >= exp.maxRadius) exp.isShrinking = true;
        } else {
          exp.radius = Math.max(0, exp.radius - (exp.growthRate * 0.5) * dt);
        }

        // Draw Explosion
        if (exp.radius > 0) {
          const alpha = exp.isShrinking ? exp.radius / exp.maxRadius : 1;
          ctx.beginPath();
          ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(255, 200, 50, ${alpha})`;
          ctx.stroke();
        }

        // Check Collision with Enemies
        enemiesRef.current = enemiesRef.current.filter(enemy => {
          const dx = enemy.x - exp.x;
          const dy = enemy.y - exp.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < exp.radius) {
            setScore(prev => {
              const newScore = prev + POINTS_PER_ROCKET;
              if (newScore >= WIN_SCORE) setGameState('WIN');
              return newScore;
            });
            enemiesDestroyedInRound.current++;
            return false;
          }
          return true;
        });

        return exp.radius > 0;
      });

      // Draw Cities & Turrets
      citiesRef.current.forEach(city => {
        if (!city.isDestroyed) {
          ctx.fillStyle = '#4a9eff';
          ctx.fillRect(city.x - 15, city.y, 30, 20);
          ctx.fillStyle = '#2a7eff';
          ctx.fillRect(city.x - 10, city.y - 10, 20, 10);
        }
      });

      turretsRef.current.forEach(turret => {
        if (!turret.isDestroyed) {
          ctx.fillStyle = '#888';
          ctx.beginPath();
          ctx.moveTo(turret.x - 20, turret.y + 20);
          ctx.lineTo(turret.x + 20, turret.y + 20);
          ctx.lineTo(turret.x, turret.y - 10);
          ctx.closePath();
          ctx.fill();
          
          // Ammo indicator
          ctx.fillStyle = '#fff';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(turret.missiles.toString(), turret.x, turret.y + 35);
        }
      });

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, dimensions, round, endRound]);

  const handleFire = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'PLAYING') return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Find best turret (nearest with ammo)
    let bestTurret: Turret | null = null;
    let minDist = Infinity;

    turretsRef.current.forEach(t => {
      if (!t.isDestroyed && t.missiles > 0) {
        const d = Math.abs(t.x - x);
        if (d < minDist) {
          minDist = d;
          bestTurret = t;
        }
      }
    });

    if (bestTurret) {
      (bestTurret as Turret).missiles -= 1;
      interceptorsRef.current.push({
        id: Math.random().toString(),
        startX: bestTurret.x,
        startY: bestTurret.y,
        x: bestTurret.x,
        y: bestTurret.y,
        targetX: x,
        targetY: y,
        speed: 0.05,
        progress: 0
      });
    }
  };

  const startGame = () => {
    initLevel(dimensions.width, dimensions.height, true);
    setGameState('PLAYING');
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen bg-black overflow-hidden font-sans select-none touch-none"
    >
      {/* Background Stars */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        {[...Array(50)].map((_, i) => (
          <div 
            key={i}
            className="absolute bg-white rounded-full"
            style={{
              width: Math.random() * 2 + 'px',
              height: Math.random() * 2 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
              animation: `pulse ${Math.random() * 3 + 2}s infinite`
            }}
          />
        ))}
      </div>

      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={handleFire}
        onTouchStart={handleFire}
        className="block cursor-crosshair"
      />

      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-white font-mono text-lg">{t.score}: {score} / {WIN_SCORE}</span>
          </div>
          <div className="text-white/50 text-xs px-4">
            {t.instructions}
          </div>
        </div>

        <button 
          onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
          className="pointer-events-auto bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors border border-white/10"
        >
          <Globe className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {gameState === 'START' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-50"
          >
            <motion.h1 
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter text-center"
            >
              {t.title.split(' ').map((word, i) => (
                <span key={i} className={i === 1 ? "text-blue-500" : ""}>{word} </span>
              ))}
            </motion.h1>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startGame}
              className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-xl shadow-lg shadow-blue-500/20 flex items-center gap-3"
            >
              <Target className="w-6 h-6" />
              {t.start}
            </motion.button>
          </motion.div>
        )}

        {gameState === 'ROUND_END' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-50"
          >
            <div className="bg-white/10 p-12 rounded-3xl border border-white/20 flex flex-col items-center shadow-2xl">
              <h2 className="text-4xl font-bold text-white mb-2">{t.round} {round} 完成</h2>
              <p className="text-blue-200 mb-8 text-xl">{t.score}: {score}</p>
              <button
                onClick={nextRound}
                className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-xl flex items-center gap-3"
              >
                <RotateCcw className="w-6 h-6" />
                {t.nextRound}
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'WIN' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-blue-900/40 backdrop-blur-md z-50"
          >
            <div className="bg-black/80 p-12 rounded-3xl border-2 border-yellow-500/50 flex flex-col items-center shadow-2xl">
              <Trophy className="w-24 h-24 text-yellow-400 mb-6" />
              <h2 className="text-4xl font-bold text-white mb-2">{t.win}</h2>
              <p className="text-blue-200 mb-8">{t.winMsg}</p>
              <button
                onClick={startGame}
                className="px-12 py-4 bg-yellow-500 hover:bg-yellow-400 text-black rounded-full font-bold text-xl flex items-center gap-3"
              >
                <RotateCcw className="w-6 h-6" />
                {t.restart}
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'GAMEOVER' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/40 backdrop-blur-md z-50"
          >
            <div className="bg-black/80 p-12 rounded-3xl border-2 border-red-500/50 flex flex-col items-center shadow-2xl">
              <Shield className="w-24 h-24 text-red-500 mb-6" />
              <h2 className="text-4xl font-bold text-white mb-2">{t.gameover}</h2>
              <p className="text-red-200 mb-8">{t.lossMsg}</p>
              <button
                onClick={startGame}
                className="px-12 py-4 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold text-xl flex items-center gap-3"
              >
                <RotateCcw className="w-6 h-6" />
                {t.restart}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
