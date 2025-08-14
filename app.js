// === Configurazioni 1:1 dalla tua routine ===
const config1 = { id: 'program1', phases: [{ type: 'A', seconds: 25 }, { type: 'B', seconds: 20 }], loops: 2 };
const config2 = { id: 'program2', phases: [{ type: 'A', seconds: 35 }, { type: 'B', seconds: 20 }], loops: 3 };
const config3 = { id: 'program3', phases: [{ type: 'A', seconds: 45 }, { type: 'B', seconds: 15 }], loops: 3 };
const config3Adv = { id: 'program3Adv', phases: [{ type: 'A', seconds: 45 }, { type: 'B', seconds: 15 }], loops: 4 };
const config4 = { id: 'program4', phases: [{ type: 'A', seconds: 60 }, { type: 'B', seconds: 15 }], loops: 4 };

const presetMap = { program1: config1, program2: config2, program3: config3, program3Adv: config3Adv, program4: config4 };

// === Stato & riferimenti ===
const el = {
  progSel: document.getElementById('progSel'),
  countVal: document.getElementById('countVal'),
  resetCountBtn: document.getElementById('resetCountBtn'),
  phaseName: document.getElementById('phaseName'),
  timeLeft: document.getElementById('timeLeft'),
  loopInfo: document.getElementById('loopInfo'),
  rateInput: document.getElementById('rateInput'),
  rateQuick: document.querySelectorAll('.rate-quick .btn'),
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  barFill: document.getElementById('barFill'),
  barHint: document.getElementById('barHint'),
  doneModal: document.getElementById('doneModal'),
  doneYes: document.getElementById('doneYes'),
  doneNo: document.getElementById('doneNo'),
  resetModal: document.getElementById('resetModal'),
  resetYes: document.getElementById('resetYes'),
  resetNo: document.getElementById('resetNo'),
  infoA: document.getElementById('infoA'),
  infoB: document.getElementById('infoB'),
  infoLoops: document.getElementById('infoLoops')
};

const state = {
  selId: el.progSel.value,
  run: {
    active: false,
    segIdx: 0,
    loopIdx: 0,
    remainMs: 0,
    timeline: [],
    finishedExact: false
  },
  tickRef: null,
  beatRef: null,
  spm: Number(el.rateInput.value)
};

// === Utility ===
const mmss = s => {
  const m = Math.floor(s / 60);
  const sec = Math.max(0, Math.floor(s % 60));
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};
const lsKey = id => `count_${id}`;
const getCount = id => Number(localStorage.getItem(lsKey(id)) || 0);
const setCount = (id, v) => localStorage.setItem(lsKey(id), String(v));

// Timeline con rimozione pausa finale
function buildTimeline(cfg) {
  const out = [];
  for (let loop = 1; loop <= cfg.loops; loop++) {
    for (let idx = 0; idx < cfg.phases.length; idx++) {
      const seg = cfg.phases[idx];
      const isLastLoop = loop === cfg.loops;
      const isLastPhase = idx === cfg.phases.length - 1;
      const isRest = seg.type === 'B';
      if (isLastLoop && isLastPhase && isRest) continue;
      out.push({ t: seg.type, ms: seg.seconds * 1000, loop });
    }
  }
  return out;
}

// === UI ===
function refreshCount() {
  el.countVal.textContent = getCount(state.selId);
}
function refreshPhase() {
  const cfg = presetMap[state.selId];
  const seg = state.run.timeline[state.run.segIdx];
  el.phaseName.textContent = seg ? seg.t : '—';
  el.timeLeft.textContent = mmss(state.run.remainMs / 1000);
  el.loopInfo.textContent = `${seg ? seg.loop : 0}/${cfg.loops}`;
}
function setBarActive(active) {
  el.barHint.style.opacity = active ? 0.6 : 0.35;
  if (!active) el.barFill.style.height = '0%';
}
function startBeat() {
  stopBeat();
  const interval = Math.max(200, Math.round(60000 / state.spm));
  el.barFill.style.transitionDuration = `${interval}ms`;
  let up = true;
  state.beatRef = setInterval(() => {
    el.barFill.style.height = up ? '100%' : '0%';
    up = !up;
  }, interval);
}
function stopBeat() {
  if (state.beatRef) clearInterval(state.beatRef);
  state.beatRef = null;
  el.barFill.style.height = '0%';
}
function toggleControls(running) {
  el.startBtn.disabled = running;
  el.stopBtn.disabled = !running;
  el.progSel.disabled = running;
  el.rateInput.disabled = running;
  el.rateQuick.forEach(btn => btn.disabled = running);
  el.resetCountBtn.disabled = running;
}
function refreshProgInfo() {
  const cfg = presetMap[state.selId];
  el.infoA.textContent = cfg.phases[0].seconds;
  el.infoB.textContent = cfg.phases[1].seconds;
  el.infoLoops.textContent = cfg.loops;
}

