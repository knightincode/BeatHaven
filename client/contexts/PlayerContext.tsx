import React, { createContext, useContext, useState, useRef, ReactNode, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";

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
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const FADE_DURATION = 30000;
const FADE_INTERVAL = 500;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { hasActiveSubscription, user } = useAuth();
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  useEffect(() => {
    subscriptionRef.current = hasActiveSubscription;
  }, [hasActiveSubscription]);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    loopModeRef.current = loopMode;
  }, [loopMode]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);

  useEffect(() => {
    if (user?.id) {
      loadPlayedTracks(user.id);
    } else {
      const empty = new Set<string>();
      playedTrackIdsRef.current = empty;
      setPlayedTrackIds(empty);
    }
  }, [user?.id]);

  useEffect(() => {
    if (hasActiveSubscription && user?.id) {
      clearPlayedTracks(user.id);
    }
  }, [hasActiveSubscription]);

  async function loadPlayedTracks(userId: string) {
    try {
      const stored = await AsyncStorage.getItem(`played_tracks_${userId}`);
      if (stored) {
        const ids: string[] = JSON.parse(stored);
        const set = new Set(ids);
        playedTrackIdsRef.current = set;
        setPlayedTrackIds(new Set(set));
      }
    } catch (err) {
      console.warn("[Player] Failed to load played tracks:", err);
    }
  }

  async function persistPlayedTracks(userId: string, ids: Set<string>) {
    try {
      await AsyncStorage.setItem(`played_tracks_${userId}`, JSON.stringify([...ids]));
    } catch (err) {
      console.warn("[Player] Failed to persist played tracks:", err);
    }
  }

  async function clearPlayedTracks(userId: string) {
    try {
      await AsyncStorage.removeItem(`played_tracks_${userId}`);
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

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
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
    if (!soundRef.current) return;
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
        if (soundRef.current) {
          await soundRef.current.pauseAsync();
          await soundRef.current.setVolumeAsync(1.0);
        }
        setIsPlaying(false);
        setIsFadingOut(false);
        setSleepTimerState(null);
        setSleepTimerRemaining(0);
      } else if (soundRef.current) {
        await soundRef.current.setVolumeAsync(Math.max(0, currentVolume));
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
      if (soundRef.current) {
        soundRef.current.setVolumeAsync(1.0);
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

      if (!subscriptionRef.current && status.positionMillis >= FREE_PREVIEW_MS && status.isPlaying) {
        if (soundRef.current) {
          soundRef.current.pauseAsync();
        }
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
              playTrackInternal(queueRef.current[nextIdx], queueRef.current, nextIdx);
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

  async function playTrackInternal(track: Track, trackQueue: Track[], index: number) {
    try {
      setCurrentTrack(track);
      currentTrackIdRef.current = track.id;
      setQueue(trackQueue);
      setQueueIndex(index);
      queueRef.current = trackQueue;
      queueIndexRef.current = index;
      setIsPlayerVisible(true);
      setIsLoading(true);
      setPreviewEnded(false);
      
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      let audioUri = track.fileUrl;

      const shouldLoopSingle = hasActiveSubscription && (loopModeRef.current === "one" || trackQueue.length <= 1);

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, isLooping: shouldLoopSingle },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setIsPlaying(true);
      setIsLoading(false);
    } catch (error) {
      console.error("Error playing track:", error);
      setIsPlaying(false);
      setIsLoading(false);
    }
  }

  async function playTrack(track: Track, trackQueue?: Track[]) {
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
    await playTrackInternal(currentQueue[nextIdx], currentQueue, nextIdx);
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
    await playTrackInternal(currentQueue[prevIdx], currentQueue, prevIdx);
  }

  async function pause() {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    }
  }

  async function resume() {
    if (previewEnded && !subscriptionRef.current) {
      return;
    }
    if (soundRef.current) {
      await soundRef.current.playAsync();
      setIsPlaying(true);
    }
  }

  async function stop() {
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

    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
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
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(position);
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

  const hasNext = queue.length > 1 && (queueIndex < queue.length - 1 || loopMode === "all");
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
