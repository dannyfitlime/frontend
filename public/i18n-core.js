// /src/i18n-core.js

// ===============================
// Seznam podporovaných jazyků
// ===============================
export const SUPPORTED = ['cs','sk','en','de','pt','es','it','pl','fr'];

// Stav i18n (aktuální slovník + vybraný jazyk)
export const i18n = { dict:null, fallback:null, lang:'cs' };

// Domain-based language preferences (.sk/.eu/.cz)
function hostPreferredLang(hostname = location.hostname){
  const host = (hostname || '').toLowerCase();
  if (host.endsWith('fitlime.sk')) return 'sk';
  if (host.endsWith('fitlime.eu')) return 'en';
  if (host.endsWith('fitlime.cz')) return 'cs';
  return null;
}

// Contact e-mail selector per language (.cz / .sk / .eu)
export function contactEmailFor(lang = i18n.lang){
  if (lang === 'cs') return 'info@fitlime.cz';
  if (lang === 'sk') return 'info@fitlime.sk';
  return 'info@fitlime.eu';
}

function applyContactEmail(root = document, lang = i18n.lang){
  const email = contactEmailFor(lang);
  root.querySelectorAll('[data-contact-email]').forEach(el => {
    el.textContent = email;
    el.setAttribute('href', `mailto:${email}`);
  });
}

// ===============================
// Helper: z objektu vytáhne hodnotu podle cesty "a.b.c"
// ===============================
function get(obj, path){ 
  return path.split('.').reduce((o,k)=>o?.[k], obj); 
}

// NaŽÖtenÆí EN fallbacku pro p‘teklad
async function ensureFallback(){
  if (i18n.fallback) return;
  try {
    const res = await fetch('/i18n/en.json');
    if (!res.ok) throw new Error('fallback load failed '+res.status);
    i18n.fallback = await res.json();
  } catch (err) {
    console.warn(err);
    i18n.fallback = {};
  }
}

// ===============================
// Funkce pro překlad podle klíče
// ===============================
export function t(path){ 
  return get(i18n.dict||{}, path) ?? get(i18n.fallback||{}, path) ?? path; 
}

// ===============================
// Aplikace překladů na dokument
// Prochází atributy data-i18n / data-i18n-placeholder / data-i18n-aria-label
// ===============================
export function applyI18n(root=document){
  root.querySelectorAll('[data-i18n]').forEach(el=>{
  const key = el.getAttribute('data-i18n');
  const value = t(key);
  // Pokud překlad obsahuje HTML tagy, použij innerHTML
  if (typeof value === 'string' && /<\/?[a-z][\s\S]*>/i.test(value)) {
    el.innerHTML = value;
  } else {
    el.textContent = value;
  }
});
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', t(key));
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach(el=>{
    const key = el.getAttribute('data-i18n-aria-label');
    el.setAttribute('aria-label', t(key));
  });
  // nastaví <html lang="..">
  document.documentElement.lang = i18n.lang;
  applyContactEmail(root, i18n.lang);
}

// ===============================
// Autodetekce jazyka
// Priorita: ?lang=xx → localStorage → jazyk prohlížeče → fallback 'cs'
// ===============================
export async function detectLang(){
  // 1) z URL
  const urlLang = new URLSearchParams(location.search).get('lang');
  if (urlLang && SUPPORTED.includes(urlLang)) {
    localStorage.setItem('lang', urlLang);
    return urlLang;
  }

  // 2) z localStorage (uprednostnit drive nez domenovy default)
  const stored = localStorage.getItem('lang');
  if (stored && SUPPORTED.includes(stored)) {
    return stored;
  }

  // 2) podle domeny (.sk => sk, .eu => en, .cz => cs)
  const hostLang = hostPreferredLang();
  if (hostLang && SUPPORTED.includes(hostLang)) {
    localStorage.setItem('lang', hostLang);
    return hostLang;
  }

  // 3) jazyk prohlizece
  const nav = (navigator.languages||[])
    .map(x => x.slice(0,2).toLowerCase())
    .find(l => SUPPORTED.includes(l));
  if (nav) return nav;

  // 4) fallback
  return 'cs';

}

