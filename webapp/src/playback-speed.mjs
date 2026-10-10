// Pure helpers for playback speed handling (no DOM access).

export const MIN_RATE = 0.1;
export const MAX_RATE = 2;
export const MAX_NATIVE_FRAMERATE = 60;
const FRAMERATE_TOLERANCE = 0.5;
// Hardware decode budget (pixels per second): 4K at 60 fps.
export const MAX_DECODE_PIXEL_RATE = 3840 * 2160 * 60;

function readDimension(type, name) {
  const m = new RegExp(
    ';\\s*' + name + '\\s*=\\s*"?([0-9]+(?:\\.[0-9]+)?)"?',
    'i'
  ).exec(type);
  return m ? Number(m[1]) : NaN;
}

export const STANDARD_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
export const FINE_RATES = [
  0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2
];

export function getRateSteps(mode) {
  return mode === 'fine' ? FINE_RATES : STANDARD_RATES;
}

export function clampRate(rate) {
  const value = Number(rate);
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_RATE, Math.max(MIN_RATE, value));
}

/**
 * Returns the next rate for direction +1 / -1, or the (clamped) current rate
 * when there is no further step in that direction.
 */
export function getNextPlaybackRate(currentRate, direction, mode) {
  const steps = getRateSteps(mode);
  const current = clampRate(currentRate);
  const epsilon = 0.01;

  if (direction > 0) {
    for (let i = 0; i < steps.length; i += 1) {
      if (steps[i] > current + epsilon) return steps[i];
    }
  } else if (direction < 0) {
    for (let i = steps.length - 1; i >= 0; i -= 1) {
      if (steps[i] < current - epsilon) return steps[i];
    }
  }

  return current;
}

/**
 * Rewrites a media MIME type probe so that rate-scaled values from YouTube
 * are acceptable to Cobalt. Returns the input unchanged when no rule applies.
 */
export function rewriteMediaMimeType(type, playbackRate) {
  if (typeof type !== 'string' || type.indexOf(';') === -1) return type;

  const rate = Number(playbackRate);
  let changed = false;
  const width = readDimension(type, 'width');
  const height = readDimension(type, 'height');
  const hasDims = Number.isFinite(width) && Number.isFinite(height);

  const out = type.replace(
    /(;\s*)(bitrate|framerate)\s*=\s*("?)([0-9]+(?:\.[0-9]+)?)\3/gi,
    (match, sep, name, quote, num) => {
      const key = name.toLowerCase();
      const value = Number(num);
      if (!Number.isFinite(value)) return match;

      if (key === 'bitrate') {
        if (num.indexOf('.') === -1) return match;
        changed = true;
        return sep + name + '=' + quote + Math.round(value) + quote;
      }

      if (
        value > MAX_NATIVE_FRAMERATE &&
        Number.isFinite(rate) &&
        rate > 1 &&
        value / rate <= MAX_NATIVE_FRAMERATE + FRAMERATE_TOLERANCE &&
        !(hasDims && width * height * value > MAX_DECODE_PIXEL_RATE)
      ) {
        changed = true;
        return sep + name + '=' + quote + Math.round(value / rate) + quote;
      }
      return match;
    }
  );

  return changed ? out : type;
}

/** Whether a same-position seek should be done after a rate change. */
export function shouldResyncOnRateChange(state) {
  if (!state) return false;
  return Boolean(
    !state.paused && !state.ended && !state.seeking && state.readyState >= 2
  );
}
