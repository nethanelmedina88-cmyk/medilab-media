/* @jsxRuntime classic */
/* ^ keep classic JSX (React.createElement) — we load React via global <script>, not as a module,
   so the automatic runtime's `import "react/jsx-runtime"` would crash the in-browser Babel build. */
/* SHLIFIM v3 — design-system refactor (was v2 Modern + Brand Spark). Logic: window.SL. Data: window.GLOSSARY/TOPICS. Auth/sync: Firebase. */
const {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback
} = React;
const GLOSSARY = window.GLOSSARY || [];
const TOPICS = window.TOPICS || [];
const TBK = window.TOPIC_BY_KEY || {};
const ACH = window.ACHIEVEMENTS || [];
const Snd = window.SLSound || {
  success() {},
  wrong() {},
  ding() {},
  pop() {},
  fanfare() {},
  setMuted() {},
  isMuted() {
    return false;
  }
};
const Speak = window.SLSpeak || function () {};
// Free-tier audio gate: App keeps these in sync with the current tier (see the effect in App).
let _audioLocked = false,
  _onAudioLock = null;
function Speak2(k, s) {
  if (_audioLocked) {
    if (_onAudioLock) _onAudioLock();
    return;
  }
  Speak(k, s);
}
const maps = SL.buildAliasMaps(GLOSSARY);
const searchIndex = SL.buildSearchIndex(GLOSSARY);
const HEB = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'];
const TOTAL = GLOSSARY.length;
const topicTotals = function () {
  const m = {};
  GLOSSARY.forEach(t => {
    if (t.topic) m[t.topic] = (m[t.topic] || 0) + 1;
  });
  return m;
}();
const topicOf = function () {
  const m = {};
  GLOSSARY.forEach(t => {
    m[t.hebrew] = t.topic;
  });
  return m;
}();
function metrics(studied, favorites, stats) {
  const done = {};
  studied.forEach(h => {
    const tk = topicOf[h];
    if (tk) done[tk] = (done[tk] || 0) + 1;
  });
  const topicDone = {};
  let tc = 0;
  TOPICS.forEach(t => {
    const tot = topicTotals[t.key] || 0;
    const d = done[t.key] || 0;
    const c = tot > 0 && d >= tot;
    topicDone[t.key] = c;
    if (c) tc++;
  });
  const answered = stats.answered || 0,
    correct = stats.correct || 0;
  return {
    studied: studied.length,
    hard: favorites.length,
    dayStreak: stats.dayStreak || 0,
    maxDayStreak: stats.maxDayStreak || 0,
    answered,
    correct,
    accuracy: answered ? correct / answered : 0,
    quizzes: stats.quizzes || 0,
    perfect: stats.perfect || 0,
    topicsCompleted: tc,
    topicDone,
    usedDark: !!stats.usedDark,
    cwSolved: stats.cwSolved || 0
  };
}
// Goal-gradient: always show a NEAR target instead of the distant total, so the bar
// never reads "0 / 464". Milestones are real thresholds — nothing is faked.
const MILESTONES = [10, 25, 50, 100, 150, 200, 300];
function nextGoal(n, total) {
  for (let i = 0; i < MILESTONES.length; i++) {
    if (n < MILESTONES[i] && MILESTONES[i] < total) return MILESTONES[i];
  }
  return total;
}
const earnedIds = m => ACH.filter(a => {
  try {
    return a.check(m);
  } catch (e) {
    return false;
  }
}).map(a => a.id);
const uniq = arr => Array.from(new Set(arr));
const fmtSec = s => Math.floor(s / 60) + ':' + ('0' + Math.round(s) % 60).slice(-2);
const IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '') || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
const IS_STANDALONE = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
// merge cloud stats into local WITHOUT clobbering progress: counters only grow, and the
// most-recently-visited side keeps its day-streak (local mount may have advanced today's).
function mergeStats(local, cloud) {
  local = local || {};
  if (!cloud) return local;
  const out = {
    ...local,
    ...cloud
  };
  ['answered', 'correct', 'quizzes', 'perfect', 'maxDayStreak'].forEach(k => {
    out[k] = Math.max(local[k] || 0, cloud[k] || 0);
  });
  out.usedDark = !!(local.usedDark || cloud.usedDark);
  const ll = local.lastVisit || '',
    cl = cloud.lastVisit || '';
  if (ll >= cl) {
    out.lastVisit = ll || cl;
    out.dayStreak = local.dayStreak || cloud.dayStreak || 0;
  } else {
    out.lastVisit = cl;
    out.dayStreak = cloud.dayStreak || 0;
  }
  out.maxDayStreak = Math.max(out.maxDayStreak || 0, out.dayStreak || 0);
  return out;
}

/* ---------- Firebase ---------- */
const FB_CONFIG = {
  apiKey: "AIzaSyCffeHkYj2rY6odXD2MZbmArGNjh-nxuGA",
  authDomain: "shlifim-medilab.firebaseapp.com",
  projectId: "shlifim-medilab",
  storageBucket: "shlifim-medilab.firebasestorage.app",
  messagingSenderId: "378600944240",
  appId: "1:378600944240:web:eb8815afb165fb4d28fab5",
  measurementId: "G-HM38FMZ72X"
};
let auth = null,
  db = null,
  googleProvider = null;
try {
  if (window.firebase) {
    if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });
  }
} catch (e) {
  console.warn('firebase', e);
}
function useLocal(key, init) {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s != null ? JSON.parse(s) : init;
    } catch {
      return init;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  }, [key, v]);
  return [v, setV];
}
// The on-screen keyboard covers the bottom of the screen. getBoundingClientRect() is in layout
// coordinates, and on iOS the layout viewport does NOT shrink when the keyboard opens — only
// visualViewport does — so we measure the visible band as [offsetTop, offsetTop+height] and
// scroll the app's own .scroll container until the element sits inside it.
// Publish the keyboard height as --kb. A quiz question exactly fills the screen, so .scroll has
// ZERO scrollable room — scrolling alone can never lift the field out from under the keyboard.
// The CSS adds --kb to .scroll's bottom padding, which creates the room to scroll into.
function syncKeyboardInset() {
  try {
    const vv = window.visualViewport;
    const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    document.documentElement.style.setProperty('--kb', kb + 'px');
    return kb;
  } catch (e) {
    return 0;
  }
}
// .scroll carries overflow-y:auto but is flex:1 inside a min-height:100vh .app, so it grows with
// its content and never actually scrolls — the page scrolls at the window level. Pick whichever
// ancestor genuinely has room to move.
function scrollerFor(el) {
  let n = el && el.parentElement;
  while (n && n !== document.body && n !== document.documentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight - n.clientHeight > 1) return n;
    n = n.parentElement;
  }
  return window;
}
function keepAboveKeyboard(el) {
  if (!el) return;
  const run = () => {
    try {
      syncKeyboardInset(); // make the room first…
      const vv = window.visualViewport;
      const top = vv ? vv.offsetTop : 0;
      const bottom = top + (vv ? vv.height : window.innerHeight);
      const r = el.getBoundingClientRect();
      const over = r.bottom - (bottom - 18);
      // …then scroll into it. 'auto', not 'smooth': a smooth scroll racing the keyboard
      // animation often never lands.
      if (over > 0) scrollerFor(el).scrollBy({
        top: over,
        behavior: 'auto'
      });
    } catch (e) {}
  };
  // two passes: some Android keyboards report the resized viewport only after the animation
  setTimeout(run, 300);
  setTimeout(run, 650);
}
// Also react whenever the keyboard actually opens/resizes, not just on focus.
try {
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () {
      const a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) keepAboveKeyboard(a.closest('.q-type-in') || a);else syncKeyboardInset(); // keyboard closed → drop the extra padding again
    });
  }
} catch (e) {}
function highlight(text, q) {
  if (!q) return text;
  const i = (text || '').toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return /*#__PURE__*/React.createElement(React.Fragment, null, text.slice(0, i), /*#__PURE__*/React.createElement("mark", {
    className: "hl"
  }, text.slice(i, i + q.length)), text.slice(i + q.length));
}

/* =====================================================================
   UI v3 · design-system refactor
   One font (Assistant) · 4/8pt grid · surface ramp · 5 control states ·
   bottom sheets · long-press menu · swipe back · toasts · zero states
   ===================================================================== */
const h = React.createElement;
const Frag = React.Fragment;
const buzz = ms => {
  try {
    if (navigator.vibrate) navigator.vibrate(ms || 8);
  } catch (e) {}
};
const lsGet = k => {
  try {
    return localStorage.getItem(k);
  } catch (e) {
    return null;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch (e) {}
};

/* icons — Twemoji (CC-BY 4.0) supplied via window.MLICONS (app/mlicons.js) for content,
   thin stroke icons below for system chrome (close, back, search, lock…) */
const mlic = k => h("span", {
  className: "mlic",
  "aria-hidden": "true",
  dangerouslySetInnerHTML: {
    __html: (window.MLICONS || {})[k] || ''
  }
});
const IcCards = () => mlic('cards');
const IcQuiz = () => mlic('quiz');
const IcList = () => mlic('book');
const IcInfo = () => mlic('flask');
const IcGrid = () => mlic('grid');
const IcSpeaker = () => mlic('speaker');
const IcPin = () => mlic('pin');
const TopicIcon = ({
  tp
}) => tp && tp.svg ? h("span", {
  className: "tpi",
  "aria-hidden": "true",
  dangerouslySetInnerHTML: {
    __html: tp.svg
  }
}) : null;
const ICO = {
  moon: ['M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z'],
  sun: [['circle', {
    cx: 12,
    cy: 12,
    r: 4
  }], 'M12 2.5v2', 'M12 19.5v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2.5 12h2', 'M19.5 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  info: [['circle', {
    cx: 12,
    cy: 12,
    r: 9
  }], 'M12 11v5', 'M12 7.8h.01'],
  alert: ['M10.3 3.9L2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9.5v4', 'M12 17h.01'],
  search: [['circle', {
    cx: 11,
    cy: 11,
    r: 7
  }], 'M20 20l-3.6-3.6'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  back: ['M9 5l7 7-7 7'],
  chevL: ['M15 6l-6 6 6 6'],
  chevR: ['M9 6l6 6-6 6'],
  chevD: ['M6 9l6 6 6-6'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  lock: [['rect', {
    x: 5,
    y: 11,
    width: 14,
    height: 10,
    rx: 2
  }], 'M8 11V8a4 4 0 0 1 8 0v3'],
  flip: ['M4 12a8 8 0 0 1 13.7-5.7L20 8.5', 'M20 4v4.5h-4.5', 'M20 12a8 8 0 0 1-13.7 5.7L4 15.5', 'M4 20v-4.5h4.5'],
  filter: ['M4 6h16', 'M7 12h10', 'M10 18h4'],
  copy: [['rect', {
    x: 9,
    y: 9,
    width: 12,
    height: 12,
    rx: 2
  }], 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'],
  play: ['M8 5.5v13l10.5-6.5z'],
  pause: ['M9 5v14', 'M15 5v14'],
  arrowL: ['M19 12H5', 'M11 18l-6-6 6-6'],
  target: [['circle', {
    cx: 12,
    cy: 12,
    r: 9
  }], ['circle', {
    cx: 12,
    cy: 12,
    r: 5
  }], ['circle', {
    cx: 12,
    cy: 12,
    r: 1.2
  }]],
  timer: [['circle', {
    cx: 12,
    cy: 13,
    r: 8
  }], 'M12 9v4l2.5 1.5', 'M10 2.5h4'],
  logout: ['M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3', 'M16 17l5-5-5-5', 'M21 12H9'],
  chat: ['M20.5 11.5a8.4 8.4 0 0 1-12.3 7.4L3.5 20.5l1.6-4.5a8.4 8.4 0 1 1 15.4-4.5z'],
  phone: ['M21 16.4v2.8a1.9 1.9 0 0 1-2.1 1.9A18.8 18.8 0 0 1 2.9 5.1 1.9 1.9 0 0 1 4.8 3h2.8a1.9 1.9 0 0 1 1.9 1.6c.1.9.4 1.8.7 2.6a1.9 1.9 0 0 1-.4 2L8.6 10.4a15 15 0 0 0 5 5l1.2-1.2a1.9 1.9 0 0 1 2-.4c.8.3 1.7.6 2.6.7a1.9 1.9 0 0 1 1.6 1.9z'],
  mail: [['rect', {
    x: 3,
    y: 5,
    width: 18,
    height: 14,
    rx: 2
  }], 'M3.5 7l8.5 6 8.5-6'],
  camera: [['rect', {
    x: 3,
    y: 3,
    width: 18,
    height: 18,
    rx: 5
  }], ['circle', {
    cx: 12,
    cy: 12,
    r: 4
  }], 'M17.5 6.5h.01'],
  user: [['circle', {
    cx: 12,
    cy: 8,
    r: 4
  }], 'M4.5 20.5a7.5 7.5 0 0 1 15 0'],
  download: ['M12 3.5v11', 'M7.5 10.5l4.5 4.5 4.5-4.5', 'M5 20h14'],
  sound: ['M11 5L6.5 9H3.5v6h3L11 19z', 'M15.5 9a4.5 4.5 0 0 1 0 6', 'M18.5 6a8.5 8.5 0 0 1 0 12'],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  grid: [['rect', {
    x: 4,
    y: 4,
    width: 7,
    height: 7,
    rx: 1.5
  }], ['rect', {
    x: 13,
    y: 4,
    width: 7,
    height: 7,
    rx: 1.5
  }], ['rect', {
    x: 4,
    y: 13,
    width: 7,
    height: 7,
    rx: 1.5
  }], ['rect', {
    x: 13,
    y: 13,
    width: 7,
    height: 7,
    rx: 1.5
  }]],
  star: ['M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z'],
  key: [['circle', {
    cx: 8,
    cy: 15,
    r: 4
  }], 'M11 12l8.5-8.5', 'M16.5 6.5l2 2', 'M14.5 8.5l1.5 1.5'],
  save: ['M5 3.5h11l3.5 3.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5z', 'M8 3.5v5h7v-5', 'M7.5 20.5v-6h9v6'],
  cards: [['rect', {
    x: 3,
    y: 6,
    width: 14,
    height: 14,
    rx: 2
  }], 'M7 3.5h11.5A2.5 2.5 0 0 1 21 6v11.5']
};
function Ico({
  n,
  s
}) {
  const P = ICO[n] || [];
  return h("svg", {
    className: "ico",
    viewBox: "0 0 24 24",
    width: s || 20,
    height: s || 20,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false"
  }, P.map((d, i) => typeof d === 'string' ? h("path", {
    key: i,
    d: d
  }) : h(d[0], Object.assign({
    key: i
  }, d[1]))));
}
const Spinner = () => h("span", {
  className: "spin",
  "aria-hidden": "true"
});
const GoogleG = () => h("svg", {
  width: "18",
  height: "18",
  viewBox: "0 0 48 48",
  "aria-hidden": "true"
}, h("path", {
  fill: "#4285F4",
  d: "M45 24c0-1.6-.1-3.1-.4-4.5H24v9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1C42.7 36.8 45 31 45 24z"
}), h("path", {
  fill: "#34A853",
  d: "M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.4 46 24 46z"
}), h("path", {
  fill: "#FBBC05",
  d: "M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2v-5.7H4.5C3 17 2 20.4 2 24s1 7 2.5 9.9l7.3-5.7z"
}), h("path", {
  fill: "#EA4335",
  d: "M24 11.5c3.2 0 6 1.1 8.3 3.2l6.2-6.2C34.9 5 29.9 3 24 3 15.4 3 8.1 7.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z"
}));

/* Button: default · hover · pressed · loading (spinner) · disabled */
function Btn(props) {
  const {
    kind,
    size,
    busy,
    icon,
    iconEnd,
    className,
    children,
    disabled,
    ...rest
  } = props;
  const is = size === 'sm' ? 16 : 18;
  return h("button", Object.assign({
    type: "button",
    className: ['btn', 'btn-' + (kind || 'pri'), size ? 'btn-' + size : '', busy ? 'is-busy' : '', className || ''].join(' ').trim(),
    disabled: !!(disabled || busy),
    "aria-busy": busy ? 'true' : undefined
  }, rest), busy ? h(Spinner) : icon ? h(Ico, {
    n: icon,
    s: is
  }) : null, h("span", {
    className: "btn-l"
  }, children), iconEnd && !busy ? h(Ico, {
    n: iconEnd,
    s: is
  }) : null);
}
function GoogleBtn({
  onClick,
  busy,
  children
}) {
  return h("button", {
    type: "button",
    className: 'google-btn' + (busy ? ' is-busy' : ''),
    onClick: onClick,
    disabled: !!busy,
    "aria-busy": busy ? 'true' : undefined
  }, busy ? h(Spinner) : h(GoogleG), h("span", null, children || 'התחברות עם Google'));
}
function SwitchRow({
  icon,
  label,
  on,
  onClick,
  locked
}) {
  return h("button", {
    type: "button",
    className: 'row switch-row' + (locked ? ' is-locked' : ''),
    role: "switch",
    "aria-checked": !!on,
    onClick: onClick
  }, icon && h("span", {
    className: "row-ic"
  }, typeof icon === 'string' ? h(Ico, {
    n: icon
  }) : icon), h("span", {
    className: "row-l"
  }, label), locked ? h("span", {
    className: "row-lock"
  }, h(Ico, {
    n: 'lock',
    s: 16
  })) : null, h("span", {
    className: 'switch' + (on ? ' is-on' : ''),
    "aria-hidden": "true"
  }, h("i")));
}

/* ---------- TOASTS ---------- */
let _pushToast = null;
function toast(msg, opts) {
  if (_pushToast) _pushToast(Object.assign({
    msg,
    id: Date.now() + Math.random()
  }, opts || {}));
}
function Toaster() {
  const [t, setT] = useState(null);
  useEffect(() => {
    _pushToast = setT;
    return () => {
      _pushToast = null;
    };
  }, []);
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => setT(null), t.ms || (t.action ? 4200 : 2400));
    return () => clearTimeout(id);
  }, [t]);
  if (!t) return null;
  const kind = t.kind || 'info';
  return h("div", {
    className: 'toast t-' + kind,
    key: t.id,
    role: kind === 'err' ? 'alert' : 'status'
  }, h("span", {
    className: "toast-ic"
  }, h(Ico, {
    n: kind === 'err' ? 'alert' : kind === 'ok' ? 'check' : 'info',
    s: 18
  })), h("span", {
    className: "toast-msg"
  }, t.msg), t.action && h("button", {
    type: "button",
    className: "toast-act",
    onClick: () => {
      setT(null);
      t.action.fn();
    }
  }, t.action.label));
}
function copyText(txt) {
  const ok = () => toast('ההגדרה הועתקה', {
    kind: 'ok'
  });
  const fallback = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      ok();
    } catch (e) {
      toast('ההעתקה נכשלה', {
        kind: 'err'
      });
    }
  };
  try {
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok, fallback);else fallback();
  } catch (e) {
    fallback();
  }
}

