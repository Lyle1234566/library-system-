import { Pressable, StyleSheet, Text, View } from "react-native";
import { webTheme } from "../theme/webTheme";

type CallToActionProps = {
  onSignIn: () => void;
  onRegister: () => void;
};

export const CallToAction = ({ onSignIn, onRegister }: CallToActionProps) => {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Ready to start borrowing?</Text>
      <Text style={styles.copy}>Use your existing web account and continue instantly on mobile.</Text>
      <View style={styles.row}>
        <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={onSignIn}>
          <Text style={styles.primaryText}>Sign In</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          onPress={onRegister}
        >
          <Text style={styles.secondaryText}>Create Account</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.3)",
    backgroundColor: "rgba(2,132,199,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 7,
  },
  title: {
    color: webTheme.colors.darkInk,
    fontSize: 17,
    fontWeight: "800",
  },
  copy: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  row: {
    marginTop: 3,
    flexDirection: "column",
    gap: 7,
  },
  primary: {
    borderRadius: 10,
    backgroundColor: webTheme.colors.accent,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: webTheme.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  secondary: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: webTheme.colors.darkInk,
    fontSize: 12,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.86,
  },
});
