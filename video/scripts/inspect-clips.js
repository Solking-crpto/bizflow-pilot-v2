import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const rawDir = path.resolve('video/raw');
const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.mp4')).sort();

console.log(`Inspecting ${files.length} clips in ${rawDir}...`);

const report = [];

for (const file of files) {
  const filePath = path.join(rawDir, file);
  try {
    const cmd = `ffprobe -v error -show_entries format=duration -show_streams -of json "${filePath}"`;
    const out = JSON.parse(execSync(cmd, { encoding: 'utf8' }));
    
    const vStream = out.streams.find(s => s.codec_type === 'video');
    const aStream = out.streams.find(s => s.codec_type === 'audio');
    
    let fps = 0;
    if (vStream && vStream.avg_frame_rate) {
      const [num, den] = vStream.avg_frame_rate.split('/').map(Number);
      fps = den ? Math.round((num / den) * 100) / 100 : 0;
    }

    report.push({
      file,
      duration: parseFloat(out.format.duration || (vStream && vStream.duration) || 0),
      width: vStream ? vStream.width : 0,
      height: vStream ? vStream.height : 0,
      fps,
      vCodec: vStream ? vStream.codec_name : 'unknown',
      hasAudio: Boolean(aStream),
      aCodec: aStream ? aStream.codec_name : 'none',
      fileSizeBytes: fs.statSync(filePath).size,
    });
  } catch (err) {
    console.error(`Error probing ${file}:`, err.message);
  }
}

console.log(JSON.stringify(report, null, 2));
fs.writeFileSync('video/cache/inspect-report.json', JSON.stringify(report, null, 2));
