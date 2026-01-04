// frontend/src/app.js — cleaned up & fixed i18n + locale-based detection
import { formState } from './state.js';
import {
  validateProfile, validateGoal, validateSport, BMR_LIMITS,
  validateMacros, validateDiet, validateMenuSettings, validatePlan, validateReview
} from './validation.js';
import { bindProfileStep, bindGoalStep, bindSportStep, bindDietStep, bindBalanceStep, 
           bindMenuSettingsStep, onLevelOrPlanChanged, bindPlanStep, bindReviewStep, handlePurchase, cleanupSportStateBeforeNext, beforeGoToStep7 } from './stepsapp.js';

import { i18n as I18N, SUPPORTED as SUPPORTED_LANGS, t as T, bootI18n, loadLang as coreLoadLang } from './i18n-core.js';

// === I18N aliases (so the rest of app.js can stay unchanged) ===
const i18n = I18N;
const t = (path)=> T(path);
const SUPPORTED = SUPPORTED_LANGS;

/* ================= DEBUG ================= */
const DEBUG = true;
function dbg(...a){
  if (!DEBUG) return;
  console.log('[DBG]', ...a);
  let b = document.getElementById('__dbg');
  if (!b) {
    b = document.createElement('div');
    b.id = '__dbg';
    b.style.cssText = 'position:fixed;top:6px;right:6px;z-index:9999;background:rgba(0,0,0,.75);color:#fff;padding:6px 10px;border-radius:8px;font:6px/1.2 system-ui,sans-serif;max-width:40vw';
    document.body.appendChild(b);
  }
  try { b.textContent = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); }
  catch { b.textContent = a.join(' '); }
}
window.addEventListener('error', (ev)=> dbg('Runtime error:', ev?.error || ev?.message));

/* ================ GLOBALS ================= */
export const $ = (sel) => document.querySelector(sel);
let currentStep = 0;
let furthestStep = 0; // nejdál odemčený krok (index)


// HTML steps served from public/
const stepFiles = [
  '/steps/01-profile.html',
  '/steps/02-goal.html',
  '/steps/03-sport.html',
  '/steps/04-balance.html',
  '/steps/05-nutrition.html',
  '/steps/06-menu-settings.html',
  '/steps/07-plan.html',
  '/steps/08-review.html'
];
/* ===== Topbar – přepnutí do compact po odskrolování od vrchu ===== */
(function(){
  const topbar = document.getElementById('topbar');
  if(!topbar) return;

  let ticking = false;
  function onScroll(){
    const y = window.scrollY || window.pageYOffset || 0;
    // compact, jakmile nejsme úplně nahoře (např. > 10 px)
    if (y > 10) topbar.classList.add('compact');
    else        topbar.classList.remove('compact');
    ticking = false;
  }
  window.addEventListener('scroll', ()=>{
    if(!ticking){ requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });

  // počáteční stav (když přijdeme na stránku uprostřed)
  onScroll();
})();

// --- cookies bar init (dejte do app.js, třeba pod GLOBALS) ---
function initCookiesBar(){
  const bar     = document.getElementById('cookiesBar');
  const accept  = document.getElementById('cookiesAccept');
  const decline = document.getElementById('cookiesDecline');
  if (!bar) return; // stránka lištu nemá

  const show = () => bar.classList.add('show');
  const hide = () => bar.classList.remove('show');

  if (localStorage.getItem('cookiesChoice') === null) {
    requestAnimationFrame(show);
  }
  accept?.addEventListener('click', () => {
    localStorage.setItem('cookiesChoice', 'accept');
    // TODO: sem později inicializaci analytiky/marketingu
    hide();
  });
  decline?.addEventListener('click', () => {
    localStorage.setItem('cookiesChoice', 'decline');
    hide();
  });

  // volitelně vystavit globálně
  window.showCookiesBar = show;
  window.hideCookiesBar = hide;
}


/* ===== Cookies bottom sheet (jen na homepage) ===== */
(function initCookiesBar(){
  // Podmínka: jen na home – buď podle značky na body, nebo cesty
  const isHome = document.body?.dataset?.page === 'home' || location.pathname === '/' || location.pathname.endsWith('/index.html');
  const bar = document.getElementById('cookiesBar');
  if(!isHome || !bar) return;

  const ACCEPT_KEY = 'cookieConsent';
  if(localStorage.getItem(ACCEPT_KEY)) return; // už odkliknuto

  const accept = document.getElementById('cookiesAccept');
  const decline = document.getElementById('cookiesDecline');

  // zobrazit s animací
  bar.classList.add('is-open');
  bar.setAttribute('aria-hidden', 'false');

  function closeBar(status){
    try { localStorage.setItem(ACCEPT_KEY, status); } catch(e){}
    bar.classList.remove('is-open');
    // po animaci jen skryjeme pro SR
    setTimeout(()=> bar.setAttribute('aria-hidden','true'), 240);
  }

  accept?.addEventListener('click', () => closeBar('accepted'));
  decline?.addEventListener('click', () => closeBar('declined'));

  // ESC zavře
  window.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeBar('dismissed'); });

  // Fokus na tlačítko (přístupnost)
  setTimeout(()=> accept?.focus(), 50);
})();