// === Controllo sessione ===
function initRun() {
  const cfg = presetMap[state.selId];
  state.run.timeline = buildTimeline(cfg);
  state.run.segIdx = 0;
  state.run.loopIdx = 0;
  state.run.remainMs = state.run.timeline[0]?.ms || 0;
  state.run.active = false;
  state.run.finishedExact = false;
  stopBeat();
  setBarActive(false);
  refreshPhase();
  toggleControls(false);
}

function startRun() {
  if (!state.run.timeline.length) state.run.timeline = buildTimeline(presetMap[state.selId]);
  if (state.run.active) return;
  state.run.active = true;
  if (!state.run.remainMs && state.run.timeline.length) {
    state.run.remainMs = state.run.timeline[state.run.segIdx].ms;
  }
  const seg = state.run.timeline[state.run.segIdx];
  state.run.loopIdx = seg ? (seg.loop - 1) : 0;
  if (seg && seg.t === 'A') {
    setBarActive(true);
    startBeat();
  } else {
    setBarActive(false);
    stopBeat();
  }
  tickStart();
  toggleControls(true);
}

function stopRun() {
  tickStop();
  stopBeat();
  initRun();
}

function tickStart() {
  tickStop();
  const step = 100;
  let prev = performance.now();
  state.tickRef = setInterval(() => {
    if (!state.run.active) return;
    const now = performance.now();
    const dt = now - prev;
    prev = now;
    state.run.remainMs -= dt;
    if (state.run.remainMs <= 0) advanceSegment();
    refreshPhase();
  }, step);
}

function tickStop() {
  if (state.tickRef) clearInterval(state.tickRef);
  state.tickRef = null;
}

function advanceSegment() {
  const tl = state.run.timeline;
  const prevSeg = tl[state.run.segIdx] || null;
  state.run.segIdx += 1;
  if (state.run.segIdx >= tl.length) {
    state.run.active = false;
    state.run.finishedExact = true;
    tickStop();
    stopBeat();
    setBarActive(false);
    refreshPhase();
    openDoneModal();
    return;
  }
  const seg = tl[state.run.segIdx];
  state.run.remainMs = seg.ms;
  state.run.loopIdx = seg.loop - 1;
  if (!prevSeg || prevSeg.t !== seg.t) {
    if (seg.t === 'A') {
      setBarActive(true);
      startBeat();
    } else {
      setBarActive(false);
      stopBeat();
    }
  }
}

// === Modali ===
function openDoneModal() { el.doneModal.hidden = false; }
function closeDoneModal() { el.doneModal.hidden = true; }
function openResetModal() { el.resetModal.hidden = false; }
function closeResetModal() { el.resetModal.hidden = true; }

// === Eventi UI ===
el.progSel.addEventListener('change', () => {
  state.selId = el.progSel.value;
  initRun();
  refreshCount();
  refreshProgInfo();
});

el.startBtn.addEventListener('click', startRun);
el.stopBtn.addEventListener('click', stopRun);

el.rateQuick.forEach(btn => {
  btn.addEventListener('click', () => {
    const v = Number(btn.getAttribute('data-rate'));
    el.rateInput.value = String(v);
    state.spm = v;
    // Se è attivo ed in fase A, aggiorna il beat
    if (state.run.active) {
      const seg = state.run.timeline[state.run.segIdx];
      if (seg && seg.t === 'A') startBeat();
    }
  });
});

el.rateInput.addEventListener('input', () => {
  const v = Math.max(30, Math.min(220, Number(el.rateInput.value || 0)));
  el.rateInput.value = String(v);
  state.spm = v;
  if (state.run.active) {
    const seg = state.run.timeline[state.run.segIdx];
    if (seg && seg.t === 'A') startBeat();
  }
});

el.resetCountBtn.addEventListener('click', openResetModal);

el.resetNo.addEventListener('click', closeResetModal);
el.resetYes.addEventListener('click', () => {
  setCount(state.selId, 0);
  refreshCount();
  closeResetModal();
});

el.doneNo.addEventListener('click', () => {
  closeDoneModal();
  initRun();
  toggleControls(false);
});
el.doneYes.addEventListener('click', () => {
  if (state.run.finishedExact) {
    const v = getCount(state.selId) + 1;
    setCount(state.selId, v);
    refreshCount();
  }
  closeDoneModal();
  initRun();
  toggleControls(false);
});

// === Avvio ===
(function boot() {
  initRun();
  refreshCount();
  refreshProgInfo();
  toggleControls(false);
})();
