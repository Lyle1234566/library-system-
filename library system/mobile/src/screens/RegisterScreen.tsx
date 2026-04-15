import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authApi } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import {
  getPasswordRequirements,
  getPasswordValidationMessage,
  isValidPassword,
} from "../lib/passwordRules";
import { AuthStackParamList } from "../navigation/RootNavigator";
import { theme } from "../theme/theme";
import { RegisterRole } from "../types";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

type FormState = {
  studentId: string;
  fullName: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

type FormErrors = {
  studentId?: string;
  fullName?: string;
  email?: string;
  password?: string;
  passwordConfirm?: string;
  general?: string;
};

const AUTH_COLORS = {
  canvas: "#b9e4dc",
  header: "#0f7f83",
  panel: "#f9fcfb",
  panelShadow: "rgba(12, 91, 95, 0.16)",
  field: "#ffffff",
  fieldBorder: "#dfedeb",
  fieldMuted: "#7b9e9b",
  text: "#195f63",
  textMuted: "#7d9f9c",
  title: "#176a6e",
  button: "#0d8084",
  buttonText: "#f8fffe",
  accent: "#7fc090",
  accentSoft: "rgba(127, 192, 144, 0.2)",
  accentStrong: "#6cb17e",
  switchBg: "#edf7f5",
  switchBorder: "#d4e7e3",
  errorBg: "#ffe9e8",
  error: "#bf555b",
  success: "#5aa96e",
};

const EMAIL_REQUIRED_MESSAGE = "A real email is required so we can send the login OTP.";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const RegisterScreen = ({ navigation, route }: Props) => {
  const { register } = useAuth();
  const recoveryParams =
    route.params && "recovery" in route.params && route.params.recovery === "otp"
      ? route.params
      : null;
  const recoveryMode = Boolean(recoveryParams);
  const requestedRole = route.params && "role" in route.params ? route.params.role : undefined;
  const initialRole = recoveryParams?.accountRole ?? requestedRole ?? "STUDENT";
  const lockedIdentifier =
    initialRole === "TEACHER" ? recoveryParams?.staffId ?? "" : recoveryParams?.studentId ?? "";

  const [form, setForm] = useState<FormState>(() => ({
    studentId: recoveryMode ? lockedIdentifier : "",
    fullName: recoveryMode ? recoveryParams?.fullName ?? "" : "",
    email: recoveryMode ? recoveryParams?.email ?? "" : "",
    password: "",
    passwordConfirm: "",
  }));
  const [registerRole, setRegisterRole] = useState<RegisterRole>(initialRole);
  const [errors, setErrors] = useState<FormErrors>({});
  const [checkingId, setCheckingId] = useState(false);
  const [studentIdAvailable, setStudentIdAvailable] = useState<boolean | null>(null);
  const [studentIdStatusMessage, setStudentIdStatusMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const idLabel = registerRole === "TEACHER" ? "Faculty ID" : "Student ID";
  const screenTitle = recoveryMode ? "Update Email" : "Sign Up";
  const screenSubtitle = recoveryMode
    ? "Correct the saved email address before we resend the verification code."
    : registerRole === "TEACHER"
      ? "Create your faculty library account."
      : "Create your student library account.";
  const passwordRequirements = getPasswordRequirements(form.password);
  const passwordsMatch = Boolean(form.passwordConfirm && form.password === form.passwordConfirm);

  const update = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, general: undefined }));

    if (field === "studentId") {
      setStudentIdAvailable(null);
      setStudentIdStatusMessage("");
    }
  };

  const checkStudentId = async (): Promise<boolean> => {
    if (recoveryMode) {
      return true;
    }

    const value = form.studentId.trim();
    if (value.length < 3) {
      return false;
    }

    setCheckingId(true);
    const result = await authApi.checkAccountIdentifier(value, registerRole);
    setCheckingId(false);

    if (result.error || !result.data) {
      const message = result.error ?? `Unable to check ${idLabel.toLowerCase()} availability.`;
      setStudentIdAvailable(null);
      setStudentIdStatusMessage(message);
      return true;
    }

    const accountCheck = result.data;
    if (accountCheck.available) {
      setStudentIdAvailable(true);
      setStudentIdStatusMessage(accountCheck.message ?? `${idLabel} is available.`);
      setErrors((prev) => ({ ...prev, studentId: undefined }));
      return true;
    }

    setStudentIdAvailable(false);
    setStudentIdStatusMessage(accountCheck.message ?? `${idLabel} is unavailable.`);
    setErrors((prev) => ({
      ...prev,
      studentId: accountCheck.message ?? `${idLabel} is unavailable.`,
    }));
    return false;
  };

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};

    if (recoveryMode) {
      if (!form.email.trim()) {
        nextErrors.email = EMAIL_REQUIRED_MESSAGE;
      } else if (!isValidEmail(form.email.trim())) {
        nextErrors.email = "Please enter a valid email.";
      }

      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    }

    if (!form.studentId.trim()) {
      nextErrors.studentId = `${idLabel} is required.`;
    } else if (form.studentId.trim().length < 3) {
      nextErrors.studentId = `${idLabel} must be at least 3 characters.`;
    } else if (studentIdAvailable === false) {
      nextErrors.studentId = studentIdStatusMessage || `${idLabel} is unavailable.`;
    }

    if (!form.fullName.trim()) {
      nextErrors.fullName = "Full name is required.";
    }

    if (!form.email.trim()) {
      nextErrors.email = EMAIL_REQUIRED_MESSAGE;
    } else if (!isValidEmail(form.email.trim())) {
      nextErrors.email = "Please enter a valid email.";
    }

    if (!form.password) {
      nextErrors.password = "Password is required.";
    } else if (!isValidPassword(form.password)) {
      nextErrors.password = getPasswordValidationMessage();
    }

    if (!form.passwordConfirm) {
      nextErrors.passwordConfirm = "Confirm your password.";
    } else if (form.password !== form.passwordConfirm) {
      nextErrors.passwordConfirm = "Passwords do not match.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goBack = () => {
    if (recoveryMode && recoveryParams) {
      navigation.replace("LoginOTP", {
        otpSession: recoveryParams.otpSession,
        email: form.email.trim() || recoveryParams.email,
        fullName: recoveryParams.fullName,
        accountRole: recoveryParams.accountRole,
        studentId: recoveryParams.studentId,
        staffId: recoveryParams.staffId,
        flow: recoveryParams.flow ?? "login",
      });
      return;
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("Login");
  };

  const submit = async () => {
    if (submitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    if (recoveryMode && recoveryParams) {
      setSubmitting(true);
      const result = await authApi.updatePendingEmail(recoveryParams.otpSession, form.email.trim());
      setSubmitting(false);

      if (result.error || !result.data?.email || !result.data?.otpSession) {
        setErrors((prev) => ({ ...prev, general: result.error ?? "Unable to update email." }));
        return;
      }

      navigation.replace("LoginOTP", {
        otpSession: result.data.otpSession,
        email: result.data.email,
        fullName: recoveryParams.fullName,
        accountRole: recoveryParams.accountRole,
        studentId: recoveryParams.studentId,
        staffId: recoveryParams.staffId,
        flow: recoveryParams.flow ?? "login",
        autoSendOtp: true,
        emailUpdated: true,
      });
      return;
    }

    const identifierAvailable = await checkStudentId();
    if (!identifierAvailable) {
      return;
    }

    setSubmitting(true);
    const result = await register({
      role: registerRole,
      ...(registerRole === "TEACHER"
        ? { staff_id: form.studentId.trim() }
        : { student_id: form.studentId.trim() }),
      full_name: form.fullName.trim(),
      email: form.email.trim(),
      password: form.password,
      password_confirm: form.passwordConfirm,
    });
    setSubmitting(false);

    if (!result.success) {
      setErrors((prev) => ({ ...prev, general: result.error ?? "Registration failed." }));
      return;
    }

    if (result.data?.requires_otp) {
      navigation.replace("LoginOTP", {
        otpSession: result.data.otp_session,
        email: result.data.email,
        fullName: result.data.full_name,
        accountRole: result.data.role === "TEACHER" ? "TEACHER" : "STUDENT",
        studentId: result.data.student_id ?? undefined,
        staffId: result.data.staff_id ?? undefined,
        flow: "registration",
        otpSentInitial: true,
      });
      return;
    }

    if (result.requiresApproval) {
      Alert.alert(
        "Registration submitted",
        result.message ??
          "Wait for account approval, then sign in and verify the email address with OTP."
      );
      navigation.navigate("Login");
      return;
    }

    Alert.alert("Account created", result.message ?? "You can now sign in.");
    navigation.navigate("Login");
  };

  const availabilityHint = (() => {
    if (recoveryMode) {
      return "This ID stays locked to the saved registration record.";
    }
    if (checkingId) {
      return `Checking ${idLabel.toLowerCase()} availability...`;
    }
    if (studentIdAvailable === true) {
      return studentIdStatusMessage || `${idLabel} is available.`;
    }
    if (studentIdAvailable === false) {
      return studentIdStatusMessage || `${idLabel} is unavailable.`;
    }
    return " ";
  })();

  const helperCopy = recoveryMode
    ? "We will send the next OTP to the corrected address."
    : "New accounts may still require staff approval before the first login.";

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.artboard}>
            <View style={styles.heroSection}>
              <View style={[styles.heroBlob, styles.heroBlobLarge]} />
              <View style={[styles.heroBlob, styles.heroBlobSmall]} />

              <Pressable onPress={goBack} style={styles.backLink}>
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={18}
                  color="rgba(255,255,255,0.82)"
                />
                <Text style={styles.backLinkText}>
                  {recoveryMode ? "Back to verification" : "Back to login"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>{screenTitle}</Text>
              <Text style={styles.sheetSubtitle}>{screenSubtitle}</Text>

              {!recoveryMode ? (
                <View style={styles.roleSwitch}>
                  <Pressable
                    style={[
                      styles.roleOption,
                      registerRole === "STUDENT" && styles.roleOptionActive,
                    ]}
                    onPress={() => {
                      setRegisterRole("STUDENT");
                      setStudentIdAvailable(null);
                      setStudentIdStatusMessage("");
                      setErrors({});
                      setForm((prev) => ({ ...prev, studentId: "" }));
                    }}
                  >
                    <Text
                      style={[
                        styles.roleOptionText,
                        registerRole === "STUDENT" && styles.roleOptionTextActive,
                      ]}
                    >
                      Student
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.roleOption,
                      registerRole === "TEACHER" && styles.roleOptionActive,
                    ]}
                    onPress={() => {
                      setRegisterRole("TEACHER");
                      setStudentIdAvailable(null);
                      setStudentIdStatusMessage("");
                      setErrors({});
                      setForm((prev) => ({ ...prev, studentId: "" }));
                    }}
                  >
                    <Text
                      style={[
                        styles.roleOptionText,
                        registerRole === "TEACHER" && styles.roleOptionTextActive,
                      ]}
                    >
                      Teacher
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.noticeBox}>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={18}
                    color={AUTH_COLORS.title}
                  />
                  <Text style={styles.noticeText}>
                    We kept the saved details below. Only the email can be changed here.
                  </Text>
                </View>
              )}

              {!!errors.general && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errors.general}</Text>
                </View>
              )}

              <View style={styles.fieldGroup}>
                <View
                  style={[
                    styles.inputShell,
                    recoveryMode && styles.inputShellReadonly,
                    errors.studentId && styles.inputShellError,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="badge-account-horizontal-outline"
                    size={19}
                    color={AUTH_COLORS.fieldMuted}
                  />
                  <TextInput
                    style={styles.input}
                    value={form.studentId}
                    onChangeText={(value) => update("studentId", value)}
                    onBlur={() => {
                      void checkStudentId();
                    }}
                    placeholder={idLabel}
                    placeholderTextColor={AUTH_COLORS.fieldMuted}
                    editable={!recoveryMode}
                    autoCapitalize="none"
                  />

                  {!recoveryMode ? (
                    checkingId ? (
                      <ActivityIndicator size="small" color={AUTH_COLORS.title} />
                    ) : studentIdAvailable === true ? (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={18}
                        color={AUTH_COLORS.success}
                      />
                    ) : studentIdAvailable === false ? (
                      <MaterialCommunityIcons
                        name="close-circle"
                        size={18}
                        color={AUTH_COLORS.error}
                      />
                    ) : null
                  ) : null}
                </View>
                <Text style={styles.helperText}>{availabilityHint}</Text>
                {!!errors.studentId && <Text style={styles.errorInline}>{errors.studentId}</Text>}
              </View>

              <View style={styles.fieldGroup}>
                <View
                  style={[
                    styles.inputShell,
                    recoveryMode && styles.inputShellReadonly,
                    errors.fullName && styles.inputShellError,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="account-outline"
                    size={19}
                    color={AUTH_COLORS.fieldMuted}
                  />
                  <TextInput
                    style={styles.input}
                    value={form.fullName}
                    onChangeText={(value) => update("fullName", value)}
                    placeholder="Full Name"
                    placeholderTextColor={AUTH_COLORS.fieldMuted}
                    editable={!recoveryMode}
                  />
                </View>
                {!!errors.fullName && <Text style={styles.errorInline}>{errors.fullName}</Text>}
              </View>

              <View style={styles.fieldGroup}>
                <View style={[styles.inputShell, errors.email && styles.inputShellError]}>
                  <MaterialCommunityIcons
                    name="email-outline"
                    size={19}
                    color={AUTH_COLORS.fieldMuted}
                  />
                  <TextInput
                    style={styles.input}
                    value={form.email}
                    onChangeText={(value) => update("email", value)}
                    placeholder="Email"
                    placeholderTextColor={AUTH_COLORS.fieldMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                <Text style={styles.helperText}>
                  {recoveryMode
                    ? "Use an email address the account owner can access right now."
                    : "We use this email for OTP verification and approval updates."}
                </Text>
                {!!errors.email && <Text style={styles.errorInline}>{errors.email}</Text>}
              </View>

              {!recoveryMode ? (
                <>
                  <View style={styles.passwordIntroBox}>
                    <Text style={styles.passwordIntroTitle}>Create Password</Text>
                    <Text style={styles.passwordIntroCopy}>
                      This will be used to log in to your account.
                    </Text>
                  </View>

                  <View style={styles.fieldGroup}>
                    <View style={[styles.inputShell, errors.password && styles.inputShellError]}>
                      <MaterialCommunityIcons
                        name="lock-outline"
                        size={19}
                        color={AUTH_COLORS.fieldMuted}
                      />
                      <TextInput
                        style={styles.input}
                        value={form.password}
                        onChangeText={(value) => update("password", value)}
                        secureTextEntry={!showPassword}
                        placeholder="Password"
                        placeholderTextColor={AUTH_COLORS.fieldMuted}
                      />
                      <Pressable onPress={() => setShowPassword((prev) => !prev)} hitSlop={8}>
                        <MaterialCommunityIcons
                          name={showPassword ? "eye-outline" : "eye-off-outline"}
                          size={19}
                          color={AUTH_COLORS.fieldMuted}
                        />
                      </Pressable>
                    </View>
                    {!!errors.password && <Text style={styles.errorInline}>{errors.password}</Text>}
                    <View style={styles.passwordChecklist}>
                      <Text style={styles.passwordChecklistTitle}>Password must have</Text>
                      {passwordRequirements.map((item) => (
                        <View key={item.id} style={styles.passwordRuleRow}>
                          <MaterialCommunityIcons
                            name={item.met ? "check-circle" : "circle-outline"}
                            size={18}
                            color={item.met ? AUTH_COLORS.success : AUTH_COLORS.textMuted}
                          />
                          <Text style={[styles.passwordRuleText, item.met && styles.passwordRuleTextMet]}>
                            {item.label}
                          </Text>
                        </View>
                      ))}
                      <Text style={styles.passwordChecklistHint}>
                        Use a strong password that is not easy to guess.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <View
                      style={[styles.inputShell, errors.passwordConfirm && styles.inputShellError]}
                    >
                      <MaterialCommunityIcons
                        name="lock-check-outline"
                        size={19}
                        color={AUTH_COLORS.fieldMuted}
                      />
                      <TextInput
                        style={styles.input}
                        value={form.passwordConfirm}
                        onChangeText={(value) => update("passwordConfirm", value)}
                        secureTextEntry={!showPasswordConfirm}
                        placeholder="Confirm Password"
                        placeholderTextColor={AUTH_COLORS.fieldMuted}
                      />
                      <Pressable
                        onPress={() => setShowPasswordConfirm((prev) => !prev)}
                        hitSlop={8}
                      >
                        <MaterialCommunityIcons
                          name={showPasswordConfirm ? "eye-outline" : "eye-off-outline"}
                          size={19}
                          color={AUTH_COLORS.fieldMuted}
                        />
                      </Pressable>
                    </View>
                    {!!errors.passwordConfirm && (
                      <Text style={styles.errorInline}>{errors.passwordConfirm}</Text>
                    )}
                    {passwordsMatch ? <Text style={styles.matchText}>Passwords match.</Text> : null}
                  </View>
                </>
              ) : null}

              <Pressable
                style={[
                  styles.primaryButton,
                  (submitting || (!recoveryMode && studentIdAvailable === false)) &&
                    styles.buttonDisabled,
                ]}
                onPress={submit}
                disabled={submitting || (!recoveryMode && studentIdAvailable === false)}
              >
                {submitting ? (
                  <ActivityIndicator color={AUTH_COLORS.buttonText} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {recoveryMode ? "Update Email" : "Sign Up"}
                  </Text>
                )}
              </Pressable>

              <Text style={styles.bottomNote}>{helperCopy}</Text>

              {!recoveryMode ? (
                <View style={styles.footerRow}>
                  <Text style={styles.footerCopy}>Already have an account?</Text>
                  <Pressable onPress={goBack}>
                    <Text style={styles.footerLink}>Login</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AUTH_COLORS.canvas,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  artboard: {
    flex: 1,
    minHeight: theme.layout.screenHeight,
    backgroundColor: AUTH_COLORS.canvas,
  },
  heroSection: {
    minHeight: theme.normalize(172),
    backgroundColor: AUTH_COLORS.header,
    paddingHorizontal: theme.normalize(24),
    paddingTop: theme.normalize(18),
    paddingBottom: theme.normalize(66),
    overflow: "hidden",
  },
  heroBlob: {
    position: "absolute",
    backgroundColor: "rgba(208, 241, 226, 0.55)",
  },
  heroBlobLarge: {
    width: theme.normalize(104),
    height: theme.normalize(68),
    top: theme.normalize(-8),
    left: theme.normalize(-20),
    borderTopLeftRadius: theme.normalize(14),
    borderTopRightRadius: theme.normalize(48),
    borderBottomLeftRadius: theme.normalize(60),
    borderBottomRightRadius: theme.normalize(26),
    transform: [{ rotate: "-18deg" }],
  },
  heroBlobSmall: {
    width: theme.normalize(54),
    height: theme.normalize(34),
    top: theme.normalize(28),
    left: theme.normalize(6),
    borderRadius: theme.normalize(30),
    opacity: 0.55,
  },
  backLink: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.normalize(10),
    paddingVertical: theme.normalize(7),
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  backLinkText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: theme.normalize(12),
    fontWeight: "700",
  },
  sheet: {
    flex: 1,
    marginTop: theme.normalize(-36),
    backgroundColor: AUTH_COLORS.panel,
    borderTopLeftRadius: theme.normalize(34),
    borderTopRightRadius: theme.normalize(34),
    paddingHorizontal: theme.normalize(24),
    paddingTop: theme.normalize(28),
    paddingBottom: theme.normalize(36),
    shadowColor: AUTH_COLORS.panelShadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 7,
  },
  sheetTitle: {
    fontSize: theme.normalize(30),
    lineHeight: theme.normalize(32),
    fontWeight: "800",
    color: AUTH_COLORS.title,
  },
  sheetSubtitle: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.normalize(20),
    fontSize: theme.normalize(14),
    lineHeight: theme.normalize(19),
    color: AUTH_COLORS.textMuted,
  },
  roleSwitch: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    padding: theme.normalize(5),
    borderRadius: theme.borderRadius.full,
    backgroundColor: AUTH_COLORS.switchBg,
    borderWidth: 1,
    borderColor: AUTH_COLORS.switchBorder,
    marginBottom: theme.normalize(16),
  },
  roleOption: {
    flex: 1,
    minHeight: theme.normalize(42),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.full,
  },
  roleOptionActive: {
    backgroundColor: AUTH_COLORS.button,
  },
  roleOptionText: {
    color: AUTH_COLORS.textMuted,
    fontSize: theme.normalize(13),
    fontWeight: "700",
  },
  roleOptionTextActive: {
    color: AUTH_COLORS.buttonText,
  },
  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    backgroundColor: AUTH_COLORS.accentSoft,
    borderRadius: theme.normalize(18),
    paddingHorizontal: theme.normalize(14),
    paddingVertical: theme.normalize(12),
    marginBottom: theme.normalize(16),
  },
  noticeText: {
    flex: 1,
    color: AUTH_COLORS.title,
    fontSize: theme.normalize(13),
    lineHeight: theme.normalize(18),
  },
  passwordIntroBox: {
    backgroundColor: AUTH_COLORS.accentSoft,
    borderRadius: theme.normalize(18),
    paddingHorizontal: theme.normalize(14),
    paddingVertical: theme.normalize(12),
    marginBottom: theme.normalize(12),
  },
  passwordIntroTitle: {
    color: AUTH_COLORS.title,
    fontSize: theme.normalize(11),
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  passwordIntroCopy: {
    marginTop: theme.spacing.xs,
    color: AUTH_COLORS.text,
    fontSize: theme.normalize(13),
    lineHeight: theme.normalize(18),
  },
  errorBox: {
    backgroundColor: AUTH_COLORS.errorBg,
    borderRadius: theme.normalize(18),
    paddingHorizontal: theme.normalize(14),
    paddingVertical: theme.normalize(12),
    marginBottom: theme.normalize(14),
  },
  errorText: {
    color: AUTH_COLORS.error,
    fontSize: theme.normalize(13),
    lineHeight: theme.normalize(18),
  },
  fieldGroup: {
    marginBottom: theme.normalize(12),
  },
  inputShell: {
    minHeight: theme.normalize(52),
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: AUTH_COLORS.fieldBorder,
    backgroundColor: AUTH_COLORS.field,
    paddingHorizontal: theme.normalize(16),
  },
  inputShellReadonly: {
    backgroundColor: "#f2f8f7",
  },
  inputShellError: {
    borderColor: AUTH_COLORS.error,
  },
  input: {
    flex: 1,
    paddingVertical: theme.normalize(14),
    color: AUTH_COLORS.text,
    fontSize: theme.normalize(15),
  },
  helperText: {
    minHeight: theme.normalize(18),
    marginTop: theme.spacing.xs,
    marginLeft: theme.normalize(8),
    color: AUTH_COLORS.textMuted,
    fontSize: theme.normalize(12),
    lineHeight: theme.normalize(17),
  },
  errorInline: {
    marginTop: theme.spacing.xs,
    marginLeft: theme.normalize(8),
    color: AUTH_COLORS.error,
    fontSize: theme.normalize(12),
  },
  passwordChecklist: {
    marginTop: theme.spacing.sm,
    marginLeft: theme.normalize(8),
    gap: theme.spacing.xs,
  },
  passwordChecklistTitle: {
    marginBottom: theme.spacing.xs,
    color: AUTH_COLORS.textMuted,
    fontSize: theme.normalize(11),
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  passwordRuleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  passwordRuleText: {
    fontSize: theme.normalize(12),
    color: AUTH_COLORS.textMuted,
  },
  passwordRuleTextMet: {
    color: AUTH_COLORS.success,
    fontWeight: "700",
  },
  passwordChecklistHint: {
    marginTop: theme.spacing.xs,
    color: AUTH_COLORS.textMuted,
    fontSize: theme.normalize(12),
    lineHeight: theme.normalize(17),
  },
  matchText: {
    marginTop: theme.spacing.xs,
    marginLeft: theme.normalize(8),
    color: AUTH_COLORS.success,
    fontSize: theme.normalize(12),
    fontWeight: "700",
  },
  primaryButton: {
    marginTop: theme.normalize(8),
    minHeight: theme.normalize(52),
    borderRadius: theme.borderRadius.full,
    backgroundColor: AUTH_COLORS.button,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: AUTH_COLORS.buttonText,
    fontSize: theme.normalize(15),
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  bottomNote: {
    marginTop: theme.normalize(14),
    textAlign: "center",
    color: AUTH_COLORS.textMuted,
    fontSize: theme.normalize(12),
    lineHeight: theme.normalize(17),
  },
  footerRow: {
    marginTop: theme.normalize(18),
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  footerCopy: {
    color: AUTH_COLORS.textMuted,
    fontSize: theme.normalize(13),
  },
  footerLink: {
    color: AUTH_COLORS.title,
    fontSize: theme.normalize(13),
    fontWeight: "800",
  },
});
