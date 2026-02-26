import { renderMacroCharts } from './charts.js';
import { formState } from './state.js';
import { $, applyI18n, showErrors } from './app.js';
import {
  validateProfile, validateGoal, validateSport, BMR_LIMITS,
  validateMacros, validateDiet, validatePlan, validateReview
} from './validation.js';
import { i18n as I18N, SUPPORTED as SUPPORTED_LANGS, t as T, bootI18n, loadLang as coreLoadLang } from './i18n-core.js';

// === I18N aliases (so the rest of app.js can stay unchanged) ===
const i18n = I18N;
const t = (path) => T(path);
const SUPPORTED = SUPPORTED_LANGS;

function getApiBaseUrl() {
  const fromEnv = (import.meta.env?.VITE_API_BASE_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const fromWindow = (window.__FITLIME_API_BASE_URL__ || window.FITLIME_API_BASE_URL || '').trim();
  if (fromWindow) return fromWindow.replace(/\/+$/, '');

  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return '';
  if (host === 'fitlime.cz' || host === 'www.fitlime.cz') return 'https://api.fitlime.cz';
  return '';
}

const API_BASE_URL = getApiBaseUrl();
const apiUrl = (path) => `${API_BASE_URL}${path}`;

/* ============== STEP 1 - PROFILE ============== */
export function bindProfileStep() {
  const bindNum = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = formState.profile[key] ?? '';
    el.oninput = () => {
      formState.profile[key] = el.value ? parseInt(el.value, 10) : null;
    };
  };
  const bindChoice = (groupId, key) => {
    const chips = document.querySelectorAll(`#${groupId} .chip`);
    chips.forEach(ch => {
      if (formState.profile[key] === ch.dataset.value) ch.classList.add('selected');
      ch.onclick = () => {
        chips.forEach(x => x.classList.remove('selected'));
        ch.classList.add('selected');
        formState.profile[key] = ch.dataset.value;
      };
    });
  };

  bindChoice('sex_group', 'sex');
  bindNum('age', 'age');
  bindNum('height_cm', 'height_cm');
  bindNum('weight_kg', 'weight_kg');
  bindChoice('activity_group', 'activity');
  bindChoice('steps_bucket', 'steps_bucket');
}
/* ============== STEP 2 - GOAL & BMR ============== */
const KCAL_TO_KJ = 4.184;
const toKJ = (kcal) => kcal * KCAL_TO_KJ;
const toKcal = (kj) => kj / KCAL_TO_KJ;

const roundKcal = (v) => Math.round(v / 10) * 10;  // kcal -> 10
const roundKJ = (v) => Math.round(v / 50) * 50;  // kJ -> 50
const roundByUnit = (v, u) => (u === 'kcal' ? roundKcal(v) : roundKJ(v));


function activeUnit() {
  const unit = formState.goal?.energy_unit;
  return unit === 'kJ' ? 'kJ' : 'kcal';
}

function toActiveUnitFromKcal(kcal) {
  const u = activeUnit();
  const raw = (u === 'kcal') ? kcal : toKJ(kcal);
  return roundByUnit(raw, u);
}

function toActiveUnitFromKJ(kj) {
  const u = activeUnit();
  const raw = (u === 'kcal') ? toKcal(kj) : kj;
  return roundByUnit(raw, u);
}

function calcBMR(sex, age, height, weight) {
  if (sex === 'male') return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  if (sex === 'female') return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  return Math.round(((10 * weight + 6.25 * height - 5 * age + 5) + (10 * weight + 6.25 * height - 5 * age - 161)) / 2);
}

function ensureBmrFromProfile() {
  const { sex, age, height_cm, weight_kg } = formState.profile || {};
  if (sex && age && height_cm && weight_kg) {
    const calc = calcBMR(sex, age, height_cm, weight_kg);
    formState.goal ||= {};
    if (!formState.goal.bmr_kcal && !formState.goal.bmr_override) {
      formState.goal.bmr_kcal = calc;
    }
  }
}

export function bindGoalStep() {
  ensureBmrFromProfile();

  const bindChipGroup = (groupId, key, cb) => {
    const chips = document.querySelectorAll(`#${groupId} .chip`);
    chips.forEach(ch => {
      if ((formState.goal?.[key]) === ch.dataset.value) ch.classList.add('selected');
      ch.onclick = () => {
        chips.forEach(x => x.classList.remove('selected'));
        ch.classList.add('selected');
        formState.goal ||= {};
        formState.goal[key] = ch.dataset.value;
        cb && cb(ch.dataset.value);
      };
    });
  };

  formState.goal ||= {};

  // default energy unit
  if (!formState.goal.energy_unit) {
    formState.goal.energy_unit = 'kcal';
  }

  bindChipGroup('target_group', 'target', (val) => {
    const map = { lose: t('step2.help_lose'), maintain: t('step2.help_maintain'), gain: t('step2.help_gain') };
    const el = document.getElementById('target_help');
    if (el) el.textContent = map[val] || '';
  });

  // KEY CHANGE: use 'energy_unit' instead of 'energyUnit'
  bindChipGroup('energy_unit_group', 'energy_unit', (val) => {
    formState.goal ||= {};
    formState.goal.energy_unit = val;

    renderBmr();
    updateBmrHelp();
  });



  function renderBmr() {
    const input = document.getElementById('bmr_value');
    const unitEl = document.getElementById('bmr_unit');
    const kcal = formState.goal.bmr_override ?? formState.goal.bmr_kcal ?? 1800;
    const u = activeUnit();
    if (unitEl) unitEl.textContent = u;
    if (input) input.value = String(toActiveUnitFromKcal(kcal));
  }


  function updateBmrHelp() {
    const helpEl = document.getElementById('bmr_help');
    if (!helpEl) return;

    const unit = activeUnit();
    const limits = BMR_LIMITS[unit];

    const min = roundByUnit(limits.min, unit);
    const max = roundByUnit(limits.max, unit);

    const locale = i18n?.lang || 'cs';
    const minStr = Number(min).toLocaleString(locale);
    const maxStr = Number(max).toLocaleString(locale);

    const base = (unit === 'kJ'
      ? (t('step2.bmr_help_kj') || 'Calculated from your profile (kJ/day). You can adjust it manually.')
      : (t('step2.bmr_help_kcal') || 'Calculated from your profile (kcal/day). You can adjust it manually.')
    );
    const rangeWord = t('common.range') || 'Range';
    const perDay = t('common.per_day_short') || 'day';

    helpEl.textContent = `${base} ${rangeWord}: ${minStr}–${maxStr} ${unit}/${perDay}.`;
  }


  renderBmr();
  updateBmrHelp();


  const bmrInput = document.getElementById('bmr_value');
  if (bmrInput) {
    bmrInput.oninput = () => {
      const raw = bmrInput.value.trim();
      if (raw === '') {
        formState.goal.bmr_override = null;
        return;
      }
      const num = Number(raw.replace(',', '.'));
      if (!Number.isFinite(num)) {
        formState.goal.bmr_override = null;
        return;
      }
      const kcalVal = (activeUnit() === 'kJ') ? toKcal(num) : num;
      formState.goal.bmr_override = roundKcal(kcalVal);
    };
  }
}

