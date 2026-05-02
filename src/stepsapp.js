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

  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return '';
  if (
    host.endsWith('fitlime.cz') ||
    host.endsWith('fitlime.eu') ||
    host.endsWith('fitlime.sk')
  ) {
    return 'https://api.fitlime.cz';
  }
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
const TRAINING_ENERGY_MIN_KCAL = 50;
const TRAINING_ENERGY_MAX_KCAL = 2000;

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

    helpEl.textContent = `${base} ${rangeWord}: ${minStr}-${maxStr} ${unit}/${perDay}.`;
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
const TRAINING_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TRAINING_SLOTS = ['morning', 'afternoon', 'evening'];

function dayLabel(day) {
  return t(`step3.days.${day}`) || day;
}

function slotLabel(slot) {
  return t(`step3.slots.${slot}`) || slot;
}
function updateAddOwnBlockControls() {
  const btn = document.getElementById('add_own_block');
  const hint = document.getElementById('add_own_block_limit_hint');

  if (!btn) return;

  const count = (formState.sport?.ownBlocks || []).length;
  const limitReached = count >= OWN_BLOCKS_LIMIT;
  const detailActive = Boolean(formState.sport?.training_detail?.enabled);

  btn.disabled = limitReached || detailActive || formState.sport?.level !== 'sport';
  btn.classList.toggle('limit-reached', limitReached);
  if (detailActive) {
    btn.textContent = t?.('step3.detail_summary_locked') || 'Controlled by detailed week';
    if (hint) hint.textContent = t?.('step3.detail_summary_locked_hint') || 'Return to simple entry to edit these fields directly.';
  } else if (limitReached) {
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
  formState.sport.training_detail ||= { enabled: false, expanded: false, source: null, rows: [] };
  formState.sport.training_detail.rows ||= [];
  formState.sport.strava_import ??= null;

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
    formState.sport.ownBlocks.push(emptyOwnBlock());
  }
  formState.sport.ownBlocks.forEach(b => {
    if (!b.sportId) b.sportId = '';
    if (!b.sessions) b.sessions = 3;
    if (!b.minutes) b.minutes = 45;
    if (!b.intensity) b.intensity = 'medium';
    if (!b.energy_source) b.energy_source = 'estimated';
    if (b.energy_source !== 'manual' && b.energy_kj_per_session === undefined) {
      b.energy_kj_per_session = null;
    }
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

async function loadMetValues() {
  if (window._sportMetValues) return window._sportMetValues;
  const res = await fetch('/sports/met_values.json');
  if (!res.ok) { console.warn('MET values fetch failed', res.status); return {}; }
  const data = await res.json();
  window._sportMetValues = data;
  return data;
}

function sportLabel(rec, lang) {
  return rec?.labels?.[lang] || rec?.labels?.en || rec?.id || '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

function groupCatalogByGroup(catalog) {
  const groups = {};
  for (const [id, rec] of Object.entries(catalog || {})) {
    const g = rec.group || 'other';
    (groups[g] ||= []).push({ id, ...rec });
  }
  return groups;
}

function sportGroupMeta() {
  return {
    labels: {
      endurance: t('step3.groups.title_endurance') || 'Endurance sports',
      individual: t('step3.groups.title_individual') || 'Individual sports',
      team: t('step3.groups.title_team') || 'Team sports',
      fitness: t('step3.groups.title_fitness') || 'Fitness & gym',
      water: t('step3.groups.title_water') || 'Water sports',
      winter: t('step3.groups.title_winter') || 'Winter sports',
      combat: t('step3.groups.title_combat') || 'Combat sports',
      other: t('step3.groups.title_other') || 'Other sports'
    },
    order: ['endurance', 'individual', 'team', 'fitness', 'water', 'winter', 'combat', 'other']
  };
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
  const { labels, order } = sportGroupMeta();

  // This option is shown as a placeholder, but not in the dropdown list
  let html = `<option value="" disabled ${!selectedId ? 'selected' : ''} hidden>
                ${t('step3.select_sport_placeholder') || 'Select a sport'}
              </option>`;

  for (const g of order) {
    const list = byGroup[g]; if (!list || !list.length) continue;
    html += `<optgroup label="${escapeHtml(labels[g])}">`;
    list.slice()
      .filter(rec => rec.id !== 'triathlon')
      .sort((a, b) => sportLabel(a, lang).localeCompare(sportLabel(b, lang)))
      .forEach(rec => {
        const lbl = sportLabel(rec, lang);
        html += `<option value="${escapeHtml(rec.id)}" ${rec.id === selectedId ? 'selected' : ''}>${escapeHtml(lbl)}</option>`;
      });
    html += `</optgroup>`;
  }
  return html;
}

function buildDetailSportsSelectOptions(byGroup, lang, selectedId) {
  const { labels, order } = sportGroupMeta();
  let html = `<option value="" ${!selectedId ? 'selected' : ''}>${escapeHtml(t('step3.detail_no_activity') || 'No activity')}</option>`;

  for (const g of order) {
    const list = byGroup[g]; if (!list || !list.length) continue;
    html += `<optgroup label="${escapeHtml(labels[g])}">`;
    list.slice()
      .filter(rec => rec.id !== 'triathlon')
      .sort((a, b) => sportLabel(a, lang).localeCompare(sportLabel(b, lang)))
      .forEach(rec => {
        const lbl = sportLabel(rec, lang);
        html += `<option value="${escapeHtml(rec.id)}" ${rec.id === selectedId ? 'selected' : ''}>${escapeHtml(lbl)}</option>`;
      });
    html += `</optgroup>`;
  }
  return html;
}

function buildSportsPickerHtml(byGroup, lang, selectedId, idx) {
  const { labels, order } = sportGroupMeta();
  const selectedRec = selectedId ? window._sportCatalog?.[selectedId] : null;
  const selectedLabel = selectedRec ? sportLabel(selectedRec, lang) : '';
  const placeholder = t('step3.select_sport_placeholder') || 'Select a sport';
  const searchPlaceholder = t('step3.search_sport_placeholder') || 'Search sport';
  const panelId = `sport_picker_panel_${idx}`;

  let groupsHtml = '';
  for (const g of order) {
    const list = byGroup[g];
    if (!list || !list.length) continue;

    const options = list.slice()
      .filter(rec => rec.id !== 'triathlon')
      .sort((a, b) => sportLabel(a, lang).localeCompare(sportLabel(b, lang)))
      .map(rec => {
        const label = sportLabel(rec, lang);
        return `
          <button type="button"
                  class="sport-picker-option${rec.id === selectedId ? ' selected' : ''}"
                  data-idx="${idx}"
                  data-sport-id="${escapeHtml(rec.id)}"
                  data-search="${escapeHtml(label.toLowerCase())}">
            ${escapeHtml(label)}
          </button>
        `;
      })
      .join('');

    groupsHtml += `
      <section class="sport-picker-group" data-group="${escapeHtml(g)}">
        <h4>${escapeHtml(labels[g])}</h4>
        <div class="sport-picker-options">${options}</div>
      </section>
    `;
  }

  return `
    <div class="sport-picker">
      <button type="button"
              class="sport-picker-toggle${selectedId ? ' has-value' : ''}"
              data-idx="${idx}"
              aria-expanded="false"
              aria-controls="${panelId}">
        <span>${escapeHtml(selectedLabel || placeholder)}</span>
      </button>
      <div id="${panelId}" class="sport-picker-panel" data-idx="${idx}" hidden>
        <input type="search"
               class="sport-picker-search"
               data-idx="${idx}"
               placeholder="${escapeHtml(searchPlaceholder)}"
               autocomplete="off" />
        <div class="sport-picker-groups">
          ${groupsHtml}
        </div>
      </div>
    </div>
  `;
}


function emptyOwnBlock() {
  return {
    sportId: '',
    sessions: 3,
    minutes: 45,
    intensity: 'medium',
    energy_kj_per_session: null,
    energy_source: 'estimated'
  };
}

function finiteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function estimateEnergyKjPerSession(block) {
  const metValues = window._sportMetValues || {};
  const sportId = block?.sportId;
  const intensity = block?.intensity || 'medium';
  const minutes = finiteNumber(block?.minutes);
  const weightKg = finiteNumber(formState.profile?.weight_kg);
  const met = finiteNumber(metValues?.[sportId]?.[intensity]);

  if (!sportId || !met || !minutes || !weightKg || minutes <= 0 || weightKg <= 0) {
    return null;
  }

  const kcal = met * weightKg * (minutes / 60);
  const clampedKcal = Math.min(TRAINING_ENERGY_MAX_KCAL, Math.max(TRAINING_ENERGY_MIN_KCAL, kcal));
  return clampedKcal * KCAL_TO_KJ;
}

function refreshEstimatedEnergy(block, { force = false } = {}) {
  if (!block || (block.energy_source === 'manual' && !force)) return block?.energy_kj_per_session ?? null;

  const estimate = estimateEnergyKjPerSession(block);
  block.energy_source = 'estimated';
  block.energy_kj_per_session = estimate == null ? null : Math.round(estimate);
  return block.energy_kj_per_session;
}

function energyDisplayValue(block) {
  const kj = block?.energy_source === 'manual'
    ? finiteNumber(block.energy_kj_per_session)
    : refreshEstimatedEnergy(block);

  if (kj == null || kj <= 0) return '';
  return String(toActiveUnitFromKJ(kj));
}

function energyInputPlaceholder(block) {
  if (!block?.sportId) return t('step3.energy_waiting_for_sport') || 'Select sport';
  return '----';
}

function activeUnitToKj(value) {
  const num = finiteNumber(value);
  if (num == null || num <= 0) return null;
  return activeUnit() === 'kcal' ? toKJ(num) : num;
}

function energyInputLimits() {
  const unit = activeUnit();
  if (unit === 'kcal') {
    return {
      min: TRAINING_ENERGY_MIN_KCAL,
      max: TRAINING_ENERGY_MAX_KCAL
    };
  }
  return {
    min: roundKJ(toKJ(TRAINING_ENERGY_MIN_KCAL)),
    max: roundKJ(toKJ(TRAINING_ENERGY_MAX_KCAL))
  };
}

function updateOwnEnergyInput(idx, { force = false } = {}) {
  const block = formState.sport?.ownBlocks?.[idx];
  if (!block) return;

  if (force || block.energy_source !== 'manual') {
    refreshEstimatedEnergy(block, { force });
  }

  const input = document.getElementById(`own_energy_${idx}`);
  const unit = document.getElementById(`own_energy_unit_${idx}`);
  if (input) {
    const limits = energyInputLimits();
    input.value = energyDisplayValue(block);
    input.placeholder = energyInputPlaceholder(block);
    input.min = String(limits.min);
    input.max = String(limits.max);
  }
  if (unit) unit.textContent = activeUnit();
}

function recomputePickedOwnFromBlocks() {
  const set = new Set();
  (formState.sport.ownBlocks || []).forEach(b => { if (b.sportId) set.add(b.sportId); });

  if (set.has('swimming') || set.has('running') || set.has('cycling')) {
    set.add('triathlon');
  }

  formState.sport.pickedOwn = Array.from(set);
}

function emptyTrainingDetailRows() {
  return TRAINING_DAYS.map(day => {
    const row = { day };
    TRAINING_SLOTS.forEach(slot => {
      row[`${slot}_activity`] = null;
      row[`${slot}_intensity`] = null;
      row[`${slot}_minutes`] = null;
      row[`${slot}_manual_kj`] = null;
    });
    return row;
  });
}

function ensureTrainingDetailRows() {
  ensureSportState();
  const existing = Array.isArray(formState.sport.training_detail.rows)
    ? formState.sport.training_detail.rows
    : [];
  const byDay = new Map(existing.map(row => [row?.day, row]));
  formState.sport.training_detail.rows = emptyTrainingDetailRows().map(row => ({
    ...row,
    ...(byDay.get(row.day) || {})
  }));
  return formState.sport.training_detail.rows;
}

function detailRowsHaveSession(rows = []) {
  return rows.some(row => TRAINING_SLOTS.some(slot => row?.[`${slot}_activity`]));
}

function normalizeDetailSlot(row, slot) {
  const sportId = row[`${slot}_activity`] || null;
  if (!sportId) {
    row[`${slot}_activity`] = null;
    row[`${slot}_intensity`] = null;
    row[`${slot}_minutes`] = null;
    row[`${slot}_manual_kj`] = null;
    return;
  }

  row[`${slot}_intensity`] ||= 'medium';
  const minutes = finiteNumber(row[`${slot}_minutes`]);
  row[`${slot}_minutes`] = minutes && minutes > 0 ? Math.round(minutes) : 45;
  const manualKj = finiteNumber(row[`${slot}_manual_kj`]);
  row[`${slot}_manual_kj`] = manualKj && manualKj > 0 ? Math.round(manualKj) : null;
}

function normalizeDetailRows(rows = ensureTrainingDetailRows()) {
  rows.forEach(row => TRAINING_SLOTS.forEach(slot => normalizeDetailSlot(row, slot)));
  return rows;
}

function detailRowsToOwnBlocks(rows = ensureTrainingDetailRows()) {
  const bySport = new Map();

  rows.forEach(row => {
    TRAINING_SLOTS.forEach(slot => {
      const sportId = row[`${slot}_activity`];
      if (!sportId) return;

      const item = bySport.get(sportId) || {
        sportId,
        sessions: 0,
        minutesTotal: 0,
        intensities: {},
        manualKjTotal: 0,
        manualKjCount: 0
      };
      item.sessions += 1;
      item.minutesTotal += finiteNumber(row[`${slot}_minutes`]) || 45;
      const intensity = row[`${slot}_intensity`] || 'medium';
      item.intensities[intensity] = (item.intensities[intensity] || 0) + 1;
      const manualKj = finiteNumber(row[`${slot}_manual_kj`]);
      if (manualKj && manualKj > 0) {
        item.manualKjTotal += manualKj;
        item.manualKjCount += 1;
      }
      bySport.set(sportId, item);
    });
  });

  return Array.from(bySport.values()).map(item => {
    const intensity = Object.entries(item.intensities)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'medium';
    const block = {
      sportId: item.sportId,
      sessions: item.sessions,
      minutes: Math.max(15, Math.round(item.minutesTotal / item.sessions / 5) * 5),
      intensity,
      energy_kj_per_session: null,
      energy_source: 'estimated'
    };
    if (item.manualKjCount > 0) {
      block.energy_kj_per_session = Math.round(item.manualKjTotal / item.manualKjCount);
      block.energy_source = 'manual';
    }
    return block;
  });
}

function applyDetailRowsToSimpleSummary({ render = true } = {}) {
  const rows = normalizeDetailRows();
  const blocks = detailRowsToOwnBlocks(rows);
  if (blocks.length === 0) {
    formState.sport.ownBlocks = [emptyOwnBlock()];
    formState.sport.pickedOwn = [];
    formState.sport.mainSportOwn = null;
    syncAliasToActive();
    return;
  }

  formState.sport.ownBlocks = blocks.slice(0, OWN_BLOCKS_LIMIT);
  recomputePickedOwnFromBlocks();
  formState.sport.mainSportOwn = blocks
    .slice()
    .sort((a, b) => (b.sessions || 0) - (a.sessions || 0))[0]?.sportId || null;
  syncAliasToActive();

  if (render) {
    renderOwnBlocks();
    renderMainSportChips();
    onLevelOrPlanChanged();
  }
}

function trainingPlanPayloadFromDetail() {
  const detail = formState.sport?.training_detail;
  if (!detail?.enabled) return null;
  const rows = normalizeDetailRows(detail.rows || []);
  if (!detailRowsHaveSession(rows)) return null;
  return {
    source: detail.source || 'manual_detail',
    rows: rows.map(row => ({ ...row }))
  };
}

function setTrainingDetailEnabled(enabled, source = 'manual_detail') {
  ensureSportState();
  ensureTrainingDetailRows();
  formState.sport.training_detail.enabled = Boolean(enabled);
  formState.sport.training_detail.expanded = Boolean(enabled);
  formState.sport.training_detail.source = enabled ? source : null;
  if (!enabled) {
    formState.sport.strava_import = null;
  } else if (detailRowsHaveSession(formState.sport.training_detail.rows)) {
    applyDetailRowsToSimpleSummary({ render: false });
  }
}

window.__fitlimeBuildTrainingPlanPayload = () => trainingPlanPayloadFromDetail();

// Same logic for own blocks
function renderOwnBlocks() {
  const host = document.getElementById('own_blocks_container');
  if (!host) return;

  const catalog = window._sportCatalog || {};
  const lang = i18n.lang || 'en';
  const byGroup = groupCatalogByGroup(catalog);
  const detailActive = Boolean(formState.sport?.training_detail?.enabled);

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
    if (!b.energy_source) b.energy_source = 'estimated';
    refreshEstimatedEnergy(b);

    const card = document.createElement('div');
    card.className = `own-block-card${!b.sportId ? ' own-block-card--needs-sport' : ''}${detailActive ? ' own-block-card--summary' : ''}`;
    card.innerHTML = `
      <div class="own-block-grid">
        <div class="field own-sport-field${!b.sportId ? ' own-sport-field--attention' : ''}">
          <label for="own_sport_${idx}"><strong data-i18n="step3.sports">Sport</strong></label>
          <select id="own_sport_${idx}" name="own_blocks[${idx}][sport_id]" class="own-sport-select" data-idx="${idx}" ${detailActive ? 'disabled' : ''}>
            ${buildSportsSelectOptions(byGroup, lang, b.sportId)}
          </select>
          ${detailActive ? `<div class="sport-picker-toggle has-value"><span>${escapeHtml(sportLabel(window._sportCatalog?.[b.sportId], lang) || b.sportId || '-')}</span></div>` : buildSportsPickerHtml(byGroup, lang, b.sportId, idx)}
          <div class="error" id="err-picked_own_${idx}"></div>
        </div>

        <div class="field">
          <label for="own_sessions_${idx}" data-i18n="step3.sessions_per_week">Trainings/week</label>
          <input id="own_sessions_${idx}" name="own_blocks[${idx}][sessions]" type="number" class="own-sessions" data-idx="${idx}" min="1" max="18" value="${b.sessions ?? ''}" ${detailActive ? 'disabled' : ''} />
          <div class="error" id="err-sessions_per_week_${idx}"></div>
        </div>

        <div class="field">
          <label for="own_intensity_${idx}" data-i18n="step3.intensity">Intensity</label>
          <select id="own_intensity_${idx}" name="own_blocks[${idx}][intensity]" class="own-intensity" data-idx="${idx}" ${detailActive ? 'disabled' : ''}>
            <option value="low"    ${b.intensity === 'low' ? 'selected' : ''}    data-i18n="step3.intensity_low">Low</option>
            <option value="medium" ${b.intensity === 'medium' ? 'selected' : ''} data-i18n="step3.intensity_medium">Medium</option>
            <option value="high"   ${b.intensity === 'high' ? 'selected' : ''}   data-i18n="step3.intensity_high">High</option>
          </select>
          <div class="error" id="err-intensity_${idx}"></div>
        </div>

        <div class="field">
          <label for="own_minutes_${idx}" data-i18n="step3.minutes">Duration</label>
          <div class="unit-input">
            <input id="own_minutes_${idx}" name="own_blocks[${idx}][minutes]" type="number" class="own-minutes" data-idx="${idx}" min="15" max="300" step="5" value="${b.minutes ?? ''}" ${detailActive ? 'disabled' : ''} />
            <span class="unit-suffix">min</span>
          </div>
          <div class="error" id="err-minutes_${idx}"></div>
        </div>

        <div class="field">
          <label for="own_energy_${idx}" class="label-with-info">
            <span data-i18n="step3.energy_expenditure">Energy expenditure</span>
            <span class="info-tip" tabindex="0" aria-label="${t('step3.energy_expenditure_help') || 'Estimated expenditure for one training session.'}">i</span>
          </label>
          <div class="unit-input">
            <input id="own_energy_${idx}" name="own_blocks[${idx}][energy_per_session]" type="number" class="own-energy" data-idx="${idx}" min="${energyInputLimits().min}" max="${energyInputLimits().max}" step="50" value="${energyDisplayValue(b)}" placeholder="${energyInputPlaceholder(b)}" ${detailActive ? 'disabled' : ''} />
            <span id="own_energy_unit_${idx}" class="unit-suffix">${activeUnit()}</span>
          </div>
          <div class="error" id="err-energy_per_session_${idx}"></div>
        </div>
      </div>

      <div class="own-block-actions">
        <button type="button" class="btn-del-block" data-idx="${idx}" ${(formState.sport.ownBlocks.length <= 1 || detailActive) ? 'disabled' : ''}>x</button>
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
      updateOwnEnergyInput(i, { force: true });
    };
  });

  const closeSportPickerPanels = (except = null) => {
    host.querySelectorAll('.sport-picker-panel').forEach(panel => {
      if (panel === except) return;
      panel.hidden = true;
      const toggle = host.querySelector(`.sport-picker-toggle[aria-controls="${panel.id}"]`);
      toggle?.setAttribute('aria-expanded', 'false');
    });
  };

  host.querySelectorAll('.sport-picker-toggle').forEach(btn => {
    btn.onclick = () => {
      const panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!panel) return;
      const willOpen = panel.hidden;
      closeSportPickerPanels(panel);
      panel.hidden = !willOpen;
      btn.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) {
        requestAnimationFrame(() => panel.querySelector('.sport-picker-search')?.focus());
      }
    };
  });

  host.querySelectorAll('.sport-picker-search').forEach(input => {
    input.oninput = () => {
      const query = input.value.trim().toLowerCase();
      const panel = input.closest('.sport-picker-panel');
      panel?.querySelectorAll('.sport-picker-group').forEach(group => {
        let visibleCount = 0;
        group.querySelectorAll('.sport-picker-option').forEach(btn => {
          const visible = !query || btn.dataset.search.includes(query);
          btn.hidden = !visible;
          if (visible) visibleCount++;
        });
        group.hidden = visibleCount === 0;
      });
    };
  });

  host.querySelectorAll('.sport-picker-option').forEach(btn => {
    btn.onclick = () => {
      const i = +btn.dataset.idx;
      const sportId = btn.dataset.sportId;
      const nativeSelect = host.querySelector(`#own_sport_${i}`);

      formState.sport.ownBlocks[i].sportId = sportId;
      if (nativeSelect) nativeSelect.value = sportId;
      recomputePickedOwnFromBlocks();
      if (activePlan() === 'own') ensureMainForActive();
      renderMainSportChips();
      onLevelOrPlanChanged();
      updateOwnEnergyInput(i, { force: true });
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
      updateOwnEnergyInput(i, { force: true });
    };
  });

  host.querySelectorAll('.own-minutes').forEach(inp => {
    inp.oninput = () => {
      const i = +inp.dataset.idx;
      formState.sport.ownBlocks[i].minutes = +inp.value || null;
      if (i === 0) formState.sport.minutes = formState.sport.ownBlocks[0].minutes;
      updateOwnEnergyInput(i, { force: true });
    };
  });

  host.querySelectorAll('.own-energy').forEach(inp => {
    inp.oninput = () => {
      const i = +inp.dataset.idx;
      const block = formState.sport.ownBlocks[i];
      const kj = activeUnitToKj(inp.value);

      block.energy_source = 'manual';
      block.energy_kj_per_session = kj;
    };
    inp.onblur = () => {
      const i = +inp.dataset.idx;
      const block = formState.sport.ownBlocks[i];
      if (activeUnitToKj(inp.value) == null) {
        block.energy_source = 'estimated';
        refreshEstimatedEnergy(block, { force: true });
        updateOwnEnergyInput(i);
      }
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

function renderStravaImportBlock() {
  const block = document.getElementById('strava_import_block');
  if (!block) return;
  const isSport = formState.sport?.level === 'sport';
  block.style.display = isSport ? '' : 'none';
  if (!isSport) return;

  const status = document.getElementById('strava_status');
  const preview = document.getElementById('strava_preview');
  const connectBtn = document.getElementById('strava_connect_btn');
  const applyBtn = document.getElementById('strava_apply_btn');
  const discardBtn = document.getElementById('strava_discard_btn');
  const pending = formState.sport?._pendingStravaImport || null;
  const error = formState.sport?._strava_error || '';

  if (status) {
    if (error) status.textContent = t(`step3.strava_error_${error}`) || t('step3.strava_error_generic') || 'Strava import failed.';
    else if (pending) status.textContent = t('step3.strava_ready') || 'Import is ready to review.';
    else status.textContent = '';
  }

  if (connectBtn) {
    connectBtn.onclick = () => {
      try {
        localStorage.setItem('formState', JSON.stringify({ ...formState, locale: i18n?.lang || formState?.locale || 'cs' }));
        localStorage.setItem('formStep', '2');
      } catch (_) {}
      window.location.href = apiUrl('/strava/connect');
    };
  }

  if (applyBtn) {
    applyBtn.style.display = pending ? '' : 'none';
    applyBtn.onclick = () => {
      if (!formState.sport?._pendingStravaImport) return;
      const result = formState.sport._pendingStravaImport;
      formState.sport.training_detail = {
        enabled: true,
        expanded: true,
        source: 'strava_import',
        rows: Array.isArray(result.rows) ? structuredClone(result.rows) : emptyTrainingDetailRows()
      };
      formState.sport.strava_import = {
        import_days: result.import_days,
        matched_count: result.matched_count,
        selected_count: result.selected_count,
        unmatched: result.unmatched || [],
        imported_at: result.created_at || new Date().toISOString()
      };
      delete formState.sport._pendingStravaImport;
      delete formState.sport._strava_error;
      applyDetailRowsToSimpleSummary({ render: false });
      renderOwnBlocks();
      renderMainSportChips();
      renderStravaImportBlock();
      renderTrainingDetail();
      onLevelOrPlanChanged();
    };
  }

  if (discardBtn) {
    discardBtn.style.display = pending ? '' : 'none';
    discardBtn.onclick = () => {
      delete formState.sport._pendingStravaImport;
      delete formState.sport._strava_error;
      renderStravaImportBlock();
    };
  }

  if (!preview) return;
  if (!pending) {
    preview.innerHTML = '';
    return;
  }

  const sportCounts = Object.entries(pending.sport_counts || {})
    .map(([id, count]) => {
      const label = sportLabel(window._sportCatalog?.[id], i18n.lang || 'en') || id;
      return `${escapeHtml(label)}: ${count}`;
    })
    .join(', ');
  const unmatchedCount = (pending.unmatched || []).reduce((sum, item) => sum + (Number(item.count) || 0), 0);
  preview.innerHTML = `
    <div>${escapeHtml(t('step3.strava_preview_matched') || 'Matched activities')}: ${pending.matched_count || 0}</div>
    <div>${escapeHtml(t('step3.strava_preview_selected') || 'Used in week')}: ${pending.selected_count || 0}</div>
    ${sportCounts ? `<div>${sportCounts}</div>` : ''}
    ${unmatchedCount ? `<div>${escapeHtml(t('step3.strava_preview_unmatched') || 'Unmatched activities')}: ${unmatchedCount}</div>` : ''}
  `;
}

function renderTrainingDetail() {
  const panel = document.getElementById('training_detail_panel');
  const host = document.getElementById('training_detail_rows');
  if (!panel || !host) return;
  ensureTrainingDetailRows();

  const isSport = formState.sport?.level === 'sport';
  panel.style.display = isSport ? '' : 'none';
  if (!isSport) return;

  const detail = formState.sport.training_detail;
  panel.open = Boolean(detail.expanded || detail.enabled);
  panel.ontoggle = () => {
    formState.sport.training_detail.expanded = panel.open;
  };

  const badge = document.getElementById('training_detail_badge');
  if (badge) {
    badge.textContent = detail.enabled
      ? (t('step3.detail_active') || 'Active')
      : (t('step3.detail_inactive') || 'Optional');
  }

  const enableBtn = document.getElementById('training_detail_enable');
  const disableBtn = document.getElementById('training_detail_disable');
  if (enableBtn) {
    enableBtn.style.display = detail.enabled ? 'none' : '';
    enableBtn.onclick = () => {
      setTrainingDetailEnabled(true, 'manual_detail');
      renderTrainingDetail();
    };
  }
  if (disableBtn) {
    disableBtn.style.display = detail.enabled ? '' : 'none';
    disableBtn.onclick = () => {
      setTrainingDetailEnabled(false);
      renderTrainingDetail();
    };
  }

  const catalog = window._sportCatalog || {};
  const byGroup = groupCatalogByGroup(catalog);
  const lang = i18n.lang || 'en';
  const rows = detail.rows || [];

  host.innerHTML = rows.map((row, dayIdx) => {
    const slotsHtml = TRAINING_SLOTS.map(slot => {
      const sportId = row[`${slot}_activity`] || '';
      const intensity = row[`${slot}_intensity`] || 'medium';
      const manualKj = finiteNumber(row[`${slot}_manual_kj`]);
      const energyValue = manualKj ? toActiveUnitFromKJ(manualKj) : '';
      return `
        <div class="training-slot" data-day="${dayIdx}" data-slot="${slot}">
          <div class="training-slot__title">${escapeHtml(slotLabel(slot))}</div>
          <select class="training-detail-sport" data-day="${dayIdx}" data-slot="${slot}">
            ${buildDetailSportsSelectOptions(byGroup, lang, sportId)}
          </select>
          <div class="training-slot__grid">
            <input type="number" class="training-detail-minutes" data-day="${dayIdx}" data-slot="${slot}" min="15" max="300" step="5" value="${row[`${slot}_minutes`] ?? ''}" placeholder="min" />
            <select class="training-detail-intensity" data-day="${dayIdx}" data-slot="${slot}">
              <option value="low" ${intensity === 'low' ? 'selected' : ''}>${escapeHtml(t('step3.intensity_low') || 'Low')}</option>
              <option value="medium" ${intensity === 'medium' ? 'selected' : ''}>${escapeHtml(t('step3.intensity_medium') || 'Medium')}</option>
              <option value="high" ${intensity === 'high' ? 'selected' : ''}>${escapeHtml(t('step3.intensity_high') || 'High')}</option>
            </select>
            <div class="unit-input">
              <input type="number" class="training-detail-energy" data-day="${dayIdx}" data-slot="${slot}" min="0" step="50" value="${energyValue}" placeholder="${escapeHtml(t('step3.detail_energy_auto') || 'auto')}" />
              <span class="unit-suffix">${activeUnit()}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
    return `
      <section class="training-day">
        <h3>${escapeHtml(dayLabel(row.day))}</h3>
        <div class="training-day__slots">${slotsHtml}</div>
      </section>
    `;
  }).join('');

  const updateSlot = (el, updater) => {
    const dayIdx = Number(el.dataset.day);
    const slot = el.dataset.slot;
    const row = formState.sport.training_detail.rows[dayIdx];
    if (!row || !slot) return;
    updater(row, slot);
    if (formState.sport.training_detail.enabled) {
      applyDetailRowsToSimpleSummary({ render: false });
      renderOwnBlocks();
      renderMainSportChips();
    }
  };

  host.querySelectorAll('.training-detail-sport').forEach(sel => {
    sel.onchange = () => updateSlot(sel, (row, slot) => {
      row[`${slot}_activity`] = sel.value || null;
      if (!sel.value) {
        row[`${slot}_intensity`] = null;
        row[`${slot}_minutes`] = null;
        row[`${slot}_manual_kj`] = null;
      } else {
        row[`${slot}_intensity`] ||= 'medium';
        row[`${slot}_minutes`] ||= 45;
      }
      normalizeDetailSlot(row, slot);
      renderTrainingDetail();
    });
  });

  host.querySelectorAll('.training-detail-minutes').forEach(inp => {
    inp.oninput = () => updateSlot(inp, (row, slot) => {
      row[`${slot}_minutes`] = inp.value ? Number(inp.value) : null;
      normalizeDetailSlot(row, slot);
    });
  });

  host.querySelectorAll('.training-detail-intensity').forEach(sel => {
    sel.onchange = () => updateSlot(sel, (row, slot) => {
      row[`${slot}_intensity`] = sel.value || 'medium';
      normalizeDetailSlot(row, slot);
    });
  });

  host.querySelectorAll('.training-detail-energy').forEach(inp => {
    inp.oninput = () => updateSlot(inp, (row, slot) => {
      row[`${slot}_manual_kj`] = activeUnitToKj(inp.value);
      normalizeDetailSlot(row, slot);
    });
  });
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
  const stravaBlk = $('#strava_import_block');
  const detailPanel = $('#training_detail_panel');

  if (!lvl) {
    [noneBlock, planBlock, ownBlock, needBlock, hoursBlk, mainBlk, stravaBlk, detailPanel].forEach(x => x && (x.style.display = 'none'));
    return;
  }

  // lvl === 'none' => Nesportuji
  if (lvl === 'none') {
    formState.sport.plan_choice = null;
    syncAliasToActive();
    if (noneBlock) noneBlock.style.display = '';
    [planBlock, ownBlock, needBlock, hoursBlk, mainBlk, stravaBlk, detailPanel].forEach(x => x && (x.style.display = 'none'));
    return;
  }

  // Any other case (new lvl === 'sport') => user does sports and ALWAYS HAS OWN PLAN
  formState.sport.plan_choice = 'own';
  if (noneBlock) noneBlock.style.display = 'none';
  if (planBlock) planBlock.style.display = '';

  if (ownBlock) ownBlock.style.display = '';
  if (needBlock) needBlock.style.display = 'none';

  renderOwnBlocks();
  renderStravaImportBlock();
  renderTrainingDetail();
  ensureMainForActive();
  renderMainSportChips();

  if (hoursBlk) hoursBlk.style.display = 'none'; // Hours are not used for the own plan
  const hasPickedOwn = (formState.sport.pickedOwn || []).length > 0;
  if (mainBlk) mainBlk.style.display = hasPickedOwn ? '' : 'none';
}

async function consumeStravaReturnParams() {
  const params = new URLSearchParams(window.location.search);
  const importId = params.get('strava_import_id');
  const error = params.get('strava_error');
  if (!importId && !error) return;

  ensureSportState();
  delete formState.sport._pendingStravaImport;
  delete formState.sport._strava_error;

  if (error) {
    formState.sport._strava_error = error;
  } else if (importId) {
    try {
      const res = await fetch(apiUrl(`/strava/imports/${encodeURIComponent(importId)}`));
      if (!res.ok) throw new Error(`Import fetch failed: ${res.status}`);
      formState.sport._pendingStravaImport = await res.json();
    } catch (err) {
      console.warn('Strava import fetch failed', err);
      formState.sport._strava_error = 'expired';
    }
  }

  params.delete('strava_import_id');
  params.delete('strava_error');
  const qs = params.toString();
  const cleanUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`;
  window.history.replaceState({}, '', cleanUrl);
}

export async function bindSportStep() {
  ensureSportState();
  const catalog = await loadCatalog();
  await loadMetValues();
  await consumeStravaReturnParams();
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
      preferences: formState.sport.preferences || {},
      training_detail: formState.sport.training_detail || { enabled: false, expanded: false, source: null, rows: [] },
      strava_import: formState.sport.strava_import || null
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
    (diet && diet !== 'no_restrictions' && diet !== 'none') ||
    (Array.isArray(dislikes) && dislikes.length > 0) ||
    customized;

  formState.plan ||= {};
  formState.plan.autoPremium = needsPremium;
  return needsPremium;
}

// --- Reset values when switching back to the standard plan ---
function resetToStandardDefaults() {
  formState.nutrition ||= {};
  formState.nutrition.diet = 'no_restrictions';
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
  if (!formState.nutrition.diet) formState.nutrition.diet = 'no_restrictions';
  if (!formState.nutrition.dislikes) formState.nutrition.dislikes = [];
  if (formState.nutrition.soups === 'yes') formState.nutrition.soups = true;
  if (formState.nutrition.soups === 'no') formState.nutrition.soups = false;
  if (formState.nutrition.warm_meals === 'no_preference') formState.nutrition.warm_meals = 'any';
  if (formState.nutrition.soups == null) formState.nutrition.soups = null;
  if (formState.nutrition.warm_meals == null) formState.nutrition.warm_meals = null;

  const normalizeChipValue = (key, value) => {
    if (key === 'soups') {
      if (value === true || value === 'true') return true;
      if (value === false || value === 'false') return false;
    }
    return value;
  };

  const bindChipGroup = (groupId, target, key, cb) => {
    const chips = document.querySelectorAll(`#${groupId} .chip`);
    chips.forEach(ch => {
      if (target[key] === normalizeChipValue(key, ch.dataset.value)) ch.classList.add('selected');
      ch.onclick = () => {
        chips.forEach(x => x.classList.remove('selected'));
        ch.classList.add('selected');
        target[key] = normalizeChipValue(key, ch.dataset.value);
        cb && cb(target[key]);
        updatePremiumNote();
        checkIfPremiumNeeded(); // After each diet/repeats change
      };
    });
  };

  bindChipGroup('soups_group', formState.nutrition, 'soups');
  bindChipGroup('warm_meals_group', formState.nutrition, 'warm_meals');

  // Dieta
  const updateDietHints = (val) => {
    const hints = document.querySelectorAll('#diet_block .grams-hint');
    hints.forEach(h => h.classList.toggle('active', h.dataset.value === String(val)));
  };
  bindChipGroup('diet_group', formState.nutrition, 'diet', updateDietHints);
  updateDietHints(formState.nutrition.diet);

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
    const diet = formState.nutrition.diet || 'no_restrictions';
    const needsPremium = (diet !== 'no_restrictions') || dislikes.length > 0;

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
  if (formState.nutrition.cooking_complexity == null) formState.nutrition.cooking_complexity = 'standard';
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

  const updateGramsHints = (val) => {
    const hints = document.querySelectorAll('.grams-hints .grams-hint');
    hints.forEach(h => h.classList.toggle('active', h.dataset.value === String(val)));
  };

  bindChipGroup('cooking_complexity_group', formState.nutrition, 'cooking_complexity');
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
    ? `€ ${eur.toFixed(2)}`
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
  if (!formState.plan.variant) formState.plan.variant = 'premium';
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
    } else {
      if (totalEl) totalEl.textContent = '';
      formState.plan.price = null;
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
    (diet && diet !== 'no_restrictions') ||
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

  const repeatsMap = {};
  const soupsMap = {
    true: t('step5.soups_yes'),
    false: t('step5.soups_no')
  };
  const warmMealsMap = {
    1: t('step5.warm_meals_1'),
    2: t('step5.warm_meals_2'),
    any: t('step5.warm_meals_no_preference')
  };
  const cookingComplexityMap = {
    simple: t('step6.cooking_complexity_simple'),
    standard: t('step6.cooking_complexity_standard'),
    advanced: t('step6.cooking_complexity_advanced')
  };
  const gramsMap = {
    yes: t('step6.grams_yes'),
    no: t('step6.grams_no')
  };

  const variantKey = plan?.variant ? `step7.${plan.variant}_title` : null;
  const periodKey = plan?.period ? `step7.period_${plan.period}` : null;

  // --- energie + BMR ---
  const targetTxt = t('step2.target_' + goal?.target) || '-';
  const bmrKcal = goal?.bmr_override ?? goal?.bmr_kcal;
  let bmrVal = null;
  if (bmrKcal) {
    const unit = activeUnit();
    const val = toActiveUnitFromKcal(bmrKcal);
    const locale = i18n?.lang || 'cs';
    bmrVal = `${val.toLocaleString(locale)} ${unit}`;
  }
  const goalFull = bmrVal ? `${targetTxt} | BMR: ${bmrVal}` : targetTxt;

  // --- sports section ---
  let sportsSummary = '-';

  if (!sport || !sport.level) {
    sportsSummary = '-';
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
        const perWeek = t('home.pricing.per_week') || '/ week';

        return `${lbl}: ${b.sessions}x${perWeek}, ${b.minutes} min, ${intensityLabel} ${intensityWord.toLowerCase()}`;
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
    plan: `${variantKey ? t(variantKey) : '-'}`,
    // Previously this also included the period label.

    basic: `${t('step1.sex_' + profile.sex) || '?'} | ${profile.age || '?'} ${t('common.years') || 'years'} | ${profile.height_cm || '?'} cm | ${profile.weight_kg || '?'} kg`,
    activity: `${t('step1.activity_' + profile.activity) || '-'} | ${t('step1.steps')}: ${t('step1.steps_' + profile.steps_bucket) || '-'}`,

    goal: goalFull,
    sports: sportsSummary,
    diet: t('step5.diet_' + nutrition?.diet) || '-',

    dislikes: (() => {
      const base = (nutrition.dislikes || [])
        .map(d => t('step5.dislike_' + d) || d);

      return base.join(', ') || '-';
    })(),


    repeats: repeatsMap[nutrition?.repeats] || '-',
    show_grams: gramsMap[nutrition?.show_grams] || '-',
    soups: soupsMap[String(nutrition?.soups)] || '-',
    warm_meals: warmMealsMap[nutrition?.warm_meals] || '-',
    cooking_complexity: cookingComplexityMap[nutrition?.cooking_complexity] || '-',
    macros: (() => {
      const c = nutrition?.macros?.c ?? '-';
      const f = nutrition?.macros?.f ?? '-';
      const p = nutrition?.macros?.p ?? '-';

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
    rev_soups: summary.soups,
    rev_warm_meals: summary.warm_meals,
    rev_cooking_complexity: summary.cooking_complexity,
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
      priceBox.textContent = isEur ? `€ ${originalPrice.toFixed(2)}` : `${originalPrice} Kč`;
      priceBox.dataset.original = originalPrice;
    } else {
      priceBox.textContent = '-';
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
        console.error("Purchase error:", err);
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }
    });
  }


  // --- Discount code ---
  const discountBtn = document.getElementById("apply-discount");
  if (discountBtn) {
    discountBtn.addEventListener("click", async function () {
      const input = document.getElementById("discount_code");
      const code = input.value.trim().toUpperCase();
      const priceEl = document.getElementById("reviewPrice");
      const infoEl = document.getElementById("discount-info");
      const errorEl = document.getElementById("err-discount");

      if (!code) {
        errorEl.textContent = t("step7.discount_invalid") || "Please enter a discount code.";
        return;
      }

      const originalHTML = discountBtn.innerHTML;
      discountBtn.disabled = true;
      const sendingText = t("buttons.sending") || "Verifying...";
      discountBtn.innerHTML = `<span class="spinner"></span>${sendingText}`;

      try {
        const res = await fetch(apiUrl("/discounts/validate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code })
        });

        if (res.status === 429) {
          errorEl.textContent = t("step8.discount_rate_limit") || "Too many attempts. Please wait a moment and try again.";
          infoEl.textContent = "";
          return;
        }

        if (!res.ok) {
          throw new Error("API error");
        }

        const data = await res.json();

        if (data.valid) {
          const discount = data.discount_pct;
          const originalPrice = parseFloat(priceEl.dataset.original);
          const isEur = (currentCurrency() === "EUR");
          const newPrice = (originalPrice * (1 - discount / 100)).toFixed(2);

          // Save to state
          formState.plan.discount_code = code;
          formState.plan.discount_percent = discount;
          formState.plan.price.final = parseFloat(newPrice);
          formState.plan.price.currency = currentCurrency() === "EUR" ? "EUR" : "CZK";

          // update UI
          priceEl.textContent = isEur ? `€ ${newPrice}` : `${newPrice} Kč`;
          infoEl.textContent = `${t("step8.discount_applied") || "Discount code"}: ${code} (-${discount}%)`;
          errorEl.textContent = "";
        } else {
          // Invalid code
          delete formState.plan.discount_code;
          delete formState.plan.discount_percent;
          delete formState.plan.price.final;

          errorEl.textContent = t("step8.discount_invalid") || "Invalid discount code.";
          infoEl.textContent = "";
        }
      } catch (err) {
        errorEl.textContent = t("step8.discount_error") || "Error verifying discount code.";
        infoEl.textContent = "";
        console.error(err);
      } finally {
        discountBtn.disabled = false;
        discountBtn.innerHTML = originalHTML;
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
    localStorage.setItem("formStep", "8");
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
      console.warn("Price element not found in DOM, using stored formState.plan.price");
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
    if (cleanState.sport) {
      delete cleanState.sport._pendingStravaImport;
      delete cleanState.sport._strava_error;
    }
    const trainingPlanPayload = trainingPlanPayloadFromDetail();
    if (trainingPlanPayload) cleanState.training_plan = trainingPlanPayload;
    else delete cleanState.training_plan;

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





