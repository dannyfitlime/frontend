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
    chicken: { emoji: "\u{1F357}", energy: 28.2, protein: 79.7, fat: 25.0, carbs: 0.0, fiber: 0.0, cholesterol: 100.0, sodium: 75.5, isHealthy: true, name: "Ku\u0159ec\u00ed" },
    rice: { emoji: "\u{1F35A}", energy: 33.3, protein: 10.3, fat: 3.5, carbs: 55.3, fiber: 5.0, cholesterol: 0.0, sodium: 12.0, isHealthy: true, name: "R\u00fd\u017ee" },
    salad: { emoji: "\u{1F957}", energy: 6.0, protein: 5.1, fat: 0.0, carbs: 9.2, fiber: 20.7, cholesterol: 0.0, sodium: 6.6, isHealthy: true, name: "Sal\u00e1t" },
    avocado: { emoji: "\u{1F951}", energy: 19.1, protein: 3.6, fat: 69.4, carbs: 7.9, fiber: 41.3, cholesterol: 0.0, sodium: 4.9, isHealthy: true, name: "Avok\u00e1do" },
    apple: { emoji: "\u{1F34E}", energy: 13.3, protein: 1.3, fat: 2.1, carbs: 27.6, fiber: 33.1, cholesterol: 0.0, sodium: 1.0, isHealthy: true, name: "Jablko" },
    fries: { emoji: "\u{1F35F}", energy: 55, protein: 8, fat: 45, carbs: 30, fiber: 4, cholesterol: 50, sodium: 80, isHealthy: false, name: "Hranolky" },
    burger: { emoji: "\u{1F354}", energy: 80, protein: 65, fat: 55, carbs: 35, fiber: 5, cholesterol: 130, sodium: 140, isHealthy: false, name: "Burger" },
    icecream: { emoji: "\u{1F366}", energy: 40, protein: 3, fat: 35, carbs: 40, fiber: 0, cholesterol: 25, sodium: 15, isHealthy: false, name: "Zmrzlina" },
    hotdog: { emoji: "\u{1F32D}", energy: 50, protein: 55, fat: 40, carbs: 18, fiber: 0, cholesterol: 70, sodium: 120, isHealthy: false, name: "P\u00e1rek" },
    donut: { emoji: "\u{1F369}", energy: 50, protein: 2, fat: 30, carbs: 45, fiber: 0, cholesterol: 20, sodium: 25, isHealthy: false, name: "Kobliha" }
};

const DIET_HEALTHY_DEFAULT = ["chicken", "rice", "salad", "avocado", "apple"];
const DIET_NUTS = [
    { key: "energy", label: "Energie" }, { key: "carbs", label: "Sacharidy" },
    { key: "fat", label: "Tuky" }, { key: "protein", label: "B\u00edlkoviny" },
    { key: "fiber", label: "Vl\u00e1knina" }, { key: "cholesterol", label: "Cholesterol" },
    { key: "sodium", label: "Sod\u00edk" }
];

const COMPLEX_CATEGORIES = [
    "Energie", "B\u00edlkoviny", "Tuky", "Sacharidy", "Vl\u00e1knina", "Ovoce", "Zelenina", "Ml\u00e9\u010dn\u00e9 v\u00fdrobky", "Ryby",
    "Nasycen\u00e9 tuky", "Mononenasycen\u00e9 tuky", "Polynenasycen\u00e9 tuky", "Cholesterol", "Vit. B1", "Vit. B2", "Vit. B6",
    "Vit. B12", "Vit. C", "Vit. D", "Vit. E", "Kyselina listov\u00e1", "Ho\u0159\u010d\u00edk", "Drasl\u00edk", "Sod\u00edk", "V\u00e1pn\u00edk", "\u017delezo"
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
    const isReverse = key === "cholesterol" || key === "sodium" || key === "c12" || key === "c23" || key === "c9";
    if (isReverse) {
        if (val <= 100) return "#10b981";
        if (val <= 120) return "#f59e0b";
        return "#ef4444";
    }
    const isInfinite = key === "fiber" || key === "c4";
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

function wrapRadarLabel(ctx, text, maxWidth, maxLines = 3) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const nextLine = `${currentLine} ${words[i]}`;
        if (ctx.measureText(nextLine).width <= maxWidth || currentLine === "") {
            currentLine = nextLine;
        } else {
            lines.push(currentLine);
            currentLine = words[i];
        }
    }

    if (currentLine) lines.push(currentLine);
    if (lines.length <= maxLines) return lines;

    const visibleLines = lines.slice(0, maxLines - 1);
    visibleLines.push(lines.slice(maxLines - 1).join(" "));
    return visibleLines;
}

function drawRadarLabelLines(ctx, lines, x, y, lineHeight) {
    const totalHeight = (lines.length - 1) * lineHeight;
    let startY = y;

    if (ctx.textBaseline === "middle") startY = y - totalHeight / 2;
    else if (ctx.textBaseline === "bottom") startY = y - totalHeight;

    lines.forEach((line, index) => {
        ctx.fillText(line, x, startY + index * lineHeight);
    });
}

