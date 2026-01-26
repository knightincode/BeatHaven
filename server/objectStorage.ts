import { Client } from "@replit/object-storage";

const client = new Client();

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

export function streamAudioFile(objectName: string) {
  return client.downloadAsStream(objectName);
}

export { client as storageClient };
