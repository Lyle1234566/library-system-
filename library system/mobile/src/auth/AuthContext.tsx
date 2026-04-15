import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authApi } from "../api/auth";
import { tokenStorage } from "../lib/tokenStorage";
import { AuthTokens, LoginCredentials, LoginOtpChallenge, RegisterPayload, User } from "../types";

type AuthActionResult = {
  success: boolean;
  error: string | null;
  data?: LoginOtpChallenge | null;
  requiresApproval?: boolean;
  message?: string;
};

type AuthContextValue = {
  user: User | null;
  isInitializing: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthActionResult>;
  register: (payload: RegisterPayload) => Promise<AuthActionResult>;
  setSession: (user: User, access: string, refresh: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const bootstrap = useCallback(async () => {
    setIsInitializing(true);
    try {
      const authenticated = await authApi.isAuthenticated();
      if (!authenticated) {
        setUser(null);
        return;
      }

      const profile = await authApi.getProfile();
      if (profile.error || !profile.data) {
        await authApi.logout();
        setUser(null);
        return;
      }

      setUser(profile.data);
    } catch {
      setUser(null);
      await authApi.logout().catch(() => undefined);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const setSession = useCallback(async (nextUser: User, access: string, refresh: string) => {
    const tokens: AuthTokens = { access, refresh };
    await tokenStorage.setTokens(tokens);
    setUser(nextUser);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthActionResult> => {
    setIsLoading(true);
    try {
      const result = await authApi.login(credentials);
      if (result.error || !result.data) {
        return { success: false, error: result.error ?? "Login failed.", data: null };
      }

      if (result.data.otpChallenge) {
        setUser(null);
        return {
          success: false,
          error: null,
          data: result.data.otpChallenge,
          message: result.data.message,
        };
      }

      if (result.data.user) {
        setUser(result.data.user);
        return { success: true, error: null, data: null, message: result.data.message };
      }

      const profile = await authApi.getProfile();
      if (profile.error || !profile.data) {
        return {
          success: false,
          error: profile.error ?? "Unable to load your profile.",
          data: null,
        };
      }

      setUser(profile.data);
      return { success: true, error: null, data: null, message: result.data.message };
    } catch (error) {
      setUser(null);
      return {
        success: false,
        error: getErrorMessage(
          error,
          "Unable to sign in right now. Check your connection and backend server."
        ),
        data: null,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload): Promise<AuthActionResult> => {
    setIsLoading(true);
    try {
      const result = await authApi.register(payload);
      if (result.error || !result.data) {
        return { success: false, error: result.error ?? "Registration failed." };
      }

      if (result.data.otpChallenge) {
        setUser(null);
        return {
          success: true,
          error: null,
          data: result.data.otpChallenge,
          requiresApproval: false,
          message: result.data.message,
        };
      }

      if (result.data.requiresApproval) {
        setUser(null);
        return {
          success: true,
          error: null,
          data: null,
          requiresApproval: true,
          message: result.data.message,
        };
      }

      const profile = await authApi.getProfile();
      if (profile.error || !profile.data) {
        setUser(result.data.user);
      } else {
        setUser(profile.data);
      }

      return {
        success: true,
        error: null,
        data: null,
        requiresApproval: false,
        message: result.data.message,
      };
    } catch (error) {
      setUser(null);
      return {
        success: false,
        error: getErrorMessage(
          error,
          "Unable to register right now. Check your connection and backend server."
        ),
        data: null,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const result = await authApi.getProfile();
      if (result.data) {
        setUser(result.data);
      }
    } catch {
      // Keep current user state when refresh fails.
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isInitializing,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      register,
      setSession,
      refreshProfile,
      logout,
    }),
    [isInitializing, isLoading, login, logout, refreshProfile, register, setSession, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