function drawRadar(ctx, totals, Wcss, Hcss, isInteractive, definitions = DIET_NUTS, options = {}) {
    const cx = Wcss / 2; const cy = Hcss / 2;
    const numAngles = definitions.length;
    const reserveX = options.reserveX || 0;
    const reserveY = options.reserveY || 0;
    const isComplexChart = ctx.canvas?.id === "complexChart";
    const forceCompactLabels = ctx.canvas?.dataset?.compactLabels === "true";
    const canUseFullLabels = isComplexChart || (isInteractive && numAngles > 10 && Wcss >= 760 && window.innerWidth >= 1100);
    const isCompactInteractive = isInteractive && (numAngles > 10 ? !canUseFullLabels : (window.innerWidth < 820 && numAngles > 8));
    const useCompactLabels = numAngles > 10
        ? (forceCompactLabels ? !canUseFullLabels : isCompactInteractive)
        : isCompactInteractive;
    const outerPadding = Math.max(58, Math.round(Wcss * 0.08));
    const padding = numAngles > 10
        ? (isInteractive ? outerPadding : 35)
        : (isInteractive ? 70 : 35);
    const maxR = Math.max(0, Math.min(cx - reserveX, cy - reserveY) - padding);

    const getCompactLabel = (labelText) => {
        if (labelText.startsWith("Vit.")) return labelText.replace("Vit. ", "").toUpperCase();
        const compactMap = {
            "Energie": "EN",
            "Energie v rovnováze": "ENER",
            "Bílkoviny": "BÍL",
            "Tuky": "TUK",
            "Sacharidy": "SAC",
            "Kvalita sacharidů": "SACH",
            "Vláknina": "VLK",
            "Kvalita tuků": "TUKY",
            "Málo nasycených tuků": "SAT",
            "Málo sodíku": "SOD",
            "Vitaminy": "VIT",
            "Minerály": "MIN",
            "Nutriční hustota": "HUST",
            "Cholesterol": "CHOL",
            "Ovoce": "OVO",
            "Zelenina": "ZEL",
            "Mléčné výrobky": "MLÉK",
            "Ryby": "RYB",
            "Nasycené tuky": "NAS T",
            "Mononenasycené tuky": "MONO",
            "Polynenasycené tuky": "POLY",
            "Kyselina listová": "FOL",
            "Hořčík": "HOŘ",
            "Draslík": "DRAS",
            "Sodík": "SOD",
            "Vápník": "VÁP",
            "Železo": "ŽEL"
        };
        if (compactMap[labelText]) return compactMap[labelText];
        return labelText.slice(0, 3).toUpperCase();
    };

    const getXY = (value, index, allowOverflow = false) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / numAngles;
        const radiusValue = allowOverflow ? value : Math.min(value, MAX_DISPLAY);
        const r = (radiusValue / MAX_DISPLAY) * maxR;
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
            ctx.strokeStyle = (isInteractive && numAngles <= 10) ? "rgba(16, 185, 129, 0.8)" : "rgba(16, 185, 129, 0.6)";
            ctx.lineWidth = (isInteractive && numAngles <= 10) ? 2.5 : 1.5; ctx.setLineDash([4, 6]);
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

        const labelOffset = numAngles > 10
            ? (useCompactLabels ? 18 : 22)
            : (isInteractive ? 22 : 20);
        const { x: xLabel, y: yLabel } = getXY(MAX_DISPLAY + labelOffset, i, !useCompactLabels);
        const labelText = definitions[i].label;

        ctx.fillStyle = isInteractive ? "#273241" : "rgba(51, 65, 85, 0.78)";
        ctx.font = isInteractive ? `${useCompactLabels ? 700 : 600} ${useCompactLabels ? 10 : (numAngles > 10 ? 10 : 12)}px system-ui` : "500 10px system-ui";
        ctx.letterSpacing = "1px";

        const angle = -Math.PI / 2 + (Math.PI * 2 * i) / numAngles;
        if (Math.abs(Math.cos(angle)) < 0.1) ctx.textAlign = "center";
        else if (Math.cos(angle) > 0) ctx.textAlign = "left";
        else ctx.textAlign = "right";
        if (Math.abs(Math.sin(angle)) < 0.1) ctx.textBaseline = "middle";
        else if (Math.sin(angle) > 0) ctx.textBaseline = "top";
        else ctx.textBaseline = "bottom";

        if (isInteractive) {
            if (useCompactLabels) {
                ctx.fillText(getCompactLabel(labelText), xLabel, yLabel);
            } else if (numAngles > 10) {
                const lines = wrapRadarLabel(ctx, labelText, Math.max(78, Math.round(Wcss * 0.1)), isComplexChart ? 4 : 3);
                drawRadarLabelLines(ctx, lines, xLabel, yLabel, 11);
            } else {
                ctx.fillText(labelText.toUpperCase(), xLabel, yLabel);
            }
        } else {
            ctx.fillText(labelText.substring(0, 3).toUpperCase(), xLabel, yLabel);
        }
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
    let chartSize = canvas.parentElement.clientWidth || 550;
    const isLargeScreen = window.innerWidth >= 980;
    chartSize = Math.round(chartSize * 0.9);
    if (chartSize > 820) chartSize = 820;
    if (chartSize < 320) chartSize = 320;
    if (isLargeScreen) chartSize = Math.round(chartSize * 0.8);
    const gutterX = isLargeScreen ? 96 : 40;
    const gutterY = isLargeScreen ? 64 : 36;
    const Wcss = chartSize + gutterX * 2;
    const Hcss = chartSize + gutterY * 2;
    canvas.width = Wcss * ratio; canvas.height = Hcss * ratio;
    canvas.style.width = Wcss + "px"; canvas.style.height = Hcss + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, Wcss, Hcss);

    if (STATE.selected.size === 0) {
        const cx = Wcss / 2; const cy = Hcss / 2;
        let phase = (performance.now() / 1000) % (Math.PI * 2);
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + Math.sin(phase * 3) * 0.02, 1 + Math.sin(phase * 3) * 0.02);
        ctx.fillStyle = "#3c424bff"; ctx.font = "800 24px system-ui, sans-serif"; ctx.textAlign = "center";
        ctx.fillText(EMPTY_CHART_PROMPT, 0, 0);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.05)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 150, 0 + phase, Math.PI + phase); ctx.stroke();
        ctx.restore();
        pulseFrame = requestAnimationFrame(() => renderMainChart(canvas, totals));
        return;
    }
    drawRadar(ctx, totals, Wcss, Hcss, true, DIET_NUTS, { reserveX: gutterX, reserveY: gutterY });
}

const STATIC_DATA = {
    day: [
        { id: "s-break", name: "Sn\u00eddan\u011b", desc: "Ovesn\u00e1 ka\u0161e, ovoce", data: { energy: 30, carbs: 130, fat: 40, protein: 60, fiber: 80, cholesterol: 10, sodium: 5 } },
        { id: "s-snk1", name: "Dopoledn\u00ed Sva\u010dina", desc: "Jogurt a o\u0159\u00ed\u0161ky", data: { energy: 20, carbs: 40, fat: 60, protein: 50, fiber: 20, cholesterol: 15, sodium: 10 } },
        { id: "s-snk2", name: "Odpoledn\u00ed Sva\u010dina", desc: "S\u00fdr a jablko", data: { energy: 25, carbs: 50, fat: 50, protein: 40, fiber: 40, cholesterol: 40, sodium: 30 } },
        { id: "s-din", name: "Ve\u010de\u0159e", desc: "Pizza (velk\u00e1)", data: { energy: 120, carbs: 140, fat: 150, protein: 80, fiber: 10, cholesterol: 130, sodium: 150 } }
    ],
    week: [
        { id: "w-mon", name: "Pond\u011bl\u00ed", desc: "Start do t\u00fddne zdrav\u011b", data: { energy: 95, carbs: 100, fat: 90, protein: 110, fiber: 100, cholesterol: 80, sodium: 90 } },
        { id: "w-wed", name: "\u00dater\u00fd", desc: "J\u00eddlo v pr\u00e1ci bez ovoce", data: { energy: 110, carbs: 120, fat: 130, protein: 80, fiber: 40, cholesterol: 110, sodium: 130 } },
        { id: "w-thu", name: "St\u0159eda", desc: "Ide\u00e1ln\u00ed balanc", data: { energy: 100, carbs: 105, fat: 95, protein: 105, fiber: 110, cholesterol: 85, sodium: 80 } },
        { id: "w-fri", name: "\u010ctvrtek", desc: "Ve\u010dern\u00ed pivo a chipsy", data: { energy: 140, carbs: 130, fat: 120, protein: 60, fiber: 30, cholesterol: 50, sodium: 140 } },
        { id: "w-sat", name: "P\u00e1tek", desc: "Cheat Day - Burger a Cola", data: { energy: 150, carbs: 150, fat: 150, protein: 140, fiber: 20, cholesterol: 150, sodium: 150 } },
        { id: "w-sun", name: "Sobota", desc: "Rodinn\u00fd ob\u011bd ke kachn\u011b", data: { energy: 130, carbs: 110, fat: 140, protein: 90, fiber: 40, cholesterol: 140, sodium: 120 } }
    ]
};

