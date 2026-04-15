import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { authApi } from "../api/auth";
import { booksApi } from "../api/books";
import { useAuth } from "../auth/AuthContext";
import { RootStackParamList } from "../navigation/RootNavigator";
import { webTheme } from "../theme/webTheme";
import { BorrowRequest, BorrowRequestUser, FinePayment, ReturnRequest, User } from "../types";
import { canOpenLibrarianDesk, getRoleLabel, hasStaffDeskAccess, isWorkingStudent } from "../utils/roles";

type DeskMode = "staff" | "librarian";

type OperationsDeskProps = {
  mode: DeskMode;
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

const formatCurrency = (amount?: string | number | null) => {
  const parsed = typeof amount === "number" ? amount : Number.parseFloat(amount ?? "0");
  if (!Number.isFinite(parsed)) return "PHP 0.00";
  return `PHP ${parsed.toFixed(2)}`;
};

const getBorrowerId = (borrower?: BorrowRequestUser | Pick<User, "student_id" | "staff_id"> | null) =>
  borrower?.student_id ?? borrower?.staff_id ?? "N/A";

const SectionHeader = ({
  eyebrow,
  title,
  badge,
}: {
  eyebrow: string;
  title: string;
  badge?: string;
}) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionTextWrap}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {badge ? (
      <View style={styles.sectionBadge}>
        <Text style={styles.sectionBadgeText}>{badge}</Text>
      </View>
    ) : null}
  </View>
);

