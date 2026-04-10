import React from "react";
import { View, StyleSheet, Image } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, Colors } from "@/constants/theme";

interface HeaderTitleProps {
  title: string;
}

export function HeaderTitle({ title }: HeaderTitleProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Image
          source={require("../../assets/images/Logo_Figma.png")}
          style={styles.icon}
          resizeMode="contain"
        />
      </View>
      <ThemedText style={styles.title}>{title}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 6,
    overflow: "hidden",
    marginRight: Spacing.sm,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.dark.text,
  },
});