const COMPLEX_MEAL_NUTRITION = {
    banana_smoothie: { energy: 286.0, protein: 1.8, fat: 0.8, carbohydrates: 13.2, fiber: 1.1, sodium: 34.1, cholesterol: 1.1, fruits_vegetables: 0.7, dairy: 0.1, fish: 0.0, saturated_fat: 0.3, monounsaturated_fat: 0.3, polyunsaturated_fat: 0.1, potassium: 251.5, calcium: 60.2, magnesium: 22.2, iron: 0.7, folic_acid: 10.9, vitamin_b1: 0.0, vitamin_b2: 0.1, vitamin_b6: 0.3, vitamin_b12: 0.1, vitamin_c: 6.3, vitamin_d: 0.2, vitamin_e: 0.7 },
    zander_with_potatoes_and_spinach: { energy: 326.7, protein: 8.1, fat: 0.5, carbohydrates: 10.2, fiber: 1.8, sodium: 47.9, cholesterol: 0.0, fruits_vegetables: 0.0, dairy: 0.0, fish: 0.4, saturated_fat: 0.1, monounsaturated_fat: 0.1, polyunsaturated_fat: 0.2, potassium: 412.7, calcium: 38.5, magnesium: 30.0, iron: 1.5, folic_acid: 38.8, vitamin_b1: 0.1, vitamin_b2: 0.1, vitamin_b6: 0.3, vitamin_b12: 1.4, vitamin_c: 18.5, vitamin_d: 0.3, vitamin_e: 1.2 },
    red_lentils_with_eggs: { energy: 999.7, protein: 17.6, fat: 5.0, carbohydrates: 32.3, fiber: 5.8, sodium: 93.9, cholesterol: 152.1, fruits_vegetables: 0.0, dairy: 0.0, fish: 0.0, saturated_fat: 1.6, monounsaturated_fat: 2.0, polyunsaturated_fat: 1.3, potassium: 374.7, calcium: 43.7, magnesium: 48.4, iron: 4.7, folic_acid: 124.6, vitamin_b1: 0.3, vitamin_b2: 0.2, vitamin_b6: 0.3, vitamin_b12: 0.4, vitamin_c: 1.8, vitamin_d: 1.4, vitamin_e: 0.6 },
    kung_pao_with_rice: { energy: 538.9, protein: 13.5, fat: 6.0, carbohydrates: 5.2, fiber: 1.0, sodium: 363.3, cholesterol: 31.4, fruits_vegetables: 0.4, dairy: 0.0, fish: 0.0, saturated_fat: 0.9, monounsaturated_fat: 4.3, polyunsaturated_fat: 0.8, potassium: 284.2, calcium: 21.4, magnesium: 76.1, iron: 1.8, folic_acid: 12.0, vitamin_b1: 0.1, vitamin_b2: 0.1, vitamin_b6: 0.3, vitamin_b12: 0.4, vitamin_c: 38.8, vitamin_d: 0.5, vitamin_e: 2.8 },
    roasted_chicken_with_bulgur_salad: { energy: 583.7, protein: 11.0, fat: 3.2, carbohydrates: 17.6, fiber: 4.5, sodium: 119.9, cholesterol: 29.1, fruits_vegetables: 0.5, dairy: 0.0, fish: 0.0, saturated_fat: 0.9, monounsaturated_fat: 1.4, polyunsaturated_fat: 0.9, potassium: 300.8, calcium: 30.2, magnesium: 53.2, iron: 1.5, folic_acid: 12.8, vitamin_b1: 0.2, vitamin_b2: 0.1, vitamin_b6: 0.3, vitamin_b12: 0.0, vitamin_c: 6.1, vitamin_d: 0.0, vitamin_e: 0.5 },
    salmon_poke_bowl: { energy: 644.3, protein: 6.5, fat: 7.6, carbohydrates: 14.8, fiber: 1.4, sodium: 331.2, cholesterol: 12.7, fruits_vegetables: 0.6, dairy: 0.0, fish: 0.3, saturated_fat: 1.2, monounsaturated_fat: 4.7, polyunsaturated_fat: 1.8, potassium: 255.5, calcium: 14.8, magnesium: 20.4, iron: 0.6, folic_acid: 21.2, vitamin_b1: 0.1, vitamin_b2: 0.1, vitamin_b6: 0.4, vitamin_b12: 0.7, vitamin_c: 3.5, vitamin_d: 2.9, vitamin_e: 1.0 },
    yogurt_panna_cotta: { energy: 340.6, protein: 4.8, fat: 2.0, carbohydrates: 10.9, fiber: 1.6, sodium: 41.0, cholesterol: 5.7, fruits_vegetables: 0.3, dairy: 0.3, fish: 0.0, saturated_fat: 1.2, monounsaturated_fat: 0.6, polyunsaturated_fat: 0.2, potassium: 146.9, calcium: 87.5, magnesium: 13.9, iron: 0.4, folic_acid: 0.1, vitamin_b1: 0.0, vitamin_b2: 0.1, vitamin_b6: 0.1, vitamin_b12: 0.0, vitamin_c: 6.3, vitamin_d: 0.0, vitamin_e: 0.8 },
    cheese_turkey_and_cranberry_sandwich: { energy: 1003.4, protein: 11.1, fat: 9.4, carbohydrates: 27.6, fiber: 2.5, sodium: 500.0, cholesterol: 13.6, fruits_vegetables: 0.1, dairy: 0.5, fish: 0.0, saturated_fat: 4.2, monounsaturated_fat: 3.4, polyunsaturated_fat: 1.8, potassium: 102.3, calcium: 162.5, magnesium: 25.5, iron: 2.1, folic_acid: 4.7, vitamin_b1: 0.1, vitamin_b2: 0.1, vitamin_b6: 0.1, vitamin_b12: 0.6, vitamin_c: 2.0, vitamin_d: 0.0, vitamin_e: 0.6 },
    gluten_free_swedish_pie: { energy: 897.6, protein: 10.4, fat: 14.2, carbohydrates: 11.6, fiber: 2.3, sodium: 47.8, cholesterol: 165.8, fruits_vegetables: 0.0, dairy: 0.2, fish: 0.0, saturated_fat: 3.0, monounsaturated_fat: 8.1, polyunsaturated_fat: 3.1, potassium: 235.8, calcium: 132.5, magnesium: 58.2, iron: 1.4, folic_acid: 26.1, vitamin_b1: 0.1, vitamin_b2: 0.4, vitamin_b6: 0.1, vitamin_b12: 0.7, vitamin_c: 0.4, vitamin_d: 0.4, vitamin_e: 5.2 },
    tofu_with_quinoa_and_spinach: { energy: 976.7, protein: 12.5, fat: 5.7, carbohydrates: 32.4, fiber: 4.4, sodium: 16.9, cholesterol: 0.0, fruits_vegetables: 0.0, dairy: 0.0, fish: 0.0, saturated_fat: 0.8, monounsaturated_fat: 1.5, polyunsaturated_fat: 3.4, potassium: 461.4, calcium: 57.5, magnesium: 124.0, iron: 3.8, folic_acid: 132.8, vitamin_b1: 0.2, vitamin_b2: 0.2, vitamin_b6: 0.3, vitamin_b12: 0.0, vitamin_c: 9.6, vitamin_d: 0.0, vitamin_e: 1.7 }
};