/* ---------- BOTTOM SHEET ---------- */
// The page behind a sheet scales down (and restores on dismiss). Several sheets can stack,
// so a depth counter keeps the effect on until the last one closes.
let _sheetDepth = 0;
function useBgScale() {
  useEffect(() => {
    const root = document.documentElement;
    if (_sheetDepth++ === 0) {
      const app = document.querySelector('.app');
      if (app) app.style.transformOrigin = '50% ' + Math.round(window.scrollY + window.innerHeight / 2) + 'px';
      root.classList.add('sheet-open');
    }
    return () => {
      if (--_sheetDepth <= 0) {
        _sheetDepth = 0;
        root.classList.remove('sheet-open');
      }
    };
  }, []);
}
function Sheet({
  onClose,
  title,
  className,
  children,
  footer,
  label
}) {
  useBgScale();
  const ref = useRef(null);
  const body = useRef(null);
  const drag = useRef(null);
  const closing = useRef(false);
  const [out, setOut] = useState(false);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setOut(true);
    setTimeout(onClose, 220);
  }, [onClose]);
  useEffect(() => {
    const k = e => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', k);
    try {
      ref.current && ref.current.focus({
        preventScroll: true
      });
    } catch (e) {}
    return () => window.removeEventListener('keydown', k);
  }, [close]);
  // drag down to dismiss: from the grab handle, or from anywhere once the body is scrolled to the top
  const onTS = e => {
    const t = e.touches[0];
    drag.current = {
      y: t.clientY,
      top: body.current ? body.current.scrollTop : 0,
      dy: 0,
      t: Date.now(),
      on: false
    };
  };
  const onTM = e => {
    const d = drag.current,
      el = ref.current;
    if (!d || !el) return;
    const y = e.touches[0].clientY;
    if (!d.on) {
      if (d.top <= 0 && y - d.y > 8) {
        d.on = true;
        d.y = y;
        d.t = Date.now();
        el.style.transition = 'none';
      } else return;
    }
    d.dy = Math.max(0, y - d.y);
    el.style.transform = 'translateY(' + d.dy + 'px)';
  };
  const onTE = () => {
    const d = drag.current,
      el = ref.current;
    drag.current = null;
    if (!d || !d.on || !el) return;
    el.style.transition = '';
    const v = d.dy / Math.max(1, Date.now() - d.t);
    if (d.dy > 110 || v > 0.6) {
      el.style.transform = 'translateY(105%)';
      close();
    } else el.style.transform = '';
  };
  const kids = typeof children === 'function' ? children(close) : children;
  const foot = typeof footer === 'function' ? footer(close) : footer;
  // portal: a transformed ancestor (.app scales behind sheets) would otherwise trap position:fixed
  return ReactDOM.createPortal(h("div", {
    className: 'overlay' + (out ? ' is-out' : ''),
    onClick: close
  }, h("div", {
    ref: ref,
    className: 'sheet ' + (className || ''),
    role: "dialog",
    "aria-modal": "true",
    "aria-label": title || label || undefined,
    tabIndex: -1,
    onClick: e => e.stopPropagation(),
    onTouchStart: onTS,
    onTouchMove: onTM,
    onTouchEnd: onTE,
    onTouchCancel: onTE
  }, h("div", {
    className: "sheet-grab",
    "aria-hidden": "true"
  }), h("button", {
    type: "button",
    className: "sheet-x",
    onClick: close,
    "aria-label": "סגירה"
  }, h(Ico, {
    n: 'x'
  })), h("div", {
    className: "sheet-body",
    ref: body
  }, title && h("h2", {
    className: "sheet-title"
  }, title), kids), foot && h("div", {
    className: "sheet-foot"
  }, foot))), document.body);
}

/* ---------- LONG-PRESS CONTEXT MENU ---------- */
function useLongPress(onLong, ms) {
  const st = useRef({});
  const clear = () => {
    clearTimeout(st.current.t);
    st.current.t = null;
  };
  return {
    onTouchStart: e => {
      const t = e.touches[0];
      const el = e.currentTarget;
      clear();
      st.current = {
        x: t.clientX,
        y: t.clientY,
        fired: false
      };
      st.current.t = setTimeout(() => {
        st.current.fired = true;
        st.current.t = null;
        onLong(el);
      }, ms || 480);
    },
    onTouchMove: e => {
      const s = st.current;
      if (!s.t) return;
      const t = e.touches[0];
      if (Math.abs(t.clientX - s.x) > 10 || Math.abs(t.clientY - s.y) > 10) clear();
    },
    onTouchEnd: e => {
      clear();
      if (st.current.fired) {
        try {
          e.preventDefault();
        } catch (er) {}
      }
    },
    onTouchCancel: clear,
    onContextMenu: e => {
      e.preventDefault();
      if (!st.current.fired) {
        clear();
        onLong(e.currentTarget);
      }
    },
    onClickCapture: e => {
      if (st.current.fired) {
        e.stopPropagation();
        e.preventDefault();
        st.current.fired = false;
      }
    }
  };
}
function ContextMenu({
  menu,
  onClose
}) {
  const opened = useRef(Date.now());
  useEffect(() => {
    buzz(12);
    const k = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []); // eslint-disable-line
  const early = () => Date.now() - opened.current < 450;
  return h("div", {
    className: "ctx",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": menu.title,
    onClick: () => {
      if (!early()) onClose();
    }
  }, h("div", {
    className: "ctx-wrap",
    onClick: e => e.stopPropagation()
  }, h("div", {
    className: "ctx-prev"
  }, h("b", null, menu.title), menu.en && h("span", {
    className: "en"
  }, menu.en), menu.sub && h("p", null, menu.sub)), h("div", {
    className: "ctx-menu",
    role: "menu"
  }, menu.items.map((it, i) => h("button", {
    key: i,
    type: "button",
    role: "menuitem",
    className: 'ctx-item' + (it.kind ? ' ' + it.kind : ''),
    onClick: () => {
      if (early()) return;
      onClose();
      it.fn && it.fn();
    }
  }, h("span", null, it.label), h("span", {
    className: "ctx-ic"
  }, it.icon))))));
}

/* ---------- FIRST-USE COACH: spotlight on the primary action ---------- */
function Coach({
  target,
  title,
  text,
  onDone
}) {
  const [r, setR] = useState(null);
  useEffect(() => {
    const el = document.querySelector(target);
    if (!el) {
      onDone(false);
      return;
    }
    const measure = () => {
      const b = el.getBoundingClientRect();
      setR({
        x: b.left,
        y: b.top,
        w: b.width,
        h: b.height
      });
    };
    try {
      el.scrollIntoView({
        block: 'center'
      });
    } catch (e) {}
    measure();
    const t = setTimeout(measure, 120);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, {
      passive: true
    });
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, []); // eslint-disable-line
  if (!r) return null;
  const pad = 8;
  const below = r.y + r.h / 2 < window.innerHeight * 0.55;
  return ReactDOM.createPortal(h("div", {
    className: "coach",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": title
  }, h("button", {
    type: "button",
    className: "coach-hole",
    style: {
      left: r.x - pad,
      top: r.y - pad,
      width: r.w + pad * 2,
      height: r.h + pad * 2
    },
    onClick: () => onDone(true),
    "aria-label": title
  }), h("div", {
    className: 'coach-tip' + (below ? '' : ' up'),
    style: below ? {
      top: r.y + r.h + pad + 16
    } : {
      bottom: window.innerHeight - r.y + pad + 16
    }
  }, h("b", null, title), h("p", null, text), h(Btn, {
    onClick: () => onDone(true)
  }, "הבנתי"))), document.body);
}

/* ---------- SMALL SHARED PIECES ---------- */
function TopicTag({
  topicKey
}) {
  const tp = TBK[topicKey];
  if (!tp) return null;
  return h("span", {
    className: "tag",
    style: {
      '--tc': tp.accent
    }
  }, h("i", {
    className: "tag-dot",
    "aria-hidden": "true"
  }), h(TopicIcon, {
    tp: tp
  }), tp.label);
}
function Confetti() {
  const cols = ['#3FA9D6', '#5CB85C', '#F0654F', '#F9D85C', '#9B59B6'];
  const p = [];
  for (let i = 0; i < 42; i++) {
    p.push(h("i", {
      key: i,
      style: {
        left: Math.random() * 100 + '%',
        background: cols[i % cols.length],
        animationDuration: 1 + Math.random() * 1.1 + 's',
        animationDelay: Math.random() * 0.3 + 's'
      }
    }));
  }
  return h("div", {
    className: "confetti",
    "aria-hidden": "true"
  }, p);
}
// "did you mean" for the search zero state: bigram overlap against every term (Hebrew + English)
function suggestTerms(q, n) {
  const norm = s => (s || '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/[^א-תa-z0-9]/g, '');
  const Q = norm(q);
  if (Q.length < 2) return [];
  const grams = s => {
    const g = {};
    for (let i = 0; i < s.length - 1; i++) g[s.slice(i, i + 2)] = 1;
    return g;
  };
  const qg = grams(Q),
    qn = Object.keys(qg).length || 1;
  const scored = [];
  GLOSSARY.forEach(t => {
    if (t.aliasOf) return;
    [t.hebrew, t.english].forEach(w => {
      const W = norm(w);
      if (W.length < 2) return;
      const g = grams(W);
      let c = 0;
      for (const k in qg) if (g[k]) c++;
      const sc = 2 * c / (qn + Object.keys(g).length);
      if (sc >= 0.34) scored.push({
        t,
        sc
      });
    });
  });
  scored.sort((a, b) => b.sc - a.sc);
  const seen = {},
    out = [];
  for (const x of scored) {
    if (seen[x.t.hebrew]) continue;
    seen[x.t.hebrew] = 1;
    out.push(x.t);
    if (out.length >= n) break;
  }
  return out;
}

/* ---------- PICKERS (bottom sheets, one direction: vertical) ---------- */
function TopicSheet({
  value,
  onPick,
  onClose,
  counts,
  locked,
  onLocked
}) {
  const all = {
    key: '',
    label: 'כל הנושאים'
  };
  return h(Sheet, {
    onClose: onClose,
    title: "בחירת נושא",
    className: "pick"
  }, close => h(Frag, null, locked && h("p", {
    className: "note"
  }, h(Ico, {
    n: 'lock',
    s: 16
  }), h("span", null, "בגרסה החינמית פתוח נושא אחד. הרשמה חינמית פותחת את כל 21 הנושאים.")), h("div", {
    className: "list",
    role: "listbox",
    "aria-label": "נושאים"
  }, [all].concat(TOPICS).map(t => {
    const isLock = locked && t.key !== SL.FREE_TOPIC;
    const on = value === t.key;
    return h("button", {
      key: t.key || '__all',
      type: "button",
      role: "option",
      "aria-selected": on,
      className: 'row' + (on ? ' is-on' : '') + (isLock ? ' is-locked' : ''),
      onClick: () => {
        if (isLock) {
          close();
          setTimeout(onLocked, 240);
          return;
        }
        onPick(t.key);
        close();
      }
    }, h("span", {
      className: "row-ic"
    }, t.key ? h(TopicIcon, {
      tp: t
    }) : h(Ico, {
      n: 'grid'
    })), h("span", {
      className: "row-l"
    }, t.label), counts && h("span", {
      className: "row-v"
    }, t.key ? counts[t.key] || 0 : TOTAL), h("span", {
      className: "row-end"
    }, isLock ? h(Ico, {
      n: 'lock',
      s: 16
    }) : on ? h(Ico, {
      n: 'check',
      s: 18
    }) : null));
  }))));
}
function LetterSheet({
  value,
  counts,
  onPick,
  onClose
}) {
  return h(Sheet, {
    onClose: onClose,
    title: "סינון לפי אות",
    className: "pick"
  }, close => h("div", {
    className: "letter-grid"
  }, h("button", {
    type: "button",
    className: 'let let-all' + (!value ? ' is-on' : ''),
    onClick: () => {
      onPick('');
      close();
    }
  }, "כל האותיות"), HEB.map(l => h("button", {
    key: l,
    type: "button",
    className: 'let' + (value === l ? ' is-on' : ''),
    disabled: !counts[l],
    "aria-label": 'אות ' + l + (counts[l] ? ' · ' + counts[l] + ' מושגים' : ''),
    onClick: () => {
      onPick(l);
      close();
    }
  }, l))));
}
function FilterButton({
  on,
  icon,
  label,
  onClick,
  locked
}) {
  return h("button", {
    type: "button",
    className: 'fbtn' + (on ? ' is-on' : ''),
    onClick: onClick,
    "aria-haspopup": "dialog"
  }, icon, h("span", {
    className: "fbtn-l"
  }, label), locked ? h(Ico, {
    n: 'lock',
    s: 14
  }) : h(Ico, {
    n: 'chevD',
    s: 16
  }));
}


/* vocalized (menukad) form for display; falls back to plain hebrew. Search/audio/keys still use .hebrew */
const termLabel = t => t && (t.nikud || t.hebrew);

/* ---------- PWA INSTALL ---------- */
function useInstall() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const onBIP = e => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      toast('שליפים הותקנה במסך הבית', {
        kind: 'ok'
      });
    };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const mm = window.matchMedia && window.matchMedia('(display-mode: standalone)');
  const isStandalone = mm && mm.matches || window.navigator.standalone === true;
  const ua = navigator.userAgent || '';
  const isIOS = (/iphone|ipad|ipod/i.test(ua) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) && !window.MSStream;
  const promptInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch (e) {}
    setDeferred(null);
  };
  return {
    canInstall: !!deferred,
    isIOS,
    isStandalone,
    installed,
    promptInstall
  };
}
// instructions sheet shared by the home banner and the About button
function InstallSheets({
  sheet,
  onClose
}) {
  if (!sheet) return null;
  const ua = navigator.userAgent || '';
  const isFirefox = /firefox|fxios/i.test(ua);
  const isAndroid = /android/i.test(ua);
  return h(Sheet, {
    onClose: onClose,
    className: "ios-sheet",
    label: "התקנה",
    footer: close => h(Btn, {
      className: "btn-block",
      onClick: close
    }, "הבנתי")
  }, h("img", {
    src: "icon-192.png",
    alt: "",
    className: "sheet-app-ic"
  }), sheet === 'ios' ? h(Frag, null, h("h2", {
    className: "sheet-title"
  }, "התקנה ל-iPhone / iPad"), h("ol", {
    className: "steps"
  }, h("li", null, "הקישו על כפתור השיתוף בתחתית הדפדפן (Safari)"), h("li", null, "גללו ובחרו ", h("b", null, "הוסף למסך הבית"), " (Add to Home Screen)"), h("li", null, "הקישו ", h("b", null, "הוסף"), ", והאייקון של שליפים יופיע במסך הבית"))) : h(Frag, null, h("h2", {
    className: "sheet-title"
  }, "התקנת האפליקציה"), isFirefox ? h("ol", {
    className: "steps"
  }, h("li", null, h("b", null, "Firefox במחשב"), " אינו תומך בהתקנה אוטומטית."), h("li", null, "להתקנה מלאה פתחו את האתר ב-", h("b", null, "Google Chrome"), " או ב-", h("b", null, "Microsoft Edge"), "."), h("li", null, "ב-Firefox בטלפון: תפריט ", h("b", null, "⋮"), ", ואז ", h("b", null, "התקן"), " / ", h("b", null, "הוספה למסך הבית"), ".")) : h("ol", {
    className: "steps"
  }, h("li", null, "פתחו את תפריט הדפדפן (", isAndroid ? '⋮ בפינה העליונה' : '⋮ או ☰ בפינה', ")."), h("li", null, "בחרו ", h("b", null, isAndroid ? 'התקנת אפליקציה / הוספה למסך הבית' : 'התקן את שליפים… (Install app)'), "."), h("li", null, "אשרו, והאייקון יתווסף למסך הבית או לשולחן העבודה.")), h("p", {
    className: "muted"
  }, "אפשר תמיד להשתמש באתר ישירות בדפדפן, בלי להתקין.")));
}
// shared click behaviour: native prompt if available, else the install page
function useInstallAction() {
  const inst = useInstall();
  const [sheet, setSheet] = useState('');
  const [busy, setBusy] = useState(false);
  const act = async () => {
    if (inst.isIOS) {
      window.location.assign('install.html');
    } else if (inst.canInstall) {
      setBusy(true);
      try {
        await inst.promptInstall();
      } finally {
        setBusy(false);
      }
    } else {
      window.location.assign('install.html');
    }
  };
  return {
    ...inst,
    sheet,
    setSheet,
    act,
    busy
  };
}
// dismissible banner at the top of the glossary
function InstallCard() {
  const {
    isStandalone,
    installed,
    sheet,
    setSheet,
    act,
    busy
  } = useInstallAction();
  const [dismissed, setDismissed] = useLocal('ml-install-x', false);
  if (installed || isStandalone || dismissed) return null;
  return h(Frag, null, h("div", {
    className: "card install-card"
  }, h("img", {
    className: "install-icon",
    src: "icon-192.png",
    alt: "",
    "aria-hidden": "true"
  }), h("div", {
    className: "install-txt"
  }, h("b", null, "התקינו את שליפים"), h("span", null, "אפליקציה מלאה במסך הבית, עובדת גם ללא אינטרנט")), h(Btn, {
    size: "sm",
    icon: "download",
    busy: busy,
    onClick: act
  }, "התקנה"), h("button", {
    type: "button",
    className: "install-x",
    onClick: () => setDismissed(true),
    "aria-label": "הסתרת ההצעה"
  }, h(Ico, {
    n: 'x',
    s: 16
  }))), h(InstallSheets, {
    sheet: sheet,
    onClose: () => setSheet('')
  }));
}
// permanent button for the About page
function InstallButton() {
  const {
    isStandalone,
    installed,
    sheet,
    setSheet,
    act,
    busy
  } = useInstallAction();
  if (installed || isStandalone) return h("div", {
    className: "install-done"
  }, h(Ico, {
    n: 'check',
    s: 16
  }), " האפליקציה כבר מותקנת אצלך");
  return h(Frag, null, h(Btn, {
    icon: "download",
    busy: busy,
    onClick: act
  }, "התקנת האפליקציה"), h(InstallSheets, {
    sheet: sheet,
    onClose: () => setSheet('')
  }));
}

