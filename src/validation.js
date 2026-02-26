// frontend/src/validation.js

/* ===== Helpers ===== */
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const reqMsg   = (t)=> t?.('common.error_required') || 'This field is required.';
const numMsg   = (t)=> t?.('common.error_number')   || 'Enter a valid number.';

// Range message: replace {{min}} and {{max}} in the string, or use fallback
const rangeMsg = (t, min, max, key)=> {
  const tpl = key ? t?.(key) : t?.('common.error_range');
  if (tpl && typeof tpl === 'string') {
    return tpl.replace('{{min}}', min).replace('{{max}}', max);
  }
  return `Value must be between ${min} and ${max}.`;
};

// Conversions used by validation
function toKcal(kj) { return kj / 4.184; }
function toKJ(kcal) { return kcal * 4.184; }

/* ===== Profile ===== */
export function validateProfile(profile, t){
  const e = {};
  const p = profile || {};

  if (!p.sex) e['sex'] = reqMsg(t);

  if (p.age==null || p.age==='') e['age'] = reqMsg(t);
  else if (!Number.isInteger(+p.age)) e['age'] = numMsg(t);
  else if (p.age < 12 || p.age > 100) e['age'] = rangeMsg(t,12,100);

  if (p.height_cm==null || p.height_cm==='') e['height_cm'] = reqMsg(t);
  else if (!Number.isFinite(+p.height_cm)) e['height_cm'] = numMsg(t);
  else if (p.height_cm < 100 || p.height_cm > 230) e['height_cm'] = rangeMsg(t,100,230);

  if (p.weight_kg==null || p.weight_kg==='') e['weight_kg'] = reqMsg(t);
  else if (!Number.isFinite(+p.weight_kg)) e['weight_kg'] = numMsg(t);
  else if (p.weight_kg < 35 || p.weight_kg > 250) e['weight_kg'] = rangeMsg(t,35,250);

  if (!p.activity)     e['activity'] = reqMsg(t);
  if (!p.steps_bucket) e['steps_bucket'] = reqMsg(t);

  return e;
}


/* ===== Goal (step 2) ===== */
export const BMR_LIMITS = {
  kcal: { min: 900,  max: 3500 },
  kJ:   { min: 4000, max: 15000 }   // key "kJ" uses uppercase J
};

const UNIT_LABELS = {
  kcal: 'kcal',
  kJ:   'kJ'
};

export function validateGoal(goal, t) {
  const e = {};
  const g = goal || {};

  // 1) Target is required
  if (!g.target) {
    e['target'] = reqMsg(t);
  }

  // 2) BMR in kcal - prefer override, otherwise null
  let valKcal = g.bmr_override != null ? +g.bmr_override : null;

  // 3) Try to read from the input if the user manually changed it
  const input = document.getElementById('bmr_value');
  if (input) {
    const raw = input.value.trim();
    if (raw !== '') {
      const num = Number(raw.replace(',', '.'));
      if (Number.isFinite(num)) {
        const unitRaw = g.energy_unit || 'kcal';
        const unitNorm = (unitRaw && unitRaw.toLowerCase() === 'kj') ? 'kJ' : 'kcal';
        valKcal = (unitNorm === 'kJ') ? toKcal(num) : num;
      }
    }
  }

  // 4) If we have a BMR value, validate its range
  if (valKcal != null) {
    const unitRaw = g.energy_unit || 'kcal';
    const unit = (unitRaw && unitRaw.toLowerCase() === 'kj') ? 'kJ' : 'kcal';
    const limits = BMR_LIMITS[unit];
    const label  = UNIT_LABELS[unit];

    // Limits converted to kcal
    const minKcal = unit === 'kJ' ? toKcal(limits.min) : limits.min;
    const maxKcal = unit === 'kJ' ? toKcal(limits.max) : limits.max;

    if (valKcal < minKcal || valKcal > maxKcal) {
      e['bmr'] = `${rangeMsg(t, limits.min, limits.max)} [${label}]`;
    }
  } else if (!g.bmr_kcal && !g.bmr_override) {
    // No override and no bmr_kcal -> error
    e['bmr'] = reqMsg(t);
  }

  return e;
}


