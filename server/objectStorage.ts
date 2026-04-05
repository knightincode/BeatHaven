import { Client } from "@replit/object-storage";
import type { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";

const client = new Client();

const fileSizeCache = new Map<string, number>();

const DISK_CACHE_DIR = "/tmp/audio-cache";

function ensureCacheDir(subDir: string): void {
  const dir = path.join(DISK_CACHE_DIR, subDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getCachePath(objectName: string): string {
  return path.join(DISK_CACHE_DIR, objectName);
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
  const cachePath = getCachePath(objectName);
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
  }
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

  const cachePath = getCachePath(objectName);
  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath);
    fileSizeCache.set(objectName, stat.size);
    return stat.size;
  }

  return null;
}

export function preCacheFileSize(objectName: string, size: number): void {
  fileSizeCache.set(objectName, size);
}

export type AudioFileResult =
  | { status: "ok"; filePath: string; size: number }
  | { status: "not_found" }
  | { status: "error"; message: string };

export async function objectExists(objectName: string): Promise<{ exists: boolean; checkFailed: boolean }> {
  try {
    const result = await client.exists(objectName);
    if (result.ok) {
      return { exists: result.value === true, checkFailed: false };
    }
    return { exists: false, checkFailed: true };
  } catch {
    return { exists: false, checkFailed: true };
  }
}

async function downloadToFile(objectName: string, destPath: string): Promise<boolean> {
  const result = await client.downloadToFilename(objectName, destPath);
  return result.ok;
}

async function tryStreamToFile(objectName: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const stream = client.downloadAsStream(objectName) as Readable;
      const writeStream = fs.createWriteStream(destPath);

      const timeout = setTimeout(() => {
        stream.destroy();
        writeStream.destroy();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        resolve(false);
      }, 120000);

      stream.pipe(writeStream);

      writeStream.on("finish", () => {
        clearTimeout(timeout);
        resolve(true);
      });

      stream.on("error", (err: any) => {
        clearTimeout(timeout);
        writeStream.destroy();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        console.error(`[Audio] Stream-to-file error for ${objectName}:`, err?.message || err);
        resolve(false);
      });

      writeStream.on("error", (err: any) => {
        clearTimeout(timeout);
        stream.destroy();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        console.error(`[Audio] Write error for ${objectName}:`, err?.message || err);
        resolve(false);
      });
    } catch (err: any) {
      console.error(`[Audio] Stream-to-file exception for ${objectName}:`, err?.message || err);
      resolve(false);
    }
  });
}

export async function getAudioFilePath(objectName: string): Promise<AudioFileResult> {
  const cachePath = getCachePath(objectName);
  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath);
    if (stat.size > 0) {
      fileSizeCache.set(objectName, stat.size);
      return { status: "ok", filePath: cachePath, size: stat.size };
    }
    fs.unlinkSync(cachePath);
  }

  const existsCheck = await objectExists(objectName);
  if (!existsCheck.exists) {
    if (existsCheck.checkFailed) {
      console.warn(`[Audio] exists() check failed for ${objectName}, proceeding with download attempt`);
    } else {
      console.error(`[Audio] Object does not exist: ${objectName}`);
      return { status: "not_found" };
    }
  }

  const folder = path.dirname(objectName);
  ensureCacheDir(folder);

  try {
    const ok = await downloadToFile(objectName, cachePath);
    if (ok && fs.existsSync(cachePath)) {
      const stat = fs.statSync(cachePath);
      fileSizeCache.set(objectName, stat.size);
      console.log(`[Audio] Downloaded to disk: ${objectName} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
      return { status: "ok", filePath: cachePath, size: stat.size };
    }
    console.warn(`[Audio] downloadToFilename not-ok for ${objectName}, trying stream fallback`);
  } catch (err: any) {
    console.warn(`[Audio] downloadToFilename error for ${objectName}: ${err?.message || err}, trying stream fallback`);
  }

  try {
    const ok = await tryStreamToFile(objectName, cachePath);
    if (ok && fs.existsSync(cachePath)) {
      const stat = fs.statSync(cachePath);
      fileSizeCache.set(objectName, stat.size);
      console.log(`[Audio] Stream-to-file succeeded: ${objectName} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
      return { status: "ok", filePath: cachePath, size: stat.size };
    }
  } catch (err: any) {
    console.error(`[Audio] Stream fallback failed for ${objectName}: ${err?.message || err}`);
  }

  return { status: "error", message: `All download methods failed for ${objectName}` };
}

export async function getFileSizeFromStorage(objectName: string): Promise<number | null> {
  if (fileSizeCache.has(objectName)) {
    return fileSizeCache.get(objectName) ?? null;
  }

  const cachePath = getCachePath(objectName);
  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath);
    fileSizeCache.set(objectName, stat.size);
    return stat.size;
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
