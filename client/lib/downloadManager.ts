import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}downloads/`;
const DOWNLOADS_KEY = "@binaural_downloads";

export interface DownloadedTrack {
  trackId: string;
  localUri: string;
  downloadedAt: number;
  fileSize: number;
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
  }
}

export async function getDownloadedTracks(): Promise<Record<string, DownloadedTrack>> {
  try {
    const data = await AsyncStorage.getItem(DOWNLOADS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

async function saveDownloadedTracks(tracks: Record<string, DownloadedTrack>) {
  await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(tracks));
}

export async function isTrackDownloaded(trackId: string): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const tracks = await getDownloadedTracks();
  const entry = tracks[trackId];
  if (!entry) return false;
  const info = await FileSystem.getInfoAsync(entry.localUri);
  return info.exists;
}

export async function getLocalUri(trackId: string): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const tracks = await getDownloadedTracks();
  const entry = tracks[trackId];
  if (!entry) return null;
  const info = await FileSystem.getInfoAsync(entry.localUri);
  if (!info.exists) {
    delete tracks[trackId];
    await saveDownloadedTracks(tracks);
    return null;
  }
  return entry.localUri;
}

export function downloadTrack(
  trackId: string,
  token: string,
  onProgress?: (progress: number) => void
): { promise: Promise<DownloadedTrack>; cancel: () => void } {
  let downloadResumable: FileSystem.DownloadResumable | null = null;
  let cancelled = false;

  const promise = (async () => {
    if (Platform.OS === "web") {
      throw new Error("Downloads not available on web");
    }

    await ensureDir();
    const localUri = `${DOWNLOADS_DIR}${trackId}.m4a`;
    const baseUrl = getApiUrl();
    const url = `${baseUrl}api/audio/compressed/${trackId}`;

    downloadResumable = FileSystem.createDownloadResumable(
      url,
      localUri,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      (downloadProgress) => {
        if (cancelled) return;
        const progress =
          downloadProgress.totalBytesWritten /
          downloadProgress.totalBytesExpectedToWrite;
        onProgress?.(progress);
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || cancelled) {
      throw new Error("Download cancelled or failed");
    }

    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    const entry: DownloadedTrack = {
      trackId,
      localUri: result.uri,
      downloadedAt: Date.now(),
      fileSize: (fileInfo as any).size || 0,
    };

    const tracks = await getDownloadedTracks();
    tracks[trackId] = entry;
    await saveDownloadedTracks(tracks);

    return entry;
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      downloadResumable?.cancelAsync();
    },
  };
}

export async function deleteDownloadedTrack(trackId: string): Promise<void> {
  if (Platform.OS === "web") return;
  const tracks = await getDownloadedTracks();
  const entry = tracks[trackId];
  if (entry) {
    try {
      await FileSystem.deleteAsync(entry.localUri, { idempotent: true });
    } catch {}
    delete tracks[trackId];
    await saveDownloadedTracks(tracks);
  }
}

export async function getDownloadedSize(): Promise<number> {
  const tracks = await getDownloadedTracks();
  return Object.values(tracks).reduce((sum, t) => sum + t.fileSize, 0);
}
