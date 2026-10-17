import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('video/assets/generated');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const logoSvg = fs.readFileSync('video/assets/logo-mark.svg', 'utf8');

const HTML_TITLE_CARD = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1920px;
    height: 1080px;
    background: radial-gradient(circle at 50% 40%, #16406B 0%, #0B1F33 75%, #06111C 100%);
    color: #FFFFFF;
    font-family: 'Inter', sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
  .grid {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(circle at 50% 50%, black 40%, transparent 80%);
  }
  .content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .logo-box {
    width: 130px;
    height: 130px;
    margin-bottom: 28px;
    filter: drop-shadow(0 16px 32px rgba(14, 159, 142, 0.35));
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 18px;
    border-radius: 9999px;
    background: rgba(14, 159, 142, 0.15);
    border: 1px solid rgba(14, 159, 142, 0.4);
    color: #19C3AE;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 24px;
  }
  .badge-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #19C3AE;
    box-shadow: 0 0 10px #19C3AE;
  }
  h1 {
    font-size: 76px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.1;
    margin-bottom: 18px;
    background: linear-gradient(180deg, #FFFFFF 0%, #D8E2EC 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  h1 span {
    background: linear-gradient(135deg, #19C3AE 0%, #0E9F8E 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  p.tagline {
    font-size: 28px;
    font-weight: 500;
    color: #94A3B8;
    max-width: 900px;
    line-height: 1.4;
    margin-bottom: 36px;
  }
  .pill-group {
    display: flex;
    gap: 16px;
  }
  .pill {
    padding: 10px 22px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 14px;
    color: #CBD5E1;
  }
</style>
</head>
<body>
  <div class="grid"></div>
  <div class="content">
    <div class="logo-box">${logoSvg}</div>
    <div class="badge"><span class="badge-dot"></span> Tameion Hackathon Demo</div>
    <h1>BizFlow Pilot <span>V2</span></h1>
    <p class="tagline">The AI proposes. Rules decide. The wallet pays.</p>
    <div class="pill-group">
      <div class="pill">Autonomous Accounts Payable</div>
      <div class="pill">Non-Custodial on Arc</div>
      <div class="pill">Zero Synthetic Data</div>
    </div>
  </div>
</body>
</html>
`;

const HTML_SCENE5_ILLUSTRATION = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Inter:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1920px;
    height: 1080px;
    background: #0B1F33;
    color: #FFFFFF;
    font-family: 'Inter', sans-serif;
    display: flex;
    flex-direction: column;
    padding: 70px 100px;
    position: relative;
    overflow: hidden;
  }
  .watermark {
    position: absolute;
    top: 40px;
    right: 50px;
    padding: 8px 18px;
    border-radius: 8px;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.5);
    color: #FBBF24;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .header {
    margin-bottom: 50px;
  }
  .sub {
    font-family: 'IBM Plex Mono', monospace;
    color: #0E9F8E;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  h2 {
    font-size: 46px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  .grid-steps {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 28px;
    margin-top: 20px;
  }
  .step-card {
    background: linear-gradient(180deg, #12355B 0%, #0E253F 100%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    padding: 34px 28px;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .step-num {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 14px;
    font-weight: 600;
    color: #0E9F8E;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .step-num::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(14, 159, 142, 0.3);
  }
  .step-title {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: 16px;
    color: #F8FAFC;
  }
  .step-desc {
    font-size: 16px;
    line-height: 1.5;
    color: #94A3B8;
  }
  .step-tag {
    margin-top: auto;
    padding-top: 24px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    color: #38BDF8;
  }
  .connector {
    position: absolute;
    right: -18px;
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
    background: #0E9F8E;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 5;
    box-shadow: 0 0 12px rgba(14, 159, 142, 0.8);
    font-size: 12px;
  }
  .footer-note {
    margin-top: 55px;
    padding: 18px 28px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 14px;
    color: #94A3B8;
  }
</style>
</head>
<body>
  <div class="watermark">Illustration, not a recording</div>
  <div class="header">
    <div class="sub">Non-Custodial Payment Execution</div>
    <h2>How a payment is checked</h2>
  </div>

  <div class="grid-steps">
    <div class="step-card">
      <div class="step-num">STEP 01</div>
      <div class="step-title">Policy Engine: 10 Rules Approve</div>
      <div class="step-desc">Deterministic verification checks vendor authorization, spending limits, liquidity floor, matching integrity, and untrusted prompt flags.</div>
      <div class="step-tag">10 / 10 Policy Pass</div>
    </div>

    <div class="step-card">
      <div class="step-num">STEP 02</div>
      <div class="step-title">Owner Signs in Own Wallet</div>
      <div class="step-desc">The human business owner reviews the settlement checklist and signs the ERC-20 transfer directly from MetaMask or browser wallet.</div>
      <div class="step-tag">Self-Custodial Signature</div>
    </div>

    <div class="step-card">
      <div class="step-num">STEP 03</div>
      <div class="step-title">Server Validates Blockchain Receipt</div>
      <div class="step-desc">Server queries Arc RPC to verify transfer receipt: exact recipient wallet, official USDC contract, and exact atomic amount.</div>
      <div class="step-tag">On-Chain EVM Verification</div>
    </div>

    <div class="step-card">
      <div class="step-num">STEP 04</div>
      <div class="step-title">Settled & Written to Audit Ledger</div>
      <div class="step-desc">Only verified on-chain payments are recorded as settled, linking a SHA-256 event block into the immutable cryptographic audit chain.</div>
      <div class="step-tag">Append-Only Audit Log</div>
    </div>
  </div>

  <div class="footer-note">
    <span>Zero private keys held on server</span>
    <span>Arc Testnet & Mainnet</span>
    <span>Irreversible On-Chain Settlement</span>
  </div>
</body>
</html>
`;

const HTML_END_CARD = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1920px;
    height: 1080px;
    background: radial-gradient(circle at 50% 45%, #16406B 0%, #0B1F33 80%);
    color: #FFFFFF;
    font-family: 'Inter', sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 60px;
    position: relative;
  }
  .logo-box {
    width: 110px;
    height: 110px;
    margin-bottom: 24px;
    filter: drop-shadow(0 12px 28px rgba(14, 159, 142, 0.4));
  }
  h2 {
    font-size: 64px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 16px;
  }
  h2 span {
    color: #19C3AE;
  }
  .url-box {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 14px 32px;
    border-radius: 14px;
    background: rgba(14, 159, 142, 0.15);
    border: 2px solid #0E9F8E;
    color: #FFFFFF;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 26px;
    font-weight: 600;
    margin-bottom: 24px;
    box-shadow: 0 0 24px rgba(14, 159, 142, 0.3);
  }
  .repo-url {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 18px;
    color: #94A3B8;
    margin-bottom: 36px;
  }
  .pillars {
    display: flex;
    gap: 24px;
    margin-bottom: 50px;
  }
  .pill {
    padding: 10px 24px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    font-size: 16px;
    font-weight: 600;
    color: #E2E8F0;
  }
  .disclaimer {
    max-width: 900px;
    font-size: 14px;
    line-height: 1.6;
    color: #64748B;
  }
</style>
</head>
<body>
  <div class="logo-box">${logoSvg}</div>
  <h2>BizFlow Pilot <span>V2</span></h2>
  <div class="url-box">bizflow-pilot-v2.vercel.app</div>
  <div class="repo-url">github.com/Solking-crpto/bizflow-pilot-v2</div>
  <div class="pillars">
    <div class="pill">Open Source</div>
    <div class="pill">Non-Custodial</div>
    <div class="pill">Arc Testnet & Mainnet</div>
  </div>
  <div class="disclaimer">
    Early beta. Single payments strictly capped at 25.00 USDC during beta.<br>
    Use a fresh wallet with no real funds on testnet. Some wallets may flag new domains.
  </div>
</body>
</html>
`;

function buildLowerThirdHtml(mono, title) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@600&family=Inter:wght@700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1920px;
    height: 1080px;
    background: transparent;
    font-family: 'Inter', sans-serif;
    position: relative;
    overflow: hidden;
  }
  .lower-third {
    position: absolute;
    bottom: 96px;
    left: 96px;
    display: flex;
    flex-direction: column;
    padding: 18px 28px;
    background: rgba(11, 31, 51, 0.92);
    border-left: 5px solid #0E9F8E;
    border-radius: 0 12px 12px 0;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  .mono {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.12em;
    color: #19C3AE;
    margin-bottom: 6px;
  }
  .title {
    font-size: 26px;
    font-weight: 700;
    color: #FFFFFF;
    letter-spacing: -0.01em;
  }
</style>
</head>
<body>
  <div class="lower-third">
    <div class="mono">${mono}</div>
    <div class="title">${title}</div>
  </div>
</body>
</html>
  `;
}

async function renderPlates() {
  console.log('Launching Playwright Chromium to render graphics plates...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\DELL\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe'
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // 1. Title Card
  console.log('Rendering title_card.png...');
  await page.setContent(HTML_TITLE_CARD);
  await page.screenshot({ path: path.join(outDir, 'title_card.png') });

  // 2. Scene 5 Illustration
  console.log('Rendering scene_5_illustration.png...');
  await page.setContent(HTML_SCENE5_ILLUSTRATION);
  await page.screenshot({ path: path.join(outDir, 'scene_5_illustration.png') });

  // 3. End Card
  console.log('Rendering end_card.png...');
  await page.setContent(HTML_END_CARD);
  await page.screenshot({ path: path.join(outDir, 'end_card.png') });

  // 4. Lower Thirds
  const lowerThirds = [
    { id: 1, mono: '01 / NETWORK SWITCH', title: 'Arc Testnet & Mainnet in One App' },
    { id: 2, mono: '02 / WALLET SIGN-IN', title: 'Self-Custody Onboarding & Policy Limits' },
    { id: 3, mono: '03 / INVOICE CHECKS', title: '3-Way Matching & Untrusted Text Defenses' },
    { id: 4, mono: '04 / AGENT DECISIONS', title: 'Advisory Copilot & Deterministic Heuristics' },
    { id: 5, mono: '05 / PAYMENT CHECKS', title: 'Non-Custodial Settlement & Receipt Verification' },
    { id: 6, mono: '06 / PUBLIC PROOF', title: 'Cryptographic SHA-256 Hash Chain' },
    { id: 7, mono: '07 / TRY IT', title: 'Open Source · Arc Testnet & Mainnet' },
  ];

  for (const lt of lowerThirds) {
    console.log(`Rendering lower_third_scene_${lt.id}.png...`);
    await page.setContent(buildLowerThirdHtml(lt.mono, lt.title));
    await page.screenshot({
      path: path.join(outDir, `lower_third_scene_${lt.id}.png`),
      omitBackground: true,
    });
  }

  await browser.close();
  console.log('All graphics plates rendered successfully!');
}

renderPlates().catch(err => {
  console.error('Plate rendering failed:', err);
  process.exit(1);
});
