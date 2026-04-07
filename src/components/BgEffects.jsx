import { useEffect, useRef } from 'react';

// ═══ FAGULHAS (Sparks) ═══
function drawSparks(ctx, w, h, particles, dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.02 * dt; // gravity
    p.life -= dt * 0.008;
    if (p.life <= 0 || p.y > h + 10) {
      p.x = Math.random() * w;
      p.y = h + 5;
      p.vx = (Math.random() - 0.5) * 1.2;
      p.vy = -(Math.random() * 2 + 1);
      p.life = Math.random() * 0.7 + 0.3;
      p.size = Math.random() * 2.5 + 0.8;
    }
    const alpha = p.life * 0.8;
    const r = 200 + Math.random() * 55;
    const g = 120 + p.life * 80;
    const b = 20;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.fill();
    // glow
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life * 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.15})`;
    ctx.fill();
  }
}

// ═══ DINHEIRO (Money) ═══
function drawMoney(ctx, w, h, particles, dt) {
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  for (const p of particles) {
    p.y += p.vy * dt;
    p.x += Math.sin(p.phase) * 0.3 * dt;
    p.phase += 0.015 * dt;
    p.rot += p.rotSpeed * dt;
    if (p.y > h + 30) {
      p.y = -30;
      p.x = Math.random() * w;
      p.phase = Math.random() * Math.PI * 2;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot * Math.PI / 180);
    ctx.globalAlpha = p.alpha;
    ctx.fillText(p.char, 0, 0);
    ctx.restore();
  }
}

// ═══ RAIOS (Lightning) ═══
function drawLightning(ctx, w, h, state, dt) {
  state.timer -= dt;
  // Fade existing bolts
  for (const bolt of state.bolts) {
    bolt.alpha -= dt * 0.04;
  }
  state.bolts = state.bolts.filter(b => b.alpha > 0);

  if (state.timer <= 0) {
    // New bolt
    const startX = Math.random() * w * 0.8 + w * 0.1;
    const bolt = generateBolt(startX, 0, startX + (Math.random() - 0.5) * 200, h * (0.5 + Math.random() * 0.5), 6);
    bolt.alpha = 1;
    bolt.flash = 1;
    state.bolts.push(bolt);
    // Sometimes fork
    if (Math.random() > 0.4) {
      const forkIdx = Math.floor(bolt.points.length * (0.3 + Math.random() * 0.3));
      const forkPt = bolt.points[forkIdx];
      if (forkPt) {
        const fork = generateBolt(forkPt.x, forkPt.y, forkPt.x + (Math.random() - 0.5) * 180, h * (0.6 + Math.random() * 0.4), 4);
        fork.alpha = 0.8;
        fork.flash = 0.6;
        state.bolts.push(fork);
      }
    }
    state.timer = Math.random() * 120 + 60;
  }

  // Draw flash
  for (const bolt of state.bolts) {
    if (bolt.flash > 0) {
      ctx.fillStyle = `rgba(180,180,255,${bolt.flash * 0.04})`;
      ctx.fillRect(0, 0, w, h);
      bolt.flash -= dt * 0.08;
    }
  }

  // Draw bolts
  for (const bolt of state.bolts) {
    if (bolt.points.length < 2) continue;
    // Outer glow
    ctx.beginPath();
    ctx.moveTo(bolt.points[0].x, bolt.points[0].y);
    for (let i = 1; i < bolt.points.length; i++) {
      ctx.lineTo(bolt.points[i].x, bolt.points[i].y);
    }
    ctx.strokeStyle = `rgba(100,100,255,${bolt.alpha * 0.15})`;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Mid glow
    ctx.beginPath();
    ctx.moveTo(bolt.points[0].x, bolt.points[0].y);
    for (let i = 1; i < bolt.points.length; i++) {
      ctx.lineTo(bolt.points[i].x, bolt.points[i].y);
    }
    ctx.strokeStyle = `rgba(160,160,255,${bolt.alpha * 0.4})`;
    ctx.lineWidth = 5;
    ctx.stroke();

    // Core
    ctx.beginPath();
    ctx.moveTo(bolt.points[0].x, bolt.points[0].y);
    for (let i = 1; i < bolt.points.length; i++) {
      ctx.lineTo(bolt.points[i].x, bolt.points[i].y);
    }
    ctx.strokeStyle = `rgba(220,220,255,${bolt.alpha * 0.9})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Bright core
    ctx.beginPath();
    ctx.moveTo(bolt.points[0].x, bolt.points[0].y);
    for (let i = 1; i < bolt.points.length; i++) {
      ctx.lineTo(bolt.points[i].x, bolt.points[i].y);
    }
    ctx.strokeStyle = `rgba(255,255,255,${bolt.alpha * 0.7})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function generateBolt(x1, y1, x2, y2, detail) {
  const points = [{ x: x1, y: y1 }];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const segments = 8 + Math.floor(Math.random() * detail * 2);
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const jitter = (1 - Math.abs(t - 0.5) * 2) * detail * 12;
    points.push({
      x: x1 + dx * t + (Math.random() - 0.5) * jitter,
      y: y1 + dy * t + (Math.random() - 0.5) * jitter * 0.3,
    });
  }
  points.push({ x: x2, y: y2 });
  return { points, alpha: 1, flash: 1 };
}

// ═══ Componente Principal ═══
export default function BgEffects({ effect }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!effect || effect === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Init particles/state
    if (effect === 'sparks') {
      stateRef.current = Array.from({ length: 60 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -(Math.random() * 2 + 0.5),
        life: Math.random(),
        size: Math.random() * 2.5 + 0.8,
      }));
    } else if (effect === 'money') {
      const chars = ['$', '💰', '💵', '💲', '🪙', '$'];
      stateRef.current = Array.from({ length: 25 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vy: Math.random() * 0.5 + 0.3,
        phase: Math.random() * Math.PI * 2,
        rot: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 0.5,
        alpha: Math.random() * 0.3 + 0.1,
        char: chars[Math.floor(Math.random() * chars.length)],
      }));
    } else if (effect === 'lightning') {
      stateRef.current = { bolts: [], timer: Math.random() * 40 + 20 };
    }

    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - last) / 16.67, 3);
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (effect === 'sparks') drawSparks(ctx, canvas.width, canvas.height, stateRef.current, dt);
      else if (effect === 'money') drawMoney(ctx, canvas.width, canvas.height, stateRef.current, dt);
      else if (effect === 'lightning') drawLightning(ctx, canvas.width, canvas.height, stateRef.current, dt);

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [effect]);

  if (!effect || effect === 'none') return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      }}
    />
  );
}
