# Cendrawasih Airlift

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/Tayuya69/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/Tayuya69/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A flight game for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057).

Fly a twin-prop cargo plane between island airstrips across a stylised Indonesian archipelago — turquoise sea, green volcanic islands, rice terraces, stilt villages, late-afternoon light. Take a job at the job board, take off, thread the glowing checkpoint rings, manage throttle and fuel, and flare before you touch down. Hard landings damage the airframe; 100% damage ends the sortie.

## How to play

- **Arrows / WASD** — pitch and bank
- **W/S or Shift** — throttle
- **Space** — flaps and brake
- **Mouse** — drag to steer, scroll for throttle
- **Enter** — start / next job
- **P** — pause, **M** — mute

Jobs come in four kinds: standard **Delivery**, **Ring Run** time trials, **Medical Dash** (short clock, big payout) and **Fragile Cargo** (no hard moves — damage past 40% fails the job). A shift is four jobs or five minutes. Smooth landings pay a bonus; rings pay coins and time.

## Running it

Open `game/index.html` from any static server — for example `node serve.ts`, then visit http://localhost:8080. No network requests, no build step; all art is drawn in code and all sound is synthesized with WebAudio.

## Layout

- `game/src/config.js` — tuning, palette, jobs, scoring
- `game/src/random.js` — seeded random generator
- `game/src/audio.js` — synthesized engine, wind, chimes, bass loop
- `game/src/input.js` — keyboard and mouse input
- `game/src/world.js` — flight model, terrain, strips, rings, jobs
- `game/src/render.js` — sky, sea, islands, plane, HUD, screens
- `game/src/main.js` — game loop and state machine
- `game/src/shots.js` — deterministic screenshot scenes
- `main.ts` — hands the game in (copies `game/` and `screenshots/`, writes `dossier.json`)

## License

MIT — see `LICENSE`.
