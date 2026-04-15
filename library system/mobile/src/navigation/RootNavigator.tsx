import { useEffect, useRef } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { notificationsApi } from "../api/notifications";
import { useAuth } from "../auth/AuthContext";
import { BookDetailsScreen } from "../screens/BookDetailsScreen";
import { BooksScreen } from "../screens/BooksScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { DocumentsScreen } from "../screens/DocumentsScreen";
import { ForgotPasswordScreen } from "../screens/ForgotPasswordScreen";
import { LandingScreen } from "../screens/LandingScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { LoginOTPScreen } from "../screens/LoginOTPScreen";
import { MyBooksScreen } from "../screens/MyBooksScreen";
import { MyReservationsScreen } from "../screens/MyReservationsScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { LibrarianDeskScreen, StaffDeskScreen } from "../screens/OperationsDeskScreen";
import { PatronHomeScreen } from "../screens/PatronHomeScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ReadingHistoryScreen } from "../screens/ReadingHistoryScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { webTheme } from "../theme/webTheme";
import { RegisterRole } from "../types";
import { canOpenLibrarianDesk, getDefaultAppTabForUser, hasStaffDeskAccess } from "../utils/roles";
import { AppBottomTabBar } from "./AppBottomTabBar";

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
  BookDetails: { bookId: number };
  ReadingHistory: undefined;
  MyReservations: undefined;
  Notifications: undefined;
  Documents: undefined;
  StaffDesk: undefined;
  LibrarianDesk: undefined;
};

export type AuthStackParamList = {
  Landing: undefined;
  Login: undefined;
  LoginOTP: {
    otpSession: string;
    email: string;
    fullName: string;
    accountRole: RegisterRole;
    studentId?: string;
    staffId?: string;
    flow?: "login" | "registration";
    otpSentInitial?: boolean;
    autoSendOtp?: boolean;
    emailUpdated?: boolean;
  };
  Register:
    | {
        role?: RegisterRole;
      }
    | {
        recovery: "otp";
        otpSession: string;
        email: string;
        fullName: string;
        accountRole: RegisterRole;
        studentId?: string;
        staffId?: string;
        flow?: "login" | "registration";
      }
    | undefined;
  ForgotPassword: undefined;
};

export type AppTabParamList = {
  Dashboard: undefined;
  Books: undefined;
  SearchHub: undefined;
  MyBooks: undefined;
  Profile: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<AppTabParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: webTheme.colors.pageBg,
  },
};

const AuthNavigator = () => {
  return (
    <AuthStack.Navigator
      initialRouteName="Landing"
      screenOptions={{
        headerStyle: { backgroundColor: webTheme.colors.darkBg },
        headerTintColor: webTheme.colors.darkInk,
        contentStyle: { backgroundColor: webTheme.colors.darkBg },
      }}
    >
      <AuthStack.Screen
        name="Landing"
        component={LandingScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="LoginOTP"
        component={LoginOTPScreen}
        options={{ title: "Verify Email" }}
      />
      <AuthStack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ title: "Reset Password" }}
      />
    </AuthStack.Navigator>
  );
};

const AppTabsNavigator = () => {
  const { user } = useAuth();
  const homeUsesDeskDashboard = !!user && (canOpenLibrarianDesk(user) || hasStaffDeskAccess(user));

  return (
    <Tab.Navigator
      initialRouteName={getDefaultAppTabForUser(user)}
      tabBar={(props) => <AppBottomTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: webTheme.colors.darkBg },
        headerTintColor: webTheme.colors.darkInk,
        headerShadowVisible: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: "absolute",
          height: 108,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
        sceneStyle: { backgroundColor: webTheme.colors.pageBg },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={homeUsesDeskDashboard ? DashboardScreen : PatronHomeScreen}
        options={{ title: "Home" }}
      />
      <Tab.Screen
        name="Books"
        options={{ title: "Browse Books" }}
      >
        {() => <BooksScreen mode="browse" />}
      </Tab.Screen>
      <Tab.Screen
        name="SearchHub"
        options={{ title: "Search" }}
      >
        {() => <BooksScreen mode="search" />}
      </Tab.Screen>
      <Tab.Screen name="MyBooks" component={MyBooksScreen} options={{ title: "My Borrowed Books" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
};

export const RootNavigator = () => {
  const { isInitializing, isAuthenticated } = useAuth();
  const unreadCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      unreadCountRef.current = null;
      return;
    }

    let isMounted = true;
    const checkUnread = async () => {
      const result = await notificationsApi.getUnreadCount();
      if (!isMounted || result.error || !result.data) {
        return;
      }

      const nextCount = result.data.unread_count ?? 0;
      const previous = unreadCountRef.current;
      if (previous !== null && nextCount > previous) {
        Alert.alert("Library Notification", "You have new updates in your notifications inbox.");
      }
      unreadCountRef.current = nextCount;
    };

    void checkUnread();
    const timer = setInterval(() => {
      void checkUnread();
    }, 60000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [isAuthenticated]);

  if (isInitializing) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#0d2a4d" />
        <Text style={styles.loadingText}>Loading library session...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator>
        {!isAuthenticated ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} options={{ headerShown: false }} />
        ) : (
          <>
            <RootStack.Screen name="App" component={AppTabsNavigator} options={{ headerShown: false }} />
            <RootStack.Screen
              name="BookDetails"
              component={BookDetailsScreen}
              options={{
                title: "Book Details",
                headerStyle: { backgroundColor: webTheme.colors.darkBg },
                headerTintColor: webTheme.colors.darkInk,
              }}
            />
            <RootStack.Screen
              name="ReadingHistory"
              component={ReadingHistoryScreen}
              options={{
                title: "Reading History",
                headerStyle: { backgroundColor: webTheme.colors.darkBg },
                headerTintColor: webTheme.colors.darkInk,
              }}
            />
            <RootStack.Screen
              name="MyReservations"
              component={MyReservationsScreen}
              options={{
                title: "My Reservations",
                headerStyle: { backgroundColor: webTheme.colors.darkBg },
                headerTintColor: webTheme.colors.darkInk,
              }}
            />
            <RootStack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{
                title: "Notifications",
                headerStyle: { backgroundColor: webTheme.colors.darkBg },
                headerTintColor: webTheme.colors.darkInk,
              }}
            />
            <RootStack.Screen
              name="Documents"
              component={DocumentsScreen}
              options={{
                title: "Applicant Documents",
                headerStyle: { backgroundColor: webTheme.colors.darkBg },
                headerTintColor: webTheme.colors.darkInk,
              }}
            />
            <RootStack.Screen
              name="StaffDesk"
              component={StaffDeskScreen}
              options={{
                title: "Staff Desk",
                headerStyle: { backgroundColor: webTheme.colors.darkBg },
                headerTintColor: webTheme.colors.darkInk,
              }}
            />
            <RootStack.Screen
              name="LibrarianDesk"
              component={LibrarianDeskScreen}
              options={{
                title: "Librarian Desk",
                headerStyle: { backgroundColor: webTheme.colors.darkBg },
                headerTintColor: webTheme.colors.darkInk,
              }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: webTheme.colors.pageBg,
    paddingHorizontal: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: webTheme.colors.inkMuted,
  },
});
