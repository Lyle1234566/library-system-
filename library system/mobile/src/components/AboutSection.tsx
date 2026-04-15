import { StyleSheet, Text, View } from "react-native";
import { webTheme } from "../theme/webTheme";

const goals = [
  "Deliver a calm, reliable borrowing experience for every student.",
  "Keep availability transparent and updates instant.",
  "Make returning and renewals easy to understand.",
  "Support librarians with accurate, organized tools.",
];

export const AboutSection = () => {
  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>About Us</Text>
      <Text style={styles.title}>A simple and reliable library app for students</Text>
      <Text style={styles.copy}>
        Salazar Library System keeps borrowing, returns, and tracking clear so students can spend
        less time waiting and more time reading.
      </Text>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Mission</Text>
          <Text style={styles.cardTitle}>Make borrowing feel simple, clear, and welcoming.</Text>
          <Text style={styles.cardCopy}>
            We remove friction from everyday library tasks so students can browse quickly,
            track requests, and always know the next step.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Vision</Text>
          <Text style={styles.cardTitle}>A library experience that feels calm, smart, and human.</Text>
          <Text style={styles.cardCopy}>
            We aim to build a digital library environment that keeps learning accessible,
            organized, and supportive for every reader.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Goals</Text>
          <View style={styles.goalList}>
            {goals.map((goal) => (
              <View key={goal} style={styles.goalItem}>
                <View style={styles.goalDot} />
                <Text style={styles.goalText}>{goal}</Text>
              </View>
            ))}
          </View>
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
  grid: {
    marginTop: 10,
    gap: 8,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(12,24,51,0.56)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  cardLabel: {
    color: "rgba(232,241,255,0.62)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontWeight: "700",
  },
  cardTitle: {
    color: webTheme.colors.darkInk,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  cardCopy: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  goalList: {
    gap: 6,
    marginTop: 4,
  },
  goalItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },
  goalDot: {
    marginTop: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fbbf24",
  },
  goalText: {
    flex: 1,
    color: webTheme.colors.darkInkMuted,
    fontSize: 11,
    lineHeight: 16,
  },
});
