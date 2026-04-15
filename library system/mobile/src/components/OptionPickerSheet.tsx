import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type PickerOption = {
  value: string;
  label: string;
  description?: string;
};

type OptionPickerSheetProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  options: PickerOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

export const OptionPickerSheet = ({
  visible,
  title,
  subtitle,
  options,
  selectedValue,
  onSelect,
  onClose,
}: OptionPickerSheetProps) => {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={styles.headerTextWrap}>
                <Text style={styles.headerTitle}>{title}</Text>
                <Text style={styles.headerSubtitle}>{subtitle}</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.optionList}
              contentContainerStyle={styles.optionListContent}
              showsVerticalScrollIndicator={false}
            >
              {options.map((option) => {
                const isSelected = option.value === selectedValue;

                return (
                  <Pressable
                    key={option.value}
                    style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                    onPress={() => {
                      onSelect(option.value);
                      onClose();
                    }}
                  >
                    <View style={[styles.optionDot, isSelected && styles.optionDotSelected]} />
                    <View style={styles.optionTextWrap}>
                      <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                        {option.label}
                      </Text>
                      {option.description ? (
                        <Text
                          style={[
                            styles.optionDescription,
                            isSelected && styles.optionDescriptionSelected,
                          ]}
                        >
                          {option.description}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected ? (
                      <View style={styles.selectedBadge}>
                        <Text style={styles.selectedBadgeText}>Selected</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.7)",
  },
  sheetWrap: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  sheet: {
    maxHeight: "74%",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(11,19,36,0.98)",
    paddingHorizontal: 14,
    paddingBottom: 14,
    shadowColor: "#020617",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  handle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginTop: 10,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: "rgba(226,232,240,0.68)",
    fontSize: 12,
    lineHeight: 18,
  },
  closeButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "700",
  },
  optionList: {
    marginTop: 12,
  },
  optionListContent: {
    gap: 10,
    paddingBottom: 8,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  optionCardSelected: {
    borderColor: "rgba(125,211,252,0.42)",
    backgroundColor: "rgba(14,165,233,0.16)",
    shadowColor: "#38bdf8",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  optionDot: {
    marginTop: 5,
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "transparent",
  },
  optionDotSelected: {
    borderColor: "#7dd3fc",
    backgroundColor: "#7dd3fc",
  },
  optionTextWrap: {
    flex: 1,
    gap: 4,
  },
  optionLabel: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "700",
  },
  optionLabelSelected: {
    color: "#e0f2fe",
  },
  optionDescription: {
    color: "rgba(226,232,240,0.48)",
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  optionDescriptionSelected: {
    color: "rgba(186,230,253,0.8)",
  },
  selectedBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(125,211,252,0.34)",
    backgroundColor: "rgba(125,211,252,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  selectedBadgeText: {
    color: "#dbeafe",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
});
