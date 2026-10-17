import fs from 'fs';
import path from 'path';

// Let's print the files in each frame directory
for (let i = 1; i <= 8; i++) {
  const name = i === 1 ? 'BizFlow!' : `BizFlow${i}`;
  const dir = path.resolve(`video/cache/frames/${name}`);
  if (fs.existsSync(dir)) {
    const frames = fs.readdirSync(dir);
    console.log(`${name}: ${frames.length} frames (${frames.slice(0, 5).join(', ')}...)`);
  }
}
