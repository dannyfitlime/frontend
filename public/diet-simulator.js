import { t } from '/i18n-core.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const dpr = () => (window.devicePixelRatio || 1);

function animate({ duration = 800, easing = 'outCubic', onUpdate, onDone }) {
  const easings = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    linear: x => x,
  };
  const ease = easings[easing] || easings.outCubic;

  return new Promise(resolve => {
    let start = null;
    function tick(ts) {
      if (start === null) start = ts;
      const progress = clamp((ts - start) / duration, 0, 1);
      onUpdate?.(ease(progress));
      if (progress < 1) {
        requestAnimationFrame(tick);
        return;
      }
      onDone?.();
      resolve();
    }
    requestAnimationFrame(tick);
  });
}

const DIET_FOODS = {
  chicken: { energy: 28.2, protein: 79.7, fat: 25.0, carbs: 0.0, fiber: 0.0, cholesterol: 60.0, sodium: 52.5 },
  rice: { energy: 33.3, protein: 10.3, fat: 3.5, carbs: 55.3, fiber: 5.0, cholesterol: 0.0, sodium: 12.0 },
  salad: { energy: 6.0, protein: 5.1, fat: 0.0, carbs: 9.2, fiber: 20.7, cholesterol: 0.0, sodium: 6.6 },
  avocado: { energy: 19.1, protein: 3.6, fat: 69.4, carbs: 7.9, fiber: 41.3, cholesterol: 0.0, sodium: 4.9 },
  apple: { energy: 13.3, protein: 1.3, fat: 2.1, carbs: 27.6, fiber: 33.1, cholesterol: 0.0, sodium: 1.0 },
  fries: { energy: 55, protein: 8, fat: 45, carbs: 30, fiber: 4, cholesterol: 50, sodium: 80 },
  burger: { energy: 80, protein: 65, fat: 55, carbs: 35, fiber: 5, cholesterol: 130, sodium: 140 },
  icecream: { energy: 40, protein: 3, fat: 35, carbs: 40, fiber: 0, cholesterol: 25, sodium: 15 },
  hotdog: { energy: 50, protein: 55, fat: 40, carbs: 18, fiber: 0, cholesterol: 70, sodium: 120 },
  donut: { energy: 50, protein: 2, fat: 30, carbs: 45, fiber: 0, cholesterol: 20, sodium: 25 },
};

const DIET_HEALTHY_DEFAULT = ['chicken', 'rice', 'salad', 'avocado', 'apple'];
const DIET_NUTS = [
  { key: 'energy', label: () => t('home.diet.chart.nutrients.energy') },
  { key: 'carbs', label: () => t('home.diet.chart.nutrients.carbs') },
  { key: 'fat', label: () => t('home.diet.chart.nutrients.fat') },
  { key: 'protein', label: () => t('home.diet.chart.nutrients.protein') },
  { key: 'fiber', label: () => t('home.diet.chart.nutrients.fiber') },
  { key: 'cholesterol', label: () => t('home.diet.chart.nutrients.cholesterol') },
  { key: 'sodium', label: () => t('home.diet.chart.nutrients.sodium') },
];

const MAX_DISPLAY = 150;
const BASE_RED_RATIO = 0.05;
let previousTotals = null;

function dietIsAnySelected() {
  return [...document.querySelectorAll('.diet-food-list input[type=checkbox]')].some(cb => cb.checked);
}

function dietSumSelected() {
  const totals = { energy: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, cholesterol: 0, sodium: 0 };
  document.querySelectorAll('.diet-food-list input[type=checkbox]').forEach(cb => {
    if (!cb.checked) return;
    const food = DIET_FOODS[cb.value];
    if (!food) return;
    Object.keys(totals).forEach(key => {
      totals[key] += food[key];
    });
  });
  Object.keys(totals).forEach(key => {
    totals[key] = clamp(totals[key], 0, MAX_DISPLAY);
  });
  return totals;
}

function dietGetColor(nutrient, value) {
  if (nutrient === 'cholesterol' || nutrient === 'sodium') {
    if (value <= 100) return '#007618';
    if (value <= 120) return '#F59E0B';
    return '#a90000';
  }
  if (value <= 70) return '#a90000';
  if (value <= 85) return '#F59E0B';
  if (value <= 115) return '#007618';
  if (value <= 130) return '#F59E0B';
  return '#a90000';
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';

  words.forEach(word => {
    const candidate = `${line}${word} `;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line.trim());
      line = `${word} `;
      return;
    }
    line = candidate;
  });

  if (line) lines.push(line.trim());
  return lines;
}

