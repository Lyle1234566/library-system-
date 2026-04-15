import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  ActivityIndicator,
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
import { useAuth } from "../auth/AuthContext";
import { AuthStackParamList } from "../navigation/RootNavigator";
import { theme } from "../theme/theme";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

type LoginErrors = {
  id?: string;
  password?: string;
  general?: string;
};

const AUTH_COLORS = {
  canvas: "#b9e4dc",
  header: "#0f7f83",
  headerDark: "#0c6c70",
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
  accentSoft: "rgba(127, 192, 144, 0.28)",
  whiteSoft: "rgba(255,255,255,0.78)",
  errorBg: "#ffe9e8",
  error: "#bf555b",
};

export const LoginScreen = ({ navigation }: Props) => {
  const { login, isLoading } = useAuth();
  const [idValue, setIdValue] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});

  const updateId = (value: string) => {
    setIdValue(value);
    setErrors((prev) => ({ ...prev, id: undefined, general: undefined }));
  };

  const updatePassword = (value: string) => {
    setPassword(value);
    setErrors((prev) => ({ ...prev, password: undefined, general: undefined }));
  };

  const validate = (): boolean => {
    const nextErrors: LoginErrors = {};

    if (!idValue.trim()) {
      nextErrors.id = "Account ID is required.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (submitting || isLoading) {
      return;
    }

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    setErrors({});

    const result = await login({
      student_id: idValue.trim(),
      password,
    });

    setSubmitting(false);

    if (result.success) {
      return;
    }

    if (result.data?.requires_otp) {
      navigation.navigate("LoginOTP", {
        otpSession: result.data.otp_session,
        email: result.data.email,
        fullName: result.data.full_name,
        accountRole: result.data.role === "TEACHER" ? "TEACHER" : "STUDENT",
        studentId: result.data.student_id ?? undefined,
        staffId: result.data.staff_id ?? undefined,
        flow: "login",
        autoSendOtp: true,
      });
      return;
    }

    setErrors({ general: result.error ?? "Sign in failed." });
  };

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

              <Pressable onPress={() => navigation.navigate("Landing")} style={styles.brandPill}>
                <MaterialCommunityIcons
                  name="book-open-page-variant-outline"
                  size={16}
                  color={AUTH_COLORS.whiteSoft}
                />
                <Text style={styles.brandPillText}>Salazar Library System</Text>
              </Pressable>

              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>Hello!</Text>
                <Text style={styles.heroSubtitle}>Welcome to Salazar Library System</Text>
              </View>

              <View style={styles.plantWrap}>
                <View style={styles.stem} />
                <View style={[styles.leaf, styles.leafLeftBack]} />
                <View style={[styles.leaf, styles.leafLeftFront]} />
                <View style={[styles.leaf, styles.leafRightBack]} />
                <View style={[styles.leaf, styles.leafRightFront]} />
                <View style={styles.potShadow} />
                <View style={styles.potBody}>
                  <View style={styles.potLip} />
                </View>
              </View>
            </View>

            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Login</Text>
              <Text style={styles.sheetSubtitle}>Use your approved library account to continue.</Text>

              {!!errors.general && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errors.general}</Text>
                </View>
              )}

              <View style={styles.fieldGroup}>
                <View style={[styles.inputShell, errors.id && styles.inputShellError]}>
                  <MaterialCommunityIcons
                    name="account-outline"
                    size={19}
                    color={AUTH_COLORS.fieldMuted}
                  />
                  <TextInput
                    style={styles.input}
                    value={idValue}
                    onChangeText={updateId}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Account ID"
                    placeholderTextColor={AUTH_COLORS.fieldMuted}
                  />
                </View>
                {!!errors.id && <Text style={styles.errorInline}>{errors.id}</Text>}
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
                    value={password}
                    onChangeText={updatePassword}
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
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaBadge}>
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={15}
                    color={AUTH_COLORS.title}
                  />
                  <Text style={styles.metaBadgeText}>Secure access</Text>
                </View>

                <Pressable onPress={() => navigation.navigate("ForgotPassword")}>
                  <Text style={styles.metaLink}>Forgot Password</Text>
                </Pressable>
              </View>

              <Pressable
                style={[styles.primaryButton, (submitting || isLoading) && styles.buttonDisabled]}
                onPress={submit}
                disabled={submitting || isLoading}
              >
                {submitting || isLoading ? (
                  <ActivityIndicator color={AUTH_COLORS.buttonText} />
                ) : (
                  <Text style={styles.primaryButtonText}>Login</Text>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>Library access</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.footerCopy}>Don't have an account?</Text>
                <Pressable onPress={() => navigation.navigate("Register")}>
                  <Text style={styles.footerLink}>Sign Up</Text>
                </Pressable>
              </View>
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
    minHeight: theme.normalize(300),
    backgroundColor: AUTH_COLORS.header,
    paddingHorizontal: theme.normalize(26),
    paddingTop: theme.normalize(20),
    paddingBottom: theme.normalize(86),
    overflow: "hidden",
  },
  heroBlob: {
    position: "absolute",
    backgroundColor: "rgba(208, 241, 226, 0.55)",
  },
  heroBlobLarge: {
    width: theme.normalize(104),
    height: theme.normalize(68),
    top: theme.normalize(-6),
    left: theme.normalize(-18),
    borderTopLeftRadius: theme.normalize(14),
    borderTopRightRadius: theme.normalize(48),
    borderBottomLeftRadius: theme.normalize(60),
    borderBottomRightRadius: theme.normalize(26),
    transform: [{ rotate: "-18deg" }],
  },
  heroBlobSmall: {
    width: theme.normalize(54),
    height: theme.normalize(34),
    top: theme.normalize(30),
    left: theme.normalize(8),
    borderRadius: theme.normalize(30),
    opacity: 0.55,
  },
  brandPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.normalize(12),
    paddingVertical: theme.normalize(8),
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  brandPillText: {
    color: AUTH_COLORS.whiteSoft,
    fontSize: theme.normalize(11),
    fontWeight: "700",
  },
  heroCopy: {
    marginTop: theme.normalize(38),
    maxWidth: "58%",
    gap: theme.spacing.xs,
  },
  heroTitle: {
    fontSize: theme.normalize(32),
    lineHeight: theme.normalize(36),
    fontWeight: "800",
    color: "#f8fffe",
  },
  heroSubtitle: {
    fontSize: theme.normalize(15),
    lineHeight: theme.normalize(20),
    color: AUTH_COLORS.whiteSoft,
  },
  plantWrap: {
    position: "absolute",
    right: theme.normalize(18),
    bottom: theme.normalize(18),
    width: theme.normalize(150),
    height: theme.normalize(180),
    alignItems: "center",
    justifyContent: "flex-end",
  },
  stem: {
    position: "absolute",
    bottom: theme.normalize(56),
    width: theme.normalize(6),
    height: theme.normalize(102),
    borderRadius: theme.normalize(6),
    backgroundColor: "#a8d49f",
  },
  leaf: {
    position: "absolute",
    backgroundColor: AUTH_COLORS.accent,
    borderRadius: theme.normalize(80),
  },
  leafLeftBack: {
    width: theme.normalize(38),
    height: theme.normalize(92),
    bottom: theme.normalize(104),
    left: theme.normalize(34),
    transform: [{ rotate: "-22deg" }],
    opacity: 0.7,
  },
  leafLeftFront: {
    width: theme.normalize(30),
    height: theme.normalize(72),
    bottom: theme.normalize(116),
    left: theme.normalize(52),
    transform: [{ rotate: "-6deg" }],
  },
  leafRightBack: {
    width: theme.normalize(42),
    height: theme.normalize(104),
    bottom: theme.normalize(88),
    right: theme.normalize(26),
    transform: [{ rotate: "16deg" }],
    opacity: 0.76,
  },
  leafRightFront: {
    width: theme.normalize(30),
    height: theme.normalize(78),
    bottom: theme.normalize(98),
    right: theme.normalize(46),
    transform: [{ rotate: "26deg" }],
  },
  potShadow: {
    position: "absolute",
    bottom: theme.normalize(10),
    width: theme.normalize(72),
    height: theme.normalize(16),
    borderRadius: theme.normalize(40),
    backgroundColor: "rgba(9, 53, 57, 0.22)",
  },
  potBody: {
    width: theme.normalize(64),
    height: theme.normalize(52),
    borderTopLeftRadius: theme.normalize(16),
    borderTopRightRadius: theme.normalize(16),
    borderBottomLeftRadius: theme.normalize(28),
    borderBottomRightRadius: theme.normalize(28),
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "flex-start",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 7,
  },
  potLip: {
    width: theme.normalize(50),
    height: theme.normalize(11),
    borderRadius: theme.normalize(10),
    backgroundColor: "#edf2f2",
    marginTop: theme.normalize(6),
  },
  sheet: {
    flex: 1,
    marginTop: theme.normalize(-42),
    backgroundColor: AUTH_COLORS.panel,
    borderTopLeftRadius: theme.normalize(34),
    borderTopRightRadius: theme.normalize(34),
    paddingHorizontal: theme.normalize(26),
    paddingTop: theme.normalize(28),
    paddingBottom: theme.normalize(38),
    shadowColor: AUTH_COLORS.panelShadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 7,
  },
  sheetTitle: {
    fontSize: theme.normalize(28),
    lineHeight: theme.normalize(30),
    fontWeight: "800",
    color: AUTH_COLORS.title,
  },
  sheetSubtitle: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.normalize(22),
    fontSize: theme.normalize(14),
    lineHeight: theme.normalize(19),
    color: AUTH_COLORS.textMuted,
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
  inputShellError: {
    borderColor: AUTH_COLORS.error,
  },
  input: {
    flex: 1,
    paddingVertical: theme.normalize(14),
    color: AUTH_COLORS.text,
    fontSize: theme.normalize(15),
  },
  errorInline: {
    marginTop: theme.spacing.xs,
    marginLeft: theme.normalize(8),
    color: AUTH_COLORS.error,
    fontSize: theme.normalize(12),
  },
  metaRow: {
    marginTop: theme.normalize(2),
    marginBottom: theme.normalize(22),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.normalize(10),
    paddingVertical: theme.normalize(7),
    borderRadius: theme.borderRadius.full,
    backgroundColor: AUTH_COLORS.accentSoft,
  },
  metaBadgeText: {
    color: AUTH_COLORS.title,
    fontSize: theme.normalize(12),
    fontWeight: "700",
  },
  metaLink: {
    color: AUTH_COLORS.title,
    fontSize: theme.normalize(12),
    fontWeight: "700",
  },
  primaryButton: {
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
  dividerRow: {
    marginTop: theme.normalize(20),
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: AUTH_COLORS.fieldBorder,
  },
  dividerLabel: {
    color: AUTH_COLORS.textMuted,
    fontSize: theme.normalize(12),
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
