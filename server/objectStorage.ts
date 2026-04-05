import { Client } from "@replit/object-storage";
import type { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";

const client = new Client();

const fileSizeCache = new Map<string, number>();

const DISK_CACHE_DIR = "/tmp/audio-cache";

export const WAV_MAIN_SIZE = 317_520_044;
export const WAV_GENERATED_SIZE = 158_760_044;

function ensureCacheDir(subDir: string): void {
  const dir = path.join(DISK_CACHE_DIR, subDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getCachePath(objectName: string): string {
  return path.join(DISK_CACHE_DIR, objectName);
}

function getTmpPath(objectName: string): string {
  return getCachePath(objectName) + ".download";
}

function cleanupTmp(tmpPath: string): void {
  try {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  } catch {}
}

const inFlightDownloads = new Map<string, Promise<AudioFileResult>>();

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
  if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
}

export async function downloadAudioFile(objectName: string): Promise<Buffer | null> {
  const result = await client.downloadAsBytes(objectName);
  return result.ok ? result.value[0] : null;
}

export function openAudioStream(objectName: string): Readable {
  return client.downloadAsStream(objectName) as Readable;
}

export async function getAudioFileSize(objectName: string): Promise<number | null> {
  if (fileSizeCache.has(objectName)) return fileSizeCache.get(objectName) ?? null;
  const cachePath = getCachePath(objectName);
  if (fs.existsSync(cachePath)) {
    const size = fs.statSync(cachePath).size;
    fileSizeCache.set(objectName, size);
    return size;
  }
  return null;
}

export function preCacheFileSize(objectName: string, size: number): void {
  fileSizeCache.set(objectName, size);
}

export function getCachedFileSize(objectName: string): number | undefined {
  return fileSizeCache.get(objectName);
}

export type AudioFileResult =
  | { status: "ok"; filePath: string; size: number }
  | { status: "not_found" }
  | { status: "error"; message: string };

export async function objectExists(objectName: string): Promise<{ exists: boolean; checkFailed: boolean }> {
  try {
    const result = await client.exists(objectName);
    if (result.ok) return { exists: result.value === true, checkFailed: false };
    return { exists: false, checkFailed: true };
  } catch {
    return { exists: false, checkFailed: true };
  }
}

async function downloadToFile(objectName: string, destPath: string): Promise<boolean> {
  try {
    const result = await client.downloadToFilename(objectName, destPath);
    return result.ok;
  } catch (err: any) {
    console.error(`[Audio] downloadToFilename error for ${objectName}:`, err?.message || err);
    return false;
  }
}

async function runDownload(objectName: string): Promise<AudioFileResult> {
  const cachePath = getCachePath(objectName);
  const tmpPath = getTmpPath(objectName);
  const folder = path.dirname(objectName);
  ensureCacheDir(folder);

  const existsCheck = await objectExists(objectName);
  if (!existsCheck.exists && !existsCheck.checkFailed) {
    console.error(`[Audio] Object does not exist: ${objectName}`);
    return { status: "not_found" };
  }
  if (existsCheck.checkFailed) {
    console.warn(`[Audio] exists() check failed for ${objectName}, attempting download anyway`);
  }

  cleanupTmp(tmpPath);

  const ok = await downloadToFile(objectName, tmpPath);
  if (ok && fs.existsSync(tmpPath)) {
    const stat = fs.statSync(tmpPath);
    if (stat.size > 0) {
      fs.renameSync(tmpPath, cachePath);
      fileSizeCache.set(objectName, stat.size);
      console.log(`[Audio] Cached to disk: ${objectName} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
      return { status: "ok", filePath: cachePath, size: stat.size };
    }
  }
  cleanupTmp(tmpPath);

  console.warn(`[Audio] downloadToFilename failed for ${objectName}, trying stream fallback`);
  const streamOk = await streamToFile(objectName, tmpPath);
  if (streamOk && fs.existsSync(tmpPath)) {
    const stat = fs.statSync(tmpPath);
    if (stat.size > 0) {
      fs.renameSync(tmpPath, cachePath);
      fileSizeCache.set(objectName, stat.size);
      console.log(`[Audio] Stream-cached to disk: ${objectName} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
      return { status: "ok", filePath: cachePath, size: stat.size };
    }
  }
  cleanupTmp(tmpPath);

  const msg = `All download methods failed for ${objectName}`;
  console.error(`[Audio] ${msg}`);
  return { status: "error", message: msg };
}

async function streamToFile(objectName: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const stream = client.downloadAsStream(objectName) as Readable;
      const writeStream = fs.createWriteStream(destPath);
      const timeout = setTimeout(() => {
        stream.destroy();
        writeStream.destroy();
        cleanupTmp(destPath);
        resolve(false);
      }, 120_000);

      stream.pipe(writeStream);
      writeStream.on("finish", () => { clearTimeout(timeout); resolve(true); });
      stream.on("error", (err: any) => {
        clearTimeout(timeout);
        writeStream.destroy();
        cleanupTmp(destPath);
        console.error(`[Audio] Stream-to-file error for ${objectName}:`, err?.message || err);
        resolve(false);
      });
      writeStream.on("error", (err: any) => {
        clearTimeout(timeout);
        stream.destroy();
        cleanupTmp(destPath);
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
    try { fs.unlinkSync(cachePath); } catch {}
  }

  const existing = inFlightDownloads.get(objectName);
  if (existing) return existing;

  const promise = runDownload(objectName);
  inFlightDownloads.set(objectName, promise);
  promise.finally(() => inFlightDownloads.delete(objectName));
  return promise;
}

export function openStorageStream(objectName: string): Readable {
  return client.downloadAsStream(objectName) as Readable;
}

export type StreamServeResult =
  | { mode: "disk"; filePath: string; size: number }
  | { mode: "stream"; stream: Readable; size: number }
  | { status: "not_found" }
  | { status: "error"; message: string };

export async function getAudioStreamOrDisk(
  objectName: string,
  knownSize: number
): Promise<StreamServeResult> {
  const cachePath = getCachePath(objectName);

  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath);
    if (stat.size > 0) {
      fileSizeCache.set(objectName, stat.size);
      return { mode: "disk", filePath: cachePath, size: stat.size };
    }
    try { fs.unlinkSync(cachePath); } catch {}
  }

  const existing = inFlightDownloads.get(objectName);
  if (existing) {
    const result = await existing;
    return result.status === "ok"
      ? { mode: "disk", filePath: result.filePath, size: result.size }
      : result;
  }

  const folder = path.dirname(objectName);
  ensureCacheDir(folder);

  const tmpPath = getTmpPath(objectName);
  cleanupTmp(tmpPath);

  const promise = runDownload(objectName);
  inFlightDownloads.set(objectName, promise);
  promise.finally(() => inFlightDownloads.delete(objectName));

  const stream = client.downloadAsStream(objectName) as Readable;
  return { mode: "stream", stream, size: knownSize };
}

export async function getFileSizeFromStorage(objectName: string): Promise<number | null> {
  if (fileSizeCache.has(objectName)) return fileSizeCache.get(objectName) ?? null;
  const cachePath = getCachePath(objectName);
  if (fs.existsSync(cachePath)) {
    const size = fs.statSync(cachePath).size;
    fileSizeCache.set(objectName, size);
    return size;
  }
  return null;
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
      }, 10_000);
      stream.once("data", () => {
        clearTimeout(timeout);
        result.streamOk = true;
        stream.destroy();
        resolve();
      });
      stream.once("error", (err) => { clearTimeout(timeout); reject(err); });
    });
  } catch (err: any) {
    result.error = (result.error ? result.error + "; " : "") + `downloadAsStream: ${err?.message || err}`;
  }

  return result;
}

export { client as storageClient };