/* ===== Sticky footer layout nic dalšího nepotřebuje ===== */
// Ujisti se, že v CSS nemáš žádné zbytky: main{ padding-bottom: ... } a footer{ position: fixed; } – to už jsme nahradili flexem.

/* ===== Aktualizace roku ve footeru (můžeš ponechat) ===== */
(function syncYear(){
  const el = document.getElementById('year');
  if(el) el.textContent = new Date().getFullYear();
})();


/* ===== Leave-form confirm (light modal) ================================= */
function ensureLeaveModalStyles(){
  if (document.getElementById('__leave_modal_css')) return;
  const css = document.createElement('style');
  css.id='__leave_modal_css';
  css.textContent = `
    .leave-backdrop{
      position:fixed; inset:0; background:rgba(0,0,0,.35);
      display:grid; place-items:center; z-index:9999;
      animation: lbFade .15s ease;
    }
    @keyframes lbFade{ from{opacity:0} to{opacity:1} }
    .leave-card{
      background:#fff; color:#111; border-radius:14px; border:1px solid #e5e7eb;
      box-shadow: 0 18px 48px rgba(0,0,0,.2);
      width:min(520px, calc(100vw - 32px));
      padding:16px 16px 12px;
    }
    .leave-card h3{ margin:0 0 6px; font-weight:900; font-size:18px; }
    .leave-card p{ margin:0 0 14px; color:#334155; }
    .leave-actions{ display:flex; gap:8px; justify-content:flex-end; }
    .btn-leave, .btn-stay{
      border-radius:10px; padding:10px 14px; font-weight:800; cursor:pointer;
      border:1px solid #111; background:#111; color:#fff;
    }
    .btn-stay{ background:#fff; color:#111; }
    .btn-leave:focus-visible, .btn-stay:focus-visible{ outline:2px solid #111; outline-offset:2px; }
  `;
  document.head.appendChild(css);
}

