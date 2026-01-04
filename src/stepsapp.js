import { renderMacroCharts} from './charts.js';
import { formState } from './state.js';
import { $, applyI18n, showErrors} from './app.js';
import {
  validateProfile, validateGoal, validateSport, BMR_LIMITS,
  validateMacros, validateDiet, validatePlan, validateReview
} from './validation.js';
import { i18n as I18N, SUPPORTED as SUPPORTED_LANGS, t as T, bootI18n, loadLang as coreLoadLang } from './i18n-core.js';

// === I18N aliases (so the rest of app.js can stay unchanged) ===
const i18n = I18N;
const t = (path)=> T(path);
const SUPPORTED = SUPPORTED_LANGS;

/* ============== STEP 1 – PROFILE ============== */
export function bindProfileStep(){
  const bindNum = (id, key) => {
    const el = document.getElementById(id);
    if(!el) return;
    el.value = formState.profile[key] ?? '';
    el.oninput = () => {
      formState.profile[key] = el.value ? parseInt(el.value,10) : null;
    };
  };
  const bindChoice = (groupId, key) => {
    const chips = document.querySelectorAll(`#${groupId} .chip`);
    chips.forEach(ch=>{
      if (formState.profile[key]===ch.dataset.value) ch.classList.add('selected');
      ch.onclick = ()=>{
        chips.forEach(x=>x.classList.remove('selected'));
        ch.classList.add('selected');
        formState.profile[key] = ch.dataset.value;
      };
    });
  };

  bindChoice('sex_group','sex');
  bindNum('age','age');
  bindNum('height_cm','height_cm');
  bindNum('weight_kg','weight_kg');
  bindChoice('activity_group','activity');
  bindChoice('steps_bucket','steps_bucket');
}
/* ============== STEP 2 – GOAL & BMR ============== */
const KCAL_TO_KJ = 4.184;
const toKJ   = (kcal)=> kcal * KCAL_TO_KJ;
const toKcal = (kj)=>   kj / KCAL_TO_KJ;

const roundKcal = (v)=> Math.round(v / 10) * 10;  // kcal → 10
const roundKJ   = (v)=> Math.round(v / 50) * 50;  // kJ → 50
const roundByUnit = (v, u)=> (u === 'kcal' ? roundKcal(v) : roundKJ(v));


function activeUnit() {
  const unit = formState.goal?.energy_unit;
  return unit === 'kJ' ? 'kJ' : 'kcal';
}

function toActiveUnitFromKcal(kcal){
  const u = activeUnit();
  const raw = (u === 'kcal') ? kcal : toKJ(kcal);
  return roundByUnit(raw, u);
}

function toActiveUnitFromKJ(kj){
  const u = activeUnit();
  const raw = (u === 'kcal') ? toKcal(kj) : kj;
  return roundByUnit(raw, u);
}

function calcBMR(sex, age, height, weight){
  if(sex==='male')   return Math.round(10*weight + 6.25*height - 5*age + 5);
  if(sex==='female') return Math.round(10*weight + 6.25*height - 5*age - 161);
  return Math.round(((10*weight + 6.25*height - 5*age + 5) + (10*weight + 6.25*height - 5*age - 161))/2);
}

function ensureBmrFromProfile(){
  const { sex, age, height_cm, weight_kg } = formState.profile || {};
  if (sex && age && height_cm && weight_kg) {
    const calc = calcBMR(sex, age, height_cm, weight_kg);
    formState.goal ||= {};
    if (!formState.goal.bmr_kcal && !formState.goal.bmr_override) {
      formState.goal.bmr_kcal = calc;
    }
  }
}

