import { Client } from "@replit/object-storage";
import type { Readable } from "stream";

const client = new Client();

const fileSizeCache = new Map<string, number>();

const MAX_BUFFER_CACHE_BYTES = 500 * 1024 * 1024;
let currentCacheBytes = 0;
const audioBufferCache = new Map<string, { buffer: Buffer; lastAccess: number }>();

function evictBufferCache(): void {
  while (currentCacheBytes > MAX_BUFFER_CACHE_BYTES && audioBufferCache.size > 0) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of audioBufferCache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      const evicted = audioBufferCache.get(oldestKey);
      if (evicted) currentCacheBytes -= evicted.buffer.length;
      audioBufferCache.delete(oldestKey);
    } else {
      break;
    }
  }
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
      currentCacheBytes += buffer.length;
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

export type AudioBufferResult =
  | { status: "ok"; buffer: Buffer; size: number }
  | { status: "not_found" }
  | { status: "error"; message: string };

async function tryStreamFallback(objectName: string): Promise<AudioBufferResult> {
  return new Promise((resolve) => {
    try {
      const stream = client.downloadAsStream(objectName) as Readable;
      const chunks: Buffer[] = [];
      let totalLength = 0;

      const timeout = setTimeout(() => {
        stream.destroy();
        resolve({ status: "error", message: "Stream fallback timed out after 60s" });
      }, 60000);

      stream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
        totalLength += chunk.length;
      });
      stream.on("end", () => {
        clearTimeout(timeout);
        const buffer = Buffer.concat(chunks, totalLength);
        fileSizeCache.set(objectName, buffer.length);
        audioBufferCache.set(objectName, { buffer, lastAccess: Date.now() });
        currentCacheBytes += buffer.length;
        evictBufferCache();
        resolve({ status: "ok", buffer, size: buffer.length });
      });
      stream.on("error", (err: any) => {
        clearTimeout(timeout);
        resolve({ status: "error", message: `Stream fallback failed: ${err?.message || err}` });
      });
    } catch (err: any) {
      resolve({ status: "error", message: `Stream fallback exception: ${err?.message || err}` });
    }
  });
}

export async function objectExists(objectName: string): Promise<boolean> {
  try {
    const result = await client.exists(objectName);
    return result.ok && result.value === true;
  } catch {
    return false;
  }
}

export async function getAudioFileAsBuffer(objectName: string): Promise<AudioBufferResult> {
  const cached = audioBufferCache.get(objectName);
  if (cached) {
    cached.lastAccess = Date.now();
    return { status: "ok", buffer: cached.buffer, size: cached.buffer.length };
  }

  const exists = await objectExists(objectName);
  if (!exists) {
    console.error(`[Audio] Object does not exist: ${objectName}`);
    return { status: "not_found" };
  }

  try {
    const result = await client.downloadAsBytes(objectName);
    if (result.ok) {
      const buffer = result.value[0];
      fileSizeCache.set(objectName, buffer.length);
      audioBufferCache.set(objectName, { buffer, lastAccess: Date.now() });
      currentCacheBytes += buffer.length;
      evictBufferCache();
      return { status: "ok", buffer, size: buffer.length };
    }
    console.warn(`[Audio] downloadAsBytes not-ok for ${objectName}, trying stream fallback`);
    return await tryStreamFallback(objectName);
  } catch (err: any) {
    const message = err?.message || String(err);
    console.warn(`[Audio] downloadAsBytes error for ${objectName}: ${message}, trying stream fallback`);
    return await tryStreamFallback(objectName);
  }
}

export async function getFileSizeFromStorage(objectName: string): Promise<number | null> {
  if (fileSizeCache.has(objectName)) {
    return fileSizeCache.get(objectName) ?? null;
  }

  const cachedBuffer = audioBufferCache.get(objectName);
  if (cachedBuffer) {
    fileSizeCache.set(objectName, cachedBuffer.buffer.length);
    return cachedBuffer.buffer.length;
  }

  try {
    const result = await client.downloadAsBytes(objectName);
    if (result.ok) {
      const size = result.value[0].length;
      fileSizeCache.set(objectName, size);
      return size;
    }
    return null;
  } catch {
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
