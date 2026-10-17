import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Load .env.video.local
const envPath = path.resolve('.env.video.local');
if (!fs.existsSync(envPath)) {
  console.error('ERROR: .env.video.local is missing! Please create it with ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID.');
  process.exit(1);
}

const envConfig = dotenv.parse(fs.readFileSync(envPath));
const apiKey = envConfig.ELEVENLABS_API_KEY;
const voiceId = envConfig.ELEVENLABS_VOICE_ID || 'uH7gCqB801c6y7oEmaew';
const modelId = envConfig.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

if (!apiKey || apiKey.trim().length === 0) {
  console.error('ERROR: ELEVENLABS_API_KEY is missing or empty in .env.video.local! STOPPING.');
  process.exit(1);
}

const SCENES = [
  {
    id: 0,
    name: 'title_card',
    spokenText: 'Paying suppliers is risky: duplicate invoices, wrong wallets, and now A I agents that can be tricked by hidden text. BizFlow Pilot checks first, so the owner pays with confidence.',
    captionText: 'Paying suppliers is risky: duplicate invoices, wrong wallets, and now AI agents that can be tricked by hidden text. BizFlow Pilot checks first, so the owner pays with confidence.',
    lowerThird: { mono: '00 / OVERVIEW', title: 'Why BizFlow Pilot' },
  },
  {
    id: 1,
    name: 'network_switch',
    spokenText: 'This is BizFlow Pilot V2, built on Arc. One app, one switch. Testnet is free practice with test U S D C. Mainnet is real money. Anyone can try it free before risking anything.',
    captionText: 'This is BizFlow Pilot V2, built on Arc. One app, one switch. Testnet is free practice with test USDC. Mainnet is real money. Anyone can try it free before risking anything.',
    lowerThird: { mono: '01 / NETWORK SWITCH', title: 'Arc Testnet & Mainnet in One App' },
  },
  {
    id: 2,
    name: 'wallet_and_onboarding',
    spokenText: 'A business signs in with its own wallet. The signature is free and moves no money. BizFlow never holds funds or keys. Then the owner sets personal limits and adds a supplier.',
    captionText: 'A business signs in with its own wallet. The signature is free and moves no money. BizFlow never holds funds or keys. Then the owner sets personal limits and adds a supplier.',
    lowerThird: { mono: '02 / WALLET SIGN-IN', title: 'Self-Custody Onboarding & Policy Limits' },
  },
  {
    id: 3,
    name: 'order_and_invoices',
    spokenText: 'Next, the order and the delivery. When an invoice arrives, BizFlow matches all three. BizFlow treats invoice text as untrusted, flags it, and it never reaches payment.',
    captionText: 'Next, the order and the delivery. When an invoice arrives, BizFlow matches all three. BizFlow treats invoice text as untrusted, flags it, and it never reaches payment.',
    lowerThird: { mono: '03 / INVOICE CHECKS', title: '3-Way Matching & Untrusted Text Defenses' },
  },
  {
    id: 4,
    name: 'agent_decisions',
    spokenText: 'The agent ranks what to pay and when, and explains why. It can only recommend. Every decision is logged with its reasoning, and whether a model or the fallback rules made it.',
    captionText: 'The agent ranks what to pay and when, and explains why. It can only recommend. Every decision is logged with its reasoning, and whether a model or the fallback rules made it.',
    lowerThird: { mono: '04 / AGENT DECISIONS', title: 'Advisory Copilot & Deterministic Heuristics' },
  },
  {
    id: 5,
    name: 'payment_checks',
    spokenText: 'To pay, fixed rules must approve. Then the owner signs in their own wallet. Only after the server checks the blockchain receipt, the right token, the right recipient and the exact amount, is a payment marked settled.',
    captionText: 'To pay, fixed rules must approve. Then the owner signs in their own wallet. Only after the server checks the blockchain receipt, the right token, the right recipient and the exact amount, is a payment marked settled.',
    lowerThird: { mono: '05 / PAYMENT CHECKS', title: 'Non-Custodial Settlement & Receipt Verification' },
  },
  {
    id: 6,
    name: 'audit_ledger',
    spokenText: 'Every step goes into a tamper-evident ledger, and the owner can verify the chain at any time.',
    captionText: 'Every step goes into a tamper-evident ledger, and the owner can verify the chain at any time.',
    lowerThird: { mono: '06 / PUBLIC PROOF', title: 'Cryptographic SHA-256 Hash Chain' },
  },
  {
    id: 7,
    name: 'mainnet_and_summary',
    spokenText: 'This is an early beta, capped at 25 U S D C per payment, built solo, and looking for its first pilot businesses. Try it free on testnet at bizflow-pilot-v2 dot vercel dot app.',
    captionText: 'This is an early beta, capped at 25 USDC per payment, built solo, and looking for its first pilot businesses. Try it free on testnet at bizflow-pilot-v2.vercel.app.',
    lowerThird: { mono: '07 / TRY IT', title: 'Open Source · Arc Testnet & Mainnet' },
  },
];