export function bindGoalStep(){
  ensureBmrFromProfile();

  const bindChipGroup = (groupId, key, cb)=>{
    const chips = document.querySelectorAll(`#${groupId} .chip`);
    chips.forEach(ch=>{
      if ((formState.goal?.[key])===ch.dataset.value) ch.classList.add('selected');
      ch.onclick = ()=>{
        chips.forEach(x=>x.classList.remove('selected'));
        ch.classList.add('selected');
        formState.goal ||= {};
        formState.goal[key]=ch.dataset.value;
        cb && cb(ch.dataset.value);
      };
    });
  };

  formState.goal ||= {};

  // default energy unit
  if (!formState.goal.energy_unit) {
    formState.goal.energy_unit = 'kcal';
  }

  bindChipGroup('target_group','target', (val)=>{
    const map = { lose: t('step2.help_lose'), maintain: t('step2.help_maintain'), gain: t('step2.help_gain') };
    const el = document.getElementById('target_help'); 
    if (el) el.textContent = map[val] || '';
  });

  // ⭐ KEY CHANGE: 'energy_unit' místo 'energyUnit'
  bindChipGroup('energy_unit_group', 'energy_unit', (val) => {
    formState.goal ||= {};
    formState.goal.energy_unit = val;

    console.log("[DBG unit switch]", val);

    renderBmr();
    updateBmrHelp();
  });



  function renderBmr(){
    const input   = document.getElementById('bmr_value');
    const unitEl  = document.getElementById('bmr_unit');
    const kcal    = formState.goal.bmr_override ?? formState.goal.bmr_kcal ?? 1800;
    const u       = activeUnit();
    if (unitEl) unitEl.textContent = u;
    if (input)  input.value = String(toActiveUnitFromKcal(kcal));
  }


  function updateBmrHelp(){
    const helpEl = document.getElementById('bmr_help');
    if (!helpEl) return;

    const unit = activeUnit();
    const limits = BMR_LIMITS[unit];

    const min = roundByUnit(limits.min, unit);
    const max = roundByUnit(limits.max, unit);

    const locale = i18n?.lang || 'cs';
    const minStr = Number(min).toLocaleString(locale);
    const maxStr = Number(max).toLocaleString(locale);

    const base = (unit==='kJ'
      ? (t('step2.bmr_help_kj')   || 'Vypočítáno z profilu (kJ/den). Můžete upravit ručně.')
      : (t('step2.bmr_help_kcal') || 'Vypočítáno z profilu (kcal/den). Můžete upravit ručně.')
    );
    const rangeWord = t('common.range') || 'Rozsah';
    const perDay = t('common.per_day_short') || 'den';

    helpEl.textContent = `${base} ${rangeWord}: ${minStr}–${maxStr} ${unit}/${perDay}.`;
  }


  renderBmr();
  updateBmrHelp();


  const bmrInput = document.getElementById('bmr_value');
  if (bmrInput){
    bmrInput.oninput = ()=>{
      const raw = bmrInput.value.trim();
      if (raw===''){ 
        formState.goal.bmr_override = null; 
        console.log("[DBG oninput] empty -> bmr_override=null");
        return; 
      }
      const num = Number(raw.replace(',', '.'));
      if (!Number.isFinite(num)) { 
        formState.goal.bmr_override = null; 
        console.log("[DBG oninput] not finite -> bmr_override=null", raw);
        return; 
      }
      const kcalVal = (activeUnit()==='kJ') ? toKcal(num) : num;
      formState.goal.bmr_override = roundKcal(kcalVal);
      console.log("[DBG oninput] saved override kcal =", formState.goal.bmr_override, "unit=", activeUnit(), "raw=", raw);
    };
  }
}

/* ============== STEP 3 – SPORT ================= */
const OWN_BLOCKS_LIMIT = 10;
function updateAddOwnBlockControls() {
  const btn  = document.getElementById('add_own_block');
  const hint = document.getElementById('add_own_block_limit_hint');

  if (!btn) return;

  const count = (formState.sport?.ownBlocks || []).length;
  const limitReached = count >= OWN_BLOCKS_LIMIT;

  btn.disabled = limitReached || formState.sport?.level !== 'sport';
  btn.classList.toggle('limit-reached', limitReached);
  if (limitReached) {
    // pokud chceš překládat, můžeš použít t('step3.add_own_block_full') atd.
    btn.textContent = t?.('step3.add_own_block_full') || 'Kapacita vyčerpána';
    if (hint) {
      hint.textContent = t?.('step3.add_own_block_limit_hint')
        || 'Můžeš přidat maximálně 10 sportů. Pro přidání nového nejdřív nějaký odeber.';
    }
  } else {
    btn.textContent = t?.('step3.add_own_block') || 'Přidat další sport';
    if (hint) hint.textContent = '';
  }
}

function ensureSportState(){
  formState.sport ||= {};
  formState.sport.ownBlocks     ||= [];
  formState.sport.pickedOwn     ||= [];
  formState.sport.mainSportOwn   = formState.sport.mainSportOwn ?? null;
  formState.sport.picked        ||= [];
  formState.sport.mainSportId    = formState.sport.mainSportId ?? null;

  // UPDATED: pokud je nastavené "sportuji", vždy používáme vlastní plán
  if (formState.sport.level === 'sport') {
    formState.sport.plan_choice = 'own';
  } else if (!formState.sport.level) {
    formState.sport.plan_choice = null;
  }
}

function ensureOwnDefaults(){
  formState.sport ||= {};
  formState.sport.ownBlocks ||= [];
  if (formState.sport.ownBlocks.length === 0){
    formState.sport.ownBlocks.push({ sportId: '', sessions: 3, minutes: 45, intensity: 'medium' });
  }
  formState.sport.ownBlocks.forEach(b=>{
    if (!b.sportId)    b.sportId = '';
    if (!b.sessions)   b.sessions = 3;
    if (!b.minutes)    b.minutes = 45;
    if (!b.intensity)  b.intensity = 'medium';
  });
  recomputePickedOwnFromBlocks();
  if (!formState.sport.mainSportOwn && (formState.sport.pickedOwn||[]).length>0){
    formState.sport.mainSportOwn = formState.sport.pickedOwn[0];
  }
  syncAliasToActive();
}

async function loadCatalog(){
  if (window._sportCatalog) return window._sportCatalog;
  const res = await fetch('/sports/catalog.json');
  if (!res.ok) { console.warn('catalog fetch failed', res.status); return {}; }
  const data = await res.json();
  window._sportCatalog = data;
  return data;
}

