import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { notificationsApi } from "../api/notifications";
import { webTheme } from "../theme/webTheme";
import { NotificationItem } from "../types";

const formatDateTime = (value?: string | null) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | "all" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const result = await notificationsApi.getNotifications(100);
    if (result.error || !result.data) {
      setError(result.error ?? "Unable to load notifications.");
      if (!isRefresh) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } else {
      setError(null);
      setNotifications(result.data.results ?? []);
      setUnreadCount(result.data.unread_count ?? 0);
    }
    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications])
  );

  const markRead = async (item: NotificationItem) => {
    if (item.is_read || busyId) return;
    setBusyId(item.id);
    const result = await notificationsApi.markRead(item.id);
    if (result.error) {
      setError(result.error);
      setBusyId(null);
      return;
    }
    const nextUnread = result.data?.unread_count ?? unreadCount;
    setUnreadCount(nextUnread);
    setNotifications((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, is_read: true, read_at: new Date().toISOString() } : row
      )
    );
    setBusyId(null);
  };

  const markAllRead = async () => {
    if (busyId) return;
    setBusyId("all");
    const result = await notificationsApi.markAllRead();
    if (result.error) {
      setError(result.error);
      setBusyId(null);
      return;
    }
    setUnreadCount(0);
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, is_read: true, read_at: item.read_at ?? new Date().toISOString() }))
    );
    setBusyId(null);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>Notifications</Text>
          <Text style={styles.subheading}>{unreadCount} unread</Text>
        </View>
        <Pressable
          style={[
            styles.markAllButton,
            (Boolean(busyId) || unreadCount === 0) && styles.markAllDisabled,
          ]}
          disabled={Boolean(busyId) || unreadCount === 0}
          onPress={() => void markAllRead()}
        >
          {busyId === "all" ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.markAllText}>Mark all read</Text>
          )}
        </Pressable>
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={webTheme.colors.accentCoolStrong} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadNotifications(true)} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No notifications yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, !item.is_read && styles.cardUnread]}
              onPress={() => void markRead(item)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.time}>{formatDateTime(item.created_at)}</Text>
              </View>
              <Text style={styles.message}>{item.message}</Text>
              {!item.is_read ? (
                <Text style={styles.unreadTag}>
                  {busyId === item.id ? "Marking..." : "Tap to mark as read"}
                </Text>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: webTheme.colors.pageBg,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: webTheme.colors.ink,
  },
  subheading: {
    marginTop: 3,
    color: webTheme.colors.inkMuted,
    fontSize: 12,
  },
  markAllButton: {
    borderRadius: 999,
    backgroundColor: webTheme.colors.accentCoolStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 118,
    alignItems: "center",
  },
  markAllDisabled: {
    opacity: 0.65,
  },
  markAllText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 22,
    gap: 8,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: webTheme.colors.line,
    backgroundColor: webTheme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  cardUnread: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  title: {
    flex: 1,
    color: webTheme.colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  time: {
    color: webTheme.colors.inkMuted,
    fontSize: 10,
  },
  message: {
    color: webTheme.colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  unreadTag: {
    color: webTheme.colors.accentCoolStrong,
    fontSize: 11,
    fontWeight: "700",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyText: {
    color: webTheme.colors.inkMuted,
  },
  errorBox: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.35)",
    backgroundColor: "rgba(244,63,94,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 12,
  },
});
