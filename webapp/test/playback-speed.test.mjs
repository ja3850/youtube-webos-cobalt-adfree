import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNextPlaybackRate,
  getRateSteps,
  MAX_DECODE_PIXEL_RATE,
  rewriteMediaMimeType as rw,
  shouldResyncOnRateChange
} from '../src/playback-speed.mjs';

const vp9 = (extra) => `video/webm; codecs="vp9"; ${extra}`;

test('rounds fractional bitrate', () => {
  assert.equal(
    rw('video/mp4; codecs="avc1.640028"; bitrate=4241906.25', 1.25),
    'video/mp4; codecs="avc1.640028"; bitrate=4241906'
  );
  assert.equal(rw(vp9('bitrate=100.5'), 1), vp9('bitrate=101'));
  assert.equal(rw(vp9('bitrate=100'), 1), vp9('bitrate=100'));
});

test('framerate rewrite when scaled by rate', () => {
  assert.equal(rw(vp9('framerate=62.5'), 1.25), vp9('framerate=50'));
  assert.equal(rw(vp9('framerate=75'), 1.25), vp9('framerate=60'));
  assert.equal(rw(vp9('framerate=120'), 2), vp9('framerate=60'));
  assert.equal(
    rw(vp9('width=1920; height=1080; framerate=90; bitrate=1000.4'), 1.5),
    vp9('width=1920; height=1080; framerate=60; bitrate=1000')
  );
});

test('unchanged at 1x and for rates <= 1', () => {
  assert.equal(rw(vp9('framerate=120'), 1), vp9('framerate=120'));
  assert.equal(rw(vp9('framerate=75'), 0.5), vp9('framerate=75'));
  assert.equal(rw(vp9('framerate=60'), 2), vp9('framerate=60'));
});

test('conformance negatives stay rejected', () => {
  for (const rate of [1, 1.25, 1.5, 2]) {
    assert.equal(rw(vp9('framerate=9999'), rate), vp9('framerate=9999'));
    assert.equal(rw(vp9('width=99999'), rate), vp9('width=99999'));
    assert.equal(
      rw(vp9('bitrate=999999999999'), rate),
      vp9('bitrate=999999999999')
    );
  }
  assert.equal(rw(vp9('framerate=130'), 2), vp9('framerate=130'));
  assert.equal(rw(vp9('framerate=125'), 2), vp9('framerate=125'));
});

test('non-mime / invalid input is untouched', () => {
  assert.equal(rw('video/mp4', 2), 'video/mp4');
  assert.equal(rw(undefined, 2), undefined);
  assert.equal(rw(vp9('framerate=75'), NaN), vp9('framerate=75'));
});

test('standard steps', () => {
  assert.equal(getNextPlaybackRate(1, 1, 'standard'), 1.25);
  assert.equal(getNextPlaybackRate(1, -1, 'standard'), 0.75);
  assert.equal(getNextPlaybackRate(2, 1, 'standard'), 2);
  assert.equal(getNextPlaybackRate(0.25, -1, 'standard'), 0.25);
  assert.equal(getNextPlaybackRate(1.1, 1, 'standard'), 1.25);
  assert.equal(getNextPlaybackRate(1.1, -1, 'standard'), 1);
});

test('fine steps', () => {
  assert.equal(getNextPlaybackRate(1, 1, 'fine'), 1.1);
  assert.equal(getNextPlaybackRate(1.1, 1, 'fine'), 1.2);
  assert.equal(getNextPlaybackRate(0.5, -1, 'fine'), 0.5);
  assert.equal(getNextPlaybackRate(0.25, 1, 'fine'), 0.5);
  assert.equal(getNextPlaybackRate(1.9, 1, 'fine'), 2);
  assert.equal(getNextPlaybackRate(2, 1, 'fine'), 2);
  assert.ok(getRateSteps('fine').every((r) => r >= 0.1 && r <= 2));
});

test('clamps to native 0.1-2 range', () => {
  assert.equal(getNextPlaybackRate(3, 1, 'standard'), 2);
  assert.equal(getNextPlaybackRate(0.01, -1, 'standard'), 0.1);
  assert.equal(getNextPlaybackRate(NaN, 1, 'standard'), 1.25);
});

test('resync guard', () => {
  const ok = { paused: false, ended: false, seeking: false, readyState: 4 };
  assert.equal(shouldResyncOnRateChange(ok), true);
  assert.equal(shouldResyncOnRateChange({ ...ok, paused: true }), false);
  assert.equal(shouldResyncOnRateChange({ ...ok, seeking: true }), false);
  assert.equal(shouldResyncOnRateChange({ ...ok, readyState: 1 }), false);
  assert.equal(shouldResyncOnRateChange({ ...ok, ended: true }), false);
  assert.equal(shouldResyncOnRateChange(null), false);
});

test('framerate rewrite respects decode budget', () => {
  assert.equal(MAX_DECODE_PIXEL_RATE, 3840 * 2160 * 60);
  const t4k = vp9('width=3840; height=2160; framerate=90');
  assert.equal(rw(t4k, 1.5), t4k);
  assert.equal(
    rw(vp9('width=2560; height=1440; framerate=90'), 1.5),
    vp9('width=2560; height=1440; framerate=60')
  );
  assert.equal(
    rw(vp9('width=1920; height=1080; framerate=120'), 2),
    vp9('width=1920; height=1080; framerate=60')
  );
  assert.equal(
    rw(vp9('framerate=90; width=2560; height=1440'), 1.5),
    vp9('framerate=60; width=2560; height=1440')
  );
  const q = vp9('framerate="90"; width="3840"; height="2160"');
  assert.equal(rw(q, 1.5), q);
  assert.equal(
    rw(vp9('framerate="90"; width="2560"; height="1440"'), 1.5),
    vp9('framerate="60"; width="2560"; height="1440"')
  );
});