/* ============== STEP 3 - SPORT ================= */
const OWN_BLOCKS_LIMIT = 10;
function updateAddOwnBlockControls() {
  const btn = document.getElementById('add_own_block');
  const hint = document.getElementById('add_own_block_limit_hint');

  if (!btn) return;

  const count = (formState.sport?.ownBlocks || []).length;
  const limitReached = count >= OWN_BLOCKS_LIMIT;

  btn.disabled = limitReached || formState.sport?.level !== 'sport';
  btn.classList.toggle('limit-reached', limitReached);
  if (limitReached) {
    // If you want translations here, use t('step3.add_own_block_full'), etc.
    btn.textContent = t?.('step3.add_own_block_full') || 'Capacity reached';
    if (hint) {
      hint.textContent = t?.('step3.add_own_block_limit_hint')
        || 'You can add up to 10 sports. Remove one before adding a new one.';
    }
  } else {
    btn.textContent = t?.('step3.add_own_block') || 'Add another sport';
    if (hint) hint.textContent = '';
  }
}

function ensureSportState() {
  formState.sport ||= {};
  formState.sport.ownBlocks ||= [];
  formState.sport.pickedOwn ||= [];
  formState.sport.mainSportOwn = formState.sport.mainSportOwn ?? null;
  formState.sport.picked ||= [];
  formState.sport.mainSportId = formState.sport.mainSportId ?? null;

  // UPDATED: if user is set to 'sport', always use own plan
  if (formState.sport.level === 'sport') {
    formState.sport.plan_choice = 'own';
  } else if (!formState.sport.level) {
    formState.sport.plan_choice = null;
  }
}

function ensureOwnDefaults() {
  formState.sport ||= {};
  formState.sport.ownBlocks ||= [];
  if (formState.sport.ownBlocks.length === 0) {
    formState.sport.ownBlocks.push({ sportId: '', sessions: 3, minutes: 45, intensity: 'medium' });
  }
  formState.sport.ownBlocks.forEach(b => {
    if (!b.sportId) b.sportId = '';
    if (!b.sessions) b.sessions = 3;
    if (!b.minutes) b.minutes = 45;
    if (!b.intensity) b.intensity = 'medium';
  });
  recomputePickedOwnFromBlocks();
  if (!formState.sport.mainSportOwn && (formState.sport.pickedOwn || []).length > 0) {
    formState.sport.mainSportOwn = formState.sport.pickedOwn[0];
  }
  syncAliasToActive();
}

async function loadCatalog() {
  if (window._sportCatalog) return window._sportCatalog;
  const res = await fetch('/sports/catalog.json');
  if (!res.ok) { console.warn('catalog fetch failed', res.status); return {}; }
  const data = await res.json();
  window._sportCatalog = data;
  return data;
}

function sportLabel(rec, lang) {
  return rec?.labels?.[lang] || rec?.labels?.en || rec?.id || '';
}

function groupCatalogByGroup(catalog) {
  const groups = {};
  for (const [id, rec] of Object.entries(catalog || {})) {
    const g = rec.group || 'other';
    (groups[g] ||= []).push({ id, ...rec });
  }
  return groups;
}


// UPDATED: active plan = own when the user does sports
const activePlan = () => (formState.sport?.level === 'sport' ? 'own' : null);

// UPDATED: aliases are driven only by the own plan
function syncAliasToActive() {
  const plan = activePlan();
  if (plan === 'own') {
    formState.sport.picked = [...(formState.sport.pickedOwn || [])];
    formState.sport.mainSportId = formState.sport.mainSportOwn || null;
  } else {
    formState.sport.picked = [];
    formState.sport.mainSportId = null;
  }
}

// UPDATED: handle only mainSportOwn
function ensureMainForActive() {
  const picked = formState.sport.pickedOwn || [];
  if (picked.length === 0) {
    formState.sport.mainSportOwn = null;
  } else {
    const cur = formState.sport.mainSportOwn;
    if (!cur || !picked.includes(cur)) {
      formState.sport.mainSportOwn = picked[0];
    }
  }
  syncAliasToActive();
}

// UPDATED: set main sport only for the own plan
function setMainForActive(id) {
  if (!id) return;
  if (formState.sport.level === 'sport') {
    formState.sport.mainSportOwn = id;
    syncAliasToActive();
  }
}

function buildSportsSelectOptions(byGroup, lang, selectedId) {
  const labels = {
    endurance: t('step3.groups.title_endurance') || 'Endurance sports',
    individual: t('step3.groups.title_individual') || 'Individual sports',
    team: t('step3.groups.title_team') || 'Team sports',
    fitness: t('step3.groups.title_fitness') || 'Fitness & gym',
    water: t('step3.groups.title_water') || 'Water sports',
    winter: t('step3.groups.title_winter') || 'Winter sports',
    combat: t('step3.groups.title_combat') || 'Combat sports',
    other: t('step3.groups.title_other') || 'Other sports'
  };
  const order = ['endurance', 'individual', 'team', 'fitness', 'water', 'winter', 'combat', 'other'];

  // This option is shown as a placeholder, but not in the dropdown list
  let html = `<option value="" disabled ${!selectedId ? 'selected' : ''} hidden>
                ${t('step3.select_sport_placeholder') || 'Select a sport'}
              </option>`;

  for (const g of order) {
    const list = byGroup[g]; if (!list || !list.length) continue;
    html += `<optgroup label="${labels[g]}">`;
    list.slice().sort((a, b) => sportLabel(a, lang).localeCompare(sportLabel(b, lang)))
      .forEach(rec => {
        const lbl = sportLabel(rec, lang);
        html += `<option value="${rec.id}" ${rec.id === selectedId ? 'selected' : ''}>${lbl}</option>`;
      });
    html += `</optgroup>`;
  }
  return html;
}


function emptyOwnBlock() {
  return { sportId: '', sessions: 3, minutes: 45, intensity: 'medium' };
}

function recomputePickedOwnFromBlocks() {
  const set = new Set();
  (formState.sport.ownBlocks || []).forEach(b => { if (b.sportId) set.add(b.sportId); });
  formState.sport.pickedOwn = Array.from(set);
}

