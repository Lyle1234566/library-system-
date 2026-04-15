import { BottomTabNavigationProp, useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { ScrollView, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { FeaturedBooks } from "../components";
import { AppTabParamList } from "../navigation/RootNavigator";
import { webTheme } from "../theme/webTheme";
import { getRoleLabel } from "../utils/roles";

type QuickAction = {
  label: string;
  description: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  route: keyof AppTabParamList;
};

const quickActions: QuickAction[] = [
  {
    label: "Browse Books",
    description: "Open the live shelf catalog and explore categories.",
    icon: "book-open",
    route: "Books",
  },
  {
    label: "Search Catalog",
    description: "Find a title fast by author, ISBN, or keyword.",
    icon: "search",
    route: "SearchHub",
  },
  {
    label: "My Borrowed",
    description: "Track active loans, due dates, and returns.",
    icon: "bookmark",
    route: "MyBooks",
  },
  {
    label: "Profile",
    description: "Open account details and desk shortcuts.",
    icon: "user",
    route: "Profile",
  },
];

export const PatronHomeScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<AppTabParamList>>();
  const tabBarHeight = useBottomTabBarHeight();
  const roleLabel = getRoleLabel(user?.role, user?.is_working_student);

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <View style={styles.bgBlue} />
      <View style={styles.bgAmber} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 28 }]}
      >
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Library Home</Text>
          <Text style={styles.heroTitle}>Welcome back, {user?.full_name?.split(" ")[0] ?? "Reader"}.</Text>
          <Text style={styles.heroSubtitle}>
            Your {roleLabel.toLowerCase()} account is connected. Browse the collection, search the catalog, and manage your borrowed books from one place.
          </Text>

          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Feather name="shield" size={14} color={webTheme.colors.accent} />
              <Text style={styles.heroBadgeText}>Account synced</Text>
            </View>
            <View style={styles.heroBadge}>
              <Feather name="book-open" size={14} color={webTheme.colors.accentCool} />
              <Text style={styles.heroBadgeText}>Catalog live</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <Text style={styles.sectionSubtitle}>The core library actions are one tap away.</Text>
        </View>

        <View style={styles.quickGrid}>
          {quickActions.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => navigation.navigate(item.route)}
              style={({ pressed }) => [styles.quickCard, pressed && styles.quickCardPressed]}
            >
              <View style={styles.quickIconWrap}>
                <Feather name={item.icon} size={18} color={webTheme.colors.darkInk} />
              </View>
              <Text style={styles.quickLabel}>{item.label}</Text>
              <Text style={styles.quickDescription}>{item.description}</Text>
            </Pressable>
          ))}
        </View>

        <FeaturedBooks
          onSelect={() => navigation.navigate("Books")}
          onViewAll={() => navigation.navigate("Books")}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: webTheme.colors.pageBg,
  },
  bgBlue: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 160,
    backgroundColor: "rgba(20,60,120,0.11)",
    left: -110,
    top: 24,
  },
  bgAmber: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 150,
    backgroundColor: "rgba(212,175,55,0.12)",
    right: -120,
    bottom: 90,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  heroCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.14)",
    backgroundColor: webTheme.colors.darkBg,
    padding: 20,
    gap: 10,
    shadowColor: "#11284f",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  eyebrow: {
    color: "rgba(232,241,255,0.58)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: webTheme.colors.darkInk,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 32,
  },
  heroSubtitle: {
    color: "rgba(232,241,255,0.72)",
    fontSize: 14,
    lineHeight: 21,
  },
  heroBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingTop: 6,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: {
    color: webTheme.colors.darkInk,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    color: webTheme.colors.ink,
    fontSize: 19,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: webTheme.colors.inkMuted,
    fontSize: 12,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quickCard: {
    width: "48%",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.10)",
    backgroundColor: webTheme.colors.surface,
    padding: 16,
    gap: 10,
    shadowColor: "#173462",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  quickCardPressed: {
    opacity: 0.92,
    transform: [{ translateY: 1 }],
  },
  quickIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(212,175,55,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    color: webTheme.colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  quickDescription: {
    color: webTheme.colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
