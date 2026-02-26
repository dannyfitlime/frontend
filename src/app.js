// frontend/src/app.js - cleaned up and fixed i18n + locale-based detection
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
const dbg = () => {};

/* ================ GLOBALS ================= */
export const $ = (sel) => document.querySelector(sel);
let currentStep = 0;
let furthestStep = 0; // Furthest unlocked step (index)


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

function persistFormDraft(step = currentStep) {
  const safeStep = Math.max(0, Math.min(stepFiles.length - 1, Number(step) || 0));
  try {
    const payload = {
      ...formState,
      locale: i18n?.lang || formState?.locale || 'cs'
    };
    localStorage.setItem('formState', JSON.stringify(payload));
    localStorage.setItem('formStep', String(safeStep));
  } catch (err) {
    console.warn('Draft persist failed:', err);
  }
}
/* ===== Topbar: switch to compact after scrolling down ===== */
(function(){
  const topbar = document.getElementById('topbar');
  if(!topbar) return;

  let ticking = false;
  function onScroll(){
    const y = window.scrollY || window.pageYOffset || 0;
    // Compact mode once we are no longer at the very top (e.g. > 10 px)
    if (y > 10) topbar.classList.add('compact');
    else        topbar.classList.remove('compact');
    ticking = false;
  }
  window.addEventListener('scroll', ()=>{
    if(!ticking){ requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });

  // Initial state (when landing in the middle of the page)
  onScroll();
})();

// --- Cookies bar init (place in app.js, e.g. below GLOBALS) ---
function initCookiesBar(){
  const bar     = document.getElementById('cookiesBar');
  const accept  = document.getElementById('cookiesAccept');
  const decline = document.getElementById('cookiesDecline');
  if (!bar) return; // Page does not have the bar

  const show = () => bar.classList.add('show');
  const hide = () => bar.classList.remove('show');

  if (localStorage.getItem('cookiesChoice') === null) {
    requestAnimationFrame(show);
  }
  accept?.addEventListener('click', () => {
    localStorage.setItem('cookiesChoice', 'accept');
    // TODO: initialize analytics/marketing here later
    hide();
  });
  decline?.addEventListener('click', () => {
    localStorage.setItem('cookiesChoice', 'decline');
    hide();
  });

  // Optionally expose globally
  window.showCookiesBar = show;
  window.hideCookiesBar = hide;
}


/* ===== Cookies bottom sheet (homepage only) ===== */
(function initCookiesBar(){
  // Condition: only on home page, by body marker or path
  const isHome = document.body?.dataset?.page === 'home' || location.pathname === '/' || location.pathname.endsWith('/index.html');
  const bar = document.getElementById('cookiesBar');
  if(!isHome || !bar) return;

  const ACCEPT_KEY = 'cookieConsent';
  if(localStorage.getItem(ACCEPT_KEY)) return; // Already acknowledged

  const accept = document.getElementById('cookiesAccept');
  const decline = document.getElementById('cookiesDecline');

  // Show with animation
  bar.classList.add('is-open');
  bar.setAttribute('aria-hidden', 'false');

  function closeBar(status){
    try { localStorage.setItem(ACCEPT_KEY, status); } catch(e){}
    bar.classList.remove('is-open');
    // After animation, hide only for screen readers
    setTimeout(()=> bar.setAttribute('aria-hidden','true'), 240);
  }

  accept?.addEventListener('click', () => closeBar('accepted'));
  decline?.addEventListener('click', () => closeBar('declined'));

  // ESC closes the sheet
  window.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeBar('dismissed'); });

  // Focus the button (accessibility)
  setTimeout(()=> accept?.focus(), 50);
})();

/* ===== Sticky footer layout needs nothing else ===== */
// Make sure CSS has no leftovers: main{ padding-bottom: ... } and footer{ position: fixed; } - replaced by flex layout.

/* ===== Footer year sync (optional) ===== */
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
        <h3 id="leave_t">${t('common.leave_title') || 'Leave form?'}</h3>
        <p id="leave_d">${t('common.leave_text') || 'If you leave, you may lose unsaved changes. Do you want to continue to the home page?'}</p>
        <div class="leave-actions">
          <button class="btn-stay"  id="btn-stay">${t('common.leave_stay') || 'Stay'}</button>
          <button class="btn-leave" id="btn-leave">${t('common.leave_leave') || 'Leave'}</button>
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
    // Focus primary action:
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
  // Prefer the element that can actually scroll (scrollHeight > clientHeight)
  const capable = infos.filter(i => i.scrollHeight > i.clientHeight + 2);
  // Small fallback: if nothing scrolls, use scrollingElement
  const pick = capable[0] || infos.find(i => i.who === 'scrollingElement') || infos[0];  
  return pick?.el || window;
}
/**
 * Smart scroll-to-top: works on mobile too and goes to the true page top (<html> or <body>).
 */
