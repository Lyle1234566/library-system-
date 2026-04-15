import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { webTheme } from "../theme/webTheme";

export type QuickLink =
  | "Home"
  | "Browse Books"
  | "Features"
  | "About Us"
  | "Contact Us";

type NavbarProps = {
  isTablet: boolean;
  onSignIn: () => void;
  onGetStarted: () => void;
  onNavigate: (link: QuickLink) => void;
};

const quickLinks: QuickLink[] = ["Home", "Browse Books", "Features", "About Us", "Contact Us"];

export const Navbar = ({ isTablet, onSignIn, onGetStarted, onNavigate }: NavbarProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleNavigate = (link: QuickLink) => {
    onNavigate(link);
    setIsMenuOpen(false);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.topBar}>
        <View style={styles.brandWrap}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>SL</Text>
          </View>
          <Text style={styles.brandText} numberOfLines={1} ellipsizeMode="tail">
            Salazar Library System
          </Text>
        </View>

        {isTablet && (
          <View style={styles.quickLinksWrap}>
            {quickLinks.map((item) => (
              <Pressable key={item} onPress={() => handleNavigate(item)}>
                <Text style={styles.quickLink}>{item}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.authWrap}>
          {isTablet && (
            <Pressable style={styles.signInChip} onPress={onSignIn}>
              <Text style={styles.signInText}>Sign In</Text>
            </Pressable>
          )}
          <Pressable style={styles.getStartedChip} onPress={onGetStarted}>
            <Text style={styles.getStartedText}>Get Started</Text>
          </Pressable>
          {!isTablet && (
            <Pressable style={styles.menuChip} onPress={() => setIsMenuOpen((prev) => !prev)}>
              <Text style={styles.menuChipText}>Menu</Text>
            </Pressable>
          )}
        </View>
      </View>

      {!isTablet && isMenuOpen && (
        <View style={styles.menuPanel}>
          {quickLinks.map((item) => (
            <Pressable key={item} style={styles.menuItem} onPress={() => handleNavigate(item)}>
              <Text style={styles.menuItemText}>{item}</Text>
            </Pressable>
          ))}
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              onSignIn();
              setIsMenuOpen(false);
            }}
          >
            <Text style={styles.menuItemText}>Sign In</Text>
          </Pressable>
          <Pressable
            style={[styles.menuItem, styles.menuItemAccent]}
            onPress={() => {
              onGetStarted();
              setIsMenuOpen(false);
            }}
          >
            <Text style={styles.menuItemAccentText}>Get Started</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 20,
    position: "relative",
  },
  topBar: {
    height: 64,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(7,16,36,0.76)",
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.48)",
    backgroundColor: "rgba(30,58,138,0.44)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#dbeafe",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  brandText: {
    color: webTheme.colors.darkInk,
    fontSize: 15,
    fontWeight: "800",
    flexShrink: 1,
  },
  quickLinksWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  quickLink: {
    color: "rgba(232,241,255,0.78)",
    fontSize: 13,
    fontWeight: "500",
  },
  authWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  signInChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  signInText: {
    color: "rgba(232,241,255,0.9)",
    fontWeight: "700",
    fontSize: 12,
  },
  getStartedChip: {
    borderRadius: 999,
    backgroundColor: "#ffb400",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  getStartedText: {
    color: "#101828",
    fontWeight: "800",
    fontSize: 12,
  },
  menuChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  menuChipText: {
    color: webTheme.colors.darkInk,
    fontSize: 12,
    fontWeight: "700",
  },
  menuPanel: {
    position: "absolute",
    top: 64,
    right: 10,
    minWidth: 190,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(12,24,51,0.96)",
    padding: 8,
    gap: 4,
  },
  menuItem: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  menuItemText: {
    color: webTheme.colors.darkInk,
    fontSize: 13,
    fontWeight: "600",
  },
  menuItemAccent: {
    backgroundColor: webTheme.colors.accent,
  },
  menuItemAccentText: {
    color: webTheme.colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
});
