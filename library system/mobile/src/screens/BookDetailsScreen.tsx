import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { booksApi } from "../api/books";
import { useAuth } from "../auth/AuthContext";
import { BorrowSlipModal, type BorrowSlipData } from "../components/BorrowSlipModal";
import { OptionPickerSheet, type PickerOption } from "../components/OptionPickerSheet";
import { resolveMediaUrl } from "../config/api";
import { RootStackParamList } from "../navigation/RootNavigator";
import { webTheme } from "../theme/webTheme";
import { canBorrowAsPatron } from "../utils/roles";
import { Book } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "BookDetails">;
type BorrowPickerKey = "course" | "year" | null;

const COURSE_PROGRAM_OPTIONS: PickerOption[] = [
  {
    value: "BS Information Technology",
    label: "BS Information Technology",
    description: "Computing and software systems",
  },
  {
    value: "BS Computer Science",
    label: "BS Computer Science",
    description: "Algorithms, data, and systems",
  },
  {
    value: "BS Business Administration",
    label: "BS Business Administration",
    description: "Management and entrepreneurship",
  },
  {
    value: "BS Accountancy",
    label: "BS Accountancy",
    description: "Financial analysis and auditing",
  },
  {
    value: "BS Psychology",
    label: "BS Psychology",
    description: "Behavioral and social sciences",
  },
  {
    value: "BS Nursing",
    label: "BS Nursing",
    description: "Healthcare and clinical practice",
  },
  {
    value: "BS Education",
    label: "BS Education",
    description: "Teaching and curriculum design",
  },
  {
    value: "BS Engineering",
    label: "BS Engineering",
    description: "Applied science and design",
  },
  {
    value: "BS Architecture",
    label: "BS Architecture",
    description: "Built environment and planning",
  },
  {
    value: "AB Communication",
    label: "AB Communication",
    description: "Media, writing, and speaking",
  },
  {
    value: "AB Political Science",
    label: "AB Political Science",
    description: "Government and public policy",
  },
  {
    value: "Other",
    label: "Other",
    description: "Program not listed above",
  },
];

const YEAR_LEVEL_OPTIONS: PickerOption[] = [
  {
    value: "1st Year",
    label: "1st Year",
    description: "Freshman level",
  },
  {
    value: "2nd Year",
    label: "2nd Year",
    description: "Sophomore level",
  },
  {
    value: "3rd Year",
    label: "3rd Year",
    description: "Junior level",
  },
  {
    value: "4th Year",
    label: "4th Year",
    description: "Senior level",
  },
];

