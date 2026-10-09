// Pure JSON response filters (webosbrew parity). Each function mutates the
// parsed response in place, returns true when it changed something and never
// throws. Callers gate them on their config key.

const MAX_DEPTH = 32;

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// ---- Remove end screens (legacy remove-endscreen.ts / NB removeEndcards) ----

function dropEndscreen(holder) {
  if (
    isObject(holder) &&
    isObject(holder.endscreen) &&
    'endscreenRenderer' in holder.endscreen
  ) {
    delete holder.endscreen;
    return true;
  }
  return false;
}

export function stripEndscreen(value) {
  try {
    if (!isObject(value)) return false;
    let changed = dropEndscreen(value);
    changed = dropEndscreen(value.playerResponse) || changed;
    return changed;
  } catch (error) {
    return false;
  }
}

// ---- JSON thumbnail upgrade (legacy thumbnail-quality.ts, JSON only) ----

// Only the regular i.ytimg.com host: A/B hosts (i1..i9) are left alone.
const THUMBNAIL_URL_RE =
  /^((?:https?:)?\/\/i\.ytimg\.com\/)vi(?:_webp)?\/([\w-]+)\/(?:hq|mq)?default\.(?:jpg|webp)(?:\?.*)?$/;

export function upgradeThumbnailUrl(url) {
  if (typeof url !== 'string') return null;
  const match = THUMBNAIL_URL_RE.exec(url);
  if (!match) return null;
  // Drop the query: sqp/rs signatures belong to the original crop/file.
  return match[1] + 'vi/' + match[2] + '/sddefault.jpg';
}

export function upgradeThumbnails(value, depth = 0) {
  try {
    if (!value || typeof value !== 'object' || depth > MAX_DEPTH) return false;

    let changed = false;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        changed = upgradeThumbnails(value[i], depth + 1) || changed;
      }
      return changed;
    }

    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const child = value[key];
      if (key === 'thumbnails' && Array.isArray(child)) {
        for (let j = 0; j < child.length; j += 1) {
          const entry = child[j];
          if (isObject(entry)) {
            const upgraded = upgradeThumbnailUrl(entry.url);
            if (upgraded) {
              entry.url = upgraded;
              changed = true;
            }
          }
        }
      } else if (child && typeof child === 'object') {
        changed = upgradeThumbnails(child, depth + 1) || changed;
      }
    }
    return changed;
  } catch (error) {
    return false;
  }
}

// ---- Guest mode: hide sign-in prompts (NB hasGuestPromptRenderer) ----

const GUEST_PROMPT_RENDERERS = ['feedNudgeRenderer', 'alertWithActionsRenderer'];
const GUEST_PROMPT_TEXT = 'Sign in for better recommendations';

export function isGuestPromptEntry(item) {
  if (!isObject(item)) return false;
  if (GUEST_PROMPT_RENDERERS.some((key) => item[key])) return true;
  return item.gridButtonRenderer?.title?.runs?.[0]?.text === GUEST_PROMPT_TEXT;
}

export function stripGuestSignInPrompts(value, depth = 0) {
  try {
    if (!value || typeof value !== 'object' || depth > MAX_DEPTH) return false;

    let changed = false;
    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i -= 1) {
        if (isGuestPromptEntry(value[i])) {
          value.splice(i, 1);
          changed = true;
        } else {
          changed = stripGuestSignInPrompts(value[i], depth + 1) || changed;
        }
      }
      return changed;
    }

    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i += 1) {
      const child = value[keys[i]];
      if (child && typeof child === 'object') {
        changed = stripGuestSignInPrompts(child, depth + 1) || changed;
      }
    }
    return changed;
  } catch (error) {
    return false;
  }
}

// ---- Dispatcher used by the JSON.parse hook ----

export function applyJsonLayerFilters(value, flags) {
  try {
    if (!value || typeof value !== 'object' || !flags) return false;
    let changed = false;
    if (flags.removeEndscreen) changed = stripEndscreen(value) || changed;
    if (flags.upgradeThumbnails) changed = upgradeThumbnails(value) || changed;
    if (flags.hideGuestSignInPrompts) {
      changed = stripGuestSignInPrompts(value) || changed;
    }
    return changed;
  } catch (error) {
    return false;
  }
}
