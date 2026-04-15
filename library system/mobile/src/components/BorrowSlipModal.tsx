import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { webTheme } from "../theme/webTheme";

export type BorrowSlipData = {
  studentName: string;
  studentId: string;
  courseYear: string;
  bookTitle: string;
  author: string;
  callNumber: string;
  dateBorrowed: string;
  dueDate: string;
};

type BorrowSlipModalProps = {
  data: BorrowSlipData | null;
  visible: boolean;
  onClose: () => void;
};

const formatValue = (value: string, fallback = "Not provided") => {
  const trimmed = value.trim();
  return trimmed || fallback;
};

const DetailRow = ({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={[styles.detailValue, emphasis && styles.detailValueEmphasis]}>{value}</Text>
  </View>
);

export const BorrowSlipModal = ({ data, visible, onClose }: BorrowSlipModalProps) => {
  if (!data) {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.backdrop} />
        <View style={styles.modalWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.headerEyebrow}>Official Library Form</Text>
                <Text style={styles.headerTitle}>Salazar Library System Borrow Slip</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.headerCopy}>
                Keep this slip as your library reference. The borrowed book must be returned on or
                before the due date shown below.
              </Text>

              <View style={styles.dueDateCard}>
                <Text style={styles.sectionEyebrow}>Due Date</Text>
                <Text style={styles.dueDateValue}>{formatValue(data.dueDate)}</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionEyebrow}>Borrower Details</Text>
                <Text style={styles.sectionTitle}>Student Information</Text>
                <View style={styles.sectionBody}>
                  <DetailRow label="Student Name" value={formatValue(data.studentName)} />
                  <DetailRow label="Student ID" value={formatValue(data.studentId)} />
                  <DetailRow label="Course / Year Level" value={formatValue(data.courseYear)} />
                  <DetailRow label="Date Borrowed" value={formatValue(data.dateBorrowed)} />
                  <DetailRow label="Due Date" value={formatValue(data.dueDate)} emphasis />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionEyebrow}>Item Details</Text>
                <Text style={styles.sectionTitle}>Book Information</Text>
                <View style={styles.sectionBody}>
                  <DetailRow label="Book Title" value={formatValue(data.bookTitle)} />
                  <DetailRow label="Author" value={formatValue(data.author, "Unknown author")} />
                  <DetailRow
                    label="Call Number / Accession No."
                    value={formatValue(data.callNumber, "To be assigned")}
                  />
                </View>
              </View>

              <View style={styles.reminderCard}>
                <Text style={styles.sectionEyebrow}>Return Reminder</Text>
                <Text style={styles.reminderText}>
                  Return the book on or before the due date. Late returns may lead to fines or
                  borrowing restrictions based on library policy.
                </Text>
              </View>

              <View style={styles.signatureRow}>
                <View style={styles.signatureBlock}>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signatureLabel}>Student Signature</Text>
                </View>
                <View style={styles.signatureBlock}>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signatureLabel}>Librarian Signature</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable style={styles.primaryButton} onPress={onClose}>
                <Text style={styles.primaryButtonText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.84)",
  },
  modalWrap: {
    maxHeight: "100%",
  },
  sheet: {
    overflow: "hidden",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    backgroundColor: "#ffffff",
    shadowColor: "#020617",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.1)",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerEyebrow: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  headerTitle: {
    marginTop: 4,
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "800",
  },
  closeButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#0f172a",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  sheetContent: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 16,
  },
  headerCopy: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 20,
  },
  dueDateCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dueDateValue: {
    marginTop: 4,
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "800",
  },
  section: {
    gap: 8,
  },
  sectionEyebrow: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800",
  },
  sectionBody: {
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.1)",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  detailRow: {
    gap: 5,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detailLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  detailValue: {
    color: "#1e293b",
    fontSize: 14,
    lineHeight: 20,
  },
  detailValueEmphasis: {
    color: "#0f172a",
    fontWeight: "800",
  },
  reminderCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
    backgroundColor: "rgba(245,158,11,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  reminderText: {
    marginTop: 6,
    color: "#92400e",
    fontSize: 13,
    lineHeight: 20,
  },
  signatureRow: {
    flexDirection: "row",
    gap: 12,
  },
  signatureBlock: {
    flex: 1,
  },
  signatureLine: {
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: "#0f172a",
  },
  signatureLabel: {
    marginTop: 8,
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(15,23,42,0.1)",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: webTheme.colors.darkBg,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});