function sportLabel(rec, lang){ 
  return rec?.labels?.[lang] || rec?.labels?.en || rec?.id || ''; 
}

function groupCatalogByGroup(catalog){
  const groups = {};
  for (const [id, rec] of Object.entries(catalog || {})){
    const g = rec.group || 'other';
    (groups[g] ||= []).push({ id, ...rec });
  }
  return groups;
}


// UPDATED: aktivní plán = own, když uživatel sportuje
const activePlan = () => (formState.sport?.level === 'sport' ? 'own' : null);

// UPDATED: aliasy se řídí jen vlastním plánem
function syncAliasToActive(){
  const plan = activePlan();
  if (plan === 'own'){
    formState.sport.picked = [...(formState.sport.pickedOwn||[])];
    formState.sport.mainSportId = formState.sport.mainSportOwn || null;
  } else {
    formState.sport.picked = [];
    formState.sport.mainSportId = null;
  }
}

// UPDATED: řešíme jen mainSportOwn
function ensureMainForActive(){
  const picked = formState.sport.pickedOwn || [];
  if (picked.length === 0){
    formState.sport.mainSportOwn = null;
  } else {
    const cur = formState.sport.mainSportOwn;
    if (!cur || !picked.includes(cur)){
      formState.sport.mainSportOwn = picked[0];
    }
  }
  syncAliasToActive();
}

// UPDATED: nastavuje hlavní sport jen pro vlastní plán
function setMainForActive(id){
  if (!id) return;
  if (formState.sport.level === 'sport') {
    formState.sport.mainSportOwn = id;
    syncAliasToActive();
  }
}

function buildSportsSelectOptions(byGroup, lang, selectedId){
  const labels = {
    endurance: t('step3.groups.title_endurance') || 'Vytrvalostní sporty',
    individual:t('step3.groups.title_individual')|| 'Individuální sporty',
    team:      t('step3.groups.title_team')      || 'Kolektivní sporty',
    fitness:   t('step3.groups.title_fitness')   || 'Fitness & tělocvična',
    water:     t('step3.groups.title_water')     || 'Vodní sporty',
    winter:    t('step3.groups.title_winter')    || 'Zimní sporty',    
    combat:    t('step3.groups.title_combat')    || 'Bojové sporty',
    other:     t('step3.groups.title_other')     || 'Ostatní sporty'
  };
  const order = ['endurance','individual','team','fitness','water','winter','combat','other'];

  // 🩵 tahle volba je vidět jako placeholder, ale NE v nabídce
  let html = `<option value="" disabled ${!selectedId ? 'selected' : ''} hidden>
                ${t('step3.select_sport_placeholder') || 'Vyber sport'}
              </option>`;

  for (const g of order){
    const list = byGroup[g]; if (!list || !list.length) continue;
    html += `<optgroup label="${labels[g]}">`;
    list.slice().sort((a,b)=> sportLabel(a,lang).localeCompare(sportLabel(b,lang)))
      .forEach(rec=>{
        const lbl = sportLabel(rec, lang);
        html += `<option value="${rec.id}" ${rec.id===selectedId?'selected':''}>${lbl}</option>`;
      });
    html += `</optgroup>`;
  }
  return html;
}


function emptyOwnBlock(){
  return { sportId: '', sessions: 3, minutes: 45, intensity: 'medium' };
}

function recomputePickedOwnFromBlocks(){
  const set = new Set();
  (formState.sport.ownBlocks||[]).forEach(b=>{ if (b.sportId) set.add(b.sportId); });
  formState.sport.pickedOwn = Array.from(set);
}

