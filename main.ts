// Cendrawasih Airlift — main.ts
// The entrypoint: copies game/ and screenshots/ into the output directory
// and writes dossier.json with buildDossier from vendor/makefun-game.ts.
// Node 22, standard library only. Run twice and the bytes must match.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const REPO_DIR = fileURLToPath(new URL('.', import.meta.url));

// The dossier caps this competition gates on: 160 KiB of source text,
// at most 4 screenshots of at most 256 KiB each, game/ at most 993
// files and directories and 48 MiB in all.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

function main(): void {
  if (existsSync(OUTPUT_DIR)) {
    rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // The game and its screenshots, copied whole.
  cpSync(join(REPO_DIR, 'game'), join(OUTPUT_DIR, 'game'), { recursive: true });
  cpSync(join(REPO_DIR, 'screenshots'), join(OUTPUT_DIR, 'screenshots'), { recursive: true });

  // The dossier is built from the output tree itself, so it always
  // describes exactly what was handed in.
  const dossier = buildDossier(OUTPUT_DIR, CAPS);
  writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossier);
}

main();
