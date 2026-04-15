import { StyleSheet, Text, View } from "react-native";
import { webTheme } from "../theme/webTheme";

const items = [
  {
    title: "Smart Search",
    description: "Find books quickly by title, author, genre, or ISBN.",
  },
  {
    title: "Borrow Workflow",
    description: "Request, approve, and return flow stays synced with web.",
  },
  {
    title: "Receipt Tracking",
    description: "Each approved borrow keeps a clear receipt trail.",
  },
];

export const Features = () => {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Features</Text>
      <View style={styles.grid}>
        {items.map((item) => (
          <View key={item.title} style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardCopy}>{item.description}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 18,
    gap: 8,
  },
  title: {
    color: webTheme.colors.darkInk,
    fontSize: 20,
    fontWeight: "800",
  },
  grid: {
    gap: 10,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  cardTitle: {
    color: webTheme.colors.darkInk,
    fontSize: 14,
    fontWeight: "700",
  },
  cardCopy: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 12,
    lineHeight: 17,
  },
});
