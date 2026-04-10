import React, {
  createContext,
  useContext,
  useState,
  useRef,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import { Platform } from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import { useWebAudioUnlock, getSharedAudioContext } from "@/hooks/useWebAudioUnlock";

function resolveAudioUrl(fileUrl: string): string {
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl;
  }
  try {
    return new URL(fileUrl, getApiUrl()).href;
  } catch {
    return fileUrl;
  }
}

export interface Track {
  id: string;
  title: string;
  description?: string;
  frequency: string;
  category: string;
  duration: number;
  fileUrl: string;
  thumbnailUrl?: string;
}

export type LoopMode = "none" | "one" | "all";
export type SleepTimerOption = number | null;

const FREE_PREVIEW_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS = 1500;

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  duration: number;
  loopMode: LoopMode;
  isPlayerVisible: boolean;
  sleepTimer: SleepTimerOption;
  sleepTimerRemaining: number;
  isFadingOut: boolean;
  hasActiveSubscription: boolean;
  previewEnded: boolean;
  queue: Track[];
  queueIndex: number;
  hasNext: boolean;
  hasPrevious: boolean;
  playedTrackIds: Set<string>;
  isTrackPlayed: (trackId: string) => boolean;
  playTrack: (track: Track, trackQueue?: Track[]) => Promise<void>;
  prebufferTrack: (track: Track) => void;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (position: number) => Promise<void>;
  setLoopMode: (mode: LoopMode) => void;
  setSleepTimer: (minutes: SleepTimerOption) => void;
  showPlayer: () => void;
  hidePlayer: () => void;
  dismissPreviewEnded: () => void;
  audioBlocked: boolean;
  audioError: string | null;
  resumeBlockedAudio: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const FADE_DURATION = 30000;
