import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { resolveMediaUrl } from "../config/api";
import { webTheme } from "../theme/webTheme";

type BookCardProps = {
  title: string;
  author: string;
  meta: string;
  coverImage?: string | null;
  onPress?: () => void;
};

export const BookCard = ({ title, author, meta, coverImage, onPress }: BookCardProps) => {
  const imageUrl = resolveMediaUrl(coverImage);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.coverImage} resizeMode="cover" />
      ) : (
        <View style={styles.coverPlaceholder}>
          <Text style={styles.coverText}>SL</Text>
        </View>
      )}
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.author} numberOfLines={1}>
        {author}
      </Text>
      <View style={styles.metaPill}>
        <Text style={styles.meta}>{meta}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 164,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.10)",
    backgroundColor: webTheme.colors.surface,
    padding: 10,
    gap: 6,
    shadowColor: "#173462",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.86,
  },
  coverPlaceholder: {
    height: 86,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.12)",
    backgroundColor: "#dbe8f8",
    alignItems: "center",
    justifyContent: "center",
  },
  coverImage: {
    height: 86,
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(20,60,120,0.12)",
    backgroundColor: "#dbe8f8",
  },
  coverText: {
    color: webTheme.colors.accentCoolStrong,
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    color: webTheme.colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  author: {
    color: webTheme.colors.inkMuted,
    fontSize: 11,
  },
  metaPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.28)",
    backgroundColor: "rgba(212,175,55,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  meta: {
    color: webTheme.colors.accentStrong,
    fontSize: 10,
    fontWeight: "700",
  },
});
