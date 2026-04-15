import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { booksApi } from "../api/books";
import { RootStackParamList } from "../navigation/RootNavigator";
import { webTheme } from "../theme/webTheme";
import { Reservation } from "../types";

type FilterKey = "ACTIVE" | "ALL";

const STATUS_LABEL: Record<Reservation["status"], string> = {
  PENDING: "Pending",
  NOTIFIED: "Available for Pickup",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const formatDate = (value?: string | null): string => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const MyReservationsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("ACTIVE");
  const [cancelBusyId, setCancelBusyId] = useState<number | null>(null);

  const loadReservations = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const result = await booksApi.getReservations();
    if (result.error || !result.data) {
      setError(result.error ?? "Unable to load reservations.");
      if (!isRefresh) setReservations([]);
    } else {
      setError(null);
      setReservations(result.data);
    }

    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadReservations();
    }, [loadReservations])
  );

  const visibleReservations = useMemo(() => {
    if (filter === "ALL") return reservations;
    return reservations.filter((item) =>
      item.status === "PENDING" || item.status === "NOTIFIED"
    );
  }, [reservations, filter]);

  const onCancelReservation = async (reservation: Reservation) => {
    if (cancelBusyId) return;
    setCancelBusyId(reservation.id);
    const result = await booksApi.cancelReservation(reservation.id);
    if (result.error) {
      setError(result.error);
      setCancelBusyId(null);
      return;
    }
    const updated = result.data?.reservation;
    setReservations((prev) =>
      prev.map((item) =>
        item.id === reservation.id ? updated ?? { ...item, status: "CANCELLED" } : item
      )
    );
    setCancelBusyId(null);
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>My Reservations</Text>
      <Text style={styles.subheading}>Track queue status and cancel when needed.</Text>

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, filter === "ACTIVE" && styles.filterChipActive]}
          onPress={() => setFilter("ACTIVE")}
        >
          <Text style={[styles.filterText, filter === "ACTIVE" && styles.filterTextActive]}>
            Active
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterChip, filter === "ALL" && styles.filterChipActive]}
          onPress={() => setFilter("ALL")}
        >
          <Text style={[styles.filterText, filter === "ALL" && styles.filterTextActive]}>All</Text>
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
          data={visibleReservations}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadReservations(true)} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No reservations for this view.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const canCancel = item.status === "PENDING" || item.status === "NOTIFIED";
            const position = item.current_position ?? item.position;
            return (
              <Pressable
                style={styles.card}
                onPress={() => navigation.navigate("BookDetails", { bookId: item.book.id })}
              >
                <View style={styles.topRow}>
                  <Text style={styles.title} numberOfLines={2}>
                    {item.book.title}
                  </Text>
                  <Text style={styles.status}>{STATUS_LABEL[item.status]}</Text>
                </View>
                <Text style={styles.meta}>{item.book.author}</Text>
                <Text style={styles.meta}>Reserved: {formatDate(item.created_at)}</Text>
                {item.status === "PENDING" ? (
                  <Text style={styles.meta}>Queue position: {position}</Text>
                ) : null}
                {item.expires_at ? (
                  <Text style={styles.warning}>Pickup before: {formatDate(item.expires_at)}</Text>
                ) : null}
                {canCancel ? (
                  <Pressable
                    style={[styles.cancelButton, cancelBusyId === item.id && styles.cancelButtonDisabled]}
                    disabled={cancelBusyId === item.id}
                    onPress={(event) => {
                      event.stopPropagation();
                      void onCancelReservation(item);
                    }}
                  >
                    {cancelBusyId === item.id ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.cancelText}>Cancel Reservation</Text>
                    )}
                  </Pressable>
                ) : null}
              </Pressable>
            );
          }}
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
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: webTheme.colors.ink,
  },
  subheading: {
    marginTop: 4,
    fontSize: 13,
    color: webTheme.colors.inkMuted,
  },
  filterRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: webTheme.colors.line,
    backgroundColor: webTheme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipActive: {
    borderColor: webTheme.colors.accentCoolStrong,
    backgroundColor: webTheme.colors.accentCoolStrong,
  },
  filterText: {
    color: webTheme.colors.inkMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#ffffff",
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
    gap: 3,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    flex: 1,
    color: webTheme.colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  status: {
    color: webTheme.colors.accentCoolStrong,
    fontSize: 11,
    fontWeight: "700",
  },
  meta: {
    color: webTheme.colors.inkMuted,
    fontSize: 12,
  },
  warning: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: "700",
  },
  cancelButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  cancelButtonDisabled: {
    opacity: 0.7,
  },
  cancelText: {
    color: "#ffffff",
    fontSize: 12,
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
