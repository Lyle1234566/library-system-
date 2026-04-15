import { StyleSheet, Text, View } from "react-native";

export const Footer = () => {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>Salazar Library System</Text>
      <Text style={styles.footerCopy}>Digital borrowing experience synced with web.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    paddingTop: 12,
    paddingBottom: 8,
    gap: 2,
  },
  footerText: {
    color: "rgba(232,241,255,0.9)",
    fontSize: 13,
    fontWeight: "700",
  },
  footerCopy: {
    color: "rgba(232,241,255,0.56)",
    fontSize: 11,
  },
});
