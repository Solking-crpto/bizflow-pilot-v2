import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Let's inspect the text in each clip by sampling frames
const rawDir = path.resolve('video/raw');
const clips = fs.readdirSync(rawDir).filter(f => f.endsWith('.mp4')).sort();

for (const clip of clips) {
  const filePath = path.join(rawDir, clip);
  // Get duration
  const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, { encoding: 'utf8' }).trim());
  console.log(`=== Clip: ${clip} (Duration: ${dur.toFixed(2)}s) ===`);
}
