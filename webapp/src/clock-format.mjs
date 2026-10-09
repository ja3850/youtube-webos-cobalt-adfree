// Pure clock formatting. Intl is tried first but always falls back to Date.
function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

export function detectHour12(
  locale,
  intl = typeof Intl !== 'undefined' ? Intl : undefined
) {
  try {
    const fmt = new intl.DateTimeFormat(locale || undefined, {
      hour: 'numeric'
    });
    const opts = fmt.resolvedOptions();
    if (typeof opts.hour12 === 'boolean') return opts.hour12;
    if (opts.hourCycle)
      return opts.hourCycle === 'h12' || opts.hourCycle === 'h11';
  } catch (err) {
    // fall through
  }
  return false;
}

export function formatClock(date, hour12 = false) {
  const h = date.getHours();
  const m = pad2(date.getMinutes());
  if (!hour12) return pad2(h) + ':' + m;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ':' + m + (h < 12 ? ' AM' : ' PM');
}

export function msUntilNextMinute(date) {
  return (60 - date.getSeconds()) * 1000 - date.getMilliseconds() + 20;
}
