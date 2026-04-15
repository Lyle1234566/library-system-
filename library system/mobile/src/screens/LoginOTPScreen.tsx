import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { AuthStackParamList } from "../navigation/RootNavigator";
import { webTheme } from "../theme/webTheme";

type Props = NativeStackScreenProps<AuthStackParamList, "LoginOTP">;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};

export const LoginOTPScreen = ({ navigation, route }: Props) => {
  const { setSession } = useAuth();
  const {
    otpSession,
    email,
    fullName,
    accountRole,
    studentId,
    staffId,
    flow = "login",
    otpSentInitial = false,
    autoSendOtp = false,
    emailUpdated = false,
  } = route.params;

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    emailUpdated
      ? "Your email was updated. We can send a fresh OTP to the new address now."
      : flow === "registration"
        ? otpSentInitial
          ? "Your account was created and the OTP was already sent. Verify the email first, then wait for approval."
          : "Verify the email first. After that, the account will wait for staff approval."
        : "We will verify the email before completing sign in."
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [otpSent, setOtpSent] = useState(otpSentInitial);
  const hasAutoSent = useRef(false);

  const recoveryParams = useMemo(
    () => ({
      recovery: "otp" as const,
      otpSession,
      email,
      fullName,
      accountRole,
      studentId,
      staffId,
      flow,
    }),
    [accountRole, email, flow, fullName, otpSession, staffId, studentId]
  );

  const handleSendOTP = useCallback(async () => {
    setIsSendingOTP(true);
    setError("");

    try {
      const result = await authApi.sendLoginOtp(otpSession);
      if (result.error || !result.data) {
        setError(result.error ?? "Failed to send OTP. Please try again.");
        return;
      }

      setOtpSent(true);
      setNotice(`OTP sent to ${result.data.email ?? email}. Check the inbox and spam folder.`);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to send OTP. Please try again."));
    } finally {
      setIsSendingOTP(false);
    }
  }, [email, otpSession]);

  useEffect(() => {
    if (!autoSendOtp || hasAutoSent.current) {
      return;
    }

    hasAutoSent.current = true;
    void handleSendOTP();
  }, [autoSendOtp, handleSendOTP]);

  const handleVerifyOTP = async () => {
    if (!code.trim()) {
      setError("Please enter the OTP code.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const result = await authApi.verifyLoginOtp(otpSession, code.trim());
      if (result.error || !result.data) {
        setError(result.error ?? "Invalid OTP code. Please try again.");
        return;
      }

      if (result.data.requiresApproval) {
        Alert.alert(
          "Email verified",
          result.data.message ?? "Email verified. Wait for account approval before signing in.",
          [
            {
              text: "OK",
              onPress: () => navigation.navigate("Login"),
            },
          ]
        );
        return;
      }

      if (!result.data.user || !result.data.tokens) {
        setError("Invalid OTP code. Please try again.");
        return;
      }

      await setSession(result.data.user, result.data.tokens.access, result.data.tokens.refresh);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Invalid OTP code. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToRegistrationRecovery = () => {
    navigation.push("Register", recoveryParams);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.glowSky} />
      <View style={styles.glowAmber} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>Back to Login</Text>
        </Pressable>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Email Verification</Text>
          <Text style={styles.formSubtitle}>
            {flow === "registration"
              ? "Verify the email address first. After verification, the account will remain pending until staff approval."
              : "Before this account can sign in, we need to confirm that the email address really belongs to the student or teacher who registered it."}
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              OTP will be sent to: <Text style={styles.infoEmail}>{email}</Text>
            </Text>
          </View>

          {!!notice && (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          )}

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!otpSent ? (
            <View style={styles.buttonGroup}>
              <Pressable
                style={[styles.submitButton, isSendingOTP && styles.buttonDisabled]}
                onPress={handleSendOTP}
                disabled={isSendingOTP}
              >
                {isSendingOTP ? (
                  <ActivityIndicator color={webTheme.colors.ink} />
                ) : (
                  <Text style={styles.submitText}>Send OTP to Email</Text>
                )}
              </Pressable>

              <Pressable onPress={goToRegistrationRecovery} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Back to Registration Details</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Enter OTP Code</Text>
              <View style={styles.inputShell}>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={webTheme.colors.darkInkMuted}
                />
              </View>

              <Pressable
                style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleVerifyOTP}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={webTheme.colors.ink} />
                ) : (
                  <Text style={styles.submitText}>
                    {flow === "registration" ? "Verify Email" : "Verify and Login"}
                  </Text>
                )}
              </Pressable>

              <View style={styles.linkRow}>
                <Pressable onPress={handleSendOTP} disabled={isSendingOTP}>
                  <Text style={styles.linkText}>Resend OTP</Text>
                </Pressable>
                <Pressable onPress={goToRegistrationRecovery}>
                  <Text style={styles.linkText}>Back to Registration Details</Text>
                </Pressable>
              </View>
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
    width: 280,
    height: 280,
    borderRadius: 220,
    backgroundColor: "rgba(56,189,248,0.18)",
    top: -80,
    left: -90,
  },
  glowAmber: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 240,
    backgroundColor: "rgba(251,191,36,0.14)",
    bottom: -120,
    right: -120,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 30,
    gap: 14,
  },
  backButton: {
    paddingVertical: 8,
  },
  backText: {
    color: "rgba(232,241,255,0.7)",
    fontSize: 14,
    fontWeight: "700",
  },
  formCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: webTheme.colors.darkInk,
  },
  formSubtitle: {
    color: webTheme.colors.darkInkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: "rgba(56,189,248,0.16)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.3)",
  },
  infoText: {
    color: "#bae6fd",
    fontSize: 13,
    lineHeight: 18,
  },
  infoEmail: {
    fontWeight: "800",
  },
  noticeBox: {
    backgroundColor: "rgba(16,185,129,0.16)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.32)",
  },
  noticeText: {
    color: "#d1fae5",
    fontSize: 13,
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.16)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.48)",
  },
  errorText: {
    color: "#fecaca",
    fontSize: 13,
    lineHeight: 18,
  },
  buttonGroup: {
    gap: 10,
  },
  fieldWrap: {
    gap: 10,
  },
  label: {
    color: "rgba(232,241,255,0.8)",
    fontSize: 13,
    fontWeight: "700",
  },
  inputShell: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: webTheme.colors.darkInk,
    fontSize: 15,
  },
  submitButton: {
    borderRadius: 18,
    backgroundColor: webTheme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
  },
  submitText: {
    color: webTheme.colors.ink,
    fontWeight: "800",
    fontSize: 15,
  },
  secondaryButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
  },
  secondaryButtonText: {
    color: webTheme.colors.darkInk,
    fontSize: 14,
    fontWeight: "700",
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
    paddingTop: 4,
  },
  linkText: {
    color: "#fcd34d",
    fontSize: 13,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
