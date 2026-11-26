// Cendrawasih Airlift — shots.js
// One job: the four deterministic screenshot scenes. Each preset fixes the
// plane, the job and the rings so the same shot always composes the same
// way; the game still renders them live through its own code.
// Names: cover, takeoff, rings, landing. Read ?shot=<name>&seed=<n>.

const SHOT_PRESETS = {
  // Chase view mid-flight: a ring ahead, volcano on the left, full HUD.
  cover: {
    plane: { x: 600, y: -600, alt: 320, headingDeg: 42, pitchDeg: -2, bankDeg: -8, speed: 58, throttle: 0.72, fuel: 78, damage: 4, airborne: true, onGround: false },
    job: { type: 'delivery', cargo: 'spice', to: 'waigeo', timeLeft: 182, payout: 268 },
    ringAhead: { dx: 700, dy: 700, dz: -40, radius: 46 },
  },
  // Takeoff roll: on the runway, full throttle, strip lights ahead.
  takeoff: {
    plane: { x: -2600, y: -1800, alt: 0, headingDeg: 18, pitchDeg: 4, bankDeg: 0, speed: 30, throttle: 1.0, fuel: 96, damage: 0, airborne: false, onGround: true },
    job: { type: 'delivery', cargo: 'copra', to: 'numfor', timeLeft: 260, payout: 190 },
    ringAhead: null,
  },
  // Ring run through the valley: low, fast, hoop dead ahead.
  rings: {
    plane: { x: -800, y: 600, alt: 165, headingDeg: 100, pitchDeg: -4, bankDeg: 14, speed: 66, throttle: 0.85, fuel: 61, damage: 9, airborne: true, onGround: false },
    job: { type: 'ringrun', cargo: 'mail', to: 'biak', timeLeft: 96, payout: 210 },
    ringAhead: { dx: 360, dy: -90, dz: 10, radius: 46 },
  },
  // Final approach: runway lights ahead, gear down, flaps in.
  // The plane sits upwind of Waigeo Bay strip (1800, 2600), on the
  // runway axis, heading 285 so the strip is dead ahead.
  landing: {
    plane: { x: 2330, y: 2460, alt: 95, headingDeg: 285, pitchDeg: -6, bankDeg: -4, speed: 44, throttle: 0.42, fuel: 44, damage: 2, airborne: true, onGround: false },
    job: { type: 'medical', cargo: 'medicine', to: 'waigeo', timeLeft: 58, payout: 410 },
    ringAhead: null,
  },
};

// Apply a preset to a fresh game state. Returns true when the name exists.
function applyShotPreset(state, name, seed) {
  const preset = SHOT_PRESETS[name];
  if (!preset) return false;
  const rng = makeSeededRandom(seed);
  const p = state.plane;
  const pp = preset.plane;
  p.x = pp.x;
  p.y = pp.y;
  p.alt = pp.alt;
  p.heading = pp.headingDeg * DEG;
  p.pitch = pp.pitchDeg * DEG;
  p.bank = pp.bankDeg * DEG;
  p.speed = pp.speed;
  p.throttle = pp.throttle;
  p.fuel = pp.fuel;
  p.damage = pp.damage;
  p.airborne = pp.airborne;
  p.onGround = pp.onGround;
  p.gearDown = true;
  p.flaps = name === 'landing';
  p.verticalSpeed = pp.pitchDeg < 0 ? -3.5 : 0;
  p.propAngle = 1.2;

  const to = CONFIG.strips.find((s) => s.id === preset.job.to);
  const cargo = CONFIG.cargo.find((c) => c.id === preset.job.cargo);
  state.job = {
    type: preset.job.type,
    label: CONFIG.jobTypes[preset.job.type].label,
    desc: CONFIG.jobTypes[preset.job.type].desc,
    cargo,
    from: state.plane.stripId,
    to,
    payout: preset.job.payout,
    timeLimit: preset.job.timeLeft,
    timeLeft: preset.job.timeLeft,
    weight: cargo.weight,
  };
  state.coins = 145;
  state.jobsDone = 1;
  state.shiftTimeLeft = 212;
  state.rings = [];
  state.ringsHit = 0;
  if (preset.ringAhead) {
    const ra = preset.ringAhead;
    state.rings.push({
      x: p.x + ra.dx,
      y: p.y + ra.dy,
      z: p.alt + ra.dz,
      radius: ra.radius,
      hit: false,
    });
    // Two more hoops further along the same line, for depth.
    state.rings.push({ x: p.x + ra.dx * 1.9, y: p.y + ra.dy * 1.9, z: p.alt + ra.dz + 30, radius: ra.radius, hit: false });
    state.rings.push({ x: p.x + ra.dx * 2.8, y: p.y + ra.dy * 2.8, z: p.alt + ra.dz + 55, radius: ra.radius, hit: false });
  } else {
    // A distant hoop keeps the sky interesting even without one ahead.
    state.rings.push({ x: p.x + 1600, y: p.y + 900, z: 260, radius: 46, hit: false });
  }
  state.message = '';
  state.messageTimer = 0;
  // Keep the world still for the shot: clouds at their seeded spots.
  state.world.clouds.forEach((c) => { c.x = c.x; });
  return true;
}
