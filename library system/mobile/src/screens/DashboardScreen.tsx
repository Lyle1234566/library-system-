import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { booksApi } from "../api/books";
import { notificationsApi } from "../api/notifications";
import { useAuth } from "../auth/AuthContext";
import { AppTabParamList, RootStackParamList } from "../navigation/RootNavigator";
import { webTheme } from "../theme/webTheme";
import { BorrowRequest } from "../types";
import { canOpenLibrarianDesk, getRoleLabel, hasStaffDeskAccess } from "../utils/roles";

type ChartSeriesPoint = {
  key: string;
  label: string;
  mostBorrowed: number;
  activeStudents: number;
  overdueReports: number;
  estimatedFines: number;
};

const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const formatCurrency = (amount: number) =>
  `PHP ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const DashboardScreen = () => {
  const { user } = useAuth();
  type NavigationProp = CompositeNavigationProp<
    BottomTabNavigationProp<AppTabParamList>,
    NativeStackNavigationProp<RootStackParamList>
  >;
  const navigation = useNavigation<NavigationProp>();
  const isLibrarianDesk = canOpenLibrarianDesk(user);
  const showStaffDesk = hasStaffDeskAccess(user);
  const shortcutCount = 7 + (isLibrarianDesk ? 1 : 0) + (showStaffDesk ? 1 : 0);

  const [pendingBorrowRequests, setPendingBorrowRequests] = useState<BorrowRequest[]>([]);
  const [analyticsBorrowRequests, setAnalyticsBorrowRequests] = useState<BorrowRequest[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const loadUnreadNotifications = useCallback(async () => {
    if (!user) return;
    const result = await notificationsApi.getUnreadCount();
    if (result.error || !result.data) return;
    setUnreadNotifications(result.data.unread_count ?? 0);
  }, [user]);

  const loadLibrarianAnalytics = useCallback(async () => {
    if (!isLibrarianDesk) return;
    setAnalyticsLoading(true);

    const [pendingResult, approvedResult, returnedResult] = await Promise.all([
      booksApi.getBorrowRequests("PENDING"),
      booksApi.getBorrowRequests("APPROVED"),
      booksApi.getBorrowRequests("RETURNED"),
    ]);

    if (
      pendingResult.error ||
      !pendingResult.data ||
      approvedResult.error ||
      !approvedResult.data ||
      returnedResult.error ||
      !returnedResult.data
    ) {
      setAnalyticsError(
        pendingResult.error ??
          approvedResult.error ??
          returnedResult.error ??
          "Unable to load librarian analytics."
      );
      setPendingBorrowRequests([]);
      setAnalyticsBorrowRequests([]);
      setAnalyticsLoading(false);
      return;
    }

    const analyticsById = new Map<number, BorrowRequest>();
    [...approvedResult.data, ...returnedResult.data].forEach((request) => {
      analyticsById.set(request.id, request);
    });

    setAnalyticsError(null);
    setPendingBorrowRequests(pendingResult.data);
    setAnalyticsBorrowRequests(Array.from(analyticsById.values()));
    setAnalyticsLoading(false);
  }, [isLibrarianDesk]);

  useEffect(() => {
    if (!isLibrarianDesk) return;
    void loadLibrarianAnalytics();
  }, [isLibrarianDesk, loadLibrarianAnalytics]);

  useEffect(() => {
    void loadUnreadNotifications();
  }, [loadUnreadNotifications]);

  const mostBorrowedBooks = useMemo(() => {
    const counts = new Map<number, { id: number; title: string; count: number }>();
    analyticsBorrowRequests.forEach((request) => {
      if (request.status !== "APPROVED" && request.status !== "RETURNED") return;
      const existing = counts.get(request.book.id);
      if (existing) {
        existing.count += 1;
        return;
      }
      counts.set(request.book.id, { id: request.book.id, title: request.book.title, count: 1 });
    });
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
      .slice(0, 5);
  }, [analyticsBorrowRequests]);

  const activeStudentsCount = useMemo(() => {
    const activeUsers = new Set<number>();
    [...analyticsBorrowRequests, ...pendingBorrowRequests].forEach((request) => {
      if (request.user?.id) activeUsers.add(request.user.id);
    });
    return activeUsers.size;
  }, [analyticsBorrowRequests, pendingBorrowRequests]);

  const mostActiveStudents = useMemo(() => {
    const counts = new Map<
      number,
      { id: number; fullName: string; studentId: string; requests: number }
    >();
    [...analyticsBorrowRequests, ...pendingBorrowRequests].forEach((request) => {
      if (!request.user) return;
      const existing = counts.get(request.user.id);
      if (existing) {
        existing.requests += 1;
        return;
      }
      counts.set(request.user.id, {
        id: request.user.id,
        fullName: request.user.full_name,
        studentId: request.user.student_id ?? request.user.staff_id ?? "-",
        requests: 1,
      });
    });
    return Array.from(counts.values())
      .sort((a, b) => b.requests - a.requests || a.fullName.localeCompare(b.fullName))
      .slice(0, 5);
  }, [analyticsBorrowRequests, pendingBorrowRequests]);

  const overdueRequests = useMemo(
    () =>
      analyticsBorrowRequests.filter(
        (request) => request.status === "APPROVED" && (request.overdue_days ?? 0) > 0
      ),
    [analyticsBorrowRequests]
  );

  const totalOverdueFees = useMemo(
    () =>
      overdueRequests.reduce((sum, request) => {
        const fee = Number.parseFloat(request.late_fee_amount ?? "0");
        return sum + (Number.isFinite(fee) ? fee : 0);
      }, 0),
    [overdueRequests]
  );

  const performanceSeries = useMemo(() => {
    const monthsBack = 6;
    const now = new Date();
    const points: ChartSeriesPoint[] = [];
    const indexByKey = new Map<string, number>();
    const monthlyBookCounts = new Map<string, Map<number, number>>();
    const monthlyUsers = new Map<string, Set<number>>();

    for (let i = monthsBack - 1; i >= 0; i -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = toMonthKey(monthDate);
      indexByKey.set(key, points.length);
      monthlyBookCounts.set(key, new Map<number, number>());
      monthlyUsers.set(key, new Set<number>());
      points.push({
        key,
        label: monthDate.toLocaleDateString("en-US", { month: "short" }),
        mostBorrowed: 0,
        activeStudents: 0,
        overdueReports: 0,
        estimatedFines: 0,
      });
    }

    analyticsBorrowRequests.forEach((request) => {
      const requestedAt = new Date(request.requested_at);
      if (Number.isNaN(requestedAt.getTime())) return;
      const targetIndex = indexByKey.get(toMonthKey(requestedAt));
      if (targetIndex === undefined) return;

      const point = points[targetIndex];
      const bookCounts = monthlyBookCounts.get(point.key);
      const users = monthlyUsers.get(point.key);

      if (bookCounts && (request.status === "APPROVED" || request.status === "RETURNED")) {
        bookCounts.set(request.book.id, (bookCounts.get(request.book.id) ?? 0) + 1);
      }
      if (users && request.user?.id) users.add(request.user.id);

      if ((request.overdue_days ?? 0) > 0) {
        point.overdueReports += 1;
        const fee = Number.parseFloat(request.late_fee_amount ?? "0");
        point.estimatedFines += Number.isFinite(fee) ? fee : 0;
      }
    });

    pendingBorrowRequests.forEach((request) => {
      const requestedAt = new Date(request.requested_at);
      if (Number.isNaN(requestedAt.getTime())) return;
      const targetIndex = indexByKey.get(toMonthKey(requestedAt));
      if (targetIndex === undefined) return;
      const users = monthlyUsers.get(points[targetIndex].key);
      if (users && request.user?.id) users.add(request.user.id);
    });

    points.forEach((point) => {
      const bookCounts = monthlyBookCounts.get(point.key);
      const users = monthlyUsers.get(point.key);
      point.mostBorrowed = bookCounts ? Math.max(0, ...Array.from(bookCounts.values())) : 0;
      point.activeStudents = users ? users.size : 0;
      point.estimatedFines = Number(point.estimatedFines.toFixed(2));
    });

    return points;
  }, [analyticsBorrowRequests, pendingBorrowRequests]);

  const latestPerformancePoint = useMemo(
    () => performanceSeries[performanceSeries.length - 1] ?? null,
    [performanceSeries]
  );

  const performanceChart = useMemo(() => {
    const chartWidth = 680;
    const chartHeight = 220;
    const padding = { top: 14, right: 64, bottom: 28, left: 34 };
    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;
    const baselineY = padding.top + plotHeight;

    const maxCountValue = Math.max(
      1,
      ...performanceSeries.map((point) =>
        Math.max(point.mostBorrowed, point.activeStudents, point.overdueReports)
      )
    );
    const maxFinesValue = Math.max(1, ...performanceSeries.map((point) => point.estimatedFines));

    const toCountY = (value: number) => baselineY - (value / maxCountValue) * plotHeight;
    const toFinesY = (value: number) => baselineY - (value / maxFinesValue) * plotHeight;
    const stepX = performanceSeries.length > 1 ? plotWidth / (performanceSeries.length - 1) : 0;

    const points = performanceSeries.map((point, index) => ({
      ...point,
      x: padding.left + index * stepX,
      yMostBorrowed: toCountY(point.mostBorrowed),
      yActiveStudents: toCountY(point.activeStudents),
      yOverdueReports: toCountY(point.overdueReports),
      yEstimatedFines: toFinesY(point.estimatedFines),
    }));

    const createSegments = (
      key: "yMostBorrowed" | "yActiveStudents" | "yOverdueReports" | "yEstimatedFines"
    ) =>
      points.slice(1).map((point, index) => {
        const prev = points[index];
        const dx = point.x - prev.x;
        const dy = point[key] - prev[key];
        const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const centerX = prev.x + dx / 2;
        const centerY = prev[key] + dy / 2;
        return {
          left: centerX - length / 2,
          top: centerY - 1.5,
          width: length,
          angle,
        };
      });

    const countGrid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      y: baselineY - ratio * plotHeight,
      label: Math.round(maxCountValue * ratio),
    }));

    const finesGrid = [0, 0.5, 1].map((ratio) => ({
      y: baselineY - ratio * plotHeight,
      label: formatCurrency(Number((maxFinesValue * ratio).toFixed(2))),
    }));

    return {
      chartWidth,
      chartHeight,
      padding,
      points,
      countGrid,
      finesGrid,
      mostBorrowedSegments: createSegments("yMostBorrowed"),
      activeStudentsSegments: createSegments("yActiveStudents"),
      overdueReportsSegments: createSegments("yOverdueReports"),
      estimatedFinesSegments: createSegments("yEstimatedFines"),
    };
  }, [performanceSeries]);

  const roleLabel = getRoleLabel(user?.role, user?.is_working_student);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.bgBlue} />
        <View style={styles.bgAmber} />
        <View style={styles.bgCenter} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroGlowPrimary} />
            <View style={styles.heroGlowSecondary} />

            <Text style={styles.eyebrow}>Dashboard</Text>
            <Text style={styles.title}>Welcome, {user?.full_name ?? "Reader"}</Text>
            <Text style={styles.subtitle}>
              {isLibrarianDesk
                ? "Manage the library desk with a clean view of requests, activity, and borrowing performance."
                : "Your mobile dashboard stays synced with the same library account and records used in the web app."}
            </Text>

            <View style={styles.heroChipRow}>
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>{roleLabel}</Text>
              </View>
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>
                  {isLibrarianDesk ? "Desk Mode" : "Reader Mode"}
                </Text>
              </View>
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>
                  {unreadNotifications} unread notification
                  {unreadNotifications === 1 ? "" : "s"}
                </Text>
              </View>
            </View>

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatCard}>
                <Text style={styles.heroStatLabel}>Unread</Text>
                <Text style={styles.heroStatValue}>{unreadNotifications}</Text>
                <Text style={styles.heroStatNote}>Reminders and updates</Text>
              </View>
              <View style={styles.heroStatCard}>
                <Text style={styles.heroStatLabel}>
                  {isLibrarianDesk ? "Pending" : "Access"}
                </Text>
                <Text style={styles.heroStatValue}>
                  {isLibrarianDesk
                    ? analyticsLoading
                      ? "--"
                      : pendingBorrowRequests.length
                    : "Synced"}
                </Text>
                <Text style={styles.heroStatNote}>
                  {isLibrarianDesk ? "Requests waiting review" : "Web and mobile aligned"}
                </Text>
              </View>
              <View style={styles.heroStatCard}>
                <Text style={styles.heroStatLabel}>
                  {isLibrarianDesk ? "Overdue" : "Profile"}
                </Text>
                <Text style={styles.heroStatValue}>
                  {isLibrarianDesk ? overdueRequests.length : roleLabel}
                </Text>
                <Text style={styles.heroStatNote}>
                  {isLibrarianDesk ? "Active overdue items" : "Current account role"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTextWrap}>
                <Text style={styles.sectionEyebrow}>Navigation</Text>
                <Text style={styles.sectionTitle}>Quick Access</Text>
              </View>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{shortcutCount} shortcuts</Text>
              </View>
            </View>

            <View style={styles.actionGrid}>
              <Pressable style={styles.actionCard} onPress={() => navigation.navigate("Books")}>
                <Text style={styles.actionEyebrow}>Catalog</Text>
                <Text style={styles.actionTitle}>Browse Books</Text>
                <Text style={styles.actionCopy}>
                  Search the collection and submit borrow requests.
                </Text>
              </Pressable>

              <Pressable style={styles.actionCard} onPress={() => navigation.navigate("MyBooks")}>
                <Text style={styles.actionEyebrow}>Tracking</Text>
                <Text style={styles.actionTitle}>My Books</Text>
                <Text style={styles.actionCopy}>
                  Follow pending, borrowed, and returned items.
                </Text>
              </Pressable>

              <Pressable style={styles.actionCard} onPress={() => navigation.navigate("Profile")}>
                <Text style={styles.actionEyebrow}>Account</Text>
                <Text style={styles.actionTitle}>Profile</Text>
                <Text style={styles.actionCopy}>
                  Review your details, fines, and access status.
                </Text>
              </Pressable>

              <Pressable style={styles.actionCard} onPress={() => navigation.navigate("Documents")}>
                <Text style={styles.actionEyebrow}>Loan App</Text>
                <Text style={styles.actionTitle}>Documents</Text>
                <Text style={styles.actionCopy}>
                  Fill out applicant details and upload required documents.
                </Text>
              </Pressable>

              <Pressable
                style={styles.actionCard}
                onPress={() => navigation.navigate("ReadingHistory")}
              >
                <Text style={styles.actionEyebrow}>Records</Text>
                <Text style={styles.actionTitle}>Reading History</Text>
                <Text style={styles.actionCopy}>
                  Revisit returned books and past borrow activity.
                </Text>
              </Pressable>

              <Pressable
                style={styles.actionCard}
                onPress={() => navigation.navigate("MyReservations")}
              >
                <Text style={styles.actionEyebrow}>Queue</Text>
                <Text style={styles.actionTitle}>Reservations</Text>
                <Text style={styles.actionCopy}>
                  Monitor your reservation status and queue position.
                </Text>
              </Pressable>

              <Pressable
                style={styles.actionCard}
                onPress={() => navigation.navigate("Notifications")}
              >
                <Text style={styles.actionEyebrow}>Updates</Text>
                <Text style={styles.actionTitle}>Notifications</Text>
                <Text style={styles.actionCopy}>
                  Read due reminders, approvals, and alerts. {unreadNotifications} unread.
                </Text>
              </Pressable>

              {isLibrarianDesk ? (
                <Pressable
                  style={styles.actionCard}
                  onPress={() => navigation.navigate("LibrarianDesk")}
                >
                  <Text style={styles.actionEyebrow}>Desk</Text>
                  <Text style={styles.actionTitle}>Librarian Desk</Text>
                  <Text style={styles.actionCopy}>
                    Review pending accounts, circulation queues, and fine actions.
                  </Text>
                </Pressable>
              ) : null}

              {showStaffDesk ? (
                <Pressable
                  style={styles.actionCard}
                  onPress={() => navigation.navigate("StaffDesk")}
                >
                  <Text style={styles.actionEyebrow}>Desk</Text>
                  <Text style={styles.actionTitle}>Staff Desk</Text>
                  <Text style={styles.actionCopy}>
                    Process borrow and return queues from the mobile desk.
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {isLibrarianDesk ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTextWrap}>
                  <Text style={styles.sectionEyebrow}>Librarian Desk</Text>
                  <Text style={styles.sectionTitle}>Performance Overview</Text>
                </View>
                <Pressable style={styles.refreshButton} onPress={() => void loadLibrarianAnalytics()}>
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </Pressable>
              </View>

              {analyticsLoading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color={webTheme.colors.accentCoolStrong} />
                  <Text style={styles.loadingText}>Loading analytics...</Text>
                </View>
              ) : analyticsError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{analyticsError}</Text>
                </View>
              ) : (
                <>
                  <View style={styles.metricGrid}>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Most Borrowed</Text>
                      <Text style={styles.metricValue}>{mostBorrowedBooks[0]?.count ?? 0}</Text>
                      <Text style={styles.metricNote} numberOfLines={1}>
                        {mostBorrowedBooks[0]?.title ?? "No borrow activity yet"}
                      </Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Active Readers</Text>
                      <Text style={styles.metricValue}>{activeStudentsCount}</Text>
                      <Text style={styles.metricNote}>Users with recorded activity</Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Overdue Reports</Text>
                      <Text style={styles.metricValue}>{overdueRequests.length}</Text>
                      <Text style={styles.metricNote}>Books currently overdue</Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Estimated Fines</Text>
                      <Text style={styles.metricValue}>{formatCurrency(totalOverdueFees)}</Text>
                      <Text style={styles.metricNote}>Based on active overdue records</Text>
                    </View>
                  </View>

                  {latestPerformancePoint ? (
                    <View style={styles.highlightCard}>
                      <Text style={styles.highlightLabel}>Latest Month Snapshot</Text>
                      <Text style={styles.highlightTitle}>
                        {latestPerformancePoint.activeStudents} active reader
                        {latestPerformancePoint.activeStudents === 1 ? "" : "s"} this month
                      </Text>
                      <Text style={styles.highlightCopy}>
                        Most borrowed peak: {latestPerformancePoint.mostBorrowed}, overdue
                        reports: {latestPerformancePoint.overdueReports}, estimated fines:{" "}
                        {formatCurrency(latestPerformancePoint.estimatedFines)}.
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>KPI Trend</Text>
                    <Text style={styles.chartSubtitle}>
                      Last 6 months for most borrowed, active students, overdue reports,
                      and estimated fines.
                    </Text>

                    <View style={styles.legendWrap}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: "#38bdf8" }]} />
                        <Text style={styles.legendText}>Most Borrowed</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: "#86efac" }]} />
                        <Text style={styles.legendText}>Active Students</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: "#fbbf24" }]} />
                        <Text style={styles.legendText}>Overdue Reports</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: "#fda4af" }]} />
                        <Text style={styles.legendText}>Estimated Fines</Text>
                      </View>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View
                        style={[
                          styles.chartCanvas,
                          {
                            width: performanceChart.chartWidth,
                            height: performanceChart.chartHeight,
                          },
                        ]}
                      >
                        {performanceChart.countGrid.map((grid) => (
                          <View key={`grid-${grid.y}`}>
                            <View
                              style={[
                                styles.gridLine,
                                {
                                  top: grid.y,
                                  left: performanceChart.padding.left,
                                  right: performanceChart.padding.right,
                                },
                              ]}
                            />
                            <Text style={[styles.leftAxisLabel, { top: grid.y - 8 }]}>
                              {grid.label}
                            </Text>
                          </View>
                        ))}

                        {performanceChart.finesGrid.map((grid) => (
                          <Text
                            key={`fine-${grid.y}`}
                            style={[styles.rightAxisLabel, { top: grid.y - 8 }]}
                          >
                            {grid.label}
                          </Text>
                        ))}

                        {performanceChart.mostBorrowedSegments.map((segment, index) => (
                          <View
                            key={`mb-${index}`}
                            style={[
                              styles.chartLine,
                              {
                                left: segment.left,
                                top: segment.top,
                                width: segment.width,
                                backgroundColor: "#38bdf8",
                                transform: [{ rotate: `${segment.angle}deg` }],
                              },
                            ]}
                          />
                        ))}
                        {performanceChart.activeStudentsSegments.map((segment, index) => (
                          <View
                            key={`as-${index}`}
                            style={[
                              styles.chartLine,
                              {
                                left: segment.left,
                                top: segment.top,
                                width: segment.width,
                                backgroundColor: "#86efac",
                                transform: [{ rotate: `${segment.angle}deg` }],
                              },
                            ]}
                          />
                        ))}
                        {performanceChart.overdueReportsSegments.map((segment, index) => (
                          <View
                            key={`od-${index}`}
                            style={[
                              styles.chartLine,
                              {
                                left: segment.left,
                                top: segment.top,
                                width: segment.width,
                                backgroundColor: "#fbbf24",
                                transform: [{ rotate: `${segment.angle}deg` }],
                              },
                            ]}
                          />
                        ))}
                        {performanceChart.estimatedFinesSegments.map((segment, index) => (
                          <View
                            key={`fn-${index}`}
                            style={[
                              styles.chartLine,
                              {
                                left: segment.left,
                                top: segment.top,
                                width: segment.width,
                                backgroundColor: "#fda4af",
                                transform: [{ rotate: `${segment.angle}deg` }],
                              },
                            ]}
                          />
                        ))}

                        {performanceChart.points.map((point) => (
                          <View key={point.key}>
                            <View
                              style={[
                                styles.pointDot,
                                {
                                  left: point.x - 4,
                                  top: point.yMostBorrowed - 4,
                                  backgroundColor: "#38bdf8",
                                },
                              ]}
                            />
                            <View
                              style={[
                                styles.pointDot,
                                {
                                  left: point.x - 3.5,
                                  top: point.yActiveStudents - 3.5,
                                  width: 7,
                                  height: 7,
                                  borderRadius: 3.5,
                                  backgroundColor: "#86efac",
                                },
                              ]}
                            />
                            <View
                              style={[
                                styles.pointDot,
                                {
                                  left: point.x - 3,
                                  top: point.yOverdueReports - 3,
                                  width: 6,
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: "#fbbf24",
                                },
                              ]}
                            />
                            <View
                              style={[
                                styles.pointDot,
                                {
                                  left: point.x - 3,
                                  top: point.yEstimatedFines - 3,
                                  width: 6,
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: "#fda4af",
                                },
                              ]}
                            />
                            <Text style={[styles.xAxisLabel, { left: point.x - 14 }]}>
                              {point.label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </ScrollView>

                    {latestPerformancePoint ? (
                      <View style={styles.latestKpiRow}>
                        <View style={styles.latestKpiItem}>
                          <Text style={styles.latestKpiLabel}>Most Borrowed</Text>
                          <Text style={styles.latestKpiValue}>
                            {latestPerformancePoint.mostBorrowed}
                          </Text>
                        </View>
                        <View style={styles.latestKpiItem}>
                          <Text style={styles.latestKpiLabel}>Active Students</Text>
                          <Text style={styles.latestKpiValue}>
                            {latestPerformancePoint.activeStudents}
                          </Text>
                        </View>
                        <View style={styles.latestKpiItem}>
                          <Text style={styles.latestKpiLabel}>Overdue Reports</Text>
                          <Text style={styles.latestKpiValue}>
                            {latestPerformancePoint.overdueReports}
                          </Text>
                        </View>
                        <View style={styles.latestKpiItem}>
                          <Text style={styles.latestKpiLabel}>Estimated Fines</Text>
                          <Text style={styles.latestKpiValue}>
                            {formatCurrency(latestPerformancePoint.estimatedFines)}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.twoColumnWrap}>
                    <View style={styles.listCard}>
                      <Text style={styles.listTitle}>Top Borrowed Titles</Text>
                      {mostBorrowedBooks.length > 0 ? (
                        mostBorrowedBooks.map((item, index) => (
                          <View key={item.id} style={styles.listRow}>
                            <Text style={styles.listIndex}>{index + 1}</Text>
                            <View style={styles.listTextWrap}>
                              <Text style={styles.listCopy} numberOfLines={1}>
                                {item.title}
                              </Text>
                              <Text style={styles.listMeta}>
                                {item.count} borrow{item.count === 1 ? "" : "s"}
                              </Text>
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.listEmpty}>No borrowing data available yet.</Text>
                      )}
                    </View>

                    <View style={styles.listCard}>
                      <Text style={styles.listTitle}>Most Active Readers</Text>
                      {mostActiveStudents.length > 0 ? (
                        mostActiveStudents.map((item, index) => (
                          <View key={item.id} style={styles.listRow}>
                            <Text style={styles.listIndex}>{index + 1}</Text>
                            <View style={styles.listTextWrap}>
                              <Text style={styles.listCopy} numberOfLines={1}>
                                {item.fullName}
                              </Text>
                              <Text style={styles.listMeta}>
                                {item.studentId} - {item.requests} request
                                {item.requests === 1 ? "" : "s"}
                              </Text>
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.listEmpty}>No activity data available yet.</Text>
                      )}
                    </View>
                  </View>
                </>
              )}
            </View>
          ) : null}

          <View style={styles.roleRow}>
            <Text style={styles.roleKey}>Current role</Text>
            <Text style={styles.roleValue}>{roleLabel}</Text>
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
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "rgba(245,158,11,0.12)",
    right: -140,
    bottom: -150,
  },
  bgCenter: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 999,
    backgroundColor: "rgba(2,132,199,0.08)",
    left: "8%",
    top: "18%",
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
    width: 190,
    height: 190,
    borderRadius: 999,
    backgroundColor: "rgba(2,132,199,0.24)",
    top: -78,
    left: -42,
  },
  heroGlowSecondary: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: "rgba(245,158,11,0.16)",
    bottom: -64,
    right: -40,
  },
  eyebrow: {
    color: "#7dd3fc",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    fontWeight: "800",
  },
  title: {
    color: webTheme.colors.darkInk,
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: "rgba(232,241,255,0.74)",
    fontSize: 14,
    lineHeight: 20,
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
  heroStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroStatCard: {
    width: "31.8%",
    minWidth: 98,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 3,
  },
  heroStatLabel: {
    color: "rgba(232,241,255,0.56)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  heroStatValue: {
    color: webTheme.colors.darkInk,
    fontSize: 16,
    fontWeight: "800",
  },
  heroStatNote: {
    color: "rgba(232,241,255,0.68)",
    fontSize: 11,
    lineHeight: 15,
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
  sectionTextWrap: {
    flex: 1,
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
  sectionBadgeText: {
    color: "rgba(232,241,255,0.78)",
    fontSize: 11,
    fontWeight: "700",
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionCard: {
    width: "48%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  actionEyebrow: {
    color: "#7dd3fc",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontWeight: "800",
  },
  actionTitle: {
    color: webTheme.colors.darkInk,
    fontSize: 16,
    fontWeight: "800",
  },
  actionCopy: {
    color: "rgba(232,241,255,0.68)",
    fontSize: 12,
    lineHeight: 18,
  },
  refreshButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  refreshButtonText: {
    color: webTheme.colors.darkInk,
    fontSize: 12,
    fontWeight: "700",
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
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    width: "48%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  metricLabel: {
    color: "rgba(232,241,255,0.56)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  metricValue: {
    marginTop: 4,
    color: webTheme.colors.darkInk,
    fontSize: 18,
    fontWeight: "800",
  },
  metricNote: {
    marginTop: 4,
    color: "rgba(232,241,255,0.68)",
    fontSize: 11,
    lineHeight: 16,
  },
  highlightCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.36)",
    backgroundColor: "rgba(120,53,15,0.3)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  highlightLabel: {
    color: "#fcd34d",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontWeight: "800",
  },
  highlightTitle: {
    color: "#fff7ed",
    fontSize: 17,
    fontWeight: "800",
  },
  highlightCopy: {
    color: "rgba(255,237,213,0.82)",
    fontSize: 12,
    lineHeight: 18,
  },
  chartCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(5,15,34,0.82)",
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 8,
  },
  chartTitle: {
    color: webTheme.colors.darkInk,
    fontSize: 15,
    fontWeight: "800",
  },
  chartSubtitle: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  legendWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  chartCanvas: {
    marginTop: 4,
    position: "relative",
  },
  gridLine: {
    position: "absolute",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  leftAxisLabel: {
    position: "absolute",
    left: 0,
    width: 28,
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    textAlign: "right",
  },
  rightAxisLabel: {
    position: "absolute",
    right: 0,
    width: 60,
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    textAlign: "left",
  },
  chartLine: {
    position: "absolute",
    height: 3,
    borderRadius: 999,
  },
  pointDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  xAxisLabel: {
    position: "absolute",
    top: 196,
    width: 28,
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    textAlign: "center",
  },
  latestKpiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  latestKpiItem: {
    width: "48%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  latestKpiLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  latestKpiValue: {
    marginTop: 4,
    color: webTheme.colors.darkInk,
    fontSize: 13,
    fontWeight: "800",
  },
  twoColumnWrap: {
    gap: 10,
  },
  listCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  listTitle: {
    color: webTheme.colors.darkInk,
    fontSize: 14,
    fontWeight: "800",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  listIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: "center",
    textAlignVertical: "center",
    color: "#111827",
    backgroundColor: "#f59e0b",
    fontSize: 11,
    fontWeight: "800",
    paddingTop: 3,
  },
  listTextWrap: {
    flex: 1,
    gap: 1,
  },
  listCopy: {
    color: webTheme.colors.darkInk,
    fontSize: 13,
    fontWeight: "700",
  },
  listMeta: {
    color: "rgba(232,241,255,0.68)",
    fontSize: 11,
  },
  listEmpty: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 12,
  },
  roleRow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  roleKey: {
    color: "rgba(232,241,255,0.62)",
    fontSize: 12,
    fontWeight: "700",
  },
  roleValue: {
    color: "#7dd3fc",
    fontSize: 12,
    fontWeight: "800",
  },
});
