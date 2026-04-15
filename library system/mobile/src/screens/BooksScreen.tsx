import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { booksApi, type BookFilters } from "../api/books";
import { useAuth } from "../auth/AuthContext";
import { resolveMediaUrl } from "../config/api";
import { RootStackParamList } from "../navigation/RootNavigator";
import { webTheme } from "../theme/webTheme";
import { Book, Category } from "../types";
import { canBorrowAsPatron } from "../utils/roles";

type BooksScreenProps = {
  mode?: "browse" | "search";
};

const getCategoryLabel = (book: Book) => {
  const names = (book.categories ?? []).map((category) => category.name).filter(Boolean);
  if (names.length === 0) {
    return book.genre || "Uncategorized";
  }
  return `${names[0]}${names.length > 1 ? ` +${names.length - 1}` : ""}`;
};

export const BooksScreen = ({ mode = "browse" }: BooksScreenProps) => {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isSearchMode = mode === "search";
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busyBookId, setBusyBookId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(isSearchMode);
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "unavailable">("all");
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [authorFilter, setAuthorFilter] = useState("");
  const [gradeLevelFilter, setGradeLevelFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");

  const getServerFilters = useCallback(
    (filters?: BookFilters): BookFilters => {
      if (filters) {
        return filters;
      }

      return {
        available:
          availabilityFilter === "all"
            ? undefined
            : availabilityFilter === "available",
        category: categoryFilter ?? undefined,
        author: authorFilter.trim() || undefined,
        grade_level: gradeLevelFilter.trim() || undefined,
        language: languageFilter.trim() || undefined,
      };
    },
    [availabilityFilter, authorFilter, categoryFilter, gradeLevelFilter, languageFilter]
  );

  const loadBooks = useCallback(
    async (isRefresh = false, filters?: BookFilters) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const result = await booksApi.getBooks(getServerFilters(filters));
      if (result.error || !result.data) {
        setError(result.error ?? "Unable to load books.");
        if (!isRefresh) {
          setBooks([]);
        }
      } else {
        setError(null);
        setBooks(result.data);
      }

      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    },
    [getServerFilters]
  );

  useFocusEffect(
    useCallback(() => {
      void loadBooks();
    }, [loadBooks])
  );

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const loadCategories = async () => {
        const result = await booksApi.getCategories();
        if (!mounted) return;
        if (!result.error && result.data) {
          setCategories(result.data);
        }
      };
      void loadCategories();
      return () => {
        mounted = false;
      };
    }, [])
  );

  const filteredBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return books;

    return books.filter((book) => {
      const categoriesText = (book.categories ?? []).map((cat) => cat.name).join(" ");
      return [book.title, book.author, book.genre, book.isbn, categoriesText]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [books, query]);

  const availableCount = useMemo(() => books.filter((book) => book.available).length, [books]);
  const selectedCategoryName = useMemo(
    () => categories.find((category) => category.id === categoryFilter)?.name ?? null,
    [categories, categoryFilter]
  );

  const onBorrow = async (bookId: number) => {
    const canUseBorrowFlow = canBorrowAsPatron(user);
    const isTeacher = user?.role === "TEACHER";
    const isStudentBorrower = canUseBorrowFlow && !isTeacher;

    if (isStudentBorrower) {
      navigation.navigate("BookDetails", { bookId });
      return;
    }

    if (busyBookId) return;
    setBusyBookId(bookId);
    setError(null);

    const result = await booksApi.requestBorrow(
      bookId,
      user?.role === "TEACHER" ? { reportingFrequency: "MONTHLY" } : undefined
    );

    if (result.error) {
      if (result.error.toLowerCase().includes("unpaid fines")) {
        setError(`${result.error} Open Profile > Fines & Borrow Status to resolve.`);
      } else {
        setError(result.error);
      }
      setBusyBookId(null);
      return;
    }

    const updatedBook = result.data?.book;
    setBooks((prev) =>
      prev.map((book) =>
        book.id === bookId
          ? updatedBook ?? { ...book, has_pending_borrow_request: true }
          : book
      )
    );
    setBusyBookId(null);
  };

  const renderItem = ({ item }: { item: Book }) => {
    const imageUrl = resolveMediaUrl(item.cover_image);
    const canUseBorrowFlow = canBorrowAsPatron(user);
    const isTeacher = user?.role === "TEACHER";
    const isStudentBorrower = canUseBorrowFlow && !isTeacher;
    const canBorrow =
      item.available &&
      !item.is_borrowed_by_user &&
      !item.has_pending_borrow_request &&
      canUseBorrowFlow;
    const isBusy = busyBookId === item.id;
    const categoryLabel = getCategoryLabel(item);

    let actionLabel = "Borrow Book";
    if (isBusy) actionLabel = "Requesting...";
    else if (canBorrow && isStudentBorrower) actionLabel = "Open Borrow Form";
    else if (!canUseBorrowFlow) actionLabel = "Students/Teachers Only";
    else if (item.is_borrowed_by_user) actionLabel = "Borrowed";
    else if (item.has_pending_borrow_request) actionLabel = "Request Pending";
    else if (!item.available) actionLabel = "Not Available";

    return (
      <Pressable
        style={styles.bookCard}
        onPress={() => navigation.navigate("BookDetails", { bookId: item.id })}
      >
        <View style={styles.bookCoverPanel}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.bookCoverImage} resizeMode="cover" />
          ) : (
            <View style={styles.bookCoverPlaceholder}>
              <Text style={styles.bookCoverPlaceholderText}>No Cover</Text>
            </View>
          )}

          <View style={styles.bookCardTopRow}>
            <View style={styles.bookCategoryChip}>
              <Text style={styles.bookCategoryText} numberOfLines={1}>
                {categoryLabel.toUpperCase()}
              </Text>
            </View>
            <View
              style={[
                styles.bookAvailabilityChip,
                item.available ? styles.bookAvailabilityChipAvailable : styles.bookAvailabilityChipBorrowed,
              ]}
            >
              <Text
                style={[
                  styles.bookAvailabilityText,
                  item.available ? styles.bookAvailabilityTextAvailable : styles.bookAvailabilityTextBorrowed,
                ]}
              >
                {item.available ? "Available" : "Borrowed"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bookBody}>
          <Text style={styles.bookTitle}>{item.title}</Text>
          <Text style={styles.bookAuthor}>{item.author}</Text>

          <View style={styles.bookMetaWrap}>
            <Text style={styles.bookMetaText}>
              Copies: {item.copies_available}/{item.copies_total ?? item.copies_available}
            </Text>
            <Text style={styles.bookMetaText}>ISBN: {item.isbn || "N/A"}</Text>
          </View>

          <Pressable
            style={[styles.bookActionButton, (!canBorrow || isBusy) && styles.bookActionButtonDisabled]}
            disabled={!canBorrow || isBusy}
            onPress={(event) => {
              event.stopPropagation();
              void onBorrow(item.id);
            }}
          >
            {isBusy ? (
              <ActivityIndicator color={webTheme.colors.ink} />
            ) : (
              <Text
                style={[
                  styles.bookActionText,
                  (!canBorrow || isBusy) && styles.bookActionTextDisabled,
                ]}
              >
                {actionLabel}
              </Text>
            )}
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const resultCount = filteredBooks.length;
  const resultLabel = `${resultCount} result${resultCount === 1 ? "" : "s"}`;
  const hasActiveServerFilters =
    availabilityFilter !== "all" ||
    categoryFilter !== null ||
    authorFilter.trim().length > 0 ||
    gradeLevelFilter.trim().length > 0 ||
    languageFilter.trim().length > 0;
  const heroEyebrow = isSearchMode ? "Search Catalog" : "Browse Books";
  const heroTitle = isSearchMode ? "Find a title in seconds" : "Explore every shelf";
  const heroDescription = isSearchMode
    ? "Search by title, author, category, or ISBN and jump straight to the book you need."
    : "Browse featured categories, filter by shelf, and request books from the live library catalog.";
  const searchPlaceholder = isSearchMode
    ? "Search title, author, category, or ISBN..."
    : "Search by title, author, or category...";
  const searchTip = isSearchMode ? "Search mode: ISBN gives the fastest exact match" : "Tip: Use ISBN for exact match";
  const catalogLabel = isSearchMode ? "Search Results" : "Library Catalog";
  const catalogTitle = isSearchMode ? "Matching books" : "All books";

  return (
    <View style={styles.screen}>
      <View style={styles.bgBlue} />
      <View style={styles.bgAmber} />
      <View style={styles.bgCenter} />

      <FlatList
        data={loading ? [] : filteredBooks}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadBooks(true)} />
        }
        ListHeaderComponent={
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroGlowPrimary} />
              <View style={styles.heroGlowSecondary} />

              <Text style={styles.eyebrow}>{heroEyebrow}</Text>
              <Text style={styles.heading}>{heroTitle}</Text>
              <Text style={styles.subheading}>
                {heroDescription}
              </Text>

              <View style={styles.heroChipRow}>
                <View style={styles.heroChip}>
                  <Text style={styles.heroChipText}>Total {loading ? "..." : books.length} titles</Text>
                </View>
                <View style={styles.heroChip}>
                  <Text style={styles.heroChipText}>Available {loading ? "..." : availableCount}</Text>
                </View>
              </View>
            </View>

            <View style={styles.searchCard}>
              <Text style={styles.searchLabel}>{isSearchMode ? "Search the live catalog" : "Quick search"}</Text>
              <View style={styles.searchInputWrap}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  style={styles.searchInput}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={webTheme.colors.inkMuted}
                  autoFocus={isSearchMode}
                />
              </View>
              <View style={styles.searchMetaRow}>
                <View style={styles.searchMetaChip}>
                  <Text style={styles.searchMetaText}>{loading ? "..." : resultLabel}</Text>
                </View>
                {selectedCategoryName ? (
                  <View style={[styles.searchMetaChip, styles.searchMetaChipHighlight]}>
                    <Text style={styles.searchMetaTextHighlight}>Category: {selectedCategoryName}</Text>
                  </View>
                ) : null}
                <View style={styles.searchMetaChip}>
                  <Text style={styles.searchMetaText}>
                    {query.trim() ? `Search: "${query.trim()}"` : searchTip}
                  </Text>
                </View>
              </View>
            </View>

            {!isSearchMode ? (
              <View style={styles.categoryCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTextWrap}>
                    <Text style={styles.sectionEyebrow}>Categories</Text>
                    <Text style={styles.sectionTitle}>Browse by category</Text>
                    <Text style={styles.sectionCopy}>
                      Filter the catalog by shelf category before opening a title.
                    </Text>
                  </View>
                  <Pressable
                    style={styles.clearFilterButton}
                    onPress={() => setCategoryFilter(null)}
                  >
                    <Text style={styles.clearFilterText}>Clear filter</Text>
                  </Pressable>
                </View>

                <View style={styles.categoryChipWrap}>
                  <Pressable
                    style={[styles.categoryChip, categoryFilter === null && styles.categoryChipActive]}
                    onPress={() => setCategoryFilter(null)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        categoryFilter === null && styles.categoryChipTextActive,
                      ]}
                    >
                      All categories
                    </Text>
                  </Pressable>
                  {categories.map((category) => (
                    <Pressable
                      key={category.id}
                      style={[styles.categoryChip, categoryFilter === category.id && styles.categoryChipActive]}
                      onPress={() => setCategoryFilter(category.id)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          categoryFilter === category.id && styles.categoryChipTextActive,
                        ]}
                      >
                        {category.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.filterCard}>
              <View style={styles.filterHeaderRow}>
                <Text style={styles.filterHeaderTitle}>Advanced Filters</Text>
                <Pressable style={styles.filterToggle} onPress={() => setFiltersOpen((prev) => !prev)}>
                  <Text style={styles.filterToggleText}>{filtersOpen ? "Hide" : "Show"}</Text>
                </Pressable>
              </View>

              {filtersOpen ? (
                <>
                  <View style={styles.filterOptionRow}>
                    {(["all", "available", "unavailable"] as const).map((option) => (
                      <Pressable
                        key={option}
                        style={[
                          styles.filterOptionChip,
                          availabilityFilter === option && styles.filterOptionChipActive,
                        ]}
                        onPress={() => setAvailabilityFilter(option)}
                      >
                        <Text
                          style={[
                            styles.filterOptionText,
                            availabilityFilter === option && styles.filterOptionTextActive,
                          ]}
                        >
                          {option === "all"
                            ? "All"
                            : option === "available"
                              ? "Available"
                              : "Unavailable"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.filterInputsWrap}>
                    <TextInput
                      value={authorFilter}
                      onChangeText={setAuthorFilter}
                      style={styles.filterInput}
                      placeholder="Author filter"
                      placeholderTextColor={webTheme.colors.inkMuted}
                    />
                    <TextInput
                      value={gradeLevelFilter}
                      onChangeText={setGradeLevelFilter}
                      style={styles.filterInput}
                      placeholder="Grade level filter"
                      placeholderTextColor={webTheme.colors.inkMuted}
                    />
                    <TextInput
                      value={languageFilter}
                      onChangeText={setLanguageFilter}
                      style={styles.filterInput}
                      placeholder="Language filter"
                      placeholderTextColor={webTheme.colors.inkMuted}
                    />
                  </View>

                  <View style={styles.filterActionRow}>
                    <Pressable style={styles.filterApplyButton} onPress={() => void loadBooks()}>
                      <Text style={styles.filterApplyText}>Apply Filters</Text>
                    </Pressable>
                    <Pressable
                      style={styles.filterResetButton}
                      onPress={() => {
                        setAvailabilityFilter("all");
                        setCategoryFilter(null);
                        setAuthorFilter("");
                        setGradeLevelFilter("");
                        setLanguageFilter("");
                        void loadBooks(false, {});
                      }}
                    >
                      <Text style={styles.filterResetText}>Reset</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
              {hasActiveServerFilters ? (
                <Text style={styles.filterActiveHint}>Server filters are active.</Text>
              ) : null}
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.catalogHeader}>
              <View style={styles.sectionTextWrap}>
                <Text style={styles.sectionEyebrow}>{catalogLabel}</Text>
                <Text style={styles.catalogTitle}>{catalogTitle}</Text>
                <Text style={styles.sectionCopy}>
                  {isSearchMode
                    ? "Review live matches and open a book detail page to continue."
                    : "Browse the full catalog and request a borrow in seconds."}
                </Text>
              </View>
              <View style={styles.catalogCountChip}>
                <Text style={styles.catalogCountText}>{loading ? "..." : resultLabel}</Text>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={webTheme.colors.accentCoolStrong} />
              <Text style={styles.loadingText}>Loading books...</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No books matched your search</Text>
              <Text style={styles.emptyText}>Try a different title, author, or category.</Text>
            </View>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: webTheme.colors.pageBg,
  },
  bgBlue: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 220,
    backgroundColor: "rgba(20,60,120,0.10)",
    left: -130,
    top: -70,
  },
  bgAmber: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 220,
    backgroundColor: "rgba(212,175,55,0.12)",
    right: -130,
    bottom: -150,
  },
  bgCenter: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 280,
    backgroundColor: "rgba(59,130,246,0.05)",
    left: "14%",
    top: "16%",
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 26,
    gap: 12,
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.14)",
    backgroundColor: webTheme.colors.darkBg,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
    shadowColor: "#0c1830",
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroGlowPrimary: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(59,130,246,0.2)",
    top: -72,
    left: -56,
  },
  heroGlowSecondary: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.18)",
    bottom: -78,
    right: -44,
  },
  eyebrow: {
    color: "#d9c06a",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    fontWeight: "700",
  },
  heading: {
    marginTop: 8,
    fontSize: 34,
    fontWeight: "800",
    color: webTheme.colors.darkInk,
    lineHeight: 38,
  },
  subheading: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    color: "rgba(232,241,255,0.74)",
  },
  heroChipRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroChipText: {
    color: "rgba(232,241,255,0.78)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontWeight: "800",
  },
  searchCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.10)",
    backgroundColor: webTheme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: "#12315e",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  searchLabel: {
    color: webTheme.colors.inkMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  searchInputWrap: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.12)",
    backgroundColor: webTheme.colors.pageBgStrong,
  },
  searchInput: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: webTheme.colors.ink,
    fontSize: 14,
  },
  searchMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  searchMetaChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.12)",
    backgroundColor: "#f8fbff",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  searchMetaChipHighlight: {
    borderColor: "rgba(20,60,120,0.16)",
    backgroundColor: "rgba(212,175,55,0.14)",
  },
  searchMetaText: {
    color: webTheme.colors.inkMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  searchMetaTextHighlight: {
    color: webTheme.colors.ink,
    fontSize: 11,
    fontWeight: "700",
  },
  categoryCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.10)",
    backgroundColor: webTheme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 12,
    shadowColor: "#12315e",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  sectionTextWrap: {
    flex: 1,
    gap: 3,
  },
  sectionEyebrow: {
    color: webTheme.colors.accentStrong,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    fontWeight: "700",
  },
  sectionTitle: {
    color: webTheme.colors.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  sectionCopy: {
    color: webTheme.colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  clearFilterButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.12)",
    backgroundColor: webTheme.colors.pageBgStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearFilterText: {
    color: webTheme.colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  categoryChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.14)",
    backgroundColor: "#f8fbff",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  categoryChipActive: {
    borderColor: "rgba(212,175,55,0.36)",
    backgroundColor: "rgba(212,175,55,0.14)",
  },
  categoryChipText: {
    color: webTheme.colors.inkMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  categoryChipTextActive: {
    color: webTheme.colors.ink,
  },
  filterCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.10)",
    backgroundColor: webTheme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 8,
    shadowColor: "#12315e",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  filterHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterHeaderTitle: {
    color: webTheme.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  filterToggle: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: webTheme.colors.pageBgStrong,
  },
  filterToggleText: {
    color: webTheme.colors.inkMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  filterOptionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  filterOptionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.14)",
    backgroundColor: "#f8fbff",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  filterOptionChipActive: {
    borderColor: "rgba(212,175,55,0.38)",
    backgroundColor: "rgba(212,175,55,0.16)",
  },
  filterOptionText: {
    color: webTheme.colors.inkMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  filterOptionTextActive: {
    color: webTheme.colors.ink,
  },
  filterInputsWrap: {
    gap: 7,
  },
  filterInput: {
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.14)",
    borderRadius: 14,
    backgroundColor: webTheme.colors.pageBgStrong,
    color: webTheme.colors.ink,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  filterActionRow: {
    marginTop: 2,
    flexDirection: "row",
    gap: 8,
  },
  filterApplyButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: webTheme.colors.accent,
    alignItems: "center",
    paddingVertical: 11,
  },
  filterApplyText: {
    color: webTheme.colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  filterResetButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.14)",
    backgroundColor: webTheme.colors.pageBgStrong,
    alignItems: "center",
    paddingVertical: 11,
  },
  filterResetText: {
    color: webTheme.colors.inkMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  filterActiveHint: {
    color: webTheme.colors.accentStrong,
    fontSize: 11,
    fontWeight: "700",
  },
  catalogHeader: {
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 8,
  },
  catalogTitle: {
    color: webTheme.colors.ink,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
  },
  catalogCountChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.12)",
    backgroundColor: "#f8fbff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  catalogCountText: {
    color: webTheme.colors.inkMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  bookCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.10)",
    backgroundColor: webTheme.colors.surface,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#16325f",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  bookCoverPanel: {
    position: "relative",
    aspectRatio: 3 / 2,
    backgroundColor: "#dce8f7",
  },
  bookCoverImage: {
    width: "100%",
    height: "100%",
  },
  bookCoverPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bookCoverPlaceholderText: {
    color: webTheme.colors.inkMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  bookCardTopRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  bookCategoryChip: {
    maxWidth: "62%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.18)",
    backgroundColor: "rgba(11,31,68,0.78)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bookCategoryText: {
    color: "#f8fbff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  bookAvailabilityChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bookAvailabilityChipAvailable: {
    borderColor: "rgba(20,60,120,0.18)",
    backgroundColor: "rgba(59,130,246,0.12)",
  },
  bookAvailabilityChipBorrowed: {
    borderColor: "rgba(212,175,55,0.28)",
    backgroundColor: "rgba(212,175,55,0.14)",
  },
  bookAvailabilityText: {
    fontSize: 10,
    fontWeight: "800",
  },
  bookAvailabilityTextAvailable: {
    color: webTheme.colors.accentCoolStrong,
  },
  bookAvailabilityTextBorrowed: {
    color: webTheme.colors.accentStrong,
  },
  bookBody: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  bookTitle: {
    color: webTheme.colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  bookAuthor: {
    color: webTheme.colors.inkMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  bookMetaWrap: {
    gap: 3,
  },
  bookMetaText: {
    color: webTheme.colors.inkMuted,
    fontSize: 12,
  },
  bookActionButton: {
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: webTheme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  bookActionButtonDisabled: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  bookActionText: {
    color: webTheme.colors.ink,
    fontWeight: "800",
    fontSize: 14,
  },
  bookActionTextDisabled: {
    color: "rgba(17,35,63,0.44)",
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 44,
    paddingBottom: 20,
    gap: 10,
  },
  loadingText: {
    color: webTheme.colors.inkMuted,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.10)",
    backgroundColor: webTheme.colors.surface,
    borderRadius: 22,
    gap: 6,
  },
  emptyTitle: {
    color: webTheme.colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    color: webTheme.colors.inkMuted,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  errorBox: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.58)",
    backgroundColor: "rgba(127,29,29,0.45)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorText: {
    color: "#fecaca",
    fontSize: 12,
  },
});
