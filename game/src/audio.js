// Cendrawasih Airlift — audio.js
// One job: every sound the game makes, synthesized with WebAudio only.
// No audio files: engine drone, wind rush, chimes, thumps and a calm bass loop.

// The audio engine. Created lazily on the first user gesture; shot mode
// never creates it, so headless renders stay silent and deterministic.
function makeAudio() {
  let ctx = null;
  let master = null;
  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let bassTimer = null;
  let bassStep = 0;

  // A calm bass line in A minor, one note per beat, looping.
  const BASS_NOTES = [110.0, 0, 130.81, 0, 98.0, 0, 146.83, 0];

  function ensureContext() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      startEngine();
      startWind();
      startBass();
      return true;
    } catch (err) {
      ctx = null;
      return false;
    }
  }

  function startEngine() {
    engineOsc1 = ctx.createOscillator();
    engineOsc1.type = 'sawtooth';
    engineOsc1.frequency.value = 52;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 26;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    engineOsc1.connect(filter);
    engineOsc2.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc1.start();
    engineOsc2.start();
  }

  function startWind() {
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 600;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0.0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    noise.start();
  }

  function startBass() {
    bassTimer = window.setInterval(() => {
      if (!ctx || muted) return;
      const freq = BASS_NOTES[bassStep % BASS_NOTES.length];
      bassStep++;
      if (!freq) return;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.6);
    }, 420);
  }

  // A short pitched blip with a decaying envelope.
  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  return {
    // Call from any user gesture (key, click) so the browser allows audio.
    unlock() {
      ensureContext();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    // Continuous engine + wind, driven every frame from the flight state.
    update(throttle, speed, airborne) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const rpm = 46 + throttle * 58 + speed * 0.12;
      engineOsc1.frequency.setTargetAtTime(rpm, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(rpm * 0.5, t, 0.08);
      engineGain.gain.setTargetAtTime(airborne ? 0.05 + throttle * 0.075 : 0.02, t, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.16, speed * 0.0016), t, 0.15);
      windFilter.frequency.setTargetAtTime(380 + speed * 9, t, 0.15);
    },
    ringChime() {
      blip(880, 0.35, 'sine', 0.22);
      blip(1318, 0.4, 'sine', 0.16, 0.07);
    },
    coinChime() {
      blip(1046, 0.18, 'triangle', 0.2);
      blip(1568, 0.3, 'triangle', 0.18, 0.08);
    },
    thump() {
      blip(70, 0.22, 'sine', 0.5);
      blip(48, 0.3, 'sine', 0.4, 0.03);
    },
    warnBeep() {
      blip(660, 0.12, 'square', 0.12);
      blip(660, 0.12, 'square', 0.12, 0.18);
    },
    crashSound() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const len = ctx.sampleRate * 0.7;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      noise.connect(g);
      g.connect(master);
      noise.start(t);
      blip(55, 0.6, 'sine', 0.5);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
