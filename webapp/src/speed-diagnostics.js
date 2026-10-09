const MAX_ENTRIES = 14;
const MEDIA_EVENTS = [
  'ratechange', 'seeking', 'seeked', 'waiting', 'playing', 'pause', 'play',
  'stalled', 'loadstart', 'loadedmetadata', 'canplay', 'error', 'emptied'
];

export function speedLog(msg) {
  try {
    const buf = window.__ytafSpeedLog || (window.__ytafSpeedLog = []);
    buf.push({ t: Date.now(), msg: String(msg) });
    while (buf.length > MAX_ENTRIES) buf.shift();
  } catch (e) {
    // never throw
  }
}

try {
  window.__ytafSpeedLogPush = speedLog;
} catch (e) {
  // ignore
}

function describe(video, name) {
  let s = `${name} r=${video.playbackRate} t=${Number(video.currentTime).toFixed(1)} rs=${video.readyState} p=${video.paused ? 1 : 0}`;
  if (name === 'error') s += ` code=${video.error && video.error.code}`;
  return s;
}

function currentRate() {
  try {
    const v = document.querySelector('video');
    return v ? v.playbackRate : 1;
  } catch (e) {
    return 1;
  }
}

function wrapIsTypeSupported() {
  try {
    const MS = window.MediaSource;
    if (!MS || typeof MS.isTypeSupported !== 'function') return;
    const orig = MS.isTypeSupported;
    if (orig.__ytafDiagWrapped) return;
    const wrapped = function (type) {
      const result = orig.apply(this, arguments);
      try {
        const t = String(type);
        if ((t.indexOf('framerate=') >= 0 || t.indexOf('bitrate=') >= 0) && currentRate() !== 1) {
          speedLog(`ITS ${t.substring(0, 90)} ${result ? 'T' : 'F'}`);
        }
      } catch (e) {
        // ignore
      }
      return result;
    };
    wrapped.__ytafDiagWrapped = true;
    MS.isTypeSupported = wrapped;
  } catch (e) {
    // ignore
  }
}

export function startSpeedDiagnostics() {
  if (window.__ytafSpeedDiagStarted) return;
  window.__ytafSpeedDiagStarted = true;

  MEDIA_EVENTS.forEach((name) => {
    document.addEventListener(
      name,
      (evt) => {
        try {
          const v = evt.target;
          if (!v || v.tagName !== 'VIDEO') return;
          speedLog(describe(v, name));
          if (name === 'loadstart' || name === 'ratechange') wrapIsTypeSupported();
        } catch (e) {
          // ignore
        }
      },
      true
    );
  });

  wrapIsTypeSupported();
  window.setTimeout(wrapIsTypeSupported, 3000);
  speedLog('diag started');
}