const COMPLEX_MEAL_RADAR_VALUES = {
    banana_smoothie: { energy: 89, protein: 50, fat: 50, carbohydrates: 150, fiber: 50, sodium: 50, cholesterol: 50, fruits: 150, vegetables: 50, dairy: 70, fish: 50, saturated_fat: 50, monounsaturated_fat: 50, polyunsaturated_fat: 50, potassium: 50, calcium: 66, magnesium: 57, iron: 50, folic_acid: 59, vitamin_b1: 50, vitamin_b2: 50, vitamin_b6: 100, vitamin_b12: 57, vitamin_c: 64, vitamin_d: 57, vitamin_e: 54 },
    zander_with_potatoes_and_spinach: { energy: 135, protein: 110, fat: 50, carbohydrates: 140, fiber: 63, sodium: 53, cholesterol: 50, fruits: 50, vegetables: 100, dairy: 50, fish: 150, saturated_fat: 50, monounsaturated_fat: 50, polyunsaturated_fat: 62, potassium: 100, calcium: 50, magnesium: 63, iron: 71, folic_acid: 84, vitamin_b1: 100, vitamin_b2: 50, vitamin_b6: 100, vitamin_b12: 100, vitamin_c: 100, vitamin_d: 59, vitamin_e: 65 },
    red_lentils_with_eggs: { energy: 119, protein: 100, fat: 50, carbohydrates: 150, fiber: 100, sodium: 62, cholesterol: 100, fruits: 50, vegetables: 60, dairy: 50, fish: 50, saturated_fat: 100, monounsaturated_fat: 76, polyunsaturated_fat: 77, potassium: 85, calcium: 53, magnesium: 80, iron: 100, folic_acid: 98, vitamin_b1: 150, vitamin_b2: 75, vitamin_b6: 100, vitamin_b12: 79, vitamin_c: 55, vitamin_d: 90, vitamin_e: 52 },
    kung_pao_with_rice: { energy: 143, protein: 132, fat: 83, carbohydrates: 85, fiber: 53, sodium: 130, cholesterol: 65, fruits: 50, vegetables: 80, dairy: 50, fish: 50, saturated_fat: 67, monounsaturated_fat: 100, polyunsaturated_fat: 54, potassium: 63, calcium: 50, magnesium: 100, iron: 76, folic_acid: 60, vitamin_b1: 100, vitamin_b2: 50, vitamin_b6: 100, vitamin_b12: 79, vitamin_c: 100, vitamin_d: 62, vitamin_e: 100 },
    roasted_chicken_with_bulgur_salad: { energy: 124, protein: 105, fat: 50, carbohydrates: 145, fiber: 89, sodium: 74, cholesterol: 60, fruits: 50, vegetables: 70, dairy: 50, fish: 50, saturated_fat: 67, monounsaturated_fat: 63, polyunsaturated_fat: 58, potassium: 67, calcium: 50, magnesium: 73, iron: 71, folic_acid: 61, vitamin_b1: 125, vitamin_b2: 50, vitamin_b6: 100, vitamin_b12: 50, vitamin_c: 61, vitamin_d: 50, vitamin_e: 50 },
    salmon_poke_bowl: { energy: 97, protein: 72, fat: 80, carbohydrates: 148, fiber: 55, sodium: 122, cholesterol: 55, fruits: 70, vegetables: 90, dairy: 50, fish: 125, saturated_fat: 83, monounsaturated_fat: 100, polyunsaturated_fat: 85, potassium: 62, calcium: 50, magnesium: 56, iron: 50, folic_acid: 64, vitamin_b1: 100, vitamin_b2: 50, vitamin_b6: 100, vitamin_b12: 93, vitamin_c: 58, vitamin_d: 100, vitamin_e: 65 },
    yogurt_panna_cotta: { energy: 102, protein: 85, fat: 50, carbohydrates: 150, fiber: 58, sodium: 52, cholesterol: 65, fruits: 120, vegetables: 50, dairy: 110, fish: 50, saturated_fat: 83, monounsaturated_fat: 57, polyunsaturated_fat: 54, potassium: 51, calcium: 84, magnesium: 50, iron: 50, folic_acid: 50, vitamin_b1: 50, vitamin_b2: 50, vitamin_b6: 50, vitamin_b12: 50, vitamin_c: 64, vitamin_d: 50, vitamin_e: 59 },
    cheese_turkey_and_cranberry_sandwich: { energy: 96, protein: 80, fat: 70, carbohydrates: 150, fiber: 74, sodium: 135, cholesterol: 70, fruits: 65, vegetables: 60, dairy: 150, fish: 50, saturated_fat: 100, monounsaturated_fat: 88, polyunsaturated_fat: 77, potassium: 50, calcium: 100, magnesium: 65, iron: 82, folic_acid: 52, vitamin_b1: 100, vitamin_b2: 50, vitamin_b6: 50, vitamin_b12: 86, vitamin_c: 55, vitamin_d: 50, vitamin_e: 52 },
    gluten_free_swedish_pie: { energy: 98, protein: 86, fat: 118, carbohydrates: 96, fiber: 68, sodium: 53, cholesterol: 100, fruits: 50, vegetables: 50, dairy: 90, fish: 50, saturated_fat: 92, monounsaturated_fat: 100, polyunsaturated_fat: 100, potassium: 59, calcium: 97, magnesium: 83, iron: 68, folic_acid: 77, vitamin_b1: 100, vitamin_b2: 100, vitamin_b6: 50, vitamin_b12: 93, vitamin_c: 50, vitamin_d: 59, vitamin_e: 100 },
    tofu_with_quinoa_and_spinach: { energy: 98, protein: 85, fat: 50, carbohydrates: 150, fiber: 88, sodium: 50, cholesterol: 50, fruits: 50, vegetables: 75, dairy: 50, fish: 50, saturated_fat: 67, monounsaturated_fat: 67, polyunsaturated_fat: 100, potassium: 100, calcium: 69, magnesium: 150, iron: 94, folic_acid: 100, vitamin_b1: 125, vitamin_b2: 75, vitamin_b6: 100, vitamin_b12: 50, vitamin_c: 67, vitamin_d: 50, vitamin_e: 74 }
};

