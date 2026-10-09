import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatClock,
  detectHour12,
  msUntilNextMinute
} from '../src/clock-format.mjs';

test('24h formatting pads', () => {
  assert.equal(formatClock(new Date(2026, 0, 1, 7, 5)), '07:05');
  assert.equal(formatClock(new Date(2026, 0, 1, 23, 59)), '23:59');
  assert.equal(formatClock(new Date(2026, 0, 1, 0, 0)), '00:00');
});

test('12h formatting', () => {
  assert.equal(formatClock(new Date(2026, 0, 1, 0, 7), true), '12:07 AM');
  assert.equal(formatClock(new Date(2026, 0, 1, 12, 30), true), '12:30 PM');
  assert.equal(formatClock(new Date(2026, 0, 1, 15, 4), true), '3:04 PM');
});

test('detectHour12 falls back to 24h when Intl is missing or throws', () => {
  assert.equal(detectHour12('en-US', null), false);
  assert.equal(
    detectHour12('en-US', {
      DateTimeFormat: function () {
        throw new Error('x');
      }
    }),
    false
  );
});

test('detectHour12 uses resolvedOptions', () => {
  const mk = (o) => ({
    DateTimeFormat: function () {
      return { resolvedOptions: () => o };
    }
  });
  assert.equal(detectHour12('x', mk({ hour12: true })), true);
  assert.equal(detectHour12('x', mk({ hourCycle: 'h23' })), false);
});

test('msUntilNextMinute is the remainder of the minute', () => {
  const ms = msUntilNextMinute(new Date(2026, 0, 1, 1, 1, 30, 500));
  assert.ok(ms > 29000 && ms < 30000);
});
