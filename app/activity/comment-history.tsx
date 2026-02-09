import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { buildPropertyDetailsRoute } from '@/utils/routes';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { mockProperties } from '@/mocks/properties';
import { Image } from 'expo-image';

type CommentHistoryItem = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  thumbnailUrl: string;
  comment: string;
  timestamp: string;
};

export default function CommentHistoryScreen() {
  const router = useRouter();

  const mockComments = [
    'Beautiful property! Is it still available?',
    "What's the service charge?",
    'Can we schedule a viewing?',
    'Love the view from the balcony',
    'Is parking included?',
    'Interested in this. Please contact me.',
  ];

  const commentHistory: CommentHistoryItem[] = mockProperties.slice(0, 6).map((property, index) => ({
    id: `comment-${index}`,
    propertyId: property.id,
    propertyTitle: property.title,
    thumbnailUrl: property.thumbnailUrl,
    comment: mockComments[index],
    timestamp: [
      '3h ago',
      '5h ago',
      '1 day ago',
      '2 days ago',
      '4 days ago',
      '1 week ago',
    ][index],
  }));

  const CommentCard = ({ item }: { item: CommentHistoryItem }) => (
    <Pressable
      style={styles.commentCard}
      onPress={() => router.push(buildPropertyDetailsRoute({ propertyReference: item.propertyId, id: item.propertyId }) as any)}
    >
      <Image
        source={{ uri: item.thumbnailUrl }}
        style={styles.thumbnail}
        contentFit="cover"
      />
      <View style={styles.commentInfo}>
        <Text style={styles.commentText} numberOfLines={2}>
          {item.comment}
        </Text>
        <Text style={styles.propertyTitle} numberOfLines={1}>
          {item.propertyTitle}
        </Text>
        <Text style={styles.timestamp}>Commented {item.timestamp}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Comment history</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {commentHistory.map((item) => (
          <CommentCard key={item.id} item={item} />
        ))}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  commentCard: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  thumbnail: {
    width: 100,
    height: 100,
  },
  commentInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  commentText: {
    fontSize: 14,
    fontStyle: 'italic' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  propertyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  bottomSpacer: {
    height: 20,
  },
});