// Same logic for own blocks
function renderOwnBlocks() {
  const host = document.getElementById('own_blocks_container');
  if (!host) return;

  const catalog = window._sportCatalog || {};
  const lang = i18n.lang || 'en';
  const byGroup = groupCatalogByGroup(catalog);

  if (!Array.isArray(formState.sport.ownBlocks) || formState.sport.ownBlocks.length === 0) {
    formState.sport.ownBlocks = [emptyOwnBlock()];
  }


  recomputePickedOwnFromBlocks();
  if (!formState.sport.mainSportOwn && formState.sport.pickedOwn.length > 0) {
    formState.sport.mainSportOwn = formState.sport.pickedOwn[0];
  }
  syncAliasToActive();

  host.innerHTML = '';
  formState.sport.ownBlocks.forEach((b, idx) => {
    const card = document.createElement('div');
    card.className = 'own-block-card';
    card.innerHTML = `
      <div class="own-block-grid">
        <div class="field">
          <label for="own_sport_${idx}"><strong data-i18n="step3.sports">Sport</strong></label>
          <select id="own_sport_${idx}" name="own_blocks[${idx}][sport_id]" class="own-sport-select" data-idx="${idx}">
            ${buildSportsSelectOptions(byGroup, lang, b.sportId)}
          </select>
          <div class="error" id="err-picked_own_${idx}"></div>
        </div>

        <div class="field">
          <label for="own_sessions_${idx}" data-i18n="step3.sessions_per_week">Trainings/week</label>
          <input id="own_sessions_${idx}" name="own_blocks[${idx}][sessions]" type="number" class="own-sessions" data-idx="${idx}" min="1" max="18" value="${b.sessions ?? ''}" />
          <div class="error" id="err-sessions_per_week_${idx}"></div>
        </div>

        <div class="field">
          <label for="own_intensity_${idx}" data-i18n="step3.intensity">Intensity</label>
          <select id="own_intensity_${idx}" name="own_blocks[${idx}][intensity]" class="own-intensity" data-idx="${idx}">
            <option value="low"    ${b.intensity === 'low' ? 'selected' : ''}    data-i18n="step3.intensity_low">Low</option>
            <option value="medium" ${b.intensity === 'medium' ? 'selected' : ''} data-i18n="step3.intensity_medium">Medium</option>
            <option value="high"   ${b.intensity === 'high' ? 'selected' : ''}   data-i18n="step3.intensity_high">High</option>
          </select>
          <div class="error" id="err-intensity_${idx}"></div>
        </div>

        <div class="field">
          <label for="own_minutes_${idx}" data-i18n="step3.minutes">Duration (min)</label>
          <input id="own_minutes_${idx}" name="own_blocks[${idx}][minutes]" type="number" class="own-minutes" data-idx="${idx}" min="15" max="300" value="${b.minutes ?? ''}" />
          <div class="error" id="err-minutes_${idx}"></div>
        </div>
      </div>

      <div class="own-block-actions">
        <button type="button" class="btn-del-block" data-idx="${idx}" ${formState.sport.ownBlocks.length <= 1 ? 'disabled' : ''}>×</button>
      </div>
    `;
    host.appendChild(card);
  });

  host.querySelectorAll('.own-sport-select').forEach(sel => {
    sel.onchange = () => {
      const i = +sel.dataset.idx;
      formState.sport.ownBlocks[i].sportId = sel.value;
      recomputePickedOwnFromBlocks();
      if (activePlan() === 'own') ensureMainForActive();
      renderMainSportChips();
      onLevelOrPlanChanged();
    };
  });

  host.querySelectorAll('.own-sessions').forEach(inp => {
    inp.oninput = () => {
      const i = +inp.dataset.idx;
      formState.sport.ownBlocks[i].sessions = +inp.value || null;
      if (i === 0) formState.sport.sessions_per_week = formState.sport.ownBlocks[0].sessions;
    };
  });

  host.querySelectorAll('.own-intensity').forEach(sel => {
    sel.onchange = () => {
      const i = +sel.dataset.idx;
      formState.sport.ownBlocks[i].intensity = sel.value;
      if (i === 0) formState.sport.intensity = formState.sport.ownBlocks[0].intensity;
    };
  });

  host.querySelectorAll('.own-minutes').forEach(inp => {
    inp.oninput = () => {
      const i = +inp.dataset.idx;
      formState.sport.ownBlocks[i].minutes = +inp.value || null;
      if (i === 0) formState.sport.minutes = formState.sport.ownBlocks[0].minutes;
    };
  });

  host.querySelectorAll('.btn-del-block').forEach(btn => {
    btn.onclick = () => {
      const i = +btn.dataset.idx;
      if (formState.sport.ownBlocks.length <= 1) return;
      formState.sport.ownBlocks.splice(i, 1);
      recomputePickedOwnFromBlocks();
      if (activePlan() === 'own') ensureMainForActive();
      renderOwnBlocks();
      renderMainSportChips();
      onLevelOrPlanChanged();
    };
  });

  const first = formState.sport.ownBlocks[0] || {};
  formState.sport.sessions_per_week = first.sessions ?? null;
  formState.sport.minutes = first.minutes ?? null;
  formState.sport.intensity = first.intensity || 'medium';


  if (typeof applyI18n === 'function') applyI18n();
  updateAddOwnBlockControls();
}

// Keep this even if need_plan is no longer used in the UI - you can remove the whole block if needed.
function renderNeedSportsCollapsible(containerId, byGroup) {
  const host = document.getElementById(containerId);
  if (!host) return;
  const lang = i18n.lang || 'en';
  const groupLabels = {
    endurance: t('step3.groups.title_endurance') || 'Endurance sports',
    winter: t('step3.groups.title_winter') || 'Winter sports',
    team: t('step3.groups.title_team') || 'Team sports',
    individual: t('step3.groups.title_individual') || 'Individual sports',
    fitness: t('step3.groups.title_fitness') || 'Fitness & gym',
    water: t('step3.groups.title_water') || 'Water sports',
    combat: t('step3.groups.title_combat') || 'Combat sports',
    other: t('step3.groups.title_other') || 'Other sports'
  };
  host.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'need-groups-grid';
  const order = ['endurance', 'winter', 'team', 'individual', 'fitness', 'water', 'combat', 'other'];
  for (const g of order) {
    const list = byGroup[g]; if (!list || !list.length) continue;
    const details = document.createElement('details'); details.className = 'sport-accordion';
    const summary = document.createElement('summary'); summary.textContent = groupLabels[g];
    const chips = document.createElement('div'); chips.className = 'chips';
    list.slice().sort((a, b) => sportLabel(a, lang).localeCompare(sportLabel(b, lang)))
      .forEach(rec => {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'chip'; btn.dataset.value = rec.id;
        btn.textContent = sportLabel(rec, lang);
        if ((formState.sport.pickedNeed || []).includes(rec.id)) btn.classList.add('selected');
        btn.onclick = () => {
          const set = new Set(formState.sport.pickedNeed || []);
          if (set.has(rec.id)) { set.delete(rec.id); btn.classList.remove('selected'); }
          else { set.add(rec.id); btn.classList.add('selected'); }
          formState.sport.pickedNeed = Array.from(set);
          // activePlan will never be 'need_plan' now, so the UI is not updated to 'custom plan'
        };
        chips.appendChild(btn);
      });
    details.appendChild(summary); details.appendChild(chips); grid.appendChild(details);
  }
  host.appendChild(grid);
}

// UPDATED: uses only pickedOwn / mainSportOwn
function renderMainSportChips() {
  const wrap = document.getElementById('main_sport_chips');
  if (!wrap) return;
  ensureMainForActive();

  const picked = formState.sport.pickedOwn || [];
  wrap.innerHTML = '';
  if (picked.length === 0) return;

  const lang = i18n.lang || 'en';
  const cur = formState.sport.mainSportOwn;

  picked.forEach(id => {
    const rec = window._sportCatalog?.[id];
    const lbl = sportLabel(rec, lang) || id;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'chip'; btn.dataset.value = id; btn.textContent = lbl;
    if (cur === id) btn.classList.add('selected');
    btn.onclick = () => { setMainForActive(id); renderMainSportChips(); };
    wrap.appendChild(btn);
  });
}