// ===============================
// Načtení slovníku pro konkrétní jazyk
// ===============================
export async function loadLang(lang, { onAfterApply } = {}){
  await ensureFallback();
  i18n.lang = SUPPORTED.includes(lang) ? lang : 'cs';
  localStorage.setItem('lang', i18n.lang);

  // načte JSON se slovníkem
  const res = await fetch(`/i18n/${i18n.lang}.json`);
  if (!res.ok) throw new Error('i18n fetch failed '+res.status);
  i18n.dict = await res.json();
  if (i18n.lang === 'en' && !i18n.fallback) {
    i18n.fallback = i18n.dict;
  }

  // aplikuje překlady na stránku
  applyI18n();
  onAfterApply?.(i18n.lang);
}

// ===============================
// Boot funkce pro inicializaci i18n
// ===============================
export async function bootI18n({ onAfterApply } = {}){
  const lang = await detectLang();
  await loadLang(lang, { onAfterApply });
}

// ===============================
// DOMContentLoaded – logika UI
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  // --- Přepínač "Coverage" seznamu ---
  const btn = document.getElementById("toggleCoverage");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const hiddenItems = document.querySelectorAll("#coverage-list .hidden");

    hiddenItems.forEach(el => {
      if (!el.classList.contains("show")) {
        // ukázat s animací
        el.style.display = "block";
        void el.offsetWidth; // reflow hack pro CSS transition
        el.classList.add("show");
      } else {
        // schovat s animací
        el.classList.remove("show");
        setTimeout(() => el.style.display = "none", 300);
      }
    });

    // zkontroluj, jestli je něco rozbaleno
    const expanded = [...hiddenItems].some(el => el.classList.contains("show"));

    // přepni text tlačítka (i18n klíč)
    btn.setAttribute("data-i18n", expanded ? "home.coverage.less" : "home.coverage.toggle");
    bootI18n(); // přeložit znovu
  });
});

// --- Přepínání obsahu boxů (rozklikávací) ---
document.querySelectorAll('.big-box').forEach(box => {
  box.addEventListener('click', () => {
    box.classList.toggle('active');
  });
});

// --- Carousel (slider) ---
document.querySelectorAll(".carousel").forEach(carousel => {
  const track = carousel.querySelector(".carousel-track");   // wrapper se slidy
  const slides = Array.from(track.children);                 // jednotlivé slidery
  const dotsContainer = carousel.querySelector(".carousel-dots"); // tečky

  let index = 0;

  // --- Vytvoření teček ---
  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    if (i === 0) dot.classList.add("active");
    dot.addEventListener("click", () => goToSlide(i));
    dotsContainer.appendChild(dot);
  });
  const dots = Array.from(dotsContainer.children);

  // --- Aktualizace polohy tracku a stavu teček ---
  function update() {
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d,i) => d.classList.toggle("active", i === index));
  }

  // --- Přechod na konkrétní slide ---
  function goToSlide(i) {
    if (i < 0) {
      // animace bounce při pokusu jít mimo doleva
      slides[index].classList.add("bounce-left");
      slides[index].addEventListener("animationend", () => 
        slides[index].classList.remove("bounce-left"), { once: true });
      return;
    }
    if (i >= slides.length) {
      // animace bounce při pokusu jít mimo doprava
      slides[index].classList.add("bounce-right");
      slides[index].addEventListener("animationend", () => 
        slides[index].classList.remove("bounce-right"), { once: true });
      return;
    }
    index = i;
    update();
  }

  // --- Swipe gesta (touch) ---
  let startX = 0;
  track.addEventListener("touchstart", e => startX = e.touches[0].clientX);
  track.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (dx > 50) goToSlide(index - 1);   // swipe right → zpět
    if (dx < -50) goToSlide(index + 1); // swipe left → vpřed
  });

  update();
});

