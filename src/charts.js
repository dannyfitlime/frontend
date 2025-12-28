import { t } from './i18n-core.js';

/* =======================================================================
   charts.js
   - Donuty (krok 4): renderMacroCharts({ c, f, p })
   ======================================================================= */

/* --------------------------- utilitky --------------------------------- */
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const dpr = () => (window.devicePixelRatio || 1);

function animate({ duration = 800, delay = 0, easing = 'outCubic', onUpdate, onDone }) {
  const easings = {
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    linear: t => t
  };
  const ease = easings[easing] || easings.outCubic;

  return new Promise(resolve => {
    let start = null;
    function tick(ts) {
      if (start === null) start = ts + delay;
      const elapsed = ts - start;
      if (elapsed < 0) { requestAnimationFrame(tick); return; }
      const t = clamp(elapsed / duration, 0, 1);
      const k = ease(t);
      onUpdate && onUpdate(k);
      if (t < 1) requestAnimationFrame(tick);
      else { onDone && onDone(); resolve(); }
    }
    requestAnimationFrame(tick);
  });
}

function runWhenVisible(el, cb) {
  if (!el) { cb(); return; }
  if (!('IntersectionObserver' in window)) { cb(); return; }
  const obs = new IntersectionObserver(entries => {
    const e = entries[0];
    if (e.isIntersecting) { obs.disconnect(); cb(); }
  }, { threshold: 0.15 });
  obs.observe(el);
}

