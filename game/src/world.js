// Cendrawasih Airlift — world.js
// One job: the flight model and the archipelago. Plane state, terrain and
// islands, airstrips, checkpoint rings, jobs, fuel, damage and the shift.
// Rendering never lives here; this file only moves numbers.

// Headings are radians, 0 = north (+y), clockwise positive, so
// forward = (sin h, cos h). Angles in degrees are converted at the edges.
const DEG = Math.PI / 180;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function distance2d(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// Build the archipelago once from the seed: islands, clouds, villages.
// The strips sit on flattened ground so runways are always landable.
function buildWorld(seed) {
  const rng = makeSeededRandom(seed);
  const islands = [];
  const kinds = ['volcano', 'forest', 'terraces', 'village', 'forest', 'terraces'];
  // A hand-placed spine of islands so the routes always cross land and sea.
  const spine = [
    { x: -2600, y: -1800, r: 1500, peak: 300, kind: 'terraces' },
    { x: 2400, y: -900, r: 1300, peak: 260, kind: 'terraces' },
    { x: 1800, y: 2600, r: 1600, peak: 300, kind: 'village' },
    { x: -2200, y: 2400, r: 1400, peak: 380, kind: 'forest' },
    { x: 0, y: 0, r: 900, peak: 180, kind: 'forest' },
    { x: -400, y: 3400, r: 800, peak: 150, kind: 'terraces' },
    { x: 3400, y: 1200, r: 1000, peak: 220, kind: 'volcano' },
    { x: -3600, y: 600, r: 900, peak: 170, kind: 'village' },
    { x: 900, y: -3200, r: 1100, peak: 240, kind: 'forest' },
    { x: -1200, y: -3400, r: 850, peak: 200, kind: 'terraces' },
    { x: 3800, y: -2600, r: 950, peak: 190, kind: 'forest' },
    { x: -4200, y: -2600, r: 1000, peak: 210, kind: 'volcano' },
  ];
  for (const s of spine) {
    islands.push({
      x: s.x, y: s.y, r: s.r, peak: s.peak, kind: s.kind,
      // A deterministic wobble so no island is a perfect circle.
      wobble: Array.from({ length: 12 }, () => rng.range(0.82, 1.18)),
      hue: rng.range(-8, 8),
    });
  }
  // Extra small islets scattered for texture.
  for (let i = 0; i < 10; i++) {
    const x = rng.range(-4800, 4800);
    const y = rng.range(-4200, 4200);
    if (islands.some((isl) => distance2d(x, y, isl.x, isl.y) < isl.r + 500)) continue;
    islands.push({
      x, y, r: rng.range(220, 480), peak: rng.range(40, 120),
      kind: kinds[i % kinds.length],
      wobble: Array.from({ length: 12 }, () => rng.range(0.85, 1.15)),
      hue: rng.range(-8, 8),
    });
  }

  // Clouds drift slowly above the sea.
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    clouds.push({
      x: rng.range(-5200, 5200),
      y: rng.range(-4600, 4600),
      z: rng.range(320, 640),
      scale: rng.range(0.7, 1.9),
      speed: rng.range(2, 6),
    });
  }

  return { islands, clouds, seed };
}

// Terrain height in metres at a world point. Sea level is 0.
function terrainHeight(world, x, y) {
  let h = 0;
  for (const isl of world.islands) {
    const d = distance2d(x, y, isl.x, isl.y);
    if (d >= isl.r) continue;
    const t = d / isl.r;
    // Cosine dome: flat-ish top, steep skirt, beach at the edge.
    let dome = (Math.cos(t * Math.PI) + 1) / 2;
    if (isl.kind === 'volcano') {
      // A crater dip right at the summit.
      const crater = Math.max(0, 1 - t * 6);
      dome = dome * (1 - 0.45 * crater);
    }
    h = Math.max(h, dome * isl.peak);
  }
  // Flatten the ground around every airstrip so runways are level, with a
  // wide smooth blend: flat at the strip, full terrain 900 m out. A hard
  // edge here would be a cliff at the runway end.
  for (const strip of CONFIG.strips) {
    const hdg = strip.headingDeg * DEG;
    const dx = x - strip.x;
    const dy = y - strip.y;
    const along = dx * Math.sin(hdg) + dy * Math.cos(hdg);
    const across = dx * Math.cos(hdg) - dy * Math.sin(hdg);
    const outAlong = Math.max(0, Math.abs(along) - CONFIG.runway.length / 2);
    const outAcross = Math.max(0, Math.abs(across) - 220);
    const d = Math.hypot(outAlong, outAcross);
    const t = clamp(d / 900, 0, 1);
    const smooth = t * t * (3 - 2 * t); // smoothstep: 0 at the strip, 1 far away
    h *= smooth;
  }
  return h;
}

