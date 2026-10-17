import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const rawDir = path.resolve('video/raw');
const framesBaseDir = path.resolve('video/cache/frames');
if (!fs.existsSync(framesBaseDir)) {
  fs.mkdirSync(framesBaseDir, { recursive: true });
}

const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.mp4')).sort();

for (const file of files) {
  const clipName = path.basename(file, path.extname(file));
  const clipFramesDir = path.join(framesBaseDir, clipName);
  if (!fs.existsSync(clipFramesDir)) {
    fs.mkdirSync(clipFramesDir, { recursive: true });
  }

  const filePath = path.join(rawDir, file);
  console.log(`Extracting frames for ${file}...`);

  // Extract one frame every 2 seconds
  const cmd = `ffmpeg -y -i "${filePath}" -vf "fps=1/2" "${path.join(clipFramesDir, 'sec_%03d.jpg')}"`;
  execSync(cmd, { stdio: 'ignore' });

  // Extract first frame
  const cmdFirst = `ffmpeg -y -i "${filePath}" -vframes 1 "${path.join(clipFramesDir, 'first.jpg')}"`;
  execSync(cmdFirst, { stdio: 'ignore' });

  // Extract last frame (seek near end)
  const probeCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
  const dur = parseFloat(execSync(probeCmd, { encoding: 'utf8' }).trim());
  const lastTime = Math.max(0, dur - 0.5);
  const cmdLast = `ffmpeg -y -ss ${lastTime} -i "${filePath}" -vframes 1 "${path.join(clipFramesDir, 'last.jpg')}"`;
  execSync(cmdLast, { stdio: 'ignore' });

  const extracted = fs.readdirSync(clipFramesDir);
  console.log(`Extracted ${extracted.length} frames for ${file}`);
}

console.log('Frame extraction complete.');
