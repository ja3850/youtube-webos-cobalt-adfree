import { configRead, configWrite } from './config.js';
import {
  clampRate,
  rewriteMediaMimeType,
  shouldResyncOnRateChange
} from './playback-speed.mjs';

function currentVideoRate() {
  try {
    const video = document.querySelector('video');
    const rate = video ? Number(video.playbackRate) : 1;
    return Number.isFinite(rate) && rate > 0 ? rate : 1;
  } catch (err) {
    return 1;
  }
}

function wrapProbe(owner, name) {
  if (!owner || typeof owner[name] !== 'function') return;
  const original = owner[name];
  if (original.__ytafSpeedWrapped) return;

  const wrapped = function (type) {
    let rewritten = type;
    try {
      rewritten = rewriteMediaMimeType(type, currentVideoRate());
    } catch (err) {
      rewritten = type;
    }
    const args = Array.prototype.slice.call(arguments);
    args[0] = rewritten;
    return original.apply(this, args);
  };
  wrapped.__ytafSpeedWrapped = true;
  owner[name] = wrapped;
}

/** Idempotent; safe to call from both the preload and the main script. */
export function installCapabilityProbeFix() {
  try {
    if (typeof window.MediaSource === 'function') {
      wrapProbe(window.MediaSource, 'isTypeSupported');
    }
    if (typeof window.HTMLMediaElement === 'function') {
      wrapProbe(window.HTMLMediaElement.prototype, 'canPlayType');
    }
  } catch (err) {
    console.warn('[ytaf speed] probe fix failed', err);
  }
}

const RESYNC_DEBOUNCE_MS = 300;
const RESYNC_SELF_IGNORE_MS = 1500;
// Upper bound before the resync latch is released without a 'seeked' event.
const RESYNC_SEEK_TIMEOUT_MS = 4000;

function speedLog(msg) {
  try {
    if (typeof window.__ytafSpeedLogPush === 'function') {
      window.__ytafSpeedLogPush(msg);
    }
  } catch (err) {
    /* diagnostics must never affect playback */
  }
}

export function userScriptStartPlaybackSpeed() {
  if (window.__ytafPlaybackSpeedStarted) return;
  window.__ytafPlaybackSpeedStarted = true;

  installCapabilityProbeFix();

  let resyncTimer = null;
  let resyncing = false;
  let lastResyncAt = 0;
  let lastResyncRate = 0;
  let appliedForSource = null;
  const resyncedSources = new Map();

  // Changing playbackRate on a playing Starfish video freezes the hardware
  // pipeline. A single same-position seek shortly after recovers it.
  function doResync(video) {
    resyncTimer = null;
    if (!configRead('speedResyncOnChange')) return;
    if (resyncing) return;
    if (!shouldResyncOnRateChange(video)) {
      speedLog('resync skipped (paused/seeking/not ready)');
      return;
    }

    resyncing = true;
    lastResyncAt = Date.now();
    lastResyncRate = Number(video.playbackRate);
    resyncedSources.set(sourceOf(video), lastResyncRate);
    let fallbackTimer = null;

    const release = (reason) => {
      video.removeEventListener('seeked', onSeeked, true);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      lastResyncAt = Date.now();
      resyncing = false;
      speedLog('resync done (' + reason + ')');
    };
    const onSeeked = () => release('seeked');

    try {
      video.addEventListener('seeked', onSeeked, true);
      fallbackTimer = setTimeout(() => release('timeout'), RESYNC_SEEK_TIMEOUT_MS);
      speedLog('resync seek r=' + lastResyncRate);
      video.currentTime = video.currentTime;
    } catch (err) {
      speedLog('resync failed ' + err);
      release('error');
    }
  }

  function sourceOf(video) {
    return video.currentSrc || video.src || '';
  }

  // A video that starts at rate != 1 freezes as well (readyState < 2 skips
  // the ratechange resync), so resync once per source+rate on 'playing'.
  function onPlaying(evt) {
    const video = evt.target;
    if (!video || video.tagName !== 'VIDEO') return;
    if (!configRead('speedResyncOnChange')) return;
    if (resyncing) return;
    const rate = Number(video.playbackRate);
    if (!(Math.abs(rate - 1) > 0.001)) return;
    const source = sourceOf(video);
    if (resyncedSources.get(source) === rate) return;
    if (resyncTimer) clearTimeout(resyncTimer);
    speedLog('start-of-playback resync scheduled r=' + rate);
    resyncTimer = setTimeout(() => doResync(video), RESYNC_DEBOUNCE_MS);
  }

  function onRateChange(evt) {
    const video = evt.target;
    if (!video || video.tagName !== 'VIDEO') return;

    if (
      configRead('rememberPlaybackRate') &&
      video.readyState >= 2 &&
      !video.seeking
    ) {
      const rate = clampRate(video.playbackRate);
      if (rate !== configRead('lastPlaybackRate')) {
        configWrite('lastPlaybackRate', rate);
      }
    }

    if (!configRead('speedResyncOnChange')) return;
    // Our own seek must never trigger another resync.
    if (resyncing) return;
    if (
      Date.now() - lastResyncAt < RESYNC_SELF_IGNORE_MS &&
      Number(video.playbackRate) === lastResyncRate
    ) {
      return;
    }

    if (resyncTimer) clearTimeout(resyncTimer);
    resyncTimer = setTimeout(() => doResync(video), RESYNC_DEBOUNCE_MS);
  }

  function applyRememberedRate(evt) {
    const video = evt.target;
    if (!video || video.tagName !== 'VIDEO') return;
    if (!configRead('rememberPlaybackRate')) return;

    const source = video.currentSrc || video.src || '';
    if (source && source === appliedForSource) return;
    appliedForSource = source;

    const saved = Number(configRead('lastPlaybackRate'));
    if (!Number.isFinite(saved) || saved === 1) return;
    const rate = clampRate(saved);
    if (Math.abs(Number(video.playbackRate) - rate) > 0.001) {
      video.playbackRate = rate;
    }
  }

  // Media events do not bubble; capture on document covers replaced <video>s.
  document.addEventListener('ratechange', onRateChange, true);
  document.addEventListener('playing', onPlaying, true);
  document.addEventListener('loadedmetadata', applyRememberedRate, true);
}