export function onLevelOrPlanChanged() {
  ensureSportState();
  const lvl = formState.sport.level;
  const noneBlock = $('#sport_none_block');
  const planBlock = $('#sport_plan_block');
  const ownBlock = $('#own_plan_block');
  const needBlock = $('#need_plan_block');
  const hoursBlk = $('#hours_block');
  const mainBlk = $('#main_sport_block');

  if (!lvl) {
    [noneBlock, planBlock, ownBlock, needBlock, hoursBlk, mainBlk].forEach(x => x && (x.style.display = 'none'));
    return;
  }

  // lvl === 'none' => Nesportuji
  if (lvl === 'none') {
    formState.sport.plan_choice = null;
    syncAliasToActive();
    if (noneBlock) noneBlock.style.display = '';
    [planBlock, ownBlock, needBlock, hoursBlk, mainBlk].forEach(x => x && (x.style.display = 'none'));
    return;
  }

  // Any other case (new lvl === 'sport') => user does sports and ALWAYS HAS OWN PLAN
  formState.sport.plan_choice = 'own';
  if (noneBlock) noneBlock.style.display = 'none';
  if (planBlock) planBlock.style.display = '';

  if (ownBlock) ownBlock.style.display = '';
  if (needBlock) needBlock.style.display = 'none';

  renderOwnBlocks();
  ensureMainForActive();
  renderMainSportChips();

  if (hoursBlk) hoursBlk.style.display = 'none'; // Hours are not used for the own plan
  const hasPickedOwn = (formState.sport.pickedOwn || []).length > 0;
  if (mainBlk) mainBlk.style.display = hasPickedOwn ? '' : 'none';
}

export async function bindSportStep() {
  ensureSportState();
  const catalog = await loadCatalog();
  const byGroup = groupCatalogByGroup(catalog);

  const bindChipGroup = (groupId, target, key, cb) => {
    const chips = document.querySelectorAll(`#${groupId} .chip`);
    chips.forEach(ch => {
      if (target[key] === ch.dataset.value) ch.classList.add('selected');
      ch.onclick = () => {
        chips.forEach(x => x.classList.remove('selected'));
        ch.classList.add('selected');
        target[key] = ch.dataset.value;
        cb && cb();
      };
    });
  };

  bindChipGroup('sport_level_group', formState.sport, 'level', onLevelOrPlanChanged);

  // --- Dynamic help text for activity level explanation ---
  const levelHelpEl = document.getElementById('activity_help');
  const updateLevelHelp = (val) => {
    const map = {
      none: t('step3.help_none'),
      sport: t('step3.help_sport')
    };
    if (levelHelpEl) levelHelpEl.textContent = map[val] || '';
  };

  // Show text on load (e.g. when returning to this step)
  if (formState.sport?.level) {
    updateLevelHelp(formState.sport.level);
  }

  // Watch selection changes
  const levelChips = document.querySelectorAll('#sport_level_group .chip');
  levelChips.forEach(ch => {
    ch.addEventListener('click', () => updateLevelHelp(ch.dataset.value));
  });

  const noneWrap = $('#none_suggestions');

  // --- Chip clicks for 'What sports interest you' (max 3 items) ---
  const MAX_FUTURE_SPORTS = 3;
  const futureErrEl = document.getElementById('err-future');
  const clearFutureError = () => {
    if (futureErrEl) futureErrEl.textContent = '';
  };
  const showFutureMaxError = () => {
    if (futureErrEl) {
      futureErrEl.textContent = t?.('step3.error_future_max3') || 'You can select up to 3 sports.';
    }
  };

  const selected = new Set((formState.sport?.futureMulti || []).slice(0, MAX_FUTURE_SPORTS));
  formState.sport.futureMulti = Array.from(selected);

  noneWrap?.querySelectorAll('.chip').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.value;

      if (selected.has(id)) {
        selected.delete(id);
        btn.classList.remove('selected');
        clearFutureError();
      } else {
        if (selected.size >= MAX_FUTURE_SPORTS) {
          showFutureMaxError();
          return;
        }
        selected.add(id);
        btn.classList.add('selected');
        clearFutureError();
      }

      formState.sport.futureMulti = Array.from(selected);
      // formState.sport.future = id; // last clicked item, optionally informational
    };
  });

  // --- Re-initialize selected chips when returning to step 3 ---
  noneWrap?.querySelectorAll('.chip').forEach(btn => {
    if (selected.has(btn.dataset.value)) {
      btn.classList.add('selected');
    }
  });

  // UPDATED: no plan_choice_group selection - for sport always own
  if (formState.sport.level === 'sport') {
    formState.sport.plan_choice = 'own';
    ensureOwnDefaults();
  }

  // If you want to fully disable the 'need plan' section, you can remove renderNeedSportsCollapsible
  // renderNeedSportsCollapsible('need_sports_list', byGroup);

  if (formState.sport.level === 'sport') {
    ensureOwnDefaults();
    renderOwnBlocks();
    renderMainSportChips();
  }

  $('#add_own_block')?.addEventListener('click', () => {
    formState.sport ||= {};
    formState.sport.ownBlocks ||= [];

    // Hard limit - do not add anything if there are already 10
    if (formState.sport.ownBlocks.length >= OWN_BLOCKS_LIMIT) {
      return;
    }

    formState.sport.ownBlocks.push(emptyOwnBlock());
    recomputePickedOwnFromBlocks();
    renderOwnBlocks();
    renderMainSportChips();
    onLevelOrPlanChanged();
  });

  const hpw = $('#hours_per_week');
  if (hpw) {
    const save = () => {
      formState.sport.preferences ||= {};
      formState.sport.preferences.hours_per_week = +hpw.value || null;
    };
    hpw.value = formState.sport.preferences?.hours_per_week ?? '';
    hpw.oninput = save;
    hpw.onchange = save;
  }

  renderMainSportChips();
  onLevelOrPlanChanged();
  if (typeof attachLiveErrorClearing === 'function') attachLiveErrorClearing($('#step-container'));
}

// Cleanup sport state before moving to the next step
export function cleanupSportStateBeforeNext() {
  if (!formState.sport) return;
  const lvl = formState.sport.level;

  if (lvl === 'none') {
    // User does not do sports - keep only the chip selection
    formState.sport = {
      level: 'none',
      futureMulti: formState.sport.futureMulti || [],
      // future: formState.sport.future || null
    };
  }
  else if (lvl === 'sport') {
    // User does sports - always keep only the own plan
    formState.sport = {
      level: 'sport',
      plan_choice: 'own',
      ownBlocks: formState.sport.ownBlocks || [],
      pickedOwn: formState.sport.pickedOwn || [],
      mainSportOwn: formState.sport.mainSportOwn || null,
      preferences: formState.sport.preferences || {}
    };
  } else {
    formState.sport = { level: lvl || null };
  }
}



/* ============================================================
   STEP 4 - DIET & DISLIKES (with autoPremium logic)
   ============================================================ */

