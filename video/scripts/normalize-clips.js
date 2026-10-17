import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const rawDir = path.resolve('video/raw');
const normDir = path.resolve('video/cache/normalized');
if (!fs.existsSync(normDir)) {
  fs.mkdirSync(normDir, { recursive: true });
}

const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.mp4')).sort();
console.log(`Normalizing ${files.length} clips to 1920x1080 30fps CFR, letterbox with Ink #0B1F33...`);

for (const file of files) {
  const src = path.join(rawDir, file);
  const dst = path.join(normDir, file);
  
  console.log(`Normalizing ${file}...`);
  // Scale keeping aspect ratio, pad with Ink (#0B1F33), force 30fps CFR, drop audio
  const filter = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0B1F33,format=yuv420p';
  const cmd = `ffmpeg -y -i "${src}" -vf "${filter}" -r 30 -an -c:v libx264 -preset fast -crf 18 "${dst}"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log(`Normalized ${file} -> ${dst}`);
}

console.log('All clips successfully normalized.');