/* ---------- HEADER / NAV ---------- */
function Header({
  mode,
  pinCount,
  dark,
  setDark,
  sub,
  onBack,
  onReview,
  onAbout
}) {
  return h("header", {
    className: "hdr"
  }, sub ? h("button", {
    type: "button",
    className: "icon-btn",
    onClick: onBack,
    "aria-label": "חזרה"
  }, h(Ico, {
    n: 'back',
    s: 22
  })) : h("button", {
    type: "button",
    className: "logo-wrap",
    onClick: onAbout,
    "aria-label": "אודות"
  }, h("img", {
    className: "logo-mark",
    src: "logo.jpg",
    alt: "MediLab"
  }), h("span", {
    className: "bub b1"
  }), h("span", {
    className: "bub b2"
  }), h("span", {
    className: "bub b3"
  })), h("div", {
    className: "brand"
  }, h("b", null, "שליפים"), h("span", null, "נתנאל יוחאי מדינה")), h("div", {
    className: "hdr-spacer"
  }), mode !== 'review' && h("button", {
    type: "button",
    className: 'pin-count' + (pinCount ? ' has' : ''),
    onClick: onReview,
    "aria-label": 'מושגים לחזרה: ' + (pinCount || 0)
  }, h(IcPin), h("span", null, pinCount || 0)), h("button", {
    type: "button",
    className: "icon-btn",
    onClick: () => setDark(d => !d),
    "aria-label": dark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה',
    "aria-pressed": !!dark
  }, h(Ico, {
    n: dark ? 'sun' : 'moon'
  })), mode !== 'about' && h("button", {
    type: "button",
    className: "icon-btn",
    onClick: onAbout,
    "aria-label": "אודות"
  }, h(Ico, {
    n: 'info'
  })));
}
function Nav({
  mode,
  setMode,
  tier,
  user
}) {
  const T = [['glossary', 'מילון', IcList], ['flashcards', 'כרטיסיות', IcCards], ['quiz', 'מבחון', IcQuiz], ['crossword', 'תשבץ', IcGrid], ['profile', 'אזור אישי', null]];
  return h("nav", {
    className: "nav",
    "aria-label": "ניווט ראשי"
  }, T.map(([m, label, Ic]) => {
    const on = mode === m;
    const locked = !SL.canAccess(m === 'crossword' ? 'crossword' : 'glossary', tier);
    return h("button", {
      key: m,
      type: "button",
      className: 'tab' + (on ? ' is-on' : ''),
      onClick: () => setMode(m),
      "aria-current": on ? 'page' : undefined
    }, h("span", {
      className: "tab-ic"
    }, m === 'profile' ? h("span", {
      className: "nav-av"
    }, user && user.photoURL ? h("img", {
      src: user.photoURL,
      referrerPolicy: "no-referrer",
      alt: ""
    }) : h(Ico, {
      n: 'user',
      s: 18
    })) : h(Ic), locked && h("span", {
      className: "tab-lock",
      title: "נעול"
    }, h(Ico, {
      n: 'lock',
      s: 10
    }))), h("span", {
      className: "tab-l"
    }, label));
  }));
}

