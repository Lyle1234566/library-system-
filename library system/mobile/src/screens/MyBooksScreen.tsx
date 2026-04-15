import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { booksApi } from "../api/books";
import { useAuth } from "../auth/AuthContext";
import { resolveMediaUrl } from "../config/api";
import { RootStackParamList } from "../navigation/RootNavigator";
import { webTheme } from "../theme/webTheme";
import { BorrowRequest } from "../types";
import { canOpenLibrarianDesk, hasStaffDeskAccess } from "../utils/roles";

type FilterKey = "ALL" | "APPROVED" | "PENDING" | "RETURNED" | "REJECTED";
type DueAlertLevel = "OVERDUE" | "TODAY" | "SOON";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "All Books" },
  { key: "APPROVED", label: "Borrowed" },
  { key: "PENDING", label: "Pending" },
  { key: "RETURNED", label: "Returned" },
  { key: "REJECTED", label: "Rejected" },
];

const STATUS_LABEL: Record<BorrowRequest["status"], string> = {
  PENDING: "Pending",
  APPROVED: "Borrowed",
  REJECTED: "Rejected",
  RETURNED: "Returned",
};

const formatDate = (value?: string | null): string => {
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

const parseAmount = (value?: string | number | null): number => {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value?: string | number | null): string => {
  return `PHP ${parseAmount(value).toFixed(2)}`;
};

const getDaysUntil = (value?: string | null): number | null => {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const dueDate = new Date(normalized);
  if (Number.isNaN(dueDate.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const formatRelativeDue = (value?: string | null): string => {
  const days = getDaysUntil(value);
  if (days === null) return "";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return "Overdue by 1 day";
  return `Overdue by ${Math.abs(days)} days`;
};

const formatDaysLeft = (value?: string | null): string => {
  const days = getDaysUntil(value);
  if (days === null) return "Days left: N/A";
  if (days <= 0) return "Days left: 0";
  return `Days left: ${days}`;
};

const formatReportingFrequency = (value?: string | null): string => {
  if (value === "WEEKLY") return "Weekly";
  if (value === "MONTHLY") return "Monthly";
  return "None";
};

const isTeacherReportingRequest = (request: BorrowRequest): boolean =>
  Boolean(
    request.user?.role === "TEACHER" &&
      request.status === "APPROVED" &&
      request.reporting_frequency &&
      request.reporting_frequency !== "NONE"
  );

export const MyBooksScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isDeskBorrowedView = Boolean(user && (canOpenLibrarianDesk(user) || hasStaffDeskAccess(user)));
  const deskLabel = canOpenLibrarianDesk(user) ? "Librarian Desk" : "Staff Desk";
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [query, setQuery] = useState("");
  const [renewingRequestId, setRenewingRequestId] = useState<number | null>(null);
  const [reportingRequestId, setReportingRequestId] = useState<number | null>(null);

  useEffect(() => {
    if (isDeskBorrowedView) {
      setFilter("APPROVED");
    } else {
      setFilter("ALL");
    }
  }, [isDeskBorrowedView]);

  const loadRequests = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const result = await booksApi.getBorrowRequests(isDeskBorrowedView ? "APPROVED" : undefined);
    if (result.error || !result.data) {
      setError(
        result.error ??
          (isDeskBorrowedView
            ? "Unable to load all borrowed books for librarian desk."
            : "Unable to load your requests.")
      );
      if (!isRefresh) setRequests([]);
    } else {
      setError(null);
      setRequests(result.data);
    }

    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }, [isDeskBorrowedView]);

  useFocusEffect(
    useCallback(() => {
      void loadRequests();
    }, [loadRequests])
  );

  const stats = useMemo(() => {
    const approved = requests.filter((request) => request.status === "APPROVED").length;
    const pending = requests.filter((request) => request.status === "PENDING").length;
    const returned = requests.filter((request) => request.status === "RETURNED").length;
    const rejected = requests.filter((request) => request.status === "REJECTED").length;
    return { total: requests.length, approved, pending, returned, rejected };
  }, [requests]);

  const borrowOverview = useMemo(() => {
    const approvedRequests = requests.filter((request) => request.status === "APPROVED");
    const overdueRequests = approvedRequests.filter((request) => (request.overdue_days ?? 0) > 0);
    const totalOverdueFine = overdueRequests.reduce(
      (sum, request) => sum + parseAmount(request.late_fee_amount),
      0
    );

    return {
      borrowedCount: approvedRequests.length,
      overdueCount: overdueRequests.length,
      totalOverdueFine,
    };
  }, [requests]);

  const dueAlerts = useMemo(() => {
    return requests
      .filter(
        (request) =>
          request.status === "APPROVED" &&
          Boolean(
            isTeacherReportingRequest(request)
              ? request.next_report_due_date
              : request.due_date
          )
      )
      .map((request) => {
        const scheduleDate = isTeacherReportingRequest(request)
          ? request.next_report_due_date
          : request.due_date;
        const days = getDaysUntil(scheduleDate);
        if (days === null) return null;

        let level: DueAlertLevel | null = null;
        if (days < 0) level = "OVERDUE";
        else if (days === 0) level = "TODAY";
        else if (days <= 3) level = "SOON";

        if (!level) return null;

        return {
          requestId: request.id,
          bookId: request.book.id,
          title: request.book.title,
          scheduleDate: scheduleDate as string,
          kind: isTeacherReportingRequest(request) ? "REPORT" : "DUE",
          level,
          days,
          overdueDays: request.overdue_days ?? Math.max(Math.abs(days), 0),
          fineAmount: request.late_fee_amount ?? "0",
        };
      })
      .filter(
        (
          item
        ): item is {
          requestId: number;
          bookId: number;
          title: string;
          scheduleDate: string;
          kind: "REPORT" | "DUE";
          level: DueAlertLevel;
          days: number;
          overdueDays: number;
          fineAmount: string;
        } => item !== null
      )
      .sort((a, b) => a.days - b.days);
  }, [requests]);

  const filtered = useMemo(() => {
    let data = requests;

    if (filter !== "ALL") {
      data = data.filter((request) => request.status === filter);
    }

    const normalized = query.trim().toLowerCase();
    if (!normalized) return data;

    return data.filter((request) => {
      const title = request.book.title.toLowerCase();
      const author = (request.book.author ?? "").toLowerCase();
      const receipt = (request.receipt_number ?? "").toLowerCase();
      const borrower = (request.user?.full_name ?? "").toLowerCase();
      const borrowerStudentId = (request.user?.student_id ?? "").toLowerCase();
      const borrowerStaffId = (request.user?.staff_id ?? "").toLowerCase();
      return (
        title.includes(normalized) ||
        author.includes(normalized) ||
        receipt.includes(normalized) ||
        borrower.includes(normalized) ||
        borrowerStudentId.includes(normalized) ||
        borrowerStaffId.includes(normalized)
      );
    });
  }, [filter, query, requests]);

  const resolveStatusStyle = (status: BorrowRequest["status"]) => {
    if (status === "APPROVED") return styles.statusBorrowed;
    if (status === "PENDING") return styles.statusPending;
    if (status === "RETURNED") return styles.statusReturned;
    return styles.statusRejected;
  };

  const onRenew = async (request: BorrowRequest) => {
    if (renewingRequestId) return;
    setRenewingRequestId(request.id);
    setError(null);
    const result = await booksApi.renewBorrow(request.id);
    if (result.error) {
      setError(result.error);
      setRenewingRequestId(null);
      return;
    }
    const updated = result.data?.request;
    setRequests((prev) =>
      prev.map((item) => {
        if (item.id !== request.id) return item;
        if (!updated) {
          return {
            ...item,
            renewal_count: (item.renewal_count ?? 0) + 1,
          };
        }
        return { ...item, ...updated };
      })
    );
    setRenewingRequestId(null);
  };

  const onSubmitReport = async (request: BorrowRequest) => {
    if (reportingRequestId) return;
    setReportingRequestId(request.id);
    setError(null);
    const result = await booksApi.submitBorrowReport(request.id);
    if (result.error || !result.data?.request) {
      setError(result.error ?? "Unable to submit borrow report.");
      setReportingRequestId(null);
      return;
    }
    setRequests((prev) =>
      prev.map((item) => (item.id === request.id ? { ...item, ...result.data!.request } : item))
    );
    setReportingRequestId(null);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.bgBlue} />
      <View style={styles.bgAmber} />
      <View style={styles.bgCenter} />

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadRequests(true)} />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={styles.heroCard}>
              <View style={styles.heroGlowPrimary} />
              <View style={styles.heroGlowSecondary} />

              <Text style={styles.eyebrow}>
                {isDeskBorrowedView ? deskLabel : "Your Reading Space"}
              </Text>
              <Text style={styles.heading}>{isDeskBorrowedView ? "Borrowed Books" : "My Books"}</Text>
              <Text style={styles.subheading}>
                {isDeskBorrowedView
                  ? "A live view of every active borrow currently out of the library."
                  : "Keep track of requests, active borrows, due dates, and return status in one place."}
              </Text>

              <View style={styles.heroChipRow}>
                <View style={styles.heroChip}>
                  <Text style={styles.heroChipText}>Active {stats.approved}</Text>
                </View>
                <View style={styles.heroChip}>
                  <Text style={styles.heroChipText}>Alerts {dueAlerts.length}</Text>
                </View>
                <View style={styles.heroChip}>
                  <Text style={styles.heroChipText}>
                    Fine {borrowOverview.totalOverdueFine > 0 ? formatCurrency(borrowOverview.totalOverdueFine) : "PHP 0.00"}
                  </Text>
                </View>
              </View>

              {!isDeskBorrowedView ? (
                <View style={styles.quickActionsRow}>
                  <Pressable style={styles.quickActionButton} onPress={() => navigation.navigate("ReadingHistory")}>
                    <Text style={styles.quickActionText}>Reading History</Text>
                  </Pressable>
                  <Pressable style={styles.quickActionButton} onPress={() => navigation.navigate("MyReservations")}>
                    <Text style={styles.quickActionText}>Reservations</Text>
                  </Pressable>
                  <Pressable style={styles.quickActionButton} onPress={() => navigation.navigate("Notifications")}>
                    <Text style={styles.quickActionText}>Notifications</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>Overview</Text>
                  <Text style={styles.sectionTitle}>Borrow Snapshot</Text>
                </View>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>{stats.total} total</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Total</Text>
                  <Text style={styles.statValue}>{stats.total}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Borrowed</Text>
                  <Text style={styles.statValue}>{stats.approved}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Pending</Text>
                  <Text style={styles.statValue}>{stats.pending}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Returned</Text>
                  <Text style={styles.statValue}>{stats.returned}</Text>
                </View>
              </View>
            </View>

            <View style={styles.borrowSummaryCard}>
              <Text style={styles.borrowSummaryLabel}>Borrow Health</Text>
              <Text style={styles.borrowSummaryTitle}>{borrowOverview.borrowedCount} books currently active</Text>
              <Text style={styles.borrowSummaryText}>
                {borrowOverview.overdueCount > 0
                  ? `${borrowOverview.overdueCount} overdue item${borrowOverview.overdueCount === 1 ? "" : "s"} need attention.`
                  : "No overdue returns at the moment."}
              </Text>
              <Text style={styles.borrowSummaryFine}>
                Current fine exposure: PHP {borrowOverview.totalOverdueFine.toFixed(2)}
              </Text>
            </View>

            <View style={styles.alertCard}>
              <View style={styles.alertHeader}>
                <View>
                  <Text style={styles.alertTitle}>Borrow Alerts</Text>
                  <Text style={styles.alertSubtitle}>Books or reports that need attention soon</Text>
                </View>
                <Text style={[styles.alertCount, dueAlerts.length > 0 && styles.alertCountActive]}>
                  {dueAlerts.length > 0
                    ? `${dueAlerts.length} alert${dueAlerts.length > 1 ? "s" : ""}`
                    : "No urgent due dates"}
                </Text>
              </View>

              {dueAlerts.length === 0 ? (
                <Text style={styles.alertEmptyText}>No overdue or near-due borrow alerts right now.</Text>
              ) : (
                <View style={styles.alertList}>
                  {dueAlerts.map((alert) => (
                    <Pressable
                      key={alert.requestId}
                      style={[
                        styles.alertItem,
                        alert.level === "OVERDUE"
                          ? styles.alertItemOverdue
                          : alert.level === "TODAY"
                            ? styles.alertItemToday
                            : styles.alertItemSoon,
                      ]}
                      onPress={() => navigation.navigate("BookDetails", { bookId: alert.bookId })}
                    >
                      <Text style={styles.alertItemTitle} numberOfLines={1}>
                        {alert.title}
                      </Text>
                      {alert.level === "OVERDUE" ? (
                        <Text style={[styles.alertItemCopy, styles.alertItemDanger]}>
                          {alert.kind === "REPORT"
                            ? `Report overdue by ${Math.abs(alert.days)} day${Math.abs(alert.days) === 1 ? "" : "s"}`
                            : `Failed to return: ${alert.overdueDays} day${alert.overdueDays === 1 ? "" : "s"} overdue - Fine: ${formatCurrency(alert.fineAmount)}`}
                        </Text>
                      ) : (
                        <Text style={styles.alertItemCopy}>
                          {(alert.kind === "REPORT" ? "Report due" : "Due") +
                            `: ${formatDate(alert.scheduleDate)} - ${formatRelativeDue(alert.scheduleDate)}`}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.searchCard}>
              <Text style={styles.searchLabel}>Search shelf</Text>
              <View style={styles.searchInputWrap}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  style={styles.searchInput}
                  placeholder={
                    isDeskBorrowedView
                      ? "Search by title, author, borrower, or receipt"
                      : "Search by title, author, or receipt"
                  }
                  placeholderTextColor={webTheme.colors.darkInkMuted}
                />
              </View>
            </View>

            {!isDeskBorrowedView ? (
              <View style={styles.filterCard}>
                <Text style={styles.filterHeaderTitle}>Status Filter</Text>
                <View style={styles.filterRow}>
                  {FILTERS.map((option) => (
                    <Pressable
                      key={option.key}
                      style={[styles.filterChip, filter === option.key && styles.filterChipActive]}
                      onPress={() => setFilter(option.key)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          filter === option.key && styles.filterChipTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.listSectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Collection</Text>
                <Text style={styles.listSectionTitle}>
                  {isDeskBorrowedView ? "Active Borrow Records" : "Your Borrow Requests"}
                </Text>
              </View>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>
                  {filtered.length} item{filtered.length === 1 ? "" : "s"}
                </Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={webTheme.colors.accentCoolStrong} />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No books found for this filter/search.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
            (() => {
              const canRenewOwnRequest = Boolean(
                user?.role === "STUDENT" &&
                  item.user?.id &&
                  user?.id &&
                  item.user.id === user.id
              );
              const isTeacherReporting = isTeacherReportingRequest(item);
              const scheduleDate = isTeacherReporting
                ? item.next_report_due_date
                : item.due_date;
              const imageUrl = resolveMediaUrl(item.book.cover_image);

              return (
                <Pressable
                  style={styles.requestCard}
                  onPress={() => navigation.navigate("BookDetails", { bookId: item.book.id })}
                >
                  <View style={styles.requestBodyRow}>
                    <View style={styles.requestCoverWrap}>
                      {imageUrl ? (
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.requestCoverImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.requestCoverPlaceholder}>
                          <Text style={styles.requestCoverPlaceholderText}>No Cover</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.requestBodyContent}>
                      <View style={styles.requestTopRow}>
                        <Text style={styles.requestTitle} numberOfLines={2}>
                          {item.book.title}
                        </Text>
                        <Text style={[styles.statusPill, resolveStatusStyle(item.status)]}>
                          {STATUS_LABEL[item.status]}
                        </Text>
                      </View>
                      <Text style={styles.requestMeta}>Author: {item.book.author}</Text>
                      {isDeskBorrowedView ? (
                        <>
                          <Text style={styles.requestMeta}>
                            Borrower: {item.user?.full_name ?? "Unknown borrower"}
                          </Text>
                          <Text style={styles.requestMeta}>
                            Borrower ID: {item.user?.student_id ?? item.user?.staff_id ?? "N/A"}
                          </Text>
                        </>
                      ) : null}
                      <Text style={styles.requestMeta}>Requested: {formatDate(item.requested_at)}</Text>
                      {isTeacherReporting ? (
                        <>
                          <Text style={styles.requestMeta}>No due date limit</Text>
                          <Text style={styles.requestMeta}>
                            Reporting: {formatReportingFrequency(item.reporting_frequency)}
                          </Text>
                        </>
                      ) : null}
                      {scheduleDate ? (
                        <Text style={styles.requestMeta}>
                          {isTeacherReporting ? "Next report" : "Due"}: {formatDate(scheduleDate)}
                        </Text>
                      ) : null}
                      {isTeacherReporting && item.last_reported_at ? (
                        <Text style={styles.requestMeta}>
                          Last report: {formatDate(item.last_reported_at)}
                        </Text>
                      ) : null}
                      {typeof item.renewal_count === "number" && typeof item.max_renewals === "number" ? (
                        <Text style={styles.requestMeta}>
                          Renewals: {item.renewal_count}/{item.max_renewals}
                        </Text>
                      ) : null}
                      {item.receipt_number ? (
                        <Text style={styles.requestMeta}>Receipt: {item.receipt_number}</Text>
                      ) : null}
                    </View>
                  </View>
                  {item.status === "APPROVED" ? (
                    <>
                      <Text style={styles.requestMeta}>
                        {formatRelativeDue(scheduleDate)}
                      </Text>
                      {!isTeacherReporting && (item.overdue_days ?? 0) > 0 ? (
                        <View style={styles.overdueBox}>
                          <Text style={styles.overdueTitle}>Due-date failed to return</Text>
                          <Text style={styles.overdueText}>
                            Overdue by {item.overdue_days} day{item.overdue_days === 1 ? "" : "s"}.
                          </Text>
                          <Text style={styles.overdueFineText}>
                            Fine charge: {formatCurrency(item.late_fee_amount)}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.borrowActiveBox}>
                          <Text style={styles.borrowActiveTitle}>
                            {isTeacherReporting ? "Reporting active" : "Borrow active"}
                          </Text>
                          <Text style={styles.borrowActiveText}>
                            {isTeacherReporting
                              ? formatRelativeDue(scheduleDate)
                              : formatDaysLeft(item.due_date)}
                          </Text>
                        </View>
                      )}
                    </>
                  ) : null}
                  {isTeacherReporting && item.status === "APPROVED" ? (
                    <Pressable
                      style={[
                        styles.renewButton,
                        reportingRequestId === item.id && styles.renewButtonDisabled,
                      ]}
                      disabled={reportingRequestId === item.id}
                      onPress={(event) => {
                        event.stopPropagation();
                        void onSubmitReport(item);
                      }}
                    >
                      {reportingRequestId === item.id ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.renewButtonText}>
                          Submit {formatReportingFrequency(item.reporting_frequency).toLowerCase()} report
                        </Text>
                      )}
                    </Pressable>
                  ) : null}
                  {canRenewOwnRequest &&
                  item.status === "APPROVED" &&
                  !isTeacherReporting &&
                  (item.renewal_count ?? 0) < (item.max_renewals ?? 2) &&
                  (item.overdue_days ?? 0) <= 0 ? (
                    <Pressable
                      style={[
                        styles.renewButton,
                        renewingRequestId === item.id && styles.renewButtonDisabled,
                      ]}
                      disabled={renewingRequestId === item.id}
                      onPress={(event) => {
                        event.stopPropagation();
                        void onRenew(item);
                      }}
                    >
                      {renewingRequestId === item.id ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.renewButtonText}>
                          Renew ({Math.max((item.max_renewals ?? 2) - (item.renewal_count ?? 0), 0)} left)
                        </Text>
                      )}
                    </Pressable>
                  ) : null}
                </Pressable>
              );
            })()
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: webTheme.colors.darkBg,
  },
  bgBlue: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 220,
    backgroundColor: "rgba(14,165,233,0.14)",
    left: -130,
    top: -80,
  },
  bgAmber: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 220,
    backgroundColor: "rgba(245,158,11,0.13)",
    right: -130,
    bottom: -150,
  },
  bgCenter: {
    position: "absolute",
    width: 440,
    height: 440,
    borderRadius: 280,
    backgroundColor: "rgba(2,132,199,0.08)",
    left: "10%",
    top: "15%",
  },
  listHeader: {
    paddingTop: 12,
    paddingBottom: 14,
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
  },
  heroGlowPrimary: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(2,132,199,0.24)",
    top: -78,
    left: -44,
  },
  heroGlowSecondary: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: "rgba(245,158,11,0.16)",
    bottom: -72,
    right: -42,
  },
  eyebrow: {
    color: "#7dd3fc",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    fontWeight: "800",
  },
  heading: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: "800",
    color: webTheme.colors.darkInk,
  },
  subheading: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(232,241,255,0.74)",
  },
  heroChipRow: {
    marginTop: 14,
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
    paddingVertical: 6,
  },
  heroChipText: {
    color: "rgba(232,241,255,0.78)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  quickActionsRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickActionText: {
    color: webTheme.colors.darkInk,
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
    fontSize: 18,
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
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  borrowSummaryCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.36)",
    backgroundColor: "rgba(120,53,15,0.3)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  borrowSummaryLabel: {
    color: "#fcd34d",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: "800",
  },
  borrowSummaryTitle: {
    color: "#fff7ed",
    fontSize: 18,
    fontWeight: "800",
  },
  borrowSummaryText: {
    color: "rgba(255,237,213,0.82)",
    fontSize: 13,
    lineHeight: 19,
  },
  borrowSummaryFine: {
    color: "#fbbf24",
    fontSize: 12,
    fontWeight: "800",
  },
  statCard: {
    width: "48%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingVertical: 10,
    paddingHorizontal: 10,
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
  alertCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(8,20,47,0.58)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  alertTitle: {
    color: webTheme.colors.darkInk,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  alertSubtitle: {
    marginTop: 3,
    color: webTheme.colors.darkInkMuted,
    fontSize: 12,
  },
  alertCount: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  alertCountActive: {
    color: "#fca5a5",
  },
  alertEmptyText: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 12,
  },
  alertList: {
    gap: 6,
  },
  alertItem: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  alertItemOverdue: {
    borderColor: "rgba(248,113,113,0.4)",
    backgroundColor: "rgba(127,29,29,0.45)",
  },
  alertItemToday: {
    borderColor: "rgba(251,191,36,0.4)",
    backgroundColor: "rgba(120,53,15,0.42)",
  },
  alertItemSoon: {
    borderColor: "rgba(56,189,248,0.4)",
    backgroundColor: "rgba(7,89,133,0.35)",
  },
  alertItemTitle: {
    color: webTheme.colors.darkInk,
    fontSize: 13,
    fontWeight: "700",
  },
  alertItemCopy: {
    color: "rgba(232,241,255,0.72)",
    fontSize: 11,
    lineHeight: 16,
  },
  alertItemDanger: {
    color: "#fecaca",
    fontWeight: "700",
  },
  searchCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(8,20,47,0.58)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  searchLabel: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  searchInputWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  searchInput: {
    color: webTheme.colors.darkInk,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(8,20,47,0.58)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterHeaderTitle: {
    color: webTheme.colors.darkInk,
    fontSize: 12,
    fontWeight: "800",
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipActive: {
    borderColor: "#f59e0b",
    backgroundColor: "#f59e0b",
  },
  filterChipText: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#111827",
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 44,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 28,
  },
  listSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 8,
  },
  listSectionTitle: {
    marginTop: 3,
    color: webTheme.colors.darkInk,
    fontSize: 22,
    fontWeight: "800",
  },
  requestCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(8,20,47,0.58)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 10,
  },
  requestBodyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  requestCoverWrap: {
    width: 84,
    aspectRatio: 3 / 4,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
    flexShrink: 0,
  },
  requestCoverImage: {
    width: "100%",
    height: "100%",
  },
  requestCoverPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  requestCoverPlaceholderText: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  requestBodyContent: {
    flex: 1,
    gap: 3,
  },
  requestTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  requestTitle: {
    flex: 1,
    color: webTheme.colors.darkInk,
    fontSize: 16,
    fontWeight: "800",
  },
  requestMeta: {
    color: "rgba(232,241,255,0.68)",
    fontSize: 12,
  },
  overdueBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.38)",
    backgroundColor: "rgba(127,29,29,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  overdueTitle: {
    color: "#fecaca",
    fontSize: 12,
    fontWeight: "800",
  },
  overdueText: {
    color: "#fee2e2",
    fontSize: 12,
    fontWeight: "700",
  },
  overdueFineText: {
    color: "#fda4af",
    fontSize: 12,
    fontWeight: "800",
  },
  borrowActiveBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.35)",
    backgroundColor: "rgba(7,89,133,0.32)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  borrowActiveTitle: {
    color: "#bae6fd",
    fontSize: 12,
    fontWeight: "800",
  },
  borrowActiveText: {
    color: "#e0f2fe",
    fontSize: 12,
    fontWeight: "700",
  },
  renewButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#0284c7",
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  renewButtonDisabled: {
    opacity: 0.7,
  },
  renewButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: "700",
    overflow: "hidden",
  },
  statusPending: {
    color: "#e0f2fe",
    backgroundColor: "rgba(56,189,248,0.22)",
  },
  statusBorrowed: {
    color: "#d1fae5",
    backgroundColor: "rgba(16,185,129,0.18)",
  },
  statusReturned: {
    color: "#e2e8f0",
    backgroundColor: "rgba(148,163,184,0.2)",
  },
  statusRejected: {
    color: "#fecaca",
    backgroundColor: "rgba(239,68,68,0.18)",
  },
  emptyWrap: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingVertical: 28,
    paddingHorizontal: 14,
  },
  emptyText: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 13,
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
