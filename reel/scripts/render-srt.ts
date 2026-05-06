/**
 * Regenerate captions.srt from script.json.
 *   pnpm reel:srt
 *
 * Self-contained — no other reel/ files needed. Drop the resulting
 * captions.srt onto a CapCut/Premiere/DaVinci timeline as a subtitle
 * track to get burned-in English subtitles synced to the Spanish voice.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Shot {
  id: string;
  t: number;
  dur: number;
  subtitle_en: string;
}
interface Script { shots: Shot[] }

const here = dirname(fileURLToPath(import.meta.url));
const reelRoot = resolve(here, '..');

const fmt = (t: number): string => {
  const ms = Math.round((t % 1) * 1000);
  const total = Math.floor(t);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
};

const script: Script = JSON.parse(readFileSync(resolve(reelRoot, 'script.json'), 'utf-8'));
const srt = script.shots.map((shot, i) => {
  // Trim 100ms off the end so cues don't visually collide on cuts.
  const start = fmt(shot.t);
  const end = fmt(shot.t + Math.max(shot.dur - 0.1, 0.1));
  return `${i + 1}\n${start} --> ${end}\n${shot.subtitle_en}\n`;
}).join('\n');

const outPath = resolve(reelRoot, 'captions.srt');
writeFileSync(outPath, srt, 'utf-8');
console.log(`[srt] wrote ${script.shots.length} cues to ${outPath}`);
