import { t } from '/i18n-core.js';

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const dpr = () => window.devicePixelRatio || 1;
function easeOutExpo(x) { return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); }

const _activeFrame = {};
function animate({ id = "def", duration, easing, onUpdate, onDone }) {
    if (_activeFrame[id]) cancelAnimationFrame(_activeFrame[id]);
    let start = performance.now();
    function step(now) {
        let p = (now - start) / Math.max(duration, 1);
        if (p >= 1) { onUpdate(easing(1)); if (onDone) onDone(); delete _activeFrame[id]; }
        else { onUpdate(easing(p)); _activeFrame[id] = requestAnimationFrame(step); }
    }
    _activeFrame[id] = requestAnimationFrame(step);
}

const DIET_FOODS = {
    chicken: { emoji: "🍗", energy: 28.2, protein: 79.7, fat: 25.0, carbs: 0.0, fiber: 0.0, cholesterol: 100.0, sodium: 75.5, isHealthy: true, name: "Kuřecí" },
    rice: { emoji: "🍚", energy: 33.3, protein: 10.3, fat: 3.5, carbs: 55.3, fiber: 5.0, cholesterol: 0.0, sodium: 12.0, isHealthy: true, name: "Rýže" },
    salad: { emoji: "🥗", energy: 6.0, protein: 5.1, fat: 0.0, carbs: 9.2, fiber: 20.7, cholesterol: 0.0, sodium: 6.6, isHealthy: true, name: "Salát" },
    avocado: { emoji: "🥑", energy: 19.1, protein: 3.6, fat: 69.4, carbs: 7.9, fiber: 41.3, cholesterol: 0.0, sodium: 4.9, isHealthy: true, name: "Avokádo" },
    apple: { emoji: "🍎", energy: 13.3, protein: 1.3, fat: 2.1, carbs: 27.6, fiber: 33.1, cholesterol: 0.0, sodium: 1.0, isHealthy: true, name: "Jablko" },
    fries: { emoji: "🍟", energy: 55, protein: 8, fat: 45, carbs: 30, fiber: 4, cholesterol: 50, sodium: 80, isHealthy: false, name: "Hranolky" },
    burger: { emoji: "🍔", energy: 80, protein: 65, fat: 55, carbs: 35, fiber: 5, cholesterol: 130, sodium: 140, isHealthy: false, name: "Burger" },
    icecream: { emoji: "🍦", energy: 40, protein: 3, fat: 35, carbs: 40, fiber: 0, cholesterol: 25, sodium: 15, isHealthy: false, name: "Zmrzlina" },
    hotdog: { emoji: "🌭", energy: 50, protein: 55, fat: 40, carbs: 18, fiber: 0, cholesterol: 70, sodium: 120, isHealthy: false, name: "Párek" },
    donut: { emoji: "🍩", energy: 50, protein: 2, fat: 30, carbs: 45, fiber: 0, cholesterol: 20, sodium: 25, isHealthy: false, name: "Kobliha" }
};

const DIET_HEALTHY_DEFAULT = ["chicken", "rice", "salad", "avocado", "apple"];
const DIET_NUTS = [
    { key: "energy", label: "Energie" }, { key: "carbs", label: "Sacharidy" },
    { key: "fat", label: "Tuky" }, { key: "protein", label: "Bílkoviny" },
    { key: "fiber", label: "Vláknina" }, { key: "cholesterol", label: "Cholesterol" },
    { key: "sodium", label: "Sodík" }
];

const COMPLEX_CATEGORIES = [
    "Energie", "Bílkoviny", "Tuky", "Sacharidy", "Vláknina", "Ovoce", "Zelenina", "Mléčné výrobky", "Ryby",
    "Nasycené tuky", "Mononenasycené tuky", "Polynenasycené tuky", "Cholesterol", "Vit. B1", "Vit. B2", "Vit. B6",
    "Vit. B12", "Vit. C", "Vit. D", "Vit. E", "Kyselina listová", "Hořčík", "Draslík", "Sodík", "Vápník", "Železo"
].map((lbl, idx) => ({ key: "c" + idx, label: lbl }));

const MAX_DISPLAY = 150;
const BASE_GRAMS = 400;
const STATE = {
    selected: new Set(),
    totals: {},
    displayedScore: 0,
    portionWeight: 400
};