// A fresh plane, parked on the home strip, engine idling.
function freshPlane() {
  const home = CONFIG.strips[0];
  return {
    x: home.x,
    y: home.y,
    alt: 0,
    heading: home.headingDeg * DEG,
    pitch: 0,
    bank: 0,
    speed: 0,
    throttle: 0.35,
    fuel: CONFIG.shift.startFuel,
    damage: 0,
    airborne: false,
    gearDown: true,
    flaps: false,
    verticalSpeed: 0,
    onGround: true,
    stripId: home.id,
    propAngle: 0,
    shake: 0,
  };
}

// The whole game state. The loop in main.js owns the state machine;
// this file owns the numbers inside 'flying'.
function makeGameState() {
  return {
    world: buildWorld(CONFIG.worldSeed),
    plane: freshPlane(),
    job: null,            // the active job, or null on the job board
    jobsDone: 0,
    coins: 0,
    shiftTimeLeft: CONFIG.shift.shiftSeconds,
    shiftOver: false,
    rings: [],            // checkpoint rings for the active job
    ringsHit: 0,
    message: '',          // centre-screen banner, set by events
    messageTimer: 0,
    landingScore: null,   // last landing quality: 'perfect' | 'smooth' | 'hard'
    lastPayout: null,     // breakdown shown on the delivered screen
    crashReason: '',
    events: [],           // one-frame event flags the loop reads: 'ring','land','crash','delivered','lowfuel'
  };
}

// Offer three jobs from the current strip. Types differ every time.
function offerJobs(state, rng) {
  const from = state.plane.stripId;
  const others = CONFIG.strips.filter((s) => s.id !== from);
  const types = rng.shuffle(['delivery', 'ringrun', 'medical', 'fragile']).slice(0, 3);
  return types.map((type) => {
    const dest = rng.pick(others);
    const cargo = rng.pick(CONFIG.cargo);
    const dist = distance2d(
      CONFIG.strips.find((s) => s.id === from).x,
      CONFIG.strips.find((s) => s.id === from).y,
      dest.x, dest.y,
    );
    const base = cargo.basePay + (dist / 1000) * 22;
    const pay = Math.round(base * CONFIG.jobTypes[type].payMult);
    return {
      type,
      label: CONFIG.jobTypes[type].label,
      desc: CONFIG.jobTypes[type].desc,
      cargo,
      from,
      to: dest,
      payout: pay,
      timeLimit: CONFIG.jobTypes[type].timeLimitSec,
      timeLeft: CONFIG.jobTypes[type].timeLimitSec,
      weight: type === 'ringrun' ? 0 : cargo.weight,
    };
  });
}

// Accept a job: place rings along the route and reset the clock.
function acceptJob(state, job, rng) {
  state.job = job;
  state.rings = [];
  state.ringsHit = 0;
  const from = CONFIG.strips.find((s) => s.id === job.from);
  const to = job.to; // offerJobs already stores the destination strip object
  const count = job.type === 'ringrun' ? CONFIG.rings.countMax : rng.int(CONFIG.rings.countMin, CONFIG.rings.countMax);
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const x = from.x + (to.x - from.x) * t + rng.range(-260, 260);
    const y = from.y + (to.y - from.y) * t + rng.range(-260, 260);
    state.rings.push({
      x, y,
      z: rng.range(140, 330),
      radius: CONFIG.rings.radius,
      hit: false,
    });
  }
  state.message = `${job.label}: ${job.cargo.name} → ${to.name}`;
  state.messageTimer = 3.5;
}