// stále stejná logika pro vlastní bloky
function renderOwnBlocks(){
  const host = document.getElementById('own_blocks_container');
  if (!host) return;

  const catalog = window._sportCatalog || {};
  const lang = i18n.lang || 'en';
  const byGroup = groupCatalogByGroup(catalog);

  if (!Array.isArray(formState.sport.ownBlocks) || formState.sport.ownBlocks.length === 0){
    formState.sport.ownBlocks = [ emptyOwnBlock() ];
  }


  recomputePickedOwnFromBlocks();
  if (!formState.sport.mainSportOwn && formState.sport.pickedOwn.length > 0){
    formState.sport.mainSportOwn = formState.sport.pickedOwn[0];
  }
  syncAliasToActive();

  host.innerHTML = '';
  formState.sport.ownBlocks.forEach((b, idx)=>{
    const card = document.createElement('div');
    card.className = 'own-block-card';
    card.innerHTML = `
      <div class="own-block-grid">
        <div class="field">
          <label><strong data-i18n="step3.sports">Sport</strong></label>
          <select class="own-sport-select" data-idx="${idx}">
            ${buildSportsSelectOptions(byGroup, lang, b.sportId)}
          </select>
          <div class="error" id="err-picked_own_${idx}"></div>
        </div>

        <div class="field">
          <label data-i18n="step3.sessions_per_week">Tréninky/týden</label>
          <input type="number" class="own-sessions" data-idx="${idx}" min="1" max="18" value="${b.sessions ?? ''}" />
          <div class="error" id="err-sessions_per_week_${idx}"></div>
        </div>

        <div class="field">
          <label data-i18n="step3.intensity">Intenzita</label>
          <select class="own-intensity" data-idx="${idx}">
            <option value="low"    ${b.intensity==='low'?'selected':''}    data-i18n="step3.intensity_low">Nízká</option>
            <option value="medium" ${b.intensity==='medium'?'selected':''} data-i18n="step3.intensity_medium">Střední</option>
            <option value="high"   ${b.intensity==='high'?'selected':''}   data-i18n="step3.intensity_high">Vysoká</option>
          </select>
          <div class="error" id="err-intensity_${idx}"></div>
        </div>

        <div class="field">
          <label data-i18n="step3.minutes">Délka (min)</label>
          <input type="number" class="own-minutes" data-idx="${idx}" min="15" max="300" value="${b.minutes ?? ''}" />
          <div class="error" id="err-minutes_${idx}"></div>
        </div>
      </div>

      <div class="own-block-actions">
        <button type="button" class="btn-del-block" data-idx="${idx}" ${formState.sport.ownBlocks.length <= 1 ? 'disabled' : ''}>×</button>
      </div>
    `;
    host.appendChild(card);
  });

  host.querySelectorAll('.own-sport-select').forEach(sel=>{
    sel.onchange = ()=>{
      const i = +sel.dataset.idx;
      formState.sport.ownBlocks[i].sportId = sel.value;
      recomputePickedOwnFromBlocks();
      if (activePlan()==='own') ensureMainForActive();
      renderMainSportChips();
      onLevelOrPlanChanged();
    };
  });

  host.querySelectorAll('.own-sessions').forEach(inp=>{
    inp.oninput = ()=>{
      const i = +inp.dataset.idx;
      formState.sport.ownBlocks[i].sessions = +inp.value || null;
      if (i === 0) formState.sport.sessions_per_week = formState.sport.ownBlocks[0].sessions;
    };
  });

  host.querySelectorAll('.own-intensity').forEach(sel=>{
    sel.onchange = ()=>{
      const i = +sel.dataset.idx;
      formState.sport.ownBlocks[i].intensity = sel.value;
      if (i === 0) formState.sport.intensity = formState.sport.ownBlocks[0].intensity;
    };
  });

  host.querySelectorAll('.own-minutes').forEach(inp=>{
    inp.oninput = ()=>{
      const i = +inp.dataset.idx;
      formState.sport.ownBlocks[i].minutes = +inp.value || null;
      if (i === 0) formState.sport.minutes = formState.sport.ownBlocks[0].minutes;
    };
  });

  host.querySelectorAll('.btn-del-block').forEach(btn=>{
    btn.onclick = ()=>{
      const i = +btn.dataset.idx;
      if (formState.sport.ownBlocks.length <= 1) return;
      formState.sport.ownBlocks.splice(i,1);
      recomputePickedOwnFromBlocks();
      if (activePlan()==='own') ensureMainForActive();
      renderOwnBlocks();
      renderMainSportChips();
      onLevelOrPlanChanged();
    };
  });

  const first = formState.sport.ownBlocks[0] || {};
  formState.sport.sessions_per_week = first.sessions ?? null;
  formState.sport.minutes           = first.minutes ?? null;
  formState.sport.intensity         = first.intensity || 'medium';

  
  if (typeof applyI18n === 'function') applyI18n();
  updateAddOwnBlockControls();
}

// Ponecháváme, i když need_plan už v UI nevyužiješ – můžeš případně smazat celý blok.
function renderNeedSportsCollapsible(containerId, byGroup){
  const host = document.getElementById(containerId);
  if (!host) return;
  const lang = i18n.lang || 'en';
  const groupLabels = {
    endurance: t('step3.groups.title_endurance') || 'Vytrvalostní sporty',
    winter:    t('step3.groups.title_winter')    || 'Zimní sporty',
    team:      t('step3.groups.title_team')      || 'Kolektivní sporty',
    individual:t('step3.groups.title_individual')|| 'Individuální sporty',
    fitness:   t('step3.groups.title_fitness')   || 'Fitness & tělocvična',
    water:     t('step3.groups.title_water')     || 'Vodní sporty',
    combat:    t('step3.groups.title_combat')    || 'Bojové sporty',
    other:     t('step3.groups.title_other')     || 'Ostatní sporty'
  };
  host.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'need-groups-grid';
  const order = ['endurance','winter','team','individual','fitness','water','combat','other'];
  for (const g of order){
    const list = byGroup[g]; if (!list || !list.length) continue;
    const details = document.createElement('details'); details.className='sport-accordion';
    const summary = document.createElement('summary'); summary.textContent = groupLabels[g];
    const chips = document.createElement('div'); chips.className='chips';
    list.slice().sort((a,b)=> sportLabel(a,lang).localeCompare(sportLabel(b,lang)))
      .forEach(rec=>{
        const btn = document.createElement('button');
        btn.type='button'; btn.className='chip'; btn.dataset.value=rec.id;
        btn.textContent = sportLabel(rec, lang);
        if ((formState.sport.pickedNeed||[]).includes(rec.id)) btn.classList.add('selected');
        btn.onclick = ()=>{
          const set = new Set(formState.sport.pickedNeed || []);
          if (set.has(rec.id)) { set.delete(rec.id); btn.classList.remove('selected'); }
          else { set.add(rec.id); btn.classList.add('selected'); }
          formState.sport.pickedNeed = Array.from(set);
          // activePlan už nikdy nebude 'need_plan', takže se UI neaktualizuje do "plánu na míru"
        };
        chips.appendChild(btn);
      });
    details.appendChild(summary); details.appendChild(chips); grid.appendChild(details);
  }
  host.appendChild(grid);
}