function diet_getColor(val, key = "") {
    const isReverse = key === "cholesterol" || key === "sodium" || key === "c12" || key === "c23" || key === "c9" || key.startsWith("c9") || key.startsWith("Nasycené");
    if (isReverse) {
        if (val <= 100) return "#10b981";
        if (val <= 120) return "#f59e0b";
        return "#ef4444";
    }
    const isInfinite = key === "fiber" || key === "c4" || key === "Vláknina";
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

function diet_sumSelected() {
    const totals = { energy: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, cholesterol: 0, sodium: 0 };
    const multiplier = STATE.portionWeight / BASE_GRAMS;
    STATE.selected.forEach(val => { const f = DIET_FOODS[val]; if (f) for (const k in totals) totals[k] += f[k]; });
    for (const k in totals) totals[k] = totals[k] * multiplier;
    return totals;
}

function drawRadar(ctx, totals, Wcss, Hcss, isInteractive, definitions = DIET_NUTS) {
    const cx = Wcss / 2; const cy = Hcss / 2;
    const numAngles = definitions.length;
    const isCompactInteractive = isInteractive && numAngles > 10 && window.innerWidth < 900;
    const padding = numAngles > 10
        ? (isInteractive ? (isCompactInteractive ? Math.max(58, Math.round(Wcss * 0.08)) : Math.max(110, Math.round(Wcss * 0.14))) : 35)
        : (isInteractive ? 70 : 35);
    const maxR = Math.max(0, Math.min(cx, cy) - padding);

    const getCompactLabel = (labelText) => {
        if (labelText.startsWith("Vit.")) return labelText.replace("Vit. ", "").toUpperCase();
        const compactMap = {
            "Energie": "EN",
            "Cholesterol": "CHOL",
            "Ovoce": "OVO",
            "Zelenina": "ZEL",
            "Ryby": "RYB"
        };
        if (compactMap[labelText]) return compactMap[labelText];
        return labelText.slice(0, 3).toUpperCase();
    };

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

        const labelOffset = numAngles > 10 ? (isCompactInteractive ? 18 : 55) : (isInteractive ? 55 : 20);
        const { x: xLabel, y: yLabel } = getXY(MAX_DISPLAY + labelOffset, i);
        const labelText = definitions[i].label;

        ctx.fillStyle = isInteractive ? "#475569" : "rgba(71, 85, 105, 0.7)";
        ctx.font = isInteractive ? `${isCompactInteractive ? 700 : 600} ${isCompactInteractive ? 10 : 12}px system-ui` : "500 10px system-ui";
        ctx.letterSpacing = "1px";

        const angle = -Math.PI / 2 + (Math.PI * 2 * i) / numAngles;
        if (Math.abs(Math.cos(angle)) < 0.1) ctx.textAlign = "center";
        else if (Math.cos(angle) > 0) ctx.textAlign = "left";
        else ctx.textAlign = "right";
        if (Math.abs(Math.sin(angle)) < 0.1) ctx.textBaseline = "middle";
        else if (Math.sin(angle) > 0) ctx.textBaseline = "top";
        else ctx.textBaseline = "bottom";

        const text = isInteractive
            ? (isCompactInteractive ? getCompactLabel(labelText) : labelText.toUpperCase())
            : labelText.substring(0, 3).toUpperCase();
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

let pulseFrame = null;
function renderMainChart(canvas, totals) {
    if (!canvas) return;
    if (pulseFrame) { cancelAnimationFrame(pulseFrame); pulseFrame = null; }
    const ratio = dpr();
    let Wcss = canvas.parentElement.clientWidth || 550;
    if (Wcss > 900) Wcss = 900;
    const Hcss = Wcss > 600 ? 500 : 360;
    canvas.width = Wcss * ratio; canvas.height = Hcss * ratio;
    canvas.style.width = Wcss + "px"; canvas.style.height = Hcss + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, Wcss, Hcss);

    if (STATE.selected.size === 0) {
        const cx = Wcss / 2; const cy = Hcss / 2;
        let phase = (performance.now() / 1000) % (Math.PI * 2);
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + Math.sin(phase * 3) * 0.02, 1 + Math.sin(phase * 3) * 0.02);
        ctx.fillStyle = "#3c424bff"; ctx.font = "800 24px system-ui, sans-serif"; ctx.textAlign = "center";
        ctx.fillText("Klepněte na jídlo", 0, 0);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.05)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 150, 0 + phase, Math.PI + phase); ctx.stroke();
        ctx.restore();
        pulseFrame = requestAnimationFrame(() => renderMainChart(canvas, totals));
        return;
    }
    drawRadar(ctx, totals, Wcss, Hcss, true, DIET_NUTS);
}

