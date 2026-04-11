import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface NoiseColor {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  active: boolean;
  volume: number;
  loading: boolean;
}

const NOISE_COLORS: NoiseColor[] = [
  { id: "white", name: "White", subtitle: "Bright hiss, TV static", color: "#E0E0E0", active: false, volume: 0.5, loading: false },
  { id: "pink", name: "Pink", subtitle: "Balanced, steady rainfall", color: "#F48FB1", active: false, volume: 0.5, loading: false },
  { id: "brown", name: "Brown", subtitle: "Deep rumble, low waterfall", color: "#8D6E63", active: false, volume: 0.5, loading: false },
  { id: "blue", name: "Blue", subtitle: "Shrill, high-pitched hiss", color: "#64B5F6", active: false, volume: 0.5, loading: false },
  { id: "violet", name: "Violet", subtitle: "Sharp, piercing steam", color: "#CE93D8", active: false, volume: 0.5, loading: false },
  { id: "grey", name: "Grey", subtitle: "Perceptually even loudness", color: "#9E9E9E", active: false, volume: 0.5, loading: false },
  { id: "green", name: "Green", subtitle: "Mid-range, lush forest", color: "#81C784", active: false, volume: 0.5, loading: false },
  { id: "orange", name: "Orange", subtitle: "Clashing, out-of-tune", color: "#FFB74D", active: false, volume: 0.5, loading: false },
  { id: "red", name: "Red", subtitle: "Extra deep bass emphasis", color: "#EF5350", active: false, volume: 0.5, loading: false },
  { id: "black", name: "Black", subtitle: "Near silence, deep space", color: "#424242", active: false, volume: 0.5, loading: false },
  { id: "speech", name: "Speech", subtitle: "Blocks nearby voices", color: "#4DD0E1", active: false, volume: 0.5, loading: false },
  { id: "modulated", name: "Modulated", subtitle: "Rhythmic breathing swell", color: "#7986CB", active: false, volume: 0.5, loading: false },
  { id: "dither", name: "Dither", subtitle: "Ultra-subtle, fine grain", color: "#A1887F", active: false, volume: 0.5, loading: false },
];

interface AmbientMixerProps {
  visible: boolean;
  onClose: () => void;
  accentColor?: string;
}

const NATIVE_SAMPLE_RATE = 44100;
const NATIVE_DURATION_SECS = 10;

function generateNoiseSamples(type: string, sampleRate: number, durationSecs: number): Float32Array {
  const bufferSize = Math.floor(sampleRate * durationSecs);
  const data = new Float32Array(bufferSize);
  const sr = sampleRate;

  switch (type) {
    case "white": {
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      break;
    }
    case "pink":
    case "green":
    case "speech": {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
      break;
    }
    case "brown": {
      let prev = 0;
      for (let i = 0; i < bufferSize; i++) {
        const w = Math.random() * 2 - 1;
        prev = (prev + 0.02 * w) / 1.02;
        data[i] = prev * 3.5;
      }
      break;
    }
    case "blue": {
      let prev = 0;
      for (let i = 0; i < bufferSize; i++) {
        const w = Math.random() * 2 - 1;
        data[i] = w - prev;
        prev = w;
      }
      break;
    }
    case "violet": {
      let p1 = 0, p2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const w = Math.random() * 2 - 1;
        data[i] = w - 2 * p1 + p2;
        p2 = p1;
        p1 = w;
      }
      break;
    }
    case "grey": {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
        const freq = (i % sr) / sr;
        const isoWeight = 1.0 + 0.4 * Math.sin(freq * Math.PI * 2 * 3.5);
        data[i] = pink * isoWeight;
      }
      break;
    }
    case "orange": {
      const numOsc = 12;
      const freqs: number[] = [];
      const baseFreqs = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00];
      for (let k = 0; k < numOsc; k++) {
        freqs.push(baseFreqs[k % baseFreqs.length] * (1 + (Math.random() * 0.08 - 0.04)));
      }
      for (let i = 0; i < bufferSize; i++) {
        let sum = 0;
        const t = i / sr;
        for (let k = 0; k < numOsc; k++) {
          sum += Math.sin(2 * Math.PI * freqs[k] * t) * 0.1;
        }
        sum += (Math.random() * 2 - 1) * 0.15;
        data[i] = sum;
      }
      break;
    }
    case "red": {
      let prev = 0;
      for (let i = 0; i < bufferSize; i++) {
        const w = Math.random() * 2 - 1;
        prev = (prev + 0.01 * w) / 1.01;
        data[i] = prev * 5;
      }
      break;
    }
    case "black": {
      for (let i = 0; i < bufferSize; i++) {
        const r1 = Math.random();
        const r2 = Math.random();
        const g = Math.sqrt(-2 * Math.log(r1 + 1e-10)) * Math.cos(2 * Math.PI * r2);
        data[i] = g * 0.003;
      }
      break;
    }
    case "modulated": {
      let prev = 0;
      for (let i = 0; i < bufferSize; i++) {
        const w = Math.random() * 2 - 1;
        prev = (prev + 0.02 * w) / 1.02;
        const t = i / sr;
        const mod = Math.sin(2 * Math.PI * 0.1 * t) * 0.4 + 0.6;
        data[i] = prev * 3.5 * mod;
      }
      break;
    }
    case "dither": {
      for (let i = 0; i < bufferSize; i++) {
        const r1 = Math.random();
        const r2 = Math.random();
        data[i] = (r1 + r2 - 1) * 0.05;
      }
      break;
    }
    default: {
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.2;
    }
  }

  return data;
}

