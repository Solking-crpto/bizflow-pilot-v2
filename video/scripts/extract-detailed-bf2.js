import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const clip = 'BizFlow2.mp4';
const outDir = path.resolve('video/cache/frames/BizFlow2_detailed');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

execSync(`ffmpeg -y -i "video/raw/${clip}" -vf "fps=1" "${outDir}/sec_%02d.jpg"`);
console.log('Detailed frames extracted for BizFlow2:', fs.readdirSync(outDir).length);