// Step the flight model one frame. Returns nothing; reads input steering
// and writes the plane, fuel, damage, rings and events.
function stepFlight(state, steer, dt, rng) {
  const p = state.plane;
  const cfg = CONFIG.plane;
  const job = state.job;

  // Throttle follows the input; empty tanks force a glide.
  p.throttle = clamp(p.throttle + steer.throttle * dt * 0.7, 0, 1);
  if (p.fuel <= 0) p.throttle = 0;

  // Bank and pitch chase the commanded values.
  const maxBank = cfg.maxBankDeg * DEG * (job && job.type === 'fragile' ? 0.6 : 1);
  const targetBank = steer.bank * maxBank;
  const targetPitch = steer.pitch * cfg.maxPitchDeg * DEG;
  p.bank += clamp(targetBank - p.bank, -cfg.bankRate * dt, cfg.bankRate * dt);
  p.pitch += clamp(targetPitch - p.pitch, -cfg.pitchRate * dt, cfg.pitchRate * dt);

  // Speed: throttle sets the target, dives add energy, hard banks bleed it.
  const weightLoss = 1 - (job ? job.weight : 0) * cfg.weightPenalty * 0.08;
  let targetSpeed = p.throttle * cfg.maxSpeed * weightLoss;
  if (p.pitch < -0.08) targetSpeed += -p.pitch * 120; // diving picks up speed
  const hardBank = Math.abs(p.bank) > 38 * DEG ? cfg.dragHardBank : 0;
  const accel = p.speed < targetSpeed ? cfg.accel : cfg.accel + hardBank;
  p.speed += clamp(targetSpeed - p.speed, -accel * dt, cfg.accel * dt);
  if (p.speed < 0) p.speed = 0;

  // Turn: coordinated, faster in a steeper bank, sluggish when slow.
  const turnRate = (9.81 * Math.tan(p.bank)) / Math.max(18, p.speed);
  p.heading += turnRate * dt;

  // Vertical: climb from pitch and speed, sink when stalled or gliding.
  const stalled = p.speed < cfg.stallSpeed && p.airborne;
  let climb = p.speed * Math.sin(p.pitch) * cfg.climbFactor;
  if (stalled) climb -= cfg.sinkRate;
  if (p.fuel <= 0 && p.airborne) climb -= cfg.sinkRate * 0.5;
  p.verticalSpeed = climb;
  p.alt += climb * dt;

  // Move over the ground.
  const groundSpeed = p.speed * Math.cos(p.pitch);
  p.x += Math.sin(p.heading) * groundSpeed * dt;
  p.y += Math.cos(p.heading) * groundSpeed * dt;
  p.propAngle += (4 + p.throttle * 26 + p.speed * 0.1) * dt;
  p.shake = Math.max(0, p.shake - dt * 3);

  // Fuel burns with throttle; warn once at the low mark.
  if (p.airborne || p.speed > 5) {
    p.fuel = Math.max(0, p.fuel - p.throttle * CONFIG.fuel.burnPerSec * dt);
    if (p.fuel <= CONFIG.fuel.lowWarn && p.fuel > 0 && !p.lowFuelWarned) {
      p.lowFuelWarned = true;
      state.events.push('lowfuel');
    }
    if (p.fuel > CONFIG.fuel.lowWarn) p.lowFuelWarned = false;
  }

  // Fragile cargo: banking past the cap while airborne strains the load.
  if (job && job.type === 'fragile' && p.airborne && Math.abs(p.bank) > CONFIG.plane.fragileBankCapDeg * DEG) {
    p.damage = Math.min(100, p.damage + 4 * dt);
  }

  // Rings: fly through the hoop and it pays.
  for (const ring of state.rings) {
    if (ring.hit) continue;
    const d = Math.hypot(p.x - ring.x, p.y - ring.y, p.alt - ring.z);
    if (d < ring.radius * 0.85) {
      ring.hit = true;
      state.ringsHit++;
      state.coins += CONFIG.scoring.ringCoin;
      if (job) job.timeLeft += CONFIG.rings.timeBonusSec;
      state.events.push('ring');
      state.message = `Ring! +${CONFIG.scoring.ringCoin} coins, +${CONFIG.rings.timeBonusSec}s`;
      state.messageTimer = 2;
    }
  }

  // Job clock.
  if (job) {
    job.timeLeft -= dt;
    if (job.timeLeft <= 0 && state.job) {
      state.message = 'Job clock ran out — the cargo goes back';
      state.messageTimer = 3;
      state.job = null;
      state.rings = [];
    }
  }
  state.shiftTimeLeft -= dt;
  if (state.shiftTimeLeft <= 0) state.shiftOver = true;

  // Ground contact: landing, rolling, or lifting off. The plane only
  // touches down while it is descending or level; a climbing plane whose
  // wheels have left the strip is airborne, even a metre up.
  const ground = terrainHeight(state.world, p.x, p.y);
  if (p.onGround && p.speed < cfg.rotateSpeed) {
    // Still on the runway: the wheels hold the plane down.
    p.alt = ground;
    p.verticalSpeed = 0;
  } else if (p.alt <= ground + 0.5 && p.verticalSpeed <= 0.5) {
    p.alt = ground;
    handleGroundContact(state, ground, dt);
  } else if (p.alt > ground + 0.5 && !p.airborne && p.speed > cfg.rotateSpeed) {
    p.airborne = true;
    p.onGround = false;
    p.gearDown = true;
    state.message = 'Airborne — gear up, flaps in';
    state.messageTimer = 2;
  }

  // Damage kills the sortie at 100%.
  if (p.damage >= 100 && !state.crashReason) {
    crash(state, 'Airframe gave out');
  }

  // Keep the plane inside the charted sea.
  p.x = clamp(p.x, -6000, 6000);
  p.y = clamp(p.y, -5600, 5600);
}

