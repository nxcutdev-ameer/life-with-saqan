import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { buildPropertyDetailsRoute } from '@/utils/routes';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { mockProperties } from '@/mocks/properties';
import { Image } from 'expo-image';

type WatchHistoryItem = {
  id: string;
  title: string;
  price: string;
  thumbnailUrl: string;
  timestamp: string;
};

export default function WatchHistoryScreen() {
  const router = useRouter();

  const watchHistory: WatchHistoryItem[] = mockProperties.slice(0, 10).map((property, index) => ({
    id: property.id,
    title: property.title,
    price: `AED ${property.price.toLocaleString()}`,
    thumbnailUrl: property.thumbnailUrl,
    timestamp: [
      '1h ago',
      '2h ago',
      '3h ago',
      '5h ago',
      '8h ago',
      '1 day ago',
      '2 days ago',
      '3 days ago',
      '5 days ago',
      '1 week ago',
    ][index],
  }));

  const PropertyCard = ({ item }: { item: WatchHistoryItem }) => (
    <Pressable
      style={styles.propertyCard}
      onPress={() => router.push(buildPropertyDetailsRoute({ propertyReference: item.id, id: item.id }) as any)}
    >
      <Image
        source={{ uri: item.thumbnailUrl }}
        style={styles.thumbnail}
        contentFit="cover"
      />
      <View style={styles.propertyInfo}>
        <Text style={styles.propertyTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.propertyPrice}>{item.price}</Text>
        <Text style={styles.timestamp}>Viewed {item.timestamp}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Watch history</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {watchHistory.map((item) => (
          <PropertyCard key={item.id} item={item} />
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
  propertyCard: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  thumbnail: {
    width: 120,
    height: 120,
  },
  propertyInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  propertyPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.bronze,
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