function dietDrawChart(canvas, totals) {
  const ratio = dpr();
  let widthCss = canvas.parentElement.clientWidth || 900;
  if (window.innerWidth < 600) widthCss = 600;

  const heightCss = 420;
  canvas.width = widthCss * ratio;
  canvas.height = heightCss * ratio;
  canvas.style.width = `${widthCss}px`;
  canvas.style.height = `${heightCss}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, widthCss, heightCss);

  const pad = { top: 30, right: 20, bottom: 70, left: 20 };
  const chartW = widthCss - pad.left - pad.right;
  const chartH = heightCss - pad.top - pad.bottom;
  const baseH = chartH * BASE_RED_RATIO;
  const usableH = chartH - baseH;

  ctx.strokeStyle = '#E5E7EB';
  [0, 50, 100, 150].forEach(value => {
    const y = pad.top + chartH - baseH - usableH * (value / MAX_DISPLAY);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
  });

  if (!dietIsAnySelected()) {
    const phase = (performance.now() / 1000) % (Math.PI * 2);
    const scale = 1 + Math.sin(phase * 2) * 0.01;

    ctx.save();
    ctx.translate(widthCss / 2, heightCss / 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#005003df';
    ctx.font = '600 40px system-ui';
    ctx.textAlign = 'center';

    const lines = wrapText(ctx, t('home.diet.chart.noSelection'), widthCss);
    lines.forEach((line, index) => {
      ctx.fillText(line, 0, -90 + index * 52);
    });

    ctx.restore();
    requestAnimationFrame(() => dietDrawChart(canvas, totals));
    return;
  }

  const gap = window.innerWidth > 900 ? 30 : 14;
  const barW = (chartW - gap * (DIET_NUTS.length - 1)) / DIET_NUTS.length;

  DIET_NUTS.forEach((nut, index) => {
    const x = pad.left + index * (barW + gap);
    const value = totals[nut.key];
    const barH = usableH * (value / MAX_DISPLAY);
    const baseY = pad.top + chartH;
    const color = dietGetColor(nut.key, value);

    ctx.fillStyle = color;
    ctx.fillRect(x, baseY - baseH, barW, baseH);
    ctx.fillRect(x, baseY - baseH - barH, barW, barH);

    ctx.fillStyle = '#111';
    ctx.font = '600 15px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(value)}%`, x + barW / 2, baseY - baseH - barH - 6);
    ctx.fillText(nut.label(), x + barW / 2, baseY + 30);
  });

  const y100 = pad.top + chartH - baseH - usableH * (100 / MAX_DISPLAY);
  ctx.strokeStyle = '#007618ae';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad.left, y100);
  ctx.lineTo(pad.left + chartW, y100);
  ctx.stroke();

  const label = t('home.diet.chart.recommended');
  ctx.font = '600 15px system-ui';
  ctx.textAlign = 'right';
  const textWidth = ctx.measureText(label).width;
  const padX = 6;
  const padY = 4;
  const boxWidth = textWidth + padX * 2;
  const boxHeight = 20 + padY * 2;
  const tx = pad.left + chartW;

  ctx.fillStyle = 'rgba(255, 255, 255, 1)';
  ctx.beginPath();
  ctx.roundRect(tx - boxWidth, y100 - 15 - padY, boxWidth, boxHeight, 8);
  ctx.fill();

  ctx.fillStyle = '#111';
  ctx.fillText(label, tx, y100);
}

function dietAnimateTo(totals) {
  const start = previousTotals || { energy: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, cholesterol: 0, sodium: 0 };
  const delta = {};
  Object.keys(totals).forEach(key => {
    delta[key] = totals[key] - start[key];
  });

  animate({
    duration: 600,
    onUpdate: progress => {
      const step = {};
      Object.keys(totals).forEach(key => {
        step[key] = start[key] + delta[key] * progress;
      });
      dietDrawChart(document.getElementById('dietChart'), step);
    },
    onDone: () => {
      previousTotals = totals;
    },
  });
}

function updateDietTotals() {
  dietAnimateTo(dietSumSelected());
}

function initDietSimulator() {
  const canvas = document.getElementById('dietChart');
  if (!canvas) return;

  previousTotals = { energy: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, cholesterol: 0, sodium: 0 };
  dietDrawChart(canvas, previousTotals);

  document.querySelectorAll('.diet-food-list input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', updateDietTotals);
  });

  const autoBtn = document.getElementById('dietAutoSelect');
  autoBtn?.addEventListener('click', () => {
    document.querySelectorAll('.diet-food-list input[type=checkbox]').forEach(cb => {
      cb.checked = DIET_HEALTHY_DEFAULT.includes(cb.value);
    });
    updateDietTotals();
  });

  window.addEventListener('resize', () => {
    dietDrawChart(canvas, previousTotals);
  });
}

document.addEventListener('DOMContentLoaded', initDietSimulator);