/* ---------- GLOSSARY ---------- */
function TermCard({
  t,
  q,
  fav,
  studied,
  onFav,
  onStudied,
  onOpenTerm,
  onMenu
}) {
  const [open, setOpen] = useState(false);
  const isAlias = !!t.aliasOf;
  const canon = isAlias ? SL.resolveEntry(t.hebrew, maps) : t;
  const def = canon ? canon.definition : t.definition;
  const long = (def || '').length > 170;
  const shown = long && !open ? def.slice(0, 170) + '…' : def;
  const lp = useLongPress(() => onMenu && onMenu(t, def));
  const label = t.nikud ? t.nikud : highlight(t.hebrew, q);
  return h("article", Object.assign({
    className: 'card term-card' + (studied ? ' is-studied' : '')
  }, onMenu ? lp : {}), h("div", {
    className: "card-top"
  }, h("div", {
    className: "card-head"
  }, onOpenTerm ? h("button", {
    type: "button",
    className: "term",
    onClick: () => onOpenTerm(t.hebrew),
    title: "בחנו אותי על המושג"
  }, h("span", null, label), h("span", {
    className: "term-q",
    "aria-hidden": "true"
  }, "?")) : h("div", {
    className: "term"
  }, label), t.english && h("div", {
    className: "en"
  }, t.english)), h("div", {
    className: "acts"
  }, h("button", {
    type: "button",
    className: "ibtn",
    onClick: () => Speak2(t.hebrew, t.nikud),
    title: "הקראה",
    "aria-label": "הקראה"
  }, h(IcSpeaker)), h("button", {
    type: "button",
    className: 'ibtn' + (fav ? ' is-pin' : ''),
    onClick: onFav,
    "aria-pressed": !!fav,
    title: fav ? 'הסרה מרשימת החזרה' : 'סימון לחזרה (קשה לזכור)',
    "aria-label": "לחזרה"
  }, h("span", {
    className: fav ? '' : 'pin-off'
  }, h(IcPin))), h("button", {
    type: "button",
    className: 'ibtn ibtn-check' + (studied ? ' is-done' : ''),
    onClick: () => {
      if (!studied) Snd.ding();
      onStudied();
    },
    "aria-pressed": !!studied,
    title: studied ? 'ביטול נלמד' : 'סימון כנלמד',
    "aria-label": "נלמד"
  }, h(Ico, {
    n: 'check',
    s: 18
  })))), t.topic && h(TopicTag, {
    topicKey: t.topic
  }), isAlias && canon && h("div", {
    className: "alias-note"
  }, "ראו: ", h("b", null, t.aliasOf)), h("p", {
    className: "def"
  }, highlight(shown, q)), long && h("button", {
    type: "button",
    className: "more",
    onClick: () => setOpen(o => !o),
    "aria-expanded": open
  }, open ? 'הצגת פחות' : 'קריאת עוד', h(Ico, {
    n: 'chevD',
    s: 16
  })));
}
function Glossary({
  favorites,
  studied,
  toggleFav,
  toggleStudied,
  onOpenTerm,
  onMenu,
  q,
  setQ,
  letter,
  setLetter,
  topic,
  setTopic
}) {
  const [sheet, setSheet] = useState('');
  const [coach, setCoach] = useState(false);
  const inputRef = useRef(null);
  const letterCounts = useMemo(() => {
    const c = {};
    GLOSSARY.forEach(t => {
      if (!topic || t.topic === topic) c[t.letter] = (c[t.letter] || 0) + 1;
    });
    return c;
  }, [topic]);
  const results = useMemo(() => {
    let items = SL.search(searchIndex, q);
    if (letter) items = items.filter(t => t.letter === letter);
    if (topic) items = items.filter(t => t.topic === topic);
    return items;
  }, [q, letter, topic]);
  const [page, setPage] = useState({ results: null, limit: 32 });
  const visibleCount = page.results === results ? page.limit : 32;
  const tp = topic ? TBK[topic] : null;
  const filtered = !!(topic || letter);
  const clearFilters = () => {
    setTopic('');
    setLetter('');
  };
  const sugg = useMemo(() => results.length ? [] : suggestTerms(q, 4), [results.length, q]);
  // first-time use: spotlight the search field once the intro video is gone
  useEffect(() => {
    if (lsGet('sl-coach-v1') || studied.length || favorites.length) return;
    let n = 0;
    const id = setInterval(() => {
      if (!document.getElementById('intro')) {
        clearInterval(id);
        setTimeout(() => setCoach(true), 450);
      } else if (++n > 60) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, []); // eslint-disable-line
  const endCoach = focus => {
    lsSet('sl-coach-v1', '1');
    setCoach(false);
    if (focus && inputRef.current) {
      try {
        inputRef.current.focus();
      } catch (e) {}
    }
  };
  const zero = h("div", {
    className: "zero",
    role: "status"
  }, h("div", {
    className: "zero-ic"
  }, h(Ico, {
    n: 'search',
    s: 28
  })), h("h3", null, q.trim() ? h(Frag, null, "אין תוצאות ל־", h("bdi", null, "“", q.trim(), "”")) : 'אין מושגים בסינון הזה'), filtered && h("p", null, "החיפוש מוגבל ל", tp ? 'נושא ' + tp.label : '', tp && letter ? ' ו' : '', letter ? 'אות ' + letter : '', "."), sugg.length > 0 && h("div", {
    className: "zero-sug"
  }, h("span", {
    className: "label"
  }, "אולי התכוונתם ל:"), h("div", {
    className: "zero-chips"
  }, sugg.map(t => h("button", {
    key: t.hebrew,
    type: "button",
    className: "chip",
    onClick: () => {
      clearFilters();
      setQ(t.hebrew);
    }
  }, t.hebrew)))), h("div", {
    className: "zero-acts"
  }, q && h(Btn, {
    icon: "x",
    onClick: () => {
      setQ('');
      inputRef.current && inputRef.current.focus();
    }
  }, "ניקוי החיפוש"), filtered && h(Btn, {
    kind: "ghost",
    onClick: clearFilters
  }, "ניקוי הסינון")));
  return h(Frag, null, h("div", {
    className: "hero"
  }, h("h1", null, "מילון מושגים"), h("p", null, TOTAL, " מושגים בביולוגיה")), h(InstallCard), h("div", {
    className: "search"
  }, h(Ico, {
    n: 'search'
  }), h("input", {
    ref: inputRef,
    type: "search",
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "חפשו מושג… (אוסמוזה, PCR, אקסון)",
    enterKeyHint: "search",
    autoComplete: "off",
    "aria-label": "חיפוש מושג"
  }), q && h("button", {
    type: "button",
    className: "search-x",
    onClick: () => {
      setQ('');
      inputRef.current && inputRef.current.focus();
    },
    "aria-label": "ניקוי החיפוש"
  }, h(Ico, {
    n: 'x',
    s: 16
  }))), h("div", {
    className: "filters"
  }, h(FilterButton, {
    on: !!topic,
    icon: tp ? h(TopicIcon, {
      tp: tp
    }) : h(Ico, {
      n: 'filter',
      s: 18
    }),
    label: tp ? tp.label : 'כל הנושאים',
    onClick: () => setSheet('topic')
  }), h(FilterButton, {
    on: !!letter,
    label: letter ? 'אות ' + letter : 'כל האותיות',
    onClick: () => setSheet('letter')
  }), filtered && h("button", {
    type: "button",
    className: "fclear",
    onClick: clearFilters
  }, "ניקוי")), h("div", {
    className: "meta",
    "aria-live": "polite"
  }, results.length, " מושגים"), results.length === 0 ? zero : results.slice(0, visibleCount).map(t => h(TermCard, {
    key: t.hebrew + t.letter,
    t: t,
    q: q.trim(),
    fav: favorites.includes(t.hebrew),
    studied: studied.includes(t.hebrew),
    onFav: () => toggleFav(t.hebrew),
    onStudied: () => toggleStudied(t.hebrew),
    onOpenTerm: onOpenTerm,
    onMenu: onMenu
  })), results.length > visibleCount && h("button", {
    type: "button",
    className: "fclear",
    style: { display: "block", margin: "16px auto", minHeight: 44 },
    onClick: () => setPage({ results, limit: visibleCount + 32 })
  }, "הצגת מושגים נוספים"), sheet === 'topic' && h(TopicSheet, {
    value: topic,
    onPick: setTopic,
    onClose: () => setSheet(''),
    counts: topicTotals
  }), sheet === 'letter' && h(LetterSheet, {
    value: letter,
    counts: letterCounts,
    onPick: setLetter,
    onClose: () => setSheet('')
  }), coach && h(Coach, {
    target: '.search',
    title: 'מתחילים כאן',
    text: 'חפשו כל מושג בביולוגיה, בעברית או באנגלית. לחיצה ארוכה על מושג פותחת עוד פעולות.',
    onDone: endCoach
  }));
}

/* ---------- REVIEW LIST (pinned terms) ---------- */
function ReviewList({
  favorites,
  studied,
  toggleFav,
  toggleStudied,
  goQuiz,
  goGlossary,
  onOpenTerm,
  onMenu
}) {
  const items = GLOSSARY.filter(t => favorites.includes(t.hebrew));
  return h(Frag, null, h("div", {
    className: "hero"
  }, h("h1", null, "מושגים לחזרה"), h("p", null, items.length ? items.length + ' מושגים שסימנתם' : 'עוד לא סימנתם מושגים')), items.length === 0 ? h("div", {
    className: "zero"
  }, h("div", {
    className: "zero-ic warn"
  }, h(IcPin)), h("h3", null, "הרשימה ריקה"), h("p", null, "סמנו מושג בנעץ (במילון או בכרטיסיות) כדי לאסוף אותו לכאן, ולהיבחן רק על מה שקשה לכם."), h("div", {
    className: "zero-acts"
  }, h(Btn, {
    iconEnd: "arrowL",
    onClick: goGlossary
  }, "למילון המושגים"))) : h(Frag, null, h(Btn, {
    className: "btn-block review-cta",
    icon: "target",
    onClick: goQuiz
  }, "מבחון על המושגים האלה"), items.map(t => h(TermCard, {
    key: t.hebrew + t.letter,
    t: t,
    q: "",
    fav: true,
    studied: studied.includes(t.hebrew),
    onFav: () => toggleFav(t.hebrew),
    onStudied: () => toggleStudied(t.hebrew),
    onOpenTerm: onOpenTerm,
    onMenu: onMenu
  }))));
}

/* ---------- FLASHCARDS ---------- */
function Flashcards({
  favorites,
  studied,
  toggleFav,
  toggleStudied,
  onKnow,
  tier,
  onNeedAll,
  goGlossary
}) {
  const lockTopics = tier === 'free';
  const [deck, setDeck] = useState('all');
  const [topic, setTopic] = useState(lockTopics ? SL.FREE_TOPIC : '');
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [dx, setDx] = useState(0);
  const [anim, setAnim] = useState('');
  useEffect(() => {
    if (lockTopics && topic !== SL.FREE_TOPIC) setTopic(SL.FREE_TOPIC);
  }, [lockTopics]); // eslint-disable-line
  const cards = useMemo(() => {
    let items = GLOSSARY.filter(t => !t.aliasOf && !/^\s*ראה:/.test(t.definition));
    if (topic) items = items.filter(t => t.topic === topic);
    if (deck === 'unstudied') items = items.filter(t => !studied.includes(t.hebrew));
    if (deck === 'review') items = items.filter(t => favorites.includes(t.hebrew));
    return items;
  }, [deck, topic, studied, favorites]);
  useEffect(() => {
    setI(0);
    setFlip(false);
  }, [deck, topic]);
  useEffect(() => {
    if (i >= cards.length && cards.length) setI(cards.length - 1);
  }, [cards.length]); // eslint-disable-line
  const card = cards[Math.min(i, Math.max(0, cards.length - 1))];
  // swipe: the card follows the finger, leaves in that direction, the next one slides in offset (parallax)
  const go = useCallback(dir => {
    if (cards.length < 2) return;
    setAnim(dir > 0 ? 'out-l' : 'out-r');
    setTimeout(() => {
      setFlip(false);
      setI(x => dir > 0 ? (x + 1) % cards.length : (x - 1 + cards.length) % cards.length);
      setDx(0);
      setAnim(dir > 0 ? 'in-r' : 'in-l');
      setTimeout(() => setAnim(''), 260);
    }, 150);
  }, [cards.length]);
  const next = useCallback(() => go(1), [go]);
  const prev = useCallback(() => go(-1), [go]);
  useEffect(() => {
    const k = e => {
      const tg = e.target && e.target.tagName;
      if (tg === 'INPUT' || tg === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') next();
      if (e.key === 'ArrowRight') prev();
      if (e.key === ' ') {
        e.preventDefault();
        setFlip(f => !f);
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [next, prev]);
  const tref = useRef(null);
  const onTS = e => {
    const t = e.touches[0];
    tref.current = {
      x: t.clientX,
      y: t.clientY,
      lock: null
    };
  };
  const onTM = e => {
    const s = tref.current;
    if (!s) return;
    const t = e.touches[0];
    const ddx = t.clientX - s.x,
      ddy = t.clientY - s.y;
    if (!s.lock) {
      if (Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy)) s.lock = 'x';else if (Math.abs(ddy) > 10) s.lock = 'y';
    }
    if (s.lock === 'x') setDx(ddx);
  };
  const onTE = () => {
    const s = tref.current;
    tref.current = null;
    if (!s || s.lock !== 'x') return;
    if (Math.abs(dx) > 64) dx < 0 ? next() : prev();else setDx(0);
  };
  const known = card && studied.includes(card.hebrew);
  const pinned = card && favorites.includes(card.hebrew);
  const tp = topic ? TBK[topic] : null;
  const emptyMsg = deck === 'review' ? ['אין מושגים לחזרה', 'סמנו מושג בנעץ כדי לתרגל אותו כאן.'] : deck === 'unstudied' ? ['למדתם את כל הכרטיסיות', 'כל המושגים בנושא הזה סומנו כנלמדו.'] : ['אין כרטיסיות בנושא הזה', 'בחרו נושא אחר.'];
  const faceStyle = dx && !anim ? {
    transform: 'translateX(' + dx + 'px) rotate(' + dx / 28 + 'deg)',
    transition: 'none'
  } : undefined;
  return h(Frag, null, h("div", {
    className: "hero"
  }, h("h1", null, "כרטיסיות"), h("p", null, cards.length, " כרטיסיות \xB7 לימוד פעיל")), h("div", {
    className: "seg",
    role: "tablist",
    "aria-label": "ערימה"
  }, [['all', 'הכל'], ['unstudied', 'לא נלמדו'], ['review', 'לחזרה']].map(([k, l]) => h("button", {
    key: k,
    type: "button",
    role: "tab",
    "aria-selected": deck === k,
    className: 'seg-b' + (deck === k ? ' is-on' : ''),
    onClick: () => setDeck(k)
  }, l, k === 'review' && favorites.length > 0 && h("span", {
    className: "seg-n"
  }, favorites.length)))), h("div", {
    className: "filters"
  }, h(FilterButton, {
    on: !!topic,
    icon: tp ? h(TopicIcon, {
      tp: tp
    }) : h(Ico, {
      n: 'filter',
      s: 18
    }),
    label: tp ? tp.label : 'כל הנושאים',
    onClick: () => setSheet(true)
  })), lockTopics && h("button", {
    type: "button",
    className: "notice",
    onClick: () => onNeedAll && onNeedAll()
  }, h(Ico, {
    n: 'lock',
    s: 18
  }), h("span", null, "גרסה חינמית: נושא אחד לדוגמה. ", h("b", null, "הרשמה חינמית לכל 21 הנושאים")), h(Ico, {
    n: 'chevL',
    s: 16
  })), cards.length === 0 ? h("div", {
    className: "zero"
  }, h("div", {
    className: 'zero-ic' + (deck === 'unstudied' ? ' ok' : '')
  }, h(Ico, {
    n: deck === 'unstudied' ? 'check' : 'cards',
    s: 28
  })), h("h3", null, emptyMsg[0]), h("p", null, emptyMsg[1]), h("div", {
    className: "zero-acts"
  }, deck !== 'all' ? h(Btn, {
    onClick: () => setDeck('all')
  }, "כל הכרטיסיות") : h(Btn, {
    onClick: () => setSheet(true)
  }, "בחירת נושא"), deck === 'review' && h(Btn, {
    kind: "ghost",
    onClick: goGlossary
  }, "למילון"))) : h(Frag, null, h("div", {
    className: "prog"
  }, h("span", {
    className: "num-ltr"
  }, Math.min(i, cards.length - 1) + 1 + '/' + cards.length), h("div", {
    className: "bar",
    role: "progressbar",
    "aria-valuemin": 1,
    "aria-valuemax": cards.length,
    "aria-valuenow": i + 1
  }, h("i", {
    style: {
      width: `${(i + 1) / cards.length * 100}%`
    }
  }))), h("div", {
    className: "fc-stage"
  }, h("div", {
    className: 'fc' + (flip ? ' flip' : '') + (anim ? ' ' + anim : ''),
    style: faceStyle,
    onClick: () => setFlip(f => !f),
    onTouchStart: onTS,
    onTouchMove: onTM,
    onTouchEnd: onTE,
    role: "button",
    tabIndex: 0,
    "aria-label": flip ? 'הצגת המושג' : 'הצגת ההגדרה',
    onKeyDown: e => {
      if (e.key === 'Enter') setFlip(f => !f);
    }
  }, h("div", {
    className: "fc-inner"
  }, h("div", {
    className: "fc-face"
  }, h("div", {
    className: "fc-badge"
  }, card.letter), h("div", {
    className: "fc-term"
  }, termLabel(card)), card.english && h("div", {
    className: "fc-en"
  }, card.english), card.topic && h("div", {
    className: "fc-tag"
  }, h(TopicTag, {
    topicKey: card.topic
  })), h("span", {
    className: "fc-flip",
    "aria-hidden": "true"
  }, h(Ico, {
    n: 'flip',
    s: 18
  }))), h("div", {
    className: "fc-face fc-back"
  }, h("div", {
    className: "fc-def"
  }, card.definition), h("span", {
    className: "fc-flip",
    "aria-hidden": "true"
  }, h(Ico, {
    n: 'flip',
    s: 18
  })))), h("div", {
    className: "fc-tools",
    onClick: e => e.stopPropagation()
  }, h("button", {
    type: "button",
    className: "ibtn",
    onClick: () => Speak2(flip ? card.definition : card.hebrew, flip ? null : card.nikud),
    "aria-label": "הקראה",
    title: "הקראה"
  }, h(IcSpeaker)), h("button", {
    type: "button",
    className: 'ibtn' + (pinned ? ' is-pin' : ''),
    onClick: () => toggleFav(card.hebrew),
    "aria-pressed": !!pinned,
    "aria-label": "לחזרה",
    title: "מושג לחזרה"
  }, h("span", {
    className: pinned ? '' : 'pin-off'
  }, h(IcPin)))))), h("div", {
    className: "fc-ctrl"
  }, h("button", {
    type: "button",
    className: "fc-nav",
    onClick: prev,
    "aria-label": "הקודם",
    disabled: cards.length < 2
  }, h(Ico, {
    n: 'chevR',
    s: 22
  })), h(Btn, {
    kind: known ? 'ok' : 'pri',
    className: "fc-main",
    icon: known ? 'check' : null,
    onClick: () => known ? toggleStudied(card.hebrew) : onKnow(card.hebrew)
  }, known ? 'נלמד' : 'אני יודע · בדקו אותי'), h("button", {
    type: "button",
    className: "fc-nav",
    onClick: next,
    "aria-label": "הבא",
    disabled: cards.length < 2
  }, h(Ico, {
    n: 'chevL',
    s: 22
  })))), sheet && h(TopicSheet, {
    value: topic,
    onPick: setTopic,
    onClose: () => setSheet(false),
    locked: lockTopics,
    onLocked: () => onNeedAll && onNeedAll()
  }));
}


/* ---------- QUIZ BUILDER ---------- */
function buildQuiz(pool, n) {
  const kinds = ['pick-definition', 'pick-term', 'type-answer'];
  const items = [];
  const used = {};
  let g = 0;
  while (items.length < n && g < n * 25) {
    g++;
    const kind = kinds[items.length % 3];
    if (kind === 'type-answer') {
      const t = pool[Math.floor(Math.random() * pool.length)];
      if (used[t.hebrew]) continue;
      used[t.hebrew] = 1;
      items.push({
        kind,
        term: t,
        prompt: SL.defText(t),
        options: []
      });
    } else {
      const it = SL.generateItem(pool, maps, kind, Math.floor(Math.random() * 1e6));
      if (used[it.term.hebrew]) continue;
      used[it.term.hebrew] = 1;
      items.push(it);
    }
  }
  return items;
}

/* ---------- QUIZ ---------- */
function QuizSetup({
  pool,
  len,
  setLen,
  topic,
  onTopic,
  hardOnly,
  setHardOnly,
  weakSpots,
  toggleWeak,
  examMode,
  toggleExam,
  favCount,
  lockTopics,
  onNeedAll,
  tier,
  start
}) {
  const tp = topic ? TBK[topic] : null;
  const n = Math.min(len, pool.length);
  return h(Frag, null, h("div", {
    className: "hero"
  }, h("h1", null, "מבחון"), h("p", null, "בחירה מרובה \xB7 השלמת מושג \xB7 בדיקה עצמית")), lockTopics && h("button", {
    type: "button",
    className: "notice",
    onClick: () => onNeedAll && onNeedAll()
  }, h(Ico, {
    n: 'lock',
    s: 18
  }), h("span", null, "גרסה חינמית: נושא אחד לדוגמה. ", h("b", null, "הרשמה חינמית לכל 21 הנושאים")), h(Ico, {
    n: 'chevL',
    s: 16
  })), h("h2", {
    className: "sec-title"
  }, "נושא"), h("div", {
    className: "filters"
  }, h(FilterButton, {
    on: !!topic,
    icon: tp ? h(TopicIcon, {
      tp: tp
    }) : h(Ico, {
      n: 'filter',
      s: 18
    }),
    label: tp ? tp.label : 'כל הנושאים',
    onClick: onTopic
  })), h("h2", {
    className: "sec-title"
  }, "מספר שאלות"), h("div", {
    className: "seg seg-tall",
    role: "radiogroup",
    "aria-label": "מספר שאלות"
  }, [5, 10, 15, 20].map(k => h("button", {
    key: k,
    type: "button",
    role: "radio",
    "aria-checked": len === k,
    className: 'seg-b' + (len === k ? ' is-on' : ''),
    onClick: () => setLen(k)
  }, k, k === 10 && h("span", {
    className: "seg-rec"
  }, "מומלץ")))), h("h2", {
    className: "sec-title"
  }, "אפשרויות"), h("div", {
    className: "card list-card"
  }, h(SwitchRow, {
    icon: h(IcPin),
    label: 'מושגים לחזרה בלבד (' + favCount + ')',
    on: hardOnly,
    onClick: () => setHardOnly(x => !x)
  }), h(SwitchRow, {
    icon: 'target',
    label: 'חזרה ממוקדת',
    on: weakSpots,
    locked: !SL.canAccess('weakspots', tier),
    onClick: toggleWeak
  }), h(SwitchRow, {
    icon: 'timer',
    label: 'מצב בחינה · 15 שניות לשאלה',
    on: examMode,
    locked: !SL.canAccess('exam', tier),
    onClick: toggleExam
  })), h("div", {
    className: "cta-bar"
  }, pool.length < 3 ? h("p", {
    className: "field-msg is-warn"
  }, h(Ico, {
    n: 'alert',
    s: 16
  }), " מעט מדי מושגים בסינון הזה. נסו נושא אחר או כבו אפשרות.") : null, h(Btn, {
    className: "btn-block btn-lg",
    iconEnd: "arrowL",
    onClick: start,
    disabled: pool.length < 3
  }, "התחילו מבחון \xB7 ", n === 1 ? 'שאלה אחת' : n + ' שאלות')));
}
function Quiz({
  studied,
  toggleStudied,
  favorites,
  recordAnswer,
  recordQuiz,
  fireConfetti,
  tier,
  onNeedAll,
  needTier,
  setImmersive,
  preset
}) {
  const lockTopics = tier === 'free';
  const [topic, setTopic] = useState(lockTopics ? SL.FREE_TOPIC : '');
  const [len, setLen] = useState(10);
  const [hardOnly, setHardOnly] = useState(!!(preset && preset.hardOnly));
  const [weakSpots, setWeakSpots] = useState(false);
  const [examMode, setExamMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [sheet, setSheet] = useState('');
  const fmtT = s => Math.floor(Math.max(0, s) / 60) + ':' + String(Math.max(0, s) % 60).padStart(2, '0');
  const pickTopic = next => {
    if (lockTopics && next !== SL.FREE_TOPIC) {
      onNeedAll && onNeedAll();
      return;
    }
    setTopic(next);
  };
  const [quiz, setQuiz] = useState(null);
  const [qi, setQi] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [typed, setTyped] = useState('');
  const [warn, setWarn] = useState('');
  const [score, setScore] = useState(0);
  const [spark, setSpark] = useState(false);
  const inputRef = useRef(null);
  const pool = useMemo(() => {
    let p = SL.eligibleTerms(GLOSSARY, maps);
    if (topic) p = p.filter(t => t.topic === topic);
    if (weakSpots) p = p.filter(t => favorites.includes(t.hebrew) || !studied.includes(t.hebrew));else if (hardOnly) p = p.filter(t => favorites.includes(t.hebrew));
    return p;
  }, [topic, hardOnly, weakSpots, favorites, studied]);
  const running = !!quiz && qi < quiz.length;
  // contextual mode: while a quiz runs, the app header + bottom bar step aside for the quiz's own bar
  useEffect(() => {
    setImmersive && setImmersive(running);
  }, [running]); // eslint-disable-line
  useEffect(() => () => {
    setImmersive && setImmersive(false);
  }, []); // eslint-disable-line
  const start = () => {
    const L = Math.min(len, pool.length);
    setQuiz(buildQuiz(pool, L));
    setQi(0);
    setAnswered(false);
    setChosen(null);
    setTyped('');
    setWarn('');
    setScore(0);
    setTimeLeft(examMode ? L * 15 : 0);
    try {
      window.scrollTo(0, 0);
    } catch (e) {}
  };
  const item = quiz && quiz[qi];
  const grade = ok => {
    recordAnswer(ok);
    if (ok) {
      setScore(s => s + 1);
      setSpark(true);
      setTimeout(() => setSpark(false), 700);
      Snd.success();
      if (!studied.includes(item.term.hebrew)) toggleStudied(item.term.hebrew);
    } else {
      Snd.wrong();
      buzz(30);
    }
  };
  const answerMC = opt => {
    if (answered) return;
    setChosen(opt);
    setAnswered(true);
    grade(opt.correct);
  };
  const answerType = () => {
    if (answered) return;
    if (!typed.trim()) {
      // warning state: nothing to check yet, so do not grade an empty answer as wrong
      setWarn('הקלידו תשובה לפני הבדיקה');
      inputRef.current && inputRef.current.focus();
      return;
    }
    setWarn('');
    const ok = SL.checkAnswer(item, typed, maps);
    setAnswered(true);
    setChosen({
      correct: ok
    });
    grade(ok);
  };
  const nextQ = () => {
    if (qi + 1 >= quiz.length) {
      recordQuiz(score, quiz.length);
      if (score === quiz.length && quiz.length > 0) {
        fireConfetti();
        Snd.fanfare();
      }
      setQi(quiz.length);
      return;
    }
    setQi(qi + 1);
    setAnswered(false);
    setChosen(null);
    setTyped('');
    setWarn('');
    try {
      window.scrollTo(0, 0);
    } catch (e) {}
  };
  // exam-mode countdown: when time runs out, jump to results with the current score
  useEffect(() => {
    if (!examMode || !quiz || qi >= quiz.length) return;
    if (timeLeft <= 0) {
      recordQuiz(score, quiz.length);
      setQi(quiz.length);
      return;
    }
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [examMode, quiz, qi, timeLeft]); // eslint-disable-line

  if (!quiz) return h(Frag, null, h(QuizSetup, {
    pool,
    len,
    setLen,
    topic,
    onTopic: () => setSheet('topic'),
    hardOnly,
    setHardOnly: f => {
      setWeakSpots(false);
      setHardOnly(f);
    },
    weakSpots,
    toggleWeak: () => {
      if (!weakSpots) {
        if (!needTier('weakspots')) return;
        setHardOnly(false);
      }
      setWeakSpots(w => !w);
    },
    examMode,
    toggleExam: () => {
      if (!examMode && !needTier('exam')) return;
      setExamMode(e => !e);
    },
    favCount: favorites.length,
    lockTopics,
    onNeedAll,
    tier,
    start
  }), sheet === 'topic' && h(TopicSheet, {
    value: topic,
    onPick: pickTopic,
    onClose: () => setSheet(''),
    locked: lockTopics,
    onLocked: () => onNeedAll && onNeedAll()
  }));
  if (qi >= quiz.length) {
    const pct = Math.round(score / quiz.length * 100);
    const msg = pct >= 80 ? 'מצוין! שולטים בחומר' : pct >= 60 ? 'כל הכבוד, עוד קצת חזרה' : 'שווה עוד סבב חזרה';
    return h(Frag, null, h("div", {
      className: "hero"
    }, h("h1", null, "סיימתם!")), h("section", {
      className: "card result"
    }, h(Ring, {
      pct: pct,
      color: pct >= 60 ? 'var(--ok)' : 'var(--warn)'
    }), h("div", {
      className: "result-score"
    }, h("span", {
      className: "num-ltr"
    }, score + '/' + quiz.length)), h("p", null, msg), h("div", {
      className: "btn-row"
    }, h(Btn, {
      onClick: start,
      icon: "flip"
    }, "מבחון נוסף"), h(Btn, {
      kind: "ghost",
      onClick: () => setQuiz(null)
    }, "שינוי הגדרות"))));
  }
  const isType = item.kind === 'type-answer';
  const wrongTyped = isType && answered && chosen && !chosen.correct;
  return h(Frag, null, spark && h("div", {
    className: "spark-pop",
    "aria-hidden": "true"
  }, "✨"), h("div", {
    className: "qbar"
  }, h("button", {
    type: "button",
    className: "icon-btn",
    onClick: () => setSheet('quit'),
    "aria-label": "יציאה מהמבחון"
  }, h(Ico, {
    n: 'x',
    s: 22
  })), h("div", {
    className: "bar",
    role: "progressbar",
    "aria-valuemin": 0,
    "aria-valuemax": quiz.length,
    "aria-valuenow": qi
  }, h("i", {
    style: {
      width: `${qi / quiz.length * 100}%`
    }
  })), h("span", {
    className: "qbar-n"
  }, qi + 1, "/", quiz.length), examMode ? h("span", {
    className: 'qbar-t' + (timeLeft <= 15 ? ' is-low' : '')
  }, h(Ico, {
    n: 'timer',
    s: 16
  }), fmtT(timeLeft)) : h("span", {
    className: "qbar-s"
  }, h(Ico, {
    n: 'check',
    s: 16
  }), score)), h("span", {
    className: "label"
  }, item.kind === 'pick-definition' ? 'בחרו את ההגדרה הנכונה' : item.kind === 'pick-term' ? 'בחרו את המושג הנכון' : 'הקלידו את המושג'), h("div", {
    className: "q-q"
  }, item.kind === 'pick-definition' ? h(Frag, null, "מהו ", h("span", {
    className: "hl mnk"
  }, termLabel(item.term)), "?") : item.prompt), h(Btn, {
    kind: "ghost",
    size: "sm",
    className: "q-say",
    onClick: () => Speak2(item.kind === 'pick-definition' ? item.term.hebrew : item.prompt, item.kind === 'pick-definition' ? item.term.nikud : null)
  }, h(IcSpeaker), " הקראה"), isType ? h(Frag, null, h("div", {
    className: "q-type-in"
  }, h("input", {
    ref: inputRef,
    className: 'field' + (warn ? ' is-warn' : '') + (wrongTyped ? ' is-error' : '') + (answered && chosen && chosen.correct ? ' is-ok' : ''),
    value: typed,
    onChange: e => {
      setTyped(e.target.value);
      if (warn) setWarn('');
    },
    disabled: answered,
    placeholder: "הקלידו את המושג…",
    "aria-label": "תשובה",
    "aria-invalid": wrongTyped || undefined,
    "aria-describedby": "q-msg",
    enterKeyHint: "done",
    autoComplete: "off",
    autoCorrect: "off",
    onFocus: e => keepAboveKeyboard(e.target.closest('.q-type-in')),
    onKeyDown: e => e.key === 'Enter' && answerType()
  }), !answered && h(Btn, {
    onClick: answerType
  }, "בדיקה")), h("div", {
    id: "q-msg",
    "aria-live": "polite"
  }, warn ? h("p", {
    className: "field-msg is-warn"
  }, h(Ico, {
    n: 'alert',
    s: 16
  }), " ", warn) : answered && chosen && (chosen.correct ? h("p", {
    className: "field-msg is-ok"
  }, h(Ico, {
    n: 'check',
    s: 16
  }), " נכון! ", termLabel(item.term)) : h("p", {
    className: "field-msg is-error"
  }, h(Ico, {
    n: 'x',
    s: 16
  }), " לא מדויק. התשובה: ", h("b", null, termLabel(item.term)))))) : h("div", {
    className: "opts",
    role: "group",
    "aria-label": "תשובות"
  }, item.options.map((o, idx) => {
    let cls = 'opt';
    if (answered) {
      if (o.correct) cls += ' correct';else if (chosen === o) cls += ' wrong';else cls += ' dim';
    }
    return h("button", {
      key: idx,
      type: "button",
      className: cls,
      onClick: () => answerMC(o),
      disabled: answered
    }, h("span", {
      className: "mk"
    }, answered && o.correct ? h(Ico, {
      n: 'check',
      s: 14
    }) : answered && chosen === o ? h(Ico, {
      n: 'x',
      s: 14
    }) : String.fromCharCode(1488 + idx)), h("span", null, o.text));
  })), answered && !isType && (chosen && chosen.correct ? h("div", {
    className: "fb ok",
    role: "status"
  }, h(Ico, {
    n: 'check',
    s: 18
  }), " כל הכבוד!") : h("div", {
    className: "fb no",
    role: "status"
  }, h(Ico, {
    n: 'x',
    s: 18
  }), " התשובה הנכונה מסומנת בירוק")), answered && h("div", {
    className: "cta-bar"
  }, h(Btn, {
    className: "btn-block btn-lg",
    iconEnd: "arrowL",
    onClick: nextQ
  }, qi + 1 >= quiz.length ? 'לתוצאות' : 'לשאלה הבאה')), sheet === 'quit' && h(Sheet, {
    onClose: () => setSheet(''),
    title: "לצאת מהמבחון?",
    footer: close => h(Frag, null, h(Btn, {
      className: "btn-block",
      onClick: close
    }, "המשך במבחון"), h(Btn, {
      kind: "danger",
      className: "btn-block",
      onClick: () => {
        close();
        setTimeout(() => setQuiz(null), 230);
      }
    }, "יציאה"))
  }, h("p", {
    className: "muted"
  }, "עניתם על ", qi + (answered ? 1 : 0), " מתוך ", quiz.length, " שאלות. המבחון לא ייספר כמבחון שהושלם.")));
}

/* ---------- ABOUT ---------- */
function Testimonials() {
  const [all, setAll] = useState(false);
  const list = all ? TESTIMONIALS : TESTIMONIALS.slice(0, 3);
  return h(Frag, null, h("div", {
    className: "tst-list"
  }, list.map((t, i) => h("figure", {
    className: "card tst",
    key: i
  }, h("blockquote", null, t.t), h("figcaption", null, h("img", {
    className: "tst-av",
    src: t.img,
    alt: "",
    loading: "lazy",
    width: "40",
    height: "40"
  }), h("span", {
    className: "tst-n"
  }, t.n), h("span", {
    className: "badge badge-ok",
    title: "ציון בגרות"
  }, t.g))))), !all && h(Btn, {
    kind: "ghost",
    className: "btn-block",
    iconEnd: "chevD",
    onClick: () => setAll(true)
  }, "עוד ", TESTIMONIALS.length - 3, " המלצות"));
}
// 5s per photo. Honours prefers-reduced-motion: there we show one photo and let the dots drive.
function Classroom() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let reduce = false;
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}
    if (reduce || paused) return;
    const id = setInterval(() => setI(n => (n + 1) % CLASSROOM.length), 5000);
    return () => clearInterval(id);
  }, [paused]);
  return h("div", {
    className: "cr-wrap"
  }, h("div", {
    className: "cr-stage"
  }, CLASSROOM.map((s, n) => h("img", {
    key: s.src,
    src: s.src,
    alt: s.alt,
    loading: "lazy",
    className: 'cr-img' + (n === i ? ' on' : ''),
    "aria-hidden": n !== i
  })), h("div", {
    className: "cr-cap",
    "aria-hidden": "true"
  }, CLASSROOM[i].alt), h("button", {
    type: "button",
    className: "cr-pp",
    onClick: () => setPaused(p => !p),
    "aria-label": paused ? 'המשך הצגת התמונות' : 'עצירת הצגת התמונות'
  }, h(Ico, {
    n: paused ? 'play' : 'pause',
    s: 18
  }))), h("div", {
    className: "cr-dots"
  }, CLASSROOM.map((s, n) => h("button", {
    key: n,
    type: "button",
    className: 'cr-dot' + (n === i ? ' on' : ''),
    onClick: () => setI(n),
    "aria-label": 'תמונה ' + (n + 1) + ' מתוך ' + CLASSROOM.length,
    "aria-current": n === i || undefined
  }))));
}
const BOOKS = [{
  img: 'book-questions.jpg',
  alt: 'כריכת ספר השאלות',
  tag: 'מהדורה II',
  title: 'ספר השאלות',
  desc: '1,706 שאלות בגרות, לפי נושא ותת-נושא.',
  price: '₪149'
}, {
  img: 'book-research.jpg',
  alt: 'כריכת קטעי מחקר',
  tag: 'פורמט בגרות',
  title: 'קטעי מחקר',
  desc: '50 קטעים בפורמט בגרות, עם פתרונות מלאים.',
  price: '₪95'
}, {
  img: 'book-glossary.jpg',
  alt: 'כריכת המונחון',
  tag: 'תשפ״ו · 2026',
  title: 'מונחון',
  desc: '452 מושגים מנוקדים, בדפוס.',
  price: '₪69'
}];
function About() {
  const waBook = b => WA + '?text=' + encodeURIComponent('אשמח להזמין את ' + b.title + ' (' + b.price + ')');
  const contact = [['chat', 'WhatsApp', WA, true], ['phone', '052-429-5838', 'tel:+972524295838', false], ['camera', '@bio_bagrut', 'https://instagram.com/bio_bagrut', true], ['mail', 'מייל', 'mailto:biomedilab88@gmail.com', false]];
  return h(Frag, null, h("div", {
    className: "hero"
  }, h("h1", null, "אודות"), h("p", null, "נתנאל יוחאי מדינה \xB7 מורה לביולוגיה ולביוטכנולוגיה")), h("div", {
    className: "about-hero"
  }, h("img", {
    className: "portrait",
    src: "portrait.jpg",
    alt: "נתנאל מדינה"
  }), h("div", null, h("div", {
    className: "label"
  }, "שיעורים פרטיים \xB7 5 יח״ל \xB7 ביוטכנולוגיה 10 יח״ל"), h("div", {
    className: "about-name"
  }, "נעים להכיר, נתנאל"))), h("p", {
    className: "body-t"
  }, "מורה לביולוגיה ולביוטכנולוגיה עם ", h("b", null, "10 שנות ניסיון בהכנה לבגרות"), " בביולוגיה (5 יח״ל) ובביוטכנולוגיה (10 יח״ל)."), h("p", {
    className: "body-t"
  }, h("b", null, "שיעורים אחד-על-אחד או בקבוצות קטנות"), ", מקוון בזום או פרונטלי במרכז ״כיוונים״ באשדוד. שיחת היכרות ראשונה תמיד על חשבוני."), h("blockquote", {
    className: "quote"
  }, "״אני מאמין שלכל תלמיד יש דרך משלו להבין, והתפקיד שלי הוא למצוא אותה.״"), h("div", {
    className: "card stat-row"
  }, [['94', 'ציון ממוצע'], ['100', 'הציון הגבוה'], ['10+', 'שנות ניסיון']].map(([b, s]) => h("div", {
    className: "stat",
    key: s
  }, h("b", {
    dir: "ltr"
  }, b), h("span", null, s)))), h("div", {
    className: "card list-card degrees"
  }, [['B.Sc', 'ביולוגיה', 'אוניברסיטת חיפה'], ['M.Teach', 'הוראת ביולוגיה', 'מכללת אורנים'], ['M.Sc', 'הוראת המדעים', 'מכון ויצמן למדע']].map(([tg, b, s]) => h("div", {
    className: "degree",
    key: tg
  }, h("span", {
    className: "badge"
  }, tg), h("div", null, h("b", null, b), h("span", null, s))))), h("h2", {
    className: "sec-title"
  }, "הלומדה המלאה"), h("p", {
    className: "sec-sub"
  }, "שליפים הוא המונחון. באתר מחכה כל השאר."), h("section", {
    className: "card lomda"
  }, h("p", null, "כל תת-נושא מקבל דרגת שליטה שעולה רק מתשובות נכונות על שאלות בגרות אמיתיות. כך רואים בדיוק מה עוד לא סגור, במקום להרגיש שקראתם."), h("div", {
    className: "stat-row flat"
  }, [['893', 'שאלות בגרות אמיתיות'], ['24', 'פרקים · 3 קורסי ליבה'], ['1971–2025', 'שנות מועדים']].map(([b, s]) => h("div", {
    className: "stat",
    key: s
  }, h("b", {
    dir: "ltr"
  }, b), h("span", null, s)))), h("ul", {
    className: "lomda-list"
  }, h("li", null, "הסבר לכל תשובה, נכונה או שגויה, שמראה איפה בדיוק נפלתם"), h("li", null, "שלושה רמזים מדורגים בכל שאלה שנתקעתם בה"), h("li", null, "שאלה אישית למורה על כל שאלה, עם תשובה בדרך כלל באותו יום"), h("li", null, "מפת מסע אישית ב-24 פרקים, ומדליה על כל פרק שנסגר")), h("a", {
    className: "btn btn-pri btn-block",
    href: SITE + '/start',
    target: "_blank",
    rel: "noopener"
  }, h("span", {
    className: "btn-l"
  }, "14 יום חינם, בלי כרטיס אשראי"), h(Ico, {
    n: 'arrowL',
    s: 18
  }))), h("h2", {
    className: "sec-title"
  }, "מה תלמידים כותבים"), h("p", {
    className: "sec-sub"
  }, "הציון שקיבלו בבגרות מופיע לצד השם"), h(Testimonials), h("h2", {
    className: "sec-title"
  }, "רגעים מהכיתה"), h("p", {
    className: "sec-sub"
  }, "עשר שנים של שיעורים, מעבדות וסופי שנה"), h(Classroom), h("h2", {
    className: "sec-title"
  }, "שלושת הספרים שכתבתי"), h("p", {
    className: "sec-sub"
  }, "מותאמים לתוכנית הלימודים תשפ״ו \xB7 מנוקדים, מאוירים, נגישים"), h("div", {
    className: "books"
  }, BOOKS.map(b => h("article", {
    className: "card book",
    key: b.title
  }, h("img", {
    src: b.img,
    alt: b.alt,
    loading: "lazy"
  }), h("div", {
    className: "book-b"
  }, h("span", {
    className: "badge"
  }, b.tag), h("h4", null, b.title), h("p", null, b.desc), h("a", {
    className: "btn btn-pri btn-sm",
    href: waBook(b),
    target: "_blank",
    rel: "noopener"
  }, h("span", {
    className: "btn-l"
  }, "להזמנה \xB7 ", h("span", {
    className: "num-ltr"
  }, b.price))))))), h("p", {
    className: "sec-sub center"
  }, "פרק לדוגמה חינם מכל ספר \xB7 ", h("a", {
    className: "link",
    href: SITE + '/shop',
    target: "_blank",
    rel: "noopener"
  }, "לכל הספרים באתר")), h("section", {
    className: "card install-about"
  }, h("img", {
    src: "icon-192.png",
    alt: "",
    "aria-hidden": "true"
  }), h("h4", null, "התקינו את שליפים למסך הבית"), h("p", null, "גישה מהירה כמו אפליקציה אמיתית, עובדת גם ללא אינטרנט."), h(InstallButton)), h("h2", {
    className: "sec-title"
  }, "דברו איתי"), h("div", {
    className: "card list-card"
  }, contact.map(([ic, l, href, ext]) => h("a", {
    key: l,
    className: "row",
    href: href,
    target: ext ? '_blank' : undefined,
    rel: ext ? 'noopener' : undefined
  }, h("span", {
    className: "row-ic"
  }, h(Ico, {
    n: ic
  })), h("span", {
    className: "row-l"
  }, h("bdi", null, l)), h("span", {
    className: "row-end"
  }, h(Ico, {
    n: 'chevL',
    s: 16
  }))))), h("p", {
    className: "sec-sub center"
  }, "א׳ עד ה׳ \xB7 10:00 עד 21:00"), h("div", {
    className: "center"
  }, h("a", {
    className: "btn btn-ghost",
    href: SITE,
    target: "_blank",
    rel: "noopener"
  }, h("span", {
    className: "btn-l"
  }, "לאתר המלא"), h(Ico, {
    n: 'external',
    s: 18
  }))), h("p", {
    className: "credit"
  }, "אייקונים: ", h("a", {
    href: "https://github.com/jdecked/twemoji",
    target: "_blank",
    rel: "noopener"
  }, "Twemoji"), " \xB7 רישיון CC-BY 4.0"), h("nav", {
    className: "legal-links",
    "aria-label": "מידע משפטי"
  }, h("a", {
    href: "legal.html#terms",
    target: "_blank",
    rel: "noopener"
  }, "תנאי שימוש"), h("a", {
    href: "legal.html#privacy",
    target: "_blank",
    rel: "noopener"
  }, "מדיניות פרטיות"), h("a", {
    href: "legal.html#accessibility",
    target: "_blank",
    rel: "noopener"
  }, "הצהרת נגישות"), h("a", {
    href: "legal.html#refund",
    target: "_blank",
    rel: "noopener"
  }, "ביטולים והחזרים")), h("p", {
    className: "credit"
  }, "\xA9 2026 MediLab \xB7 נתנאל יוחאי מדינה \xB7 כל הזכויות שמורות"));
}

/* ---------- PROFILE / STATS / ACHIEVEMENTS ---------- */
function Ring({
  pct,
  color
}) {
  const r = 34,
    c = 2 * Math.PI * r,
    off = c * (1 - pct / 100);
  return h("svg", {
    width: "84",
    height: "84",
    viewBox: "0 0 84 84",
    className: "ring",
    role: "img",
    "aria-label": pct + '%'
  }, h("circle", {
    cx: "42",
    cy: "42",
    r: r,
    fill: "none",
    className: "ring-track",
    strokeWidth: "8"
  }), h("circle", {
    cx: "42",
    cy: "42",
    r: r,
    fill: "none",
    stroke: color || 'var(--act)',
    strokeWidth: "8",
    strokeLinecap: "round",
    strokeDasharray: c,
    strokeDashoffset: off,
    transform: "rotate(-90 42 42)",
    style: {
      transition: 'stroke-dashoffset .6s var(--ease)'
    }
  }), h("text", {
    x: "42",
    y: "49",
    textAnchor: "middle",
    fontWeight: "800",
    fontSize: "20",
    fill: "currentColor"
  }, pct, "%"));
}

/* ---------- CROSSWORD (embedded game, full screen) ---------- */
function Crossword({
  dark,
  setImmersive,
  onExit
}) {
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  useEffect(() => {
    setImmersive(true);
    const onMsg = e => {
      if (e.origin === window.location.origin && e.data && e.data.type === 'ml-cw-exit') exitRef.current();
    };
    window.addEventListener('message', onMsg);
    return () => {
      window.removeEventListener('message', onMsg);
      setImmersive(false);
    };
  }, []); // eslint-disable-line
  return h("div", {
    className: "cw-wrap"
  }, h("iframe", {
    key: dark ? 'd' : 'l',
    title: "\u05EA\u05E9\u05D1\u05E5 \u05D1\u05D9\u05D5\u05DC\u05D5\u05D2\u05D9\u05D4",
    className: "cw-frame",
    src: "crossword.html?embed=1&dark=" + (dark ? 1 : 0)
  }));
}

const WA = 'https://wa.me/972524295838';

/* ---------- ABOUT: content mirrored from medilabacademy.com ---------- */
const SITE = 'https://medilabacademy.com';
const CLASSROOM = [{
  src: 'classroom-1.webp',
  alt: 'שיעור על מבנה ה-DNA בכיתה'
}, {
  src: 'classroom-2.webp',
  alt: 'תלמידים בחלוקי מעבדה בפעילות בחוץ'
}, {
  src: 'classroom-3.webp',
  alt: 'תמונת סוף שנה עם הכיתה'
}, {
  src: 'classroom-4.webp',
  alt: 'עבודה בקבוצות בשיעור'
}, {
  src: 'classroom-5.webp',
  alt: 'הרצאה מול הכיתה'
}, {
  src: 'classroom-6.webp',
  alt: 'חגיגת סיום שנה'
}];
// Quotes are verbatim excerpts from medilabacademy.com; photos come from the same cards there,
// so a face is never paired with the wrong name.
const TESTIMONIALS = [{
  n: 'תהל ח׳',
  g: 85,
  img: 'rec-tahel.jpg',
  t: 'בתחילת כיתה י״א הגעתי לכיתה של נתנאל. ביולוגיה הרגישה לי כמו שפה זרה, והמבחן הראשון שלי נגמר ב-40. החלטתי שאני שונאת את זה — אבל נתנאל לא הסכים. השלמנו ביחד יותר משנה של פערים. הוא היה איתי גם כשרציתי לוותר, האמין בי והזכיר לי שאני מסוגלת.'
}, {
  n: 'אמלי ס׳',
  g: 88,
  img: 'rec-emily.jpg',
  t: 'נתנאל היה הרבה מעבר למורה עבורי. כשהיה לי קשה בלימודים, הוא תמיד דאג להבין מה הקושי האמיתי, ולהתאים את העזרה למה שאני צריכה באותו רגע. בלי העזרה המקצועית שלו לא הייתי מגיעה לציון שהגעתי אליו, ובלי האמונה שלו לא הייתי נמצאת במקום שאליו שאפתי להגיע.'
}, {
  n: 'יונתן מ׳',
  g: 89,
  img: 'rec-yonatan.jpg',
  t: 'נתנאל תמיד דאג לי כמורה — שאני אצליח בצורה הכי טובה שאפשר. הסביר את החומר בצורה הכי ברורה, ותמיד ענה על שאלות גם מחוץ לשיעור. אצל נתנאל באמת אפשר להגיד: מי שרצה — הצליח. הוא דאג לנו גם לימודית וגם אישית.'
}, {
  n: 'שון ס׳',
  g: 95,
  img: 'rec-shon.jpg',
  t: 'נתנאל מורה מעולה — גם בצורה שהוא מביא את הלימודים באופן נגיש עם דוגמאות מהעולם האמיתי להבנה עמוקה, וגם בגישה החיובית שלו. מעבר לחומר, הוא מורה שאוהב להרחיב את הידע, ומצית אהבה אצל התלמידים למדעים וביולוגיה בפרט.'
}, {
  n: 'איתן ו׳',
  g: 97,
  img: 'rec-eitan.jpg',
  t: 'נתנאל הוא הרבה יותר מסתם מורה, הוא המורה הטוב ביותר שזכיתי ללמוד אצלו. היכולת להפוך כל שיעור לחוויה היא נדירה, והוא דואג להעמיק ולהרחיב הרבה מעבר לתוכנית הלימודים — מתוך תשוקה אמיתית לידע. כשתלמיד שואל שאלה, הוא חוקר לעומק ומחזיר תשובה מפורטת וברורה.'
}, {
  n: 'רוני ב׳',
  g: 98,
  img: 'rec-roni.jpg',
  t: 'נתנאל הוא מורה מיוחד ולא שגרתי. מעורר השראה, נותן יחס אישי לכל תלמיד ומאמין בכולם. יודע למצוא את הדימוי המדויק שמסביר גם נושאים מורכבים, ומעביר שיעורים בצחוק ובחן. דורש מכל אחד את המקסימום ודוחף לקצה היכולת, כי ההצלחה שלנו חשובה לו.'
}, {
  n: 'דניאלה ק׳',
  g: 98,
  img: 'rec-daniela.jpg',
  t: 'נתנאל מורה מעורר השראה בכמות תשומת הלב שהפגנת כלפי כל קושי שתלמידים חוו, ועזרת לנווט אותם להצלחה במבחנים. תמיד היה חשוב לך להרחיב את האופקים ולהציג את התוכן בביולוגיה בצורה הכי מעניינת — מצגות מרתקות, מחקרים וניסויים מדהימים.'
}, {
  n: 'נועה א׳',
  g: 100,
  img: 'rec-noa.jpg',
  t: 'אם הייתם אומרים לי בתחילת כיתה י׳ שלא רק שאסיים בציון מעולה אלא גם אתאהב במקצוע, לא הייתי מאמינה. נתנאל הפך את המקצוע מתחום אפור ומשעמם למקצוע הכי מעניין שלמדתי בתיכון.'
}, {
  n: 'יולי א׳',
  g: 100,
  img: 'rec-yuli.jpg',
  t: 'נתנאל תמיד היה לי לאוזן קשבת, ולימוד איתו השאיר עליי חותם אמיתי. קשוב, סבלני, בגובה העיניים — והיה מוכן לעצור ולהסביר שוב, גם מיליון פעם בדרכים שונות. ביולוגיה היה בין השיעורים היחידים שאהבתי, והוא הסיבה לכך.'
}];
// Honest head start: step 1 is genuinely complete — you are looking at the app right now.
function Journey({
  m
}) {
  const steps = [{
    t: 'פתחתם את שליפים',
    done: true
  }, {
    t: 'מושג ראשון',
    done: m.studied >= 1
  }, {
    t: '10 מושגים',
    done: m.studied >= 10
  }, {
    t: 'מבחון ראשון',
    done: m.quizzes >= 1
  }, {
    t: 'נושא שלם',
    done: m.topicsCompleted >= 1
  }];
  const done = steps.filter(s => s.done).length;
  const next = steps.find(s => !s.done);
  return /*#__PURE__*/React.createElement("div", {
    className: "journey"
  }, /*#__PURE__*/React.createElement("div", {
    className: "jr-head"
  }, /*#__PURE__*/React.createElement("b", null, "\u05D4\u05DE\u05E1\u05E2 \u05E9\u05DC\u05DB\u05DD \u05DC\u05D1\u05D2\u05E8\u05D5\u05EA"), /*#__PURE__*/React.createElement("span", null, done, "/", steps.length)), /*#__PURE__*/React.createElement("div", {
    className: "jr-track"
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: `jr-step ${s.done ? 'on' : ''}`
  }, /*#__PURE__*/React.createElement("i", null, s.done ? '✓' : i + 1), /*#__PURE__*/React.createElement("span", null, s.t)))), next && /*#__PURE__*/React.createElement("p", {
    className: "jr-next"
  }, "\u05D4\u05D9\u05E2\u05D3 \u05D4\u05D1\u05D0: ", /*#__PURE__*/React.createElement("b", null, next.t), " \u2014 \u05DB\u05DE\u05E2\u05D8 \u05E9\u05DD \uD83D\uDCAA"));
}

function Profile({
  user,
  studied,
  favorites,
  stats,
  sync,
  signIn,
  signOut,
  onTopic,
  muted,
  toggleSound,
  dark,
  setDark,
  tier,
  authBusy
}) {
  const m = metrics(studied, favorites, stats);
  const earned = earnedIds(m);
  const earnedSet = {};
  earned.forEach(id => earnedSet[id] = 1);
  const goal = nextGoal(m.studied, TOTAL);
  const goalPct = Math.min(100, Math.round(m.studied / goal * 100));
  const pct = Math.round(m.studied / TOTAL * 100);
  const acc = Math.round(m.accuracy * 100);
  const perTopic = TOPICS.map(t => ({
    t,
    total: topicTotals[t.key] || 0,
    done: studied.filter(x => topicOf[x] === t.key).length
  })).filter(x => x.total > 0);
  const rows = [['דיוק במבחנים', acc + '%'], ['שאלות שנענו', m.answered], ['מבחנים', m.quizzes], ['מבחנים מושלמים', m.perfect], ['ימים ברצף', m.dayStreak], ['שיא רצף', m.maxDayStreak], ['תשבצים שנפתרו', stats.cwSolved || 0]];
  if (stats.cwBest != null && stats.cwBest < 99999) rows.push(['שיא תשבץ', fmtSec(stats.cwBest)]);
  return h(Frag, null, h("div", {
    className: "hero"
  }, h("h1", null, "אזור אישי")), h("section", {
    className: "card prof-card"
  }, h("div", {
    className: "av"
  }, user && user.photoURL ? h("img", {
    src: user.photoURL,
    referrerPolicy: "no-referrer",
    alt: ""
  }) : h(Ico, {
    n: 'user',
    s: 28
  })), h("span", {
    className: 'badge' + (tier === SL.TIER.PAID ? ' badge-act' : '')
  }, tier === SL.TIER.PAID ? 'מסלול בגרות' : tier === SL.TIER.REGISTERED ? 'מסלול הרשמה' : 'אורח'), user ? h(Frag, null, h("div", {
    className: "prof-name"
  }, user.displayName || 'תלמיד/ה'), h("div", {
    className: "prof-email"
  }, user.email), sync && h("span", {
    className: 'sync-pill s-' + sync,
    role: "status"
  }, sync === 'syncing' ? h(Spinner) : h(Ico, {
    n: sync === 'synced' ? 'check' : 'alert',
    s: 14
  }), sync === 'syncing' ? 'מסנכרן' : sync === 'synced' ? 'מסונכרן' : 'שגיאת סנכרון'), h(Btn, {
    kind: "ghost-danger",
    size: "sm",
    icon: "logout",
    onClick: signOut
  }, "התנתקות")) : h(Frag, null, h("div", {
    className: "prof-name"
  }, "לימוד כאורח"), h("p", {
    className: "sync-note"
  }, "התחברו עם Google כדי לסנכרן התקדמות, הישגים וסטטיסטיקה בין כל המכשירים."), h(GoogleBtn, {
    onClick: signIn,
    busy: authBusy
  }))), h(Journey, {
    m: m
  }), h("h2", {
    className: "sec-title"
  }, "היעד הקרוב"), h("section", {
    className: "card ring-card"
  }, h(Ring, {
    pct: goalPct
  }), h("div", {
    className: "ring-stats"
  }, h("div", null, h("b", null, m.studied, "/", goal), h("span", null, "מושגים ליעד")), h("div", null, h("b", null, m.hard), h("span", null, "מושגים לחזרה")))), h("p", {
    className: "goal-note"
  }, m.studied < goal ? h(Frag, null, "עוד ", h("b", null, goal - m.studied), " מושגים והיעד נסגר \xB7 בסך הכול ", m.studied, " מתוך ", TOTAL, " (", pct, "%)") : h(Frag, null, "סיימתם את כל ", TOTAL, " המושגים")), h("h2", {
    className: "sec-title"
  }, "ביצועים"), h("section", {
    className: "card list-card"
  }, rows.map(([k, v]) => h("div", {
    className: "kv",
    key: k
  }, h("span", null, k), h("b", null, v)))), h("h2", {
    className: "sec-title"
  }, "התקדמות לפי נושא"), h("section", {
    className: "card list-card"
  }, perTopic.map(({
    t,
    total,
    done
  }) => {
    const p = Math.round(done / total * 100);
    return h("button", {
      type: "button",
      className: "topic-row",
      key: t.key,
      onClick: () => onTopic(t.key)
    }, h("span", {
      className: "tr-top"
    }, h("span", {
      className: "tr-l"
    }, h(TopicIcon, {
      tp: t
    }), t.label), h("span", {
      className: "tr-v"
    }, done, "/", total), h(Ico, {
      n: 'chevL',
      s: 16
    })), h("span", {
      className: "tbar"
    }, h("i", {
      style: {
        width: p + '%',
        background: t.primary
      }
    })));
  })), h("h2", {
    className: "sec-title"
  }, "הגדרות"), h("section", {
    className: "card list-card"
  }, h(SwitchRow, {
    icon: 'sound',
    label: 'צלילי משוב',
    on: !muted,
    onClick: toggleSound
  }), h(SwitchRow, {
    icon: 'moon',
    label: 'מצב כהה',
    on: !!dark,
    onClick: () => setDark(d => !d)
  })), h("div", {
    className: "sec-head"
  }, h("h2", {
    className: "sec-title"
  }, "הישגים"), h("span", {
    className: "badge"
  }, earned.length, "/", ACH.length)), h("div", {
    className: "ach-list"
  }, ACH.map(a => {
    const on = !!earnedSet[a.id];
    let have = 0,
      need = 0,
      pc = 0,
      showBar = false;
    if (!on && a.prog) {
      const p = a.prog(m) || [0, 0];
      need = p[1] || 0;
      have = Math.max(0, Math.min(p[0] || 0, need));
      pc = need ? Math.round(have / need * 100) : 0;
      showBar = need > 1;
    }
    return h("div", {
      key: a.id,
      className: 'card ach' + (on ? ' is-on' : '')
    }, h("span", {
      className: "ach-em",
      "aria-hidden": "true"
    }, a.emoji), h("div", {
      className: "ach-txt"
    }, h("b", null, a.title), h("span", null, on ? a.desc : a.todo), showBar && h(Frag, null, h("span", {
      className: "tbar"
    }, h("i", {
      style: {
        width: pc + '%'
      }
    })), h("span", {
      className: "ach-n"
    }, have, " מתוך ", need))), on && h("span", {
      className: "ach-ok",
      "aria-label": "הושג"
    }, h(Ico, {
      n: 'check',
      s: 16
    })));
  })));
}

/* ---------- TERM QUESTION (active recall on a single term) ---------- */
function TermQuiz({
  hebrew,
  onClose,
  onResult
}) {
  const t = maps.byHeb[hebrew];
  const [sel, setSel] = useState(null);
  const done = useRef(false);
  const ct = t && (t.aliasOf ? SL.resolveEntry(t.hebrew, maps) || t : t);
  const def = ct && SL.defText(ct);
  const opts = useMemo(() => {
    if (!ct) return [];
    const dis = SL.pickDistractors(GLOSSARY, ct, maps, 2, 'paraphrase');
    return [{
      text: def,
      correct: true
    }].concat(dis.map(d => ({
      text: SL.defText(d),
      correct: false
    }))).sort(() => Math.random() - 0.5);
  }, [hebrew]); // eslint-disable-line
  if (!t) return null;
  const answer = o => {
    if (sel) return;
    setSel(o);
    o.correct ? Snd.success() : Snd.wrong();
    if (!done.current) {
      done.current = true;
      if (onResult) onResult(o.correct);
    }
  };
  return h(Sheet, {
    onClose: onClose,
    label: termLabel(t),
    className: "tq",
    footer: sel ? close => h(Btn, {
      className: "btn-block",
      onClick: close
    }, "סגירה") : null
  }, h("div", {
    className: "tq-head"
  }, h("div", null, h("div", {
    className: "od-term"
  }, termLabel(t)), t.english && h("div", {
    className: "en"
  }, t.english)), h("button", {
    type: "button",
    className: "ibtn",
    onClick: () => Speak2(t.hebrew, t.nikud),
    "aria-label": "הקראה"
  }, h(IcSpeaker))), t.topic && h(TopicTag, {
    topicKey: t.topic
  }), h("p", {
    className: "label tq-q"
  }, "מהו ", termLabel(t), "? בחרו את ההגדרה הנכונה"), h("div", {
    className: "opts"
  }, opts.map((o, i) => {
    let cls = 'opt';
    if (sel) {
      if (o.correct) cls += ' correct';else if (sel === o) cls += ' wrong';else cls += ' dim';
    }
    return h("button", {
      key: i,
      type: "button",
      className: cls,
      disabled: !!sel,
      onClick: () => answer(o)
    }, h("span", {
      className: "mk"
    }, sel && o.correct ? h(Ico, {
      n: 'check',
      s: 14
    }) : sel === o ? h(Ico, {
      n: 'x',
      s: 14
    }) : String.fromCharCode(1488 + i)), h("span", null, o.text));
  })), sel && h("div", {
    className: 'fb ' + (sel.correct ? 'ok' : 'no'),
    role: "status"
  }, h(Ico, {
    n: sel.correct ? 'check' : 'info',
    s: 18
  }), sel.correct ? ' כל הכבוד! ידעתם את המושג' : ' אל דאגה, ההגדרה הנכונה מסומנת בירוק'));
}

/* ---------- GATES ---------- */
function SignUpGate({
  onClose,
  onSignIn,
  studied,
  favorites,
  authBusy
}) {
  const built = (studied || 0) + (favorites || 0);
  return h(Sheet, {
    onClose: onClose,
    className: "gate",
    label: built > 0 ? 'אל תאבדו את מה שבניתם' : 'הירשמו בחינם כדי לפתוח',
    footer: close => h(Frag, null, h(GoogleBtn, {
      onClick: onSignIn,
      busy: authBusy
    }, "המשך עם Google"), h(Btn, {
      kind: "ghost",
      className: "btn-block",
      onClick: close
    }, "אולי אחר כך"))
  }, h("div", {
    className: "gate-ic"
  }, h(Ico, {
    n: built > 0 ? 'save' : 'key',
    s: 28
  })), h("h2", {
    className: "sheet-title center"
  }, built > 0 ? 'אל תאבדו את מה שבניתם' : 'הירשמו בחינם כדי לפתוח'), built > 0 && h("div", {
    className: "wells"
  }, h("div", null, h("b", null, studied), h("span", null, "מושגים שלמדתם")), h("div", null, h("b", null, favorites), h("span", null, "מושגים שסימנתם"))), built > 0 && h("p", {
    className: "callout warn"
  }, h(Ico, {
    n: 'alert',
    s: 18
  }), h("span", null, "ההתקדמות הזו שמורה ", h("b", null, "רק במכשיר הזה"), ". ניקוי הדפדפן או מעבר לטלפון אחר, והכול נעלם.")), h("p", {
    className: "muted center"
  }, built > 0 ? 'חשבון חינמי שומר הכול בענן, ובנוסף פותח את כל מצבי התרגול וההקראה.' : 'המילון פתוח לכם בחינם וללא הרשמה. חשבון חינמי מוסיף את כל מצבי התרגול, ההקראה, מעקב ההתקדמות והסנכרון בין המכשירים.'), h("p", {
    className: "fine center"
  }, "חינם לחלוטין \xB7 בלי סיסמה \xB7 פחות מ‑10 שניות"));
}
function Paywall({
  onClose,
  user,
  onSignIn,
  authBusy
}) {
  const [plan, setPlan] = useState('year');
  const wa = txt => 'https://wa.me/972524295838?text=' + encodeURIComponent(txt);
  const P = {
    month: {
      name: 'חודשי',
      per: '₪4.99',
      note: '₪59.88 לשנה',
      total: '₪4.99 לחודש',
      msg: 'אשמח לרכוש מנוי חודשי (₪4.99) בשליפים'
    },
    year: {
      name: 'שנתי',
      per: '₪1.99',
      note: 'חיוב שנתי ₪23.99 · חוסכים ₪35.89',
      total: '₪23.99 לשנה',
      msg: 'אשמח לרכוש מנוי שנתי (₪23.99) בשליפים'
    }
  };
  const sel = P[plan];
  return h(Sheet, {
    onClose: onClose,
    className: "gate paywall",
    label: "מסלול הבגרות",
    footer: close => h(Frag, null, h("a", {
      className: "btn btn-pri btn-block btn-lg",
      href: wa(sel.msg),
      target: "_blank",
      rel: "noopener"
    }, h("span", {
      className: "btn-l"
    }, "להמשך \xB7 ", h("span", {
      className: "num-ltr"
    }, sel.total))), h(Btn, {
      kind: "ghost",
      className: "btn-block",
      onClick: close
    }, "לא עכשיו"))
  }, h("div", {
    className: "gate-ic star"
  }, h(Ico, {
    n: 'star',
    s: 28
  })), h("h2", {
    className: "sheet-title center"
  }, "מסלול הבגרות"), h("p", {
    className: "muted center"
  }, "התשבץ וכלי בגרות מתקדמים נוספים."), h("div", {
    className: "wells anchors"
  }, h("div", null, h("span", null, "שלושת ספרי העזר המודפסים"), h("s", {
    className: "num-ltr"
  }, "₪313")), h("div", null, h("span", null, "ספר השאלות בלבד"), h("s", {
    className: "num-ltr"
  }, "₪149"))), h("p", {
    className: "label center"
  }, "מסלול הבגרות באפליקציה, לשנה שלמה"), h("div", {
    className: "plans",
    role: "radiogroup",
    "aria-label": "בחירת מנוי"
  }, ['month', 'year'].map(k => h("button", {
    key: k,
    type: "button",
    role: "radio",
    "aria-checked": plan === k,
    className: 'plan' + (plan === k ? ' is-on' : ''),
    onClick: () => setPlan(k)
  }, k === 'year' && h("span", {
    className: "plan-badge"
  }, "הכי משתלם"), h("span", {
    className: "plan-name"
  }, P[k].name), h("b", {
    className: "plan-per num-ltr"
  }, P[k].per), h("span", {
    className: "plan-unit"
  }, "לחודש"), h("span", {
    className: "plan-note"
  }, P[k].note), h("span", {
    className: "plan-radio",
    "aria-hidden": "true"
  })))), !user && h("div", {
    className: "paywall-auth"
  }, h("p", {
    className: "muted center"
  }, "כדי לשמור את המנוי צריך תחילה חשבון:"), h(GoogleBtn, {
    onClick: onSignIn,
    busy: authBusy
  }, "התחברו עם Google")), h("p", {
    className: "fine center"
  }, "התשלום ייפתח בקרוב. כרגע הרכישה מוקדמת דרך וואטסאפ."));
}


/* ---------- APP ---------- */
const SUB = {
  review: 1,
  about: 1
};
function App() {
  const [mode, setMode] = useState('glossary');
  const [prevMode, setPrevMode] = useState('glossary');
  const [viewAnim, setViewAnim] = useState('');
  const [immersive, setImmersive] = useState(false);
  const [glossaryTopic, setGlossaryTopic] = useState('');
  const [gq, setGq] = useState('');
  const [gLetter, setGLetter] = useState('');
  const [quizPreset, setQuizPreset] = useState(null);
  const [menu, setMenu] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const lastTabRef = useRef('glossary');
  const viewRef = useRef(null);
  const scrollMem = useRef({});
  const toTop = () => {
    try {
      window.scrollTo(0, 0);
    } catch (e) {}
  };
  const changeMode = m => {
    if (m === 'crossword' && !needTier('crossword')) return;
    if (m === 'crossword' && mode !== 'crossword') {
      lastTabRef.current = SUB[mode] ? prevMode : mode;
      try {
        history.pushState({
          shl: 'cw'
        }, '');
      } catch (e) {}
    }
    if (m === 'glossary') {
      setGlossaryTopic('');
      if (mode === 'glossary') {
        setGq('');
        setGLetter('');
      }
    }
    if (m !== 'quiz') setQuizPreset(null);
    if (SUB[mode]) {
      try {
        if (history.state && history.state.shl) history.replaceState(null, '');
      } catch (e) {}
    }
    setViewAnim('');
    setMode(m);
    toTop();
  };
  const openTopic = key => {
    setGlossaryTopic(key);
    setGq('');
    setGLetter('');
    setViewAnim('');
    setMode('glossary');
    toTop();
  };
  // sub-pages (review, about) open on top of the current tab and support swipe-back
  const goSub = m => {
    if (mode === m) return;
    if (!SUB[mode]) {
      setPrevMode(mode);
      scrollMem.current[mode] = window.scrollY;
    }
    setViewAnim('push');
    setMode(m);
    toTop();
    try {
      history.pushState({
        shl: m
      }, '');
    } catch (e) {}
  };
  const backAnim = useRef(false);
  const doBack = useCallback(() => {
    if (backAnim.current) return;
    backAnim.current = true;
    const el = viewRef.current;
    if (el) {
      el.style.transition = 'transform .2s var(--ease), opacity .2s';
      el.style.transform = 'translateX(-100%)';
      el.style.opacity = '0';
    }
    setTimeout(() => {
      backAnim.current = false;
      setViewAnim('back');
      setMode(p => SUB[p] ? prevModeRef.current : p);
      const y = scrollMem.current[prevModeRef.current] || 0;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        try {
          window.scrollTo(0, y);
        } catch (e) {}
      }));
    }, 190);
  }, []);
  const prevModeRef = useRef(prevMode);
  prevModeRef.current = prevMode;
  const goBack = () => {
    try {
      if (history.state && history.state.shl) {
        history.back();
        return;
      }
    } catch (e) {}
    doBack();
  };
  // the crossword is a full-screen game: its own X (or the phone's back button) returns to the previous tab
  const exitCw = useCallback(() => {
    const back = lastTabRef.current;
    setViewAnim('');
    setMode(back && back !== 'crossword' ? back : 'glossary');
    toTop();
  }, []);
  const leaveCw = () => {
    try {
      if (history.state && history.state.shl === 'cw') {
        history.back();
        return;
      }
    } catch (e) {}
    exitCw();
  };
  useEffect(() => {
    const onPop = () => {
      if (modeRef.current === 'crossword') {
        exitCw();
        return;
      }
      if (SUB[modeRef.current]) doBack();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [doBack, exitCw]);
  // edge swipe (RTL: from the right edge toward the left) goes back from a sub-page
  useEffect(() => {
    if (!SUB[mode]) return;
    let s = null;
    const ts = e => {
      const t = e.touches[0];
      s = t.clientX > window.innerWidth - 28 ? {
        x: t.clientX,
        y: t.clientY,
        on: false,
        dx: 0
      } : null;
    };
    const tm = e => {
      if (!s) return;
      const el = viewRef.current;
      const t = e.touches[0];
      const dx = s.x - t.clientX,
        dy = Math.abs(t.clientY - s.y);
      if (!s.on) {
        if (dx > 12 && dx > dy) {
          s.on = true;
          if (el) el.style.transition = 'none';
        } else if (dy > 12) {
          s = null;
          return;
        } else return;
      }
      s.dx = Math.max(0, dx);
      if (el) {
        el.style.transform = 'translateX(' + -s.dx + 'px)';
        el.style.opacity = String(1 - Math.min(0.5, s.dx / window.innerWidth));
      }
    };
    const te = () => {
      if (!s || !s.on) {
        s = null;
        return;
      }
      const el = viewRef.current;
      const done = s.dx > window.innerWidth * 0.3;
      if (el) el.style.transition = '';
      s = null;
      if (done) goBack();else if (el) {
        el.style.transform = '';
        el.style.opacity = '';
      }
    };
    document.addEventListener('touchstart', ts, {
      passive: true
    });
    document.addEventListener('touchmove', tm, {
      passive: true
    });
    document.addEventListener('touchend', te);
    document.addEventListener('touchcancel', te);
    return () => {
      document.removeEventListener('touchstart', ts);
      document.removeEventListener('touchmove', tm);
      document.removeEventListener('touchend', te);
      document.removeEventListener('touchcancel', te);
    };
  }, [mode]); // eslint-disable-line
  useEffect(() => {
    document.documentElement.classList.toggle('immersive', immersive);
  }, [immersive]);
  const [dark, setDark] = useLocal('ml-dark', false);
  const [favorites, setFav] = useLocal('ml-favorites', []);
  const [studied, setStudied] = useLocal('ml-studied', []);
  const [stats, setStats] = useLocal('ml-stats', {});
  const [achieved, setAchieved] = useLocal('ml-achieved', []);
  const [qTerm, setQTerm] = useState(null); // {hebrew, verify}
  const openTerm = x => setQTerm({
    hebrew: x,
    verify: false
  });
  const openVerify = x => setQTerm({
    hebrew: x,
    verify: true
  });
  const [muted, setMutedState] = useState(Snd.isMuted());
  const [user, setUser] = useState(null);
  const [sync, setSync] = useState('');
  const [entitlement, setEntitlement] = useState(null);
  const [gate, setGate] = useState(null);
  const tier = useMemo(() => SL.tierOf(user, entitlement, Date.now()), [user, entitlement]);
  // Returns true if the feature is accessible; otherwise opens the right gate and returns false.
  function needTier(feature) {
    if (SL.canAccess(feature, tier)) return true;
    setGate((SL.FEATURE_MIN[feature] || 0) >= 2 ? 'paywall' : 'signup');
    return false;
  }
  useEffect(() => {
    _audioLocked = !SL.canAccess('audio', tier);
    _onAudioLock = () => setGate('signup');
  }, [tier]);
  const [newAch, setNewAch] = useState(null);
  const [confetti, setConfetti] = useState(false);
  const loadingRef = useRef(false);
  const achInit = useRef(false);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      const mt = document.querySelector('meta[name="theme-color"]');
      if (mt) mt.setAttribute('content', dark ? '#0E151C' : '#F0EEE8');
    } catch (e) {}
    if (dark) setStats(s => s.usedDark ? s : {
      ...s,
      usedDark: true
    });
  }, [dark]);
  // day streak on mount
  useEffect(() => {
    setStats(s => {
      const today = new Date().toISOString().slice(0, 10);
      if (s.lastVisit === today) return s;
      const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const ds = s.lastVisit === y ? (s.dayStreak || 0) + 1 : 1;
      return {
        ...s,
        lastVisit: today,
        dayStreak: ds,
        maxDayStreak: Math.max(s.maxDayStreak || 0, ds)
      };
    });
  }, []);
  // crossword solves reported by the embedded game (postMessage)
  useEffect(() => {
    function onMsg(e) {
      if (e && e.data && e.data.type === 'ml-cw-solved') {
        const sec = typeof e.data.seconds === 'number' ? e.data.seconds : 99999;
        setStats(s => ({
          ...s,
          cwSolved: (s.cwSolved || 0) + 1,
          cwBest: Math.min(s.cwBest || 99999, sec)
        }));
        Snd.fanfare && Snd.fanfare();
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const toggleFav = x => setFav(f => f.includes(x) ? f.filter(y => y !== x) : [...f, x]);
  const toggleStudied = x => setStudied(f => f.includes(x) ? f.filter(y => y !== x) : [...f, x]);
  // pin changes move a term in/out of the review list, so confirm them with an undo toast
  const favToast = x => {
    const was = favorites.includes(x);
    toggleFav(x);
    buzz(8);
    toast(was ? 'הוסר מרשימת החזרה' : 'נוסף לרשימת החזרה', {
      kind: was ? 'info' : 'ok',
      action: {
        label: 'ביטול',
        fn: () => toggleFav(x)
      }
    });
  };
  const onQResult = ok => {
    if (qTerm && qTerm.verify) {
      if (ok) {
        setStudied(f => f.includes(qTerm.hebrew) ? f : [...f, qTerm.hebrew]);
      } else {
        setFav(f => f.includes(qTerm.hebrew) ? f : [...f, qTerm.hebrew]);
      }
    }
  };
  const recordAnswer = ok => setStats(s => ({
    ...s,
    answered: (s.answered || 0) + 1,
    correct: (s.correct || 0) + (ok ? 1 : 0)
  }));
  const recordQuiz = (score, len) => setStats(s => ({
    ...s,
    quizzes: (s.quizzes || 0) + 1,
    perfect: (s.perfect || 0) + (score === len && len > 0 ? 1 : 0)
  }));
  const fireConfetti = () => {
    setConfetti(true);
    setTimeout(() => setConfetti(false), 1900);
  };
  const toggleSound = () => {
    const n = !muted;
    setMutedState(n);
    Snd.setMuted(n);
    if (!n) Snd.pop();
  };

  // achievement detection — celebrate ONLY on a genuine new unlock.
  // Never on first mount, and never while remote data is loading (sign-in/refresh), so the
  // streak/achievement toast + confetti don't replay every time the app opens.
  useEffect(() => {
    const m = metrics(studied, favorites, stats);
    const earned = earnedIds(m);
    // achieved is monotonic — once earned, always earned (never re-celebrate, never drop on a transient stats dip).
    if (!achInit.current || loadingRef.current) {
      achInit.current = true;
      setAchieved(prev => uniq([...prev, ...earned]));
      return;
    }
    const fresh = earned.filter(id => !achieved.includes(id));
    if (fresh.length) {
      const a = ACH.find(x => x.id === fresh[0]);
      if (a) {
        setNewAch(a);
        setConfetti(true);
        Snd.trophy();
        setTimeout(() => setNewAch(null), 3600);
        setTimeout(() => setConfetti(false), 1900);
      }
      setAchieved(prev => uniq([...prev, ...earned]));
    }
  }, [studied, favorites, stats]); // eslint-disable-line

  // firebase sync
  const saveUserData = useCallback(async uid => {
    if (!db || !auth.currentUser) return;
    setSync('syncing');
    try {
      await db.collection('users').doc(uid).set({
        displayName: auth.currentUser.displayName,
        email: auth.currentUser.email,
        photoURL: auth.currentUser.photoURL,
        favorites,
        studied,
        stats,
        achieved,
        lastSync: firebase.firestore.FieldValue.serverTimestamp()
      }, {
        merge: true
      });
      setSync('synced');
      setTimeout(() => setSync(''), 1500);
    } catch (e) {
      console.error(e);
      setSync('error');
    }
  }, [favorites, studied, stats, achieved]);
  useEffect(() => {
    if (!auth) return;
    if (auth.getRedirectResult) {
      auth.getRedirectResult().catch(function (e) {
        if (e && e.code && e.code !== 'auth/no-auth-event') console.warn('sign-in redirect:', e.code);
      });
    }
    const unsub = auth.onAuthStateChanged(async u => {
      setUser(u);
      setEntitlement(null); // clear first; re-fetch below for a signed-in user (avoids stale paid on account switch)
      if (u && db) {
        setSync('syncing');
        try {
          const eDoc = await db.collection('entitlements').doc(u.uid).get();
          setEntitlement(eDoc.exists ? eDoc.data() : null);
        } catch (e) {
          setEntitlement(null);
        }
        try {
          const doc = await db.collection('users').doc(u.uid).get();
          if (doc.exists) {
            const d = doc.data();
            loadingRef.current = true;
            // UNION, never replace. Overwriting local with the cloud copy silently destroyed every
            // term studied as a guest (or offline since the last sync) the moment you signed in —
            // the opposite of what the sign-up gate promises. stats/achieved already merged; these
            // two did not.
            setFav(prev => uniq([...(d.favorites || []), ...prev]));
            setStudied(prev => uniq([...(d.studied || []), ...prev]));
            if (d.stats) setStats(s => mergeStats(s, d.stats));
            if (d.achieved) setAchieved(prev => uniq([...prev, ...d.achieved]));
            setTimeout(() => {
              loadingRef.current = false;
            }, 600);
            setSync('synced');
            setTimeout(() => setSync(''), 1500);
          } else {
            await db.collection('users').doc(u.uid).set({
              displayName: u.displayName,
              email: u.email,
              photoURL: u.photoURL,
              favorites,
              studied,
              stats,
              achieved,
              lastSync: firebase.firestore.FieldValue.serverTimestamp()
            }, {
              merge: true
            });
            setSync('synced');
            setTimeout(() => setSync(''), 1500);
          }
        } catch (e) {
          console.error(e);
          setSync('error');
        }
      }
    });
    return unsub;
  }, []);
  useEffect(() => {
    if (user && !loadingRef.current) saveUserData(user.uid);
  }, [favorites, studied, stats, achieved]); // eslint-disable-line

  const signIn = async () => {
    if (!auth) {
      toast('אין חיבור לאינטרנט', {
        kind: 'err'
      });
      return;
    }
    setAuthBusy(true);
    try {
      // Popup returns the credential to the app via postMessage (same-origin), so it works
      // even under browser storage partitioning. signInWithRedirect is NOT used as the primary
      // path because our app origin (github.io) differs from authDomain (firebaseapp.com):
      // after the redirect the partitioned auth result can't be read back and the user stays
      // signed-out ("guest"). Redirect stays only as a last-resort fallback if a popup is blocked.
      await auth.signInWithPopup(googleProvider);
      toast('התחברתם בהצלחה', {
        kind: 'ok'
      });
    } catch (e) {
      const c = e && e.code;
      if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return; // user cancelled — no error
      if (c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment') {
        try {
          await auth.signInWithRedirect(googleProvider);
          return;
        } catch (e2) {
          toast('שגיאת התחברות: ' + (e2.message || e2), {
            kind: 'err',
            ms: 5000
          });
          return;
        }
      }
      toast('שגיאת התחברות: ' + (e.message || e), {
        kind: 'err',
        ms: 5000
      });
    } finally {
      setAuthBusy(false);
    }
  };
  const signOut = async () => {
    // Flush everything to the account BEFORE dropping the session. Without this, progress made
    // since the last write lives only on this device and never follows the user to the next one.
    try {
      if (db && auth.currentUser) await saveUserData(auth.currentUser.uid);
    } catch (e) {}
    loadingRef.current = true;
    setEntitlement(null);
    try {
      await auth.signOut();
    } catch (e) {}
    setUser(null);
    setTimeout(() => {
      loadingRef.current = false;
    }, 600);
    toast('התנתקתם. ההתקדמות נשמרה בחשבון', {
      kind: 'info'
    });
  };
  // long-press / right-click on a term: contextual actions
  const openMenu = (t, def) => {
    const x = t.hebrew,
      isFav = favorites.includes(x),
      isSt = studied.includes(x);
    const d = def || '';
    setMenu({
      title: termLabel(t),
      en: t.english,
      sub: d.length > 140 ? d.slice(0, 140) + '…' : d,
      items: [{
        label: 'בחנו אותי על המושג',
        icon: h(Ico, {
          n: 'target'
        }),
        fn: () => openTerm(x)
      }, {
        label: 'הקראה',
        icon: h(IcSpeaker),
        fn: () => Speak2(x, t.nikud)
      }, {
        label: isFav ? 'הסרה מרשימת החזרה' : 'סימון לחזרה',
        icon: h(IcPin),
        fn: () => favToast(x)
      }, {
        label: isSt ? 'ביטול הסימון כנלמד' : 'סימון כנלמד',
        icon: h(Ico, {
          n: 'check'
        }),
        fn: () => {
          if (!isSt) Snd.ding();
          toggleStudied(x);
          toast(isSt ? 'הסימון בוטל' : 'סומן כנלמד', {
            kind: isSt ? 'info' : 'ok'
          });
        }
      }, {
        label: 'העתקת ההגדרה',
        icon: h(Ico, {
          n: 'copy'
        }),
        fn: () => copyText(x + ': ' + d)
      }]
    });
  };
  const sub = !!SUB[mode];
  const dm = mode === 'glossary' || mode === 'flashcards' || mode === 'quiz' ? mode : 'glossary';
  return h(Frag, null, h("div", {
    className: "app",
    "data-mode": dm
  }, !immersive && h(Header, {
    mode: mode,
    pinCount: favorites.length,
    dark: dark,
    setDark: setDark,
    sub: sub,
    onBack: goBack,
    onReview: () => goSub('review'),
    onAbout: () => goSub('about')
  }), h("main", {
    className: "scroll"
  }, h("div", {
    className: 'view' + (viewAnim ? ' anim-' + viewAnim : ''),
    key: mode,
    ref: viewRef
  }, mode === 'glossary' && h(Glossary, {
    favorites: favorites,
    studied: studied,
    toggleFav: favToast,
    toggleStudied: toggleStudied,
    onOpenTerm: openTerm,
    onMenu: openMenu,
    q: gq,
    setQ: setGq,
    letter: gLetter,
    setLetter: setGLetter,
    topic: glossaryTopic,
    setTopic: setGlossaryTopic
  }), mode === 'flashcards' && h(Flashcards, {
    favorites: favorites,
    studied: studied,
    toggleFav: favToast,
    toggleStudied: toggleStudied,
    onKnow: openVerify,
    tier: tier,
    onNeedAll: () => needTier('practice-all'),
    goGlossary: () => changeMode('glossary')
  }), mode === 'quiz' && h(Quiz, {
    studied: studied,
    toggleStudied: toggleStudied,
    favorites: favorites,
    recordAnswer: recordAnswer,
    recordQuiz: recordQuiz,
    fireConfetti: fireConfetti,
    tier: tier,
    onNeedAll: () => needTier('practice-all'),
    needTier: needTier,
    setImmersive: setImmersive,
    preset: quizPreset
  }), mode === 'review' && h(ReviewList, {
    favorites: favorites,
    studied: studied,
    toggleFav: favToast,
    toggleStudied: toggleStudied,
    goQuiz: () => {
      setQuizPreset({
        hardOnly: true
      });
      changeMode('quiz');
    },
    goGlossary: () => changeMode('glossary'),
    onOpenTerm: openTerm,
    onMenu: openMenu
  }), mode === 'about' && h(About), mode === 'profile' && h(Profile, {
    user: user,
    studied: studied,
    favorites: favorites,
    stats: stats,
    sync: sync,
    signIn: signIn,
    signOut: signOut,
    onTopic: openTopic,
    muted: muted,
    toggleSound: toggleSound,
    dark: dark,
    setDark: setDark,
    tier: tier,
    authBusy: authBusy
  })))), !immersive && h(Nav, {
    mode: sub ? '' : mode,
    setMode: changeMode,
    tier: tier,
    user: user
  }), mode === 'crossword' && h(Crossword, {
    dark: dark,
    setImmersive: setImmersive,
    onExit: leaveCw
  }), h(Toaster), confetti && h(Confetti), newAch && h("div", {
    className: "ach-toast",
    role: "status"
  }, h("span", {
    className: "ach-em",
    "aria-hidden": "true"
  }, newAch.emoji), h("div", null, h("b", null, "הישג חדש! ", newAch.title), h("span", null, newAch.desc))), gate === 'signup' && h(SignUpGate, {
    onClose: () => setGate(null),
    onSignIn: () => {
      setGate(null);
      signIn();
    },
    studied: studied.length,
    favorites: favorites.length,
    authBusy: authBusy
  }), gate === 'paywall' && h(Paywall, {
    onClose: () => setGate(null),
    user: user,
    onSignIn: () => {
      setGate(null);
      signIn();
    },
    authBusy: authBusy
  }), qTerm && h(TermQuiz, {
    key: qTerm.hebrew + (qTerm.verify ? 'v' : 'e'),
    hebrew: qTerm.hebrew,
    onClose: () => setQTerm(null),
    onResult: onQResult
  }), menu && h(ContextMenu, {
    menu: menu,
    onClose: () => setMenu(null)
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(h(App));
