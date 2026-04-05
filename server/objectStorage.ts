import { Client } from "@replit/object-storage";
import type { Readable } from "stream";

const client = new Client();

const fileSizeCache = new Map<string, number>();

const MAX_BUFFER_CACHE_ENTRIES = 10;
const audioBufferCache = new Map<string, { buffer: Buffer; lastAccess: number }>();

function evictBufferCache(): void {
  if (audioBufferCache.size <= MAX_BUFFER_CACHE_ENTRIES) return;
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [key, entry] of audioBufferCache) {
    if (entry.lastAccess < oldestTime) {
      oldestTime = entry.lastAccess;
      oldestKey = key;
    }
  }
  if (oldestKey) audioBufferCache.delete(oldestKey);
}

export async function uploadAudioFile(
  fileName: string,
  fileBuffer: Buffer
): Promise<string> {
  const objectName = `audio/${Date.now()}-${fileName}`;
  
  await client.uploadFromBytes(objectName, fileBuffer);
  
  return objectName;
}

export async function deleteAudioFile(objectName: string): Promise<void> {
  await client.delete(objectName);
}

export async function downloadAudioFile(objectName: string): Promise<Buffer | null> {
  const result = await client.downloadAsBytes(objectName);
  if (result.ok) {
    return result.value[0];
  }
  return null;
}

export function openAudioStream(objectName: string): Readable {
  return client.downloadAsStream(objectName) as Readable;
}

export async function getAudioFileSize(objectName: string): Promise<number | null> {
  if (fileSizeCache.has(objectName)) {
    return fileSizeCache.get(objectName) ?? null;
  }

  try {
    const result = await client.downloadAsBytes(objectName);
    if (result.ok) {
      const buffer = result.value[0];
      fileSizeCache.set(objectName, buffer.length);
      audioBufferCache.set(objectName, { buffer, lastAccess: Date.now() });
      evictBufferCache();
      return buffer.length;
    }
    console.error(`[Audio] getAudioFileSize: downloadAsBytes failed for ${objectName}`);
    return null;
  } catch (err: any) {
    console.error(`[Audio] getAudioFileSize error for ${objectName}:`, err?.message || err);
    return null;
  }
}

export function preCacheFileSize(objectName: string, size: number): void {
  fileSizeCache.set(objectName, size);
}

export async function getAudioFileAsBuffer(objectName: string): Promise<{ buffer: Buffer; size: number } | null> {
  const cached = audioBufferCache.get(objectName);
  if (cached) {
    cached.lastAccess = Date.now();
    return { buffer: cached.buffer, size: cached.buffer.length };
  }

  try {
    const result = await client.downloadAsBytes(objectName);
    if (result.ok) {
      const buffer = result.value[0];
      fileSizeCache.set(objectName, buffer.length);
      audioBufferCache.set(objectName, { buffer, lastAccess: Date.now() });
      evictBufferCache();
      return { buffer, size: buffer.length };
    }
    return null;
  } catch (err: any) {
    console.error(`[Audio] getAudioFileAsBuffer error for ${objectName}:`, err?.message || err);
    return null;
  }
}

export async function testStorageConnectivity(): Promise<{
  bytesOk: boolean;
  streamOk: boolean;
  error?: string;
}> {
  const testPath = "Alpha/AlphaBinauralBeat_235_12-0_AlphaBetaBorder.wav";
  const result: { bytesOk: boolean; streamOk: boolean; error?: string } = {
    bytesOk: false,
    streamOk: false,
  };

  try {
    const bytesResult = await client.downloadAsBytes(testPath);
    result.bytesOk = bytesResult.ok;
  } catch (err: any) {
    result.error = `downloadAsBytes: ${err?.message || err}`;
  }

  try {
    const stream = client.downloadAsStream(testPath) as Readable;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        stream.destroy();
        reject(new Error("Stream timeout after 10s"));
      }, 10000);
      stream.once("data", () => {
        clearTimeout(timeout);
        result.streamOk = true;
        stream.destroy();
        resolve();
      });
      stream.once("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  } catch (err: any) {
    result.error = (result.error ? result.error + "; " : "") + `downloadAsStream: ${err?.message || err}`;
  }

  return result;
}

export { client as storageClient };