// --- Helper: check whether the user enabled premium options ---
function checkIfPremiumNeeded() {
  const diet = formState?.nutrition?.diet;
  const dislikes = formState?.nutrition?.dislikes || [];
  const customized = !!formState?.nutrition?._customized;

  const needsPremium =
    (diet && diet !== 'none') ||
    (Array.isArray(dislikes) && dislikes.length > 0) ||
    customized;

  formState.plan ||= {};
  formState.plan.autoPremium = needsPremium;
  return needsPremium;
}

// --- Reset values when switching back to the standard plan ---
function resetToStandardDefaults() {
  formState.nutrition ||= {};
  formState.nutrition.diet = 'none';
  formState.nutrition.dislikes = [];
  formState.nutrition.other_dislike = ''; // Can stay; it is simply no longer filled

  // Restore macros from catalog or default values
  const fromCatalog = (() => {
    const id = formState.sport?.mainSportId;
    const rec = window._sportCatalog?.[id];
    return rec?.macros ? { ...rec.macros } : null;
  })();
  const defaults = { c: 55, f: 25, p: 20 };
  formState.nutrition.macros = fromCatalog || defaults;
  formState.nutrition._customized = false;

  if (typeof renderMacroCharts === 'function') {
    renderMacroCharts(formState.nutrition.macros);
  }
}

/* ===== Main step function ===== */
export function bindDietStep() {
  formState.nutrition ||= {};
  if (!formState.nutrition.diet) formState.nutrition.diet = 'none';
  if (!formState.nutrition.dislikes) formState.nutrition.dislikes = [];

  const bindChipGroup = (groupId, target, key) => {
    const chips = document.querySelectorAll(`#${groupId} .chip`);
    chips.forEach(ch => {
      if (target[key] === ch.dataset.value) ch.classList.add('selected');
      ch.onclick = () => {
        chips.forEach(x => x.classList.remove('selected'));
        ch.classList.add('selected');
        target[key] = ch.dataset.value;
        updatePremiumNote();
        checkIfPremiumNeeded(); // After each diet/repeats change
      };
    });
  };

  // Dieta
  bindChipGroup('diet_group', formState.nutrition, 'diet');

  // Repeat (meal repetitions)
  bindChipGroup('repeat_group', formState.nutrition, 'repeats');

  // Repeat hints
  const updateRepeatHints = (val) => {
    const hints = document.querySelectorAll('.repeat-hints .repeat-hint');
    hints.forEach(h => h.classList.toggle('active', h.dataset.value === String(val)));
  };
  updateRepeatHints(formState.nutrition.repeats);

  document.querySelectorAll('#repeat_group .chip').forEach(ch => {
    ch.addEventListener('click', () => {
      formState.nutrition.repeats = ch.dataset.value;
      updateRepeatHints(ch.dataset.value);
    });
  });

  // Dislikes (WITHOUT 'Other')
  const MAX_DISLIKES = 4;
  const selected = new Set((formState.nutrition.dislikes || []).slice(0, MAX_DISLIKES));
  formState.nutrition.dislikes = Array.from(selected);
  const wrap = $('#dislikes');
  const dislikesErrEl = document.getElementById('err-dislikes');

  const clearDislikesError = () => {
    if (dislikesErrEl) dislikesErrEl.textContent = '';
  };

  const showDislikesMaxError = () => {
    if (dislikesErrEl) {
      dislikesErrEl.textContent = t('step5.error_dislikes_max4') || 'You can select up to 4 items.';
    }
  };

  wrap?.querySelectorAll('.chip').forEach(btn => {
    const id = btn.dataset.id;
    if (selected.has(id)) btn.classList.add('selected');

    btn.onclick = () => {
      if (selected.has(id)) {
        selected.delete(id);
        btn.classList.remove('selected');
        clearDislikesError();
      } else {
        if (selected.size >= MAX_DISLIKES) {
          showDislikesMaxError();
          return;
        }
        selected.add(id);
        btn.classList.add('selected');
        clearDislikesError();
      }

      formState.nutrition.dislikes = Array.from(selected);

      // No special handling for 'other', just a clean enum list
      updatePremiumNote();
      checkIfPremiumNeeded(); // After dislikes change
    };
  });

  // No #other_dislike input and no other_dislike text

  // --- Premium note ---
  function updatePremiumNote() {
    let note = document.getElementById('premium_note');
    const dislikes = formState.nutrition.dislikes || [];
    const diet = formState.nutrition.diet || 'none';
    const needsPremium = (diet !== 'none') || dislikes.length > 0;

    if (needsPremium) {
      if (!note) {
        note = document.createElement('div');
        note.id = 'premium_note';
        note.className = 'premium-note';
        note.textContent = t('step4.premium_note') || 'This option is available only in the Premium plan.';
        const dislikesBlock = document.getElementById('dislikes_block');
        dislikesBlock?.insertAdjacentElement('afterend', note);
      }
    } else {
      note?.remove();
    }
  }

  updatePremiumNote();
  checkIfPremiumNeeded(); // Check immediately after load
}

export function bindMenuSettingsStep() {
  formState.nutrition ||= {};
  if (!formState.nutrition.repeats) formState.nutrition.repeats = 'none';
  if (formState.nutrition.show_grams == null) formState.nutrition.show_grams = null;

  const bindChipGroup = (groupId, target, key, cb) => {
    const chips = document.querySelectorAll(`#${groupId} .chip`);
    chips.forEach(ch => {
      if (target[key] === ch.dataset.value) ch.classList.add('selected');
      ch.onclick = () => {
        chips.forEach(x => x.classList.remove('selected'));
        ch.classList.add('selected');
        target[key] = ch.dataset.value;
        cb && cb(ch.dataset.value);
      };
    });
  };

  const updateRepeatHints = (val) => {
    const hints = document.querySelectorAll('.repeat-hints .repeat-hint');
    hints.forEach(h => h.classList.toggle('active', h.dataset.value === String(val)));
  };

  const updateGramsHints = (val) => {
    const hints = document.querySelectorAll('.grams-hints .grams-hint');
    hints.forEach(h => h.classList.toggle('active', h.dataset.value === String(val)));
  };

  bindChipGroup('repeat_group', formState.nutrition, 'repeats', updateRepeatHints);
  updateRepeatHints(formState.nutrition.repeats);

  bindChipGroup('grams_group', formState.nutrition, 'show_grams', updateGramsHints);
  updateGramsHints(formState.nutrition.show_grams);
}


/* ============================================================
   STEP 5 - MACROS + BALANCE (autoPremium + reset detection)
   ============================================================ */

// --- Helper: check whether macros match default values ---
function checkMacrosCustomized() {
  const defaults = (() => {
    const id = formState.sport?.mainSportId;
    const rec = window._sportCatalog?.[id];
    return rec?.macros ? { ...rec.macros } : { c: 55, f: 25, p: 20 };
  })();

  const user = formState.nutrition?.macros || {};
  const same =
    +user.c === +defaults.c &&
    +user.f === +defaults.f &&
    +user.p === +defaults.p;

  formState.nutrition._customized = !same;
  checkIfPremiumNeeded(); // Checks whether Premium should be required
}

