import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { webTheme } from "../theme/webTheme";

type TabVisual = {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
};

const TAB_VISUALS: Record<string, TabVisual> = {
  Dashboard: { label: "Home", icon: "home" },
  Books: { label: "Browse Books", icon: "book-open" },
  SearchHub: { label: "Search", icon: "search" },
  MyBooks: { label: "My Borrowed", icon: "bookmark" },
  Profile: { label: "Profile", icon: "user" },
};

export const AppBottomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);

  return (
    <View pointerEvents="box-none" style={[styles.shell, { paddingBottom: bottomInset }]}>
      <View style={styles.container}>
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const focused = state.index === index;
          const visual = TAB_VISUALS[route.name] ?? {
            label: descriptor.options.title ?? route.name,
            icon: "circle",
          };

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={descriptor.options.tabBarAccessibilityLabel}
              testID={descriptor.options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [
                styles.item,
                focused && styles.itemActive,
                pressed && styles.itemPressed,
              ]}
            >
              <View style={[styles.indicator, focused && styles.indicatorActive]} />
              <Feather
                name={visual.icon}
                size={19}
                color={focused ? webTheme.colors.accent : "rgba(225,232,244,0.58)"}
                strokeWidth={1.95}
              />
              <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
                {visual.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  shell: {
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: "transparent",
  },
  container: {
    minHeight: 82,
    borderRadius: 30,
    backgroundColor: webTheme.colors.darkBg,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.16)",
    paddingHorizontal: 8,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#04101f",
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  item: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 4,
    paddingTop: 7,
    paddingBottom: 5,
  },
  itemActive: {
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  itemPressed: {
    opacity: 0.9,
  },
  indicator: {
    position: "absolute",
    top: 2,
    width: 22,
    height: 3,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  indicatorActive: {
    backgroundColor: webTheme.colors.accent,
    shadowColor: webTheme.colors.accent,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  label: {
    color: "rgba(225,232,244,0.58)",
    fontSize: 10.5,
    fontWeight: "600",
    textAlign: "center",
  },
  labelActive: {
    color: webTheme.colors.accent,
    fontWeight: "800",
    textShadowColor: "rgba(212,175,55,0.34)",
    textShadowRadius: 8,
  },
});
