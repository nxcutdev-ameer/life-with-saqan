import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

type SearchHistoryItem = {
  id: string;
  query: string;
  timestamp: string;
};

export default function SearchHistoryScreen() {
  const router = useRouter();

  const searchHistory: SearchHistoryItem[] = [
    {
      id: 'search-1',
      query: '2BR Dubai Marina',
      timestamp: '2h ago',
    },
    {
      id: 'search-2',
      query: 'Villa under 2M AED',
      timestamp: '1 day ago',
    },
    {
      id: 'search-3',
      query: 'Beachfront apartments',
      timestamp: '3 days ago',
    },
    {
      id: 'search-4',
      query: 'Townhouse JBR',
      timestamp: '1 week ago',
    },
    {
      id: 'search-5',
      query: 'Studio Downtown',
      timestamp: '2 weeks ago',
    },
    {
      id: 'search-6',
      query: '3BR Penthouse',
      timestamp: '1 month ago',
    },
    {
      id: 'search-7',
      query: 'Rent Palm Jumeirah',
      timestamp: '1 month ago',
    },
    {
      id: 'search-8',
      query: 'Buy Business Bay',
      timestamp: '2 months ago',
    },
  ];

  const SearchItem = ({ item }: { item: SearchHistoryItem }) => (
    <Pressable style={styles.searchItem} onPress={() => {}}>
      <View style={styles.iconContainer}>
        <Search size={20} color={Colors.text} />
      </View>
      <View style={styles.searchInfo}>
        <Text style={styles.searchQuery}>{item.query}</Text>
        <Text style={styles.timestamp}>{item.timestamp}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Search history</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {searchHistory.map((item) => (
          <SearchItem key={item.id} item={item} />
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
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.textLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  searchInfo: {
    flex: 1,
  },
  searchQuery: {
    fontSize: 16,
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