const COMPLEX_MEAL_MACRO_VALUES = {
    banana_smoothie: { protein: 11.3, fat: 5.0, carbs: 83.7 },
    zander_with_potatoes_and_spinach: { protein: 43.0, fat: 2.7, carbs: 54.3 },
    red_lentils_with_eggs: { protein: 32.0, fat: 9.0, carbs: 59.0 },
    kung_pao_with_rice: { protein: 54.7, fat: 24.3, carbs: 21.0 },
    roasted_chicken_with_bulgur_salad: { protein: 34.7, fat: 10.0, carbs: 55.3 },
    salmon_poke_bowl: { protein: 22.7, fat: 26.3, carbs: 51.3 },
    yogurt_panna_cotta: { protein: 27.0, fat: 11.3, carbs: 61.7 },
    cheese_turkey_and_cranberry_sandwich: { protein: 23.0, fat: 19.7, carbs: 57.3 },
    gluten_free_swedish_pie: { protein: 28.7, fat: 39.3, carbs: 32.0 },
    tofu_with_quinoa_and_spinach: { protein: 24.7, fat: 11.3, carbs: 64.0 }
};

function scoreHigherIsBetter(value, target, minScore = 20, maxScore = MAX_DISPLAY) {
    if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(target) || target <= 0) return minScore;
    return clamp((value / target) * 100, minScore, maxScore);
}

function scoreLowerIsBetter(value, idealMax, poorAt, minScore = 20, maxScore = 115) {
    if (!Number.isFinite(value)) return minScore;
    if (value <= idealMax) return maxScore;
    const progress = (value - idealMax) / Math.max(poorAt - idealMax, 1);
    return clamp(maxScore - progress * 90, minScore, maxScore);
}

function scoreTargetRange(value, idealMin, idealMax, lowBound, highBound, minScore = 20, idealScore = 112) {
    if (!Number.isFinite(value)) return minScore;
    if (value >= idealMin && value <= idealMax) {
        const center = (idealMin + idealMax) / 2;
        const halfRange = Math.max((idealMax - idealMin) / 2, 1);
        const centerOffset = Math.abs(value - center) / halfRange;
        return clamp(idealScore - centerOffset * 8, 100, idealScore);
    }
    if (value < idealMin) {
        const progress = (value - lowBound) / Math.max(idealMin - lowBound, 1);
        return clamp(minScore + progress * (idealScore - minScore), minScore, idealScore);
    }
    const progress = (highBound - value) / Math.max(highBound - idealMax, 1);
    return clamp(minScore + progress * (idealScore - minScore), minScore, idealScore);
}

function scoreAverage(parts) {
    const valid = parts.filter(([value, weight]) => Number.isFinite(value) && Number.isFinite(weight) && weight > 0);
    if (valid.length === 0) return 20;
    const weightSum = valid.reduce((sum, [, weight]) => sum + weight, 0);
    const valueSum = valid.reduce((sum, [value, weight]) => sum + (value * weight), 0);
    return clamp(valueSum / weightSum, 20, MAX_DISPLAY);
}

function calculateMealMacros(nutrition) {
    const proteinCalories = Math.max(0, nutrition.protein) * 4;
    const fatCalories = Math.max(0, nutrition.fat) * 9;
    const carbCalories = Math.max(0, nutrition.carbohydrates) * 4;
    const totalCalories = proteinCalories + fatCalories + carbCalories;
    if (!totalCalories) return { carbs: 34, fat: 33, protein: 33 };

    const raw = {
        carbs: (carbCalories / totalCalories) * 100,
        fat: (fatCalories / totalCalories) * 100,
        protein: (proteinCalories / totalCalories) * 100
    };
    const rounded = {
        carbs: Math.round(raw.carbs),
        fat: Math.round(raw.fat),
        protein: Math.round(raw.protein)
    };
    const diff = 100 - (rounded.carbs + rounded.fat + rounded.protein);
    if (diff !== 0) {
        const largestKey = Object.keys(raw).sort((a, b) => raw[b] - raw[a])[0];
        rounded[largestKey] += diff;
    }
    return rounded;
}

function buildComplexMealProfile(nutrition) {
    const produceBase = scoreHigherIsBetter(nutrition.fruits_vegetables, 0.45);
    const fruitScore = scoreAverage([
        [produceBase, 0.55],
        [scoreHigherIsBetter(nutrition.vitamin_c, 18), 0.3],
        [scoreTargetRange(nutrition.carbohydrates, 8, 30, 0, 60), 0.15]
    ]);
    const vegetableScore = scoreAverage([
        [produceBase, 0.45],
        [scoreHigherIsBetter(nutrition.fiber, 4), 0.2],
        [scoreHigherIsBetter(nutrition.folic_acid, 90), 0.2],
        [scoreHigherIsBetter(nutrition.potassium, 350), 0.15]
    ]);
    const dairyScore = scoreAverage([
        [scoreHigherIsBetter(nutrition.dairy, 0.35), 0.55],
        [scoreHigherIsBetter(nutrition.calcium, 180), 0.3],
        [scoreHigherIsBetter(nutrition.vitamin_b12, 0.5), 0.15]
    ]);
    const fishScore = scoreAverage([
        [scoreHigherIsBetter(nutrition.fish, 0.3), 0.6],
        [scoreHigherIsBetter(nutrition.vitamin_d, 3.5), 0.2],
        [scoreHigherIsBetter(nutrition.vitamin_b12, 0.8), 0.2]
    ]);

    return {
        c0: scoreTargetRange(nutrition.energy, 320, 720, 180, 1050),
        c1: scoreHigherIsBetter(nutrition.protein, 15),
        c2: scoreTargetRange(nutrition.fat, 3, 12, 0, 20),
        c3: scoreTargetRange(nutrition.carbohydrates, 10, 35, 0, 60),
        c4: scoreHigherIsBetter(nutrition.fiber, 4.5),
        c5: fruitScore,
        c6: vegetableScore,
        c7: dairyScore,
        c8: fishScore,
        c9: scoreLowerIsBetter(nutrition.saturated_fat, 1.5, 5),
        c10: scoreHigherIsBetter(nutrition.monounsaturated_fat, 3.2),
        c11: scoreHigherIsBetter(nutrition.polyunsaturated_fat, 1.6),
        c12: scoreLowerIsBetter(nutrition.cholesterol, 35, 180),
        c13: scoreHigherIsBetter(nutrition.vitamin_b1, 0.18),
        c14: scoreHigherIsBetter(nutrition.vitamin_b2, 0.22),
        c15: scoreHigherIsBetter(nutrition.vitamin_b6, 0.32),
        c16: scoreHigherIsBetter(nutrition.vitamin_b12, 0.7),
        c17: scoreHigherIsBetter(nutrition.vitamin_c, 24),
        c18: scoreHigherIsBetter(nutrition.vitamin_d, 3.5),
        c19: scoreHigherIsBetter(nutrition.vitamin_e, 2.4),
        c20: scoreHigherIsBetter(nutrition.folic_acid, 100),
        c21: scoreHigherIsBetter(nutrition.magnesium, 55),
        c22: scoreHigherIsBetter(nutrition.potassium, 380),
        c23: scoreLowerIsBetter(nutrition.sodium, 120, 500),
        c24: scoreHigherIsBetter(nutrition.calcium, 120),
        c25: scoreHigherIsBetter(nutrition.iron, 2.2)
    };
}

