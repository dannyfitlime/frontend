const HERO_TITLE_INTERVAL_START_MS = 1000;
const HERO_TITLE_INTERVAL_END_MS = 600;
const HERO_TITLE_TRANSITION_MS = 140;

let isRegistered = false;

function clearHeroTitleTimers(title) {
  if (title._heroTitleTimer) {
    window.clearTimeout(title._heroTitleTimer);
    title._heroTitleTimer = null;
  }

  if (title._heroTitleSwapTimer) {
    window.clearTimeout(title._heroTitleSwapTimer);
    title._heroTitleSwapTimer = null;
  }
}

function getHeroTitleConfig(title) {
  const hero = window.__fitlimeI18n?.dict?.home?.hero || {};
  const fallbackTitle =
    hero.title ||
    title.getAttribute('data-hero-title-fallback') ||
    title.textContent.trim();

  const rotating = Array.isArray(hero.title_rotating)
    ? hero.title_rotating.filter((item) => typeof item === 'string' && item.trim())
    : [];

  return {
    fallbackTitle,
    staticText: typeof hero.title_static === 'string' ? hero.title_static.trim() : '',
    rotating,
    ariaLabel:
      (typeof hero.title_aria === 'string' && hero.title_aria.trim()) || fallbackTitle
  };
}

function renderStaticHeroTitle(title, text, ariaLabel) {
  title.classList.remove('hero-title--animated');
  title.setAttribute('aria-label', ariaLabel);
  title.textContent = text;
}

export function initHeroTitleAnimation() {
  const title = document.querySelector('[data-hero-title]');
  if (!title) return;

  clearHeroTitleTimers(title);

  const { fallbackTitle, staticText, rotating, ariaLabel } = getHeroTitleConfig(title);
  title.setAttribute('data-hero-title-fallback', fallbackTitle);

  if (!staticText || rotating.length === 0) {
    renderStaticHeroTitle(title, fallbackTitle, ariaLabel);
    return;
  }

  title.classList.add('hero-title--animated');
  title.setAttribute('aria-label', ariaLabel);
  title.innerHTML = `
    <span class="hero-title-fixed">${staticText}</span>
    <span class="hero-title-rotator" aria-hidden="true">
      <span class="hero-title-rotator-text is-current">${rotating[0]}</span>
      <span class="hero-title-rotator-text is-next"></span>
    </span>
  `;

  const rotator = title.querySelector('.hero-title-rotator');
  const currentText = title.querySelector('.hero-title-rotator-text.is-current');
  const nextText = title.querySelector('.hero-title-rotator-text.is-next');
  if (!rotator || !currentText || !nextText) return;

  rotator.style.height = `${currentText.offsetHeight}px`;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || rotating.length < 2) {
    currentText.textContent = rotating[rotating.length - 1];
    rotator.style.height = `${currentText.offsetHeight}px`;
    return;
  }

  let index = 0;
  const maxSteps = Math.max(rotating.length - 1, 1);
  const intervalStep = (HERO_TITLE_INTERVAL_START_MS - HERO_TITLE_INTERVAL_END_MS) / maxSteps;

  function scheduleNextSwap() {
    const nextDelay = Math.max(
      HERO_TITLE_INTERVAL_END_MS,
      Math.round(HERO_TITLE_INTERVAL_START_MS - index * intervalStep)
    );

    title._heroTitleTimer = window.setTimeout(runSwap, nextDelay);
  }

  function runSwap() {
    if (index >= rotating.length - 1) {
      clearHeroTitleTimers(title);
      return;
    }

    const nextIndex = index + 1;
    nextText.textContent = rotating[nextIndex];
    rotator.style.height = `${currentText.offsetHeight}px`;
    rotator.classList.add('is-animating');

    title._heroTitleSwapTimer = window.setTimeout(() => {
      index = nextIndex;
      rotator.classList.add('is-resetting');
      currentText.textContent = rotating[index];
      nextText.textContent = '';
      rotator.classList.remove('is-animating');
      void rotator.offsetHeight;
      rotator.classList.remove('is-resetting');
      rotator.style.height = `${currentText.offsetHeight}px`;

      if (index >= rotating.length - 1) {
        clearHeroTitleTimers(title);
      } else {
        scheduleNextSwap();
      }
    }, HERO_TITLE_TRANSITION_MS);
  }

  scheduleNextSwap();
}

export function registerHeroTitleAnimation() {
  if (isRegistered) return;
  isRegistered = true;

  window.addEventListener('fitlime:i18n-loaded', () => {
    window.setTimeout(() => initHeroTitleAnimation(), 0);
  });
}
