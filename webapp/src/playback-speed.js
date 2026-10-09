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
// Upper bound for one pause -> seek -> play cycle before the latch is released
// and playback is resumed regardless.
const RESYNC_SEEK_TIMEOUT_MS = 4000;
const RESYNC_RESUME_DELAY_MS = 150;

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

  // The Starfish pipeline freezes when SetPlayRate reaches a session that is
  // already playing, but accepts a new rate applied before Play() (as on a
  // fresh video start). Recreate that order: pause, seek to the current
  // position so the native session is rebuilt while paused (it applies the
  // stored rate once loaded), then resume after the seek completes.
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
    let finished = false;
    let fallbackTimer = null;

    const finish = (reason) => {
      if (finished) return;
      finished = true;
      video.removeEventListener('seeked', onSeeked, true);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      setTimeout(() => {
        try {
          const played = video.play();
          if (played && typeof played.catch === 'function') {
            played.catch((err) => speedLog('resync play() rejected ' + err));
          }
        } catch (err) {
          speedLog('resync play() threw ' + err);
        }
        speedLog('resync resume (' + reason + ')');
        lastResyncAt = Date.now();
        resyncing = false;
      }, RESYNC_RESUME_DELAY_MS);
    };
    const onSeeked = () => finish('seeked');

    try {
      video.pause();
      const target = Math.max(0, Number(video.currentTime) - 0.05);
      video.addEventListener('seeked', onSeeked, true);
      fallbackTimer = setTimeout(() => finish('timeout'), RESYNC_SEEK_TIMEOUT_MS);
      speedLog('resync pause+seek r=' + lastResyncRate + ' to=' + target.toFixed(2));
      video.currentTime = target;
    } catch (err) {
      speedLog('resync failed ' + err);
      finish('error');
    }
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
  document.addEventListener('loadedmetadata', applyRememberedRate, true);
}