export function bindBalanceStep() {
  formState.nutrition ||= {};

  /* ---------- Makra ---------- */
  const defaultMacros = { c: 55, f: 25, p: 20 };
  const fromCatalog = () => {
    const id = formState.sport?.mainSportId;
    const rec = window._sportCatalog?.[id];
    return rec?.macros ? { ...rec.macros } : null;
  };

  // If the user never edited them, set defaults / catalog values
  if (!formState.nutrition._customized) {
    formState.nutrition.macros = fromCatalog() || defaultMacros;
  }

  const cEl = $('#macro_c'),
    fEl = $('#macro_f'),
    pEl = $('#macro_p'),
    sumEl = $('#macro_sum');

  const syncUI = () => {
    const c = +formState.nutrition.macros?.c || 0;
    const f = +formState.nutrition.macros?.f || 0;
    const p = +formState.nutrition.macros?.p || 0;

    if (document.activeElement !== cEl && cEl) cEl.value = c || '';
    if (document.activeElement !== fEl && fEl) fEl.value = f || '';
    if (document.activeElement !== pEl && pEl) pEl.value = p || '';

    const sum = Math.round(c + f + p);
    if (sumEl) {
      sumEl.value = sum;
      sumEl.readOnly = true;
      sumEl.setAttribute('aria-readonly', 'true');
      sumEl.tabIndex = -1;
    }

    renderMacroCharts({ c, f, p });
  };

  const onMacroChange = (key, el) => {
    formState.nutrition.macros[key] = +el.value || 0;
    checkMacrosCustomized(); // Check whether macros differ from defaults
    syncUI();
  };

  cEl?.addEventListener('input', () => onMacroChange('c', cEl));
  fEl?.addEventListener('input', () => onMacroChange('f', fEl));
  pEl?.addEventListener('input', () => onMacroChange('p', pEl));

  syncUI();
  checkMacrosCustomized(); // Check immediately after load
}


/* ============================================================
   STEP 6 - PLAN SELECTION (autoPremium + reset logic)
   ============================================================ */

// Detect currency by language
function currentCurrency() {
  const lang = (i18n?.lang || 'cs').toLowerCase();
  return lang === 'cs' ? 'CZK' : 'EUR';
}

// Price formatting
function formatPrice(czk, eur) {
  const currency = currentCurrency();
  return currency === 'EUR'
    ? `€${eur.toFixed(2)}`
    : `${czk} Kč`;
}
function populatePlanPriceData() {
  const pricing = window?.PRICING;
  if (!pricing) return;

  ['standard', 'premium'].forEach(variant => {
    const cfg = pricing[variant];
    if (!cfg) return;

    const card = document.querySelector(`.plan-card--select[data-variant="${variant}"]`);
    if (!card) return;

    ['week', 'month'].forEach(period => {
      const target = card.querySelector(`.price--${period}`);
      const val = cfg[period];
      if (target && val) {
        target.dataset.czk = val.czk;
        target.dataset.eur = val.eur;
      }
    });
  });
}

// Apply prices to cards from data attributes
function updatePlanPrices() {
  const prices = document.querySelectorAll('.plan-card--select .price');
  prices.forEach(priceEl => {
    const czk = parseFloat(priceEl.dataset.czk);
    const eur = parseFloat(priceEl.dataset.eur);

    const tag = priceEl.querySelector('.tag');
    const text = formatPrice(czk, eur);
    if (tag) {
      priceEl.firstChild.nodeValue = text + " ";
    } else {
      priceEl.textContent = text;
    }
  });
}

// Plan and period selection
export function bindPlanStep() {
  populatePlanPriceData();
  const planCards = document.querySelectorAll('.plan-card--select');
  const planButtons = document.querySelectorAll('.plan-buttons .chip');
  const periodButtons = document.querySelectorAll('.plan-period .chip');
  const periodHelp = document.getElementById('periodHelp');

  // Text dictionary by period
  const periodMap = {
    week: t('step7.help_week') || 'We will create one nutrition plan for you.',
    month: t('step7.help_month') || 'We will create 4 nutrition plans for you.'
  };

  // Initial state
  window.formState ||= {};
  formState.plan ||= {};
  if (!formState.plan.variant) formState.plan.variant = 'standard';
  if (!formState.plan.period) formState.plan.period = 'week';

  // If user has premium behavior (e.g. diet, dislikes, macros)
  if (formState.plan.autoPremium) {
    formState.plan.variant = 'premium';
  }

  const initialPriceNode = document.querySelector(
    `.plan-card--select[data-variant="${formState.plan.variant}"] .price--${formState.plan.period}`
  );
  if (!initialPriceNode) {
    formState.plan.period = 'week';
  }

  // Card click
  planCards.forEach(card => {
    card.addEventListener('click', () => {
      formState.plan.variant = card.dataset.variant;

      // Do not reset immediately; just set variant and refresh UI
      updateSelections();
    });
  });


  // Variant button click
  planButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      formState.plan.variant = btn.dataset.variant;
      if (formState.plan.variant === 'standard' && formState.plan.autoPremium) {
        resetToStandardDefaults();
        formState.plan.autoPremium = false;
      }
      updateSelections();
    });
  });

  // Period click
  periodButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      formState.plan.period = btn.dataset.value;
      updateSelections();
    });
  });

  // Aktualizace UI podle stavu
  function updateSelections() {
    planCards.forEach(c =>
      c.classList.toggle('selected', c.dataset.variant === formState.plan.variant)
    );
    planButtons.forEach(b =>
      b.classList.toggle('selected', b.dataset.variant === formState.plan.variant)
    );
    periodButtons.forEach(b =>
      b.classList.toggle('selected', b.dataset.value === formState.plan.period)
    );

    // Help text based on selected period
    if (periodHelp) {
      periodHelp.textContent = periodMap[formState.plan.period] || '';
    }

    // Update total price
    const priceEl = document.querySelector(
      `.plan-card--select[data-variant="${formState.plan.variant}"] .price--${formState.plan.period}`
    );
    const totalEl = document.getElementById('planTotalPrice');
    if (priceEl) {
      const czk = parseFloat(priceEl.dataset.czk);
      const eur = parseFloat(priceEl.dataset.eur);
      const formatted = formatPrice(czk, eur);
      if (totalEl) totalEl.textContent = formatted;

      const currency = currentCurrency() === 'EUR' ? 'EUR' : 'CZK';
      formState.plan.price = {
        czk,
        eur,
        formatted,
        final: currency === 'EUR' ? eur : czk,
        currency
      };
    }
  }

  updateSelections();
  updatePlanPrices();
}

/* ============================================================
   STEP 8 - REVIEW & PURCHASE (with pre-entry validation)
   ============================================================ */

// === Helper functions for checks ===
function hasPremiumFeatures() {
  const diet = formState?.nutrition?.diet;
  const dislikes = formState?.nutrition?.dislikes || [];
  const customized = !!formState?.nutrition?._customized;
  return (
    (diet && diet !== 'none') ||
    (Array.isArray(dislikes) && dislikes.length > 0) ||
    customized
  );
}