/* --------------------------- DONUTY (krok 4) -------------------------- */
function drawDonut(canvas, percent, {
  color = '#111',
  bg = '#e5e7eb',
  size = (window.innerWidth <= 560 ? 100 : 140), // na mobilech menší
  thickness = (window.innerWidth <= 560 ? 12 : 16), // tenčí kroužek na mobilech
  textColor = '#111',
  font = '600 16px system-ui, sans-serif'
} = {}) {
  const ratio = dpr();
  const ctx = canvas.getContext('2d');
  canvas.width = size * ratio;
  canvas.height = size * ratio;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;

  // podklad
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = bg;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.stroke();

  // hodnota (max 100 % vizuálně, text = reálná hodnota)
  const sweep = clamp(percent, 0, 100) / 100 * Math.PI * 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + sweep, false);
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.stroke();

  // text
  ctx.fillStyle = textColor;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(percent)}%`, cx, cy);
}

const macroColors = {
  c: '#3B82F6',   // modrá
  f: '#F59E0B',   // oranžová
  p: '#E11D48'    // růžovo-červená (bílkoviny)
};

export async function renderMacroCharts({ c = 0, f = 0, p = 0 } = {}) {
  const cCv = document.getElementById('chart_c');
  const fCv = document.getElementById('chart_f');
  const pCv = document.getElementById('chart_p');
  const sCv = document.getElementById('chart_sum');
  if (!cCv || !fCv || !pCv || !sCv) return;

  runWhenVisible(cCv, async () => {
    const totalTarget = (+c || 0) + (+f || 0) + (+p || 0);
    const sumColor = (Math.round(totalTarget) === 100) ? '#10B981' : '#EF4444';

    // reset
    drawDonut(cCv, 0, { color: macroColors.c });
    drawDonut(fCv, 0, { color: macroColors.f });
    drawDonut(pCv, 0, { color: macroColors.p });
    drawDonut(sCv, 0, { color: sumColor });

    const one = 650; // délka animace pro 1 makro
    const gap = 80;  // pauza mezi makry
    const totalDuration = one * 3 + gap * 2;

    // SUMA animace bude trochu delší (např. o 25 %)
    animate({
      duration: totalDuration * 1.65,
      easing: 'inOutCubic',
      onUpdate: k => drawDonut(sCv, totalTarget * k, { color: sumColor })
    });

    // postupně makra
    await animate({
      duration: one,
      easing: 'outCubic',
      onUpdate: k => drawDonut(cCv, c * k, { color: macroColors.c })
    });
    await animate({ duration: gap, easing: 'linear', onUpdate: () => {} });

    await animate({
      duration: one,
      easing: 'outCubic',
      onUpdate: k => drawDonut(fCv, f * k, { color: macroColors.f })
    });
    await animate({ duration: gap, easing: 'linear', onUpdate: () => {} });

    await animate({
      duration: one,
      easing: 'outCubic',
      onUpdate: k => drawDonut(pCv, p * k, { color: macroColors.p })
    });
  });
}



/* =======================================================================
   DIET SIMULATOR – 0–150 %, makra = shoda s ideálem (55/20/25), ostatní absolutně
   Jednoduchý, realistický, edukativní výstup pro laiky
   ======================================================================= */

/* --- 1) DATA POTRAVIN (procentuální „příspěvky k obědu“) --- */
/* Pozn.: hodnoty u makro polí (carbs/protein/fat) slouží jako „makro tokeny“,
   ze kterých se počítá poměr v rámci vybraných jídel. */
const DIET_FOODS = {

  /* === ZDRAVÉ === */
  chicken: { energy: 28.2, protein: 79.7, fat: 25.0, carbs: 0.0, fiber: 0.0,  cholesterol: 60.0, sodium: 52.5  },
  rice: { energy: 33.3, protein: 10.3, fat: 3.5, carbs: 55.3, fiber: 5.0, cholesterol: 0.0, sodium: 12.0  },
  salad: { energy: 6.0, protein: 5.1, fat: 0.0, carbs: 9.2, fiber: 20.7, cholesterol: 0.0, sodium: 6.6},
  avocado: { energy: 19.1, protein: 3.6, fat: 69.4, carbs: 7.9, fiber: 41.3, cholesterol: 0.0,sodium: 4.9 },
  apple: { energy: 13.3, protein: 1.3, fat: 2.1, carbs: 27.6, fiber: 33.1, cholesterol: 0.0, sodium: 1.0 },


  // NEZDRAVÉ
  fries:    { energy:55, protein:8,  fat:45, carbs:30, fiber:4, cholesterol:50,  sodium:80 },
  burger:   { energy:80, protein:65, fat:55, carbs:35, fiber:5, cholesterol:130, sodium:140 },
  icecream: { energy:40, protein:3,  fat:35, carbs:40, fiber:0, cholesterol:25,  sodium:15 },
  hotdog:   { energy:50, protein:55, fat:40, carbs:18, fiber:0, cholesterol:70,  sodium:120 },
  donut:    { energy:50, protein:2,  fat:30, carbs:45, fiber:0, cholesterol:20,  sodium:25 }
  };


/* -------------------- 2) NUTRIENTY -------------------- */

const DIET_NUTS = [
  { key: "energy",      label: () => t("home.diet.chart.nutrients.energy") },
  { key: "carbs",       label: () => t("home.diet.chart.nutrients.carbs") },
  { key: "fat",         label: () => t("home.diet.chart.nutrients.fat") },
  { key: "protein",     label: () => t("home.diet.chart.nutrients.protein") },
  { key: "fiber",       label: () => t("home.diet.chart.nutrients.fiber") },
  { key: "cholesterol", label: () => t("home.diet.chart.nutrients.cholesterol") },
  { key: "sodium",      label: () => t("home.diet.chart.nutrients.sodium") }
];


const MAX_DISPLAY = 150;
const BASE_RED_RATIO = 0.05; // 5 % grafu


/* -------------------- 4) Součet -------------------- */

function diet_sumSelected() {
  const t = { energy:0, protein:0, fat:0, carbs:0, fiber:0, cholesterol:0, sodium:0 };

  document.querySelectorAll(".diet-food-list input[type=checkbox]")
    .forEach(cb => {
      if (!cb.checked) return;
      const f = DIET_FOODS[cb.value];
      if (!f) return;
      for (const k in t) t[k] += f[k];
    });

  // korektní maximum
  for (const k in t) t[k] = clamp(t[k], 0, MAX_DISPLAY);

  return t;
}


/* -------------------- 5) Barvy podle zón -------------------- */

function diet_getColor(nut, val) {
  const v = val;

  // cholesterol / sodium → speciální škála
  if (nut === "cholesterol" || nut === "sodium") {
    if (v <= 100) return "#007618ff"; // zelená
    if (v <= 120) return "#F59E0B"; // oranžová
    return "#a90000ff";               // červená
  }

  // klasická zóna
  if (v <= 70)  return "#a90000ff"; // červená
  if (v <= 85)  return "#F59E0B"; // oranžová
  if (v <= 115) return "#007618ff"; // zelená
  if (v <= 130) return "#F59E0B"; // oranžová
  return "#a90000ff";               // červená
}


/* -------------------- 6) Kreslení grafu -------------------- */
function diet_isAnySelected() {
  return [...document.querySelectorAll(".diet-food-list input[type=checkbox]")]
    .some(cb => cb.checked);
}
function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  let line = "";
  let lines = [];

  for (let w of words) {
    const testLine = line + w + " ";
    if (ctx.measureText(testLine).width > maxWidth) {
      lines.push(line.trim());
      line = w + " ";
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());
  return lines;
}

function diet_drawChart(canvas, totals) {

  const ratio = dpr();
  let Wcss = canvas.parentElement.clientWidth || 900;

  /* mobilní režim → širší graf */
  if (window.innerWidth < 600) {
    Wcss = 600;  // můžeš upravit např. na 1300, 1500…
  }

  const Hcss = 420;

  canvas.width  = Wcss * ratio;
  canvas.height = Hcss * ratio;
  canvas.style.width = Wcss + "px";
  canvas.style.height = Hcss + "px";

  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, Wcss, Hcss);

  const pad = { top: 30, right: 20, bottom: 70, left: 20 };
  const chartW = Wcss - pad.left - pad.right;
  const chartH = Hcss - pad.top - pad.bottom;
  const baseH = chartH * BASE_RED_RATIO;
  const usableH = chartH - baseH;

 // --- GRID --- //

  ctx.strokeStyle = "#E5E7EB";
  [0, 50, 100, 150].forEach(v => {
    const y = pad.top + chartH - baseH - usableH * (v / MAX_DISPLAY);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
  });

  // pokud nic není vybráno → zobraz text s animací
if (!diet_isAnySelected()) {

  let phase = (performance.now() / 1000) % (Math.PI * 2);
  let scale = 1 + Math.sin(phase * 2) * 0.01; // jemné 3% pulzování

  ctx.save();
  ctx.translate(Wcss / 2, Hcss / 2);
  ctx.scale(scale, scale);

  const message = t("home.diet.chart.noSelection");
  ctx.fillStyle = "#005003df";
  ctx.font = "600 40px system-ui";
  ctx.textAlign = "center";

  const maxTextWidth = Wcss * 1;
  const lines = wrapText(ctx, message, maxTextWidth);
  const yOffset = -90;
  lines.forEach((line, i) => {
    ctx.fillText(line, 0, yOffset + i * 52);
  });

  ctx.restore();

  requestAnimationFrame(() => diet_drawChart(canvas, totals));
  return;
}

  // ==================== Sloupce ====================
  const groups = DIET_NUTS.length;
  const gap = window.innerWidth > 900 ? 30 : 14;
  const barW = (chartW - gap * (groups - 1)) / groups;

  DIET_NUTS.forEach((nut, i) => {
    const x = pad.left + i * (barW + gap);
    const val = totals[nut.key];
    const r = val / MAX_DISPLAY;
    const barH = usableH * r;
    const baseY = pad.top + chartH;

    // --- 1) základní proužek (stejná barva jako sloupec, bez průhlednosti) ---
    const baseH = chartH * BASE_RED_RATIO;
    const color = diet_getColor(nut.key, val);

    ctx.fillStyle = color;
    ctx.fillRect(x, baseY - baseH, barW, baseH);

    // --- 2) skutečný sloupec ---
    ctx.fillStyle = color;
    ctx.fillRect(x, baseY - baseH - barH, barW, barH);

    // --- 3) text nad vrchní částí sloupce ---
    ctx.fillStyle = "#111";
    ctx.font = "600 15px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(Math.round(val) + "%", x + barW/2, baseY - baseH - barH - 6);

    // --- 4) popisek pod sloupcem ---
    const labelText = typeof nut.label === "function" ? nut.label() : nut.label;
    ctx.fillStyle = "#000000ff";
    ctx.font = "600 15px system-ui";
    ctx.fillText(labelText, x + barW/2, baseY + 30);
    ctx.fillStyle = "#111";

    // --- 100% line --- //
    const y100 = pad.top + chartH - baseH - usableH * (100 / MAX_DISPLAY);
    ctx.strokeStyle = "#007618ae";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad.left, y100);
    ctx.lineTo(pad.left + chartW, y100);
    ctx.stroke();
    
    // === popisek 100% s pozadím a zaoblenými rohy ===
    const label = t("home.diet.chart.recommended");
    ctx.font = "600 15px system-ui";
    ctx.textAlign = "right";

    const tw = ctx.measureText(label).width;
    const tx = pad.left + chartW;
    const ty = y100;

    const padX = 6;
    const padY = 4;
    const boxWidth  = tw + padX * 2;
    const boxHeight = 20 + padY * 2;
    const radius = 8; // ← poloměr zaoblení rohů

    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.beginPath();
    ctx.roundRect(
      tx - boxWidth,      // x
      ty - 15 - padY,     // y
      boxWidth,           // width
      boxHeight,          // height
      radius              // zaoblení rohů
    );
    ctx.fill();

    // text navrch
    ctx.fillStyle = "#111";
    ctx.fillText(label, tx, ty);

  });
}



/* -------------------- 7) Animace -------------------- */

let DIET_prevTotals = null;

function diet_animateTo(totals) {
  const start = DIET_prevTotals || { energy:0, protein:0, fat:0, carbs:0, fiber:0, cholesterol:0, sodium:0 };
  const delta = {};
  for (const k in totals) delta[k] = totals[k] - start[k];

  animate({
    duration: 600,
    easing: t => 1 - Math.pow(1 - t, 3),
    onUpdate: k => {
      const step = {};
      for (const kk in totals) step[kk] = start[kk] + delta[kk] * k;
      diet_drawChart(document.getElementById("dietChart"), step);
    },
    onDone: () => DIET_prevTotals = totals
  });
}


/* -------------------- 8) Health score -------------------- */

function diet_computeScore(t) {
  let s = 100;

  if (t.fat > 115) s -= 15;
  if (t.cholesterol > 100) s -= 15;
  if (t.sodium > 150) s -= 15;

  s += Math.min(t.fiber, 60) * 0.2;
  return clamp(s, 0, 100);
}


/* -------------------- 9) INIT -------------------- */

function initDietSimulator() {

  const cv = document.getElementById("dietChart");
  if (!cv) return;

  DIET_prevTotals = {
    energy:0, protein:0, fat:0, carbs:0, fiber:0, cholesterol:0, sodium:0
  };

  diet_drawChart(cv, DIET_prevTotals);

  document
    .querySelectorAll(".diet-food-list input[type=checkbox]")
    .forEach(cb => cb.addEventListener("change", () => {
      const totals = diet_sumSelected();
      diet_animateTo(totals);

      const scoreEl = document.getElementById("dietScore");
      if (scoreEl) scoreEl.textContent = Math.round(diet_computeScore(totals));
    }));

  window.addEventListener("resize", () =>
    diet_drawChart(cv, DIET_prevTotals)
  );
}

document.addEventListener("DOMContentLoaded", initDietSimulator);








