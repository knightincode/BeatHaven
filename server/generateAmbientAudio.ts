import { Client } from "@replit/object-storage";

const client = new Client();

function createWavBuffer(
  sampleRate: number,
  durationSec: number,
  generator: (samples: Float32Array, sampleRate: number) => void
): Buffer {
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * 2;
  const fileSize = 44 + dataSize;
  const buffer = Buffer.alloc(fileSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  const samples = new Float32Array(numSamples);
  generator(samples, sampleRate);

  let peak = 0;
  for (let i = 0; i < numSamples; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  const norm = peak > 0 ? 0.85 / peak : 1;

  for (let i = 0; i < numSamples; i++) {
    let s = samples[i] * norm;
    s = Math.max(-1, Math.min(1, s));
    buffer.writeInt16LE(Math.floor(s * 32767), 44 + i * 2);
  }

  const fadeLen = Math.floor(sampleRate * 0.5);
  for (let i = 0; i < fadeLen; i++) {
    const fadeIn = i / fadeLen;
    const pos = 44 + i * 2;
    const existing = buffer.readInt16LE(pos);
    buffer.writeInt16LE(Math.floor(existing * fadeIn), pos);
  }
  for (let i = 0; i < fadeLen; i++) {
    const fadeOut = 1 - i / fadeLen;
    const sampleIndex = numSamples - fadeLen + i;
    const pos = 44 + sampleIndex * 2;
    const existing = buffer.readInt16LE(pos);
    buffer.writeInt16LE(Math.floor(existing * fadeOut), pos);
  }

  return buffer;
}

const generators: Record<string, (samples: Float32Array, sr: number) => void> = {
  white: (samples, sr) => {
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.random() * 2 - 1;
    }
  },

  pink: (samples, sr) => {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      samples[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
    }
  },

  brown: (samples, sr) => {
    let prev = 0;
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1;
      prev = (prev + 0.02 * white) / 1.02;
      samples[i] = prev * 3.5;
    }
  },

  blue: (samples, sr) => {
    let prev = 0;
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1;
      samples[i] = white - prev;
      prev = white;
    }
  },

  violet: (samples, sr) => {
    let prev1 = 0;
    let prev2 = 0;
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1;
      samples[i] = white - 2 * prev1 + prev2;
      prev2 = prev1;
      prev1 = white;
    }
  },

  grey: (samples, sr) => {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;

      const freq = (i % sr) / sr;
      const isoWeight = 1.0 + 0.4 * Math.sin(freq * Math.PI * 2 * 3.5);
      samples[i] = pink * isoWeight;
    }
  },

  green: (samples, sr) => {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      samples[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
    }

    const lowCut = 250;
    const highCut = 2000;
    const rc1 = 1 / (2 * Math.PI * lowCut);
    const dt = 1 / sr;
    const alpha1 = dt / (rc1 + dt);
    const rc2 = 1 / (2 * Math.PI * highCut);
    const alpha2 = dt / (rc2 + dt);

    let hpPrev = 0;
    let hpPrevRaw = 0;
    for (let i = 0; i < samples.length; i++) {
      const hp = (1 - alpha1) * (hpPrev + samples[i] - hpPrevRaw);
      hpPrevRaw = samples[i];
      hpPrev = hp;
      samples[i] = hp;
    }

    let lpPrev = 0;
    for (let i = 0; i < samples.length; i++) {
      lpPrev = lpPrev + alpha2 * (samples[i] - lpPrev);
      samples[i] = lpPrev;
    }
  },

  orange: (samples, sr) => {
    const numOsc = 12;
    const freqs: number[] = [];
    const baseFreqs = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00];
    for (let k = 0; k < numOsc; k++) {
      const base = baseFreqs[k % baseFreqs.length];
      freqs.push(base * (1 + (Math.random() * 0.08 - 0.04)));
    }

    for (let i = 0; i < samples.length; i++) {
      let sum = 0;
      const t = i / sr;
      for (let k = 0; k < numOsc; k++) {
        sum += Math.sin(2 * Math.PI * freqs[k] * t) * 0.1;
      }
      sum += (Math.random() * 2 - 1) * 0.15;
      samples[i] = sum;
    }
  },

  red: (samples, sr) => {
    let prev = 0;
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1;
      prev = (prev + 0.01 * white) / 1.01;
      samples[i] = prev * 5;
    }

    const cutoff = 200;
    const rc = 1 / (2 * Math.PI * cutoff);
    const dtVal = 1 / sr;
    const alphaLP = dtVal / (rc + dtVal);
    let lpPrev = 0;
    for (let i = 0; i < samples.length; i++) {
      lpPrev = lpPrev + alphaLP * (samples[i] - lpPrev);
      samples[i] = lpPrev;
    }
  },

  black: (samples, sr) => {
    for (let i = 0; i < samples.length; i++) {
      const r1 = Math.random();
      const r2 = Math.random();
      const gaussian = Math.sqrt(-2 * Math.log(r1 + 1e-10)) * Math.cos(2 * Math.PI * r2);
      samples[i] = gaussian * 0.003;
    }
  },

  speech: (samples, sr) => {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      samples[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
    }

    const lowCut = 200;
    const highCut = 5000;
    const dt = 1 / sr;
    const rc1 = 1 / (2 * Math.PI * lowCut);
    const alpha1 = dt / (rc1 + dt);
    const rc2 = 1 / (2 * Math.PI * highCut);
    const alpha2 = dt / (rc2 + dt);

    let hpPrev = 0;
    let hpPrevRaw = 0;
    for (let i = 0; i < samples.length; i++) {
      const hp = (1 - alpha1) * (hpPrev + samples[i] - hpPrevRaw);
      hpPrevRaw = samples[i];
      hpPrev = hp;
      samples[i] = hp;
    }

    let lpPrev = 0;
    for (let i = 0; i < samples.length; i++) {
      lpPrev = lpPrev + alpha2 * (samples[i] - lpPrev);
      samples[i] = lpPrev;
    }
  },

  modulated: (samples, sr) => {
    let prev = 0;
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1;
      prev = (prev + 0.02 * white) / 1.02;
      const t = i / sr;
      const mod = (Math.sin(2 * Math.PI * 0.1 * t) * 0.4 + 0.6);
      samples[i] = prev * 3.5 * mod;
    }
  },

  dither: (samples, sr) => {
    for (let i = 0; i < samples.length; i++) {
      const r1 = Math.random();
      const r2 = Math.random();
      samples[i] = (r1 + r2 - 1) * 0.05;
    }
  },
};

async function generateAndUpload() {
  const sampleRate = 44100;
  const durationSec = 30;
  const noiseTypes = [
    "white", "pink", "brown", "blue", "violet", "grey",
    "green", "orange", "red", "black", "speech", "modulated", "dither",
  ];

  for (const noiseId of noiseTypes) {
    console.log(`Generating ${noiseId} noise...`);
    const gen = generators[noiseId];
    const wavBuffer = createWavBuffer(sampleRate, durationSec, gen);

    const objectName = `ambient/${noiseId}.wav`;
    console.log(`Uploading ${objectName} (${(wavBuffer.length / 1024 / 1024).toFixed(2)} MB)...`);
    await client.uploadFromBytes(objectName, wavBuffer);
    console.log(`Uploaded ${objectName}`);
  }

  console.log("\nAll noise color files generated and uploaded!");
}

generateAndUpload().catch(console.error);