function scrollToTopSmart(reason = '') {
  const tries = [0, 120, 300]; // Retry after reflow

  tries.forEach(delay => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        // Detect the real scroller
        const scroller = detectScroller();
        const target =
          document.scrollingElement || document.documentElement || document.body;

        const before = target.scrollTop;
        const smooth = delay === tries[tries.length - 1];

        try {
          // Always scroll via the main document scroller
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

          // Fallback: if nothing happened, force-scroll to <html> or <body>
          if (delay === tries[tries.length - 1] && Math.abs(after - before) < 5) {            
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;

            // Safety net: scrollIntoView to the top of the document
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
        el.textContent = translated; // Allows translation also for <option>
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
              aria-label="${(t('common.step')||'Step')} ${i+1}">
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
    // Scroll to top immediately (before fetch)
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
    
    // Next: hidden on the last step, otherwise 'Next'
    const nextBtn = $('#btn-next');
    if (nextBtn) {
      if (idx === stepFiles.length - 1) {
        nextBtn.style.display = 'none';
      } else {
        nextBtn.style.display = '';
        nextBtn.textContent = t('common.next') || 'Next';
      }
    }

    // Back is always allowed; on step 1 it only opens confirmLeaveForm()
    const backBtn = $('#btn-back');
    if (backBtn) {
      backBtn.disabled = false;
      backBtn.setAttribute('aria-disabled','false');
      // Optional: different label on the first step
      const backLabel = (idx === 0) ? (t('common.home') || 'Home') : (t('common.back') || 'Back');
      backBtn.innerHTML = `${backLabel}`;
    }
    
    dbg('step ready', idx);
    persistFormDraft(idx);

    // Smart scroll reset - works on mobile and after reflow
    scrollToTopSmart('after-loadStep');
    
  }catch(e){
    console.error('Step load failed:', e);
    const host = $('#step-container');
    if (host) host.innerHTML = `<section><h1>Step loading error</h1><pre style="white-space:pre-wrap">${String(e)}</pre></section>`;
    dbg('loadStep error', String(e));
  }
}

/* ============== VALIDATION FLOW ============== */
async function validateCurrent(){
  let errs = {};

  switch (currentStep) {
    case 0: // Profile
      errs = validateProfile(formState.profile, t);
      break;

    case 1: // Goal
      errs = validateGoal(formState.goal, t);
      break;


    case 2: // Sport
      errs = validateSport(formState.sport, t);
      break;

    case 3: // Macros (nutrition)
      errs = validateMacros(formState.nutrition, t);
      break;

    case 4: // Diet (nutrition)
      errs = validateDiet(formState.nutrition, t);
      break;
    case 5: // Menu settings
      errs = validateMenuSettings(formState.nutrition, t);
      break;

    case 6: // Plan
      errs = validatePlan?.(formState.plan, t) || {};
      break;

    case 7: // Review
      errs = validateReview?.(formState, t) || {};
      break;
  }

  showErrors(errs);

  const ok = Object.keys(errs).length === 0;
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

    // Reserve space for the header
    firstErrorBlock.style.scrollMarginTop = `${topbarH + 12}px`;

    // Try regular scrollTo
    window.scrollTo({ top: targetY, behavior: 'smooth' });

    // Fallback: if the page did not move, use scrollIntoView
    setTimeout(() => {
      const after = window.scrollY || document.documentElement.scrollTop;
      if (Math.abs(after - targetY) < 5) {
        firstErrorBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);

    // Focus first input (without scrolling)
    const focusable = firstErrorBlock.querySelector('input, select, textarea, .chip');
    if (focusable) focusable.focus({ preventScroll: true });
  }
}

/* ============== CTA BUTTONS ============== */
const btnBack = $('#btn-back');
if (btnBack) btnBack.onclick = async () => {

  // If we are on step 0, behave like browser back
  if (currentStep === 0) {
    const ok = await confirmLeaveForm();
    if (ok) {
      sessionStorage.removeItem('formStarted');
      window.location.href = '/index.html';
    }
    return;
  }

  // Otherwise just use history:
  history.back();
};

/* 1) Single source of truth - unified Next behavior */
async function goNextStep(){
  // Validate current step
  if (!(await validateCurrent())) {
    return false;
  }

  // Special cleanup logic
  cleanupSportStateBeforeNext?.();

  const last = stepFiles.length - 1;

  // Check before Review (Step 7)
  if (currentStep === 6) {
    const ok = await beforeGoToStep7();
    if (!ok) return false;
  }

  // Unlock the next step
  furthestStep = Math.max(furthestStep, currentStep + 1);

  if (currentStep < last) {
    currentStep++;
    renderStepbar(currentStep);
    await loadStep(currentStep);
    return true;
  } 
  
  // Last step -> purchase
  handlePurchase?.();
  return true;
}


/* 2) btnNext uses the unified function */
const btnNext = $('#btn-next');
if (btnNext) btnNext.onclick = async ()=>{
    // Use wrapper so history is updated when user clicks the UI button
   await window.goNextStep();
};


// Click on brand: confirm leaving the form
document.querySelector('.brand.header-logo')?.addEventListener('click', async (e)=>{
  e.preventDefault();
  const ok = await confirmLeaveForm();
  if (ok) {
    sessionStorage.removeItem('formStarted'); // Remove the flag
    window.location.href = '/index.html';
  }
});
// Click on footer links: confirm leaving the form
document.querySelectorAll('.footer-links a').forEach(link => {
  link.addEventListener('click', async (e) => {
    e.preventDefault();
    const ok = await confirmLeaveForm();
    if (ok) {
      window.location.href = link.href; // Redirect to the selected link
    }
  });
});

/* ============================================================
   BROWSER HISTORY SUPPORT FOR WIZARD - FINAL STABLE VERSION
   ============================================================ */

/* ========== UTILS ========== */

// Create URL while preserving other params (e.g. lang=cs)
function makeStepUrl(step) {
  const url = new URL(window.location);
  url.searchParams.set("step", String(step));
  // Return relative URL -> safer for pushState/replaceState
  return url.pathname + url.search + url.hash;
}

// Move to a step (without validation)
async function applyStep(step) {
  currentStep = Math.max(0, Math.min(stepFiles.length - 1, step));
  renderStepbar(currentStep);
  await loadStep(currentStep);
}

/* ========== POPSTATE HANDLER (BACK / FORWARD) ========== */

window.addEventListener("popstate", async (ev) => {
  const state = ev.state;

  // If state is missing or has no step -> attempt to leave the wizard (back to previous page)
  if (!state || state.step === undefined) {
    // If we are on the first form page, show a custom modal instead of leaving immediately
    if (currentStep === 0) {
      const ok = await confirmLeaveForm();
      if (ok) {
        // User confirmed leaving -> let the browser continue back navigation
        // Use history.back() / go(-1) to actually leave
        history.back();
      } else {
        // Cancelled -> restore valid app state so the user stays in place
        history.pushState({ step: currentStep }, "", makeStepUrl(currentStep));
      }
      return;
    }

    // Default fallback: keep user in place and repair URL/state
    history.replaceState(
      { step: currentStep },
      "",
      makeStepUrl(currentStep)
    );
    return;
  }

  const target = Number(state.step);

  /* Backward navigation */
  if (target < currentStep) {
    await applyStep(target); 
    return;
  }

  /* Forward navigation */
  if (target > currentStep) {
    while (currentStep < target) {
      const ok = await goNextStep();
      if (!ok) {
        // Validation blocked progress -> return history to the last valid step
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

// Advance step-by-step with Next until target
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

    // === Resume logic ===
    if (params.get("resume") === "true") {
      const savedForm = localStorage.getItem("formState");
      const savedStep = parseInt(localStorage.getItem("formStep") || "6", 10);

      if (savedForm) {
        try {
          Object.assign(formState, JSON.parse(savedForm));
          currentStep = Math.max(0, Math.min(savedStep, stepFiles.length - 1));
          furthestStep = currentStep;

          await loadStep(currentStep);

          // Do NOT use replaceState; pushState adds a valid popstate entry
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

      // First step must be PUSH, not replace,
      // otherwise popstate has no valid state
      history.pushState({ step: 0 }, "", makeStepUrl(0));
    }

  } catch (e) {
    console.error('BOOT failed:', e);
  }
})();






