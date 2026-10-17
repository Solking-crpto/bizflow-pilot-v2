import { execSync } from 'child_process';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('video-out');
const cacheDir = path.resolve('video/cache/stills');
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

const videoPath = path.resolve('video-out/BizFlow-Pilot-V2-Demo.mp4');

// 8 scenes with timestamps to extract
const scenes = [
  { id: 0, time: 5.0, label: '00 / Title Card & Problem Statement' },
  { id: 1, time: 16.0, label: '01 / Dual-Network Switch & Judge Guide' },
  { id: 2, time: 28.0, label: '02 / Non-Custodial Sign-In & Limits' },
  { id: 3, time: 38.0, label: '03 / Purchase Orders & 3-Way Match' },
  { id: 4, time: 50.0, label: '04 / AI Advisory Copilot & Heuristics' },
  { id: 5, time: 64.0, label: '05 / Settlement Verification Flow' },
  { id: 6, time: 72.0, label: '06 / Tamper-Evident SHA-256 Ledger' },
  { id: 7, time: 83.0, label: '07 / Live Testnet & Mainnet Beta' },
];

console.log('Extracting scene representative stills from final video...');
for (const sc of scenes) {
  const stillPath = path.join(cacheDir, `scene_${sc.id}.png`);
  const cmd = `ffmpeg -y -ss ${sc.time} -i "${videoPath}" -vframes 1 -q:v 2 "${stillPath}"`;
  execSync(cmd, { stdio: 'ignore' });
  console.log(`Extracted still for scene ${sc.id} at ${sc.time}s`);
}

// Also extract a hero frame for thumbnail (e.g. from Scene 4 or Scene 2 or Scene 5)
const heroPath = path.join(cacheDir, 'hero_ui.png');
execSync(`ffmpeg -y -ss 48.0 -i "${videoPath}" -vframes 1 -q:v 2 "${heroPath}"`, { stdio: 'ignore' });

