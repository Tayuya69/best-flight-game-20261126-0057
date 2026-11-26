// Cendrawasih Airlift — random.js
// One job: a small seeded random generator. Shot mode and job spawning
// both use it, so a given seed always builds the same archipelago.

// mulberry32: a tiny, fast seeded PRNG with a full 32-bit period.
function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A seeded generator with the helpers the world builder wants.
function makeSeededRandom(seed) {
  const next = makeRng(seed);
  return {
    // Uniform float in [0, 1).
    next,
    // Uniform float in [min, max).
    range(min, max) {
      return min + (max - min) * next();
    },
    // Uniform integer in [min, max].
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    // One element of an array, uniformly.
    pick(array) {
      return array[Math.floor(next() * array.length)];
    },
    // Fisher-Yates shuffle, in place, returning the array.
    shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = array[i];
        array[i] = array[j];
        array[j] = tmp;
      }
      return array;
    },
  };
}
