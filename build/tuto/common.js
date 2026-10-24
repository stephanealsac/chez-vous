// Fonctions communes aux trois films : courbes, fenêtres temporelles, pièce illustrée, silhouette, doigt.
const $ = s => document.getElementById(s);
const clamp = v => Math.max(0, Math.min(1, v));
const ease = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
const easeOut = x => 1 - Math.pow(1 - x, 3);
const lerp = (a, b, u) => a + (b - a) * u;
// 0 avant a, monte a→b, tient jusqu'à c, descend c→d
const win = (t, a, b, c = 1e9, d = 1e9) => t < a ? 0 : t < b ? ease((t - a) / (b - a)) : t < c ? 1 : t < d ? 1 - ease((t - c) / (d - c)) : 0;
const seg = (t, a, b) => ease(clamp((t - a) / (b - a)));   // progression 0→1 entre a et b
const show = (el, v, tf) => { el.style.opacity = v; if (tf !== undefined) el.style.transform = tf; };

// Pièce : salon stylisé (mur, plinthe, parquet, console, vase, plante, livres). Échelle : 5.2 px par cm sur le mur.
const PX_CM = 5.2;
function roomHTML(id, withPainting = true) {
  return `<div class="room" id="${id}">
    <div class="wall"></div><div class="light"></div>
    <div class="skirt"></div><div class="floor"></div>
    <div class="shadowc"></div>
    <svg class="plant" viewBox="0 0 260 230" fill="none" stroke="#6f7a5c" stroke-width="5" stroke-linecap="round">
      <path d="M120 230 C110 170 70 140 30 120" /><path d="M30 120 c20 -20 60 -16 70 20 c-30 10 -60 0 -70 -20z" fill="#7d886a" stroke="none"/>
      <path d="M125 230 C130 160 150 110 200 70" /><path d="M200 70 c-30 -12 -62 20 -48 52 c26 -6 46 -28 48 -52z" fill="#8a9475" stroke="none"/>
      <path d="M122 230 C118 170 112 120 128 60" /><path d="M128 60 c22 10 30 44 6 64 c-22 -16 -22 -44 -6 -64z" fill="#6f7a5c" stroke="none"/>
      <path d="M126 230 C140 200 190 190 240 200" /><path d="M240 200 c-14 -26 -54 -30 -70 -4 c22 14 50 14 70 4z" fill="#7d886a" stroke="none"/>
    </svg>
    <div class="vase"></div>
    <div class="top"></div><div class="leg" style="left:104px"></div><div class="leg" style="left:584px"></div>
    <div class="books"></div>
    ${withPainting ? `<div class="hang" id="${id}-hang"><img src="frame-alpha.png" alt=""></div>` : ''}
    <div class="dots" id="${id}-dots"></div>
    <div class="vignette"></div>
  </div>`;
}
// tableau accroché : centre (cx, cy) en px, dimensions hors-tout en cm
function placeHang(el, cx, cy, wcm, hcm, k = PX_CM) {
  const w = wcm * k, h = hcm * k;
  el.style.left = (cx - w / 2) + 'px'; el.style.top = (cy - h / 2) + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px';
}
// points de détection : scintillent dans une zone, avec un germe fixe
function makeDots(el, n, x0, y0, w, h, seed = 7) {
  let s = seed; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  el.innerHTML = '';
  for (let i = 0; i < n; i++) { const d = document.createElement('i'); d.style.left = (x0 + rnd() * w) + 'px'; d.style.top = (y0 + rnd() * h) + 'px'; d.dataset.ph = rnd(); el.appendChild(d); }
}
function animDots(el, t, vis) {
  el.style.opacity = vis;
  for (const d of el.children) { const ph = +d.dataset.ph; d.style.opacity = 0.25 + 0.75 * Math.abs(Math.sin(t * 2.2 + ph * 6.28)); }
}

// Silhouette vue de dos (boîte 300 × 1000 ≈ 1,75 m) ; bras droit levé (tient le téléphone) ou baissé
function personHTML(id) {
  return `<div class="person" id="${id}"><svg width="300" height="1000" viewBox="0 0 300 1000">
    <g class="ink" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="150" cy="62" rx="50" ry="58"/>
      <path d="M132 110 h36 v34 h-36z"/>
      <path d="M92 142 Q150 118 208 142 L234 206 L220 442 Q150 472 80 442 L66 206 Z"/>
      <path d="M84 432 Q150 460 216 432 L222 522 Q150 548 78 522 Z"/>
      <path d="M84 512 L142 512 L136 942 L92 942 Z"/>
      <path d="M158 512 L216 512 L208 942 L164 942 Z"/>
      <ellipse cx="114" cy="955" rx="36" ry="15"/><ellipse cx="186" cy="955" rx="36" ry="15"/>
      <polyline id="${id}-armL" points="72,184 52,330 48,500" fill="none" stroke-width="44"/>
      <g id="${id}-armDown"><polyline points="228,184 246,330 240,500" fill="none" stroke-width="44"/><circle cx="240" cy="515" r="26"/></g>
      <g id="${id}-armUp"><polyline points="228,184 296,300 292,140" fill="none" stroke-width="44"/><circle cx="292" cy="126" r="30"/></g>
    </g></svg></div>`;
}

// Doigt (vient du bas à droite), bout à (0,0) du conteneur
function fingerHTML(id) {
  return `<svg class="finger" id="${id}" viewBox="0 0 260 520">
    <path d="M70 520 L70 150 C70 60 190 60 190 150 L190 520 Z" fill="#e9cdb5"/>
    <path d="M70 520 L70 150 C70 60 190 60 190 150 L190 520" fill="none" stroke="#c9a68c" stroke-width="3"/>
    <ellipse cx="130" cy="96" rx="40" ry="26" fill="#f2dccb" opacity=".75"/>
  </svg>`;
}
// place le bout du doigt sur (x, y) (le doigt pointe vers le haut-gauche)
function fingerAt(el, x, y, press = 0, vis = 1) {
  el.style.left = (x - 130 + 14) + 'px'; el.style.top = (y - 60 - 8) + 'px';
  el.style.transform = `rotate(-18deg) scale(${1 - 0.06 * press})`; el.style.opacity = vis;
}
function rippleAt(el, x, y, t, t0, dur = .7) {
  if (t < t0 || t > t0 + dur) { el.style.opacity = 0; return; }
  const u = (t - t0) / dur; el.style.left = x + 'px'; el.style.top = y + 'px';
  el.style.opacity = (1 - u) * .9; el.style.transform = `scale(${0.3 + 1.1 * easeOut(u)})`;
}
