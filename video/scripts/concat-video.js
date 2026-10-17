import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('video-out');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Create concat list with absolute or relative paths
const concatListPath = path.resolve('video/cache/concat_list.txt');
const listContent = [];
for (let i = 0; i <= 7; i++) {
  const scenePath = path.resolve(`video/cache/scenes/scene_${i}.mp4`).replace(/\\/g, '/');
  listContent.push(`file '${scenePath}'`);
}
fs.writeFileSync(concatListPath, listContent.join('\n'));
console.log('Created concat list:', concatListPath);

const assPath = 'video/cache/captions.ass';
const finalOut = path.resolve(outDir, 'BizFlow-Pilot-V2-Demo.mp4');

console.log('Rendering final video with burned-in subtitles, H.264 High profile, +faststart...');
const cmd = `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -vf "ass=${assPath}" -c:v libx264 -preset medium -crf 18 -profile:v high -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -movflags +faststart "${finalOut}"`;

console.log('Executing:', cmd);
execSync(cmd, { stdio: 'inherit' });

console.log('Final video rendered successfully at:', finalOut);
