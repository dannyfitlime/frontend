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
      const tParam = clamp(elapsed / duration, 0, 1);
      const k = ease(tParam);
      onUpdate && onUpdate(k);
      if (tParam < 1) requestAnimationFrame(tick);
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

const DIET_HEALTHY_DEFAULT = ["chicken", "rice", "salad", "avocado", "apple"];

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

function diet_sumSelected() {
  const tot = { energy:0, protein:0, fat:0, carbs:0, fiber:0, cholesterol:0, sodium:0 };
  document.querySelectorAll(".diet-food-list input[type=checkbox]")
    .forEach(cb => {
      if (!cb.checked) return;
      const f = DIET_FOODS[cb.value];
      if (!f) return;
      for (const k in tot) tot[k] += f[k];
    });

  for (const k in tot) tot[k] = clamp(tot[k], 0, MAX_DISPLAY);
  return tot;
}

function diet_getColor(val, nut = "") {
    const isReverse = nut === "cholesterol" || nut === "sodium" || nut === "c12" || nut === "c23" || nut === "c9" || nut.startsWith("c9") || nut.startsWith("Nasycené");
    if (isReverse) {
        if (val <= 100) return "#10b981";
        if (val <= 120) return "#f59e0b";
        return "#ef4444";
    }
    const isInfinite = nut === "fiber" || nut === "c4" || nut === "Vláknina";
    if (isInfinite) {
        if (val <= 70) return "#ef4444";
        if (val <= 85) return "#f59e0b";
        return "#10b981";
    }
    if (val <= 70) return "#ef4444";
    if (val <= 85) return "#f59e0b";
    if (val <= 115) return "#10b981";
    if (val <= 130) return "#f59e0b";
    return "#ef4444";
}

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
      if (line) lines.push(line.trim());
      line = w + " ";
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line.trim());
  return lines;
}

function drawRadar(ctx, totals, Wcss, Hcss, isInteractive, definitions = DIET_NUTS) {
    const cx = Wcss / 2; const cy = Hcss / 2;
    const maxR = Math.min(cx, cy) - (isInteractive ? 70 : 35);
    const numAngles = definitions.length;

    const getXY = (value, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / numAngles;
        const r = (Math.min(value, MAX_DISPLAY) / MAX_DISPLAY) * maxR;
        return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    };

    [50, 100, MAX_DISPLAY].forEach(v => {
        ctx.beginPath();
        for (let i = 0; i < numAngles; i++) {
            const { x, y } = getXY(v, i);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        if (v === 100) {
            ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
            ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
        } else {
            ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
            ctx.lineWidth = 1; ctx.setLineDash([]);
        }
        ctx.stroke();
    });
    ctx.setLineDash([]);

    for (let i = 0; i < numAngles; i++) {
        const { x: xMax, y: yMax } = getXY(MAX_DISPLAY, i);
        ctx.beginPath();
        ctx.moveTo(cx, cy); ctx.lineTo(xMax, yMax);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.04)";
        ctx.lineWidth = 1; ctx.stroke();

        const { x: xLabel, y: yLabel } = getXY(MAX_DISPLAY + (isInteractive ? 55 : 20), i);
        const nutLabel = definitions[i].label;
        const labelText = typeof nutLabel === "function" ? nutLabel() : nutLabel;

        ctx.fillStyle = isInteractive ? "#475569" : "rgba(71, 85, 105, 0.7)";
        ctx.font = isInteractive ? "600 12px system-ui" : "500 10px system-ui";
        ctx.letterSpacing = "1px";

        const angle = -Math.PI / 2 + (Math.PI * 2 * i) / numAngles;
        if (Math.abs(Math.cos(angle)) < 0.1) ctx.textAlign = "center";
        else if (Math.cos(angle) > 0) ctx.textAlign = "left";
        else ctx.textAlign = "right";

        if (Math.abs(Math.sin(angle)) < 0.1) ctx.textBaseline = "middle";
        else if (Math.sin(angle) > 0) ctx.textBaseline = "top";
        else ctx.textBaseline = "bottom";

        const text = isInteractive ? labelText.toUpperCase() : labelText.substring(0, 3).toUpperCase();
        ctx.fillText(text, xLabel, yLabel);
    }

    ctx.beginPath();
    const points = [];
    for (let i = 0; i < numAngles; i++) {
        const nut = definitions[i];
        const val = totals[nut.key] || 0;
        const pt = getXY(val, i);
        points.push({ pt, val, key: nut.key });
        if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();

    const sumColors = points.reduce((acc, p) => acc + (diet_getColor(p.val, p.key) === "#10b981" ? 1 : 0), 0);
    let dominantColor = sumColors >= (numAngles / 2) ? "#10b981" : (sumColors >= (numAngles / 4) ? "#111111" : "#f59e0b");
    if (points.some(p => p.val > 140 && (p.key === 'fat' || p.key === 'sodium' || p.key === 'cholesterol'))) dominantColor = "#ef4444";
    if (numAngles > 10) dominantColor = "#10b981";

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    const rbgMap = { "#10b981": "16, 185, 129", "#111111": "17, 17, 17", "#f59e0b": "245, 158, 11", "#ef4444": "239, 68, 68" };
    const rgb = rbgMap[dominantColor] || "15, 23, 42";

    gradient.addColorStop(0, `rgba(${rgb}, ${isInteractive ? 0.2 : 0.15})`);
    gradient.addColorStop(1, `rgba(${rgb}, ${isInteractive ? 0.05 : 0.02})`);
    ctx.fillStyle = gradient; ctx.fill();
    ctx.lineWidth = isInteractive ? 3 : 2;
    ctx.strokeStyle = dominantColor;
    ctx.stroke();

    const dotSize = numAngles > 10 ? 3 : (isInteractive ? 6 : 4);
    points.forEach(({ pt, val, key }, i) => {
        const color = diet_getColor(val, key);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, dotSize, 0, Math.PI * 2);
        ctx.fillStyle = "#fff"; ctx.fill();
        ctx.strokeStyle = numAngles > 10 ? dominantColor : color;
        ctx.lineWidth = numAngles > 10 ? 1 : (isInteractive ? 2 : 1.5);
        ctx.stroke();

        if (isInteractive && numAngles <= 10) {
            ctx.fillStyle = "#0f172a"; ctx.font = "800 15px system-ui";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            const angle = -Math.PI / 2 + (Math.PI * 2 * i) / numAngles;
            const offset = val > 100 ? -24 : 26;
            ctx.fillText(Math.round(val) + "%", pt.x + Math.cos(angle) * offset, pt.y + Math.sin(angle) * offset);
        }
    });
}