const formatDate = (value?: string | null): string => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const BookDetailsScreen = ({ route }: Props) => {
  const { user } = useAuth();
  const { bookId } = route.params;
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [teacherReportingFrequency, setTeacherReportingFrequency] = useState<"WEEKLY" | "MONTHLY">("MONTHLY");
  const [studentBorrowDays, setStudentBorrowDays] = useState<7 | 14>(14);
  const [studentBorrowForm, setStudentBorrowForm] = useState({
    courseProgram: "",
    yearLevel: "",
  });
  const [activeBorrowPicker, setActiveBorrowPicker] = useState<BorrowPickerKey>(null);
  const [todayReference] = useState(() => new Date());
  const [borrowSlipData, setBorrowSlipData] = useState<BorrowSlipData | null>(null);
  const [borrowSlipVisible, setBorrowSlipVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const result = await booksApi.getBookById(bookId);
      if (!mounted) return;
      if (result.error || !result.data) {
        setError(result.error ?? "Unable to load book details.");
        setBook(null);
      } else {
        setBook(result.data);
      }
      setLoading(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [bookId]);

  const onBorrow = async () => {
    if (!book || busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);

    if (canBorrowAsPatron(user) && user?.role !== "TEACHER") {
      if (!studentBorrowForm.courseProgram || !studentBorrowForm.yearLevel) {
        setError("Select your course/program and year level before submitting the borrow request.");
        setBusy(false);
        return;
      }
    }

    const result = await booksApi.requestBorrow(
      book.id,
      user?.role === "TEACHER"
        ? { reportingFrequency: teacherReportingFrequency }
        : studentBorrowDays
    );
    if (result.error) {
      if (result.error.toLowerCase().includes("unpaid fines")) {
        setError(`${result.error} Check your Profile > Fines & Borrow Status.`);
      } else {
        setError(result.error);
      }
      setBusy(false);
      return;
    }

    setBook(result.data?.book ?? { ...book, has_pending_borrow_request: true });
    setMessage(
      result.data?.message ??
        (user?.role === "TEACHER"
          ? `Teacher borrow request submitted with ${teacherReportingFrequency.toLowerCase()} reporting.`
          : `Borrow request submitted for ${studentBorrowDays} days.`)
    );

    if (canBorrowAsPatron(user) && user?.role !== "TEACHER") {
      const borrowDateLabel = formatDate(result.data?.request?.requested_at ?? new Date().toISOString());
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + studentBorrowDays);
      setBorrowSlipData({
        studentName: user?.full_name ?? result.data?.request?.user?.full_name ?? "",
        studentId: user?.student_id ?? result.data?.request?.user?.student_id ?? "",
        courseYear: `${studentBorrowForm.courseProgram} - ${studentBorrowForm.yearLevel}`,
        bookTitle: book.title,
        author: book.author || "Unknown author",
        callNumber: "To be assigned",
        dateBorrowed: borrowDateLabel,
        dueDate: formatDate(dueDate.toISOString()),
      });
      setBorrowSlipVisible(true);
    }

    setBusy(false);
  };

  const onReturn = async () => {
    if (!book || busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);

    const result = await booksApi.requestReturn(book.id);
    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }

    setBook(result.data?.book ?? { ...book, has_pending_return_request: true });
    setMessage(result.data?.message ?? "Return request submitted.");
    setBusy(false);
  };

  const onReserve = async () => {
    if (!book || busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);

    const result = await booksApi.createReservation(book.id);
    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }

    const position = result.data?.position;
    setMessage(
      typeof position === "number"
        ? `Reservation submitted. You are #${position} in queue.`
        : result.data?.message ?? "Reservation submitted."
    );
    setBusy(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={webTheme.colors.accentCoolStrong} />
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.errorText}>{error ?? "Book not found."}</Text>
      </View>
    );
  }

  const imageUrl = resolveMediaUrl(book.cover_image);
  const categories = (book.categories ?? []).map((category) => category.name).filter(Boolean);
  const displayCategories = categories.length > 0 ? categories : [book.genre || "Uncategorized"];
  const featuredCategory = displayCategories[0];
  const remainingCategoryCount = Math.max(displayCategories.length - 1, 0);
  const availableCopies = book.copies_available ?? 0;
  const totalCopies = book.copies_total ?? availableCopies;
  const availabilityPercent =
    totalCopies > 0 ? Math.max(0, Math.min(100, Math.round((availableCopies / totalCopies) * 100))) : 0;
  const isTeacher = user?.role === "TEACHER";
  const canUseBorrowFlow = canBorrowAsPatron(user);
  const isStudentBorrower = canUseBorrowFlow && !isTeacher;
  const canBorrow =
    canUseBorrowFlow &&
    book.available &&
    !book.is_borrowed_by_user &&
    !book.has_pending_borrow_request;
  const canReturn =
    canUseBorrowFlow && Boolean(book.is_borrowed_by_user) && !book.has_pending_return_request;
  const canReserve =
    canUseBorrowFlow &&
    !book.available &&
    !book.is_borrowed_by_user &&
    !book.has_pending_borrow_request;

  let actionLabel = "Request Borrow";
  let actionHandler = onBorrow;
  let actionEnabled = canBorrow;

  if (book.is_borrowed_by_user) {
    actionLabel = book.has_pending_return_request ? "Return Pending" : "Request Return";
    actionHandler = onReturn;
    actionEnabled = canReturn;
  } else if (book.has_pending_borrow_request) {
    actionLabel = "Borrow Pending";
  } else if (!book.available) {
    actionLabel = "Reserve Book";
    actionHandler = onReserve;
    actionEnabled = canReserve;
  } else if (!canUseBorrowFlow) {
    actionLabel = "Students/Teachers Only";
  }

  const getBorrowDueDateInput = (days: number) => {
    const dueDate = new Date(todayReference);
    dueDate.setDate(dueDate.getDate() + days);
    return formatDateInput(dueDate);
  };

  const estimatedDueDate = getBorrowDueDateInput(studentBorrowDays);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.bgBlue} />
      <View style={styles.bgAmber} />
      <View style={styles.bgCenter} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowSecondary} />

          <View style={styles.heroMetaRow}>
            <View style={styles.categoryChip}>
              <Text numberOfLines={1} style={styles.categoryChipText}>
                {featuredCategory.toUpperCase()}
              </Text>
            </View>
            <View
              style={[
                styles.statusChip,
                book.available ? styles.statusChipAvailable : styles.statusChipUnavailable,
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  book.available ? styles.statusChipTextAvailable : styles.statusChipTextUnavailable,
                ]}
              >
                {book.available ? "Available" : "Borrowed"}
              </Text>
            </View>
          </View>

          <View style={styles.coverWrap}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.coverImage} resizeMode="cover" />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Text style={styles.coverPlaceholderText}>No Cover</Text>
              </View>
            )}
          </View>

          <View style={styles.heroBody}>
            <Text style={styles.title}>{book.title}</Text>
            <Text style={styles.author}>{book.author}</Text>
            <Text style={styles.helper}>
              {isTeacher
                ? book.available
                  ? "Teachers borrow without a due-date limit and choose a weekly or monthly reporting schedule."
                  : "All available copies are currently borrowed."
                : book.available
                  ? "Choose a borrow duration and request this title now."
                  : "All available copies are currently borrowed."}
            </Text>
            <View style={styles.heroInfoRow}>
              <Text style={styles.heroInfoText}>
                Copies: {availableCopies}/{totalCopies}
              </Text>
              {remainingCategoryCount > 0 ? (
                <Text style={styles.heroInfoText}>+{remainingCategoryCount} more categories</Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.availabilityCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTextWrap}>
              <Text style={styles.sectionEyebrow}>Availability</Text>
              <Text style={styles.sectionTitle}>Shelf Status</Text>
            </View>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{availabilityPercent}% available</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${availabilityPercent}%` }]} />
          </View>
          <Text style={styles.progressCopy}>
            {availableCopies} of {totalCopies} cop{totalCopies === 1 ? "y" : "ies"} currently available.
          </Text>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>ISBN</Text>
            <Text style={styles.metaValue}>{book.isbn || "Not provided"}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Published</Text>
            <Text style={styles.metaValue}>{formatDate(book.published_date)}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Language</Text>
            <Text style={styles.metaValue}>{book.language || "Not set"}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Grade Level</Text>
            <Text style={styles.metaValue}>{book.grade_level || "General"}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Categories</Text>
          <Text style={styles.sectionTitle}>Classification</Text>
          <View style={styles.classificationWrap}>
            {displayCategories.map((category) => (
              <View key={category} style={styles.classificationChip}>
                <Text style={styles.classificationChipText}>{category}</Text>
              </View>
            ))}
          </View>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {!!message && (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{message}</Text>
            {isStudentBorrower && borrowSlipData ? (
              <Pressable
                style={styles.messageActionButton}
                onPress={() => setBorrowSlipVisible(true)}
              >
                <Text style={styles.messageActionText}>View Borrow Slip</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {isStudentBorrower && canBorrow ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>Borrower Details</Text>
            <Text style={styles.sectionTitle}>Academic profile</Text>
            <Text style={styles.sectionCopy}>
              Match today's web update by confirming the academic details printed on your
              borrow slip.
            </Text>

            <View style={styles.borrowIdentityRow}>
              <View style={styles.borrowIdentityCard}>
                <Text style={styles.borrowIdentityLabel}>Student Name</Text>
                <Text style={styles.borrowIdentityValue} numberOfLines={2}>
                  {user?.full_name || "Library student"}
                </Text>
              </View>
              <View style={styles.borrowIdentityCard}>
                <Text style={styles.borrowIdentityLabel}>Student ID</Text>
                <Text style={styles.borrowIdentityValue}>
                  {user?.student_id || "Not available"}
                </Text>
              </View>
            </View>

            <View style={styles.selectorStack}>
              <Pressable
                style={[
                  styles.selectorCard,
                  activeBorrowPicker === "course" && styles.selectorCardActive,
                ]}
                onPress={() => setActiveBorrowPicker("course")}
              >
                <Text style={styles.selectorLabel}>Course or Program</Text>
                <View style={styles.selectorValueRow}>
                  <Text
                    style={[
                      styles.selectorValue,
                      !studentBorrowForm.courseProgram && styles.selectorPlaceholder,
                    ]}
                  >
                    {studentBorrowForm.courseProgram || "Select course/program"}
                  </Text>
                  <Text style={styles.selectorChevron}>v</Text>
                </View>
                <Text style={styles.selectorHint}>
                  {studentBorrowForm.courseProgram
                    ? "Saved to the mobile borrow slip"
                    : "Choose the student program for this request"}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.selectorCard,
                  activeBorrowPicker === "year" && styles.selectorCardActive,
                ]}
                onPress={() => setActiveBorrowPicker("year")}
              >
                <Text style={styles.selectorLabel}>Year or Level</Text>
                <View style={styles.selectorValueRow}>
                  <Text
                    style={[
                      styles.selectorValue,
                      !studentBorrowForm.yearLevel && styles.selectorPlaceholder,
                    ]}
                  >
                    {studentBorrowForm.yearLevel || "Select year level"}
                  </Text>
                  <Text style={styles.selectorChevron}>v</Text>
                </View>
                <Text style={styles.selectorHint}>
                  {studentBorrowForm.yearLevel
                    ? "Used together with the selected program"
                    : "Choose the current year level"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!isTeacher && canBorrow ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>Borrow Duration</Text>
            <Text style={styles.sectionTitle}>Choose request length</Text>
            <Text style={styles.sectionCopy}>
              Match the web flow by choosing how many days you need this book before sending the request.
            </Text>
            <View style={styles.optionWrap}>
              {([7, 14] as const).map((days) => (
                <Pressable
                  key={days}
                  style={[
                    styles.optionCard,
                    studentBorrowDays === days && styles.optionCardActive,
                  ]}
                  onPress={() => setStudentBorrowDays(days)}
                >
                  <Text
                    style={[
                      styles.optionTitle,
                      studentBorrowDays === days && styles.optionTitleActive,
                    ]}
                  >
                    {days} Days
                  </Text>
                  <Text style={styles.optionCopy}>
                    Estimated due date: {formatDate(days === studentBorrowDays ? estimatedDueDate : getBorrowDueDateInput(days))}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {isTeacher && canBorrow ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>Teacher Reporting</Text>
            <Text style={styles.sectionTitle}>Choose reporting schedule</Text>
            <Text style={styles.sectionCopy}>
              Teacher loans stay open without a due-date limit, but reporting stays required.
            </Text>
            <View style={styles.optionWrap}>
              {(["WEEKLY", "MONTHLY"] as const).map((frequency) => (
                <Pressable
                  key={frequency}
                  style={[
                    styles.optionCard,
                    teacherReportingFrequency === frequency && styles.optionCardTeacherActive,
                  ]}
                  onPress={() => setTeacherReportingFrequency(frequency)}
                >
                  <Text
                    style={[
                      styles.optionTitle,
                      teacherReportingFrequency === frequency && styles.optionTitleTeacherActive,
                    ]}
                  >
                    {frequency === "WEEKLY" ? "Weekly" : "Monthly"}
                  </Text>
                  <Text style={styles.optionCopy}>
                    {frequency === "WEEKLY"
                      ? "Submit a check-in every 7 days after approval."
                      : "Submit a check-in every 30 days after approval."}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Pressable
          style={[styles.actionButton, (!actionEnabled || busy) && styles.actionButtonDisabled]}
          disabled={!actionEnabled || busy}
          onPress={actionHandler}
        >
          {busy ? (
            <ActivityIndicator color={webTheme.colors.ink} />
          ) : (
            <Text
              style={[
                styles.actionText,
                (!actionEnabled || busy) && styles.actionTextDisabled,
              ]}
            >
              {actionLabel}
            </Text>
          )}
        </Pressable>
      </ScrollView>
      <BorrowSlipModal
        data={borrowSlipData}
        visible={borrowSlipVisible}
        onClose={() => setBorrowSlipVisible(false)}
      />
      <OptionPickerSheet
        visible={activeBorrowPicker === "course"}
        title="Course or Program"
        subtitle="Choose the academic program that should appear on the mobile borrow slip."
        options={COURSE_PROGRAM_OPTIONS}
        selectedValue={studentBorrowForm.courseProgram}
        onSelect={(value) =>
          setStudentBorrowForm((current) => ({ ...current, courseProgram: value }))
        }
        onClose={() => setActiveBorrowPicker(null)}
      />
      <OptionPickerSheet
        visible={activeBorrowPicker === "year"}
        title="Year Level"
        subtitle="Choose the current year level for this student borrow request."
        options={YEAR_LEVEL_OPTIONS}
        selectedValue={studentBorrowForm.yearLevel}
        onSelect={(value) =>
          setStudentBorrowForm((current) => ({ ...current, yearLevel: value }))
        }
        onClose={() => setActiveBorrowPicker(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
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
    top: -70,
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
    width: 420,
    height: 420,
    borderRadius: 280,
    backgroundColor: "rgba(2,132,199,0.08)",
    left: "14%",
    top: "16%",
  },
  container: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 26,
    gap: 12,
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(15,27,47,0.82)",
  },
  heroGlowPrimary: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(2,132,199,0.22)",
    top: -74,
    left: -52,
  },
  heroGlowSecondary: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: "rgba(245,158,11,0.14)",
    bottom: -68,
    right: -38,
  },
  heroMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  categoryChip: {
    maxWidth: "64%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  categoryChipText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  statusChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusChipAvailable: {
    borderColor: "rgba(110,231,183,0.36)",
    backgroundColor: "rgba(16,185,129,0.18)",
  },
  statusChipUnavailable: {
    borderColor: "rgba(252,211,77,0.36)",
    backgroundColor: "rgba(245,158,11,0.18)",
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "800",
  },
  statusChipTextAvailable: {
    color: "#d1fae5",
  },
  statusChipTextUnavailable: {
    color: "#fef3c7",
  },
  coverWrap: {
    width: "100%",
    aspectRatio: 3 / 2,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  coverPlaceholderText: {
    color: webTheme.colors.darkInkMuted,
    fontWeight: "700",
  },
  heroBody: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  title: {
    color: webTheme.colors.darkInk,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "800",
  },
  author: {
    color: "rgba(232,241,255,0.76)",
    fontSize: 15,
    fontWeight: "700",
  },
  helper: {
    marginTop: 2,
    color: "rgba(232,241,255,0.7)",
    fontSize: 14,
    lineHeight: 20,
  },
  heroInfoRow: {
    marginTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroInfoText: {
    color: "rgba(232,241,255,0.66)",
    fontSize: 12,
    fontWeight: "700",
  },
  availabilityCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(8,20,47,0.58)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
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
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  sectionTextWrap: {
    flex: 1,
    gap: 3,
  },
  sectionEyebrow: {
    color: "rgba(232,241,255,0.58)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    fontWeight: "700",
  },
  sectionTitle: {
    color: webTheme.colors.darkInk,
    fontSize: 20,
    fontWeight: "800",
  },
  sectionCopy: {
    color: "rgba(232,241,255,0.68)",
    fontSize: 12,
    lineHeight: 18,
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
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#38bdf8",
  },
  progressCopy: {
    color: "rgba(232,241,255,0.7)",
    fontSize: 12,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaCard: {
    width: "48%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  metaLabel: {
    color: "rgba(232,241,255,0.56)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  metaValue: {
    color: webTheme.colors.darkInk,
    fontSize: 14,
    fontWeight: "700",
  },
  classificationWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  classificationChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  classificationChipText: {
    color: webTheme.colors.darkInk,
    fontSize: 12,
    fontWeight: "700",
  },
  borrowIdentityRow: {
    flexDirection: "row",
    gap: 8,
  },
  borrowIdentityCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 5,
  },
  borrowIdentityLabel: {
    color: "rgba(226,232,240,0.54)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  borrowIdentityValue: {
    color: webTheme.colors.darkInk,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  selectorStack: {
    gap: 10,
  },
  selectorCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 7,
  },
  selectorCardActive: {
    borderColor: "rgba(125,211,252,0.46)",
    backgroundColor: "rgba(14,165,233,0.16)",
    shadowColor: "#38bdf8",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  selectorLabel: {
    color: "rgba(226,232,240,0.58)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  selectorValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  selectorValue: {
    flex: 1,
    color: webTheme.colors.darkInk,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },
  selectorPlaceholder: {
    color: "rgba(226,232,240,0.42)",
  },
  selectorChevron: {
    color: "rgba(191,219,254,0.8)",
    fontSize: 16,
    fontWeight: "800",
  },
  selectorHint: {
    color: "rgba(226,232,240,0.52)",
    fontSize: 11,
    lineHeight: 16,
  },
  optionWrap: {
    gap: 8,
  },
  optionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  optionCardActive: {
    borderColor: "rgba(56,189,248,0.42)",
    backgroundColor: "rgba(14,165,233,0.18)",
  },
  optionCardTeacherActive: {
    borderColor: "rgba(165,180,252,0.42)",
    backgroundColor: "rgba(99,102,241,0.2)",
  },
  optionTitle: {
    color: webTheme.colors.darkInk,
    fontSize: 14,
    fontWeight: "800",
  },
  optionTitleActive: {
    color: "#e0f2fe",
  },
  optionTitleTeacherActive: {
    color: "#e0e7ff",
  },
  optionCopy: {
    color: "rgba(232,241,255,0.68)",
    fontSize: 12,
    lineHeight: 17,
  },
  actionButton: {
    borderRadius: 18,
    backgroundColor: webTheme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  actionButtonDisabled: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  actionText: {
    color: webTheme.colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  actionTextDisabled: {
    color: "rgba(232,241,255,0.58)",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: webTheme.colors.darkBg,
    paddingHorizontal: 16,
  },
  errorBox: {
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.58)",
    borderRadius: 14,
    backgroundColor: "rgba(127,29,29,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    color: "#fecaca",
    fontSize: 13,
    lineHeight: 18,
  },
  messageBox: {
    borderWidth: 1,
    borderColor: "rgba(125,211,252,0.45)",
    borderRadius: 14,
    backgroundColor: "rgba(8,145,178,0.24)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  messageText: {
    color: "#a5f3fc",
    fontSize: 13,
    lineHeight: 18,
  },
  messageActionButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  messageActionText: {
    color: "#e0f2fe",
    fontSize: 12,
    fontWeight: "800",
  },
});