const STATIC_DATA = {
    day: [
        { id: "s-break", name: "Snídaně", desc: "Ovesná kaše, ovoce", data: { energy: 30, carbs: 130, fat: 40, protein: 60, fiber: 80, cholesterol: 10, sodium: 5 } },
        { id: "s-snk1", name: "Dopolední Svačina", desc: "Jogurt a oříšky", data: { energy: 20, carbs: 40, fat: 60, protein: 50, fiber: 20, cholesterol: 15, sodium: 10 } },
        { id: "s-snk2", name: "Odpolední Svačina", desc: "Sýr a jablko", data: { energy: 25, carbs: 50, fat: 50, protein: 40, fiber: 40, cholesterol: 40, sodium: 30 } },
        { id: "s-din", name: "Večeře", desc: "Pizza (velká)", data: { energy: 120, carbs: 140, fat: 150, protein: 80, fiber: 10, cholesterol: 130, sodium: 150 } }
    ],
    week: [
        { id: "w-mon", name: "Pondělí", desc: "Start do týdne zdravě", data: { energy: 95, carbs: 100, fat: 90, protein: 110, fiber: 100, cholesterol: 80, sodium: 90 } },
        { id: "w-wed", name: "Úterý", desc: "Jídlo v práci bez ovoce", data: { energy: 110, carbs: 120, fat: 130, protein: 80, fiber: 40, cholesterol: 110, sodium: 130 } },
        { id: "w-thu", name: "Středa", desc: "Ideální balanc", data: { energy: 100, carbs: 105, fat: 95, protein: 105, fiber: 110, cholesterol: 85, sodium: 80 } },
        { id: "w-fri", name: "Čtvrtek", desc: "Večerní pivo a chipsy", data: { energy: 140, carbs: 130, fat: 120, protein: 60, fiber: 30, cholesterol: 50, sodium: 140 } },
        { id: "w-sat", name: "Pátek", desc: "Cheat Day - Burger a Cola", data: { energy: 150, carbs: 150, fat: 150, protein: 140, fiber: 20, cholesterol: 150, sodium: 150 } },
        { id: "w-sun", name: "Sobota", desc: "Rodinný oběd ke kachně", data: { energy: 130, carbs: 110, fat: 140, protein: 90, fiber: 40, cholesterol: 140, sodium: 120 } }
    ]
};

const COMPLEX_MEALS = [
    { name: "Losos s quinoou a pečenou brokolicí", seed: 1 },
    { name: "Hovězí steak s batátovým pyré a chřestem", seed: 2 },
    { name: "Středomořský cizrnový salát s fetou a olivami", seed: 3 },
    { name: "Kuřecí plátek s rýží a mandlemi", seed: 4 },
    { name: "Tuňákový tatarák s avokádem a sezamem", seed: 5 },
    { name: "Pohankové rizoto s houbami", seed: 6 },
    { name: "Krůtí ragú s celozrnnými těstovinami a parmezánem", seed: 7 },
    { name: "Veganské kari tofu s kokosovým mlékem", seed: 8 },
    { name: "Pečený pstruh s restovanými fazolkami", seed: 9 },
    { name: "Pestrá miska: černé fazole, kukuřice, grilované kuře", seed: 10 }
];

function generateComplexData(seed) {
    const data = {};
    COMPLEX_CATEGORIES.forEach((cat, idx) => {
        let v = 90 + Math.sin(idx * 7 + seed) * 20 + Math.cos(idx * 3 + seed * 2) * 10 + (Math.sin(seed * idx) * 15);
        if (cat.label === "Cholesterol" || cat.label === "Sodík" || cat.label === "Nasycené tuky") v = 50 + Math.abs(Math.sin(seed + idx)) * 40;
        if (cat.label === "Vit. C" || cat.label === "Zelenina" || cat.label === "Ovoce") v = 100 + Math.abs(Math.sin(seed * 2)) * 40;
        data[cat.key] = v;
    });
    return data;
}

let currentComplexMealIdx = 0;
let complexDataRender = generateComplexData(COMPLEX_MEALS[0].seed);

const STATIC_CANVASES = [];
function loopStaticCanvases(time) {
    STATIC_CANVASES.forEach(sc => {
        sc.ctx.clearRect(0, 0, sc.Wcss, sc.Hcss);
        const animatedData = {};
        let phaseShift = sc.id.length * 10;
        Object.keys(sc.data).forEach((key, idx) => {
            const breath = Math.sin((time * 0.0015) + idx + phaseShift) * 4;
            animatedData[key] = Math.max(0, sc.data[key] + breath);
        });
        drawRadar(sc.ctx, animatedData, sc.Wcss, sc.Hcss, sc.isInteractive, sc.defs);
    });
    if (STATIC_CANVASES.length > 0) requestAnimationFrame(loopStaticCanvases);
}