function buildComplexMealProfileFromRadarValues(profile) {
    const safe = profile || {};
    return {
        c0: clamp(safe.energy || 0, 0, MAX_DISPLAY),
        c1: clamp(safe.protein || 0, 0, MAX_DISPLAY),
        c2: clamp(safe.fat || 0, 0, MAX_DISPLAY),
        c3: clamp(safe.carbohydrates || 0, 0, MAX_DISPLAY),
        c4: clamp(safe.fiber || 0, 0, MAX_DISPLAY),
        c5: clamp(safe.fruits || 0, 0, MAX_DISPLAY),
        c6: clamp(safe.vegetables || 0, 0, MAX_DISPLAY),
        c7: clamp(safe.dairy || 0, 0, MAX_DISPLAY),
        c8: clamp(safe.fish || 0, 0, MAX_DISPLAY),
        c9: clamp(safe.saturated_fat || 0, 0, MAX_DISPLAY),
        c10: clamp(safe.monounsaturated_fat || 0, 0, MAX_DISPLAY),
        c11: clamp(safe.polyunsaturated_fat || 0, 0, MAX_DISPLAY),
        c12: clamp(safe.cholesterol || 0, 0, MAX_DISPLAY),
        c13: clamp(safe.vitamin_b1 || 0, 0, MAX_DISPLAY),
        c14: clamp(safe.vitamin_b2 || 0, 0, MAX_DISPLAY),
        c15: clamp(safe.vitamin_b6 || 0, 0, MAX_DISPLAY),
        c16: clamp(safe.vitamin_b12 || 0, 0, MAX_DISPLAY),
        c17: clamp(safe.vitamin_c || 0, 0, MAX_DISPLAY),
        c18: clamp(safe.vitamin_d || 0, 0, MAX_DISPLAY),
        c19: clamp(safe.vitamin_e || 0, 0, MAX_DISPLAY),
        c20: clamp(safe.folic_acid || 0, 0, MAX_DISPLAY),
        c21: clamp(safe.magnesium || 0, 0, MAX_DISPLAY),
        c22: clamp(safe.potassium || 0, 0, MAX_DISPLAY),
        c23: clamp(safe.sodium || 0, 0, MAX_DISPLAY),
        c24: clamp(safe.calcium || 0, 0, MAX_DISPLAY),
        c25: clamp(safe.iron || 0, 0, MAX_DISPLAY)
    };
}

const COMPLEX_MEALS = [
    { mealId: "salmon_poke_bowl", name: "Losos poke", i18nKey: "home.why.meals.salmonPoke" },
    { mealId: "roasted_chicken_with_bulgur_salad", name: "Ku\u0159e s bulgurem", i18nKey: "home.why.meals.chickenBulgur" },
    { mealId: "tofu_with_quinoa_and_spinach", name: "Tofu s quinoou a \u0161pen\u00e1tem", i18nKey: "home.why.meals.tofuQuinoaSpinach" },
    { mealId: "cheese_turkey_and_cranberry_sandwich", name: "Kr\u016ft\u00ed sendvi\u010d", i18nKey: "home.why.meals.turkeySandwich" },
    { mealId: "kung_pao_with_rice", name: "Kung pao", i18nKey: "home.why.meals.kungPao" },
    { mealId: "red_lentils_with_eggs", name: "\u010co\u010dka s vejcem", i18nKey: "home.why.meals.lentilsEgg" },
    { mealId: "zander_with_potatoes_and_spinach", name: "Cand\u00e1t s bramborem a \u0161pen\u00e1tem", i18nKey: "home.why.meals.zanderPotatoesSpinach" },
    { mealId: "gluten_free_swedish_pie", name: "\u0160v\u00e9dsk\u00fd kol\u00e1\u010d", i18nKey: "home.why.meals.swedishPie" },
    { mealId: "yogurt_panna_cotta", name: "Panna cotta", i18nKey: "home.why.meals.pannaCotta" },
    { mealId: "banana_smoothie", name: "Ban\u00e1nov\u00e9 smoothie", i18nKey: "home.why.meals.bananaSmoothie" }
].map((meal) => {
    const nutrition = COMPLEX_MEAL_NUTRITION[meal.mealId];
    const radarValues = COMPLEX_MEAL_RADAR_VALUES[meal.mealId];
    const macroValues = COMPLEX_MEAL_MACRO_VALUES[meal.mealId];
    return {
        ...meal,
        nutrition,
        macros: macroValues || calculateMealMacros(nutrition),
        profile: radarValues ? buildComplexMealProfileFromRadarValues(radarValues) : buildComplexMealProfile(nutrition)
    };
});