// What happens when the wheels (or the belly) meet the ground.
function handleGroundContact(state, ground, dt) {
  const p = state.plane;
  const cfg = CONFIG.plane;
  const wasAirborne = p.airborne;
  p.onGround = true;
  p.airborne = false;
  if (p.speed > 2) {
    // Rolling: brakes and drag slow the plane.
    const decel = (p.flaps ? 16 : 6) + 3;
    p.speed = Math.max(0, p.speed - decel * dt);
  }

  // Are we on a runway, aligned, slow and gentle? Then it is a landing.
  const strip = nearestStrip(state, 700);
  if (strip && wasAirborne) {
    const headingErr = Math.abs(angleDiff(p.heading, strip.headingDeg * DEG));
    const aligned = headingErr < 22 * DEG || headingErr > 158 * DEG;
    const gentle = Math.abs(p.verticalSpeed) < CONFIG.damage.hardLandingVs;
    const slowEnough = p.speed < 62;
    if (aligned && slowEnough) {
      const quality = Math.abs(p.verticalSpeed) < 1.8 && p.speed < 48 ? 'perfect'
        : gentle ? 'smooth' : 'hard';
      if (quality === 'hard') {
        p.damage = Math.min(100, p.damage + 12);
        state.message = 'Hard landing — the airframe felt that';
      } else {
        state.message = quality === 'perfect' ? 'Perfect landing!' : 'Smooth landing';
      }
      state.messageTimer = 3;
      state.landingScore = quality;
      state.events.push('land');
      landAtStrip(state, strip, quality);
      return;
    }
  }

  // Not a runway landing: water or rough ground.
  if (wasAirborne) {
    // A fast, steep arrival is a crash; a slow belly touch is damage.
    if (Math.abs(p.verticalSpeed) > 6 || p.speed > 55) {
      crash(state, p.speed > 40 ? 'Ditched in the sea' : 'Clipped the terrain');
    } else {
      p.damage = Math.min(100, p.damage + 18);
      p.speed = 0;
      state.message = 'Rough ground — airframe damaged';
      state.messageTimer = 3;
      if (p.damage >= 100) crash(state, 'Airframe gave out');
    }
  }

  // Damage kills the sortie at 100%.
  if (p.damage >= 100 && !state.crashReason) {
    crash(state, 'Airframe gave out');
  }
}

// The strip under (or nearest to) the plane, within maxDist metres.
function nearestStrip(state, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const strip of CONFIG.strips) {
    const d = distance2d(state.plane.x, state.plane.y, strip.x, strip.y);
    if (d < bestD) {
      bestD = d;
      best = strip;
    }
  }
  return best;
}

// A landing on a strip: settle the plane, pay the job if this is the destination.
function landAtStrip(state, strip, quality) {
  const p = state.plane;
  p.stripId = strip.id;
  p.heading = strip.headingDeg * DEG;
  p.bank = 0;
  p.pitch = 0;
  p.alt = terrainHeight(state.world, p.x, p.y);
  const job = state.job;
  if (!job || job.to.id !== strip.id) return; // landed somewhere else: no payout
  const landingBonus = quality === 'perfect' ? CONFIG.scoring.perfectLandingBonus
    : quality === 'smooth' ? CONFIG.scoring.smoothLandingBonus : 0;
  const onTime = job.timeLeft > 30 ? CONFIG.scoring.onTimeBonus : 0;
  const ringBonus = state.ringsHit * CONFIG.scoring.ringCoin;
  const total = job.payout + landingBonus + onTime;
  state.coins += total;
  state.jobsDone++;
  state.lastPayout = {
    jobLabel: job.label,
    cargo: job.cargo.name,
    dest: strip.name,
    payout: job.payout,
    landingBonus,
    onTime,
    ringBonus,
    total,
    quality,
  };
  state.job = null;
  state.rings = [];
  state.events.push('delivered');
  // Top up the tanks at the destination strip.
  p.fuel = CONFIG.shift.startFuel;
}

// End the sortie in a crash.
function crash(state, reason) {
  const p = state.plane;
  state.crashReason = reason;
  p.shake = 1;
  p.speed = 0;
  state.events.push('crash');
}
