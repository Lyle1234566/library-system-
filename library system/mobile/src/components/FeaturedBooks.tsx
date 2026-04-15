import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { booksApi } from "../api/books";
import { Book } from "../types";
import { webTheme } from "../theme/webTheme";
import { BookCard } from "./BookCard";

type FeaturedBooksProps = {
  onSelect?: () => void;
  onViewAll?: () => void;
};

export const FeaturedBooks = ({ onSelect, onViewAll }: FeaturedBooksProps) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadBooks = async () => {
      setLoading(true);
      const result = await booksApi.getPublicBooks();

      if (!active) {
        return;
      }

      if (result.error || !result.data) {
        setBooks([]);
        setError(result.error ?? "Unable to load live catalog.");
        setLoading(false);
        return;
      }

      setBooks(result.data.slice(0, 4));
      setError(null);
      setLoading(false);
    };

    void loadBooks();

    return () => {
      active = false;
    };
  }, []);

  const getMeta = (book: Book) => {
    if (book.available && (book.copies_available ?? 0) > 0) {
      const count = book.copies_available ?? 0;
      return `${count} cop${count === 1 ? "y" : "ies"} available`;
    }
    return "Currently unavailable";
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Featured Books</Text>
      <Text style={styles.subtitle}>Popular picks synced with your web catalog.</Text>

      {loading ? (
        <View style={styles.statusCard}>
          <ActivityIndicator color={webTheme.colors.accentCoolStrong} />
          <Text style={styles.statusText}>Loading live catalog from backend...</Text>
        </View>
      ) : null}

      {error && !loading ? (
        <View style={styles.statusCardError}>
          <Text style={styles.statusTitle}>Live catalog unavailable</Text>
          <Text style={styles.statusText}>{error}</Text>
        </View>
      ) : null}

      {!loading && !error && books.length === 0 ? (
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>No books available</Text>
          <Text style={styles.statusText}>
            The backend responded, but there are no catalog books to show yet.
          </Text>
        </View>
      ) : null}

      {!loading && !error && books.length > 0 ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
          >
            {books.map((book) => (
              <BookCard
                key={book.id}
                title={book.title}
                author={book.author}
                meta={getMeta(book)}
                coverImage={book.cover_image}
                onPress={onSelect}
              />
            ))}
          </ScrollView>

          {onViewAll ? (
            <View style={styles.actionWrap}>
              <Text style={styles.actionHint}>
                Browse the complete catalog and continue with your account.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                onPress={onViewAll}
              >
                <Text style={styles.actionButtonText}>View All Books</Text>
                <Text style={styles.actionButtonArrow}>{">"}</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
    gap: 5,
  },
  title: {
    color: webTheme.colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: webTheme.colors.inkMuted,
    fontSize: 12,
  },
  row: {
    gap: 8,
    paddingTop: 6,
    paddingBottom: 2,
  },
  statusCard: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.10)",
    backgroundColor: webTheme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
    alignItems: "center",
  },
  statusCardError: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.22)",
    backgroundColor: "rgba(212,175,55,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  statusTitle: {
    color: webTheme.colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  statusText: {
    color: webTheme.colors.inkMuted,
    fontSize: 12,
    textAlign: "center",
  },
  actionWrap: {
    marginTop: 14,
    alignItems: "center",
    gap: 10,
  },
  actionHint: {
    color: webTheme.colors.inkMuted,
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 6,
  },
  actionButton: {
    minWidth: 188,
    borderRadius: 999,
    backgroundColor: webTheme.colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  actionButtonPressed: {
    opacity: 0.88,
    transform: [{ translateY: 1 }],
  },
  actionButtonText: {
    color: webTheme.colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  actionButtonArrow: {
    color: webTheme.colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
});
