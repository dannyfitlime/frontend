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

function drawRadar(ctx, totals, Wcss, Hcss, isInteractive, definitions = DIET_NUTS) {
    const cx = Wcss / 2; const cy = Hcss / 2;
    const numAngles = definitions.length;
    const forceCompactLabels = ctx.canvas?.dataset?.compactLabels === "true";
    const isCompactInteractive = isInteractive && numAngles > 10 && window.innerWidth < 900;
    const useCompactLabels = forceCompactLabels || isCompactInteractive;
    const padding = numAngles > 10
        ? (isInteractive ? (useCompactLabels ? Math.max(58, Math.round(Wcss * 0.08)) : Math.max(110, Math.round(Wcss * 0.14))) : 35)
        : (isInteractive ? 70 : 35);
    const maxR = Math.max(0, Math.min(cx, cy) - padding);

    const getCompactLabel = (labelText) => {
        if (labelText.startsWith("Vit.")) return labelText.replace("Vit. ", "").toUpperCase();
        const compactMap = {
            "Energie": "EN",
            "Bílkoviny": "BÍL",
            "Tuky": "TUK",
            "Sacharidy": "SAC",
            "Vláknina": "VLK",
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

        const labelOffset = numAngles > 10 ? (useCompactLabels ? 18 : 55) : (isInteractive ? 55 : 20);
        const { x: xLabel, y: yLabel } = getXY(MAX_DISPLAY + labelOffset, i);
        const labelText = definitions[i].label;

        ctx.fillStyle = isInteractive ? "#475569" : "rgba(71, 85, 105, 0.7)";
        ctx.font = isInteractive ? `${useCompactLabels ? 700 : 600} ${useCompactLabels ? 10 : 12}px system-ui` : "500 10px system-ui";
        ctx.letterSpacing = "1px";

        const angle = -Math.PI / 2 + (Math.PI * 2 * i) / numAngles;
        if (Math.abs(Math.cos(angle)) < 0.1) ctx.textAlign = "center";
        else if (Math.cos(angle) > 0) ctx.textAlign = "left";
        else ctx.textAlign = "right";
        if (Math.abs(Math.sin(angle)) < 0.1) ctx.textBaseline = "middle";
        else if (Math.sin(angle) > 0) ctx.textBaseline = "top";
        else ctx.textBaseline = "bottom";

        const text = isInteractive
            ? (useCompactLabels ? getCompactLabel(labelText) : labelText.toUpperCase())
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
        ctx.fillText(EMPTY_CHART_PROMPT, 0, 0);
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

const COMPLEX_MEALS = [
    { name: "Losos s quinoou a pe\u010denou brokolic\u00ed", seed: 1 },
    { name: "Hov\u011bz\u00ed steak s bat\u00e1tov\u00fdm pyr\u00e9 a ch\u0159estem", seed: 2 },
    { name: "St\u0159edomo\u0159sk\u00fd cizrnov\u00fd sal\u00e1t s fetou a olivami", seed: 3 },
    { name: "Ku\u0159ec\u00ed pl\u00e1tek s r\u00fd\u017e\u00ed a mandlemi", seed: 4 },
    { name: "Tu\u0148\u00e1kov\u00fd tatar\u00e1k s avok\u00e1dem a sezamem", seed: 5 },
    { name: "Pohankov\u00e9 rizoto s houbami", seed: 6 },
    { name: "Kr\u016ft\u00ed rag\u00fa s celozrnn\u00fdmi t\u011bstovinami a parmez\u00e1nem", seed: 7 },
    { name: "Vegansk\u00e9 kari tofu s kokosov\u00fdm ml\u00e9kem", seed: 8 },
    { name: "Pe\u010den\u00fd pstruh s restovan\u00fdmi fazolkami", seed: 9 },
    { name: "Pestr\u00e1 miska: \u010dern\u00e9 fazole, kuku\u0159ice, grilovan\u00e9 ku\u0159e", seed: 10 }
];

const PAGE_LANG = (document.documentElement.lang || "cs").toLowerCase();
const LOCALE = PAGE_LANG.startsWith("en") ? "en" : PAGE_LANG.startsWith("sk") ? "sk" : "cs";
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
            "Losos s quinoou a pecenou brokolicou",
            "Hovadzi steak so sladkym zemiakovym pyre a sparglou",
            "Stredomorsky cicerovy salat s fetou a olivami",
            "Kuraci filet s ryzou a mandlami",
            "Tuniakovy tatarak s avokadom a sezamom",
            "Pohankove rizoto s hubami",
            "Morcacie ragu s celozrnnymi cestovinami a parmezanom",
            "Veganske tofu kari s kokosovym mliekom",
            "Peceny pstruh s restovanou zelenou fazulkou",
            "Pestrofarebna miska: cierna fazula, kukurica, grilovane kura"
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
            "Salmon with quinoa and roasted broccoli",
            "Beef steak with sweet potato puree and asparagus",
            "Mediterranean chickpea salad with feta and olives",
            "Chicken fillet with rice and almonds",
            "Tuna tartare with avocado and sesame",
            "Buckwheat risotto with mushrooms",
            "Turkey ragout with wholegrain pasta and parmesan",
            "Vegan tofu curry with coconut milk",
            "Baked trout with sauteed green beans",
            "Colorful bowl: black beans, corn, grilled chicken"
        ]
    }
};
const ACTIVE_LOCALE_COPY = LOCALE_COPY[LOCALE] || null;
const EMPTY_CHART_PROMPT = ACTIVE_LOCALE_COPY?.emptyChartPrompt || "Klepn\u011bte na j\u00eddlo";

