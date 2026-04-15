import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { webTheme } from "../theme/webTheme";

type ProtectedRouteProps = {
  children: ReactNode;
  fallbackText?: string;
};

export const ProtectedRoute = ({
  children,
  fallbackText = "Please sign in to continue.",
}: ProtectedRouteProps) => {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={webTheme.colors.accentCoolStrong} />
        <Text style={styles.text}>Loading session...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>{fallbackText}</Text>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: webTheme.colors.pageBg,
    gap: 10,
    paddingHorizontal: 18,
  },
  text: {
    color: webTheme.colors.inkMuted,
    fontSize: 14,
    textAlign: "center",
  },
});
