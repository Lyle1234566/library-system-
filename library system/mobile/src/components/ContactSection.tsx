import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { webTheme } from "../theme/webTheme";

const contactHighlights = [
  {
    label: "Email",
    value: "support@salazarlibrary.com",
    helper: "We reply within 1 business day.",
    icon: "EM",
    link: "mailto:support@salazarlibrary.com",
    actionText: "Tap to compose",
  },
  {
    label: "Call",
    value: "+1 (555) 123-4567",
    helper: "Mon-Fri, 8:00 AM - 5:00 PM",
    icon: "PH",
    link: "tel:+15551234567",
    actionText: "Tap to dial",
  },
  {
    label: "Visit",
    value: "Salazar Library System Center",
    helper: "Main campus, Learning Commons 2F",
    icon: "MAP",
    link: "https://www.google.com/maps/search/?api=1&query=Salazar%20Library%20System%20Center",
    actionText: "Tap to open maps",
  },
];

export const ContactSection = () => {
  const openLink = async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>Contact Us</Text>
      <Text style={styles.title}>Need help with borrowing or account access?</Text>
      <Text style={styles.copy}>
        Reach out for catalog updates, returns, or sign-in concerns. Everything here is optimized
        for quick actions on mobile.
      </Text>

      <View style={styles.list}>
        {contactHighlights.map((item) => (
          <Pressable
            key={item.label}
            onPress={() => void openLink(item.link)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.iconWrap}>
              <Text style={styles.iconText}>{item.icon}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardLabel}>{item.label}</Text>
              <Text style={styles.cardValue}>{item.value}</Text>
              <Text style={styles.cardHelper}>{item.helper}</Text>
              <Text style={styles.cardAction}>{item.actionText}</Text>
            </View>
            <Text style={styles.chevron}>{">"}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.helpCard}>
        <Text style={styles.helpTitle}>Need direct librarian support?</Text>
        <Text style={styles.helpCopy}>
          Visit the librarian desk at Learning Commons 2F for in-person assistance.
        </Text>
        <View style={styles.quickRow}>
          <Pressable
            style={({ pressed }) => [styles.quickButton, pressed && styles.quickButtonPressed]}
            onPress={() => void openLink("mailto:support@salazarlibrary.com")}
          >
            <Text style={styles.quickButtonText}>Email desk</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.quickButton,
              styles.quickButtonGhost,
              pressed && styles.quickButtonPressed,
            ]}
            onPress={() => void openLink("tel:+15551234567")}
          >
            <Text style={styles.quickButtonGhostText}>Call desk</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  eyebrow: {
    color: "rgba(232,241,255,0.62)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  title: {
    marginTop: 7,
    color: webTheme.colors.darkInk,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
  },
  copy: {
    marginTop: 7,
    color: webTheme.colors.darkInkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  list: {
    marginTop: 10,
    gap: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(12,24,51,0.56)",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  cardPressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  iconText: {
    color: webTheme.colors.darkInk,
    fontSize: 10,
    fontWeight: "800",
  },
  cardBody: {
    flex: 1,
  },
  cardLabel: {
    color: "rgba(232,241,255,0.6)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontWeight: "700",
  },
  cardValue: {
    marginTop: 3,
    color: webTheme.colors.darkInk,
    fontSize: 13,
    fontWeight: "700",
  },
  cardHelper: {
    marginTop: 2,
    color: webTheme.colors.darkInkMuted,
    fontSize: 11,
  },
  cardAction: {
    marginTop: 3,
    color: webTheme.colors.accentCool,
    fontSize: 11,
    fontWeight: "600",
  },
  chevron: {
    color: "rgba(232,241,255,0.56)",
    fontSize: 15,
    fontWeight: "700",
  },
  helpCard: {
    marginTop: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.24)",
    backgroundColor: "rgba(2,132,199,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  helpTitle: {
    color: webTheme.colors.darkInk,
    fontSize: 13,
    fontWeight: "700",
  },
  helpCopy: {
    marginTop: 4,
    color: webTheme.colors.darkInkMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  quickRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  quickButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: webTheme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
  },
  quickButtonGhost: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  quickButtonPressed: {
    opacity: 0.85,
  },
  quickButtonText: {
    color: webTheme.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  quickButtonGhostText: {
    color: webTheme.colors.darkInk,
    fontSize: 12,
    fontWeight: "700",
  },
});