function renderStaticCard(container, item) {
    const card = document.createElement("div"); card.className = "ps-static-chart-card";
    card.innerHTML = `<h3>${item.name}</h3><p class="desc">${item.desc}</p><div class="ps-static-canvas-container"><canvas id="${item.id}" width="200" height="200"></canvas></div>`;
    container.appendChild(card);
    const canvas = document.getElementById(item.id);
    const ratio = dpr(); const Wcss = 200; const Hcss = 160;
    canvas.style.width = Wcss + "px"; canvas.style.height = Hcss + "px";
    canvas.width = Wcss * ratio; canvas.height = Hcss * ratio;
    const ctx = canvas.getContext("2d"); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    STATIC_CANVASES.push({ id: item.id, ctx, data: { ...item.data }, Wcss, Hcss, isInteractive: false, defs: DIET_NUTS });
}

function renderComplexChart() {
    const canvas = document.getElementById("complexChart");
    if (!canvas) return;
    const ratio = dpr();
    const isMobile = window.innerWidth < 900;
    const isWideDesktop = window.innerWidth >= 1400;
    const isDesktop = window.innerWidth >= 1100;
    const maxChartWidth = isMobile ? 900 : (isWideDesktop ? 940 : (isDesktop ? 840 : 840));
    let Wcss = (canvas.parentElement.clientWidth || maxChartWidth) - (isMobile ? 0 : 8);
    if (Wcss < 300) Wcss = 300;
    if (Wcss > maxChartWidth) Wcss = maxChartWidth;
    const Hcss = isMobile ? (Wcss > 600 ? 500 : 360) : Math.round(Wcss * 0.8);
    canvas.style.width = Wcss + "px"; canvas.style.height = Hcss + "px";
    canvas.width = Wcss * ratio; canvas.height = Hcss * ratio;
    const ctx = canvas.getContext("2d"); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const existingIdx = STATIC_CANVASES.findIndex(sc => sc.id === "complex");
    const scObj = { id: "complex", ctx, data: { ...complexDataRender }, Wcss, Hcss, isInteractive: true, defs: COMPLEX_CATEGORIES };
    if (existingIdx !== -1) STATIC_CANVASES[existingIdx] = scObj;
    else STATIC_CANVASES.push(scObj);
}

let DIET_renderedTotals = { energy: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, cholesterol: 0, sodium: 0 };
function diet_animateTo(totals) {
    const start = { ...DIET_renderedTotals }; const delta = {};
    for (const k in totals) delta[k] = totals[k] - start[k];
    animate({
        id: "chart", duration: 300, easing: easeOutExpo, onUpdate: k => {
            for (const kk in totals) DIET_renderedTotals[kk] = start[kk] + delta[kk] * k;
            renderMainChart(document.getElementById("dietChart"), DIET_renderedTotals);
        }
    });
}

function diet_computeScore(t) {
    if (STATE.selected.size === 0) return 0;
    let s = 100;
    let hasUnhealthy = false;
    let healthyCount = 0;
    STATE.selected.forEach(key => { if (DIET_FOODS[key].isHealthy) healthyCount++; else hasUnhealthy = true; });
    if (hasUnhealthy) s -= 25;
    let missingHealthy = 0;
    DIET_HEALTHY_DEFAULT.forEach(key => { if (!STATE.selected.has(key)) missingHealthy++; });
    if (missingHealthy > 0) s -= (missingHealthy * 8);

    if (STATE.portionWeight < 250) s -= (250 - STATE.portionWeight) * 0.15;
    else if (STATE.portionWeight > 400) s -= (STATE.portionWeight - 400) * 0.12;

    if (t.fat > 115) s -= 10;
    if (t.cholesterol > 105) s -= 12;
    if (t.sodium > 105) s -= 12;
    if (t.energy > 120) s -= 10;
    return Math.floor(clamp(s, 0, 100));
}

