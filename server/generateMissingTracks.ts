import { Client } from "@replit/object-storage";
import { preCacheFileSize } from "./objectStorage";

const client = new Client();

const SAMPLE_RATE = 22050;
const DURATION_SEC = 1800;
const FADE_SEC = 2.0;
const MIN_VALID_SIZE = 10 * 1024 * 1024;

function createBinauralWav(baseHz: number, beatHz: number): Buffer {
  const numSamples = SAMPLE_RATE * DURATION_SEC;
  const numChannels = 2;
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = SAMPLE_RATE * blockAlign;
  const dataSize = numSamples * blockAlign;
  const fileSize = 44 + dataSize;

  const buffer = Buffer.alloc(fileSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  const fadeLen = Math.floor(SAMPLE_RATE * FADE_SEC);
  const rightHz = baseHz + beatHz;

  const leftPhaseInc = (2 * Math.PI * baseHz) / SAMPLE_RATE;
  const rightPhaseInc = (2 * Math.PI * rightHz) / SAMPLE_RATE;
  let leftPhase = 0;
  let rightPhase = 0;

  for (let i = 0; i < numSamples; i++) {
    let left = Math.sin(leftPhase);
    let right = Math.sin(rightPhase);

    let envelope = 1.0;
    if (i < fadeLen) {
      envelope = i / fadeLen;
    } else if (i >= numSamples - fadeLen) {
      envelope = (numSamples - i) / fadeLen;
    }

    left *= envelope * 0.8;
    right *= envelope * 0.8;

    const leftSample = Math.round(Math.max(-1, Math.min(1, left)) * 32767);
    const rightSample = Math.round(Math.max(-1, Math.min(1, right)) * 32767);

    const offset = 44 + i * blockAlign;
    buffer.writeInt16LE(leftSample, offset);
    buffer.writeInt16LE(rightSample, offset + 2);

    leftPhase += leftPhaseInc;
    rightPhase += rightPhaseInc;

    if (leftPhase > 2 * Math.PI) leftPhase -= 2 * Math.PI;
    if (rightPhase > 2 * Math.PI) rightPhase -= 2 * Math.PI;
  }

  return buffer;
}

const MISSING_TRACKS = [
  {
    objectPath: "Alpha/AlphaBinauralBeat_200_9-5_TheZone.wav",
    baseHz: 200,
    beatHz: 9.5,
    label: "The Zone (Alpha)",
  },
  {
    objectPath: "Beta/BetaBinauralBeat_296_27-0_BrainPerformance.wav",
    baseHz: 296,
    beatHz: 27,
    label: "Brain Performance (Beta)",
  },
];

export async function ensureMissingTracksExist(): Promise<void> {
  for (const track of MISSING_TRACKS) {
    try {
      const check = await client.downloadAsBytes(track.objectPath);
      if (check.ok && check.value[0].length >= MIN_VALID_SIZE) {
        preCacheFileSize(track.objectPath, check.value[0].length);
        console.log(`[Audio] ${track.label} already present (${(check.value[0].length / 1024 / 1024).toFixed(0)} MB), skipping`);
        continue;
      }

      console.log(`[Audio] Generating ${track.label} (30 min, 22050 Hz)...`);
      const wav = createBinauralWav(track.baseHz, track.beatHz);
      console.log(`[Audio] Uploading ${track.objectPath} (${(wav.length / 1024 / 1024).toFixed(0)} MB)...`);
      await client.uploadFromBytes(track.objectPath, wav);
      console.log(`[Audio] Done: ${track.objectPath}`);
    } catch (err) {
      console.error(`[Audio] Failed to ensure ${track.label}:`, err);
    }
  }
}