const LOCALE_COPY = {
    sk: {
        emptyChartPrompt: "Kliknite na jedlo",
        foods: {
            chicken: "Kuracie",
            rice: "Ryza",
            salad: "Salat",
            avocado: "Avokado",
            apple: "Jablko",
            fries: "Hranolky",
            burger: "Burger",
            icecream: "Zmrzlina",
            hotdog: "Parek",
            donut: "Siska"
        },
        nuts: ["Energia", "Sacharidy", "Tuky", "Bielkoviny", "Vlaknina", "Cholesterol", "Sodik"],
        categories: [
            "Energia", "Bielkoviny", "Tuky", "Sacharidy", "Vlaknina", "Ovocie", "Zelenina", "Mliecne vyrobky", "Ryby",
            "Nasytene tuky", "Mononenasytene tuky", "Polynenasytene tuky", "Cholesterol", "Vit. B1", "Vit. B2", "Vit. B6",
            "Vit. B12", "Vit. C", "Vit. D", "Vit. E", "Kyselina listova", "Horcik", "Draslik", "Sodik", "Vapnik", "Zelezo"
        ],
        day: [
            { name: "Ranajky", desc: "Ovsenna kasa, ovocie" },
            { name: "Dopoludnajsia desiata", desc: "Jogurt a orechy" },
            { name: "Popoludnajsia olovrant", desc: "Syr a jablko" },
            { name: "Vecera", desc: "Pizza (velka)" }
        ],
        week: [
            { name: "Pondelok", desc: "Zdravy start do tyzdna" },
            { name: "Utorok", desc: "Jedlo v praci bez ovocia" },
            { name: "Streda", desc: "Idealna rovnovaha" },
            { name: "Stvrtok", desc: "Vecerne pivo a chipsy" },
            { name: "Piatok", desc: "Cheat day - burger a cola" },
            { name: "Sobota", desc: "Rodinny obed s kacicou" }
        ],
        complexMeals: [
            "Losos poke",
            "Kuracie s bulgurom",
            "Tofu s quinoou a spenatom",
            "Morcaci sendvic",
            "Kung pao",
            "Sosovica s vajcom",
            "Zubac so zemiakmi a spenatom",
            "Svedsky kolac",
            "Panna cotta",
            "Bananove smoothie"
        ]
    },
    en: {
        emptyChartPrompt: "Click a food",
        foods: {
            chicken: "Chicken",
            rice: "Rice",
            salad: "Salad",
            avocado: "Avocado",
            apple: "Apple",
            fries: "Fries",
            burger: "Burger",
            icecream: "Ice cream",
            hotdog: "Hot dog",
            donut: "Donut"
        },
        nuts: ["Energy", "Carbs", "Fats", "Protein", "Fiber", "Cholesterol", "Sodium"],
        categories: [
            "Energy", "Protein", "Fat", "Carbs", "Fiber", "Fruit", "Vegetables", "Dairy", "Fish",
            "Saturated fat", "Monounsaturated fat", "Polyunsaturated fat", "Cholesterol", "Vit. B1", "Vit. B2", "Vit. B6",
            "Vit. B12", "Vit. C", "Vit. D", "Vit. E", "Folate", "Magnesium", "Potassium", "Sodium", "Calcium", "Iron"
        ],
        day: [
            { name: "Breakfast", desc: "Oatmeal, fruit" },
            { name: "Morning snack", desc: "Yogurt and nuts" },
            { name: "Afternoon snack", desc: "Cheese and apple" },
            { name: "Dinner", desc: "Pizza (large)" }
        ],
        week: [
            { name: "Monday", desc: "Healthy start to the week" },
            { name: "Tuesday", desc: "Work meal without fruit" },
            { name: "Wednesday", desc: "Ideal balance" },
            { name: "Thursday", desc: "Evening beer and chips" },
            { name: "Friday", desc: "Cheat day - burger and cola" },
            { name: "Saturday", desc: "Family roast duck lunch" }
        ],
        complexMeals: [
            "Salmon poke bowl",
            "Roasted chicken with bulgur salad",
            "Tofu with quinoa and spinach",
            "Turkey sandwich with cheese and cranberries",
            "Kung pao with rice",
            "Red lentils with eggs",
            "Zander with potatoes and spinach",
            "Gluten-free Swedish pie",
            "Yogurt panna cotta",
            "Banana smoothie"
        ]
    }
};

function normalizeLocale(lang) {
    const safe = (lang || "").toLowerCase();
    return safe.startsWith("en") ? "en" : safe.startsWith("sk") ? "sk" : "cs";
}

function detectLocale() {
    const params = new URLSearchParams(location.search);
    const urlLang = params.get("lang");
    if (urlLang) return normalizeLocale(urlLang);

    const storedLang = localStorage.getItem("lang");
    if (storedLang) return normalizeLocale(storedLang);

    return normalizeLocale(document.documentElement.lang || "cs");
}

const BASE_DIET_FOOD_NAMES = Object.fromEntries(Object.entries(DIET_FOODS).map(([key, value]) => [key, value.name]));
const BASE_DIET_NUT_LABELS = DIET_NUTS.map((item) => item.label);
const BASE_COMPLEX_CATEGORY_LABELS = COMPLEX_CATEGORIES.map((item) => item.label);
const COMPLEX_CATEGORY_I18N_KEYS = [
    "home.why.chart.categories.energy",
    "home.why.chart.categories.protein",
    "home.why.chart.categories.fat",
    "home.why.chart.categories.carbs",
    "home.why.chart.categories.fiber",
    "home.why.chart.categories.fruit",
    "home.why.chart.categories.vegetables",
    "home.why.chart.categories.dairy",
    "home.why.chart.categories.fish",
    "home.why.chart.categories.saturatedFat",
    "home.why.chart.categories.monounsaturatedFat",
    "home.why.chart.categories.polyunsaturatedFat",
    "home.why.chart.categories.cholesterol",
    "home.why.chart.categories.vitaminB1",
    "home.why.chart.categories.vitaminB2",
    "home.why.chart.categories.vitaminB6",
    "home.why.chart.categories.vitaminB12",
    "home.why.chart.categories.vitaminC",
    "home.why.chart.categories.vitaminD",
    "home.why.chart.categories.vitaminE",
    "home.why.chart.categories.folate",
    "home.why.chart.categories.magnesium",
    "home.why.chart.categories.potassium",
    "home.why.chart.categories.sodium",
    "home.why.chart.categories.calcium",
    "home.why.chart.categories.iron"
];
const BASE_STATIC_DAY = STATIC_DATA.day.map((item) => ({ ...item }));
const BASE_STATIC_WEEK = STATIC_DATA.week.map((item) => ({ ...item }));
const BASE_COMPLEX_MEAL_NAMES = COMPLEX_MEALS.map((item) => item.name);
let ACTIVE_LOCALE = "cs";
let EMPTY_CHART_PROMPT = "Klepn\u011bte na j\u00eddlo";

function applyLocaleCopy(locale) {
    ACTIVE_LOCALE = normalizeLocale(locale);
    const localeCopy = LOCALE_COPY[ACTIVE_LOCALE] || null;
    EMPTY_CHART_PROMPT = localeCopy?.emptyChartPrompt || "Klepn\u011bte na j\u00eddlo";

    Object.entries(DIET_FOODS).forEach(([key, food]) => {
        food.name = BASE_DIET_FOOD_NAMES[key];
    });
    DIET_NUTS.forEach((item, idx) => {
        item.label = BASE_DIET_NUT_LABELS[idx];
    });
    COMPLEX_CATEGORIES.forEach((item, idx) => {
        item.label = BASE_COMPLEX_CATEGORY_LABELS[idx];
    });
    STATIC_DATA.day.forEach((item, idx) => {
        Object.assign(item, BASE_STATIC_DAY[idx]);
    });
    STATIC_DATA.week.forEach((item, idx) => {
        Object.assign(item, BASE_STATIC_WEEK[idx]);
    });
    COMPLEX_MEALS.forEach((item, idx) => {
        item.name = BASE_COMPLEX_MEAL_NAMES[idx];
    });

    if (localeCopy) {
        Object.entries(localeCopy.foods).forEach(([key, value]) => {
            if (DIET_FOODS[key]) DIET_FOODS[key].name = value;
        });
        localeCopy.nuts.forEach((value, idx) => {
            if (DIET_NUTS[idx]) DIET_NUTS[idx].label = value;
        });
        localeCopy.categories.forEach((value, idx) => {
            if (COMPLEX_CATEGORIES[idx]) COMPLEX_CATEGORIES[idx].label = value;
        });
        localeCopy.day.forEach((value, idx) => {
            if (STATIC_DATA.day[idx]) {
                STATIC_DATA.day[idx].name = value.name;
                STATIC_DATA.day[idx].desc = value.desc;
            }
        });
        localeCopy.week.forEach((value, idx) => {
            if (STATIC_DATA.week[idx]) {
                STATIC_DATA.week[idx].name = value.name;
                STATIC_DATA.week[idx].desc = value.desc;
            }
        });
        localeCopy.complexMeals.forEach((value, idx) => {
            if (COMPLEX_MEALS[idx]) COMPLEX_MEALS[idx].name = value;
        });
    }

    COMPLEX_CATEGORY_I18N_KEYS.forEach((key, idx) => {
        const translated = getSharedTranslation(key);
        if (translated && translated !== key && COMPLEX_CATEGORIES[idx]) {
            COMPLEX_CATEGORIES[idx].label = translated;
        }
    });
}

