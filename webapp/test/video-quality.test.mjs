import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQualityRecord,
  isRecordCurrent,
  applyForcedQuality,
  QUALITY_KEY,
  ONE_YEAR_MS
} from '../src/video-quality.mjs';

const memStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v)
  };
};

test('record shape', () => {
  const r = buildQualityRecord(1000);
  assert.equal(r.creation, 1000);
  assert.equal(r.expiration, 1000 + ONE_YEAR_MS);
  assert.deepEqual(JSON.parse(r.data), { quality: 4320, previousQuality: 4320 });
});

test('applyForcedQuality writes once, then is idempotent', () => {
  const s = memStorage();
  assert.equal(applyForcedQuality(s, 5), true);
  assert.ok(isRecordCurrent(s.getItem(QUALITY_KEY), 5));
  assert.equal(applyForcedQuality(s, 6), false);
});

test('overwrites lower quality, corrupt and near-expiry records', () => {
  const s = memStorage();
  s.setItem(
    QUALITY_KEY,
    JSON.stringify({
      data: JSON.stringify({ quality: 720, previousQuality: 720 }),
      expiration: 9e15
    })
  );
  assert.equal(applyForcedQuality(s, 5), true);
  s.setItem(QUALITY_KEY, '{bad');
  assert.equal(applyForcedQuality(s, 5), true);
  assert.equal(isRecordCurrent(s.getItem(QUALITY_KEY), 5 + ONE_YEAR_MS), false);
});

test('storage errors are swallowed', () => {
  const s = {
    getItem() {
      throw new Error('x');
    },
    setItem() {}
  };
  assert.equal(applyForcedQuality(s), false);
});