/* ===== Sport (step 3) ===== */
export function validateSport(sport, t){
  const e = {};
  const s = sport || {};

  if (!s.level){
    e['sport_level'] = reqMsg(t);
    return e;
  }

  // === CASE: user does not do sports (level = none) ===
  if (s.level === 'none'){
    const list = Array.isArray(s.futureMulti) ? s.futureMulti : [];

    // Must select at least 1 sport
    if (list.length === 0){
      e['future'] = reqMsg(t);
      return e;
    }

    // New: maximum 3 sports
    if (list.length > 3){
      e['future'] = t?.('step3.error_future_max3') || 'You can select up to 3 sports.';
      return e;
    }

    // If "other" is selected, text input is required
    if (list.includes('other') && !(s.future_text||'').trim()){
      e['future'] = reqMsg(t);
    }

    return e;
  }

  // === FROM HERE ON: user does sports (level = sport) ===

  if (!s.plan_choice){
    e['plan_choice'] = reqMsg(t);
    return e;
  }

  if (s.plan_choice === 'own') {
    const picked = Array.isArray(s.picked) ? s.picked : [];
    if (picked.length === 0) e['picked_own'] = reqMsg(t);
    if (picked.length > 0 && !s.mainSportId) e['mainSportId'] = reqMsg(t);

    const blocks = Array.isArray(s.ownBlocks) ? s.ownBlocks : [];
    if (blocks.length === 0) {
      e['ownBlocks'] = reqMsg(t);
    } else {
      let totalSessions = 0; // Total sessions across all selected sports

      blocks.forEach((b, i) => {
        // sportId must not be empty
        if (!b.sportId || b.sportId === '') {
          e[`picked_own_${i}`] = t?.('step3.error_select_sport') || 'Select a sport.';
        }

        // sessions
        if (b.sessions == null || b.sessions === '') {
          e[`sessions_per_week_${i}`] = reqMsg(t);
        } else if (!Number.isInteger(+b.sessions)) {
          e[`sessions_per_week_${i}`] = numMsg(t);
        } else if (b.sessions < 1 || b.sessions > 18) {
          e[`sessions_per_week_${i}`] = rangeMsg(t, 1, 18);
        } else {
          // If valid, add it to the total
          totalSessions += +b.sessions;
        }

        // minutes
        if (b.minutes == null || b.minutes === '') {
          e[`minutes_${i}`] = reqMsg(t);
        } else if (!Number.isInteger(+b.minutes)) {
          e[`minutes_${i}`] = numMsg(t);
        } else if (b.minutes < 15 || b.minutes > 300) {
          e[`minutes_${i}`] = rangeMsg(t, 15, 300);
        }

        // intensity
        if (!b.intensity) e[`intensity_${i}`] = reqMsg(t);
      });

            // New: global limit for sessions per week
      if (totalSessions > 18){
        e['sessions_total'] = t?.('step3.error_sessions_total') 
          || 'Total trainings per week cannot exceed 18.';

        // Also mark all session inputs as invalid
        // if they do not already have their own error
        blocks.forEach((b, i) => {
          const key = `sessions_per_week_${i}`;
          if (!e[key]) {
            e[key] = t?.('step3.error_sessions_total_field') 
              || 'Adjust the number of trainings (total max 18 per week).';
          }
        });
      }
    }
  }

  if (s.plan_choice === 'need_plan'){
    const picked = Array.isArray(s.picked) ? s.picked : [];
    if (picked.length === 0) e['picked_need'] = reqMsg(t);

    const h = s?.preferences?.hours_per_week;
    if (h == null || h === '') e['hours_per_week'] = reqMsg(t);
    else if (!Number.isFinite(+h)) e['hours_per_week'] = numMsg(t);
    else if (+h < 1 || +h > 40) e['hours_per_week'] = rangeMsg(t,1,40);

    if (picked.length > 0 && !s.mainSportId) e['mainSportId'] = reqMsg(t);
  }

  return e;
}


/* ===== Step 5 - Diet & Exclusions ===== */
export function validateDiet(nutrition, t){
  const e = {};
  const n = nutrition || {};
  const dislikes = Array.isArray(n.dislikes) ? n.dislikes : [];

  if (!n.diet){
    e['diet'] = reqMsg(t);
  }

  if (dislikes.length > 4){
    e['dislikes'] = t?.('step5.error_dislikes_max4') || 'You can select up to 4 items.';
  }

  return e;
}

/* ===== Step 4 - MACROS ===== */
export function validateMacros(nutrition, t){
  const e = {};
  const c = Number(nutrition?.macros?.c);
  const f = Number(nutrition?.macros?.f);
  const p = Number(nutrition?.macros?.p);

  function checkRange(val, min, max, key, labelKey){
    if (!Number.isFinite(val)) {
      e[key] = numMsg(t);
    } else if (val < min || val > max) {
      e[key] = rangeMsg(t, min, max, labelKey);
    }
  }

  checkRange(c,40,70,'macro_c','common.error_macro_c');
  checkRange(p,5,30,'macro_p','common.error_macro_p');
  checkRange(f,15,40,'macro_f','common.error_macro_f');

  if (Number.isFinite(c) && Number.isFinite(f) && Number.isFinite(p)){
    const sum = c + f + p;
    if (sum !== 100){
      e['macro_sum'] = t?.('common.error_macro_sum') || 'Macro total must be 100%.';
    }
  }

  return e;
}

/* ===== Step 6 - Menu settings ===== */
export function validateMenuSettings(nutrition, t){
  const e = {};
  const d = nutrition || {};

  // Validate meal repetition count selection
  if (!d.repeats || d.repeats === '' || d.repeats === 'none') {
    e['repeats'] = reqMsg(t);
  }

  // Validate grams display selection
  if (!d.show_grams || d.show_grams === '') {
    e['show_grams'] = reqMsg(t);
  }

  return e;
}

/* ===== Plan (step 7) ===== */
export function validatePlan(plan, t){
  const e = {};
  const p = plan || {};

  if (!p.variant) e['variant'] = reqMsg(t);
  if (!p.period)  e['period'] = reqMsg(t);

  return e;
}

/* ===== Review (step 8) ===== */
export function validateReview(state, t){
  const e = {};
  const name  = state?.customer?.name || '';
  const email = state?.customer?.email || '';
  const terms = !!state?.consents?.terms;
  const priv  = !!state?.consents?.privacy;

  if (!name.trim())  e['customer_name']  = reqMsg(t);
  if (!email.trim()) e['customer_email'] = reqMsg(t);
  else if (!emailRe.test(email)) e['customer_email'] = t?.('common.error_email') || 'Enter a valid email.';

  if (!terms) e['consent_terms']   = reqMsg(t);
  if (!priv)  e['consent_privacy'] = reqMsg(t);

  return e;
}