// UPDATED: používá jen pickedOwn / mainSportOwn
function renderMainSportChips(){
  const wrap = document.getElementById('main_sport_chips');
  if (!wrap) return;
  ensureMainForActive();

  const picked = formState.sport.pickedOwn || [];
  wrap.innerHTML = '';
  if (picked.length === 0) return;

  const lang = i18n.lang || 'en';
  const cur = formState.sport.mainSportOwn;

  picked.forEach(id=>{
    const rec = window._sportCatalog?.[id];
    const lbl = sportLabel(rec, lang) || id;
    const btn = document.createElement('button');
    btn.type='button'; btn.className='chip'; btn.dataset.value=id; btn.textContent = lbl;
    if (cur === id) btn.classList.add('selected');
    btn.onclick = ()=>{ setMainForActive(id); renderMainSportChips(); };
    wrap.appendChild(btn);
  });
}

export function onLevelOrPlanChanged(){
  ensureSportState();
  const lvl  = formState.sport.level;
  const noneBlock = $('#sport_none_block');
  const planBlock = $('#sport_plan_block');
  const ownBlock  = $('#own_plan_block');
  const needBlock = $('#need_plan_block');
  const hoursBlk  = $('#hours_block');
  const mainBlk   = $('#main_sport_block');

  if (!lvl){ 
    [noneBlock, planBlock, ownBlock, needBlock, hoursBlk, mainBlk].forEach(x=> x && (x.style.display='none')); 
    return; 
  }

  // lvl === 'none' => Nesportuji
  if (lvl === 'none'){
    formState.sport.plan_choice = null; 
    syncAliasToActive();
    if (noneBlock) noneBlock.style.display = '';
    [planBlock, ownBlock, needBlock, hoursBlk, mainBlk].forEach(x=> x && (x.style.display='none'));
    return;
  }

  // cokoliv jiného (nově lvl === 'sport') => Sportuji a MÁM VŽDY VLASTNÍ PLÁN
  formState.sport.plan_choice = 'own';
  if (noneBlock) noneBlock.style.display = 'none';
  if (planBlock) planBlock.style.display = '';

  if (ownBlock)  ownBlock.style.display  = '';
  if (needBlock) needBlock.style.display = 'none';

  renderOwnBlocks(); 
  ensureMainForActive(); 
  renderMainSportChips();

  if (hoursBlk) hoursBlk.style.display = 'none'; // u vlastního plánu hodiny neřešíme
  const hasPickedOwn = (formState.sport.pickedOwn || []).length > 0;
  if (mainBlk) mainBlk.style.display  = hasPickedOwn ? '' : 'none';
}

