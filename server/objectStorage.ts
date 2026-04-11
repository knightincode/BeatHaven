import { Client } from "@replit/object-storage";
import type { Readable } from "stream";
import { PassThrough } from "stream";
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

export type StreamServeResult =
  | { status: "disk"; filePath: string; size: number }
  | { status: "stream"; stream: Readable; size: number }
  | { status: "not_found" }
  | { status: "error"; message: string };

export async function getAudioStreamOrDisk(
  objectName: string,
  knownSize: number,
  responseByteLimit?: number
): Promise<StreamServeResult> {
  const cachePath = getCachePath(objectName);

  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath);
    if (stat.size > 0) {
      fileSizeCache.set(objectName, stat.size);
      return { status: "disk", filePath: cachePath, size: stat.size };
    }
    try { fs.unlinkSync(cachePath); } catch {}
  }

  const existing = inFlightDownloads.get(objectName);
  if (existing) {
    // Another request is already downloading this file to disk.
    // Serve a fresh Object Storage stream directly to this response instead of
    // blocking for the entire 302MB download to finish.
    // The existing download will complete the disk cache for future requests.
    console.log(`[Audio] Concurrent request for ${objectName} — serving fresh stream (disk write in progress)`);
    const freshStream = client.downloadAsStream(objectName) as Readable;
    return { status: "stream", stream: freshStream, size: knownSize };
  }

  let resolveCache!: (r: AudioFileResult) => void;
  const cachePromise: Promise<AudioFileResult> = new Promise((resolve) => {
    resolveCache = resolve;
  });
  inFlightDownloads.set(objectName, cachePromise);
  cachePromise.finally(() => inFlightDownloads.delete(objectName));

  // knownSize comes from pre-cached WAV constants — file is guaranteed to exist.
  // Skip objectExists() to avoid 3-4s network roundtrip before streaming starts.

  const folder = path.dirname(objectName);
  ensureCacheDir(folder);
  const tmpPath = getTmpPath(objectName);
  cleanupTmp(tmpPath);

  const storageStream = client.downloadAsStream(objectName) as Readable;
  const responsePass = new PassThrough();
  const fileWrite = fs.createWriteStream(tmpPath);

  const streamTimeout = setTimeout(() => {
    console.error(`[Audio] Stream timeout (120s) for ${objectName} — destroying streams`);
    storageStream.destroy(new Error("Stream timeout"));
  }, 120_000);

  let streamEnded = false;
  const clearStreamTimeout = () => {
    if (!streamEnded) {
      streamEnded = true;
      clearTimeout(streamTimeout);
    }
  };

  let responseDetached = false;
  let passWaiting = false;
  let fileWaiting = false;
  let responseBytesSent = 0;

  function resumeStorageStream() {
    if (!passWaiting && !fileWaiting) {
      storageStream.resume();
    }
  }

  const detachResponse = () => {
    if (!responseDetached) {
      responseDetached = true;
      passWaiting = false;
      clearStreamTimeout();
      console.log(`[Audio] Client disconnected for ${objectName}, aborting Object Storage download`);
      storageStream.destroy();
    }
  };
  responsePass.on("close", detachResponse);
  responsePass.on("error", detachResponse);

  storageStream.on("data", (chunk: Buffer) => {
    // Always write to disk
    const fileOk = fileWrite.write(chunk);
    if (!fileOk && !fileWaiting) {
      fileWaiting = true;
      storageStream.pause();
      fileWrite.once("drain", () => { fileWaiting = false; resumeStorageStream(); });
    }

    // Write to response only while browser is still connected
    if (!responseDetached) {
      // Apply byte limit for probe requests (e.g. bytes=0-1) so we respond
      // immediately with just the requested bytes while the rest caches to disk.
      let chunkForResponse = chunk;
      if (responseByteLimit !== undefined) {
        const remaining = responseByteLimit - responseBytesSent;
        if (remaining <= 0) {
          // Already sent everything needed — detach response, disk continues
          responsePass.end();
          return;
        }
        if (chunk.length > remaining) {
          chunkForResponse = chunk.slice(0, remaining);
        }
      }
      responseBytesSent += chunkForResponse.length;

      let passOk = false;
      try {
        passOk = responsePass.write(chunkForResponse);
      } catch {
        detachResponse();
        return;
      }
      if (!passOk && !responseDetached && !passWaiting) {
        passWaiting = true;
        if (!storageStream.isPaused()) storageStream.pause();
        responsePass.once("drain", () => { passWaiting = false; resumeStorageStream(); });
      }

      // If we just sent the last allowed byte, close the response stream.
      // Set responseDetached first to prevent writes between .end() and 'close'.
      // The storageStream continues downloading to disk via detachResponse().
      if (responseByteLimit !== undefined && responseBytesSent >= responseByteLimit) {
        responseDetached = true;
        passWaiting = false;
        responsePass.end();
      }
    }
  });

  storageStream.on("end", () => {
    clearStreamTimeout();
    responsePass.end();
    fileWrite.end();
  });

  storageStream.on("error", (err: any) => {
    clearStreamTimeout();
    console.error(`[Audio] Tee stream source error for ${objectName}:`, err?.message || err);
    responsePass.destroy(err);
    fileWrite.destroy();
    cleanupTmp(tmpPath);
    resolveCache({ status: "error", message: err?.message || "Stream source error" });
  });

  fileWrite.on("finish", () => {
    try {
      const stat = fs.statSync(tmpPath);
      if (stat.size > 0) {
        fs.renameSync(tmpPath, cachePath);
        fileSizeCache.set(objectName, stat.size);
        console.log(`[Audio] Tee-cached to disk: ${objectName} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
        resolveCache({ status: "ok", filePath: cachePath, size: stat.size });
      } else {
        cleanupTmp(tmpPath);
        resolveCache({ status: "error", message: "Empty file after tee write" });
      }
    } catch (err: any) {
      cleanupTmp(tmpPath);
      resolveCache({ status: "error", message: err?.message || "Rename failed after tee" });
    }
  });

  fileWrite.on("error", (err: any) => {
    console.error(`[Audio] Tee file write error for ${objectName}:`, err?.message || err);
    storageStream.destroy();
    responsePass.destroy(err);
    cleanupTmp(tmpPath);
    resolveCache({ status: "error", message: err?.message || "Tee file write error" });
  });

  console.log(`[Audio] Tee-streaming ${objectName} (${(knownSize / 1024 / 1024).toFixed(1)} MB) → response + disk`);
  return { status: "stream", stream: responsePass, size: knownSize };
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

  // Use exists() check instead of downloading the full 302MB file
  try {
    const existsResult = await client.exists(testPath);
    result.bytesOk = existsResult.ok && existsResult.value === true;
    if (!result.bytesOk && existsResult.ok) {
      result.error = "Test file not found in Object Storage";
    }
  } catch (err: any) {
    result.error = `exists check: ${err?.message || err}`;
  }

  // Read just the first chunk of the stream to verify streaming works
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

export async function waitForInflightDownload(objectName: string, timeoutMs: number = 60_000): Promise<string | null> {
  const existing = inFlightDownloads.get(objectName);
  if (!existing) return null;

  console.log(`[Audio] Waiting for in-flight download of ${objectName} to complete...`);

  const result = await Promise.race([
    existing,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);

  if (result && result.status === "ok" && result.filePath) {
    console.log(`[Audio] In-flight download completed for ${objectName}`);
    return result.filePath;
  }

  console.warn(`[Audio] In-flight download wait ended for ${objectName}: ${result ? result.status : 'timeout'}`);
  return null;
}

export function hasInflightDownload(objectName: string): boolean {
  return inFlightDownloads.has(objectName);
}

export function createRangeStream(objectName: string, skipBytes: number, maxBytes?: number): Readable {
  const source = client.downloadAsStream(objectName) as Readable;
  if (skipBytes <= 0 && maxBytes === undefined) return source;

  const pass = new PassThrough();
  let toSkip = skipBytes;
  let bytesWritten = 0;

  source.on("data", (chunk: Buffer) => {
    if (toSkip > 0) {
      if (chunk.length <= toSkip) {
        toSkip -= chunk.length;
        return;
      }
      chunk = chunk.subarray(toSkip);
      toSkip = 0;
    }

    if (maxBytes !== undefined) {
      const allowed = maxBytes - bytesWritten;
      if (allowed <= 0) {
        pass.end();
        source.destroy();
        return;
      }
      if (chunk.length > allowed) {
        chunk = chunk.subarray(0, allowed);
      }
    }

    bytesWritten += chunk.length;
    if (!pass.write(chunk)) {
      source.pause();
      pass.once("drain", () => source.resume());
    }

    if (maxBytes !== undefined && bytesWritten >= maxBytes) {
      pass.end();
      source.destroy();
    }
  });
  source.on("end", () => { if (!pass.writableEnded) pass.end(); });
  source.on("error", (err) => pass.destroy(err));
  pass.on("close", () => { if (!source.destroyed) source.destroy(); });

  return pass;
}

export { client as storageClient };
