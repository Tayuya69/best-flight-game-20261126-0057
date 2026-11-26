// Cendrawasih Airlift — config.js
// One job: every tunable number of the game lives here.
// Palette, plane handling, fuel and damage rates, jobs, scoring, shift length.

const CONFIG = {
  // Canvas the game draws into (screenshots are taken at this size).
  view: { width: 1280, height: 720 },

  // Warm late-afternoon palette: turquoise sea, green islands, amber sky.
  palette: {
    skyTop: '#2f6fb4',
    skyMid: '#7fb6dd',
    skyHorizon: '#ffd9a0',
    sunCore: '#fff3c4',
    sunGlow: 'rgba(255, 214, 130, 0.55)',
    seaDeep: '#0d5f7a',
    seaShallow: '#1fa8a0',
    seaSparkle: 'rgba(255,255,255,0.35)',
    sand: '#f2d8a0',
    grass: '#4d9b4d',
    forest: '#2e7d46',
    terraces: '#7fb069',
    volcanoRock: '#6b5a52',
    volcanoSmoke: 'rgba(220, 220, 220, 0.75)',
    villageRoof: '#c65a3c',
    runway: '#3a3f46',
    runwayEdge: '#f5f0dc',
    ring: '#ffd23f',
    ringGlow: 'rgba(255, 210, 63, 0.45)',
    hudPanel: 'rgba(8, 24, 38, 0.62)',
    hudText: '#eaf6ff',
    hudAccent: '#ffd23f',
    hudWarn: '#ff5a4e',
    hudGood: '#7be495',
  },

  // The plane: a chunky twin-prop cargo hauler.
  plane: {
    maxSpeed: 88,        // m/s at full throttle, level flight
    cruiseSpeed: 62,
    stallSpeed: 27,      // below this the wing stops flying
    rotateSpeed: 33,      // take-off speed on the runway
    maxBankDeg: 58,
    maxPitchDeg: 24,
    bankRate: 2.4,        // rad/s toward the commanded bank
    pitchRate: 1.9,
    accel: 14,            // m/s^2 toward the throttle target speed
    dragHardBank: 9,      // extra m/s^2 lost in a hard bank
    climbFactor: 0.92,    // how much of sin(pitch)*speed becomes climb
    sinkRate: 6,          // m/s sink when stalled or throttled out
    weightPenalty: 0.16,  // fractional speed loss per tonne of cargo
    fragileBankCapDeg: 22,// fragile cargo: banking past this hurts
  },

  // Fuel and damage: the decisions of a sortie.
  fuel: {
    capacity: 100,
    burnPerSec: 1.15,     // at full throttle
    lowWarn: 25,
    emptyGlide: true,     // running dry forces a glide landing
  },
  damage: {
    hardLandingVs: 4.5,   // vertical speed (m/s) above which a touchdown hurts
    hardLandingMax: 22,   // damage points for the worst touchdown
    fastLandingSpeed: 58, // landing above this speed hurts
    terrainClip: 100,     // clipping terrain or water ends the sortie
    fragileCap: 40,       // fragile cargo: sortie fails past this damage
    warnAt: 60,
  },

  // Rings: glowing checkpoint hoops on the route.
  rings: {
    radius: 46,
    timeBonusSec: 12,
    coinBonus: 25,
    countMin: 3,
    countMax: 5,
  },

  // Airstrips of the archipelago. headingDeg: runway direction, 0 = north.
  strips: [
    { id: 'babo',    name: 'Babo Field',    x: -2600, y: -1800, headingDeg: 18,  island: 'Babo' },
    { id: 'numfor',  name: 'Numfor Strip',  x: 2400,  y: -900,  headingDeg: 122, island: 'Numfor' },
    { id: 'waigeo',  name: 'Waigeo Bay',    x: 1800,  y: 2600,  headingDeg: 285, island: 'Waigeo' },
    { id: 'biak',    name: 'Biak Ridge',    x: -2200, y: 2400,  headingDeg: 64,  island: 'Biak' },
  ],
  runway: { length: 620, width: 34 },

  // Cargo types the job board offers.
  cargo: [
    { id: 'copra',   name: 'Copra sacks',      weight: 1.2, basePay: 120 },
    { id: 'fish',    name: 'Iced tuna crates', weight: 1.8, basePay: 160 },
    { id: 'spice',   name: 'Nutmeg & cloves',  weight: 0.8, basePay: 200 },
    { id: 'medicine',name: 'Medicine chest',   weight: 0.6, basePay: 320 },
    { id: 'tools',   name: 'Fishing gear',     weight: 2.2, basePay: 140 },
    { id: 'mail',    name: 'Island mail',      weight: 0.4, basePay: 90 },
  ],

  // Job types: same sky, different goals.
  jobTypes: {
    delivery: { label: 'Delivery',   desc: 'Fly the cargo to the far strip', payMult: 1.0, timeLimitSec: 300 },
    ringrun:  { label: 'Ring Run',   desc: 'Time trial: thread every ring',  payMult: 0.8, timeLimitSec: 150 },
    medical:  { label: 'Medical Dash', desc: 'Short clock, big payout',     payMult: 1.8, timeLimitSec: 150 },
    fragile:  { label: 'Fragile Cargo', desc: 'No hard moves: damage cap 40%', payMult: 1.6, timeLimitSec: 300 },
  },

  // A shift: the day's work.
  shift: { jobsPerShift: 4, shiftSeconds: 300, startFuel: 100 },

  // Scoring.
  scoring: {
    smoothLandingBonus: 80,
    perfectLandingBonus: 160,
    ringCoin: 25,
    onTimeBonus: 50,
  },

  // Deterministic world seed (shot mode and fresh games share it).
  worldSeed: 7,

  // Camera: chase view behind and above the tail.
  camera: { behind: 36, above: 11, lookAhead: 90, focal: 720, pitchDownDeg: 5 },
};

// Freeze the table so nothing at runtime rewrites the tuning.
Object.freeze(CONFIG);
Object.freeze(CONFIG.view);
Object.freeze(CONFIG.palette);
Object.freeze(CONFIG.plane);
Object.freeze(CONFIG.fuel);
Object.freeze(CONFIG.damage);
Object.freeze(CONFIG.rings);
Object.freeze(CONFIG.runway);
Object.freeze(CONFIG.shift);
Object.freeze(CONFIG.scoring);
Object.freeze(CONFIG.camera);
