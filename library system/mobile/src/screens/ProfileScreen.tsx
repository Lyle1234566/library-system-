import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { SafeAreaView } from "react-native-safe-area-context";
import { booksApi } from "../api/books";
import { useAuth } from "../auth/AuthContext";
import { RootStackParamList } from "../navigation/RootNavigator";
import { FinePayment, FineSummary } from "../types";
import { webTheme } from "../theme/webTheme";
import { canOpenLibrarianDesk, getRoleLabel, hasStaffDeskAccess } from "../utils/roles";

const formatCurrency = (amount?: string | number | null) => {
  const parsed =
    typeof amount === "number" ? amount : Number.parseFloat(amount ?? "0");
  if (!Number.isFinite(parsed)) return "PHP 0.00";
  return `PHP ${parsed.toFixed(2)}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "N/A";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getInitials = (name?: string | null) => {
  if (!name) return "SL";
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "SL";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
};

export const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tabBarHeight = useBottomTabBarHeight();
  const [loggingOut, setLoggingOut] = useState(false);
  const [loadingFines, setLoadingFines] = useState(true);
  const [finesError, setFinesError] = useState<string | null>(null);
  const [fineSummary, setFineSummary] = useState<FineSummary | null>(null);
  const [pendingFines, setPendingFines] = useState<FinePayment[]>([]);

  const loadFineData = useCallback(async () => {
    setLoadingFines(true);
    const [summaryResult, pendingResult] = await Promise.all([
      booksApi.getFineSummary(),
      booksApi.getFinePayments("PENDING"),
    ]);
    if (summaryResult.error || !summaryResult.data) {
      setFinesError(summaryResult.error ?? "Unable to load fine summary.");
      setFineSummary(null);
      setPendingFines([]);
      setLoadingFines(false);
      return;
    }
    setFinesError(null);
    setFineSummary(summaryResult.data);
    setPendingFines(pendingResult.data ?? []);
    setLoadingFines(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFineData();
    }, [loadFineData])
  );

  const onLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
  };

  const identityLabel = user?.staff_id
    ? user?.role === "TEACHER" || user?.role === "LIBRARIAN"
      ? "Faculty ID"
      : "Staff ID"
    : "Student ID";
  const identityValue = user?.staff_id ?? user?.student_id ?? "N/A";
  const accountAccessLabel = loadingFines
    ? "Checking borrow access"
    : fineSummary?.is_borrow_blocked
      ? "Borrowing blocked"
      : "Borrowing available";

  const detailItems = useMemo(
    () => [
      { label: "Full Name", value: user?.full_name ?? "N/A" },
      { label: "Role", value: getRoleLabel(user?.role, user?.is_working_student) },
      { label: identityLabel, value: identityValue },
      { label: "Email Address", value: user?.email ?? "N/A" },
      { label: "Member Since", value: formatDate(user?.date_joined) },
      { label: "Account Status", value: user?.is_active ? "Active" : "Inactive" },
    ],
    [identityLabel, identityValue, user]
  );

  const previewFines = pendingFines.slice(0, 6);
  const showLibrarianDesk = canOpenLibrarianDesk(user);
  const showStaffDesk = hasStaffDeskAccess(user);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.bgBlue} />
        <View style={styles.bgAmber} />
        <View style={styles.bgCenter} />

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: styles.scrollContent.paddingBottom + tabBarHeight }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroGlowPrimary} />
            <View style={styles.heroGlowSecondary} />

            <View style={styles.heroTopRow}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarText}>{getInitials(user?.full_name)}</Text>
              </View>

              <View style={styles.heroTextWrap}>
                <Text style={styles.eyebrow}>Account Center</Text>
                <Text style={styles.title}>Profile</Text>
                <Text style={styles.subtitle}>
                  Review your library account, fines, and borrowing access from the same
                  backend used by the web portal.
                </Text>
              </View>
            </View>

            <View style={styles.heroChipRow}>
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>{getRoleLabel(user?.role, user?.is_working_student)}</Text>
              </View>
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>{accountAccessLabel}</Text>
              </View>
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>
                  Member since {formatDate(user?.date_joined)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Identity</Text>
                <Text style={styles.sectionTitle}>Account Details</Text>
              </View>
              <View
                style={[
                  styles.sectionBadge,
                  user?.is_active ? styles.sectionBadgeActive : styles.sectionBadgeMuted,
                ]}
              >
                <Text
                  style={[
                    styles.sectionBadgeText,
                    user?.is_active
                      ? styles.sectionBadgeTextActive
                      : styles.sectionBadgeTextMuted,
                  ]}
                >
                  {user?.is_active ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>

            <View style={styles.detailGrid}>
              {detailItems.map((item) => (
                <View key={item.label} style={styles.detailCard}>
                  <Text style={styles.detailLabel}>{item.label}</Text>
                  <Text style={styles.detailValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryEyebrow}>Borrow Status</Text>
            <Text style={styles.summaryTitle}>
              {loadingFines
                ? "Loading your account standing"
                : fineSummary?.is_borrow_blocked
                  ? "Your account needs fine clearance"
                  : "Your account is ready for borrowing"}
            </Text>
            <Text style={styles.summaryCopy}>
              {loadingFines
                ? "We are checking your fine summary and current borrowing eligibility."
                : fineSummary?.is_borrow_blocked
                  ? "Settle unpaid fines to restore borrowing privileges."
                  : "No active block is preventing you from requesting books."}
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Finance</Text>
                <Text style={styles.sectionTitle}>Fines and Access</Text>
              </View>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>
                  {loadingFines
                    ? "Loading"
                    : `${pendingFines.length} pending`}
                </Text>
              </View>
            </View>

            {loadingFines ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={webTheme.colors.accentCoolStrong} />
                <Text style={styles.loadingText}>Loading fine details...</Text>
              </View>
            ) : finesError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{finesError}</Text>
              </View>
            ) : fineSummary ? (
              <>
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Unpaid Total</Text>
                    <Text style={styles.statValue}>
                      {formatCurrency(fineSummary.unpaid_total)}
                    </Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Pending Fines</Text>
                    <Text style={styles.statValue}>{fineSummary.pending_count}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Block Threshold</Text>
                    <Text style={styles.statValue}>
                      {formatCurrency(fineSummary.block_threshold)}
                    </Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Borrow Access</Text>
                    <Text
                      style={[
                        styles.statValue,
                        fineSummary.is_borrow_blocked
                          ? styles.statValueDanger
                          : styles.statValueSuccess,
                      ]}
                    >
                      {fineSummary.is_borrow_blocked ? "Blocked" : "Open"}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.statusBanner,
                    fineSummary.is_borrow_blocked
                      ? styles.statusBannerDanger
                      : styles.statusBannerSuccess,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBannerTitle,
                      fineSummary.is_borrow_blocked
                        ? styles.statusBannerTitleDanger
                        : styles.statusBannerTitleSuccess,
                    ]}
                  >
                    {fineSummary.is_borrow_blocked
                      ? "Borrowing is currently blocked"
                      : "Borrowing is currently available"}
                  </Text>
                  <Text style={styles.statusBannerText}>
                    {fineSummary.is_borrow_blocked
                      ? "Your unpaid fines reached the blocking threshold."
                      : "Your fine status is below the blocking threshold."}
                  </Text>
                </View>

                <View style={styles.pendingSection}>
                  <Text style={styles.pendingTitle}>Pending Fine Records</Text>
                  {previewFines.length === 0 ? (
                    <View style={styles.emptyWrap}>
                      <Text style={styles.emptyText}>
                        No pending fines on your account right now.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.pendingList}>
                      {previewFines.map((fine) => (
                        <View key={fine.id} style={styles.fineCard}>
                          <View style={styles.fineTopRow}>
                            <Text style={styles.fineBook} numberOfLines={1}>
                              {fine.book.title}
                            </Text>
                            <Text style={styles.fineAmount}>
                              {formatCurrency(fine.amount)}
                            </Text>
                          </View>
                          <Text style={styles.fineMeta}>
                            Created: {formatDate(fine.created_at)}
                          </Text>
                          <Text style={styles.fineMeta}>
                            Status: {fine.status}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </>
            ) : null}
          </View>

          <View style={styles.actionsCard}>
            <Text style={styles.sectionEyebrow}>Quick Access</Text>
            <Text style={styles.actionsTitle}>Account Actions</Text>
            <Text style={styles.actionsCopy}>
              Open the same account tools and library workflows available in the mobile app.
            </Text>

            <View style={styles.actionLinkGrid}>
              <Pressable
                style={styles.actionLinkCard}
                onPress={() => navigation.navigate("Notifications")}
              >
                <Text style={styles.actionLinkTitle}>Notifications</Text>
                <Text style={styles.actionLinkCopy}>Review reminders and account alerts.</Text>
              </Pressable>

              <Pressable
                style={styles.actionLinkCard}
                onPress={() => navigation.navigate("MyReservations")}
              >
                <Text style={styles.actionLinkTitle}>Reservations</Text>
                <Text style={styles.actionLinkCopy}>Track queue positions and pickup windows.</Text>
              </Pressable>

              <Pressable
                style={styles.actionLinkCard}
                onPress={() => navigation.navigate("ReadingHistory")}
              >
                <Text style={styles.actionLinkTitle}>Reading History</Text>
                <Text style={styles.actionLinkCopy}>Review returned books and reading activity.</Text>
              </Pressable>

              {showLibrarianDesk ? (
                <Pressable
                  style={styles.actionLinkCard}
                  onPress={() => navigation.navigate("LibrarianDesk")}
                >
                  <Text style={styles.actionLinkTitle}>Librarian Desk</Text>
                  <Text style={styles.actionLinkCopy}>Approve accounts, review queues, and manage fines.</Text>
                </Pressable>
              ) : null}

              {showStaffDesk ? (
                <Pressable
                  style={styles.actionLinkCard}
                  onPress={() => navigation.navigate("StaffDesk")}
                >
                  <Text style={styles.actionLinkTitle}>Staff Desk</Text>
                  <Text style={styles.actionLinkCopy}>Handle borrow approvals and return processing.</Text>
                </Pressable>
              ) : null}
            </View>

            <Pressable
              style={[styles.logoutButton, loggingOut && styles.buttonDisabled]}
              onPress={onLogout}
            >
              {loggingOut ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.logoutText}>Sign Out</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: webTheme.colors.darkBg,
  },
  screen: {
    flex: 1,
    backgroundColor: webTheme.colors.darkBg,
  },
  bgBlue: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "rgba(14,165,233,0.14)",
    left: -120,
    top: -90,
  },
  bgAmber: {
    position: "absolute",
    width: 310,
    height: 310,
    borderRadius: 999,
    backgroundColor: "rgba(245,158,11,0.12)",
    right: -120,
    bottom: -150,
  },
  bgCenter: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 999,
    backgroundColor: "rgba(2,132,199,0.08)",
    left: "8%",
    top: "20%",
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(8,20,47,0.62)",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  heroGlowPrimary: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(2,132,199,0.24)",
    top: -72,
    left: -36,
  },
  heroGlowSecondary: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: "rgba(245,158,11,0.16)",
    bottom: -60,
    right: -34,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrap: {
    width: 70,
    height: 70,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: webTheme.colors.darkInk,
    fontSize: 24,
    fontWeight: "800",
  },
  heroTextWrap: {
    flex: 1,
  },
  eyebrow: {
    color: "#7dd3fc",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    fontWeight: "800",
  },
  title: {
    marginTop: 6,
    fontSize: 30,
    fontWeight: "800",
    color: webTheme.colors.darkInk,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(232,241,255,0.74)",
  },
  heroChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroChipText: {
    color: "rgba(232,241,255,0.8)",
    fontSize: 11,
    fontWeight: "700",
  },
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(8,20,47,0.58)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionEyebrow: {
    color: "rgba(232,241,255,0.58)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    fontWeight: "700",
  },
  sectionTitle: {
    marginTop: 3,
    color: webTheme.colors.darkInk,
    fontSize: 20,
    fontWeight: "800",
  },
  sectionBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sectionBadgeActive: {
    borderColor: "rgba(16,185,129,0.36)",
    backgroundColor: "rgba(16,185,129,0.16)",
  },
  sectionBadgeMuted: {
    borderColor: "rgba(148,163,184,0.3)",
    backgroundColor: "rgba(148,163,184,0.14)",
  },
  sectionBadgeText: {
    color: "rgba(232,241,255,0.78)",
    fontSize: 11,
    fontWeight: "700",
  },
  sectionBadgeTextActive: {
    color: "#d1fae5",
  },
  sectionBadgeTextMuted: {
    color: "#e2e8f0",
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailCard: {
    width: "48%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  detailLabel: {
    color: "rgba(232,241,255,0.56)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    fontWeight: "700",
  },
  detailValue: {
    color: webTheme.colors.darkInk,
    fontSize: 14,
    fontWeight: "700",
  },
  summaryCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.36)",
    backgroundColor: "rgba(120,53,15,0.3)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 5,
  },
  summaryEyebrow: {
    color: "#fcd34d",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: "800",
  },
  summaryTitle: {
    color: "#fff7ed",
    fontSize: 18,
    fontWeight: "800",
  },
  summaryCopy: {
    color: "rgba(255,237,213,0.82)",
    fontSize: 13,
    lineHeight: 19,
  },
  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 12,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCard: {
    width: "48%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  statLabel: {
    color: "rgba(232,241,255,0.56)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
  },
  statValue: {
    marginTop: 4,
    color: webTheme.colors.darkInk,
    fontSize: 18,
    fontWeight: "800",
  },
  statValueDanger: {
    color: "#fecaca",
  },
  statValueSuccess: {
    color: "#d1fae5",
  },
  statusBanner: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  statusBannerDanger: {
    borderColor: "rgba(248,113,113,0.4)",
    backgroundColor: "rgba(127,29,29,0.45)",
  },
  statusBannerSuccess: {
    borderColor: "rgba(16,185,129,0.35)",
    backgroundColor: "rgba(6,95,70,0.36)",
  },
  statusBannerTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  statusBannerTitleDanger: {
    color: "#fecaca",
  },
  statusBannerTitleSuccess: {
    color: "#d1fae5",
  },
  statusBannerText: {
    color: "rgba(232,241,255,0.72)",
    fontSize: 12,
    lineHeight: 17,
  },
  pendingSection: {
    gap: 8,
  },
  pendingTitle: {
    color: webTheme.colors.darkInk,
    fontSize: 14,
    fontWeight: "800",
  },
  pendingList: {
    gap: 8,
  },
  fineCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  fineTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  fineBook: {
    flex: 1,
    color: webTheme.colors.darkInk,
    fontSize: 13,
    fontWeight: "700",
  },
  fineAmount: {
    color: "#fbbf24",
    fontSize: 13,
    fontWeight: "800",
  },
  fineMeta: {
    color: "rgba(232,241,255,0.68)",
    fontSize: 11,
  },
  actionsCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(8,20,47,0.58)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  actionsTitle: {
    marginTop: 2,
    color: webTheme.colors.darkInk,
    fontSize: 20,
    fontWeight: "800",
  },
  actionsCopy: {
    color: "rgba(232,241,255,0.72)",
    fontSize: 13,
    lineHeight: 19,
  },
  actionLinkGrid: {
    marginTop: 6,
    gap: 10,
  },
  actionLinkCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  actionLinkTitle: {
    color: webTheme.colors.darkInk,
    fontSize: 14,
    fontWeight: "800",
  },
  actionLinkCopy: {
    color: "rgba(232,241,255,0.7)",
    fontSize: 12,
    lineHeight: 17,
  },
  logoutButton: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: "#f59e0b",
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  emptyWrap: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingVertical: 20,
    paddingHorizontal: 14,
  },
  emptyText: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 12,
    textAlign: "center",
  },
  errorBox: {
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.48)",
    borderRadius: 12,
    backgroundColor: "rgba(127,29,29,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorText: {
    color: "#fecaca",
    fontSize: 12,
    lineHeight: 18,
  },
});