function refreshComplexMealLocalization() {
    applyLocaleCopy(detectLocale());
    document.querySelectorAll(".ps-food-btn").forEach((btn) => {
        const key = btn.getAttribute("data-key");
        const nameEl = btn.querySelector(".name");
        if (nameEl && key && DIET_FOODS[key]) nameEl.textContent = DIET_FOODS[key].name;
    });
    const currentMeal = COMPLEX_MEALS[currentComplexMealIdx];
    const titleEl = document.getElementById("complexMealNameDisplay");
    if (titleEl && currentMeal) titleEl.textContent = getTranslatedComplexMealName(currentMeal);
    if (currentMeal) dispatchComplexMealChange(currentComplexMealIdx, currentMeal);
}

applyLocaleCopy(detectLocale());

function generateComplexData(meal) {
    const profile = meal?.profile || {};
    const data = {};
    COMPLEX_CATEGORIES.forEach((cat) => {
        data[cat.key] = profile[cat.key] || 0;
    });
    return data;
}

let currentComplexMealIdx = 0;
let complexDataRender = generateComplexData(COMPLEX_MEALS[0]);

if (!window.__dietSimulatorLangObserver) {
    window.__dietSimulatorLangObserver = new MutationObserver(() => {
        refreshComplexMealLocalization();
    });
    window.__dietSimulatorLangObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"]
    });
}

function getTranslatedComplexMealName(meal) {
    const key = meal?.i18nKey;
    if (!key) return meal?.name || "";
    const translated = getSharedTranslation(key);
    return translated && translated !== key ? translated : (meal?.name || "");
}

function getSharedTranslation(path) {
    const source = window.__fitlimeI18n || {};
    const read = (obj, keyPath) => keyPath.split(".").reduce((acc, part) => acc?.[part], obj);
    return read(source.dict || {}, path) ?? read(source.fallback || {}, path) ?? path;
}

function dispatchComplexMealChange(index, meal) {
    document.dispatchEvent(new CustomEvent("fitlime:complex-meal-change", {
        detail: {
            index,
            meal: { ...meal, name: getTranslatedComplexMealName(meal) }
        }
    }));
}

function getComplexMealIntervalMs(canvas) {
    const raw = canvas?.dataset?.intervalMs || canvas?.parentElement?.dataset?.intervalMs;
    const parsed = parseInt(raw || "", 10);
    return Number.isFinite(parsed) && parsed >= 500 ? parsed : 2500;
}

function getComplexChartMaxWidth(canvas, isMobile, isWideDesktop, isDesktop) {
    const raw = canvas?.dataset?.maxWidth || canvas?.parentElement?.dataset?.maxWidth;
    const parsed = parseInt(raw || "", 10);
    if (Number.isFinite(parsed) && parsed >= 300) return parsed;
    return isMobile ? 900 : (isWideDesktop ? 940 : (isDesktop ? 840 : 840));
}

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
    const maxChartWidth = getComplexChartMaxWidth(canvas, isMobile, isWideDesktop, isDesktop);
    let Wcss = (canvas.parentElement.clientWidth || maxChartWidth) - (isMobile ? 0 : 8);
    if (Wcss < 300) Wcss = 300;
    if (Wcss > maxChartWidth) Wcss = maxChartWidth;
    const Hcss = isMobile
        ? (Wcss > 600 ? 500 : (window.innerWidth <= 470 ? 300 : 360))
        : Math.round(Wcss * 0.8);
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
    const slider = document.querySelector(".ps-simulator-controls .ps-mini-slider") || document.getElementById("portionSlider");
    const portionVal = document.querySelector(".ps-simulator-controls .ps-mini-portion-header span") || document.getElementById("portionValue");
    const portionLabel = document.querySelector(".ps-simulator-controls .ps-mini-portion-header label");
    if (portionLabel) portionLabel.textContent = "Hmotnost porce";
    if (slider) {
        slider.addEventListener("input", (e) => {
            STATE.portionWeight = parseInt(e.target.value, 10);
            if (portionVal) portionVal.textContent = STATE.portionWeight + " g";
            diet_updateTotals();
        });
    }

    const canvasChart = document.getElementById("dietChart");
    if (canvasChart) renderMainChart(canvasChart, DIET_renderedTotals);

    const autoBtn = document.querySelector(".ps-simulator-controls .ps-mini-btn") || document.getElementById("dietAutoSelect");
    if (autoBtn) {
        autoBtn.textContent = "Ukázat řešení";
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
        const complexCanvas = document.getElementById("complexChart");
        const titleEl = document.getElementById("complexMealNameDisplay");
        if (titleEl) titleEl.textContent = getTranslatedComplexMealName(COMPLEX_MEALS[currentComplexMealIdx]);
        dispatchComplexMealChange(currentComplexMealIdx, COMPLEX_MEALS[currentComplexMealIdx]);
        renderComplexChart();
        requestAnimationFrame(loopStaticCanvases);
        if (!window.__complexMealInterval) {
            const complexMealIntervalMs = getComplexMealIntervalMs(complexCanvas);
            window.__complexMealInterval = setInterval(() => {
                currentComplexMealIdx = (currentComplexMealIdx + 1) % COMPLEX_MEALS.length;
                const newMeal = COMPLEX_MEALS[currentComplexMealIdx];
                const displayName = getTranslatedComplexMealName(newMeal);
                const titleEl = document.getElementById("complexMealNameDisplay");
                if (titleEl) { titleEl.style.opacity = "0"; setTimeout(() => { titleEl.textContent = displayName; titleEl.style.opacity = "1"; }, 300); }
                dispatchComplexMealChange(currentComplexMealIdx, newMeal);
                const newTarget = generateComplexData(newMeal);
                const start = { ...complexDataRender }; const delta = {};
                for (const k in newTarget) delta[k] = newTarget[k] - start[k];
                const complexSc = STATIC_CANVASES.find(s => s.id === "complex");
                animate({
                    id: "complexChartAnim", duration: 800, easing: easeOutExpo, onUpdate: k => {
                        for (const kk in newTarget) { complexDataRender[kk] = start[kk] + delta[kk] * k; if (complexSc) complexSc.data[kk] = complexDataRender[kk]; }
                    }
                });
            }, complexMealIntervalMs);
        }
    }
    window.addEventListener("resize", () => {
        renderMainChart(document.getElementById("dietChart"), DIET_renderedTotals);
        renderComplexChart();
    });
}
document.addEventListener("DOMContentLoaded", initDietSimulator);
