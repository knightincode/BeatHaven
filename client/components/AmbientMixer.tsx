import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface AmbientLayer {
  id: string;
  name: string;
  icon: keyof typeof Feather.glyphMap;
  active: boolean;
  volume: number;
}

const AMBIENT_LAYERS: AmbientLayer[] = [
  { id: "rain", name: "Rain", icon: "cloud-rain", active: false, volume: 0.5 },
  { id: "ocean", name: "Ocean Waves", icon: "wind", active: false, volume: 0.5 },
  { id: "forest", name: "Forest", icon: "feather", active: false, volume: 0.5 },
  { id: "fire", name: "Fireplace", icon: "sun", active: false, volume: 0.5 },
  { id: "night", name: "Night Crickets", icon: "moon", active: false, volume: 0.5 },
  { id: "wind", name: "Wind", icon: "navigation", active: false, volume: 0.5 },
];

interface AmbientMixerProps {
  visible: boolean;
  onClose: () => void;
  accentColor?: string;
}

export function AmbientMixer({ visible, onClose, accentColor = Colors.dark.link }: AmbientMixerProps) {
  const insets = useSafeAreaInsets();
  const [layers, setLayers] = useState<AmbientLayer[]>(AMBIENT_LAYERS);
  const audioContextRef = useRef<any>(null);
  const nodesRef = useRef<Record<string, { source: any; gain: any }>>({});

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

  function createNoiseBuffer(ctx: any, type: string): any {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      switch (type) {
        case "rain":
          data[i] = (Math.random() * 2 - 1) * 0.3;
          if (Math.random() < 0.001) data[i] *= 3;
          break;
        case "ocean": {
          const t = i / ctx.sampleRate;
          const wave = Math.sin(t * 0.15 * Math.PI * 2) * 0.5 + 0.5;
          data[i] = (Math.random() * 2 - 1) * wave * 0.4;
          break;
        }
        case "forest":
          data[i] = (Math.random() * 2 - 1) * 0.15;
          if (Math.random() < 0.0005) data[i] = Math.sin(i * 0.1) * 0.5;
          break;
        case "fire":
          data[i] = (Math.random() * 2 - 1) * 0.2 * (0.8 + Math.random() * 0.4);
          break;
        case "night":
          data[i] = (Math.random() * 2 - 1) * 0.05;
          if (Math.random() < 0.002) {
            const chirpLen = Math.min(2000, bufferSize - i);
            for (let j = 0; j < chirpLen; j++) {
              const env = Math.sin((j / chirpLen) * Math.PI);
              data[i + j] += Math.sin(j * 0.3) * env * 0.3;
            }
          }
          break;
        case "wind":
          data[i] = (Math.random() * 2 - 1) * 0.25;
          break;
        default:
          data[i] = (Math.random() * 2 - 1) * 0.2;
      }
    }

    return buffer;
  }

  function startLayer(layerId: string, volume: number) {
    const ctx = getAudioContext();
    if (!ctx) return;

    stopLayer(layerId);

    const buffer = createNoiseBuffer(ctx, layerId);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = layerId === "wind" ? "lowpass" : "bandpass";
    filter.frequency.value = layerId === "rain" ? 8000 : layerId === "ocean" ? 400 : layerId === "wind" ? 600 : 2000;
    filter.Q.value = layerId === "ocean" ? 0.5 : 1;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    nodesRef.current[layerId] = { source, gain };
  }

  function stopLayer(layerId: string) {
    const node = nodesRef.current[layerId];
    if (node) {
      try {
        node.source.stop();
        node.source.disconnect();
        node.gain.disconnect();
      } catch (e) {}
      delete nodesRef.current[layerId];
    }
  }

  function toggleLayer(layerId: string) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId) {
          const newActive = !l.active;
          if (newActive) {
            startLayer(layerId, l.volume);
          } else {
            stopLayer(layerId);
          }
          return { ...l, active: newActive };
        }
        return l;
      })
    );
  }

  function setLayerVolume(layerId: string, volume: number) {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId) {
          const node = nodesRef.current[layerId];
          if (node) {
            node.gain.gain.value = volume;
          }
          return { ...l, volume };
        }
        return l;
      })
    );
  }

  useEffect(() => {
    return () => {
      Object.keys(nodesRef.current).forEach((id) => stopLayer(id));
    };
  }, []);

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
            <ThemedText type="h4">Ambient Mixer</ThemedText>
            <Pressable onPress={onClose} testID="button-close-mixer">
              <Feather name="x" size={24} color={Colors.dark.text} />
            </Pressable>
          </View>
          <ThemedText style={styles.description}>
            {Platform.OS === "web"
              ? "Layer ambient sounds over your binaural beats"
              : "Ambient sounds are available on the web version"}
          </ThemedText>
          {activeLayers > 0 ? (
            <View style={[styles.activeBadge, { backgroundColor: accentColor + "20" }]}>
              <Feather name="volume-2" size={14} color={accentColor} />
              <ThemedText style={[styles.activeBadgeText, { color: accentColor }]}>
                {activeLayers} active layer{activeLayers > 1 ? "s" : ""}
              </ThemedText>
            </View>
          ) : null}

          {layers.map((layer) => (
            <View key={layer.id} style={styles.layerRow}>
              <Pressable
                style={[
                  styles.layerToggle,
                  layer.active ? { backgroundColor: accentColor + "20", borderColor: accentColor } : {},
                ]}
                onPress={() => toggleLayer(layer.id)}
                testID={`toggle-${layer.id}`}
              >
                <Feather
                  name={layer.icon}
                  size={20}
                  color={layer.active ? accentColor : Colors.dark.textSecondary}
                />
              </Pressable>
              <View style={styles.layerInfo}>
                <ThemedText style={[styles.layerName, layer.active ? { color: Colors.dark.text } : {}]}>
                  {layer.name}
                </ThemedText>
                {layer.active ? (
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={1}
                    value={layer.volume}
                    onValueChange={(v: number) => setLayerVolume(layer.id, v)}
                    minimumTrackTintColor={accentColor}
                    maximumTrackTintColor="rgba(255,255,255,0.12)"
                    thumbTintColor={accentColor}
                    testID={`slider-${layer.id}`}
                  />
                ) : null}
              </View>
            </View>
          ))}
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
    borderWidth: 1,
    borderColor: "transparent",
  },
  layerInfo: {
    flex: 1,
  },
  layerName: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    fontWeight: "500",
  },
  slider: {
    width: "100%",
    height: 30,
    marginTop: 4,
  },
});
