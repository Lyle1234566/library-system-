import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_REGEX = /^\+?\d{10,15}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const loanPurposeOptions = ["Purchase a new", "Refinance", "Build"] as const;
const applicantOptions = ["Just me", "2 or 3", "4+ People"] as const;
const idTypeOptions = ["Driver's License", "Passport", "National ID"] as const;
const repaymentOptions = ["12 Months", "18 Months", "24 Months"] as const;

type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number | null;
};

const isPositiveNumber = (value: string) => {
  if (!value.trim()) return false;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0;
};

const isNonNegativeNumber = (value: string) => {
  if (!value.trim()) return false;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0;
};

export const DocumentsScreen = () => {
  const navigation = useNavigation();
  const tabBarHeight = useBottomTabBarHeight();
  const contentPaddingBottom = 32 + tabBarHeight;

  const [loanPurpose, setLoanPurpose] = useState<(typeof loanPurposeOptions)[number] | "">("");
  const [applicantCount, setApplicantCount] = useState<(typeof applicantOptions)[number] | "">("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [address, setAddress] = useState("");

  const [idType, setIdType] = useState<(typeof idTypeOptions)[number]>("Driver's License");
  const [idNumber, setIdNumber] = useState("");
  const [idExpiry, setIdExpiry] = useState("");
  const [idFrontFile, setIdFrontFile] = useState<PickedFile | null>(null);
  const [idBackFile, setIdBackFile] = useState<PickedFile | null>(null);

  const [selfieFile, setSelfieFile] = useState<PickedFile | null>(null);

  const [employerName, setEmployerName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [employmentStart, setEmploymentStart] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");

  const [monthlyExpenses, setMonthlyExpenses] = useState("");
  const [outstandingLoans, setOutstandingLoans] = useState("");

  const [payslipsFile, setPayslipsFile] = useState<PickedFile | null>(null);
  const [bankStatementsFile, setBankStatementsFile] = useState<PickedFile | null>(null);

  const [loanAmount, setLoanAmount] = useState("");
  const [repaymentPlan, setRepaymentPlan] = useState<(typeof repaymentOptions)[number] | "">("");

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const requiresIdBack = idType !== "Passport";

  const markTouched = (key: string) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  const pickDocument = async (
    label: string,
    setter: (file: PickedFile | null) => void,
    touchKey: string
  ) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const nextFile: PickedFile = {
        uri: asset.uri,
        name: asset.name ?? label,
        mimeType: asset.mimeType ?? "application/octet-stream",
        size: asset.size ?? null,
      };
      setter(nextFile);
      markTouched(touchKey);
      Alert.alert("Upload", `${label} attached.`);
    } catch {
      Alert.alert("Upload Failed", `Unable to pick ${label}.`);
    }
  };

  const errors = useMemo(() => {
    const next: Record<string, string> = {};

    if (!loanPurpose) next.loanPurpose = "Select a loan purpose.";
    if (!applicantCount) next.applicantCount = "Select applicant count.";

    if (firstName.trim().length < 2) next.firstName = "First name is required.";
    if (lastName.trim().length < 2) next.lastName = "Last name is required.";
    if (!EMAIL_REGEX.test(email)) next.email = "Enter a valid email address.";
    if (!PHONE_REGEX.test(phone)) next.phone = "Enter a valid phone number.";

    if (!idType) next.idType = "Select an ID type.";
    if (idNumber.trim().length < 4) next.idNumber = "ID number is required.";
    if (!DATE_REGEX.test(idExpiry)) next.idExpiry = "Use YYYY-MM-DD format.";
    if (!idFrontFile) next.idFrontFile = "Upload the ID front.";
    if (requiresIdBack && !idBackFile) next.idBackFile = "Upload the ID back.";

    if (!selfieFile) next.selfieFile = "Selfie verification is required.";

    if (employerName.trim().length < 2) next.employerName = "Employer name is required.";
    if (jobTitle.trim().length < 2) next.jobTitle = "Job title is required.";
    if (!DATE_REGEX.test(employmentStart)) next.employmentStart = "Use YYYY-MM-DD format.";
    if (!isPositiveNumber(monthlyIncome)) next.monthlyIncome = "Enter a positive income amount.";

    if (!isNonNegativeNumber(monthlyExpenses)) next.monthlyExpenses = "Enter monthly expenses.";
    if (!isNonNegativeNumber(outstandingLoans)) next.outstandingLoans = "Enter outstanding loans (0 if none).";

    if (!payslipsFile) next.payslipsFile = "Upload payslips.";
    if (!bankStatementsFile) next.bankStatementsFile = "Upload bank statements.";

    if (!isPositiveNumber(loanAmount)) next.loanAmount = "Enter a loan amount.";
    if (!repaymentPlan) next.repaymentPlan = "Select a repayment plan.";

    if (!termsAccepted) next.termsAccepted = "Accept terms to continue.";

    return next;
  }, [
    applicantCount,
    bankStatementsFile,
    email,
    employerName,
    employmentStart,
    firstName,
    idBackFile,
    idExpiry,
    idFrontFile,
    idNumber,
    idType,
    jobTitle,
    lastName,
    loanAmount,
    loanPurpose,
    monthlyExpenses,
    monthlyIncome,
    outstandingLoans,
    payslipsFile,
    phone,
    repaymentPlan,
    requiresIdBack,
    selfieFile,
    termsAccepted,
  ]);

  const shouldShowError = (key: string) => submitAttempted || touched[key];

  const sectionStatus = [
    !errors.loanPurpose && !errors.applicantCount,
    !errors.firstName && !errors.lastName && !errors.email && !errors.phone,
    !errors.idType &&
      !errors.idNumber &&
      !errors.idExpiry &&
      !errors.idFrontFile &&
      !errors.idBackFile,
    !errors.selfieFile,
    !errors.employerName && !errors.jobTitle && !errors.employmentStart && !errors.monthlyIncome,
    !errors.monthlyExpenses && !errors.outstandingLoans,
    !errors.payslipsFile && !errors.bankStatementsFile,
    !errors.loanAmount && !errors.repaymentPlan,
    !errors.termsAccepted,
  ];

  const completedSteps = sectionStatus.filter(Boolean).length;
  const totalSteps = sectionStatus.length;
  const progress = totalSteps === 0 ? 0 : completedSteps / totalSteps;

  const handleMockUpload = (label: string, setter: (value: string) => void) => {
    const safe = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const nextValue = `${safe}.pdf`;
    setter(nextValue);
    Alert.alert("Upload", `${label} attached.`);
  };

  const onSubmit = () => {
    setSubmitAttempted(true);
    if (Object.keys(errors).length > 0) {
      Alert.alert("Missing information", "Please complete all required fields.");
      return;
    }
    Alert.alert("Submitted", "Your loan application has been captured.");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: contentPaddingBottom }]}>
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>{"<"}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Home Loan</Text>
            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.headerSubtitle}>Let's get started. First tell us about your loan needs.</Text>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressCaption}>{completedSteps}/{totalSteps} sections complete</Text>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>What would you like to do? (Required)</Text>
            <View style={styles.chipRow}>
              {loanPurposeOptions.map((option) => (
                <Pressable
                  key={option}
                  style={[styles.chip, loanPurpose === option && styles.chipActive]}
                  onPress={() => setLoanPurpose(option)}
                >
                  <Text style={[styles.chipText, loanPurpose === option && styles.chipTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
            {shouldShowError("loanPurpose") && errors.loanPurpose ? (
              <Text style={styles.errorText}>{errors.loanPurpose}</Text>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>
              How many people will be part of this application? (Required)
            </Text>
            <View style={styles.chipRow}>
              {applicantOptions.map((option) => (
                <Pressable
                  key={option}
                  style={[styles.chip, applicantCount === option && styles.chipActive]}
                  onPress={() => setApplicantCount(option)}
                >
                  <Text style={[styles.chipText, applicantCount === option && styles.chipTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
            {shouldShowError("applicantCount") && errors.applicantCount ? (
              <Text style={styles.errorText}>{errors.applicantCount}</Text>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Personal information</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              onBlur={() => markTouched("firstName")}
              placeholder="First name (Required)"
              placeholderTextColor={stylesVars.placeholder}
            />
            {shouldShowError("firstName") && errors.firstName ? (
              <Text style={styles.errorText}>{errors.firstName}</Text>
            ) : null}

            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              onBlur={() => markTouched("lastName")}
              placeholder="Last name (Required)"
              placeholderTextColor={stylesVars.placeholder}
            />
            {shouldShowError("lastName") && errors.lastName ? (
              <Text style={styles.errorText}>{errors.lastName}</Text>
            ) : null}

            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              onBlur={() => markTouched("email")}
              placeholder="Email address (Required)"
              placeholderTextColor={stylesVars.placeholder}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {shouldShowError("email") && errors.email ? (
              <Text style={styles.errorText}>{errors.email}</Text>
            ) : null}

            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              onBlur={() => markTouched("phone")}
              placeholder="Mobile phone (Required)"
              placeholderTextColor={stylesVars.placeholder}
              keyboardType="phone-pad"
            />
            {shouldShowError("phone") && errors.phone ? (
              <Text style={styles.errorText}>{errors.phone}</Text>
            ) : null}

            <TextInput
              style={styles.input}
              value={nationality}
              onChangeText={setNationality}
              placeholder="Nationality"
              placeholderTextColor={stylesVars.placeholder}
            />
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Current address"
              placeholderTextColor={stylesVars.placeholder}
            />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Government ID (Required)</Text>
            <View style={styles.chipRow}>
              {idTypeOptions.map((option) => (
                <Pressable
                  key={option}
                  style={[styles.chip, idType === option && styles.chipActive]}
                  onPress={() => {
                    setIdType(option);
                    if (option === "Passport") {
                      setIdBackFile(null);
                    }
                  }}
                >
                  <Text style={[styles.chipText, idType === option && styles.chipTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.input}
              value={idNumber}
              onChangeText={setIdNumber}
              onBlur={() => markTouched("idNumber")}
              placeholder="ID number (Required)"
              placeholderTextColor={stylesVars.placeholder}
            />
            {shouldShowError("idNumber") && errors.idNumber ? (
              <Text style={styles.errorText}>{errors.idNumber}</Text>
            ) : null}

            <TextInput
              style={styles.input}
              value={idExpiry}
              onChangeText={setIdExpiry}
              onBlur={() => markTouched("idExpiry")}
              placeholder="ID expiry date YYYY-MM-DD (Required)"
              placeholderTextColor={stylesVars.placeholder}
            />
            {shouldShowError("idExpiry") && errors.idExpiry ? (
              <Text style={styles.errorText}>{errors.idExpiry}</Text>
            ) : null}

            <View style={styles.uploadRow}>
              <Pressable
                style={styles.uploadBox}
                onPress={() => pickDocument("ID front", setIdFrontFile, "idFrontFile")}
              >
                <View style={styles.uploadIcon}>
                  <Text style={styles.uploadIconText}>UP</Text>
                </View>
                <Text style={styles.uploadText}>
                  {idFrontFile ? idFrontFile.name : "Front side"}
                </Text>
              </Pressable>

              <Pressable
                style={styles.uploadBox}
                onPress={() => pickDocument("ID back", setIdBackFile, "idBackFile")}
                disabled={!requiresIdBack}
              >
                <View style={styles.uploadIcon}>
                  <Text style={styles.uploadIconText}>UP</Text>
                </View>
                <Text style={styles.uploadText}>
                  {!requiresIdBack
                    ? "Back side (not required)"
                    : idBackFile
                      ? idBackFile.name
                      : "Back side"}
                </Text>
              </Pressable>
            </View>
            {shouldShowError("idFrontFile") && errors.idFrontFile ? (
              <Text style={styles.errorText}>{errors.idFrontFile}</Text>
            ) : null}
            {shouldShowError("idBackFile") && errors.idBackFile ? (
              <Text style={styles.errorText}>{errors.idBackFile}</Text>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Selfie or face verification (Required)</Text>
            <Pressable
              style={styles.uploadWide}
              onPress={() => pickDocument("Selfie", setSelfieFile, "selfieFile")}
            >
              <View style={styles.uploadIcon}>
                <Text style={styles.uploadIconText}>UP</Text>
              </View>
              <Text style={styles.uploadText}>
                {selfieFile ? selfieFile.name : "Upload selfie"}
              </Text>
            </Pressable>
            {shouldShowError("selfieFile") && errors.selfieFile ? (
              <Text style={styles.errorText}>{errors.selfieFile}</Text>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Employment and income details (Required)</Text>
            <TextInput
              style={styles.input}
              value={employerName}
              onChangeText={setEmployerName}
              onBlur={() => markTouched("employerName")}
              placeholder="Employer name"
              placeholderTextColor={stylesVars.placeholder}
            />
            {shouldShowError("employerName") && errors.employerName ? (
              <Text style={styles.errorText}>{errors.employerName}</Text>
            ) : null}

            <TextInput
              style={styles.input}
              value={jobTitle}
              onChangeText={setJobTitle}
              onBlur={() => markTouched("jobTitle")}
              placeholder="Job title"
              placeholderTextColor={stylesVars.placeholder}
            />
            {shouldShowError("jobTitle") && errors.jobTitle ? (
              <Text style={styles.errorText}>{errors.jobTitle}</Text>
            ) : null}

            <TextInput
              style={styles.input}
              value={employmentStart}
              onChangeText={setEmploymentStart}
              onBlur={() => markTouched("employmentStart")}
              placeholder="Employment start YYYY-MM-DD"
              placeholderTextColor={stylesVars.placeholder}
            />
            {shouldShowError("employmentStart") && errors.employmentStart ? (
              <Text style={styles.errorText}>{errors.employmentStart}</Text>
            ) : null}

            <TextInput
              style={styles.input}
              value={monthlyIncome}
              onChangeText={setMonthlyIncome}
              onBlur={() => markTouched("monthlyIncome")}
              placeholder="Monthly income"
              placeholderTextColor={stylesVars.placeholder}
              keyboardType="numeric"
            />
            {shouldShowError("monthlyIncome") && errors.monthlyIncome ? (
              <Text style={styles.errorText}>{errors.monthlyIncome}</Text>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Financial information (Required)</Text>
            <TextInput
              style={styles.input}
              value={monthlyExpenses}
              onChangeText={setMonthlyExpenses}
              onBlur={() => markTouched("monthlyExpenses")}
              placeholder="Monthly expenses"
              placeholderTextColor={stylesVars.placeholder}
              keyboardType="numeric"
            />
            {shouldShowError("monthlyExpenses") && errors.monthlyExpenses ? (
              <Text style={styles.errorText}>{errors.monthlyExpenses}</Text>
            ) : null}

            <TextInput
              style={styles.input}
              value={outstandingLoans}
              onChangeText={setOutstandingLoans}
              onBlur={() => markTouched("outstandingLoans")}
              placeholder="Outstanding loans"
              placeholderTextColor={stylesVars.placeholder}
              keyboardType="numeric"
            />
            {shouldShowError("outstandingLoans") && errors.outstandingLoans ? (
              <Text style={styles.errorText}>{errors.outstandingLoans}</Text>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Upload payslips and bank statements (Required)</Text>
            <Pressable
              style={styles.uploadWide}
              onPress={() => pickDocument("Payslips", setPayslipsFile, "payslipsFile")}
            >
              <View style={styles.uploadIcon}>
                <Text style={styles.uploadIconText}>UP</Text>
              </View>
              <Text style={styles.uploadText}>
                {payslipsFile ? payslipsFile.name : "Upload payslips"}
              </Text>
            </Pressable>
            {shouldShowError("payslipsFile") && errors.payslipsFile ? (
              <Text style={styles.errorText}>{errors.payslipsFile}</Text>
            ) : null}

            <Pressable
              style={styles.uploadWide}
              onPress={() =>
                pickDocument("Bank statements", setBankStatementsFile, "bankStatementsFile")
              }
            >
              <View style={styles.uploadIcon}>
                <Text style={styles.uploadIconText}>UP</Text>
              </View>
              <Text style={styles.uploadText}>
                {bankStatementsFile ? bankStatementsFile.name : "Upload bank statements"}
              </Text>
            </Pressable>
            {shouldShowError("bankStatementsFile") && errors.bankStatementsFile ? (
              <Text style={styles.errorText}>{errors.bankStatementsFile}</Text>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Amount you want to loan</Text>
            <TextInput
              style={styles.input}
              value={loanAmount}
              onChangeText={setLoanAmount}
              onBlur={() => markTouched("loanAmount")}
              placeholder="100,000.00"
              placeholderTextColor={stylesVars.placeholder}
              keyboardType="numeric"
            />
            {shouldShowError("loanAmount") && errors.loanAmount ? (
              <Text style={styles.errorText}>{errors.loanAmount}</Text>
            ) : null}

            <Text style={styles.sectionLabel}>Monthly program</Text>
            <View style={styles.chipRow}>
              {repaymentOptions.map((option) => (
                <Pressable
                  key={option}
                  style={[styles.chip, repaymentPlan === option && styles.chipActive]}
                  onPress={() => setRepaymentPlan(option)}
                >
                  <Text style={[styles.chipText, repaymentPlan === option && styles.chipTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
            {shouldShowError("repaymentPlan") && errors.repaymentPlan ? (
              <Text style={styles.errorText}>{errors.repaymentPlan}</Text>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Security and data protection</Text>
            <Text style={styles.securityText}>
              Your documents are encrypted in transit and stored securely. We only use them
              to verify your application.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Pressable style={styles.checkboxRow} onPress={() => setTermsAccepted((prev) => !prev)}>
              <View style={[styles.checkbox, termsAccepted && styles.checkboxActive]}>
                {termsAccepted ? <Text style={styles.checkboxTick}>X</Text> : null}
              </View>
              <Text style={styles.checkboxText}>Accepted all terms and conditions</Text>
            </Pressable>
            {shouldShowError("termsAccepted") && errors.termsAccepted ? (
              <Text style={styles.errorText}>{errors.termsAccepted}</Text>
            ) : null}

            <Pressable style={styles.submitButton} onPress={onSubmit}>
              <Text style={styles.submitButtonText}>Submit</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const stylesVars = {
  background: "#f6f2ff",
  card: "#ffffff",
  border: "#dedbff",
  accent: "#5b5eea",
  accentLight: "#eef0ff",
  text: "#1f1f2e",
  subtext: "#6e6e8f",
  placeholder: "#8a8aa3",
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: stylesVars.background,
  },
  screen: {
    flex: 1,
    backgroundColor: stylesVars.background,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: stylesVars.card,
    borderWidth: 1,
    borderColor: stylesVars.border,
  },
  backText: {
    fontSize: 18,
    color: stylesVars.text,
    fontWeight: "700",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: stylesVars.text,
  },
  headerSpacer: {
    width: 36,
  },
  headerSubtitle: {
    marginTop: 6,
    color: stylesVars.subtext,
    fontSize: 13,
  },
  progressTrack: {
    marginTop: 10,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#e6e2ff",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: stylesVars.accent,
  },
  progressCaption: {
    marginTop: 6,
    color: stylesVars.subtext,
    fontSize: 12,
  },
  sectionCard: {
    backgroundColor: stylesVars.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: stylesVars.border,
    gap: 10,
  },
  sectionLabel: {
    color: stylesVars.text,
    fontSize: 13,
    fontWeight: "700",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: stylesVars.border,
    backgroundColor: "#f7f6ff",
  },
  chipActive: {
    backgroundColor: stylesVars.accentLight,
    borderColor: stylesVars.accent,
  },
  chipText: {
    color: stylesVars.subtext,
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: stylesVars.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    backgroundColor: stylesVars.accentLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: stylesVars.border,
    color: stylesVars.text,
    fontSize: 13,
  },
  uploadRow: {
    flexDirection: "row",
    gap: 10,
  },
  uploadBox: {
    flex: 1,
    backgroundColor: stylesVars.accentLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: stylesVars.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 6,
  },
  uploadWide: {
    backgroundColor: stylesVars.accentLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: stylesVars.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 6,
  },
  uploadIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: stylesVars.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  uploadIconText: {
    fontSize: 10,
    fontWeight: "700",
    color: stylesVars.accent,
  },
  uploadText: {
    color: stylesVars.subtext,
    fontSize: 12,
  },
  securityText: {
    color: stylesVars.subtext,
    fontSize: 12,
    lineHeight: 18,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: stylesVars.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: stylesVars.accentLight,
    borderColor: stylesVars.accent,
  },
  checkboxTick: {
    fontSize: 12,
    fontWeight: "700",
    color: stylesVars.accent,
  },
  checkboxText: {
    flex: 1,
    color: stylesVars.subtext,
    fontSize: 12,
  },
  submitButton: {
    marginTop: 6,
    backgroundColor: stylesVars.accent,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  errorText: {
    color: "#d14b62",
    fontSize: 11,
  },
});