function confirmLeaveForm(){
  ensureLeaveModalStyles();
  return new Promise(resolve=>{
    const back = document.createElement('div');
    back.className = 'leave-backdrop';
    back.innerHTML = `
      <div class="leave-card" role="dialog" aria-modal="true" aria-labelledby="leave_t" aria-describedby="leave_d">
        <h3 id="leave_t">${t('common.leave_title') || 'Opustit formulář?'}</h3>
        <p id="leave_d">${t('common.leave_text') || 'Pokud odejdete, můžete přijít o neuložené změny. Chcete pokračovat na hlavní stránku?'}</p>
        <div class="leave-actions">
          <button class="btn-stay"  id="btn-stay">${t('common.leave_stay') || 'Zůstat'}</button>
          <button class="btn-leave" id="btn-leave">${t('common.leave_leave') || 'Odejít'}</button>
        </div>
      </div>`;
    document.body.appendChild(back);

    const cleanup = (val)=>{ back.remove(); resolve(val); };
    back.addEventListener('click', (e)=>{ if (e.target === back) cleanup(false); });
    back.querySelector('#btn-stay').onclick  = ()=> cleanup(false);
    back.querySelector('#btn-leave').onclick = ()=> cleanup(true);
    document.addEventListener('keydown', function onEsc(ev){
      if (ev.key === 'Escape'){ document.removeEventListener('keydown', onEsc); cleanup(false); }
    });
    // Focus na primární akci:
    back.querySelector('#btn-leave').focus();
  });
}
/* ==== SCROLL DEBUG + SMART SCROLL =================================== */
function __getOverflow(el){
  const cs = getComputedStyle(el);
  return `${cs.overflow} / ${cs.overflowY}`;
}
function __scrollInfo(el, label){
  const box = el === window ? document.scrollingElement || document.documentElement : el;
  return {
    who: label,
    tag: el === window ? 'window' : (el.tagName?.toLowerCase() || 'node'),
    overflow: el === window ? '(window)' : __getOverflow(el),
    scrollTop: box.scrollTop,
    scrollHeight: box.scrollHeight,
    clientHeight: box.clientHeight,
  };
}
function __candidates(){
  const arr = [];
  arr.push({ el: window, label: 'window' });
  arr.push({ el: document.scrollingElement || document.documentElement, label: 'scrollingElement' });
  arr.push({ el: document.body, label: 'body' });
  const main = document.querySelector('main.container');
  if (main) arr.push({ el: main, label: 'main.container' });
  const step = document.getElementById('step-container');
  if (step) arr.push({ el: step, label: '#step-container' });
  return arr;
}
function detectScroller(){
  const cands = __candidates();
  const infos = cands.map(c => ({ ...__scrollInfo(c.el, c.label), el: c.el }));
  // Preferuj ten, který REALNĚ může scrollovat (scrollHeight > clientHeight)
  const capable = infos.filter(i => i.scrollHeight > i.clientHeight + 2);
  // Malý fallback: když nic “nescrolluje”, vezmi scrollingElement
  const pick = capable[0] || infos.find(i => i.who === 'scrollingElement') || infos[0];  
  return pick?.el || window;
}
/**
 * Chytrý scroll nahoru – i na mobilech vytáhne úplně na začátek stránky (<html> nebo <body>).
 */
function scrollToTopSmart(reason = '') {
  const tries = [0, 120, 300]; // postupné pokusy po reflow

  tries.forEach(delay => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        // 💡 Detekce skutečného scrolleru
        const scroller = detectScroller();
        const target =
          document.scrollingElement || document.documentElement || document.body;

        const before = target.scrollTop;
        const smooth = delay === tries[tries.length - 1];

        try {
          // 🧭 Scrolluj vždy přes hlavní dokumentový scroller
          target.scrollTo({
            top: 0,
            left: 0,
            behavior: smooth ? 'smooth' : 'auto'
          });
        } catch {
          target.scrollTop = 0;
        }

        setTimeout(() => {
          const after = target.scrollTop;          

          // 🧩 Fallback: pokud se nic nestalo, proveď tvrdý scroll ke <html> nebo <body>
          if (delay === tries[tries.length - 1] && Math.abs(after - before) < 5) {            
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;

            // Jistota – scrollIntoView na úplný začátek dokumentu
            const htmlEl = document.documentElement;
            if (htmlEl && htmlEl.scrollIntoView) {
              htmlEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        }, 80);
      });
    }, delay);
  });
}


/* ================ I18N helpers ================= */
function applyI18nPlaceholders(){
  const els = document.querySelectorAll('[data-i18n-placeholder]');
  els.forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const translated = t(key);
    if (translated && translated !== key) {
      el.setAttribute('placeholder', translated);
      el.setAttribute('aria-placeholder', translated);
      el.removeAttribute('data-placeholder-missing');
    } else {
      el.setAttribute('data-placeholder-missing', key);
    }
  });
}
export function applyI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translated = t(key);
    if (translated && translated !== key) {
      if (el.tagName === 'OPTION') {
        el.textContent = translated; // <== umožní překlad i pro <option>
      } else {
        el.textContent = translated;
      }
    }
  });

  applyI18nPlaceholders();
  renderStepbar(currentStep);
}