function diet_drawChart(canvas, totals) {
  const ratio = dpr();
  let Wcss = canvas.parentElement.clientWidth || 550;
  if (Wcss > 900) Wcss = 900;
  const Hcss = Wcss > 600 ? 500 : 360;

  canvas.width  = Wcss * ratio;
  canvas.height = Hcss * ratio;
  canvas.style.width = Wcss + "px";
  canvas.style.height = Hcss + "px";

  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, Wcss, Hcss);

  if (!diet_isAnySelected()) {
    let phase = (performance.now() / 1000) % (Math.PI * 2);
    let scale = 1 + Math.sin(phase * 2) * 0.01;
    ctx.save();
    ctx.translate(Wcss / 2, Hcss / 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "800 24px system-ui";
    ctx.textAlign = "center";
    
    const message = t("home.diet.chart.noSelection");
    const lines = wrapText(ctx, message || "Klepněte na jídlo vlevo", Wcss * 0.8);
    lines.forEach((line, i) => {
      ctx.fillText(line, 0, -30 + i * 30);
    });

    ctx.strokeStyle = "rgba(0, 0, 0, 0.05)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 150, 0 + phase, Math.PI + phase); ctx.stroke();
    ctx.restore();

    requestAnimationFrame(() => diet_drawChart(canvas, totals));
    return;
  }
  
  drawRadar(ctx, totals, Wcss, Hcss, true, DIET_NUTS);
}

let DIET_prevTotals = null;

function diet_animateTo(totals) {
  const start = DIET_prevTotals || { energy:0, protein:0, fat:0, carbs:0, fiber:0, cholesterol:0, sodium:0 };
  const delta = {};
  for (const k in totals) delta[k] = totals[k] - start[k];

  animate({
    duration: 600,
    easing: 'outCubic',
    onUpdate: k => {
      const step = {};
      for (const kk in totals) step[kk] = start[kk] + delta[kk] * k;
      diet_drawChart(document.getElementById("dietChart"), step);
    },
    onDone: () => { DIET_prevTotals = totals; }
  });
}

function diet_computeScore(t) {
  if (!diet_isAnySelected()) return 0;
  let s = 100;
  if (t.fat > 115) s -= 15;
  if (t.cholesterol > 100) s -= 15;
  if (t.sodium > 150) s -= 15;
  s += Math.min(t.fiber, 60) * 0.2;
  return clamp(s, 0, 100);
}

function diet_updateTotals() {
  const totals = diet_sumSelected();
  diet_animateTo(totals);

  const scoreEl = document.getElementById("dietScore");
  if (scoreEl) scoreEl.textContent = Math.round(diet_computeScore(totals));
  return totals;
}

function initDietSimulator() {
  const cv = document.getElementById("dietChart");
  if (!cv) return;

  DIET_prevTotals = { energy:0, protein:0, fat:0, carbs:0, fiber:0, cholesterol:0, sodium:0 };
  diet_drawChart(cv, DIET_prevTotals);

  const scoreEl = document.getElementById("dietScore");
  if (scoreEl) scoreEl.textContent = "0";

  document
    .querySelectorAll(".diet-food-list input[type=checkbox]")
    .forEach(cb => cb.addEventListener("change", diet_updateTotals));

  const autoBtn = document.getElementById("dietAutoSelect");
  if (autoBtn) {
    autoBtn.addEventListener("click", () => {
      document
        .querySelectorAll(".diet-food-list input[type=checkbox]")
        .forEach(cb => {
          cb.checked = DIET_HEALTHY_DEFAULT.includes(cb.value);
        });
      diet_updateTotals();
    });
  }

  window.addEventListener("resize", () => diet_drawChart(cv, DIET_prevTotals));
}

document.addEventListener("DOMContentLoaded", initDietSimulator);
