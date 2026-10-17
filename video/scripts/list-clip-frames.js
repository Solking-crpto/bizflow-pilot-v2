import fs from 'fs';
import path from 'path';

// Let's list all extracted frames per clip
const base = path.resolve('video/cache/frames');
const clips = fs.readdirSync(base).sort();

for (const c of clips) {
  const p = path.join(base, c);
  const files = fs.readdirSync(p);
  console.log(`Clip ${c}: ${files.length} frames (${files.join(', ')})`);
}