// Guess language from URL -> storage -> browser languages -> timezone -> default
function detectLang(){
  try{
    const params = new URLSearchParams(location.search);
    const urlLang = (params.get('lang')||'').toLowerCase();
    if (urlLang && SUPPORTED.includes(urlLang)) return urlLang;

    const stored = (localStorage.getItem('lang')||'').toLowerCase();
    if (stored && SUPPORTED.includes(stored)) return stored;

    const langs = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages : [navigator.language || 'en'];
    for (const raw of langs){
      const base = String(raw || '').toLowerCase().split('-')[0];
      if (SUPPORTED.includes(base)) return base;
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const tzMap = {
      'Europe/Prague':'cs', 'Europe/Bratislava':'sk',
      'Europe/Berlin':'de', 'Europe/Vienna':'de',
      'Europe/Madrid':'es', 'Europe/Paris':'fr',
      'Europe/Rome':'it',   'Europe/Warsaw':'pl',
      'Europe/Lisbon':'pt', 'Atlantic/Azores':'pt'
    };
    const tzGuess = tzMap[tz];
    if (tzGuess && SUPPORTED.includes(tzGuess)) return tzGuess;
  }catch(err){ dbg('detectLang error', String(err)); }
  return 'en';
}

function renderStepper(idx){
  const wrap = $('#stepper');
  const stepsCount = stepFiles.length;
  if (!wrap) return;

  wrap.innerHTML = Array.from({ length: stepsCount }).map((_, i) => {
    const cls =
      (i === idx)        ? 'dot active' :
      (i < furthestStep) ? 'dot done'   :
                           'dot';
    return `
      <button type="button"
              class="${cls}"
              data-step="${i}"
              aria-current="${i===idx?'step':'false'}"
              aria-label="${(t('common.step')||'Krok')} ${i+1}">
        ${i+1}
      </button>`;
  }).join('');

  bindStepperClicks();
}

// map step index to i18n title keys
const STEP_TITLE_KEYS = [
  'step1.title','step2.title','step3.title','step4.title',
  'step5.title','step6.title','step7.title','step8.title'
];
function getStepTitle(idx){
  return t(STEP_TITLE_KEYS[idx]) || (i18n.dict?.steps?.[idx] ?? `Krok ${idx+1}`);
}
function renderStepbar(idx=currentStep){
  const h = document.getElementById('step-title');
  if (h) h.textContent = getStepTitle(idx);
  renderStepper(idx);
}

/* ============== LOAD STEP =============== */
async function loadStep(idx){
  try{
    dbg('loadStep', idx, 'url', stepFiles[idx]);
    // 💨 posuň stránku nahoru HNED (ještě před fetch)
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const res = await fetch(stepFiles[idx], { cache: 'no-store' });
    dbg('step fetch status', res.status, stepFiles[idx]);
    if (!res.ok) throw new Error('step fetch failed '+res.status+' '+stepFiles[idx]);
    const html = await res.text();
    const host = $('#step-container');
    if (!host) { dbg('ERR: #step-container not found'); return; }
    host.innerHTML = html;
    const localH1 = host.querySelector('h1');
    if (localH1) localH1.style.display = 'none';
    dbg('step html injected, length', html.length);

    applyI18n(); dbg('i18n applied on step', idx);

    if (idx===0) { dbg('bindProfileStep'); bindProfileStep(); }
    if (idx===1) { dbg('bindGoalStep');    bindGoalStep(); }
    if (idx===2) { dbg('bindSportStep');   bindSportStep(); }
    if (idx===3) { dbg('bindBalanceStep'); bindBalanceStep(); }
    if (idx===4) { dbg('bindDietStep'); bindDietStep(); }
    if (idx===5) { dbg('bindMenuSettingsStep'); bindMenuSettingsStep(); }
    if (idx===6) { dbg('bindPlanStep');    bindPlanStep(); }
    if (idx===7) { dbg('bindReviewStep');  bindReviewStep(); }
    
    // Next: na posledním kroku skryté, jinde „Další“
    const nextBtn = $('#btn-next');
    if (nextBtn) {
      if (idx === stepFiles.length - 1) {
        nextBtn.style.display = 'none';
      } else {
        nextBtn.style.display = '';
        nextBtn.textContent = t('common.next') || 'Další';
      }
    }

    // Zpět je vždy povolené; na kroku 1 pouze otevře confirmLeaveForm()
    const backBtn = $('#btn-back');
    if (backBtn) {
      backBtn.disabled = false;
      backBtn.setAttribute('aria-disabled','false');
      // volitelné: jiný text na prvním kroku
      const backLabel = (idx === 0) ? (t('common.home') || 'Domů') : (t('common.back') || 'Zpět');
      backBtn.innerHTML = `${backLabel}`;
    }
    
    dbg('step ready', idx);

    // Chytrý reset scrollu – funguje i na mobilech a při reflow
    scrollToTopSmart('after-loadStep');
    
  }catch(e){
    console.error('Step load failed:', e);
    const host = $('#step-container');
    if (host) host.innerHTML = `<section><h1>Chyba načítání kroku</h1><pre style="white-space:pre-wrap">${String(e)}</pre></section>`;
    dbg('loadStep error', String(e));
  }
}

/* ============== VALIDATION FLOW ============== */
async function validateCurrent(){
  let errs = {};

  switch (currentStep) {
    case 0: // Profil
      errs = validateProfile(formState.profile, t);
      console.log("[DBG] validateProfile", errs, formState.profile);
      break;

    case 1: // Cíl
      errs = validateGoal(formState.goal, t);
      console.log("[DBG] validateGoal result:", errs, "goal=", formState.goal);
      break;


    case 2: // Sport
      errs = validateSport(formState.sport, t);
      console.log("[DBG] validateSport", errs, formState.sport);
      break;

    case 3: // Makra (nutrition)
      errs = validateMacros(formState.nutrition, t);
      console.log("[DBG] validateMacros", errs, formState.nutrition);
      break;

    case 4: // Diet (nutrition)
      errs = validateDiet(formState.nutrition, t);
      console.log("[DBG] validateDiet", errs, formState.nutrition);
      break;
    case 5: // Menu settings
      errs = validateMenuSettings(formState.nutrition, t);
      console.log("[DBG] validateMenuSettings", errs, formState.nutrition);
      break;

    case 6: // Plan
      errs = validatePlan?.(formState.plan, t) || {};
      console.log("[DBG] validatePlan", errs, formState.plan);
      break;

    case 7: // Review
      errs = validateReview?.(formState, t) || {};
      console.log("[DBG] validateReview", errs, formState);
      break;
  }

  showErrors(errs);

  const ok = Object.keys(errs).length === 0;
  console.log(`[DBG] validateCurrent step=${currentStep} ok=${ok}`);
  return ok;
}



export function showErrors(errs) {
  const container = $('#step-container');
  if (!container) return;

  // full reset
  container.querySelectorAll('.error').forEach(e => {
    e.textContent = '';
    e.removeAttribute('data-has-error');
    e.removeAttribute('role');
  });
  container.querySelectorAll('.field.field-error').forEach(f => f.classList.remove('field-error'));
  container.querySelectorAll('input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"]').forEach(el => {
    el.setAttribute('aria-invalid', 'false');
    el.removeAttribute('aria-describedby');
  });
  container.querySelectorAll('.chips[data-invalid]').forEach(ch => ch.removeAttribute('data-invalid'));

  // apply current errors
  let firstErrorBlock = null;
  for (const [k, msg] of Object.entries(errs)) {
    const safeId = CSS?.escape ? CSS.escape(k) : k;
    const errEl = container.querySelector(`#err-${safeId}`);
    if (!errEl) continue;

    errEl.textContent = msg;
    errEl.setAttribute('role', 'alert');

    const field = errEl.closest('.field') || errEl.parentElement;
    if (field) {
      field.classList.add('field-error');
      const control = field.querySelector('input, select, textarea');
      if (control) {
        control.setAttribute('aria-invalid', 'true');
        control.setAttribute('aria-describedby', errEl.id);
      } else {
        const chips = field.querySelector('.chips');
        if (chips) chips.setAttribute('data-invalid', 'true');
      }
    }
    if (!firstErrorBlock) firstErrorBlock = field || errEl;
  }

  // scroll & focus first error
  if (firstErrorBlock) {
    const header = document.querySelector('.page-header, .topbar');
    const topbarH = header ? header.offsetHeight : 0;

    const rect = firstErrorBlock.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const y = scrollY + rect.top - topbarH - 12;
    const targetY = Math.max(0, y);

    console.log('[ERR_SCROLL_FIXED]', {
      y, targetY, rectTop: rect.top, scrollY, topbarH, block: firstErrorBlock
    });

    // nastav rezervu pro header
    firstErrorBlock.style.scrollMarginTop = `${topbarH + 12}px`;

    // pokus o klasický scrollTo
    window.scrollTo({ top: targetY, behavior: 'smooth' });

    // fallback – pokud se stránka nepohnula, použij scrollIntoView
    setTimeout(() => {
      const after = window.scrollY || document.documentElement.scrollTop;
      if (Math.abs(after - targetY) < 5) {
        console.log('[ERR_SCROLL_FALLBACK] Using scrollIntoView, after=', after);
        firstErrorBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);

    // focus na první input (bez posunu)
    const focusable = firstErrorBlock.querySelector('input, select, textarea, .chip');
    if (focusable) focusable.focus({ preventScroll: true });
  }
}

/* ============== CTA BUTTONS ============== */
const btnBack = $('#btn-back');
if (btnBack) btnBack.onclick = async () => {

  // Pokud jsme na stepu 0 → chovej se stejně jako browser back
  if (currentStep === 0) {
    const ok = await confirmLeaveForm();
    if (ok) {
      sessionStorage.removeItem('formStarted');
      window.location.href = '/index.html';
    }
    return;
  }

  // Jinak jen použij historii:
  history.back();
};

/* ✅ 1) Jediná pravda – sjednocené Next chování */
async function goNextStep(){
  console.log("[DBG] goNextStep triggered");

  // ✅ validace aktuálního kroku
  if (!(await validateCurrent())) {
    console.log("[DBG] Next blocked by validation");
    return false;
  }

  // ✅ speciální čistící logika
  cleanupSportStateBeforeNext?.();

  const last = stepFiles.length - 1;

  // ✅ kontrola před Review (Step 7)
  if (currentStep === 6) {
    const ok = await beforeGoToStep7();
    if (!ok) return false;
  }

  // ✅ odemkneme další krok
  furthestStep = Math.max(furthestStep, currentStep + 1);

  if (currentStep < last) {
    currentStep++;
    renderStepbar(currentStep);
    await loadStep(currentStep);
    return true;
  } 
  
  // ✅ poslední krok → nákup
  handlePurchase?.();
  return true;
}


/* ✅ 2) btnNext používá jednotnou funkci */
const btnNext = $('#btn-next');
if (btnNext) btnNext.onclick = async ()=>{
  console.log("[DBG] Kliknuto na DALŠÍ");
    // Use wrapper so history is updated when user clicks the UI button
   await window.goNextStep();
};


// Klik na brand: potvrdit odchod z formuláře
document.querySelector('.brand.header-logo')?.addEventListener('click', async (e)=>{
  e.preventDefault();
  const ok = await confirmLeaveForm();
  if (ok) {
    sessionStorage.removeItem('formStarted'); // <– smažeme flag
    window.location.href = '/index.html';
  }
});
// Klik na odkazy ve footeru: potvrdit odchod z formuláře
document.querySelectorAll('.footer-links a').forEach(link => {
  link.addEventListener('click', async (e) => {
    e.preventDefault();
    const ok = await confirmLeaveForm();
    if (ok) {
      window.location.href = link.href; // přesměruje na konkrétní odkaz
    }
  });
});

/* ============================================================
   BROWSER HISTORY SUPPORT FOR WIZARD — FINAL STABLE VERSION
   ============================================================ */

/* ========== UTILS ========== */

// Vytvoří URL se zachováním ostatních paramů (např. lang=cs)
function makeStepUrl(step) {
  const url = new URL(window.location);
  url.searchParams.set("step", String(step));
  // RETURN RELATIVE URL -> bezpečnější pro pushState/replaceState
  return url.pathname + url.search + url.hash;
}

// Přesun na krok (bez validací)
async function applyStep(step) {
  currentStep = Math.max(0, Math.min(stepFiles.length - 1, step));
  renderStepbar(currentStep);
  await loadStep(currentStep);
}

/* ========== POPSTATE HANDLER (BACK / FORWARD) ========== */

window.addEventListener("popstate", async (ev) => {
  const state = ev.state;

  // Pokud chybí state nebo není step → pokus o „opustit“ wizard (back do předchozí stránky)
  if (!state || state.step === undefined) {
    // Když jsme na první stránce formuláře, ukaž vlastní modal místo okamžitého opuštění
    if (currentStep === 0) {
      const ok = await confirmLeaveForm();
      if (ok) {
        // uživatel potvrdil opuštění → necheme prohlížeč jít dál (zpět)
        // Použij history.back() / go(-1) pro skutečné opuštění
        history.back();
      } else {
        // zrušeno → obnovíme validní stav aplikace aby zůstal v místě
        history.pushState({ step: currentStep }, "", makeStepUrl(currentStep));
      }
      return;
    }

    // Default fallback: udržet uživatele na místě a opravit URL/stav
    history.replaceState(
      { step: currentStep },
      "",
      makeStepUrl(currentStep)
    );
    return;
  }

  const target = Number(state.step);

  /* ← Pohyb zpět */
  if (target < currentStep) {
    await applyStep(target); 
    return;
  }

  /* → Pohyb dopředu */
  if (target > currentStep) {
    while (currentStep < target) {
      const ok = await goNextStep();
      if (!ok) {
        // Validace zablokovala → vrátíme historii na poslední validní krok
        history.replaceState(
          { step: currentStep },
          "",
          makeStepUrl(currentStep)
        );
        return;
      }
    }
  }
});

/* ========== WRAP goToStep + goNextStep (aby zapisovaly historii) ========== */

// Expose safe wrappers on window that call the local functions (avoid calling window.* originals)
window.goToStep = async function (step) {
  await goToStep(step); // call local implementation
  history.pushState({ step }, "", makeStepUrl(step));
};

window.goNextStep = async function () {
  const ok = await goNextStep(); // call local implementation
  if (ok) {
    history.pushState({ step: currentStep }, "", makeStepUrl(currentStep));
  }
  return ok;
};

/* ============== STEP MANAGEMENT ============== */

async function goToStep(i) {
  if (currentStep === 2) {
    cleanupSportStateBeforeNext();
  }

  currentStep = i;
  renderStepbar(currentStep);
  await loadStep(currentStep);
}

// Postupné "proklikáni" next až na target
async function goForwardToStep(target) {
  while (currentStep < target) {
    const ok = await goNextStep();
    if (!ok) return false;
  }
  return true;
}

function bindStepperClicks() {
  const wrap = $('#stepper');
  if (!wrap) return;

  wrap.querySelectorAll('.dot').forEach(btn => {
    btn.onclick = async () => {
      const target = Number(btn.dataset.step);
      if (Number.isNaN(target) || target === currentStep) return;

      if (target < currentStep) {
          // goToStep wrapper adds a history entry
         await window.goToStep(target);
        return;
      }

      if (target === currentStep + 1) {
        // next step via wrapper -> pushes history
         await window.goNextStep();
        return;
      }

      if (target <= furthestStep) {
         // advance step-by-step (validations) then push final state so history matches UI
        const ok = await goForwardToStep(target);
        if (ok) {
           history.pushState({ step: currentStep }, "", makeStepUrl(currentStep));
          }
        return;
      }
    };
  });
}



/* ============== BOOT ============== */
(async () => {
  try {
    await bootI18n({
      onAfterApply: () => {
        applyI18n();
        renderStepbar(currentStep);
      }
    });

    const params = new URLSearchParams(location.search);

    // === RESUME LOGIKA ===
    if (params.get("resume") === "true") {
      const savedForm = localStorage.getItem("formState");
      const savedStep = parseInt(localStorage.getItem("formStep") || "6", 10);

      if (savedForm) {
        try {
          Object.assign(formState, JSON.parse(savedForm));
          currentStep = Math.max(0, Math.min(savedStep, stepFiles.length - 1));
          furthestStep = currentStep;

          console.log("[DBG] ✅ Resume → step", currentStep);

          await loadStep(currentStep);

          // ✅ NE replaceState, ale pushState → přidáme validní záznam pro popstate
          history.pushState({ step: currentStep }, "", makeStepUrl(currentStep));
          renderStepbar(currentStep);
        } catch (err) {
          console.warn("Resume failed:", err);

          currentStep = 0;
          await loadStep(0);
          history.pushState({ step: 0 }, "", makeStepUrl(0));
        }
      } else {
        currentStep = 0;
        await loadStep(0);
        history.pushState({ step: 0 }, "", makeStepUrl(0));
      }

    } else {
      // === NORMAL START ===
      currentStep = 0;

      await loadStep(0);

      // ✅ První krok musí být PUSH, NE replace,
      // jinak popstate nemá žádný validní stav
      history.pushState({ step: 0 }, "", makeStepUrl(0));
    }

  } catch (e) {
    console.error('BOOT failed:', e);
  }
})();





