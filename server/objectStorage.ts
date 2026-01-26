import { Client } from "@replit/object-storage";

const client = new Client();

export async function uploadAudioFile(
  fileName: string,
  fileBuffer: Buffer
): Promise<string> {
  const objectName = `audio/${Date.now()}-${fileName}`;
  
  await client.uploadFromBytes(objectName, fileBuffer);
  
  const url = await client.getSignedDownloadUrl(objectName);
  return url;
}

export async function deleteAudioFile(objectName: string): Promise<void> {
  await client.delete(objectName);
}

export async function getAudioFileUrl(objectName: string): Promise<string> {
  return await client.getSignedDownloadUrl(objectName);
}

export { client as storageClient };
