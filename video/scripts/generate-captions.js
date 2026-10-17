import fs from 'fs';
import path from 'path';

const manifest = JSON.parse(fs.readFileSync('video/cache/audio-manifest.json', 'utf8'));
const audioResults = manifest.audioResults;

// Let's compute scene start times and cumulative timeline
const sceneTimeline = [];
let currentTime = 0;

for (const res of audioResults) {
  const startTime = currentTime;
  const duration = res.duration;
  const endTime = startTime + duration;
  sceneTimeline.push({
    ...res,
    startTime,
    endTime,
  });
  currentTime = endTime;
}

function formatSrtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function formatAssTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// Build SRT entries (splitting sentences so they are easily readable, 1-2 lines max)
const srtEntries = [];
const assEvents = [];
let srtIndex = 1;

for (const sc of sceneTimeline) {
  // Break captionText into 1 or 2 chunks if long
  const sentences = sc.captionText.match(/[^.!?]+[.!?]+/g) || [sc.captionText];
  const chunkDur = sc.duration / sentences.length;

  for (let j = 0; j < sentences.length; j++) {
    const sStart = sc.startTime + j * chunkDur;
    const sEnd = sStart + chunkDur;
    const text = sentences[j].trim();

    srtEntries.push(`${srtIndex++}\n${formatSrtTime(sStart)} --> ${formatSrtTime(sEnd)}\n${text}\n`);
    assEvents.push(`Dialogue: 0,${formatAssTime(sStart)},${formatAssTime(sEnd)},Default,,0,0,0,,${text}`);
  }
}

// 1. Write video-out/captions.srt
const srtContent = srtEntries.join('\n');
fs.writeFileSync('video-out/captions.srt', srtContent);
console.log('Saved video-out/captions.srt');

// 2. Write video/cache/captions.ass
const assHeader = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Inter,36,&H00FFFFFF,&H000000FF,&H990B1F33,&H990B1F33,-1,0,0,0,100,100,0,0,3,12,0,2,80,80,48,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

const assContent = assHeader + assEvents.join('\n') + '\n';
fs.writeFileSync('video/cache/captions.ass', assContent);
console.log('Saved video/cache/captions.ass');

fs.writeFileSync('video/cache/timeline-manifest.json', JSON.stringify({
  totalDuration: currentTime,
  sceneTimeline,
}, null, 2));
console.log(`Timeline compiled: ${currentTime.toFixed(2)}s total duration.`);