export async function bindSportStep(){
  ensureSportState();
  const catalog = await loadCatalog();
  const byGroup = groupCatalogByGroup(catalog);
  
  const bindChipGroup = (groupId, target, key, cb)=>{
    const chips = document.querySelectorAll(`#${groupId} .chip`);
    chips.forEach(ch=>{
      if (target[key]===ch.dataset.value) ch.classList.add('selected');
      ch.onclick = ()=>{
        chips.forEach(x=>x.classList.remove('selected'));
        ch.classList.add('selected');
        target[key]=ch.dataset.value;
        cb && cb();
      };
    });
  };

  bindChipGroup('sport_level_group', formState.sport, 'level', onLevelOrPlanChanged);

  // --- Dynamický text pro vysvětlení úrovně aktivity ---
  const levelHelpEl = document.getElementById('activity_help');
  const updateLevelHelp = (val) => {
    const map = {
      none:  t('step3.help_none'),
      sport: t('step3.help_sport')
    };
    if (levelHelpEl) levelHelpEl.textContent = map[val] || '';
  };

  // zobrazí text při načtení (např. při návratu zpět do stepu)
  if (formState.sport?.level) {
    updateLevelHelp(formState.sport.level);
  }

  // sleduj změny výběru
  const levelChips = document.querySelectorAll('#sport_level_group .chip');
  levelChips.forEach(ch => {
    ch.addEventListener('click', () => updateLevelHelp(ch.dataset.value));
  });

    const noneWrap = $('#none_suggestions');

  // --- klikání na chipy "Co by tě lákalo" (bez možnosti Jiné) ---
  noneWrap?.querySelectorAll('.chip').forEach(btn => {
    btn.onclick = () => {
      btn.classList.toggle('selected');

      const set = new Set(formState.sport?.futureMulti || []);

      if (btn.classList.contains('selected')) {
        set.add(btn.dataset.value);
      } else {
        set.delete(btn.dataset.value);
      }

      formState.sport.futureMulti = Array.from(set);
      //formState.sport.future = btn.dataset.value; // poslední kliknutý, klidně jen jako info
    };
  });

  // --- re-inicializace vybraných chipů při návratu na step 3 ---
  const selected = new Set(formState.sport?.futureMulti || []);
  noneWrap?.querySelectorAll('.chip').forEach(btn => {
    if (selected.has(btn.dataset.value)) {
      btn.classList.add('selected');
    }
  });

  // UPDATED: žádný výběr plan_choice_group – pro sport vždy own
  if (formState.sport.level === 'sport') {
    formState.sport.plan_choice = 'own';
    ensureOwnDefaults();
  }

  // pokud chceš úplně vypnout část s "potřebuji plán", můžeš zrušit renderNeedSportsCollapsible
  // renderNeedSportsCollapsible('need_sports_list', byGroup);

  if (formState.sport.level === 'sport'){ 
    ensureOwnDefaults(); 
    renderOwnBlocks(); 
    renderMainSportChips(); 
  }

    $('#add_own_block')?.addEventListener('click', ()=> {
    formState.sport ||= {};
    formState.sport.ownBlocks ||= [];

    // tvrdý limit – nic nepřidá, když už je 10
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
  if (hpw){
    const save = ()=>{
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

// Cleanup sport state před přechodem na další krok
export function cleanupSportStateBeforeNext() {
  if (!formState.sport) return;
  const lvl = formState.sport.level;

  if (lvl === 'none') {
    // uživatel nesportuje – necháme jen výběr z chipů
    formState.sport = {
      level: 'none',
      futureMulti: formState.sport.futureMulti || [],
      // future: formState.sport.future || null
    };
  } 
  else if (lvl === 'sport') {
    // uživatel sportuje – vždy jen vlastní plán
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
   STEP 4 – DIETA & DISLIKES (s autoPremium logikou)
   ============================================================ */

// --- Pomocná funkce: zkontroluje, zda uživatel aktivoval prémiové volby ---
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

// --- Reset hodnot při přechodu zpět na standardní plán ---
function resetToStandardDefaults() {
  formState.nutrition ||= {};
  formState.nutrition.diet = 'none';
  formState.nutrition.dislikes = [];
  formState.nutrition.other_dislike = ''; // <- tohle může klidně zůstat, jen už se nikdy neplní

  // obnoví makra podle katalogu nebo výchozích hodnot
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

/* ===== Hlavní funkce kroku ===== */
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
        checkIfPremiumNeeded(); // ✅ po každé změně diety/repeats
      };
    });
  };

  // Dieta
  bindChipGroup('diet_group', formState.nutrition, 'diet');

  // Repeat (opakování jídel)
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

  // Dislikes (BEZ "Jiné")
  const selected = new Set(formState.nutrition.dislikes || []);
  const wrap = $('#dislikes');

  wrap?.querySelectorAll('.chip').forEach(btn => {
    const id = btn.dataset.id;
    if (selected.has(id)) btn.classList.add('selected');

    btn.onclick = () => {
      if (selected.has(id)) {
        selected.delete(id);
        btn.classList.remove('selected');
      } else {
        selected.add(id);
        btn.classList.add('selected');
      }

      formState.nutrition.dislikes = Array.from(selected);

      // žádná specialita pro "other", jen čistý seznam enumů
      updatePremiumNote();
      checkIfPremiumNeeded(); // ✅ po změně dislikes
    };
  });

  // žádný #other_dislike input, žádný other_dislike text

  // --- Premium poznámka ---
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
        note.textContent = t('step4.premium_note') || 'Tato volba je dostupná jen v Premium plánu.';
        const dislikesBlock = document.getElementById('dislikes_block');
        dislikesBlock?.insertAdjacentElement('afterend', note);
      }
    } else {
      note?.remove();
    }
  }

  updatePremiumNote();
  checkIfPremiumNeeded(); // ✅ zkontroluj hned po načtení
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
   STEP 5 – MAKRA + BALANCE (autoPremium + reset detekce)
   ============================================================ */

// --- Pomocná funkce: zjistí, zda makra odpovídají výchozím hodnotám ---
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
  checkIfPremiumNeeded(); // ✅ zkontroluje, jestli má být Premium
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

  // pokud uživatel nikdy neupravoval, nastavíme defaulty / katalog
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
    checkMacrosCustomized(); // ✅ kontrola, zda se makra liší od defaultů
    syncUI();
  };

  cEl?.addEventListener('input', () => onMacroChange('c', cEl));
  fEl?.addEventListener('input', () => onMacroChange('f', fEl));
  pEl?.addEventListener('input', () => onMacroChange('p', pEl));

  syncUI();
  checkMacrosCustomized(); // ✅ zkontroluj hned při načtení
}


/* ============================================================
   STEP 6 – PLAN SELECTION (autoPremium + reset logika)
   ============================================================ */

