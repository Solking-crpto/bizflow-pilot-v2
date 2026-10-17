import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let total = 0;
for (let i = 0; i <= 7; i++) {
  const file = path.join(__dirname, '..', 'cache', 'scenes', `scene_${i}.mp4`);
  const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`;
  const dur = parseFloat(execSync(cmd).toString().trim());
  console.log(`Scene ${i}: ${dur.toFixed(3)}s`);
  total += dur;
}
console.log(`Total duration: ${total.toFixed(3)}s`);