// --- Confirmation modal when continuing with Standard plan ---
function showConfirmPremiumLoss() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-modal">
        <h3>${t('step7.standard_warning_title') || 'Changes will not apply in the Standard plan'}</h3>
        <p>${t('step7.standard_warning_text') ||
      'In the Standard plan, your custom diet, meal selections, and macronutrient changes will not be saved. Do you want to continue anyway?'}</p>
        <div class="confirm-actions">
          <button type="button" class="btn-secondary" id="confirmCancel">${t('common.back') || 'Back'}</button>
          <button type="button" class="btn-primary" id="confirmOk">${t('common.continue') || 'Continue'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const clean = () => overlay.remove();
    overlay.querySelector('#confirmCancel').onclick = () => { clean(); resolve(false); };
    overlay.querySelector('#confirmOk').onclick = () => { clean(); resolve(true); };
  });
}

// --- Function called before moving to Step 7 ---
export async function beforeGoToStep7() {
  // Wait until step 6 validation completes (e.g. 100ms)
  await new Promise(r => setTimeout(r, 150));

  const plan = formState?.plan?.variant;
  const hasPremium = hasPremiumFeatures();

  if (plan === 'standard' && hasPremium) {
    const proceed = await showConfirmPremiumLoss();
    if (!proceed) return false;
    resetToStandardDefaults();
  }
  return true;
}

function buildReviewSummary() {
  const { profile, goal, sport, nutrition, plan } = formState;
  const lang = i18n?.lang || 'cs';

  const repeatsMap = {
    1: t('step8.repeats_1'),
    2: t('step8.repeats_2'),
    3: t('step8.repeats_3')
  };
  const gramsMap = {
    yes: t('step6.grams_yes'),
    no: t('step6.grams_no')
  };

  const variantKey = plan?.variant ? `step7.${plan.variant}_title` : null;
  const periodKey = plan?.period ? `step7.period_${plan.period}` : null;

  // --- energie + BMR ---
  const targetTxt = t('step2.target_' + goal?.target) || '—';
  const bmrKcal = goal?.bmr_override ?? goal?.bmr_kcal;
  let bmrVal = null;
  if (bmrKcal) {
    const unit = activeUnit();
    const val = toActiveUnitFromKcal(bmrKcal);
    const locale = i18n?.lang || 'cs';
    bmrVal = `${val.toLocaleString(locale)} ${unit}`;
  }
  const goalFull = bmrVal ? `${targetTxt} · BMR: ${bmrVal}` : targetTxt;

  // --- sportovní část ---
  let sportsSummary = '—';

  if (!sport || !sport.level) {
    sportsSummary = '—';
  }

  else if (sport.level === 'none') {
    sportsSummary = `${t('step8.want_sport') || 'I am not doing sports yet'}`;

    if (sport.futureMulti?.length) {
      const futureSports = sport.futureMulti
        .map(id => t('step3.suggest_' + id) || id)
        .join(', ');

      sportsSummary += `<br>${t('step8.future_sport') || 'I am interested in'}: ${futureSports}`;
    }
  }

  else {
    // User does sports - always own plan (ownBlocks)
    // Older values like 'recreational' are still supported as fallback.
    sportsSummary = '';

    if (sport.ownBlocks?.length) {
      sportsSummary = sport.ownBlocks.map(b => {
        const lbl = window._sportCatalog?.[b.sportId]?.labels?.[lang] || b.sportId;
        const intensityLabel = t('step3.intensity_' + b.intensity) || b.intensity;
        const intensityWord = t('step3.intensity') || 'Intensity';

        return `${lbl}: ${b.sessions}×/týden, ${b.minutes} min, ${intensityLabel} ${intensityWord.toLowerCase()}`;
      }).join('<br>');
    }

    // Main sport (if available)
    const mainId = sport.mainSportOwn || sport.mainSportId;
    if (mainId) {
      const mainLbl = window._sportCatalog?.[mainId]?.labels?.[lang] || mainId;
      sportsSummary += `<br>${t('step8.main_sport') || t('step3.main_sport') || 'Main sport'}: ${mainLbl}`;
    }
  }

  return {
    plan: `${variantKey ? t(variantKey) : '—'}`,
    // původně tu bylo: plan: `${variantKey ? t(variantKey) : '—'} · ${periodKey ? t(periodKey) : '—'}`,

    basic: `${t('step1.sex_' + profile.sex) || '?'} · ${profile.age || '?'} ${t('common.years') || 'years'} · ${profile.height_cm || '?'} cm · ${profile.weight_kg || '?'} kg`,
    activity: `${t('step1.activity_' + profile.activity) || '—'} · ${t('step1.steps')}: ${t('step1.steps_' + profile.steps_bucket) || '—'}`,

    goal: goalFull,
    sports: sportsSummary,
    diet: t('step5.diet_' + nutrition?.diet) || '—',

    dislikes: (() => {
      const base = (nutrition.dislikes || [])
        .map(d => t('step5.dislike_' + d) || d);

      return base.join(', ') || '—';
    })(),


    repeats: repeatsMap[nutrition?.repeats] || '—',
    show_grams: gramsMap[nutrition?.show_grams] || '—',
    macros: (() => {
      const c = nutrition?.macros?.c ?? '—';
      const f = nutrition?.macros?.f ?? '—';
      const p = nutrition?.macros?.p ?? '—';

      const carbLabel = t('step8.macros_carbs') || 'Carbs';
      const fatLabel = t('step8.macros_fats') || 'Fats';
      const proteinLabel = t('step8.macros_proteins') || 'Protein';

      // Using innerHTML in the review step is generally safe since we control the content and it allows us to format macros in a more readable way. Just ensure that the values (c, f, p) are sanitized or come from a trusted source to avoid any potential XSS issues.
      return `
        ${carbLabel} ${c}%<br>
        ${fatLabel} ${f}%<br>
        ${proteinLabel} ${p}%
      `;
    })(),
  };
}


