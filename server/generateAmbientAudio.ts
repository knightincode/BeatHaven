import { Client } from "@replit/object-storage";

const client = new Client();

function createWavBuffer(sampleRate: number, durationSec: number, generator: (i: number, sampleRate: number) => number): Buffer {
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

  for (let i = 0; i < numSamples; i++) {
    let sample = generator(i, sampleRate);
    sample = Math.max(-1, Math.min(1, sample));
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  const fadeLen = Math.floor(sampleRate * 0.5);
  for (let i = 0; i < fadeLen; i++) {
    const fadeIn = i / fadeLen;
    const pos = 44 + i * 2;
    const existing = buffer.readInt16LE(pos);
    buffer.writeInt16LE(Math.floor(existing * fadeIn), pos);
  }
  for (let i = 0; i < fadeLen; i++) {
    const fadeOut = 1 - (i / fadeLen);
    const sampleIndex = numSamples - fadeLen + i;
    const pos = 44 + sampleIndex * 2;
    const existing = buffer.readInt16LE(pos);
    buffer.writeInt16LE(Math.floor(existing * fadeOut), pos);
  }

  return buffer;
}

function lowPassFilter(data: number[], alpha: number): number[] {
  const filtered = new Array(data.length);
  filtered[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    filtered[i] = alpha * data[i] + (1 - alpha) * filtered[i - 1];
  }
  return filtered;
}

const generators: Record<string, (i: number, sr: number) => number> = {
  rain: (() => {
    const buffer: number[] = [];
    let prev = 0;
    return (i: number, sr: number) => {
      if (buffer.length === 0) {
        const len = sr * 30;
        for (let j = 0; j < len; j++) {
          let s = (Math.random() * 2 - 1) * 0.25;
          if (Math.random() < 0.003) s += (Math.random() - 0.5) * 0.6;
          prev = prev * 0.7 + s * 0.3;
          buffer.push(prev);
        }
        const alpha = 0.15;
        let f = buffer[0];
        for (let j = 1; j < buffer.length; j++) {
          f = alpha * buffer[j] + (1 - alpha) * f;
          buffer[j] = f;
        }
      }
      return buffer[i % buffer.length];
    };
  })(),

  ocean: (() => {
    const buffer: number[] = [];
    return (i: number, sr: number) => {
      if (buffer.length === 0) {
        const len = sr * 30;
        for (let j = 0; j < len; j++) {
          const t = j / sr;
          const wave1 = Math.sin(t * 0.08 * Math.PI * 2) * 0.5 + 0.5;
          const wave2 = Math.sin(t * 0.12 * Math.PI * 2 + 1.3) * 0.3 + 0.5;
          const wave3 = Math.sin(t * 0.05 * Math.PI * 2 + 2.7) * 0.2 + 0.5;
          const envelope = wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2;
          const noise = (Math.random() * 2 - 1) * 0.35;
          buffer.push(noise * envelope);
        }
        const filtered = lowPassFilter(buffer, 0.08);
        for (let j = 0; j < buffer.length; j++) {
          buffer[j] = filtered[j];
        }
      }
      return buffer[i % buffer.length];
    };
  })(),

  forest: (() => {
    const buffer: number[] = [];
    return (i: number, sr: number) => {
      if (buffer.length === 0) {
        const len = sr * 30;
        for (let j = 0; j < len; j++) {
          let s = (Math.random() * 2 - 1) * 0.08;
          if (Math.random() < 0.0008) {
            const chirpLen = Math.min(Math.floor(sr * 0.15), len - j);
            for (let k = 0; k < chirpLen; k++) {
              const env = Math.sin((k / chirpLen) * Math.PI);
              const freq = 2000 + Math.random() * 3000;
              const chirp = Math.sin(k / sr * freq * Math.PI * 2) * env * 0.15;
              if (j + k < len) buffer[j + k] = (buffer[j + k] || 0) + chirp;
            }
          }
          buffer[j] = (buffer[j] || 0) + s;
        }
        const filtered = lowPassFilter(buffer, 0.2);
        for (let j = 0; j < buffer.length; j++) {
          buffer[j] = filtered[j];
        }
      }
      return buffer[i % buffer.length];
    };
  })(),

  fire: (() => {
    const buffer: number[] = [];
    return (i: number, sr: number) => {
      if (buffer.length === 0) {
        const len = sr * 30;
        let prev = 0;
        for (let j = 0; j < len; j++) {
          const crackle = Math.random() < 0.001 ? (Math.random() - 0.5) * 0.8 : 0;
          let s = (Math.random() * 2 - 1) * 0.15 * (0.7 + Math.random() * 0.6);
          s += crackle;
          prev = prev * 0.85 + s * 0.15;
          buffer.push(prev);
        }
        const filtered = lowPassFilter(buffer, 0.1);
        for (let j = 0; j < buffer.length; j++) {
          buffer[j] = filtered[j];
        }
      }
      return buffer[i % buffer.length];
    };
  })(),

  night: (() => {
    const buffer: number[] = [];
    return (i: number, sr: number) => {
      if (buffer.length === 0) {
        const len = sr * 30;
        for (let j = 0; j < len; j++) {
          buffer.push((Math.random() * 2 - 1) * 0.03);
        }
        for (let c = 0; c < 15; c++) {
          const startSample = Math.floor(Math.random() * (len - sr));
          const chirpDur = Math.floor(sr * (0.05 + Math.random() * 0.1));
          const freq = 3000 + Math.random() * 4000;
          for (let k = 0; k < chirpDur; k++) {
            const env = Math.sin((k / chirpDur) * Math.PI);
            buffer[startSample + k] += Math.sin(k / sr * freq * Math.PI * 2) * env * 0.2;
          }
          if (Math.random() > 0.5) {
            const gap = Math.floor(sr * 0.08);
            const chirpDur2 = Math.floor(sr * (0.04 + Math.random() * 0.08));
            const freq2 = freq * (0.9 + Math.random() * 0.2);
            for (let k = 0; k < chirpDur2; k++) {
              if (startSample + gap + k < len) {
                const env = Math.sin((k / chirpDur2) * Math.PI);
                buffer[startSample + gap + k] += Math.sin(k / sr * freq2 * Math.PI * 2) * env * 0.15;
              }
            }
          }
        }
      }
      return buffer[i % buffer.length];
    };
  })(),

  wind: (() => {
    const buffer: number[] = [];
    return (i: number, sr: number) => {
      if (buffer.length === 0) {
        const len = sr * 30;
        let prev = 0;
        for (let j = 0; j < len; j++) {
          const t = j / sr;
          const gust = Math.sin(t * 0.2 * Math.PI * 2) * 0.3 + Math.sin(t * 0.07 * Math.PI * 2 + 1) * 0.2 + 0.5;
          let s = (Math.random() * 2 - 1) * 0.2 * gust;
          prev = prev * 0.92 + s * 0.08;
          buffer.push(prev);
        }
        const filtered = lowPassFilter(buffer, 0.05);
        for (let j = 0; j < buffer.length; j++) {
          buffer[j] = filtered[j];
        }
      }
      return buffer[i % buffer.length];
    };
  })(),
};

async function generateAndUpload() {
  const sampleRate = 22050;
  const durationSec = 30;
  const layers = ["rain", "ocean", "forest", "fire", "night", "wind"];

  for (const layerId of layers) {
    console.log(`Generating ${layerId}...`);
    const gen = generators[layerId];
    const wavBuffer = createWavBuffer(sampleRate, durationSec, gen);
    
    const objectName = `ambient/${layerId}.wav`;
    console.log(`Uploading ${objectName} (${(wavBuffer.length / 1024).toFixed(0)} KB)...`);
    await client.uploadFromBytes(objectName, wavBuffer);
    console.log(`Uploaded ${objectName}`);
  }

  console.log("\nAll ambient audio files generated and uploaded!");
  console.log("Object paths:");
  for (const layerId of layers) {
    console.log(`  ambient/${layerId}.wav`);
  }
}

generateAndUpload().catch(console.error);
