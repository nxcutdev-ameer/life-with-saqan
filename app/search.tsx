import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { buildPropertyDetailsRoute } from '@/utils/routes';
import {
  Search as SearchIcon,
  SlidersHorizontal,
  X,
  TrendingUp,
} from 'lucide-react-native';
import { mockProperties, cities } from '@/mocks/properties';
import { Property, PropertyType, TransactionType } from '@/types';
import { Image } from 'expo-image';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/utils/useTheme';

export default function SearchScreen() {
  const { colors: themeColors } = useTheme();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState({
    transactionType: '' as TransactionType | '',
    location: '',
    propertyType: '' as PropertyType | '',
    minPrice: '',
    maxPrice: '',
    bedrooms: [] as number[],
    bathrooms: [] as number[],
  });

  const recentSearches = ['Dubai Marina', 'JBR Beach', '2BR Apartments'];
  const trendingSearches = ['Luxury Villas', 'Downtown Dubai', 'Studio Apartments', 'Beach Properties'];

  const filteredProperties = mockProperties.filter((property) => {
    const matchesSearch = searchQuery === '' || 
      property.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.location.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.location.city.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTransaction = !filters.transactionType || property.listingType === filters.transactionType;
    const matchesLocation = !filters.location || property.location.city === filters.location;
    const matchesPropertyType = !filters.propertyType || property.propertyType === filters.propertyType;
    
    const matchesMinPrice = !filters.minPrice || property.price >= parseInt(filters.minPrice);
    const matchesMaxPrice = !filters.maxPrice || property.price <= parseInt(filters.maxPrice);
    
    const matchesBedrooms = filters.bedrooms.length === 0 || filters.bedrooms.includes(property.bedrooms);
    const matchesBathrooms = filters.bathrooms.length === 0 || filters.bathrooms.includes(property.bathrooms);

    return matchesSearch && matchesTransaction && matchesLocation && 
      matchesPropertyType && matchesMinPrice && matchesMaxPrice && matchesBedrooms && matchesBathrooms;
  });

  const toggleBedroomFilter = (num: number) => {
    setFilters(prev => ({
      ...prev,
      bedrooms: prev.bedrooms.includes(num)
        ? prev.bedrooms.filter(b => b !== num)
        : [...prev.bedrooms, num],
    }));
  };

  const toggleBathroomFilter = (num: number) => {
    setFilters(prev => ({
      ...prev,
      bathrooms: prev.bathrooms.includes(num)
        ? prev.bathrooms.filter(b => b !== num)
        : [...prev.bathrooms, num],
    }));
  };

  const clearFilters = () => {
    setFilters({
      transactionType: '',
      location: '',
      propertyType: '',
      minPrice: '',
      maxPrice: '',
      bedrooms: [],
      bathrooms: [],
    });
  };

  const hasActiveFilters = () => {
    return filters.transactionType || filters.location || filters.propertyType ||
      filters.minPrice || filters.maxPrice || filters.bedrooms.length > 0 || filters.bathrooms.length > 0;
  };

  const renderPropertyCard = ({ item }: { item: Property }) => (
    <Pressable
      style={styles.propertyCard}
      onPress={() => router.push(buildPropertyDetailsRoute({ propertyReference: item.propertyReference, id: item.id }))}
    >
      <Image
        source={{ uri: item.thumbnailUrl }}
        style={styles.propertyImage}
        contentFit="cover"
      />
      <View style={styles.propertyCardContent}>
        <Text style={styles.propertyCardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.propertyCardPrice}>
          {item.currency} {item.price.toLocaleString()}
          {item.listingType === 'RENT' ? '/year' : ''}
        </Text>
        <View style={styles.propertyCardDetails}>
          <Text style={styles.propertyCardDetail}>{item.bedrooms} bed</Text>
          <Text style={styles.propertyCardDivider}>•</Text>
          <Text style={styles.propertyCardDetail}>{item.bathrooms} bath</Text>
          <Text style={styles.propertyCardDivider}>•</Text>
          <Text style={styles.propertyCardDetail}>{item.sizeSqft} sqft</Text>
        </View>
        <Text style={styles.propertyCardLocation} numberOfLines={1}>
          {item.location.area}, {item.location.city}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <SearchIcon size={20} color={themeColors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search location, price, beds..."
            placeholderTextColor={themeColors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <Pressable onPress={() => setSearchQuery('')}>
              <X size={20} color={themeColors.textSecondary} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={[styles.filterButton, hasActiveFilters() && styles.filterButtonActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={20} color={hasActiveFilters() ? themeColors.white : themeColors.text} />
        </Pressable>
      </View>

      {showFilters && (
        <ScrollView style={styles.filtersPanel} showsVerticalScrollIndicator={false}>
          <View style={styles.filterSection}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filters</Text>
              {hasActiveFilters() && (
                <Pressable onPress={clearFilters}>
                  <Text style={styles.clearText}>Clear All</Text>
                </Pressable>
              )}
            </View>

            <Text style={styles.filterLabel}>Transaction Type</Text>
            <View style={styles.chipRow}>
              {(['BUY', 'RENT', 'STAY'] as TransactionType[]).map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.chip,
                    filters.transactionType === type && styles.chipSelected,
                  ]}
                  onPress={() => setFilters(prev => ({
                    ...prev,
                    transactionType: prev.transactionType === type ? '' : type,
                  }))}
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.transactionType === type && styles.chipTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.filterLabel}>Location</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {cities.map((city) => (
                  <Pressable
                    key={city}
                    style={[
                      styles.chip,
                      filters.location === city && styles.chipSelected,
                    ]}
                    onPress={() => setFilters(prev => ({
                      ...prev,
                      location: prev.location === city ? '' : city,
                    }))}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        filters.location === city && styles.chipTextSelected,
                      ]}
                    >
                      {city}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.filterLabel}>Property Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {(['apartment', 'villa', 'townhouse', 'penthouse', 'studio'] as PropertyType[]).map((type) => (
                  <Pressable
                    key={type}
                    style={[
                      styles.chip,
                      filters.propertyType === type && styles.chipSelected,
                    ]}
                    onPress={() => setFilters(prev => ({
                      ...prev,
                      propertyType: prev.propertyType === type ? '' : type,
                    }))}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        filters.propertyType === type && styles.chipTextSelected,
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.filterLabel}>Price Range (AED)</Text>
            <View style={styles.priceInputRow}>
              <TextInput
                style={styles.priceInput}
                placeholder="Min"
                placeholderTextColor={themeColors.textSecondary}
                keyboardType="numeric"
                value={filters.minPrice}
                onChangeText={(text) => setFilters(prev => ({ ...prev, minPrice: text }))}
              />
              <Text style={styles.priceSeparator}>—</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Max"
                placeholderTextColor={themeColors.textSecondary}
                keyboardType="numeric"
                value={filters.maxPrice}
                onChangeText={(text) => setFilters(prev => ({ ...prev, maxPrice: text }))}
              />
            </View>

            <Text style={styles.filterLabel}>Bedrooms</Text>
            <View style={styles.chipRow}>
              {[0, 1, 2, 3, 4, 5].map((num) => (
                <Pressable
                  key={num}
                  style={[
                    styles.chip,
                    filters.bedrooms.includes(num) && styles.chipSelected,
                  ]}
                  onPress={() => toggleBedroomFilter(num)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.bedrooms.includes(num) && styles.chipTextSelected,
                    ]}
                  >
                    {num === 0 ? 'Studio' : num}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.filterLabel}>Bathrooms</Text>
            <View style={styles.chipRow}>
              {[1, 2, 3, 4].map((num) => (
                <Pressable
                  key={num}
                  style={[
                    styles.chip,
                    filters.bathrooms.includes(num) && styles.chipSelected,
                  ]}
                  onPress={() => toggleBathroomFilter(num)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.bathrooms.includes(num) && styles.chipTextSelected,
                    ]}
                  >
                    {num}+
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {searchQuery === '' && !showFilters && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <TrendingUp size={20} color={themeColors.primary} />
                <Text style={styles.sectionTitle}>Trending Searches</Text>
              </View>
              <View style={styles.chipRow}>
                {trendingSearches.map((search) => (
                  <Pressable
                    key={search}
                    style={styles.trendingChip}
                    onPress={() => setSearchQuery(search)}
                  >
                    <Text style={styles.trendingChipText}>{search}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Searches</Text>
              {recentSearches.map((search) => (
                <Pressable
                  key={search}
                  style={styles.recentItem}
                  onPress={() => setSearchQuery(search)}
                >
                  <SearchIcon size={18} color={themeColors.textSecondary} />
                  <Text style={styles.recentItemText}>{search}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {(searchQuery !== '' || hasActiveFilters()) && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsCount}>
              {filteredProperties.length} {filteredProperties.length === 1 ? 'Property' : 'Properties'} Found
            </Text>
            <FlatList
              data={filteredProperties}
              renderItem={renderPropertyCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.propertiesList}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (themeColors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: themeColors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: themeColors.text,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: themeColors.surface,
    borderWidth: 1,
    borderColor: themeColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: themeColors.primary,
    borderColor: themeColors.primary,
  },
  filtersPanel: {
    maxHeight: 400,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  filterSection: {
    padding: 20,
    gap: 16,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: themeColors.text,
  },
  clearText: {
    fontSize: 14,
    color: themeColors.primary,
    fontWeight: '600',
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: themeColors.text,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: themeColors.border,
    backgroundColor: themeColors.surface,
  },
  chipSelected: {
    backgroundColor: themeColors.primary,
    borderColor: themeColors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: themeColors.text,
  },
  chipTextSelected: {
    color: themeColors.white,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceInput: {
    flex: 1,
    backgroundColor: themeColors.surface,
    borderWidth: 1,
    borderColor: themeColors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: themeColors.text,
  },
  priceSeparator: {
    fontSize: 16,
    color: themeColors.textSecondary,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: themeColors.text,
  },
  trendingChip: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: themeColors.surface,
    borderWidth: 1,
    borderColor: themeColors.primary,
  },
  trendingChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: themeColors.text,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  recentItemText: {
    fontSize: 15,
    color: themeColors.text,
  },
  resultsSection: {
    padding: 20,
  },
  resultsCount: {
    fontSize: 16,
    fontWeight: '600',
    color: themeColors.text,
    marginBottom: 16,
  },
  propertiesList: {
    gap: 16,
  },
  propertyCard: {
    backgroundColor: themeColors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  propertyImage: {
    width: '100%',
    height: 200,
  },
  propertyCardContent: {
    padding: 16,
    gap: 8,
  },
  propertyCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: themeColors.text,
    lineHeight: 22,
  },
  propertyCardPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: themeColors.primary,
  },
  propertyCardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  propertyCardDetail: {
    fontSize: 13,
    color: themeColors.textSecondary,
    fontWeight: '500',
  },
  propertyCardDivider: {
    fontSize: 13,
    color: themeColors.textSecondary,
  },
  propertyCardLocation: {
    fontSize: 13,
    color: themeColors.textSecondary,
  },
});