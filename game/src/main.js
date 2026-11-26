// Cendrawasih Airlift — main.js
// One job: the game loop and the state machine. Title, job board, flying,
// paused, delivered, shift end, crash — plus shot mode, which renders one
// fixed scene and raises window.__shotReady for the screenshot tool.

// Screens the renderer knows: title, jobs, flying, paused, delivered,
// shiftend, crash, shot (flying scene + HUD, no overlays).
const SHOT_MODE = (() => {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  return { name: shot, seed: parseInt(q.get('seed') || '1', 10) || 1 };
})();

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = CONFIG.view.width;
const H = CONFIG.view.height;
canvas.width = W;
canvas.height = H;

const state = makeGameState();
const input = makeInput(canvas);
const audio = makeAudio();
const rng = makeSeededRandom(CONFIG.worldSeed + 101);

let screen = SHOT_MODE ? 'shot' : 'title';
let lastTime = performance.now();
let framesDrawn = 0;
let shotReady = false;

if (SHOT_MODE) {
  // A fixed scene: apply the preset, then render it live every frame.
  const ok = applyShotPreset(state, SHOT_MODE.name, SHOT_MODE.seed);
  if (!ok) {
    document.title = 'Unknown shot: ' + SHOT_MODE.name;
  }
}

function startShift() {
  state.plane = freshPlane();
  state.job = null;
  state.jobsDone = 0;
  state.coins = 0;
  state.shiftTimeLeft = CONFIG.shift.shiftSeconds;
  state.shiftOver = false;
  state.rings = [];
  state.crashReason = '';
  state.lastPayout = null;
  state.landingScore = null;
  openJobBoard();
}

function openJobBoard() {
  state.jobOffers = offerJobs(state, rng);
  screen = 'jobs';
}

function pickJob(index) {
  const job = state.jobOffers && state.jobOffers[index];
  if (!job) return;
  acceptJob(state, job, rng);
  screen = 'flying';
  audio.unlock();
}

function jobCardAt(click) {
  // The three cards the renderer draws, in the same geometry.
  const cardW = 320;
  const gap = 28;
  const totalW = cardW * 3 + gap * 2;
  const x0 = (W - totalW) / 2;
  const y0 = 190;
  const cardH = 300;
  if (!click || click.y < y0 || click.y > y0 + cardH) return -1;
  for (let i = 0; i < 3; i++) {
    const x = x0 + i * (cardW + gap);
    if (click.x >= x && click.x <= x + cardW) return i;
  }
  return -1;
}

function handleEvents() {
  for (const ev of state.events) {
    if (ev === 'ring') audio.ringChime();
    if (ev === 'lowfuel') audio.warnBeep();
    if (ev === 'land') audio.thump();
    if (ev === 'delivered') {
      audio.coinChime();
      screen = 'delivered';
    }
    if (ev === 'crash') {
      audio.crashSound();
      screen = 'crash';
    }
  }
  state.events.length = 0;
}

function update(dt) {
  const p = state.plane;

  // The shift clock is wall-clock: it ends the shift from any screen.
  if (state.shiftTimeLeft <= 0) state.shiftOver = true;

  // Edge-triggered keys, handled per screen.
  if (input.wasPressed(INPUT_KEYS.mute)) {
    audio.toggleMute();
  }
  if (screen === 'title') {
    if (input.wasPressed(INPUT_KEYS.start)) {
      audio.unlock();
      startShift();
    }
  } else if (screen === 'jobs') {
    if (state.shiftOver) {
      screen = 'shiftend';
    } else if (input.wasPressed(INPUT_KEYS.job1)) pickJob(0);
    else if (input.wasPressed(INPUT_KEYS.job2)) pickJob(1);
    else if (input.wasPressed(INPUT_KEYS.job3)) pickJob(2);
    const click = input.takeClick();
    const card = jobCardAt(click);
    if (card >= 0) pickJob(card);
  } else if (screen === 'flying') {
    if (input.wasPressed(INPUT_KEYS.pause)) {
      screen = 'paused';
    } else {
      const steer = input.steering();
      steer.throttle = input.throttleDelta() * 0.55;
      p.flaps = input.brakeHeld();
      stepFlight(state, steer, dt, rng);
      audio.update(p.throttle, p.speed, p.airborne);
      handleEvents();
      if (screen === 'flying' && state.shiftOver) {
        screen = 'shiftend';
      }
    }
  } else if (screen === 'paused') {
    if (input.wasPressed(INPUT_KEYS.pause)) screen = 'flying';
  } else if (screen === 'delivered') {
    if (input.wasPressed(INPUT_KEYS.start)) {
      if (state.jobsDone >= CONFIG.shift.jobsPerShift || state.shiftOver) {
        screen = 'shiftend';
      } else {
        openJobBoard();
      }
    }
  } else if (screen === 'shiftend' || screen === 'crash') {
    if (input.wasPressed(INPUT_KEYS.start)) {
      startShift();
    }
  }

  if (state.messageTimer > 0) state.messageTimer -= dt;
  input.endFrame();
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;
  const time = now / 1000;

  if (screen === 'shot') {
    // Shot mode: hold the scene still (no physics, no input) and render.
    // A few frames in, the scene is fully painted: raise the flag.
    const cam = makeCamera(state, time);
    drawFrame(ctx, state, cam, W, H, time, 'shot');
    framesDrawn++;
    if (!shotReady && framesDrawn >= 4) {
      shotReady = true;
      window.__shotReady = true;
    }
  } else {
    update(dt);
    const cam = makeCamera(state, time);
    drawFrame(ctx, state, cam, W, H, time, screen);
  }
  requestAnimationFrame(frame);
}

// Keep the tab honest: pause the loop when hidden, resume on return.
document.addEventListener('visibilitychange', () => {
  lastTime = performance.now();
});

// A small debug handle for play-testing: the live state and screen.
window.__cendrawasih = {
  state,
  get screen() { return screen; },
};

requestAnimationFrame(frame);
