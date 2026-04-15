import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { webTheme } from "../theme/webTheme";

type HeroSectionProps = {
  isWide: boolean;
  isTablet: boolean;
  query: string;
  onChangeQuery: (value: string) => void;
  onSearch: () => void;
  onBrowse: () => void;
  onCreate: () => void;
};

const deskItems = [
  {
    label: "Borrow Period",
    value: "14 days - auto reminders",
    copy: "One-click return requests",
  },
  {
    label: "Advanced Filters",
    value: "Author - Genre - ISBN",
    copy: "Find books in seconds",
  },
  {
    label: "Digital Receipts",
    value: "Instant - trackable",
    copy: "Every borrow securely logged",
  },
];

const featureRows = [
  { dot: "#22d3ee", text: "Real-time availability" },
  { dot: "#facc15", text: "Borrow receipts - always accessible" },
  { dot: "#7dd3fc", text: "Smart due-date reminders" },
];

export const HeroSection = ({
  isWide,
  isTablet,
  query,
  onChangeQuery,
  onSearch,
  onBrowse,
  onCreate,
}: HeroSectionProps) => {
  return (
    <View style={[styles.heroGrid, isWide && styles.heroGridWide]}>
      <View style={[styles.leftCol, isWide && styles.leftColWide]}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>Open 24/7 - Digital Borrowing</Text>
        </View>

        <Text style={styles.title}>Salazar Digital Library</Text>
        <Text style={styles.subtitle}>Built for serious readers</Text>

        <Text style={styles.description}>
          Explore curated collections, borrow instantly, and manage your reading life with clarity.
          Search by title, author, genre, or ISBN - everything stays organized.
        </Text>

        <View style={styles.searchWrap}>
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            style={styles.searchInput}
            placeholder="Title, author, genre, ISBN..."
            placeholderTextColor="rgba(179,194,217,0.62)"
          />
          <Pressable style={styles.searchButton} onPress={onSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>

        <View style={[styles.ctaRow, !isTablet && styles.ctaRowStack]}>
          <Pressable style={styles.primaryCta} onPress={onBrowse}>
            <Text style={styles.primaryCtaText}>Browse Collection</Text>
          </Pressable>
          <Pressable style={styles.secondaryCta} onPress={onCreate}>
            <Text style={styles.secondaryCtaText}>Create Free Account</Text>
          </Pressable>
        </View>

        <View style={styles.featuresWrap}>
          {featureRows.map((feature) => (
            <View key={feature.text} style={styles.featureRow}>
              <View style={[styles.featureDot, { backgroundColor: feature.dot }]} />
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.rightCol, isWide && styles.rightColWide]}>
        <View style={styles.floatingBlockA} />
        <View style={styles.floatingBlockB} />

        <View style={styles.readingDeskCard}>
          <View style={styles.readingDeskTop}>
            <View>
              <Text style={styles.readingDeskLabel}>Your Library Today</Text>
              <Text style={styles.readingDeskTitle}>Reading Desk</Text>
            </View>
            <View style={styles.livePill}>
              <View style={styles.livePillDot} />
              <Text style={styles.livePillText}>Live</Text>
            </View>
          </View>

          <View style={styles.readingItemsWrap}>
            {deskItems.map((item) => (
              <View key={item.label} style={styles.readingItem}>
                <Text style={styles.readingItemLabel}>{item.label}</Text>
                <Text style={styles.readingItemValue}>{item.value}</Text>
                <Text style={styles.readingItemCopy}>{item.copy}</Text>
              </View>
            ))}
          </View>

          <View style={styles.readingDeskFooter}>
            <Text style={styles.readingFooterText}>Updates in real time</Text>
            <View style={styles.onlineWrap}>
              <View style={styles.onlineDot} />
              <Text style={styles.readingFooterText}>Online sync</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  heroGrid: {
    gap: 16,
  },
  heroGridWide: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 20,
  },
  leftCol: {
    borderRadius: 26,
    backgroundColor: "rgba(8,20,47,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  leftColWide: {
    flex: 1.05,
  },
  liveBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(125,211,252,0.18)",
    backgroundColor: "rgba(30,58,97,0.56)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 6,
    backgroundColor: "#22d3ee",
  },
  liveBadgeText: {
    color: "#a9d6ed",
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    marginTop: 12,
    color: "#f4f4f5",
    fontSize: 44,
    lineHeight: 50,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 4,
    color: "#9ccae8",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
  },
  description: {
    marginTop: 12,
    color: "rgba(232,241,255,0.74)",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 640,
  },
  searchWrap: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    color: webTheme.colors.darkInk,
    fontSize: 15,
    paddingHorizontal: 8,
  },
  searchButton: {
    borderRadius: 14,
    minWidth: 124,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffb400",
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  searchButtonText: {
    color: "#121622",
    fontSize: 17,
    fontWeight: "800",
  },
  ctaRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  ctaRowStack: {
    flexDirection: "column",
  },
  primaryCta: {
    borderRadius: 16,
    backgroundColor: "#ffb400",
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 176,
  },
  primaryCtaText: {
    color: "#141b2d",
    fontSize: 17,
    fontWeight: "800",
  },
  secondaryCta: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 176,
  },
  secondaryCtaText: {
    color: "rgba(232,241,255,0.92)",
    fontSize: 16,
    fontWeight: "700",
  },
  featuresWrap: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureDot: {
    width: 10,
    height: 10,
    borderRadius: 6,
  },
  featureText: {
    color: "rgba(232,241,255,0.76)",
    fontSize: 13,
    fontWeight: "500",
  },
  rightCol: {
    position: "relative",
  },
  rightColWide: {
    flex: 0.95,
  },
  floatingBlockA: {
    position: "absolute",
    width: "26%",
    height: 160,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.02)",
    left: 0,
    top: 30,
    zIndex: 1,
  },
  floatingBlockB: {
    position: "absolute",
    width: "24%",
    height: 180,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.02)",
    right: 0,
    bottom: 10,
    zIndex: 1,
  },
  readingDeskCard: {
    zIndex: 2,
    marginTop: 44,
    marginHorizontal: 14,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  readingDeskTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  readingDeskLabel: {
    color: "rgba(232,241,255,0.46)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "700",
  },
  readingDeskTitle: {
    marginTop: 4,
    color: webTheme.colors.darkInk,
    fontSize: 26,
    fontWeight: "800",
  },
  livePill: {
    borderRadius: 999,
    backgroundColor: "rgba(16,185,129,0.28)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  livePillDot: {
    width: 8,
    height: 8,
    borderRadius: 6,
    backgroundColor: "#34d399",
  },
  livePillText: {
    color: "#a7f3d0",
    fontSize: 11,
    fontWeight: "700",
  },
  readingItemsWrap: {
    marginTop: 12,
    gap: 10,
  },
  readingItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  readingItemLabel: {
    color: "rgba(232,241,255,0.42)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontWeight: "700",
  },
  readingItemValue: {
    marginTop: 4,
    color: webTheme.colors.darkInk,
    fontSize: 17,
    fontWeight: "800",
  },
  readingItemCopy: {
    marginTop: 4,
    color: "rgba(232,241,255,0.58)",
    fontSize: 12,
  },
  readingDeskFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  readingFooterText: {
    color: "rgba(232,241,255,0.52)",
    fontSize: 11,
  },
  onlineWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 6,
    backgroundColor: "#22d3ee",
  },
});
