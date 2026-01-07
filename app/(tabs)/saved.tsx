import React, { useState } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Grid, List, Folder, Plus } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { mockProperties } from '@/mocks/properties';
import { Property } from '@/types';
import { Image } from 'expo-image';

type ViewMode = 'grid' | 'list';

interface Collection {
  id: string;
  name: string;
  propertyIds: string[];
  color: string;
}

export default function SavedScreen() {
  const router = useRouter();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

  const savedPropertyIds = ['1', '2', '3', '5', '8'];
  const savedProperties = mockProperties.filter(p => savedPropertyIds.includes(p.id));

  const collections: Collection[] = [
    { id: 'all', name: 'All Saved', propertyIds: savedPropertyIds, color: Colors.bronze },
    { id: '1', name: 'Dubai Marina', propertyIds: ['1', '2'], color: '#03A9F4' },
    { id: '2', name: 'Beach Properties', propertyIds: ['3', '5'], color: '#8BC34A' },
    { id: '3', name: 'Investment Options', propertyIds: ['8'], color: '#FF5722' },
  ];

  const activeCollection = selectedCollection 
    ? collections.find(c => c.id === selectedCollection)
    : collections[0];

  const displayedProperties = activeCollection
    ? mockProperties.filter(p => activeCollection.propertyIds.includes(p.id))
    : savedProperties;

  const renderGridItem = ({ item }: { item: Property }) => (
    <Pressable
      style={styles.gridItem}
      onPress={() => router.push(`/property/${item.id}`)}
    >
      <Image
        source={{ uri: item.thumbnailUrl }}
        style={styles.gridImage}
        contentFit="cover"
      />
      <View style={styles.gridOverlay}>
        <Text style={styles.gridPrice}>
          {item.currency} {item.price >= 1000000 
            ? `${(item.price / 1000000).toFixed(1)}M` 
            : `${(item.price / 1000).toFixed(0)}K`}
        </Text>
      </View>
    </Pressable>
  );

  const renderListItem = ({ item }: { item: Property }) => (
    <Pressable
      style={styles.listItem}
      onPress={() => router.push(`/property/${item.id}`)}
    >
      <Image
        source={{ uri: item.thumbnailUrl }}
        style={styles.listImage}
        contentFit="cover"
      />
      <View style={styles.listContent}>
        <Text style={styles.listTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.listPrice}>
          {item.currency} {item.price.toLocaleString()}
          {item.listingType === 'RENT' ? '/year' : ''}
        </Text>
        <View style={styles.listDetails}>
          <Text style={styles.listDetail}>{item.bedrooms} bed</Text>
          <Text style={styles.listDivider}>•</Text>
          <Text style={styles.listDetail}>{item.bathrooms} bath</Text>
          <Text style={styles.listDivider}>•</Text>
          <Text style={styles.listDetail}>{item.sizeSqft} sqft</Text>
        </View>
        <Text style={styles.listLocation} numberOfLines={1}>
          {item.location.area}, {item.location.city}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saved</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.viewModeButton, viewMode === 'grid' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('grid')}
          >
            <Grid size={scaleWidth(20)} color={viewMode === 'grid' ? Colors.textLight : Colors.text} />
          </Pressable>
          <Pressable
            style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <List size={scaleWidth(20)} color={viewMode === 'list' ? Colors.textLight : Colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.collectionsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={collections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.collectionsList}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.collectionChip,
                selectedCollection === item.id && styles.collectionChipActive,
                { borderColor: item.color },
              ]}
              onPress={() => setSelectedCollection(item.id === selectedCollection ? null : item.id)}
            >
              <Folder size={scaleWidth(16)} color={selectedCollection === item.id ? Colors.textLight : item.color} />
              <Text
                style={[
                  styles.collectionChipText,
                  selectedCollection === item.id && styles.collectionChipTextActive,
                ]}
              >
                {item.name}
              </Text>
              <View style={styles.collectionCount}>
                <Text style={[
                  styles.collectionCountText,
                  selectedCollection === item.id && styles.collectionCountTextActive,
                ]}>
                  {item.propertyIds.length}
                </Text>
              </View>
            </Pressable>
          )}
        />
        <Pressable style={styles.addCollectionButton}>
          <Plus size={scaleWidth(20)} color={Colors.bronze} />
        </Pressable>
      </View>

      {displayedProperties.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No saved properties</Text>
          <Text style={styles.emptyText}>
            Properties you save will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedProperties}
          renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode}
          contentContainerStyle={[
            styles.propertiesList,
            { paddingBottom: bottomTabBarHeight + scaleHeight(16) },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: scaleHeight(60),
    paddingHorizontal: scaleWidth(20),
    paddingBottom: scaleHeight(16),
  },
  headerTitle: {
    fontSize: scaleFont(32),
    fontWeight: '700',
    color: Colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: scaleWidth(8),
  },
  viewModeButton: {
    width: scaleWidth(40),
    height: scaleHeight(40),
    borderRadius: scaleWidth(12),
    backgroundColor: Colors.textLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: Colors.bronze,
    borderColor: Colors.bronze,
  },
  collectionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(20),
    paddingBottom: scaleHeight(16),
    gap: scaleWidth(12),
  },
  collectionsList: {
    gap: scaleWidth(8),
  },
  collectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(8),
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(16),
    borderRadius: scaleWidth(20),
    borderWidth: 1,
    backgroundColor: Colors.textLight,
  },
  collectionChipActive: {
    backgroundColor: Colors.bronze,
    borderColor: Colors.bronze,
  },
  collectionChipText: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: Colors.text,
  },
  collectionChipTextActive: {
    color: Colors.textLight,
  },
  collectionCount: {
    minWidth: scaleWidth(20),
    height: scaleHeight(20),
    borderRadius: scaleWidth(10),
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scaleWidth(6),
  },
  collectionCountText: {
    fontSize: scaleFont(11),
    fontWeight: '700',
    color: Colors.text,
  },
  collectionCountTextActive: {
    color: Colors.bronze,
  },
  addCollectionButton: {
    width: scaleWidth(40),
    height: scaleHeight(40),
    borderRadius: scaleWidth(20),
    backgroundColor: Colors.textLight,
    borderWidth: 1,
    borderColor: Colors.bronze,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertiesList: {
    padding: scaleWidth(20),
    gap: scaleWidth(16),
  },
  gridItem: {
    flex: 1,
    aspectRatio: 0.75,
    margin: scaleWidth(4),
    borderRadius: scaleWidth(12),
    overflow: 'hidden',
    backgroundColor: Colors.textLight,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: scaleWidth(12),
    backgroundColor: Colors.overlayLight,
  },
  gridPrice: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: Colors.textLight,
  },
  listItem: {
    flexDirection: 'row',
    backgroundColor: Colors.textLight,
    borderRadius: scaleWidth(16),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: scaleHeight(16),
  },
  listImage: {
    width: scaleWidth(120),
    height: scaleHeight(120),
  },
  listContent: {
    flex: 1,
    padding: scaleWidth(12),
    gap: scaleWidth(6),
  },
  listTitle: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: Colors.text,
    lineHeight: scaleFont(20),
  },
  listPrice: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: Colors.bronze,
  },
  listDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(6),
  },
  listDetail: {
    fontSize: scaleFont(12),
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  listDivider: {
    fontSize: scaleFont(12),
    color: Colors.textSecondary,
  },
  listLocation: {
    fontSize: scaleFont(12),
    color: Colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: scaleWidth(32),
  },
  emptyTitle: {
    fontSize: scaleFont(24),
    fontWeight: '700',
    color: Colors.text,
    marginBottom: scaleHeight(8),
  },
  emptyText: {
    fontSize: scaleFont(16),
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
