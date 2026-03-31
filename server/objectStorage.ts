import { Client } from "@replit/object-storage";
import type { Readable } from "stream";

const client = new Client();

const fileSizeCache = new Map<string, number>();

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

  return new Promise<number | null>((resolve) => {
    const stream = client.downloadAsStream(objectName) as Readable;
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let resolved = false;

    function tryResolve() {
      if (resolved) return;
      if (totalBytes < 8) return;
      resolved = true;
      stream.destroy();
      const header = Buffer.concat(chunks);
      const riffSize = header.readUInt32LE(4);
      const fileSize = riffSize + 8;
      fileSizeCache.set(objectName, fileSize);
      resolve(fileSize);
    }

    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      totalBytes += chunk.length;
      tryResolve();
    });

    stream.on("error", () => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    });

    stream.on("end", () => {
      if (!resolved) {
        resolved = true;
        if (totalBytes >= 8) {
          tryResolve();
        } else {
          resolve(null);
        }
      }
    });
  });
}

export function preCacheFileSize(objectName: string, size: number): void {
  fileSizeCache.set(objectName, size);
}

export async function getAudioFileAsBuffer(objectName: string): Promise<{ buffer: Buffer; size: number } | null> {
  const result = await client.downloadAsBytes(objectName);
  if (result.ok) {
    const buffer = result.value[0];
    fileSizeCache.set(objectName, buffer.length);
    return { buffer, size: buffer.length };
  }
  return null;
}

export { client as storageClient };