const cacheAudioDir = path.resolve('video/cache/audio');
const processedAudioDir = path.resolve('video/audio');
if (!fs.existsSync(cacheAudioDir)) fs.mkdirSync(cacheAudioDir, { recursive: true });
if (!fs.existsSync(processedAudioDir)) fs.mkdirSync(processedAudioDir, { recursive: true });

const voiceSettings = {
  stability: 0.5,
  similarity_boost: 0.8,
  style: 0.15,
  use_speaker_boost: true,
  speed: 1.0,
};

async function callElevenLabsWithRetry(endpoint, body, maxRetries = 4) {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401) {
      console.error('ERROR 401: Invalid ElevenLabs API Key. Please verify .env.video.local.');
      process.exit(1);
    }

    if (res.status === 429 || res.status >= 500) {
      const waitMs = Math.pow(2, attempt) * 1000;
      console.warn(`ElevenLabs API returned HTTP ${res.status}. Retrying in ${waitMs}ms (attempt ${attempt}/${maxRetries})...`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ElevenLabs API error (${res.status}): ${errText}`);
    }

    return res;
  }
  throw new Error(`Failed after ${maxRetries} attempts.`);
}

async function generateNarration() {
  console.log(`Starting narration generation with voice ${voiceId} and model ${modelId}...`);
  let totalCharsUsed = 0;
  const audioResults = [];

  for (let i = 0; i < SCENES.length; i++) {
    const scene = SCENES[i];
    const prevText = i > 0 ? SCENES[i - 1].spokenText : undefined;
    const nextText = i < SCENES.length - 1 ? SCENES[i + 1].spokenText : undefined;

    const hashInput = `${scene.spokenText}|${voiceId}|${modelId}|${JSON.stringify(voiceSettings)}`;
    const hash = crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 16);

    const rawCachePath = path.join(cacheAudioDir, `scene_${scene.id}_${hash}.mp3`);
    const metaCachePath = path.join(cacheAudioDir, `scene_${scene.id}_${hash}.json`);
    const finalProcessedPath = path.join(processedAudioDir, `scene_${scene.id}.wav`);

    let timingData = null;

    if (fs.existsSync(rawCachePath) && fs.existsSync(metaCachePath)) {
      console.log(`Scene ${scene.id} [${scene.name}]: Using CACHED audio (${hash})`);
      timingData = JSON.parse(fs.readFileSync(metaCachePath, 'utf8'));
    } else {
      console.log(`Scene ${scene.id} [${scene.name}]: Generating TTS (${scene.spokenText.length} chars)...`);
      totalCharsUsed += scene.spokenText.length;

      const body = {
        text: scene.spokenText,
        model_id: modelId,
        voice_settings: voiceSettings,
        previous_text: prevText,
        next_text: nextText,
      };

      try {
        // Try with-timestamps first
        const tsEndpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;
        const res = await callElevenLabsWithRetry(tsEndpoint, body);
        const json = await res.json();

        if (json.audio_base64) {
          const audioBuffer = Buffer.from(json.audio_base64, 'base64');
          fs.writeFileSync(rawCachePath, audioBuffer);
          timingData = {
            alignment: json.alignment,
            normalized_alignment: json.normalized_alignment,
            hasTimestamps: true,
          };
          fs.writeFileSync(metaCachePath, JSON.stringify(timingData, null, 2));
        } else {
          throw new Error('No audio_base64 in response');
        }
      } catch (err) {
        console.warn(`with-timestamps failed (${err.message}). Falling back to standard TTS endpoint...`);
        const stdEndpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
        const res = await callElevenLabsWithRetry(stdEndpoint, body);
        const arrayBuf = await res.arrayBuffer();
        fs.writeFileSync(rawCachePath, Buffer.from(arrayBuf));
        timingData = { hasTimestamps: false };
        fs.writeFileSync(metaCachePath, JSON.stringify(timingData, null, 2));
      }
    }

    // Post-process with ffmpeg:
    // 1. Trim leading/trailing silence
    // 2. Add 150ms head padding and 350ms tail padding
    // 3. EBU R128 loudness normalization to -16 LUFS, true peak -1.5 dB
    console.log(`Processing audio for Scene ${scene.id}...`);
    const filterComplex = [
      'silenceremove=start_periods=1:start_duration=0.03:start_threshold=-50dB:detection=peak',
      'areverse',
      'silenceremove=start_periods=1:start_duration=0.03:start_threshold=-50dB:detection=peak',
      'areverse',
      'adelay=150|150',
      'apad=pad_len=16800',
      'loudnorm=I=-16:TP=-1.5:LRA=11',
    ].join(',');

    const procCmd = `ffmpeg -y -i "${rawCachePath}" -af "${filterComplex}" -ar 48000 -ac 2 "${finalProcessedPath}"`;
    execSync(procCmd, { stdio: 'ignore' });

    // Measure final duration & loudness
    const probeCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${finalProcessedPath}"`;
    const duration = parseFloat(execSync(probeCmd, { encoding: 'utf8' }).trim());

    const loudCmd = `ffmpeg -i "${finalProcessedPath}" -af "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json" -f null -`;
    let loudReport = '';
    try {
      execSync(loudCmd, { stdio: 'pipe' });
    } catch (e) {
      const match = e.stderr && e.stderr.toString().match(/\{[\s\S]*"input_i"[\s\S]*\}/);
      if (match) loudReport = match[0];
    }

    audioResults.push({
      sceneId: scene.id,
      name: scene.name,
      spokenText: scene.spokenText,
      captionText: scene.captionText,
      lowerThird: scene.lowerThird,
      audioPath: finalProcessedPath,
      duration,
      loudness: loudReport ? JSON.parse(loudReport) : null,
      timingData,
    });

    console.log(`Scene ${scene.id} done: duration = ${duration.toFixed(2)}s`);
  }

  const totalDuration = audioResults.reduce((acc, a) => acc + a.duration, 0);
  console.log('=== AUDIO GENERATION SUMMARY ===');
  console.log(`Total scenes: ${audioResults.length}`);
  console.log(`Total narration duration: ${totalDuration.toFixed(2)}s (max allowed video: 175s)`);
  console.log(`Total new ElevenLabs characters consumed: ${totalCharsUsed}`);

  fs.writeFileSync('video/cache/audio-manifest.json', JSON.stringify({
    totalDuration,
    totalCharsUsed,
    audioResults,
  }, null, 2));

  return audioResults;
}

generateNarration().catch((err) => {
  console.error('Fatal error in narration generator:', err.message);
  process.exit(1);
});
