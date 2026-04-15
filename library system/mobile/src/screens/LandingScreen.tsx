import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AboutSection,
  CallToAction,
  ContactSection,
  FeaturedBooks,
  Features,
  Footer,
  HeroSection,
  Navbar,
  type QuickLink,
} from "../components";
import { AuthStackParamList } from "../navigation/RootNavigator";
import { webTheme } from "../theme/webTheme";

type Props = NativeStackScreenProps<AuthStackParamList, "Landing">;

type SectionMap = {
  features: number;
};

export const LandingScreen = ({ navigation }: Props) => {
  const [query, setQuery] = useState("");
  const [activeInfoSection, setActiveInfoSection] = useState<"none" | "about" | "contact">("none");
  const [sectionY, setSectionY] = useState<SectionMap>({
    features: 0,
  });
  const scrollRef = useRef<ScrollView | null>(null);
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const isTablet = width >= 740;

  const getSectionY = (section: keyof SectionMap) => {
    if (sectionY[section] > 0) {
      return sectionY[section];
    }

    const fallback = isWide ? { features: 980 } : { features: 1320 };
    return fallback[section];
  };

  const handleSectionLayout = (section: keyof SectionMap) => (event: LayoutChangeEvent) => {
    const nextY = event.nativeEvent.layout.y;
    setSectionY((prev) => {
      if (Math.abs(prev[section] - nextY) < 1) return prev;
      return { ...prev, [section]: nextY };
    });
  };

  const handleNavigate = (link: QuickLink) => {
    if (link === "Home") {
      setActiveInfoSection("none");
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (link === "Browse Books") {
      navigation.navigate("Login");
      return;
    }
    if (link === "Features") {
      setActiveInfoSection("none");
      scrollRef.current?.scrollTo({ y: getSectionY("features"), animated: true });
      return;
    }
    if (link === "About Us") {
      setActiveInfoSection("about");
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
      return;
    }
    setActiveInfoSection("contact");
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.bgBlue} />
      <View style={styles.bgAmber} />
      <View style={styles.bgCenter} />

      <Navbar
        isTablet={isTablet}
        onSignIn={() => navigation.navigate("Login")}
        onGetStarted={() => navigation.navigate("Register")}
        onNavigate={handleNavigate}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <HeroSection
          isWide={isWide}
          isTablet={isTablet}
          query={query}
          onChangeQuery={setQuery}
          onSearch={() => navigation.navigate("Login")}
          onBrowse={() => navigation.navigate("Login")}
          onCreate={() => navigation.navigate("Register")}
        />
        <FeaturedBooks
          onSelect={() => navigation.navigate("Login")}
          onViewAll={() => navigation.navigate("Login")}
        />

        <View onLayout={handleSectionLayout("features")}>
          <Features />
        </View>

        {activeInfoSection === "about" && (
          <View>
            <AboutSection />
          </View>
        )}

        {activeInfoSection === "contact" && (
          <View>
            <ContactSection />
          </View>
        )}

        <CallToAction
          onSignIn={() => navigation.navigate("Login")}
          onRegister={() => navigation.navigate("Register")}
        />
        <Footer />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: webTheme.colors.darkBg,
  },
  bgBlue: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 280,
    backgroundColor: "rgba(14,165,233,0.14)",
    left: -180,
    top: 80,
  },
  bgAmber: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 280,
    backgroundColor: "rgba(245,158,11,0.14)",
    right: -190,
    bottom: -170,
  },
  bgCenter: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: 320,
    backgroundColor: "rgba(2,132,199,0.08)",
    left: "20%",
    top: "18%",
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    paddingBottom: 28,
  },
});