function OperationsDesk({ mode }: OperationsDeskProps) {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const canAccessMode = mode === "librarian" ? canOpenLibrarianDesk(user) : hasStaffDeskAccess(user);
  const canManageCirculation = Boolean(user && (canOpenLibrarianDesk(user) || hasStaffDeskAccess(user)));
  const canApproveAccounts = Boolean(
    user && (user.role === "ADMIN" || user.role === "LIBRARIAN" || isWorkingStudent(user))
  );
  const canManageFines = Boolean(
    user &&
      (user.role === "ADMIN" ||
        user.role === "LIBRARIAN" ||
        user.role === "STAFF" ||
        isWorkingStudent(user))
  );

  const [pendingAccounts, setPendingAccounts] = useState<User[]>([]);
  const [pendingBorrows, setPendingBorrows] = useState<BorrowRequest[]>([]);
  const [pendingReturns, setPendingReturns] = useState<ReturnRequest[]>([]);
  const [approvedBorrows, setApprovedBorrows] = useState<BorrowRequest[]>([]);
  const [pendingFines, setPendingFines] = useState<FinePayment[]>([]);
  const [workingStudentFlags, setWorkingStudentFlags] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const overdueBorrows = useMemo(
    () =>
      approvedBorrows
        .filter((request) => (request.overdue_days ?? 0) > 0)
        .sort((a, b) => (b.overdue_days ?? 0) - (a.overdue_days ?? 0)),
    [approvedBorrows]
  );

  const deskLabel = mode === "librarian" ? "Librarian Desk" : "Staff Desk";
  const deskSubtitle =
    mode === "librarian"
      ? "Review approvals, keep the queue moving, and manage desk operations from mobile."
      : "Process borrows and returns while keeping the circulation queue under control.";

  const loadDesk = useCallback(
    async (isRefresh = false) => {
      if (!canAccessMode) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const tasks = await Promise.all([
        canApproveAccounts ? authApi.getPendingStudents() : Promise.resolve({ data: [], error: null }),
        canManageCirculation ? booksApi.getBorrowRequests("PENDING") : Promise.resolve({ data: [], error: null }),
        canManageCirculation ? booksApi.getReturnRequests("PENDING") : Promise.resolve({ data: [], error: null }),
        canManageCirculation ? booksApi.getBorrowRequests("APPROVED") : Promise.resolve({ data: [], error: null }),
        canManageFines ? booksApi.getFinePayments("PENDING") : Promise.resolve({ data: [], error: null }),
      ]);

      const [accountsResult, borrowsResult, returnsResult, approvedResult, finesResult] = tasks;
      const firstError =
        accountsResult.error ||
        borrowsResult.error ||
        returnsResult.error ||
        approvedResult.error ||
        finesResult.error;

      if (firstError) {
        setError(firstError);
      } else {
        setError(null);
      }

      setPendingAccounts(accountsResult.data ?? []);
      setPendingBorrows(borrowsResult.data ?? []);
      setPendingReturns(returnsResult.data ?? []);
      setApprovedBorrows(approvedResult.data ?? []);
      setPendingFines(finesResult.data ?? []);
      setWorkingStudentFlags(
        (accountsResult.data ?? []).reduce<Record<number, boolean>>((acc, account) => {
          acc[account.id] = Boolean(account.is_working_student);
          return acc;
        }, {})
      );

      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    },
    [canAccessMode, canApproveAccounts, canManageCirculation, canManageFines]
  );

  useFocusEffect(
    useCallback(() => {
      void loadDesk();
    }, [loadDesk])
  );

  const onApproveAccount = async (account: User) => {
    const key = `account-${account.id}`;
    if (busyKey) return;
    setBusyKey(key);
    const result = await authApi.approveStudent(account.id, {
      is_working_student: account.role === "STUDENT" && Boolean(workingStudentFlags[account.id]),
    });
    if (result.error || !result.data) {
      setError(result.error ?? "Unable to approve account.");
    } else {
      setPendingAccounts((prev) => prev.filter((item) => item.id !== account.id));
    }
    setBusyKey(null);
  };

  const onBorrowDecision = async (requestId: number, approve: boolean) => {
    const key = `borrow-${requestId}`;
    if (busyKey) return;
    setBusyKey(key);
    const result = approve
      ? await booksApi.approveBorrowRequest(requestId)
      : await booksApi.rejectBorrowRequest(requestId);
    if (result.error || !result.data) {
      setError(result.error ?? "Unable to update borrow request.");
    } else {
      setPendingBorrows((prev) => prev.filter((item) => item.id !== requestId));
      void loadDesk();
    }
    setBusyKey(null);
  };

  const onReturnDecision = async (requestId: number, approve: boolean) => {
    const key = `return-${requestId}`;
    if (busyKey) return;
    setBusyKey(key);
    const result = approve
      ? await booksApi.approveReturnRequest(requestId)
      : await booksApi.rejectReturnRequest(requestId);
    if (result.error || !result.data) {
      setError(result.error ?? "Unable to update return request.");
    } else {
      setPendingReturns((prev) => prev.filter((item) => item.id !== requestId));
      void loadDesk();
    }
    setBusyKey(null);
  };

  const onFineAction = async (fine: FinePayment, action: "paid" | "waived") => {
    const key = `fine-${fine.id}-${action}`;
    if (busyKey) return;
    setBusyKey(key);
    const result =
      action === "paid"
        ? await booksApi.markFinePaid(fine.id, {
            payment_method: "CASH",
            payment_reference: `MOBILE-${fine.id}-${Date.now()}`,
            notes: "Processed from mobile desk",
          })
        : await booksApi.waiveFine(fine.id, "Waived from mobile desk");
    if (result.error || !result.data) {
      setError(result.error ?? "Unable to update fine payment.");
    } else {
      setPendingFines((prev) => prev.filter((item) => item.id !== fine.id));
    }
    setBusyKey(null);
  };

  if (!canAccessMode) {
    return (
      <View style={styles.centerWrap}>
        <Text style={styles.emptyTitle}>Access blocked</Text>
        <Text style={styles.emptyText}>Your account does not have permission to open this desk.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDesk(true)} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Operations</Text>
          <Text style={styles.heroTitle}>{deskLabel}</Text>
          <Text style={styles.heroSubtitle}>{deskSubtitle}</Text>
          <View style={styles.heroChipRow}>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipText}>{getRoleLabel(user?.role, user?.is_working_student)}</Text>
            </View>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipText}>{pendingBorrows.length + pendingReturns.length} queued</Text>
            </View>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipText}>{overdueBorrows.length} overdue</Text>
            </View>
          </View>
        </View>

        {!!error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={webTheme.colors.accentCoolStrong} />
            <Text style={styles.loadingText}>Loading desk data...</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Pending Borrows</Text>
                <Text style={styles.statValue}>{pendingBorrows.length}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Pending Returns</Text>
                <Text style={styles.statValue}>{pendingReturns.length}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Overdue</Text>
                <Text style={styles.statValue}>{overdueBorrows.length}</Text>
              </View>
              {(canApproveAccounts || canManageFines) && (
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>{canApproveAccounts ? "Pending Accounts" : "Pending Fines"}</Text>
                  <Text style={styles.statValue}>{canApproveAccounts ? pendingAccounts.length : pendingFines.length}</Text>
                </View>
              )}
            </View>

            {canApproveAccounts && pendingAccounts.length > 0 ? (
              <View style={styles.sectionCard}>
                <SectionHeader eyebrow="Approvals" title="Pending Accounts" badge={`${pendingAccounts.length} waiting`} />
                <View style={styles.listWrap}>
                  {pendingAccounts.map((account) => (
                    <View key={account.id} style={styles.itemCard}>
                      <View style={styles.itemTopRow}>
                        <View style={styles.itemTextWrap}>
                          <Text style={styles.itemTitle}>{account.full_name}</Text>
                          <Text style={styles.itemMeta}>
                            {account.role === "TEACHER" ? "Faculty ID" : "Student ID"}:{" "}
                            {account.staff_id ?? account.student_id ?? "N/A"}
                          </Text>
                          <Text style={styles.itemMeta}>
                            Role: {account.role === "TEACHER" ? "Teacher" : "Student"}
                          </Text>
                          <Text style={styles.itemMeta}>{account.email ?? "No email provided"}</Text>
                          <Text style={styles.itemMeta}>Joined: {formatDate(account.date_joined)}</Text>
                        </View>
                      </View>
                      {account.role === "STUDENT" ? (
                        <Pressable
                          style={styles.toggleRow}
                          onPress={() =>
                            setWorkingStudentFlags((prev) => ({
                              ...prev,
                              [account.id]: !prev[account.id],
                            }))
                          }
                        >
                          <View
                            style={[
                              styles.toggleDot,
                              workingStudentFlags[account.id] && styles.toggleDotActive,
                            ]}
                          />
                          <Text style={styles.toggleText}>Approve as working student</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        style={[styles.primaryButton, busyKey === `account-${account.id}` && styles.buttonDisabled]}
                        disabled={busyKey === `account-${account.id}`}
                        onPress={() => void onApproveAccount(account)}
                      >
                        {busyKey === `account-${account.id}` ? (
                          <ActivityIndicator size="small" color="#0f1c2e" />
                        ) : (
                          <Text style={styles.primaryButtonText}>Approve Account</Text>
                        )}
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.sectionCard}>
              <SectionHeader eyebrow="Circulation" title="Borrow Queue" badge={`${pendingBorrows.length} pending`} />
              {pendingBorrows.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No pending borrow requests right now.</Text>
                </View>
              ) : (
                <View style={styles.listWrap}>
                  {pendingBorrows.map((request) => (
                    <Pressable
                      key={request.id}
                      style={styles.itemCard}
                      onPress={() => navigation.navigate("BookDetails", { bookId: request.book.id })}
                    >
                      <Text style={styles.itemTitle}>{request.book.title}</Text>
                      <Text style={styles.itemMeta}>
                        Borrower: {request.user?.full_name ?? "Unknown"} ({getBorrowerId(request.user)})
                      </Text>
                      <Text style={styles.itemMeta}>Requested: {formatDate(request.requested_at)}</Text>
                      <View style={styles.actionsRow}>
                        <Pressable
                          style={[styles.primaryButton, busyKey === `borrow-${request.id}` && styles.buttonDisabled]}
                          disabled={busyKey === `borrow-${request.id}`}
                          onPress={() => void onBorrowDecision(request.id, true)}
                        >
                          <Text style={styles.primaryButtonText}>Approve</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.secondaryButton, busyKey === `borrow-${request.id}` && styles.buttonDisabled]}
                          disabled={busyKey === `borrow-${request.id}`}
                          onPress={() => void onBorrowDecision(request.id, false)}
                        >
                          <Text style={styles.secondaryButtonText}>Reject</Text>
                        </Pressable>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.sectionCard}>
              <SectionHeader eyebrow="Returns" title="Return Queue" badge={`${pendingReturns.length} pending`} />
              {pendingReturns.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No pending return requests right now.</Text>
                </View>
              ) : (
                <View style={styles.listWrap}>
                  {pendingReturns.map((request) => (
                    <Pressable
                      key={request.id}
                      style={styles.itemCard}
                      onPress={() => navigation.navigate("BookDetails", { bookId: request.book.id })}
                    >
                      <Text style={styles.itemTitle}>{request.book.title}</Text>
                      <Text style={styles.itemMeta}>
                        Borrower: {request.user?.full_name ?? "Unknown"} ({getBorrowerId(request.user)})
                      </Text>
                      <Text style={styles.itemMeta}>Requested: {formatDate(request.requested_at)}</Text>
                      <View style={styles.actionsRow}>
                        <Pressable
                          style={[styles.primaryButton, busyKey === `return-${request.id}` && styles.buttonDisabled]}
                          disabled={busyKey === `return-${request.id}`}
                          onPress={() => void onReturnDecision(request.id, true)}
                        >
                          <Text style={styles.primaryButtonText}>Approve</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.secondaryButton, busyKey === `return-${request.id}` && styles.buttonDisabled]}
                          disabled={busyKey === `return-${request.id}`}
                          onPress={() => void onReturnDecision(request.id, false)}
                        >
                          <Text style={styles.secondaryButtonText}>Reject</Text>
                        </Pressable>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.sectionCard}>
              <SectionHeader eyebrow="Monitoring" title="Overdue Books" badge={`${overdueBorrows.length} active`} />
              {overdueBorrows.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No overdue books need attention right now.</Text>
                </View>
              ) : (
                <View style={styles.listWrap}>
                  {overdueBorrows.map((request) => (
                    <Pressable
                      key={request.id}
                      style={styles.itemCard}
                      onPress={() => navigation.navigate("BookDetails", { bookId: request.book.id })}
                    >
                      <Text style={styles.itemTitle}>{request.book.title}</Text>
                      <Text style={styles.itemMeta}>
                        Borrower: {request.user?.full_name ?? "Unknown"} ({getBorrowerId(request.user)})
                      </Text>
                      <Text style={styles.itemMeta}>Due: {formatDate(request.due_date)}</Text>
                      <Text style={styles.itemMeta}>
                        Overdue: {request.overdue_days ?? 0} day{request.overdue_days === 1 ? "" : "s"}
                      </Text>
                      <Text style={styles.itemMeta}>Fine exposure: {formatCurrency(request.late_fee_amount)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {canManageFines ? (
              <View style={styles.sectionCard}>
                <SectionHeader eyebrow="Finance" title="Pending Fines" badge={`${pendingFines.length} pending`} />
                {pendingFines.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>No pending fine payments right now.</Text>
                  </View>
                ) : (
                  <View style={styles.listWrap}>
                    {pendingFines.map((fine) => (
                      <View key={fine.id} style={styles.itemCard}>
                        <Text style={styles.itemTitle}>{fine.book.title}</Text>
                        <Text style={styles.itemMeta}>
                          Borrower: {fine.user?.full_name ?? "Unknown"} ({getBorrowerId(fine.user)})
                        </Text>
                        <Text style={styles.itemMeta}>Amount: {formatCurrency(fine.amount)}</Text>
                        <Text style={styles.itemMeta}>Created: {formatDate(fine.created_at)}</Text>
                        <View style={styles.actionsRow}>
                          <Pressable
                            style={[styles.primaryButton, busyKey === `fine-${fine.id}-paid` && styles.buttonDisabled]}
                            disabled={busyKey === `fine-${fine.id}-paid`}
                            onPress={() =>
                              Alert.alert(
                                "Mark Fine Paid",
                                `Record ${formatCurrency(fine.amount)} as paid?`,
                                [
                                  { text: "Cancel", style: "cancel" },
                                  { text: "Confirm", onPress: () => void onFineAction(fine, "paid") },
                                ]
                              )
                            }
                          >
                            <Text style={styles.primaryButtonText}>Mark Paid</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.secondaryButton, busyKey === `fine-${fine.id}-waived` && styles.buttonDisabled]}
                            disabled={busyKey === `fine-${fine.id}-waived`}
                            onPress={() =>
                              Alert.alert(
                                "Waive Fine",
                                `Waive ${formatCurrency(fine.amount)} for this borrow?`,
                                [
                                  { text: "Cancel", style: "cancel" },
                                  { text: "Confirm", onPress: () => void onFineAction(fine, "waived") },
                                ]
                              )
                            }
                          >
                            <Text style={styles.secondaryButtonText}>Waive</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

export const StaffDeskScreen = () => <OperationsDesk mode="staff" />;

export const LibrarianDeskScreen = () => <OperationsDesk mode="librarian" />;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: webTheme.colors.darkBg,
  },
  scrollContent: {
    padding: 12,
    gap: 12,
    paddingBottom: 28,
  },
  heroCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(8,20,47,0.72)",
    padding: 16,
    gap: 12,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "rgba(179,194,217,0.82)",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: webTheme.colors.darkInk,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: webTheme.colors.darkInkMuted,
  },
  heroChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: webTheme.colors.darkInk,
  },
  errorBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.28)",
    backgroundColor: "rgba(127,29,29,0.28)",
    padding: 14,
  },
  errorText: {
    color: "#fecaca",
    fontSize: 13,
    lineHeight: 18,
  },
  centerWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  loadingText: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 13,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: webTheme.colors.darkInk,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    color: webTheme.colors.darkInkMuted,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flexGrow: 1,
    minWidth: "47%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 14,
    gap: 6,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: webTheme.colors.darkInkMuted,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: webTheme.colors.darkInk,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(15,27,47,0.9)",
    padding: 14,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTextWrap: {
    flex: 1,
    gap: 4,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: webTheme.colors.darkInkMuted,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: webTheme.colors.darkInk,
  },
  sectionBadge: {
    borderRadius: 999,
    backgroundColor: "rgba(56,189,248,0.16)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sectionBadgeText: {
    color: "#bae6fd",
    fontSize: 11,
    fontWeight: "700",
  },
  listWrap: {
    gap: 10,
  },
  itemCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
    gap: 6,
  },
  itemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  itemTextWrap: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: webTheme.colors.darkInk,
  },
  itemMeta: {
    fontSize: 12,
    lineHeight: 17,
    color: webTheme.colors.darkInkMuted,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  toggleDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "transparent",
  },
  toggleDotActive: {
    borderColor: webTheme.colors.accent,
    backgroundColor: webTheme.colors.accent,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: webTheme.colors.darkInk,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
  },
  primaryButton: {
    minWidth: 110,
    borderRadius: 14,
    backgroundColor: webTheme.colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: webTheme.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  secondaryButton: {
    minWidth: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: webTheme.colors.darkInk,
    fontSize: 12,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  emptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderStyle: "dashed",
    padding: 16,
    alignItems: "center",
  },
});
