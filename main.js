/* ============================================================
   DEEP SEA SCROLL — 深海を潜る
   main.js
   ============================================================ */

/* ── 深度→色マップ ──────────────────────────────────────
   海面の空色 → 青 → 紺 → 深海の黒。
   stops[i] = [depth(m), [r,g,b]]
   ──────────────────────────────────────────────────────── */
const COLOR_STOPS = [
  [    0, [142, 201, 230]],  // 海面: 空色
  [  200, [ 52, 138, 186]],  // 太陽光帯の底: 明るい青
  [  600, [ 20,  88, 140]],  // 薄明帯: まだ青い
  [ 1000, [ 14,  56, 104]],  // 光が消える: 青黒
  [ 2500, [ 14,  32,  76]],  // 深海带: 青紫
  [ 5000, [ 24,  20,  70]],  // 超深海带: 紫
  [ 8000, [ 42,  16,  62]],  // ハデス帯: 赤紫
  [10911, [ 14,   6,  26]],  // チャレンジャー深淵: 暗紫（完全黒にしない）
];

const MAX_DEPTH = 10911;
const lerp = (a, b, t) => a + (b - a) * t;

function colorAtDepth(depth) {
  const d = Math.max(0, Math.min(depth, MAX_DEPTH));
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const [d0, c0] = COLOR_STOPS[i];
    const [d1, c1] = COLOR_STOPS[i + 1];
    if (d <= d1) {
      const t = (d - d0) / (d1 - d0);
      return c0.map((v, k) => Math.round(lerp(v, c1[k], t)));
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1][1];
}

/* 発光色相: 浅瀬=白っぽい → 中層=シアン → 超深海=紫 */
function hueAtDepth(depth) {
  const p = Math.min(depth / MAX_DEPTH, 1);
  if (p < 0.3) return 195;
  if (p < 0.6) return 195 - (p - 0.3) * 50;   // 195 → 180
  return lerp(180, 290, (p - 0.6) / 0.4);     // 180 → 290(紫)
}

/* ── 要素参照 ── */
const zones        = document.querySelectorAll('.zone');
const depthNumEl   = document.getElementById('depth-num');
const zoneNameEl   = document.getElementById('zone-name');
const bubbleHud    = document.getElementById('bubble-hud');
const bubbleLayer  = document.getElementById('bubble-layer');

const ZONE_NAMES = [
  '太陽光帯', '薄明帯', '深海带', '超深海带', 'ハデス帯', '最深部',
];

/* ── スクロール位置 → 深度 ──
   セクションに data-depth が付いているので、
   ビューポート中心がどの2点間にいるかで線形補間する */
function depthAtScroll() {
  const yMid = window.scrollY + window.innerHeight * 0.5;
  let depth = 0;
  let prev  = { y: 0, d: 0 };

  for (const z of zones) {
    const top = z.offsetTop;
    const d   = Number(z.dataset.depth);
    if (yMid >= top) {
      // このセクション内（または通過済み）
      const t = Math.min(1, (yMid - prev.y) / Math.max(1, top - prev.y));
      depth = lerp(prev.d, d, t);
      prev  = { y: top, d };
    } else {
      // 次セクションとの間
      const t = Math.min(1, (yMid - prev.y) / Math.max(1, top - prev.y));
      return lerp(prev.d, d, t);
    }
  }
  return depth;
}

/* ============================================================
   生物発光プランクトン
   浅瀬 = 少なくて小さい / 深いほど 増えて明るく瞬く
   （update() より先に定義すること：TDZ 回避）
   ============================================================ */
const canvas = document.getElementById('plankton');
const ctx = canvas.getContext('2d');
let W, H;
function resizeCanvas() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let particles = [];

/* kind: 'glow' = 生物発光（瞬く）/ 'snow' = マリンスノー（ゆっくり落ちる） */
function spawnParticle(kind) {
  if (kind === 'snow') {
    return {
      kind,
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() * 1.4 + 0.5,
      speedX: (Math.random() - 0.5) * 0.08,
      speedY: Math.random() * 0.5 + 0.2,   // 下向き
      baseOpacity: Math.random() * 0.2 + 0.08,
      phase: 0, twinkle: 0, hue: 0,
    };
  }
  return {
    kind,
    x: Math.random() * W,
    y: Math.random() * H,
    size: Math.random() * 1.8 + 0.4,
    speedX: (Math.random() - 0.5) * 0.15,
    speedY: (Math.random() - 0.5) * 0.3,
    baseOpacity: Math.random() * 0.5 + 0.1,
    phase: Math.random() * Math.PI * 2,
    twinkle: Math.random() * 0.02 + 0.004,
    hue: Math.random() > 0.25 ? 185 : 265,   // シアン多め、たまに紫
  };
}