async function createContactSheetAndThumbnail() {
  console.log('Launching browser to render contact sheet and thumbnail...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\DELL\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe'
  });

  // 1. Contact Sheet (1920x1080)
  const stillBase64 = {};
  for (const sc of scenes) {
    const buf = fs.readFileSync(path.join(cacheDir, `scene_${sc.id}.png`));
    stillBase64[sc.id] = `data:image/png;base64,${buf.toString('base64')}`;
  }

  const contactHtml = `
  <!DOCTYPE html>
  <html>
  <head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Inter:wght@600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1920px;
      height: 1080px;
      background: #0B1F33;
      color: #FFFFFF;
      font-family: 'Inter', sans-serif;
      padding: 40px 60px;
      display: flex;
      flex-direction: column;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 16px;
    }
    .title-group h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    .title-group h1 span { color: #19C3AE; }
    .title-group p {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 13px;
      color: #94A3B8;
      margin-top: 4px;
    }
    .meta {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 13px;
      color: #CBD5E1;
      text-align: right;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 20px;
      flex: 1;
    }
    .card {
      background: #12355B;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .img-box {
      position: relative;
      width: 100%;
      height: 205px;
      background: #000;
    }
    .img-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .time-badge {
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.75);
      font-family: 'IBM Plex Mono', monospace;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      color: #FFF;
    }
    .card-info {
      padding: 10px 14px;
      background: rgba(11, 31, 51, 0.95);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 13px;
      font-weight: 600;
      color: #F8FAFC;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #19C3AE;
    }
  </style>
  </head>
  <body>
    <header>
      <div class="title-group">
        <h1>BizFlow Pilot <span>V2</span> &mdash; Video Contact Sheet</h1>
        <p>Tameion Hackathon Demo &bull; 8 Scenes &bull; Total Duration: 86.67s &bull; Arc Testnet & Mainnet</p>
      </div>
      <div class="meta">
        <div>1920x1080 @ 30fps CFR</div>
        <div>Non-Custodial AP Copilot</div>
      </div>
    </header>
    <div class="grid">
      ${scenes.map(sc => `
        <div class="card">
          <div class="img-box">
            <img src="${stillBase64[sc.id]}">
            <div class="time-badge">${sc.time.toFixed(1)}s</div>
          </div>
          <div class="card-info">
            <span class="dot"></span>
            <span>${sc.label}</span>
          </div>
        </div>
      `).join('')}
    </div>
  </body>
  </html>
  `;

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.setContent(contactHtml);
  await page.screenshot({ path: path.join(outDir, 'contact-sheet.png') });
  console.log('Saved video-out/contact-sheet.png');

  // 2. Thumbnail (1280x720)
  const heroBuf = fs.readFileSync(heroPath);
  const heroBase64 = `data:image/png;base64,${heroBuf.toString('base64')}`;
  const logoSvg = fs.readFileSync('video/assets/logo-mark.svg', 'utf8');

  const thumbHtml = `
  <!DOCTYPE html>
  <html>
  <head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@600;700&family=Inter:wght@700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1280px;
      height: 720px;
      background: #0B1F33;
      color: #FFFFFF;
      font-family: 'Inter', sans-serif;
      position: relative;
      overflow: hidden;
      display: flex;
    }
    .left-panel {
      width: 580px;
      height: 100%;
      background: linear-gradient(135deg, #0B1F33 0%, #12355B 100%);
      padding: 50px 45px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      z-index: 2;
      box-shadow: 15px 0 35px rgba(0, 0, 0, 0.6);
      border-right: 1px solid rgba(255, 255, 255, 0.1);
    }
    .logo-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .logo-mark {
      width: 56px;
      height: 56px;
      filter: drop-shadow(0 6px 14px rgba(14, 159, 142, 0.4));
    }
    .badge {
      padding: 4px 12px;
      border-radius: 9999px;
      background: rgba(14, 159, 142, 0.2);
      border: 1px solid #19C3AE;
      color: #19C3AE;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .main-copy h1 {
      font-size: 52px;
      font-weight: 900;
      line-height: 1.05;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
    }
    .main-copy h1 span {
      background: linear-gradient(135deg, #19C3AE 0%, #0E9F8E 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .main-copy p {
      font-size: 19px;
      color: #94A3B8;
      font-weight: 600;
      line-height: 1.35;
      margin-bottom: 24px;
    }
    .feature-tags {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .feature-tag {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 13px;
      font-weight: 600;
      color: #E2E8F0;
    }
    .check {
      color: #19C3AE;
      font-weight: bold;
    }
    .footer-url {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 15px;
      font-weight: 700;
      color: #19C3AE;
      background: rgba(14, 159, 142, 0.1);
      padding: 10px 16px;
      border-radius: 8px;
      border: 1px solid rgba(14, 159, 142, 0.3);
      display: inline-block;
    }
    .right-preview {
      flex: 1;
      height: 100%;
      position: relative;
      background: #000;
      overflow: hidden;
    }
    .right-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scale(1.05);
      filter: contrast(1.05) brightness(0.95);
    }
    .preview-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to right, rgba(11, 31, 51, 0.6) 0%, transparent 40%),
                  linear-gradient(to top, rgba(11, 31, 51, 0.8) 0%, transparent 30%);
    }
    .corner-badge {
      position: absolute;
      bottom: 24px;
      right: 28px;
      padding: 6px 14px;
      background: rgba(11, 31, 51, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px;
      font-weight: 600;
      color: #F8FAFC;
    }
  </style>
  </head>
  <body>
    <div class="left-panel">
      <div>
        <div class="logo-row">
          <div class="logo-mark">${logoSvg}</div>
          <div class="badge">Tameion Hackathon</div>
        </div>
      </div>
      <div class="main-copy">
        <h1>BizFlow<br>Pilot <span>V2</span></h1>
        <p>The AI proposes.<br>Rules decide. The wallet pays.</p>
        <div class="feature-tags">
          <div class="feature-tag"><span class="check">&check;</span> Arc Testnet & Mainnet in One App</div>
          <div class="feature-tag"><span class="check">&check;</span> 3-Way Match & Untrusted Text Defenses</div>
          <div class="feature-tag"><span class="check">&check;</span> Self-Custody & Tamper-Evident Ledger</div>
        </div>
      </div>
      <div>
        <div class="footer-url">bizflow-pilot-v2.vercel.app</div>
      </div>
    </div>
    <div class="right-preview">
      <img src="${heroBase64}">
      <div class="preview-overlay"></div>
      <div class="corner-badge">Real App UI &bull; No Synthetic Proof</div>
    </div>
  </body>
  </html>
  `;

  const thumbPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await thumbPage.setContent(thumbHtml);
  await thumbPage.screenshot({ path: path.join(outDir, 'thumbnail.png') });
  console.log('Saved video-out/thumbnail.png');

  await browser.close();
  console.log('Visual assets generated successfully!');
}

createContactSheetAndThumbnail().catch(err => {
  console.error('Failed to generate visual assets:', err);
  process.exit(1);
});