const FADE_INTERVAL = 500;

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429 || status === 503;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { hasActiveSubscription, user, isDemo, demoSessionId } = useAuth();
  useWebAudioUnlock();
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loopMode, setLoopMode] = useState<LoopMode>("none");
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);
  const [sleepTimer, setSleepTimerState] = useState<SleepTimerOption>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [previewEnded, setPreviewEnded] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [playedTrackIds, setPlayedTrackIds] = useState<Set<string>>(new Set());

  const soundRef = useRef<Audio.Sound | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const webAudioListenersRef = useRef<{ el: HTMLAudioElement; handlers: Record<string, () => void> } | null>(null);
  const prebufferedSoundRef = useRef<Audio.Sound | null>(null);
  const prebufferedTrackIdRef = useRef<string | null>(null);
  const prebufferedWebAudioRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);
  const prebufferGenRef = useRef(0);
  const playGenRef = useRef(0);
  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sleepTimerEndRef = useRef<number>(0);
  const subscriptionRef = useRef(hasActiveSubscription);
  const loopModeRef = useRef(loopMode);
  const queueRef = useRef<Track[]>([]);
  const queueIndexRef = useRef(0);
  const playedTrackIdsRef = useRef<Set<string>>(new Set());
  const currentTrackIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(user?.id ?? null);
  const isDemoRef = useRef<boolean>(isDemo);
  const demoSessionIdRef = useRef<string | null>(demoSessionId);
  const previewEndedRef = useRef<boolean>(false);

  useEffect(() => {
    subscriptionRef.current = hasActiveSubscription;
  }, [hasActiveSubscription]);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    isDemoRef.current = isDemo;
  }, [isDemo]);

  useEffect(() => {
    demoSessionIdRef.current = demoSessionId;
  }, [demoSessionId]);

  useEffect(() => {
    loopModeRef.current = loopMode;
  }, [loopMode]);

  useEffect(() => {
    if (Platform.OS !== "web") {
      Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      }).catch((err) =>
        console.warn("[Player] Initial audio mode setup failed:", err),
      );
    }
  }, []);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);

  function getPlayedTracksKey(userId: string): string {
    if (isDemoRef.current && demoSessionIdRef.current) {
      return `played_tracks_demo_${demoSessionIdRef.current}`;
    }
    return `played_tracks_${userId}`;
  }

  useEffect(() => {
    if (user?.id) {
      loadPlayedTracks(user.id);
    } else {
      const empty = new Set<string>();
      playedTrackIdsRef.current = empty;
      setPlayedTrackIds(empty);
    }
  }, [user?.id, demoSessionId]);

  useEffect(() => {
    if (hasActiveSubscription && user?.id) {
      clearPlayedTracks(user.id);
    }
  }, [hasActiveSubscription]);

  async function loadPlayedTracks(userId: string) {
    try {
      const key = getPlayedTracksKey(userId);
      const stored = await AsyncStorage.getItem(key);
      const ids: string[] = stored ? JSON.parse(stored) : [];
      const set = new Set(ids);
      playedTrackIdsRef.current = set;
      setPlayedTrackIds(new Set(set));
    } catch (err) {
      console.warn("[Player] Failed to load played tracks:", err);
      const empty = new Set<string>();
      playedTrackIdsRef.current = empty;
      setPlayedTrackIds(empty);
    }
  }

  async function persistPlayedTracks(userId: string, ids: Set<string>) {
    try {
      const key = getPlayedTracksKey(userId);
      await AsyncStorage.setItem(key, JSON.stringify([...ids]));
    } catch (err) {
      console.warn("[Player] Failed to persist played tracks:", err);
    }
  }

  async function clearPlayedTracks(userId: string) {
    try {
      const key = getPlayedTracksKey(userId);
      await AsyncStorage.removeItem(key);
      const empty = new Set<string>();
      playedTrackIdsRef.current = empty;
      setPlayedTrackIds(empty);
    } catch (err) {
      console.warn("[Player] Failed to clear played tracks:", err);
    }
  }

  function isTrackPlayed(trackId: string): boolean {
    if (subscriptionRef.current) return false;
    return playedTrackIdsRef.current.has(trackId);
  }

  function destroyWebAudio() {
    const entry = webAudioListenersRef.current;
    if (entry) {
      const { el, handlers } = entry;
      for (const [event, handler] of Object.entries(handlers)) {
        el.removeEventListener(event, handler);
      }
      webAudioListenersRef.current = null;
    }
    const audio = webAudioRef.current;
    if (audio) {
      try { audio.pause(); } catch {}
      try { audio.removeAttribute("src"); } catch {}
      try { audio.load(); } catch {}
      webAudioRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      if (Platform.OS === "web") {
        destroyWebAudio();
        if (prebufferedWebAudioRef.current) {
          try {
            prebufferedWebAudioRef.current.audio.pause();
            prebufferedWebAudioRef.current.audio.src = "";
            prebufferedWebAudioRef.current.audio.load();
          } catch {}
          prebufferedWebAudioRef.current = null;
        }
      } else {
        if (soundRef.current) {
          soundRef.current.unloadAsync();
        }
        if (prebufferedSoundRef.current) {
          prebufferedSoundRef.current.unloadAsync().catch(() => {});
          prebufferedSoundRef.current = null;
          prebufferedTrackIdRef.current = null;
        }
      }
      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
      }
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
    };
  }, []);

  const startFadeOut = useCallback(async () => {
    const hasAudio =
      Platform.OS === "web" ? !!webAudioRef.current : !!soundRef.current;
    if (!hasAudio) return;
    setIsFadingOut(true);

    let currentVolume = 1.0;
    const volumeStep = FADE_INTERVAL / FADE_DURATION;

    fadeIntervalRef.current = setInterval(async () => {
      currentVolume -= volumeStep;
      if (currentVolume <= 0) {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
        if (Platform.OS === "web") {
          if (webAudioRef.current) {
            webAudioRef.current.pause();
            webAudioRef.current.volume = 1.0;
          }
        } else {
          if (soundRef.current) {
            await soundRef.current.pauseAsync();
            await soundRef.current.setVolumeAsync(1.0);
          }
        }
        setIsPlaying(false);
        setIsFadingOut(false);
        setSleepTimerState(null);
        setSleepTimerRemaining(0);
      } else {
        const vol = Math.max(0, currentVolume);
        if (Platform.OS === "web") {
          if (webAudioRef.current) webAudioRef.current.volume = vol;
        } else {
          if (soundRef.current) await soundRef.current.setVolumeAsync(vol);
        }
      }
    }, FADE_INTERVAL);
  }, []);

  function setSleepTimer(minutes: SleepTimerOption) {
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    setIsFadingOut(false);

    if (minutes === null) {
      setSleepTimerState(null);
      setSleepTimerRemaining(0);
      if (Platform.OS === "web") {
        if (webAudioRef.current) webAudioRef.current.volume = 1.0;
      } else {
        if (soundRef.current) {
          soundRef.current.setVolumeAsync(1.0);
        }
      }
      return;
    }

    const totalMs = minutes * 60 * 1000;
    sleepTimerEndRef.current = Date.now() + totalMs;
    setSleepTimerState(minutes);
    setSleepTimerRemaining(totalMs);

    sleepTimerRef.current = setInterval(() => {
      const remaining = sleepTimerEndRef.current - Date.now();
      if (remaining <= FADE_DURATION && remaining > 0) {
        setSleepTimerRemaining(remaining);
        if (sleepTimerRef.current) {
          clearInterval(sleepTimerRef.current);
          sleepTimerRef.current = null;
        }
        startFadeOut();
      } else if (remaining <= 0) {
        setSleepTimerRemaining(0);
        if (sleepTimerRef.current) {
          clearInterval(sleepTimerRef.current);
          sleepTimerRef.current = null;
        }
      } else {
        setSleepTimerRemaining(remaining);
      }
    }, 1000);
  }

  function onPlaybackStatusUpdate(status: AVPlaybackStatus) {
    if (status.isLoaded) {
      setProgress(status.positionMillis);
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);

      if (
        !subscriptionRef.current &&
        status.positionMillis >= FREE_PREVIEW_MS &&
        status.isPlaying &&
        !previewEndedRef.current
      ) {
        previewEndedRef.current = true;
        setIsPlaying(false);
        setPreviewEnded(true);
        const trackId = currentTrackIdRef.current;
        if (trackId) {
          const newSet = new Set(playedTrackIdsRef.current);
          newSet.add(trackId);
          playedTrackIdsRef.current = newSet;
          setPlayedTrackIds(new Set(newSet));
          if (userIdRef.current) {
            persistPlayedTracks(userIdRef.current, newSet);
          }
        }
        const soundToStop = soundRef.current;
        if (soundToStop) {
          (async () => {
            try {
              await soundToStop.stopAsync();
              await soundToStop.unloadAsync();
              if (soundRef.current === soundToStop) {
                soundRef.current = null;
              }
            } catch (err) {
              console.warn(
                "[Player] Failed to stop audio after preview ended:",
                err,
              );
            }
          })();
        }
        return;
      }

      if (status.didJustFinish) {
        if (subscriptionRef.current) {
          if (loopModeRef.current === "one") {
            if (soundRef.current) {
              soundRef.current.replayAsync();
            }
          } else if (queueRef.current.length > 1) {
            const nextIdx = queueIndexRef.current + 1;
            if (nextIdx < queueRef.current.length) {
              playTrackInternal(
                queueRef.current[nextIdx],
                queueRef.current,
                nextIdx,
              );
            } else if (loopModeRef.current === "all") {
              playTrackInternal(queueRef.current[0], queueRef.current, 0);
            } else {
              setIsPlaying(false);
              setProgress(0);
            }
          } else {
            if (soundRef.current) {
              soundRef.current.replayAsync();
            }
          }
        } else {
          setIsPlaying(false);
          setProgress(0);
        }
      }
    }
  }

  async function preflightAudioUrl(url: string, trackTitle: string): Promise<{ ok: true } | { ok: false; message: string; retryable: boolean }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const resp = await fetch(url, { method: "HEAD", signal: controller.signal });
      if (!resp.ok) {
        const retryable = isRetryableStatus(resp.status);
        return { ok: false, message: `Server returned ${resp.status} for '${trackTitle}'`, retryable };
      }
      return { ok: true };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { ok: false, message: `Request timed out loading '${trackTitle}'`, retryable: true };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: `Network error loading '${trackTitle}': ${msg}`, retryable: true };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function prebufferTrack(track: Track): void {
    if (currentTrackIdRef.current === track.id) return;
    const audioUrl = resolveAudioUrl(track.fileUrl);

    if (Platform.OS === "web") {
      if (typeof document === "undefined") return;
      if (prebufferedWebAudioRef.current?.url === audioUrl) return;
      try {
        // Tear down any existing prebuffered element to avoid concurrent downloads
        if (prebufferedWebAudioRef.current) {
          const old = prebufferedWebAudioRef.current.audio;
          old.pause();
          old.src = "";
          old.load();
          prebufferedWebAudioRef.current = null;
        }
        const audio = document.createElement("audio") as HTMLAudioElement;
        audio.preload = "auto";
        audio.src = audioUrl;
        audio.load();
        prebufferedWebAudioRef.current = { audio, url: audioUrl };
      } catch {
        // Prebuffer failures are silent — don't affect playback
      }
    } else {
      if (prebufferedTrackIdRef.current === track.id) return;
      const gen = ++prebufferGenRef.current;
      void (async () => {
        try {
          if (prebufferedSoundRef.current) {
            await prebufferedSoundRef.current.unloadAsync();
            prebufferedSoundRef.current = null;
            prebufferedTrackIdRef.current = null;
          }
          if (prebufferGenRef.current !== gen) return;
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
          });
          if (prebufferGenRef.current !== gen) return;
          const { sound } = await Audio.Sound.createAsync(
            { uri: audioUrl },
            { shouldPlay: false },
          );
          if (prebufferGenRef.current !== gen) {
            sound.unloadAsync().catch(() => {});
            return;
          }
          prebufferedSoundRef.current = sound;
          prebufferedTrackIdRef.current = track.id;
        } catch {
          // Prebuffer failures are silent — don't affect playback
        }
      })();
    }
  }

  async function attemptWebPlay(
    track: Track,
    audioUrl: string,
    gen: number,
    isRetry: boolean,
  ): Promise<void> {
    if (playGenRef.current !== gen) return;

    // Reuse a pre-buffered audio element if one was prepared for this URL
    const prebuffered = prebufferedWebAudioRef.current;
    prebufferedWebAudioRef.current = null;

    destroyWebAudio();

    let audio: HTMLAudioElement;
    if (prebuffered && prebuffered.url === audioUrl) {
      audio = prebuffered.audio;
    } else {
      // Discard unmatched prebuffered element cleanly
      if (prebuffered) {
        try { prebuffered.audio.pause(); prebuffered.audio.src = ""; prebuffered.audio.load(); } catch {}
      }
      audio = document.createElement("audio") as HTMLAudioElement;
      audio.preload = "auto";
      audio.src = audioUrl;
    }
    webAudioRef.current = audio;

    const onTimeUpdate = () => {
      if (webAudioRef.current !== audio) return;
      const posMs = audio.currentTime * 1000;
      const durMs = isFinite(audio.duration) ? audio.duration * 1000 : 0;
      setProgress(posMs);
      if (durMs > 0) setDuration(durMs);

      if (
        !subscriptionRef.current &&
        posMs >= FREE_PREVIEW_MS &&
        !audio.paused &&
        !previewEndedRef.current
      ) {
        previewEndedRef.current = true;
        setIsPlaying(false);
        setPreviewEnded(true);
        const trackId = currentTrackIdRef.current;
        if (trackId) {
          const newSet = new Set(playedTrackIdsRef.current);
          newSet.add(trackId);
          playedTrackIdsRef.current = newSet;
          setPlayedTrackIds(new Set(newSet));
          if (userIdRef.current) {
            persistPlayedTracks(userIdRef.current, newSet);
          }
        }
        audio.pause();
      }
    };

    const onEnded = () => {
      if (webAudioRef.current !== audio) return;
      if (subscriptionRef.current) {
        if (loopModeRef.current === "one" || queueRef.current.length <= 1) {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } else {
          const nextIdx = queueIndexRef.current + 1;
          if (nextIdx < queueRef.current.length) {
            playTrackInternal(
              queueRef.current[nextIdx],
              queueRef.current,
              nextIdx,
            );
          } else if (loopModeRef.current === "all") {
            playTrackInternal(queueRef.current[0], queueRef.current, 0);
          } else {
            setIsPlaying(false);
            setProgress(0);
          }
        }
      } else {
        setIsPlaying(false);
        setProgress(0);
      }
    };

    const onError = () => {
      if (webAudioRef.current !== audio) return;
      const err = audio.error;
      if (err && err.code === 1) return;

      const codeNames: Record<number, string> = {
        2: "MEDIA_ERR_NETWORK",
        3: "MEDIA_ERR_DECODE",
        4: "MEDIA_ERR_SRC_NOT_SUPPORTED",
      };
      const codeName = err ? (codeNames[err.code] || `code=${err.code}`) : "unknown";
      const detail = err?.message ? `: ${err.message}` : "";
      const logMsg = `[Player] Audio element error for '${track.title}': ${codeName}${detail} (src: ${audioUrl})`;
      console.error(logMsg);
      setAudioError(`Could not play '${track.title}' (${codeName})`);
      setIsPlaying(false);
      setIsLoading(false);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    webAudioListenersRef.current = {
      el: audio,
      handlers: { timeupdate: onTimeUpdate, ended: onEnded, error: onError },
    };

    // On retry attempts there is no active user gesture, so run a preflight
    // check first to surface network errors with a clear message.
    if (isRetry) {
      const preflight = await preflightAudioUrl(audioUrl, track.title);
      if (playGenRef.current !== gen) return;
      if (!preflight.ok) {
        console.error(`[Player] Pre-flight failed for '${track.title}' (url=${audioUrl}): ${preflight.message}`);
        setAudioError(preflight.message);
        setIsPlaying(false);
        setIsLoading(false);
        return;
      }
    }

    // Call play() immediately — no network awaits before this on the initial
    // path so Safari's gesture chain remains intact.
    try {
      await audio.play();
      if (playGenRef.current !== gen) return;
      setAudioBlocked(false);
      setIsPlaying(true);
      setIsLoading(false);
    } catch (playErr: unknown) {
      if (playGenRef.current !== gen) return;
      if (playErr instanceof Error && playErr.name === "NotAllowedError") {
        setAudioBlocked(true);
        setIsLoading(false);
        setIsPlaying(false);
      } else if (playErr instanceof Error && playErr.name === "AbortError") {
        setIsLoading(false);
        setIsPlaying(false);
      } else {
        const errName = playErr instanceof Error ? playErr.name : "Unknown";
        const errMsg = playErr instanceof Error ? playErr.message : String(playErr);
        console.error(`[Player] play() failed for '${track.title}' (url=${audioUrl}): ${errName}: ${errMsg}`);

        if (!isRetry) {
          console.warn(`[Player] Retrying '${track.title}' in ${RETRY_DELAY_MS}ms`);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          return attemptWebPlay(track, audioUrl, gen, true);
        }

        setAudioError(`Could not play '${track.title}': ${errName}`);
        setIsPlaying(false);
        setIsLoading(false);
      }
    }
  }

  async function playTrackInternal(
    track: Track,
    trackQueue: Track[],
    index: number,
  ) {
    try {
      setCurrentTrack(track);
      currentTrackIdRef.current = track.id;
      setQueue(trackQueue);
      setQueueIndex(index);
      queueRef.current = trackQueue;
      queueIndexRef.current = index;
      setIsPlayerVisible(true);
      setIsLoading(true);
      setIsPlaying(false);
      setPreviewEnded(false);
      setAudioError(null);
      setAudioBlocked(false);
      previewEndedRef.current = false;

      if (Platform.OS === "web") {
        const gen = ++playGenRef.current;
        const audioUrl = resolveAudioUrl(track.fileUrl);
        await attemptWebPlay(track, audioUrl, gen, false);
      } else {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }

        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });

        const shouldLoopSingle =
          hasActiveSubscription &&
          (loopModeRef.current === "one" || trackQueue.length <= 1);

        let sound: Audio.Sound;
        let usedPrebuffer = false;

        if (prebufferedSoundRef.current && prebufferedTrackIdRef.current === track.id) {
          const preSound = prebufferedSoundRef.current;
          prebufferedSoundRef.current = null;
          prebufferedTrackIdRef.current = null;

          try {
            const status = await preSound.getStatusAsync();
            if (status.isLoaded && !("error" in status && status.error)) {
              preSound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
              await preSound.setIsLoopingAsync(shouldLoopSingle);
              await preSound.playAsync();
              sound = preSound;
              usedPrebuffer = true;
            } else {
              console.warn("[Player] Prebuffered sound not loaded, falling back to fresh load");
              preSound.unloadAsync().catch(() => {});
            }
          } catch (prebufErr) {
            console.warn("[Player] Prebuffered sound failed, falling back to fresh load:", prebufErr);
            preSound.unloadAsync().catch(() => {});
          }
        } else if (prebufferedSoundRef.current) {
          prebufferedSoundRef.current.unloadAsync().catch(() => {});
          prebufferedSoundRef.current = null;
          prebufferedTrackIdRef.current = null;
        }

        if (!usedPrebuffer) {
          const result = await Audio.Sound.createAsync(
            { uri: resolveAudioUrl(track.fileUrl) },
            { shouldPlay: true, isLooping: shouldLoopSingle },
            onPlaybackStatusUpdate,
          );
          sound = result.sound;
        }

        soundRef.current = sound;
        setIsPlaying(true);
        setIsLoading(false);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Player] playTrackInternal failed for '${track.title}': ${errMsg}`);
      setAudioError(`Could not play '${track.title}'`);
      setIsPlaying(false);
      setIsLoading(false);
    }
  }

  async function playTrack(track: Track, trackQueue?: Track[]) {
    if (!subscriptionRef.current && playedTrackIdsRef.current.has(track.id))
      return;
    const q = trackQueue || [track];
    const index = q.findIndex((t) => t.id === track.id);
    await playTrackInternal(track, q, index >= 0 ? index : 0);
  }

  async function playNext() {
    const currentQueue = queueRef.current;
    const currentIdx = queueIndexRef.current;
    if (currentQueue.length <= 1) return;
    let nextIdx = currentIdx + 1;
    if (nextIdx >= currentQueue.length) {
      if (loopModeRef.current === "all") {
        nextIdx = 0;
      } else {
        return;
      }
    }
    const nextTrack = currentQueue[nextIdx];
    if (!subscriptionRef.current && playedTrackIdsRef.current.has(nextTrack.id))
      return;
    await playTrackInternal(nextTrack, currentQueue, nextIdx);
  }

  async function playPrevious() {
    const currentQueue = queueRef.current;
    const currentIdx = queueIndexRef.current;
    if (currentQueue.length <= 1) return;
    if (progress > 3000) {
      await seek(0);
      return;
    }
    let prevIdx = currentIdx - 1;
    if (prevIdx < 0) {
      if (loopModeRef.current === "all") {
        prevIdx = currentQueue.length - 1;
      } else {
        await seek(0);
        return;
      }
    }
    const prevTrack = currentQueue[prevIdx];
    if (!subscriptionRef.current && playedTrackIdsRef.current.has(prevTrack.id))
      return;
    await playTrackInternal(prevTrack, currentQueue, prevIdx);
  }

  async function pause() {
    if (Platform.OS === "web") {
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        setIsPlaying(false);
      }
    } else {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      }
    }
  }

  async function resume() {
    if (previewEnded && !subscriptionRef.current) {
      return;
    }
    if (Platform.OS === "web") {
      if (webAudioRef.current) {
        try {
          const ctx = getSharedAudioContext();
          if (ctx && ctx.state === "suspended") {
            await ctx.resume();
          }
          await webAudioRef.current.play();
          setIsPlaying(true);
          setAudioBlocked(false);
          setAudioError(null);
        } catch (err: unknown) {
          if (err instanceof Error && err.name === "NotAllowedError") {
            setAudioBlocked(true);
          } else if (err instanceof Error && err.name === "AbortError") {
            // play() was interrupted by a concurrent track change — not a real error
          } else {
            const errName = err instanceof Error ? err.name : "Unknown";
            console.warn(`[Player] Web resume failed: ${errName}:`, err);
            setAudioError(`Failed to resume audio (${errName})`);
          }
        }
      }
    } else {
      if (soundRef.current) {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    }
  }

  async function stop() {
    playGenRef.current++;
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    setSleepTimerState(null);
    setSleepTimerRemaining(0);
    setIsFadingOut(false);
    setPreviewEnded(false);

    if (Platform.OS === "web") {
      destroyWebAudio();
      if (prebufferedWebAudioRef.current) {
        try {
          prebufferedWebAudioRef.current.audio.pause();
          prebufferedWebAudioRef.current.audio.src = "";
          prebufferedWebAudioRef.current.audio.load();
        } catch {}
        prebufferedWebAudioRef.current = null;
      }
    } else {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (prebufferedSoundRef.current) {
        prebufferedSoundRef.current.unloadAsync().catch(() => {});
        prebufferedSoundRef.current = null;
        prebufferedTrackIdRef.current = null;
      }
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setIsPlayerVisible(false);
  }

  async function seek(position: number) {
    if (!subscriptionRef.current && position >= FREE_PREVIEW_MS) {
      return;
    }
    if (Platform.OS === "web") {
      if (webAudioRef.current) {
        webAudioRef.current.currentTime = position / 1000;
      }
    } else {
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(position);
      }
    }
  }

  function showPlayer() {
    setIsPlayerVisible(true);
  }

  function hidePlayer() {
    setIsPlayerVisible(false);
  }

  function dismissPreviewEnded() {
    setPreviewEnded(false);
  }

  async function resumeBlockedAudio() {
    if (Platform.OS === "web" && webAudioRef.current) {
      try {
        const ctx = getSharedAudioContext();
        if (ctx && ctx.state === "suspended") {
          await ctx.resume();
        }
        await webAudioRef.current.play();
        setAudioBlocked(false);
        setAudioError(null);
        setIsPlaying(true);
        setIsLoading(false);
      } catch (err: unknown) {
        const errName = err instanceof Error ? err.name : "Unknown";
        if (errName !== "NotAllowedError") {
          setAudioError(`Failed to play audio (${errName})`);
        }
        console.error(`[Player] resumeBlockedAudio failed: ${errName}:`, err);
      }
    }
  }

  const hasNext =
    queue.length > 1 && (queueIndex < queue.length - 1 || loopMode === "all");
  const hasPrevious = queue.length > 1;

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isLoading,
        progress,
        duration,
        loopMode,
        isPlayerVisible,
        sleepTimer,
        sleepTimerRemaining,
        isFadingOut,
        hasActiveSubscription,
        previewEnded,
        queue,
        queueIndex,
        hasNext,
        hasPrevious,
        playedTrackIds,
        isTrackPlayed,
        playTrack,
        prebufferTrack,
        playNext,
        playPrevious,
        pause,
        resume,
        stop,
        seek,
        setLoopMode,
        setSleepTimer,
        showPlayer,
        hidePlayer,
        dismissPreviewEnded,
        audioBlocked,
        audioError,
        resumeBlockedAudio,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
