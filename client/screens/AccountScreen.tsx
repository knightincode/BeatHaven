import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/contexts/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MenuItemProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showChevron?: boolean;
  color?: string;
}

function MenuItem({ icon, title, subtitle, onPress, showChevron = true, color }: MenuItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        pressed && styles.menuItemPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.menuIconContainer, color && { backgroundColor: color + "20" }]}>
        <Feather name={icon} size={20} color={color || Colors.dark.link} />
      </View>
      <View style={styles.menuItemContent}>
        <ThemedText style={[styles.menuItemTitle, color && { color }]}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText style={styles.menuItemSubtitle}>{subtitle}</ThemedText>
        ) : null}
      </View>
      {showChevron ? (
        <Feather name="chevron-right" size={20} color={Colors.dark.textSecondary} />
      ) : null}
    </Pressable>
  );
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { user, logout, hasActiveSubscription, isAdmin } = useAuth();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  function handleLogout() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setLogoutModalVisible(false);
    logout();
  }

  function handleSubscription() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate("Subscription");
  }

  function handleEditProfile() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate("EditProfile");
  }

  function handleAdmin() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate("Admin");
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Feather name="user" size={40} color={Colors.dark.link} />
          </View>
          <ThemedText type="h4" style={styles.email}>
            {user?.email}
          </ThemedText>
          <View style={styles.subscriptionBadge}>
            <Feather
              name={hasActiveSubscription ? "check-circle" : "alert-circle"}
              size={14}
              color={hasActiveSubscription ? Colors.dark.success : Colors.dark.textSecondary}
            />
            <ThemedText
              style={[
                styles.subscriptionStatus,
                hasActiveSubscription && { color: Colors.dark.success },
              ]}
            >
              {hasActiveSubscription ? "Active Subscription" : "No Active Subscription"}
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Account</ThemedText>
          <Card style={styles.menuCard}>
            <MenuItem
              icon="edit-2"
              title="Edit Profile"
              subtitle="Change email or password"
              onPress={handleEditProfile}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="credit-card"
              title="Subscription"
              subtitle={hasActiveSubscription ? "$2.99/month - Active" : "Start your subscription"}
              onPress={handleSubscription}
            />
          </Card>
        </View>

        {isAdmin ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Admin</ThemedText>
            <Card style={styles.menuCard}>
              <MenuItem
                icon="upload"
                title="Upload Tracks"
                subtitle="Add new binaural beats to the app"
                onPress={handleAdmin}
                color={Colors.dark.accent}
              />
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Preferences</ThemedText>
          <Card style={styles.menuCard}>
            <MenuItem
              icon="bell"
              title="Notifications"
              subtitle="Manage notification settings"
              onPress={() => {}}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="eye"
              title="Visual Settings"
              subtitle="Player animations and themes"
              onPress={() => {}}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <Card style={styles.menuCard}>
            <MenuItem
              icon="log-out"
              title="Log Out"
              onPress={() => setLogoutModalVisible(true)}
              showChevron={false}
              color={Colors.dark.error}
            />
          </Card>
        </View>
      </KeyboardAwareScrollViewCompat>

      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText type="h4" style={styles.modalTitle}>
              Log Out
            </ThemedText>
            <ThemedText style={styles.modalMessage}>
              Are you sure you want to log out of your account?
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setLogoutModalVisible(false)}
              >
                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
              </Pressable>
              <Button onPress={handleLogout} style={styles.modalLogoutButton}>
                Log Out
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  profileSection: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.backgroundDefault,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  email: {
    marginBottom: Spacing.xs,
  },
  subscriptionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  subscriptionStatus: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  menuCard: {
    padding: 0,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  menuItemPressed: {
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.dark.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  menuItemSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginLeft: Spacing.lg + 36 + Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing["2xl"],
  },
  modalContent: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing["2xl"],
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    marginBottom: Spacing.md,
  },
  modalMessage: {
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.xl,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    height: Spacing.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  modalCancelText: {
    color: Colors.dark.textSecondary,
  },
  modalLogoutButton: {
    flex: 1,
  },
});
