export const QUALITY_KEY = 'yt-player-quality';
export const MAX_QUALITY = 4320;
export const ONE_YEAR_MS = 31536000000;

export function buildQualityRecord(now = Date.now()) {
  return {
    data: JSON.stringify({
      quality: MAX_QUALITY,
      previousQuality: MAX_QUALITY
    }),
    creation: now,
    expiration: now + ONE_YEAR_MS
  };
}

// True if the stored raw string already holds a max-quality, unexpired record.
export function isRecordCurrent(raw, now = Date.now()) {
  try {
    const rec = JSON.parse(raw);
    if (!rec || typeof rec.data !== 'string') return false;
    if (
      typeof rec.expiration !== 'number' ||
      rec.expiration - now < ONE_YEAR_MS / 2
    )
      return false;
    const inner = JSON.parse(rec.data);
    return (
      inner.quality === MAX_QUALITY && inner.previousQuality === MAX_QUALITY
    );
  } catch (err) {
    return false;
  }
}

export function applyForcedQuality(storage, now = Date.now()) {
  try {
    if (isRecordCurrent(storage.getItem(QUALITY_KEY), now)) return false;
    storage.setItem(QUALITY_KEY, JSON.stringify(buildQualityRecord(now)));
    return true;
  } catch (err) {
    return false;
  }
}