if (ACTIVE_LOCALE_COPY) {
    Object.entries(ACTIVE_LOCALE_COPY.foods).forEach(([key, value]) => {
        if (DIET_FOODS[key]) DIET_FOODS[key].name = value;
    });
    ACTIVE_LOCALE_COPY.nuts.forEach((value, idx) => {
        if (DIET_NUTS[idx]) DIET_NUTS[idx].label = value;
    });
    ACTIVE_LOCALE_COPY.categories.forEach((value, idx) => {
        if (COMPLEX_CATEGORIES[idx]) COMPLEX_CATEGORIES[idx].label = value;
    });
    ACTIVE_LOCALE_COPY.day.forEach((value, idx) => {
        if (STATIC_DATA.day[idx]) {
            STATIC_DATA.day[idx].name = value.name;
            STATIC_DATA.day[idx].desc = value.desc;
        }
    });
    ACTIVE_LOCALE_COPY.week.forEach((value, idx) => {
        if (STATIC_DATA.week[idx]) {
            STATIC_DATA.week[idx].name = value.name;
            STATIC_DATA.week[idx].desc = value.desc;
        }
    });
    ACTIVE_LOCALE_COPY.complexMeals.forEach((value, idx) => {
        if (COMPLEX_MEALS[idx]) COMPLEX_MEALS[idx].name = value;
    });
}

function generateComplexData(seed) {
    const data = {};
    COMPLEX_CATEGORIES.forEach((cat, idx) => {
        let v = 90 + Math.sin(idx * 7 + seed) * 20 + Math.cos(idx * 3 + seed * 2) * 10 + (Math.sin(seed * idx) * 15);
        if (cat.key === "c9" || cat.key === "c12" || cat.key === "c23") v = 50 + Math.abs(Math.sin(seed + idx)) * 40;
        if (cat.key === "c5" || cat.key === "c6" || cat.key === "c17") v = 100 + Math.abs(Math.sin(seed * 2)) * 40;
        data[cat.key] = v;
    });
    return data;
}

let currentComplexMealIdx = 0;
let complexDataRender = generateComplexData(COMPLEX_MEALS[0].seed);

function dispatchComplexMealChange(index, meal) {
    document.dispatchEvent(new CustomEvent("fitlime:complex-meal-change", {
        detail: {
            index,
            meal: { ...meal }
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
        const complexCanvas = document.getElementById("complexChart");
        const titleEl = document.getElementById("complexMealNameDisplay");
        if (titleEl) titleEl.textContent = COMPLEX_MEALS[currentComplexMealIdx].name;
        dispatchComplexMealChange(currentComplexMealIdx, COMPLEX_MEALS[currentComplexMealIdx]);
        renderComplexChart();
        requestAnimationFrame(loopStaticCanvases);
        if (!window.__complexMealInterval) {
            const complexMealIntervalMs = getComplexMealIntervalMs(complexCanvas);
            window.__complexMealInterval = setInterval(() => {
                currentComplexMealIdx = (currentComplexMealIdx + 1) % COMPLEX_MEALS.length;
                const newMeal = COMPLEX_MEALS[currentComplexMealIdx];
                const titleEl = document.getElementById("complexMealNameDisplay");
                if (titleEl) { titleEl.style.opacity = "0"; setTimeout(() => { titleEl.textContent = newMeal.name; titleEl.style.opacity = "1"; }, 300); }
                dispatchComplexMealChange(currentComplexMealIdx, newMeal);
                const newTarget = generateComplexData(newMeal.seed);
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
