import React, { createContext, useContext, useState, useRef, ReactNode, useEffect, useCallback } from "react";
import { Audio, AVPlaybackStatus } from "expo-av";

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
  playTrack: (track: Track) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (position: number) => Promise<void>;
  setLoopMode: (mode: LoopMode) => void;
  setSleepTimer: (minutes: SleepTimerOption) => void;
  showPlayer: () => void;
  hidePlayer: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const FADE_DURATION = 30000;
const FADE_INTERVAL = 500;

export function PlayerProvider({ children }: { children: ReactNode }) {
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
  const soundRef = useRef<Audio.Sound | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sleepTimerEndRef = useRef<number>(0);

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

      if (status.didJustFinish) {
        if (loopMode === "one") {
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
      
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: track.fileUrl },
        { shouldPlay: true },
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
        playTrack,
        pause,
        resume,
        stop,
        seek,
        setLoopMode,
        setSleepTimer,
        showPlayer,
        hidePlayer,
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
