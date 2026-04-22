'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  authApi,
  AuthTokens,
  LoginCredentials,
  LoginOtpChallenge,
  RegisterData,
  User,
  tokenStorage,
} from '@/lib/auth';
import { useToast } from '@/components/ToastProvider';

type LoginActionResult = {
  success: boolean;
  error: string | null;
  data?: LoginOtpChallenge | null;
};

type RegisterActionResult = {
  success: boolean;
  error: string | null;
  data?: LoginOtpChallenge | null;
  message?: string | null;
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginActionResult>;
  register: (data: RegisterData) => Promise<RegisterActionResult>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setSession: (user: User, access: string, refresh: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      if (authApi.isAuthenticated()) {
        const response = await authApi.getProfile();
        if (response.user) {
          setCurrentUser(response.user);
        } else {
          setCurrentUser(null);
          await authApi.logout({ skipServer: true });
        }
      }
      setIsLoading(false);
    };

    void checkAuth();
  }, []);

  const setSession = useCallback(async (nextUser: User, access: string, refresh: string) => {
    tokenStorage.setTokens({ access, refresh } as AuthTokens);
    setCurrentUser(nextUser);
    setIsLoading(false);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<LoginActionResult> => {
    setIsLoading(true);
    try {
      const response = await authApi.login(credentials);

      if (response.error) {
        setIsLoading(false);
        return { success: false, error: response.error, data: null };
      }

      if (response.otpChallenge) {
        setCurrentUser(null);
        setIsLoading(false);
        return { success: false, error: null, data: response.otpChallenge };
      }

      const profileResponse = await authApi.getProfile();
      if (profileResponse.user) {
        setCurrentUser(profileResponse.user);
      } else if (response.user) {
        setCurrentUser(response.user);
      }

      setIsLoading(false);
      showToast('Signed in successfully.');
      return { success: true, error: null, data: null };
    } catch (error) {
      setIsLoading(false);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
        data: null,
      };
    }
  }, [showToast]);

  const register = useCallback(async (data: RegisterData): Promise<RegisterActionResult> => {
    setIsLoading(true);
    try {
      const response = await authApi.register(data);

      if (response.error) {
        setIsLoading(false);
        return { success: false, error: response.error };
      }

      if (response.otpChallenge) {
        setCurrentUser(null);
        setIsLoading(false);
        return {
          success: true,
          error: null,
          data: response.otpChallenge,
          message: response.message ?? null,
        };
      }

      if (response.tokens) {
        const profileResponse = await authApi.getProfile();
        if (profileResponse.user) {
          setCurrentUser(profileResponse.user);
        } else if (response.user) {
          setCurrentUser(response.user);
        }
      }

      setIsLoading(false);
      return { success: true, error: null, data: null, message: response.message ?? null };
    } catch (error) {
      setIsLoading(false);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
        data: null,
        message: null,
      };
    }
  }, []);

  const logout = useCallback(() => {
    void authApi.logout();
    setCurrentUser(null);
    showToast('Logged out successfully.');
  }, [showToast]);

  const refreshUser = useCallback(async () => {
    if (authApi.isAuthenticated()) {
      const response = await authApi.getProfile();
      if (response.user) {
        setCurrentUser(response.user);
      }
    }
  }, []);

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
    setSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
