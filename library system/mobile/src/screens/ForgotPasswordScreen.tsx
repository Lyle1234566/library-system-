import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { passwordResetApi } from "../api/passwordReset";
import {
  PASSWORD_REQUIREMENTS_SUMMARY,
  getPasswordValidationMessage,
  isValidPassword,
} from "../lib/passwordRules";
import { AuthStackParamList } from "../navigation/RootNavigator";
import { webTheme } from "../theme/webTheme";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;
type ResetPhase = "request" | "verify" | "reset" | "done";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const ForgotPasswordScreen = ({ navigation }: Props) => {
  const [phase, setPhase] = useState<ResetPhase>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);
  const [codeLength, setCodeLength] = useState(6);
  const [expiresInMinutes, setExpiresInMinutes] = useState<number | null>(10);
  const [debugCode, setDebugCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);

  const headerDescription = useMemo(() => {
    if (phase === "done") return "Your password has been reset successfully.";
    if (phase === "verify") return "Enter the reset code sent to your email.";
    if (phase === "reset") return "Choose a new password for your account.";
    return "Enter your email address and we will send you a reset code.";
  }, [phase]);

  const resetConfirmState = () => {
    setCode("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setShowNewPassword(false);
    setShowNewPasswordConfirm(false);
  };

  const startOver = () => {
    setPhase("request");
    setCodeLength(6);
    setExpiresInMinutes(10);
    setDebugCode("");
    setMessage("");
    setError("");
    resetConfirmState();
  };

  const submitRequest = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    setError("");

    const result = await passwordResetApi.requestCode(normalizedEmail);

    setIsLoading(false);
    if (result.error || !result.data) {
      setError(result.error ?? "Unable to send reset code.");
      return;
    }

    setEmail(normalizedEmail);
    resetConfirmState();
    setCodeLength(result.data.codeLength ?? 6);
    setExpiresInMinutes(result.data.expiresInMinutes ?? null);
    setDebugCode(result.data.debugCode ?? "");
    setMessage(result.data.message);
    setPhase("verify");
  };

  const resendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !isValidEmail(normalizedEmail) || isLoading || isResendingCode) {
      return;
    }

    setIsResendingCode(true);
    setError("");

    const result = await passwordResetApi.requestCode(normalizedEmail);

    setIsResendingCode(false);
    if (result.error || !result.data) {
      setError(result.error ?? "Unable to resend reset code.");
      return;
    }

    setCode("");
    setCodeLength(result.data.codeLength ?? codeLength);
    setExpiresInMinutes(result.data.expiresInMinutes ?? expiresInMinutes);
    setDebugCode(result.data.debugCode ?? "");
    setMessage(result.data.message || "A new reset code has been sent.");
  };

  const submitVerify = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!normalizedCode) {
      setError("Please enter the reset code.");
      return;
    }
    if (normalizedCode.length !== codeLength) {
      setError(`Please enter the ${codeLength}-digit reset code.`);
      return;
    }

    setIsLoading(true);
    setError("");

    const result = await passwordResetApi.verifyCode({
      email: normalizedEmail,
      code: normalizedCode,
    });

    setIsLoading(false);
    if (result.error || !result.data) {
      setError(result.error ?? "Unable to verify reset code.");
      return;
    }

    setMessage(result.data.message);
    setPhase("reset");
  };

  const submitReset = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!normalizedCode) {
      setError("Please verify your reset code first.");
      return;
    }
    if (!newPassword) {
      setError("Please enter a new password.");
      return;
    }
    if (!isValidPassword(newPassword)) {
      setError(getPasswordValidationMessage());
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError("New passwords do not match.");
      return;
    }

    setIsLoading(true);
    setError("");

    const result = await passwordResetApi.resetPassword({
      email: normalizedEmail,
      code: normalizedCode,
      new_password: newPassword,
      new_password_confirm: newPasswordConfirm,
    });

    setIsLoading(false);
    if (result.error || !result.data) {
      setError(result.error ?? "Unable to reset password.");
      return;
    }

    setMessage(result.data.message);
    setDebugCode("");
    setPhase("done");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.glowSky} />
      <View style={styles.glowAmber} />
      <View style={styles.glowCenter} />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.brandRow}>
          <Pressable onPress={() => navigation.navigate("Login")} style={styles.backChip}>
            <Text style={styles.backChipText}>Back</Text>
          </Pressable>
          <Text style={styles.brand} numberOfLines={1} ellipsizeMode="tail">
            Salazar Library System
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.heading}>Reset your password</Text>
          <Text style={styles.subheading}>{headerDescription}</Text>

          {phase === "done" ? (
            <View style={styles.doneWrap}>
              <View style={styles.successBadge}>
                <Text style={styles.successBadgeText}>Done</Text>
              </View>
              <Text style={styles.doneTitle}>Password Reset Complete</Text>
              <Text style={styles.doneCopy}>
                {message || "You can now sign in with your new password."}
              </Text>
              <Pressable
                style={styles.submitButton}
                onPress={() => navigation.navigate("Login")}
              >
                <Text style={styles.submitText}>Back to Sign In</Text>
              </Pressable>
            </View>
          ) : phase === "verify" ? (
            <View style={styles.formWrap}>
              {!!message && (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>{message}</Text>
                </View>
              )}

              {!!debugCode && (
                <View style={styles.debugBox}>
                  <Text style={styles.debugTitle}>Development fallback code</Text>
                  <Text style={styles.debugCode}>{debugCode}</Text>
                </View>
              )}

              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={email}
                  editable={false}
                  placeholder="Email used for request"
                  placeholderTextColor={webTheme.colors.darkInkMuted}
                />
                <Text style={styles.hint}>Reset code was sent to this email.</Text>
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Reset Code</Text>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={(value) => {
                    setCode(value.replace(/\D/g, "").slice(0, codeLength));
                    setError("");
                  }}
                  keyboardType="number-pad"
                  maxLength={codeLength}
                  placeholder={`Enter ${codeLength}-digit code`}
                  placeholderTextColor={webTheme.colors.darkInkMuted}
                />
                {expiresInMinutes ? (
                  <Text style={styles.hint}>
                    Code expires in {expiresInMinutes} minute{expiresInMinutes === 1 ? "" : "s"}.
                  </Text>
                ) : null}
              </View>

              <Pressable
                style={[styles.submitButton, isLoading && styles.buttonDisabled]}
                disabled={isLoading}
                onPress={submitVerify}
              >
                {isLoading ? (
                  <ActivityIndicator color={webTheme.colors.ink} />
                ) : (
                  <Text style={styles.submitText}>Verify Code</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.linkButton}
                disabled={isLoading || isResendingCode}
                onPress={resendCode}
              >
                <Text style={styles.linkText}>
                  {isResendingCode ? "Resending code..." : "Resend code"}
                </Text>
              </Pressable>

              <Pressable style={styles.linkButton} onPress={startOver}>
                <Text style={styles.linkMutedText}>Start over</Text>
              </Pressable>
            </View>
          ) : phase === "reset" ? (
            <View style={styles.formWrap}>
              {!!message && (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>{message}</Text>
                </View>
              )}

              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={email}
                  editable={false}
                  placeholder="Email used for request"
                  placeholderTextColor={webTheme.colors.darkInkMuted}
                />
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={newPassword}
                    onChangeText={(value) => {
                      setNewPassword(value);
                      setError("");
                    }}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    placeholder="Enter a new password"
                    placeholderTextColor={webTheme.colors.darkInkMuted}
                  />
                  <Pressable
                    style={styles.toggleButton}
                    onPress={() => setShowNewPassword((prev) => !prev)}
                  >
                    <Text style={styles.toggleButtonText}>{showNewPassword ? "Hide" : "Show"}</Text>
                  </Pressable>
                </View>
                <Text style={styles.hint}>{PASSWORD_REQUIREMENTS_SUMMARY}</Text>
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Confirm New Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={newPasswordConfirm}
                    onChangeText={(value) => {
                      setNewPasswordConfirm(value);
                      setError("");
                    }}
                    secureTextEntry={!showNewPasswordConfirm}
                    autoCapitalize="none"
                    placeholder="Re-enter your new password"
                    placeholderTextColor={webTheme.colors.darkInkMuted}
                  />
                  <Pressable
                    style={styles.toggleButton}
                    onPress={() => setShowNewPasswordConfirm((prev) => !prev)}
                  >
                    <Text style={styles.toggleButtonText}>
                      {showNewPasswordConfirm ? "Hide" : "Show"}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <Pressable
                style={[styles.submitButton, isLoading && styles.buttonDisabled]}
                disabled={isLoading}
                onPress={submitReset}
              >
                {isLoading ? (
                  <ActivityIndicator color={webTheme.colors.ink} />
                ) : (
                  <Text style={styles.submitText}>Reset Password</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.linkButton}
                onPress={() => {
                  setPhase("verify");
                  setError("");
                  setMessage("");
                  setNewPassword("");
                  setNewPasswordConfirm("");
                  setShowNewPassword(false);
                  setShowNewPasswordConfirm(false);
                }}
              >
                <Text style={styles.linkText}>Use a different code</Text>
              </Pressable>

              <Pressable style={styles.linkButton} onPress={startOver}>
                <Text style={styles.linkMutedText}>Start over</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.formWrap}>
              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setError("");
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="Enter your email address"
                  placeholderTextColor={webTheme.colors.darkInkMuted}
                />
              </View>

              <Pressable
                style={[styles.submitButton, isLoading && styles.buttonDisabled]}
                disabled={isLoading}
                onPress={submitRequest}
              >
                {isLoading ? (
                  <ActivityIndicator color={webTheme.colors.ink} />
                ) : (
                  <Text style={styles.submitText}>Send Reset Code</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: webTheme.colors.darkBg,
  },
  glowSky: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 200,
    backgroundColor: "rgba(56,189,248,0.16)",
    top: -70,
    left: -70,
  },
  glowAmber: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 220,
    backgroundColor: "rgba(251,191,36,0.14)",
    bottom: -90,
    right: -90,
  },
  glowCenter: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 180,
    backgroundColor: "rgba(56,189,248,0.08)",
    top: "35%",
    right: 10,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 14,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backChip: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  backChipText: {
    color: webTheme.colors.darkInk,
    fontWeight: "600",
    fontSize: 12,
  },
  brand: {
    fontSize: 15,
    fontWeight: "700",
    color: webTheme.colors.darkInk,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  formCard: {
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
  },
  heading: {
    fontSize: 30,
    fontWeight: "800",
    color: webTheme.colors.darkInk,
  },
  subheading: {
    fontSize: 14,
    color: webTheme.colors.darkInkMuted,
    lineHeight: 20,
  },
  formWrap: {
    gap: 12,
  },
  fieldWrap: {
    gap: 6,
  },
  label: {
    color: webTheme.colors.darkInk,
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: webTheme.colors.darkInk,
    backgroundColor: "rgba(15,27,47,0.88)",
  },
  inputDisabled: {
    opacity: 0.8,
  },
  hint: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 12,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  passwordInput: {
    flex: 1,
  },
  toggleButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  toggleButtonText: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  submitButton: {
    marginTop: 4,
    backgroundColor: webTheme.colors.accent,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  submitText: {
    color: webTheme.colors.ink,
    fontWeight: "800",
    fontSize: 15,
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: 6,
  },
  linkText: {
    color: "#fcd34d",
    fontWeight: "700",
  },
  linkMutedText: {
    color: webTheme.colors.darkInkMuted,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.16)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.48)",
  },
  errorText: {
    color: "#fecaca",
    fontSize: 13,
  },
  successBox: {
    backgroundColor: "rgba(16,185,129,0.16)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.42)",
  },
  successText: {
    color: "#d1fae5",
    fontSize: 13,
  },
  debugBox: {
    backgroundColor: "rgba(245,158,11,0.16)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.42)",
    gap: 4,
  },
  debugTitle: {
    color: "#fef3c7",
    fontSize: 12,
    fontWeight: "700",
  },
  debugCode: {
    color: "#fcd34d",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 3,
  },
  doneWrap: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  successBadge: {
    borderRadius: 999,
    backgroundColor: "rgba(16,185,129,0.18)",
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.42)",
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  successBadgeText: {
    color: "#d1fae5",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  doneTitle: {
    color: webTheme.colors.darkInk,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  doneCopy: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