export function bindReviewStep() {
  const summary = buildReviewSummary();

  const map = {
    rev_plan: summary.plan,
    rev_basic: summary.basic,
    rev_activity: summary.activity,
    rev_goal: summary.goal,
    rev_sports: summary.sports,
    rev_diet: summary.diet,
    rev_dislikes: summary.dislikes,
    rev_repeats: summary.repeats,
    rev_show_grams: summary.show_grams,
    rev_macros: summary.macros
  };

  for (const [id, text] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (id === 'rev_sports' || id === 'rev_macros') {
      el.innerHTML = text;   // Allows <br> and other HTML
    } else {
      el.textContent = text;
    }
  }


  // Price based on selected plan + period
  const priceBox = document.getElementById('reviewPrice');
  if (priceBox) {
    if (formState.plan?.price) {
      const { czk, eur } = formState.plan.price;
      const isEur = (currentCurrency() === 'EUR');
      const originalPrice = isEur ? eur : czk;
      priceBox.textContent = isEur ? `€${originalPrice.toFixed(2)}` : `${originalPrice} Kč`;
      priceBox.dataset.original = originalPrice;
    } else {
      priceBox.textContent = '—';
    }
  }

  // customer + consents
  const nameEl = document.getElementById('cust_name');
  const mailEl = document.getElementById('cust_email');
  const newsEl = document.getElementById('newsletter_optin');
  const tEl = document.getElementById('consent_terms');
  const pEl = document.getElementById('consent_privacy');

  formState.customer ||= {};
  formState.consents ||= {};

  nameEl.value = formState.customer.name || '';
  mailEl.value = formState.customer.email || '';
  newsEl.checked = !!formState.customer.newsletter;
  tEl.checked = !!formState.consents.terms;
  pEl.checked = !!formState.consents.privacy;

  nameEl.addEventListener('input', () => formState.customer.name = (nameEl.value || '').trim());
  mailEl.addEventListener('input', () => formState.customer.email = (mailEl.value || '').trim());
  newsEl.addEventListener('change', () => formState.customer.newsletter = !!newsEl.checked);
  tEl.addEventListener('change', () => formState.consents.terms = !!tEl.checked);
  pEl.addEventListener('change', () => formState.consents.privacy = !!pEl.checked);

  const btn = document.getElementById("btn-purchase");

  if (btn) {
    btn.addEventListener("click", async () => {
      const originalHTML = btn.innerHTML;
      btn.disabled = true;

      // Spinner + translation
      const sendingText = t("buttons.sending") || "Sending...";
      btn.innerHTML = `<span class="spinner"></span>${sendingText}`;

      try {

        await handlePurchase(); // Your function that handles the purchase
      } catch (err) {
        console.error("❌ Purchase error:", err);
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }
    });
  }


  // --- Discount code ---
  const discountBtn = document.getElementById("apply-discount");
  if (discountBtn) {
    discountBtn.addEventListener("click", function () {
      const input = document.getElementById("discount_code");
      const code = input.value.trim().toUpperCase();
      const priceEl = document.getElementById("reviewPrice");
      const infoEl = document.getElementById("discount-info");
      const errorEl = document.getElementById("err-discount");

      const validCodes = {
        "FIT10": 10,
        "VIP20": 20
      };

      if (validCodes[code]) {
        const discount = validCodes[code];
        const originalPrice = parseFloat(priceEl.dataset.original);
        const isEur = (currentCurrency() === "EUR");
        const newPrice = (originalPrice * (1 - discount / 100)).toFixed(2);

        // Save to state
        formState.plan.discount_code = code;
        formState.plan.discount_percent = discount;
        formState.plan.price.final = parseFloat(newPrice);
        formState.plan.price.currency = currentCurrency() === "EUR" ? "EUR" : "CZK";


        // 💬 update UI
        priceEl.textContent = isEur ? `€${newPrice}` : `${newPrice} Kč`;
        infoEl.textContent = `${t("step8.discount_applied") || "Discount code"}: ${code} (−${discount}%)`;
        errorEl.textContent = "";
      } else {
        // Invalid code
        delete formState.plan.discount_code;
        delete formState.plan.discount_percent;
        delete formState.plan.price.final;

        errorEl.textContent = t("step7.discount_invalid") || "Invalid discount code.";
        infoEl.textContent = "";
      }
    });
  }

}

/* ============== PURCHASE HANDLING ============== */
export async function handlePurchase() {
  const errs = validateReview(formState, t);
  showErrors(errs);
  if (Object.keys(errs).length > 0) return;

  const langParam = i18n?.lang || "cs";
  const thanksUrl = `/thanks.html?lang=${encodeURIComponent(langParam)}`;
  const failUrl = `/fail.html?resume=true&lang=${encodeURIComponent(langParam)}`;
  const draftForResume = {
    ...formState,
    locale: langParam
  };

  const SKIP_PAYMENT = true;

  try {
    localStorage.setItem("formState", JSON.stringify(draftForResume));
    localStorage.setItem("formStep", "7");
  } catch (e) {
    console.warn("Draft save before purchase failed:", e);
  }

  try {
    const v = formState.plan?.variant;
    const p = formState.plan?.period;

    let amountCZK = null;
    const priceEl = document.querySelector(`.plan-card--select[data-variant="${v}"] .price--${p}`);
    if (priceEl) {
      amountCZK = parseFloat(priceEl.dataset.czk);
    } else if (formState?.plan?.price?.czk) {
      amountCZK = parseFloat(formState.plan.price.czk);
      console.warn("⚠️ Price element not found in DOM, using stored formState.plan.price");
    } else {
      throw new Error("Price not found");
    }

    const amountInHalers = Math.round(amountCZK * 100);

    /* ----------------------------------------------------
   BMR NORMALIZATION - keep only one bmr_kcal key
   ---------------------------------------------------- */
    if (formState.goal) {
      const finalBmr =
        formState.goal.bmr_override ??
        formState.goal.bmr_kcal ??
        formState.goal.bmrKcal ?? // fallback in case the old field still exists somewhere
        null;

      formState.goal.bmr_kcal = finalBmr;

      // Clean up old keys
      delete formState.goal.bmr_override;
      delete formState.goal.bmrKcal;
    }

    // --- Create a clean copy for saving ---
    const cleanState = structuredClone(formState);
    if (cleanState.balance) delete cleanState.balance;

    const resp = await fetch(apiUrl("/orders/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cleanState.customer?.name,
        email: cleanState.customer?.email,
        locale: langParam,
        plan_variant: v,
        plan_period: p,

        // New field for DB column energy_unit
        energy_unit: cleanState.goal?.energy_unit || null,

        // New field for DB column bmr_kcal
        bmr_kcal: cleanState.goal?.bmr_kcal ?? null,

        // If you already have more columns in the model, you can send them too:
        sex: cleanState.profile?.sex || null,
        age: cleanState.profile?.age ?? null,
        height_cm: cleanState.profile?.height_cm ?? null,
        weight_kg: cleanState.profile?.weight_kg ?? null,
        activity: cleanState.profile?.activity || null,

        // The rest of the state stays in params
        params: cleanState,
      }),
    });

    if (!resp.ok) {
      let errBody = {};
      try { errBody = await resp.json(); } catch (_) { }
      const detail = errBody?.detail || resp.statusText || "Unknown error";
      throw new Error(`Order API error ${resp.status}: ${detail}`);
    }

    const orderRes = await resp.json().catch(() => ({}));
    if (!orderRes?.order_id) throw new Error("Order creation failed");

    // --- save to localStorage
    const formStateWithId = {
      ...formState,
      order_id: orderRes.order_id,
      locale: langParam
    };
    localStorage.setItem("formState", JSON.stringify(formStateWithId));

    if (SKIP_PAYMENT) {
      window.location.href = thanksUrl;
      return;
    }

    const payRes = await fetch(apiUrl("/payments/create"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: orderRes.order_id,
        amount: amountInHalers,
        currency: "CZK",
        return_url: new URL(thanksUrl, location.origin).toString(),
      }),
    }).then((r) => r.json());

    if (!payRes?.redirect_url) throw new Error("Payment creation failed");
    window.location.href = payRes.redirect_url;

  } catch (err) {
    console.error("Error creating order:", err?.message || err);
    try {
      localStorage.setItem("formState", JSON.stringify(draftForResume));
      localStorage.setItem("formStep", "7");
    } catch (e) {
      console.warn("Draft save after purchase error failed:", e);
    }
    window.location.href = failUrl;
  }
}