function updatePlankton(depth) {
  const p = Math.min(depth / MAX_DEPTH, 1);
  const total = Math.round(lerp(16, 120, p));          // 浅瀬16 → 深海120
  /* マリンスノー: 400m以降で混ざりはじめ、深海では最大45% */
  const snowRatio = depth < 400 ? 0 : Math.min(0.45, (depth - 400) / 9000);
  const snowTarget = Math.round(total * snowRatio);
  const glowTarget = total - snowTarget;

  let glowCount = 0, snowCount = 0;
  const next = [];
  for (const pt of particles) {
    if (pt.kind === 'snow' && snowCount < snowTarget) { next.push(pt); snowCount++; }
    else if (pt.kind === 'glow' && glowCount < glowTarget) { next.push(pt); glowCount++; }
  }
  while (glowCount < glowTarget) { next.push(spawnParticle('glow')); glowCount++; }
  while (snowCount < snowTarget) { next.push(spawnParticle('snow')); snowCount++; }
  particles = next;
}

function animatePlankton() {
  ctx.clearRect(0, 0, W, H);
  for (const pt of particles) {
    if (pt.kind === 'snow') {
      /* マリンスノー: 白い粒が静かに降る */
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(230, 238, 250, ${pt.baseOpacity})`;
      ctx.fill();
    } else {
      /* 生物発光: 瞬く */
      pt.phase += pt.twinkle;
      const a = pt.baseOpacity * (0.5 + 0.5 * Math.sin(pt.phase));
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${pt.hue}, 100%, 72%, ${a})`;
      ctx.fill();
    }

    pt.x += pt.speedX;
    pt.y += pt.speedY;
    if (pt.y < -5) pt.y = H + 5;
    if (pt.y > H + 5) pt.y = -5;
    if (pt.x < -5) pt.x = W + 5;
    if (pt.x > W + 5) pt.x = -5;
  }
  requestAnimationFrame(animatePlankton);
}

/* ── メイン更新 ── */
function update() {
  const depth = depthAtScroll();
  const p = Math.min(depth / MAX_DEPTH, 1);

  /* 背景色 */
  const [r, g, b] = colorAtDepth(depth);
  document.body.style.backgroundColor = `rgb(${r},${g},${b})`;

  /* 発光量・色相（CSS変数 → text-shadow が自動で光る） */
  document.body.style.setProperty('--glow', (p * 26).toFixed(1));
  document.body.style.setProperty('--glow-hue', hueAtDepth(depth).toFixed(0));

  /* HUD */
  depthNumEl.textContent = Math.round(depth).toLocaleString();

  /* 現在深度帯 */
  let zi = -1;
  zones.forEach((z, i) => {
    const r2 = z.getBoundingClientRect();
    if (r2.top < window.innerHeight * 0.6 && r2.bottom > 0) zi = i;
  });
  if (zi >= 0) zoneNameEl.textContent = ZONE_NAMES[zi] || '潜航中';

  /* リビール */
  document.querySelectorAll('.reveal').forEach(el => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.85) {
      el.classList.add('visible');
    }
  });

  /* プランクトン密度更新 */
  updatePlankton(depth);
}

window.addEventListener('scroll', update, { passive: true });
window.addEventListener('resize', update);
animatePlankton();
update();

/* ============================================================
   上昇泡システム
   （アビスの「上昇負荷」の海版 → 急に上ると泡が湧く）
   深くから急浮上したぶんだけ湧く・警告が出る
   ============================================================ */
let lastScrollY = window.scrollY;
let bubbleTimer = null;
let hudTimer = null;

function spawnBubbles(count) {
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'bubble';
    const size = Math.random() * 14 + 4;
    el.style.width = el.style.height = size + 'px';
    el.style.left = (Math.random() * 100) + 'vw';
    el.style.setProperty('--drift', ((Math.random() - 0.5) * 80) + 'px');
    el.style.animationDuration = (Math.random() * 2 + 2.4) + 's';
    bubbleLayer.appendChild(el);
    setTimeout(() => el.remove(), 4600);
  }
}

function checkAscent() {
  const y = window.scrollY;
  const up = lastScrollY - y;          // 上に動いた量
  lastScrollY = y;

  if (up > 140) {                       // 思い切り上に上がった
    const depth = depthAtScroll();
    const p = Math.min(depth / MAX_DEPTH, 1);
    // 浅い場所では泡不要（潜水士でも浅瀬は平気）
    if (p > 0.15) {
      spawnBubbles(Math.min(Math.round(up / 60), 8));
      bubbleHud.classList.add('on');
      clearTimeout(hudTimer);
      hudTimer = setTimeout(() => bubbleHud.classList.remove('on'), 1600);
    }
  }
}
window.addEventListener('scroll', checkAscent, { passive: true });