// Zjištění měny podle jazyka
function currentCurrency() {
  const lang = (i18n?.lang || 'cs').toLowerCase();
  return lang === 'cs' ? 'CZK' : 'EUR';
}

// Formátování ceny
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

// Dosazení cen do karet z data-atributů
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

// Výběr plánu a období
export function bindPlanStep() {
  populatePlanPriceData();
  const planCards = document.querySelectorAll('.plan-card--select');
  const planButtons = document.querySelectorAll('.plan-buttons .chip');
  const periodButtons = document.querySelectorAll('.plan-period .chip');
  const periodHelp = document.getElementById('periodHelp');

  // Slovník textů podle období
  const periodMap = {
    week: t('step7.help_week') || 'Vytvoříme ti jeden nutriční plán.',
    month: t('step7.help_month') || 'Vytvoříme ti 4 nutriční plány.'
  };

  // Výchozí stav
  window.formState ||= {};
  formState.plan ||= {};
  if (!formState.plan.variant) formState.plan.variant = 'standard';

  // Pokud má uživatel prémiové chování (např. dieta, dislikes, makra)
  if (formState.plan.autoPremium) {
    formState.plan.variant = 'premium';
  }

  // Kliknutí na kartu
  planCards.forEach(card => {
    card.addEventListener('click', () => {
      formState.plan.variant = card.dataset.variant;

      // ❌ NEresetuj hned teď, jen nastav variantu a obnov UI
      updateSelections();
    });
  });


  // Kliknutí na tlačítko varianty
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

  // Kliknutí na období
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

    // Help text podle zvoleného období
    if (periodHelp) {
      periodHelp.textContent = periodMap[formState.plan.period] || '';
    }

    // Aktualizace celkové ceny
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
   STEP 8 – REVIEW & PURCHASE (s kontrolou před vstupem)
   ============================================================ */

// === Pomocné funkce pro kontrolu ===
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

// --- Modal potvrzení při přechodu dál se Standardem ---
function showConfirmPremiumLoss() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-modal">
        <h3>${t('step7.standard_warning_title') || 'Změny se neprojeví ve Standard plánu'}</h3>
        <p>${t('step7.standard_warning_text') ||
          'Ve Standard plánu se neuloží vlastní dieta, výběr jídel ani úpravy makronutrientů. Chceš pokračovat i přesto?'}</p>
        <div class="confirm-actions">
          <button type="button" class="btn-secondary" id="confirmCancel">${t('common.back') || 'Zpět'}</button>
          <button type="button" class="btn-primary" id="confirmOk">${t('common.continue') || 'Pokračovat'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const clean = () => overlay.remove();
    overlay.querySelector('#confirmCancel').onclick = () => { clean(); resolve(false); };
    overlay.querySelector('#confirmOk').onclick = () => { clean(); resolve(true); };
  });
}

