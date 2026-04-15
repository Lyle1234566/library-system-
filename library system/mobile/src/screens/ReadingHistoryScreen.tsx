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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { booksApi } from "../api/books";
import { RootStackParamList } from "../navigation/RootNavigator";
import { webTheme } from "../theme/webTheme";
import { BorrowRequest } from "../types";

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

export const ReadingHistoryScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [history, setHistory] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const result = await booksApi.getHistory();
    if (result.error || !result.data) {
      setError(result.error ?? "Unable to load reading history.");
      if (!isRefresh) setHistory([]);
    } else {
      setError(null);
      setHistory(result.data);
    }

    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Reading History</Text>
      <Text style={styles.subheading}>All books you borrowed and returned.</Text>

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
          data={history}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadHistory(true)} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No returned books yet.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const lateFee = Number.parseFloat(item.late_fee_amount ?? "0");
            const hasLateFee = Number.isFinite(lateFee) && lateFee > 0;
            return (
              <Pressable
                style={styles.card}
                onPress={() => navigation.navigate("BookDetails", { bookId: item.book.id })}
              >
                <Text style={styles.title} numberOfLines={2}>
                  {item.book.title}
                </Text>
                <Text style={styles.author}>{item.book.author}</Text>
                <Text style={styles.meta}>Borrowed: {formatDate(item.processed_at)}</Text>
                <Text style={styles.meta}>
                  Returned: {formatDate(item.returned_at ?? item.due_date)}
                </Text>
                {item.renewal_count ? (
                  <Text style={styles.meta}>Renewals: {item.renewal_count}</Text>
                ) : null}
                {hasLateFee ? (
                  <Text style={styles.warning}>Late fee: ₱{lateFee.toFixed(2)}</Text>
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
  title: {
    color: webTheme.colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  author: {
    color: webTheme.colors.inkMuted,
    fontSize: 12,
    marginBottom: 2,
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
