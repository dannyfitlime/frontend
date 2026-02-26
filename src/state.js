// state.js

// ===== TOVÁRNA NA NOVÝ STAV (NIC NESDÍLÍ REFERENCE) =====
export function createInitialState() {
  return {
    // Locale pro i18n
    locale: 'cs',

    // ===== STEP 1 – PROFIL =====
    profile: {
      sex: null,
      age: null,
      height_cm: null,
      weight_kg: null,
      activity: null,
      steps_bucket: null,
    },

    // ===== STEP 2 – GOAL & BMR =====
    goal: {
      target: null,
      bmr_kcal: null,
      bmr_override: null,

      // ✅ DEFAULTNÍ JEDNOTKA = KCAL (snake_case)
      energy_unit: 'kcal'
    },

    // ===== STEP 3 – SPORT =====
    sport: {
      level: 'sport',
      plan_choice: null,

      picked: [],
      mainSportId: null,

      // vlastní plán
      ownBlocks: [],
      pickedOwn: [],
      mainSportOwn: null,

      // potřebuji plán
      pickedNeed: [],
      mainSportNeed: null,
      preferences: {
        hours_per_week: null,
        groups: []
      },

      // agregace pro první blok
      sessions_per_week: null,
      minutes: null,
      intensity: 'medium',

      // chci teprve začít
      futureMulti: [],
      future: null,
      future_text: ''
    },

    // ===== STEP 5+6 – NUTRICE =====
    nutrition: {
      diet: 'no_restrictions',
      dislikes: [],
      other_dislike: '',
      repeats: '2',
      show_grams: null,
      macros: { c: 55, f: 25, p: 20 },
      _customized: false
    },

    // ===== STEP 7 – PLÁN =====
    plan: {
      variant: 'standard',
      period: 'week',
      autoPremium: false,

      price: null,
      discount_code: null,
      discount_percent: null
    },

    // ===== STEP 8 – ZÁKAZNÍK + SOUHLASY =====
    customer: {
      name: '',
      email: '',
      newsletter: false
    },

    consents: {
      terms: false,
      privacy: false
    }
  };
}

// ===== NEZMĚNITELNÝ VZOREK (jen pro debug) =====
export const initialState = Object.freeze(createInitialState());

// ===== GLOBÁLNÍ ŽIVÝ STAV APPKY =====
export const formState = createInitialState();

// ===== RESET STAVU =====
export function resetFormState() {
  const fresh = createInitialState();

  // smažeme současné klíče
  for (const k of Object.keys(formState)) {
    delete formState[k];
  }

  // nakopírujeme čistý stav
  Object.assign(formState, fresh);
}

// ===== HYDRATACE STAVU (pokud načteš uložený state) =====
export function hydrateFormState(saved) {
  if (!saved || typeof saved !== 'object') return;

  // profil
  if (saved.profile) {
    formState.profile = { ...formState.profile, ...saved.profile };
  }

  // goal – načteme rovnou nový formát
  if (saved.goal) {
    const normalizedGoal = { ...saved.goal };

    // jistota: kdyby se náhodou objevilo energyUnit, zahodíme ho
    delete normalizedGoal.energyUnit;

    formState.goal = { ...formState.goal, ...normalizedGoal };
  }


  // sport
  if (saved.sport) {
    formState.sport = { ...formState.sport, ...saved.sport };
  }

  // nutriční volby
  if (saved.nutrition) {
    formState.nutrition = { ...formState.nutrition, ...saved.nutrition };
    if (formState.nutrition.diet === 'none') {
      formState.nutrition.diet = 'no_restrictions';
    }
  }

  // plán
  if (saved.plan) {
    formState.plan = { ...formState.plan, ...saved.plan };
  }

  // zákazník
  if (saved.customer) {
    formState.customer = { ...formState.customer, ...saved.customer };
  }

  // souhlasy
  if (saved.consents) {
    formState.consents = { ...formState.consents, ...saved.consents };
  }

  if (saved.locale) {
    formState.locale = saved.locale;
  }
}