function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, Math.round(s * 32767), true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function AmbientMixer({ visible, onClose, accentColor = Colors.dark.link }: AmbientMixerProps) {
  const insets = useSafeAreaInsets();
  const [layers, setLayers] = useState<NoiseColor[]>(NOISE_COLORS);
  const audioContextRef = useRef<any>(null);
  const webNodesRef = useRef<Record<string, { source: any; gain: any }>>({});
  const nativeSoundsRef = useRef<Record<string, Audio.Sound>>({});
  const inFlightRef = useRef<Record<string, boolean>>({});
  const layersRef = useRef<NoiseColor[]>(NOISE_COLORS);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  const getAudioContext = useCallback(() => {
    if (Platform.OS !== "web") return null;
    if (!audioContextRef.current) {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
      }
    }
    return audioContextRef.current;
  }, []);

  function generateWhiteNoise(ctx: any, bufferSize: number): Float32Array {
    const data = new Float32Array(bufferSize);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return data;
  }

  function generatePinkNoise(ctx: any, bufferSize: number): Float32Array {
    const data = new Float32Array(bufferSize);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return data;
  }

  function createNoiseBuffer(ctx: any, type: string): any {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const sr = ctx.sampleRate;

    switch (type) {
      case "white": {
        const gen = generateWhiteNoise(ctx, bufferSize);
        for (let i = 0; i < bufferSize; i++) data[i] = gen[i];
        break;
      }
      case "pink": {
        const gen = generatePinkNoise(ctx, bufferSize);
        for (let i = 0; i < bufferSize; i++) data[i] = gen[i];
        break;
      }
      case "brown": {
        let prev = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          prev = (prev + 0.02 * white) / 1.02;
          data[i] = prev * 3.5;
        }
        break;
      }
      case "blue": {
        let prev = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = white - prev;
          prev = white;
        }
        break;
      }
      case "violet": {
        let prev1 = 0, prev2 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = white - 2 * prev1 + prev2;
          prev2 = prev1;
          prev1 = white;
        }
        break;
      }
      case "grey": {
        const pink = generatePinkNoise(ctx, bufferSize);
        for (let i = 0; i < bufferSize; i++) {
          const freq = (i % sr) / sr;
          const isoWeight = 1.0 + 0.4 * Math.sin(freq * Math.PI * 2 * 3.5);
          data[i] = pink[i] * isoWeight;
        }
        break;
      }
      case "green": {
        const pink = generatePinkNoise(ctx, bufferSize);
        for (let i = 0; i < bufferSize; i++) data[i] = pink[i];
        break;
      }
      case "orange": {
        const numOsc = 12;
        const freqs: number[] = [];
        const baseFreqs = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00];
        for (let k = 0; k < numOsc; k++) {
          freqs.push(baseFreqs[k % baseFreqs.length] * (1 + (Math.random() * 0.08 - 0.04)));
        }
        for (let i = 0; i < bufferSize; i++) {
          let sum = 0;
          const t = i / sr;
          for (let k = 0; k < numOsc; k++) {
            sum += Math.sin(2 * Math.PI * freqs[k] * t) * 0.1;
          }
          sum += (Math.random() * 2 - 1) * 0.15;
          data[i] = sum;
        }
        break;
      }
      case "red": {
        let prev = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          prev = (prev + 0.01 * white) / 1.01;
          data[i] = prev * 5;
        }
        break;
      }
      case "black": {
        for (let i = 0; i < bufferSize; i++) {
          const r1 = Math.random();
          const r2 = Math.random();
          const gaussian = Math.sqrt(-2 * Math.log(r1 + 1e-10)) * Math.cos(2 * Math.PI * r2);
          data[i] = gaussian * 0.003;
        }
        break;
      }
      case "speech": {
        const pink = generatePinkNoise(ctx, bufferSize);
        for (let i = 0; i < bufferSize; i++) data[i] = pink[i];
        break;
      }
      case "modulated": {
        let prev = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          prev = (prev + 0.02 * white) / 1.02;
          const t = i / sr;
          const mod = Math.sin(2 * Math.PI * 0.1 * t) * 0.4 + 0.6;
          data[i] = prev * 3.5 * mod;
        }
        break;
      }
      case "dither": {
        for (let i = 0; i < bufferSize; i++) {
          const r1 = Math.random();
          const r2 = Math.random();
          data[i] = (r1 + r2 - 1) * 0.05;
        }
        break;
      }
      default: {
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.2;
      }
    }

    return buffer;
  }

  function getFilterConfig(type: string): { filterType: BiquadFilterType; freq: number; q: number } | null {
    switch (type) {
      case "green":
        return { filterType: "bandpass", freq: 1000, q: 0.5 };
      case "speech":
        return { filterType: "bandpass", freq: 1500, q: 0.4 };
      case "red":
        return { filterType: "lowpass", freq: 200, q: 0.7 };
      default:
        return null;
    }
  }

  function startWebLayer(layerId: string, volume: number) {
    const ctx = getAudioContext();
    if (!ctx) return;

    stopWebLayer(layerId);

    const audioBuffer = createNoiseBuffer(ctx, layerId);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    const filterCfg = getFilterConfig(layerId);
    if (filterCfg) {
      const filter = ctx.createBiquadFilter();
      filter.type = filterCfg.filterType;
      filter.frequency.value = filterCfg.freq;
      filter.Q.value = filterCfg.q;
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.connect(gain);
    }

    gain.connect(ctx.destination);
    source.start();

    webNodesRef.current[layerId] = { source, gain };
  }

  function stopWebLayer(layerId: string) {
    const node = webNodesRef.current[layerId];
    if (node) {
      try {
        node.source.stop();
        node.source.disconnect();
        node.gain.disconnect();
      } catch (e) {}
      delete webNodesRef.current[layerId];
    }
  }

  async function getNativeCacheUri(layerId: string): Promise<string> {
    const cacheUri = `${FileSystem.cacheDirectory}bh_noise_${layerId}.wav`;
    const info = await FileSystem.getInfoAsync(cacheUri);
    if (!info.exists) {
      const samples = generateNoiseSamples(layerId, NATIVE_SAMPLE_RATE, NATIVE_DURATION_SECS);
      const wavBytes = encodeWav(samples, NATIVE_SAMPLE_RATE);
      const base64 = uint8ArrayToBase64(wavBytes);
      await FileSystem.writeAsStringAsync(cacheUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    return cacheUri;
  }

  async function startNativeLayer(layerId: string, volume: number) {
    await stopNativeLayer(layerId);

    inFlightRef.current[layerId] = true;

    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, loading: true } : l))
    );

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      if (!inFlightRef.current[layerId]) {
        setLayers((prev) =>
          prev.map((l) => (l.id === layerId ? { ...l, loading: false, active: false } : l))
        );
        return;
      }

      const cacheUri = await getNativeCacheUri(layerId);

      if (!inFlightRef.current[layerId]) {
        setLayers((prev) =>
          prev.map((l) => (l.id === layerId ? { ...l, loading: false, active: false } : l))
        );
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: cacheUri },
        { shouldPlay: true, isLooping: true, volume }
      );

      if (!inFlightRef.current[layerId]) {
        sound.unloadAsync().catch(() => {});
        setLayers((prev) =>
          prev.map((l) => (l.id === layerId ? { ...l, loading: false, active: false } : l))
        );
        return;
      }

      nativeSoundsRef.current[layerId] = sound;
      setLayers((prev) =>
        prev.map((l) => (l.id === layerId ? { ...l, loading: false } : l))
      );
    } catch (error) {
      console.error(`[AmbientMixer] Failed to start native layer ${layerId}:`, error);
      inFlightRef.current[layerId] = false;
      setLayers((prev) =>
        prev.map((l) => (l.id === layerId ? { ...l, loading: false, active: false } : l))
      );
    }
  }

  async function stopNativeLayer(layerId: string) {
    inFlightRef.current[layerId] = false;
    const sound = nativeSoundsRef.current[layerId];
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch (e) {}
      delete nativeSoundsRef.current[layerId];
    }
  }

  function startLayer(layerId: string, volume: number) {
    if (Platform.OS === "web") {
      startWebLayer(layerId, volume);
    } else {
      startNativeLayer(layerId, volume);
    }
  }

  function stopLayer(layerId: string) {
    if (Platform.OS === "web") {
      stopWebLayer(layerId);
    } else {
      stopNativeLayer(layerId);
    }
  }

  function restartActiveLayers() {
    layersRef.current.forEach((layer) => {
      if (!layer.active) return;
      const alreadyRunning =
        Platform.OS === "web"
          ? !!webNodesRef.current[layer.id]
          : !!nativeSoundsRef.current[layer.id];
      if (!alreadyRunning) {
        startLayer(layer.id, layer.volume);
      }
    });
  }

  useEffect(() => {
    if (visible) {
      restartActiveLayers();
    } else if (Platform.OS !== "web") {
      const activeIds = Object.keys(nativeSoundsRef.current);
      const inFlightIds = Object.keys(inFlightRef.current).filter(
        (id) => inFlightRef.current[id]
      );
      const allIds = Array.from(new Set([...activeIds, ...inFlightIds]));
      allIds.forEach((id) => {
        inFlightRef.current[id] = false;
      });
      Promise.all(allIds.map((id) => stopNativeLayer(id))).catch(() => {});
      setLayers((prev) =>
        prev.map((l) => ({ ...l, active: false, loading: false }))
      );
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      Object.keys(webNodesRef.current).forEach((id) => stopWebLayer(id));
      Object.keys(nativeSoundsRef.current).forEach((id) => stopNativeLayer(id));
    };
  }, []);

  function toggleLayer(layerId: string) {
    const layer = layersRef.current.find((l) => l.id === layerId);
    if (!layer || layer.loading) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const newActive = !layer.active;

    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, active: newActive } : l))
    );

    if (newActive) {
      startLayer(layerId, layer.volume);
    } else {
      stopLayer(layerId);
    }
  }

  function setLayerVolume(layerId: string, volume: number) {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId) {
          if (Platform.OS === "web") {
            const node = webNodesRef.current[layerId];
            if (node) {
              node.gain.gain.value = volume;
            }
          } else {
            const sound = nativeSoundsRef.current[layerId];
            if (sound) {
              sound.setVolumeAsync(volume).catch(() => {});
            }
          }
          return { ...l, volume };
        }
        return l;
      })
    );
  }

  const activeLayers = layers.filter((l) => l.active).length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.header}>
            <ThemedText type="h4">Noise Color Mixer</ThemedText>
            <Pressable onPress={onClose} testID="button-close-mixer">
              <Feather name="x" size={24} color={Colors.dark.text} />
            </Pressable>
          </View>
          <ThemedText style={styles.description}>
            Layer noise colors over your binaural beats
          </ThemedText>
          {activeLayers > 0 ? (
            <View style={[styles.activeBadge, { backgroundColor: accentColor + "20" }]}>
              <Feather name="volume-2" size={14} color={accentColor} />
              <ThemedText style={[styles.activeBadgeText, { color: accentColor }]}>
                {activeLayers} active layer{activeLayers > 1 ? "s" : ""}
              </ThemedText>
            </View>
          ) : null}

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {layers.map((layer) => (
              <View key={layer.id} style={styles.layerRow}>
                <Pressable
                  style={[
                    styles.layerToggle,
                    layer.active
                      ? { backgroundColor: layer.color + "30", borderColor: layer.color }
                      : {},
                  ]}
                  onPress={() => toggleLayer(layer.id)}
                  testID={`toggle-${layer.id}`}
                >
                  {layer.loading ? (
                    <ActivityIndicator size="small" color={layer.color} />
                  ) : (
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: layer.active ? layer.color : layer.color + "60" },
                      ]}
                    />
                  )}
                </Pressable>
                <View style={styles.layerInfo}>
                  <View style={styles.layerLabelRow}>
                    <ThemedText style={[styles.layerName, layer.active ? { color: layer.color } : {}]}>
                      {layer.name}
                    </ThemedText>
                    <ThemedText style={styles.layerSubtitle}>
                      {layer.subtitle}
                    </ThemedText>
                  </View>
                  {layer.active ? (
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={1}
                      value={layer.volume}
                      onValueChange={(v: number) => setLayerVolume(layer.id, v)}
                      minimumTrackTintColor={layer.color}
                      maximumTrackTintColor="rgba(255,255,255,0.12)"
                      thumbTintColor={layer.color}
                      testID={`slider-${layer.id}`}
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  description: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  activeBadgeText: {
    fontSize: 13,
    fontWeight: "500",
  },
  scrollArea: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: Spacing.md,
  },
  layerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  layerToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  layerInfo: {
    flex: 1,
  },
  layerLabelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.sm,
  },
  layerName: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    fontWeight: "600",
  },
  layerSubtitle: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    opacity: 0.6,
    flex: 1,
  },
  slider: {
    width: "100%",
    height: 30,
    marginTop: 4,
  },
});
