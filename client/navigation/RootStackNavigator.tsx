import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "@/contexts/AuthContext";
import { useScreenOptions } from "@/hooks/useScreenOptions";

import AuthScreen from "@/screens/AuthScreen";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import PlayerScreen from "@/screens/PlayerScreen";
import PlaylistDetailScreen from "@/screens/PlaylistDetailScreen";
import SubscriptionScreen from "@/screens/SubscriptionScreen";
import EditProfileScreen from "@/screens/EditProfileScreen";
import AdminScreen from "@/screens/AdminScreen";
import AdminTestingScreen from "@/screens/AdminTestingScreen";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { Colors } from "@/constants/theme";

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Player: undefined;
  PlaylistDetail: { playlistId: string; playlistName: string };
  Subscription: undefined;
  EditProfile: undefined;
  Admin: undefined;
  AdminTesting: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const screenOptions = useScreenOptions();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.dark.link} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!isAuthenticated ? (
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Player"
            component={PlayerScreen}
            options={{
              presentation: "fullScreenModal",
              headerShown: false,
              animation: "slide_from_bottom",
            }}
          />
          <Stack.Screen
            name="PlaylistDetail"
            component={PlaylistDetailScreen}
            options={({ route }) => ({
              headerTitle: route.params.playlistName,
            })}
          />
          <Stack.Screen
            name="Subscription"
            component={SubscriptionScreen}
            options={{ headerTitle: "Subscription" }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ headerTitle: "Edit Profile" }}
          />
          <Stack.Screen
            name="Admin"
            component={AdminScreen}
            options={{ headerTitle: "Admin Panel" }}
          />
          <Stack.Screen
            name="AdminTesting"
            component={AdminTestingScreen}
            options={{ headerTitle: "Admin Testing" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundRoot,
  },
});
