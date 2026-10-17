import fs from 'fs';
import path from 'path';

// Define the exact timed cues with max 42 chars per line and max 2 lines per cue
const cues = [
  // Scene 0 (0.000s - 12.100s)
  {
    start: 0.400,
    end: 4.200,
    lines: [
      "Paying suppliers is risky:",
      "duplicate invoices, wrong wallets,"
    ]
  },
  {
    start: 4.200,
    end: 7.600,
    lines: [
      "and now AI agents that can be tricked",
      "by hidden text."
    ]
  },
  {
    start: 7.600,
    end: 11.500,
    lines: [
      "BizFlow Pilot checks first,",
      "so the owner pays with confidence."
    ]
  },

  // Scene 1 (12.100s - 23.467s)
  {
    start: 12.500,
    end: 15.800,
    lines: [
      "This is BizFlow Pilot V2, built on Arc.",
      "One app, one switch."
    ]
  },
  {
    start: 15.800,
    end: 19.500,
    lines: [
      "Testnet is free practice with test USDC.",
      "Mainnet is real money."
    ]
  },
  {
    start: 19.500,
    end: 23.000,
    lines: [
      "Anyone can try it free",
      "before risking anything."
    ]
  },

  // Scene 2 (23.467s - 33.834s)
  {
    start: 23.900,
    end: 27.200,
    lines: [
      "A business signs in with its own wallet.",
      "The signature is free and moves no money."
    ]
  },
  {
    start: 27.200,
    end: 29.800,
    lines: [
      "BizFlow never holds funds or keys."
    ]
  },
  {
    start: 29.800,
    end: 33.400,
    lines: [
      "Then the owner sets personal limits",
      "and adds a supplier."
    ]
  },

  // Scene 3 (33.834s - 45.001s)
  {
    start: 34.300,
    end: 36.800,
    lines: [
      "Next, the order and the delivery."
    ]
  },
  {
    start: 36.800,
    end: 40.200,
    lines: [
      "When an invoice arrives,",
      "BizFlow matches all three."
    ]
  },
  {
    start: 40.200,
    end: 44.500,
    lines: [
      "BizFlow treats invoice text as untrusted,",
      "flags it, and it never reaches payment."
    ]
  },

  // Scene 4 (45.001s - 55.768s)
  {
    start: 45.400,
    end: 49.500,
    lines: [
      "The agent ranks what to pay and when,",
      "and explains why. It can only recommend."
    ]
  },
  {
    start: 49.500,
    end: 52.400,
    lines: [
      "Every decision is logged",
      "with its reasoning,"
    ]
  },
  {
    start: 52.400,
    end: 55.300,
    lines: [
      "and whether a model",
      "or the fallback rules made it."
    ]
  },

  // Scene 5 (55.768s - 69.001s)
  {
    start: 56.200,
    end: 60.500,
    lines: [
      "To pay, fixed rules must approve.",
      "Then the owner signs in their own wallet."
    ]
  },
  {
    start: 60.500,
    end: 64.500,
    lines: [
      "Only after the server checks",
      "the blockchain receipt, the right token,"
    ]
  },
  {
    start: 64.500,
    end: 68.600,
    lines: [
      "the right recipient and the exact amount,",
      "is a payment marked settled."
    ]
  },

  // Scene 6 (69.001s - 74.801s)
  {
    start: 69.400,
    end: 72.000,
    lines: [
      "Every step goes into",
      "a tamper-evident ledger,"
    ]
  },
  {
    start: 72.000,
    end: 74.500,
    lines: [
      "and the owner can verify",
      "the chain at any time."
    ]
  },

  // Scene 7 (74.801s - 86.601s)
  {
    start: 75.200,
    end: 79.000,
    lines: [
      "This is an early beta, capped at 25 USDC",
      "per payment, built solo,"
    ]
  },
  {
    start: 79.000,
    end: 82.200,
    lines: [
      "and looking for its",
      "first pilot businesses."
    ]
  },
  {
    start: 82.200,
    end: 86.100,
    lines: [
      "Try it free on testnet at",
      "bizflow-pilot-v2.vercel.app."
    ]
  }
];

// Validate all lines satisfy constraints
let valid = true;
cues.forEach((c, idx) => {
  if (c.lines.length > 2) {
    console.error(`Cue ${idx + 1} has ${c.lines.length} lines (>2)!`);
    valid = false;
  }
  c.lines.forEach((line, lIdx) => {
    if (line.length > 42) {
      console.error(`Cue ${idx + 1} line ${lIdx + 1} has ${line.length} chars (>42): "${line}"`);
      valid = false;
    }
  });
});

if (!valid) {
  process.exit(1);
}
console.log(`All ${cues.length} cues passed line length (<=42) and line count (<=2) checks!`);

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

// Generate SRT
const srtEntries = cues.map((c, i) => {
  return `${i + 1}\n${formatSrtTime(c.start)} --> ${formatSrtTime(c.end)}\n${c.lines.join('\n')}\n`;
});
fs.writeFileSync('video-out/captions.srt', srtEntries.join('\n'));
console.log('Saved video-out/captions.srt');

// Generate ASS
const assHeader = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Segoe UI,30,&H00FFFFFF,&H000000FF,&H40000000,&H80000000,-1,0,0,0,100,100,0,0,1,2.0,1.5,2,80,80,150,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

const assEvents = cues.map(c => {
  return `Dialogue: 0,${formatAssTime(c.start)},${formatAssTime(c.end)},Default,,0,0,0,,${c.lines.join('\\N')}`;
});

fs.writeFileSync('video/cache/captions.ass', assHeader + assEvents.join('\n') + '\n');
console.log('Saved video/cache/captions.ass');