function animateScore(targetScore) {
    const scoreEl = document.getElementById("dietScore");
    if (!scoreEl) return;
    const start = STATE.displayedScore; const delta = targetScore - start;
    animate({
        id: "score", duration: 300, easing: easeOutExpo, onUpdate: k => {
            STATE.displayedScore = start + delta * k;
            let current = Math.round(STATE.displayedScore); scoreEl.textContent = current;
            scoreEl.className = "ps-score-value";
            if (STATE.selected.size === 0) { }
            else if (current >= 80) scoreEl.classList.add("excellent");
            else if (current >= 50) scoreEl.classList.add("warning");
            else scoreEl.classList.add("danger");
        }
    });
}

function diet_updateTotals() { diet_animateTo(diet_sumSelected()); animateScore(Math.round(diet_computeScore(diet_sumSelected()))); }

export function initDietSimulator() {
    STATIC_CANVASES.length = 0;
    const foodListEl = document.getElementById("foodList");
    if (foodListEl) {
        foodListEl.innerHTML = '';
        for (const [key, data] of Object.entries(DIET_FOODS)) {
            const btn = document.createElement("div"); btn.className = "ps-food-btn";
            btn.setAttribute("data-key", key); btn.setAttribute("data-active", "false"); btn.setAttribute("data-healthy", data.isHealthy);
            btn.innerHTML = `<span class="ps-emoji">${data.emoji}</span><span class="name">${data.name}</span>`;
            btn.addEventListener("click", () => {
                if (btn.getAttribute("data-active") === "true") { btn.setAttribute("data-active", "false"); STATE.selected.delete(key); }
                else { btn.setAttribute("data-active", "true"); STATE.selected.add(key); }
                diet_updateTotals();
            });
            foodListEl.appendChild(btn);
        }
    }
    const slider = document.getElementById("portionSlider");
    const portionVal = document.getElementById("portionValue");
    if (slider) {
        slider.addEventListener("input", (e) => {
            STATE.portionWeight = parseInt(e.target.value, 10);
            if (portionVal) portionVal.textContent = STATE.portionWeight + " g";
            diet_updateTotals();
        });
    }

    const canvasChart = document.getElementById("dietChart");
    if (canvasChart) renderMainChart(canvasChart, DIET_renderedTotals);

    const autoBtn = document.getElementById("dietAutoSelect");
    if (autoBtn) {
        autoBtn.addEventListener("click", () => {
            STATE.selected.clear();
            document.querySelectorAll('.ps-food-btn').forEach(btn => {
                const key = btn.getAttribute("data-key");
                if (DIET_HEALTHY_DEFAULT.includes(key)) { btn.setAttribute("data-active", "true"); STATE.selected.add(key); }
                else btn.setAttribute("data-active", "false");
            });
            STATE.portionWeight = 400;
            if (slider) { slider.value = 400; if (portionVal) portionVal.textContent = "400 g"; }
            diet_updateTotals();
        });
    }

    const dayGrid = document.getElementById("day-grid");
    if (dayGrid) { dayGrid.innerHTML = ''; STATIC_DATA.day.forEach(item => renderStaticCard(dayGrid, item)); }
    const weekGrid = document.getElementById("week-grid");
    if (weekGrid) { weekGrid.innerHTML = ''; STATIC_DATA.week.forEach(item => renderStaticCard(weekGrid, item)); }

    if (document.getElementById("complexChart")) {
        renderComplexChart();
        requestAnimationFrame(loopStaticCanvases);
        if (!window.__complexMealInterval) {
            window.__complexMealInterval = setInterval(() => {
                currentComplexMealIdx = (currentComplexMealIdx + 1) % COMPLEX_MEALS.length;
                const newMeal = COMPLEX_MEALS[currentComplexMealIdx];
                const titleEl = document.getElementById("complexMealNameDisplay");
                if (titleEl) { titleEl.style.opacity = "0"; setTimeout(() => { titleEl.textContent = newMeal.name; titleEl.style.opacity = "1"; }, 300); }
                const newTarget = generateComplexData(newMeal.seed);
                const start = { ...complexDataRender }; const delta = {};
                for (const k in newTarget) delta[k] = newTarget[k] - start[k];
                const complexSc = STATIC_CANVASES.find(s => s.id === "complex");
                animate({
                    id: "complexChartAnim", duration: 800, easing: easeOutExpo, onUpdate: k => {
                        for (const kk in newTarget) { complexDataRender[kk] = start[kk] + delta[kk] * k; if (complexSc) complexSc.data[kk] = complexDataRender[kk]; }
                    }
                });
            }, 2500);
        }
    }
    window.addEventListener("resize", () => {
        renderMainChart(document.getElementById("dietChart"), DIET_renderedTotals);
        renderComplexChart();
    });
}
document.addEventListener("DOMContentLoaded", initDietSimulator);
