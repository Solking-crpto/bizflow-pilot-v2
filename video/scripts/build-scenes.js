import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const scenesDir = path.resolve('video/cache/scenes');
if (!fs.existsSync(scenesDir)) fs.mkdirSync(scenesDir, { recursive: true });

const manifest = JSON.parse(fs.readFileSync('video/cache/audio-manifest.json', 'utf8'));
const audioResults = manifest.audioResults;

console.log('Building 8 scene clips matching exact audio durations...');

for (const sc of audioResults) {
  const sceneId = sc.sceneId;
  const dur = sc.duration;
  const audioPath = sc.audioPath;
  const outPath = path.join(scenesDir, `scene_${sceneId}.mp4`);
  const ltPath = path.resolve(`video/assets/generated/lower_third_scene_${sceneId}.png`);

  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 100000 && sceneId < 5) {
    console.log(`Scene ${sceneId} already compiled, skipping.`);
    continue;
  }

  console.log(`\n--- Compiling Scene ${sceneId} (${sc.name}): target duration = ${dur.toFixed(2)}s ---`);

  if (sceneId === 0) {
    const titlePlate = path.resolve('video/assets/generated/title_card.png');
    const frames = Math.ceil(dur * 30);
    const filter = `loop=loop=${frames}:size=1:start=0,scale=1920:1080,zoompan=z='min(zoom+0.0002,1.03)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30,setsar=1,format=yuv420p`;
    const cmd = `ffmpeg -y -loop 1 -t ${dur} -i "${titlePlate}" -i "${audioPath}" -vf "${filter}" -c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k -ar 48000 -shortest "${outPath}"`;
    execSync(cmd, { stdio: 'inherit' });
  } else if (sceneId === 1) {
    const rawClip = path.resolve('video/cache/normalized/BizFlow2.mp4');
    const filter = `[0:v]trim=start=0.5:duration=${dur},setpts=PTS-STARTPTS,setsar=1,fps=30[v0];[v0][1:v]overlay=0:0:enable='between(t,0.5,5.5)'[outv]`;
    const cmd = `ffmpeg -y -i "${rawClip}" -i "${ltPath}" -i "${audioPath}" -filter_complex "${filter}" -map "[outv]" -map 2:a -c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k -ar 48000 -t ${dur} "${outPath}"`;
    execSync(cmd, { stdio: 'inherit' });
  } else if (sceneId === 2) {
    const rawClip = path.resolve('video/cache/normalized/BizFlow3.mp4');
    const speedFactor = 22.7 / dur;
    const filter = `[0:v]setpts=${(1 / speedFactor).toFixed(4)}*PTS,trim=duration=${dur},setsar=1,fps=30[v0];[v0][1:v]overlay=0:0:enable='between(t,0.5,5.5)'[outv]`;
    const cmd = `ffmpeg -y -i "${rawClip}" -i "${ltPath}" -i "${audioPath}" -filter_complex "${filter}" -map "[outv]" -map 2:a -c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k -ar 48000 -t ${dur} "${outPath}"`;
    execSync(cmd, { stdio: 'inherit' });
  } else if (sceneId === 3) {
    const rawClip = path.resolve('video/cache/normalized/BizFlow4.mp4');
    const speedFactor = 33.2 / dur;
    const filter = `[0:v]setpts=${(1 / speedFactor).toFixed(4)}*PTS,trim=duration=${dur},setsar=1,fps=30[v0];[v0][1:v]overlay=0:0:enable='between(t,0.5,5.5)'[outv]`;
    const cmd = `ffmpeg -y -i "${rawClip}" -i "${ltPath}" -i "${audioPath}" -filter_complex "${filter}" -map "[outv]" -map 2:a -c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k -ar 48000 -t ${dur} "${outPath}"`;
    execSync(cmd, { stdio: 'inherit' });
  } else if (sceneId === 4) {
    const rawClip = path.resolve('video/cache/normalized/BizFlow5.mp4');
    const speedFactor = 20.1 / dur;
    const filter = `[0:v]setpts=${(1 / speedFactor).toFixed(4)}*PTS,trim=duration=${dur},setsar=1,fps=30[v0];[v0][1:v]overlay=0:0:enable='between(t,0.5,5.5)'[outv]`;
    const cmd = `ffmpeg -y -i "${rawClip}" -i "${ltPath}" -i "${audioPath}" -filter_complex "${filter}" -map "[outv]" -map 2:a -c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k -ar 48000 -t ${dur} "${outPath}"`;
    execSync(cmd, { stdio: 'inherit' });
  } else if (sceneId === 5) {
    const rawClip = path.resolve('video/cache/normalized/BizFlow6.mp4');
    const illustPlate = path.resolve('video/assets/generated/scene_5_illustration.png');
    const realDur = 6.5;
    const illustDur = dur - realDur;

    const filter = `
      [0:v]trim=start=1.0:duration=${realDur},setpts=PTS-STARTPTS,setsar=1,fps=30[vReal];
      [1:v]loop=loop=-1:size=1:start=0,trim=duration=${illustDur},setpts=PTS-STARTPTS,setsar=1,fps=30,format=yuv420p[vIllust];
      [vReal][vIllust]concat=n=2:v=1:a=0[vMerged];
      [vMerged][2:v]overlay=0:0:enable='between(t,0.5,5.0)'[outv]
    `.replace(/\s+/g, ' ').trim();

    const cmd = `ffmpeg -y -i "${rawClip}" -i "${illustPlate}" -i "${ltPath}" -i "${audioPath}" -filter_complex "${filter}" -map "[outv]" -map 3:a -c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k -ar 48000 -t ${dur} "${outPath}"`;
    execSync(cmd, { stdio: 'inherit' });
  } else if (sceneId === 6) {
    const rawClip = path.resolve('video/cache/normalized/BizFlow7.mp4');
    const filter = `[0:v]trim=start=2.0:duration=${dur},setpts=PTS-STARTPTS,setsar=1,fps=30[v0];[v0][1:v]overlay=0:0:enable='between(t,0.5,4.5)'[outv]`;
    const cmd = `ffmpeg -y -i "${rawClip}" -i "${ltPath}" -i "${audioPath}" -filter_complex "${filter}" -map "[outv]" -map 2:a -c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k -ar 48000 -t ${dur} "${outPath}"`;
    execSync(cmd, { stdio: 'inherit' });
  } else if (sceneId === 7) {
    const rawClip = path.resolve('video/cache/normalized/BizFlow8.mp4');
    const endPlate = path.resolve('video/assets/generated/end_card.png');
    const mainnetDur = 5.8;
    const endDur = dur - mainnetDur;

    const filter = `
      [0:v]trim=start=1.0:duration=${mainnetDur},setpts=PTS-STARTPTS,setsar=1,fps=30[vNet];
      [1:v]loop=loop=-1:size=1:start=0,trim=duration=${endDur},setpts=PTS-STARTPTS,setsar=1,fps=30,format=yuv420p[vEnd];
      [vNet][vEnd]concat=n=2:v=1:a=0[vMerged];
      [vMerged][2:v]overlay=0:0:enable='between(t,0.5,5.0)'[outv]
    `.replace(/\s+/g, ' ').trim();

    const cmd = `ffmpeg -y -i "${rawClip}" -i "${endPlate}" -i "${ltPath}" -i "${audioPath}" -filter_complex "${filter}" -map "[outv]" -map 3:a -c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k -ar 48000 -t ${dur} "${outPath}"`;
    execSync(cmd, { stdio: 'inherit' });
  }

  console.log(`Scene ${sceneId} compiled successfully.`);
}

console.log('All 8 scene clips successfully compiled.');