// --- Funkce, která se zavolá před přechodem na Step 7 ---
export async function beforeGoToStep7() {
  // 💡 počkáme, až se zvaliduje krok 6 (např. 100ms)
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

  const variantKey = plan?.variant ? `step7.${plan.variant}_title` : null;
  const periodKey  = plan?.period ? `step7.period_${plan.period}` : null;

  // --- energie + BMR ---
  const targetTxt = t('step2.target_' + goal?.target) || '—';
  const bmrKcal = goal?.bmr_override ?? goal?.bmr_kcal;
  let bmrVal = null;
  if (bmrKcal) {
    const unit = activeUnit();
    const val  = toActiveUnitFromKcal(bmrKcal);
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
    sportsSummary = `${t('step8.want_sport') || 'Zatím nesportuji'}`;

    if (sport.futureMulti?.length) {
      const futureSports = sport.futureMulti
        .map(id => t('step3.suggest_' + id) || id)
        .join(', ');

      sportsSummary += `<br>${t('step8.future_sport') || 'Láká mě'}: ${futureSports}`;
    }
  }

  else {
    // Sportuji – vždy vlastní plán (ownBlocks)
    // Podporujeme i staré hodnoty typu "recreational" atd. jako fallback.
    sportsSummary = '';

    if (sport.ownBlocks?.length) {
      sportsSummary = sport.ownBlocks.map(b => {
        const lbl = window._sportCatalog?.[b.sportId]?.labels?.[lang] || b.sportId;
        const intensityLabel = t('step3.intensity_' + b.intensity) || b.intensity;
        const intensityWord = t('step3.intensity') || 'Intenzita';

        return `${lbl}: ${b.sessions}×/týden, ${b.minutes} min, ${intensityLabel} ${intensityWord.toLowerCase()}`;
      }).join('<br>');
    }

    // hlavní sport (pokud existuje)
    const mainId = sport.mainSportOwn || sport.mainSportId;
    if (mainId) {
      const mainLbl = window._sportCatalog?.[mainId]?.labels?.[lang] || mainId;
      sportsSummary += `<br>${t('step8.main_sport') || t('step3.main_sport') || 'Hlavní sport'}: ${mainLbl}`;
    }
  }

  return {
    plan: `${variantKey ? t(variantKey) : '—'}`,
    // původně tu bylo: plan: `${variantKey ? t(variantKey) : '—'} · ${periodKey ? t(periodKey) : '—'}`,

    basic: `${t('step1.sex_' + profile.sex) || '?'} · ${profile.age || '?'} ${t('common.years') || 'let'} · ${profile.height_cm || '?'} cm · ${profile.weight_kg || '?'} kg`,
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
    macros: (() => {
      const c = nutrition?.macros?.c ?? '—';
      const f = nutrition?.macros?.f ?? '—';
      const p = nutrition?.macros?.p ?? '—';

      const carbLabel = t('step8.macros_carbs') || 'Sacharidy';
      const fatLabel = t('step8.macros_fats') || 'Tuky';
      const proteinLabel = t('step8.macros_proteins') || 'Bílkoviny';

      // vrací HTML – bez nadpisu, jen hodnoty pod sebou
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
    rev_macros: summary.macros    
  };

  for (const [id, text] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (id === 'rev_sports' || id === 'rev_macros') {
      el.innerHTML = text;   // 👈 umožní <br> a další HTML
    } else {
      el.textContent = text;
    }
  }


  // cena podle vybraného plánu + období
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

      // 🌀 spinner + překlad
      const sendingText = t("buttons.sending") || "Sending...";
      btn.innerHTML = `<span class="spinner"></span>${sendingText}`;

      try {        
        console.log("🗞️ Newsletter opt-in:", formState.customer.newsletter);

        await handlePurchase(); // tvoje funkce, která řeší nákup
      } catch (err) {
        console.error("❌ Chyba při nákupu:", err);
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }
    });
  }


    // --- 💸 Slevový kód ---
  const discountBtn = document.getElementById("apply-discount");
  if (discountBtn) {
    discountBtn.addEventListener("click", function() {
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

        // 💾 Uložit do stavu
        formState.plan.discount_code = code;
        formState.plan.discount_percent = discount;
        formState.plan.price.final = parseFloat(newPrice);
        formState.plan.price.currency = currentCurrency() === "EUR" ? "EUR" : "CZK";


        // 💬 Aktualizovat UI
        priceEl.textContent = isEur ? `€${newPrice}` : `${newPrice} Kč`;
        infoEl.textContent = `${t("step8.discount_applied") || "Slevový kód"}: ${code} (−${discount}%)`;
        errorEl.textContent = "";

        console.log("✅ Discount applied:", code, `-${discount}%`);
      } else {
        // ❌ Neplatný kód
        delete formState.plan.discount_code;
        delete formState.plan.discount_percent;
        delete formState.plan.price.final;

        errorEl.textContent = t("step7.discount_invalid") || "Neplatný slevový kód.";
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

  const SKIP_PAYMENT = true;

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
   🔧 NORMALIZACE BMR – uložit jen jeden klíč bmr_kcal
   ---------------------------------------------------- */
  if (formState.goal) {
    const finalBmr =
      formState.goal.bmr_override ??
      formState.goal.bmr_kcal ??
      formState.goal.bmrKcal ?? // fallback, kdyby někde zůstalo staré pole
      null;

    formState.goal.bmr_kcal = finalBmr;

    // uklidíme staré klíče
    delete formState.goal.bmr_override;
    delete formState.goal.bmrKcal;
  }

  // --- vytvoření čisté kopie pro uložení
  const cleanState = structuredClone(formState);
  if (cleanState.balance) delete cleanState.balance;

  const resp = await fetch("/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: cleanState.customer?.name,
      email: cleanState.customer?.email,
      locale: langParam,
      plan_variant: v,
      plan_period: p,

      // 👉 nové pole pro DB sloupec energy_unit
      energy_unit: cleanState.goal?.energy_unit || null,

      // 👉 nové pole pro DB sloupec bmr_kcal
      bmr_kcal: cleanState.goal?.bmr_kcal ?? null,

      // když už tam máš i další sloupce v modelu, můžeš posílat i ty:
      sex: cleanState.profile?.sex || null,
      age: cleanState.profile?.age ?? null,
      height_cm: cleanState.profile?.height_cm ?? null,
      weight_kg: cleanState.profile?.weight_kg ?? null,
      activity: cleanState.profile?.activity || null,

      // celý zbytek stavu zůstává v params
      params: cleanState,
    }),
  });


    const orderRes = await resp.json().catch(() => ({}));
    if (!orderRes?.order_id) throw new Error("Order creation failed");

    console.log("✅ Order created:", orderRes.order_id);

    // --- save to localStorage
    const formStateWithId = {
      ...formState,
      order_id: orderRes.order_id,
      locale: langParam
    };
    localStorage.setItem("formState", JSON.stringify(formStateWithId));

    if (SKIP_PAYMENT) {
      console.log("🧪 Payment skipped, redirecting to thanks.html");
      window.location.href = thanksUrl;
      return;
    }

    const payRes = await fetch("/payments/create", {
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
    console.group("❌ PURCHASE DEBUG");
    console.error("Chyba při vytváření objednávky:", err);
    console.groupEnd();

    alert("❌ Chyba při vytvoření objednávky – podívej se do konzole pro detaily!");
    window.location.href = failUrl;
  }
}

