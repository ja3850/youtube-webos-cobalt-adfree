import { configRead } from './config.js';
import {
  detectHour12,
  formatClock,
  msUntilNextMinute
} from './clock-format.mjs';
import { applyForcedQuality } from './video-quality.mjs';

function onConfig(key, fn) {
  document.addEventListener('ytaf-config-changed', (evt) => {
    if (evt && evt.detail && evt.detail.key === key) {
      try {
        fn(evt.detail.value);
      } catch (err) {
        console.warn('[ytaf] live apply failed', key, err);
      }
    }
  });
}

// ---- Clock ----
let clockEl = null;
let clockTimer = null;
let hour12 = null;

function tickClock() {
  if (!clockEl) return;
  if (hour12 === null) {
    let locale;
    try {
      locale = navigator.language;
    } catch (e) {
      /* ignore */
    }
    hour12 = detectHour12(locale);
  }
  const now = new Date();
  clockEl.textContent = formatClock(now, hour12);
  // No reliable player-controls selector known: always shown.
  clockTimer = setTimeout(tickClock, msUntilNextMinute(now));
}

function setClock(enabled) {
  if (clockTimer) {
    clearTimeout(clockTimer);
    clockTimer = null;
  }
  if (!enabled) {
    if (clockEl && clockEl.parentNode) clockEl.parentNode.removeChild(clockEl);
    clockEl = null;
    return;
  }
  if (!clockEl) {
    clockEl = document.createElement('div');
    clockEl.className = 'ytaf-clock';
    clockEl.style.cssText =
      'position:fixed;top:20px;right:40px;z-index:2000;color:#fff;' +
      'font-size:28px;font-family:sans-serif;padding:4px 12px;' +
      'background-color:rgba(0,0,0,0.5);border-radius:6px;pointer-events:none;';
  }
  if (!clockEl.parentNode)
    (document.body || document.documentElement).appendChild(clockEl);
  tickClock();
}

// ---- Hide logo ----
let logoStyle = null;

function setHideLogo(enabled) {
  if (!enabled) {
    if (logoStyle && logoStyle.parentNode)
      logoStyle.parentNode.removeChild(logoStyle);
    logoStyle = null;
    return;
  }
  if (logoStyle) return;
  logoStyle = document.createElement('style');
  logoStyle.textContent =
    'ytlr-redux-connect-ytlr-logo-entity { visibility: hidden !important; }';
  (document.head || document.documentElement).appendChild(logoStyle);
}

// ---- Force max quality ----
let qualityActive = false;
let qualityTimer = null;
let lastSrc = null;

function writeQuality() {
  if (!qualityActive) return;
  try {
    applyForcedQuality(window.localStorage);
  } catch (e) {
    /* ignore */
  }
}

function onLoadStart(evt) {
  if (evt.target && evt.target.tagName === 'VIDEO') writeQuality();
}

function pollVideoChange() {
  const v = document.querySelector('video');
  const src = v ? v.currentSrc || v.src : null;
  if (src !== lastSrc) {
    lastSrc = src;
    writeQuality();
  }
}

function setForceQuality(enabled) {
  enabled = !!enabled;
  if (enabled === qualityActive) return;
  qualityActive = enabled;
  if (enabled) {
    writeQuality();
    document.addEventListener('loadstart', onLoadStart, true);
    window.addEventListener('hashchange', writeQuality);
    // Fallback for src changes the events miss; the write is idempotent.
    qualityTimer = setInterval(pollVideoChange, 3000);
  } else {
    document.removeEventListener('loadstart', onLoadStart, true);
    window.removeEventListener('hashchange', writeQuality);
    clearInterval(qualityTimer);
    qualityTimer = null;
  }
}

export function userScriptStartUiExtras() {
  const safe = (fn, v) => {
    try {
      fn(v);
    } catch (e) {
      console.warn('[ytaf] ui-extras', e);
    }
  };
  safe(setHideLogo, configRead('hideLogo'));
  safe(setForceQuality, configRead('forceHighResVideo'));
  safe(setClock, configRead('showClock'));
  onConfig('hideLogo', setHideLogo);
  onConfig('forceHighResVideo', setForceQuality);
  onConfig('showClock', setClock);
}
