import React, { createContext, useContext, useState, useRef, ReactNode, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import { useAuth } from "@/contexts/AuthContext";
import { getLocalUri } from "@/lib/downloadManager";

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

const FREE_PREVIEW_MS = 2 * 60 * 1000;

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
  playTrack: (track: Track) => Promise<void>;
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
  const { hasActiveSubscription } = useAuth();
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
  const soundRef = useRef<Audio.Sound | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sleepTimerEndRef = useRef<number>(0);
  const subscriptionRef = useRef(hasActiveSubscription);
  const loopModeRef = useRef(loopMode);

  useEffect(() => {
    subscriptionRef.current = hasActiveSubscription;
  }, [hasActiveSubscription]);

  useEffect(() => {
    loopModeRef.current = loopMode;
  }, [loopMode]);

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
        return;
      }

      if (status.didJustFinish) {
        if (subscriptionRef.current) {
          if (soundRef.current) {
            soundRef.current.replayAsync();
          }
        } else {
          setIsPlaying(false);
          setProgress(0);
        }
      }
    }
  }

  async function playTrack(track: Track) {
    try {
      setCurrentTrack(track);
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
      if (Platform.OS !== "web") {
        const localUri = await getLocalUri(track.id);
        if (localUri) {
          audioUri = localUri;
        }
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, isLooping: hasActiveSubscription },
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
        playTrack,
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
