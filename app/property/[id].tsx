import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Dimensions,
  Image,
  FlatList,
  Linking,
} from 'react-native';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import {
  ArrowLeft,
  Heart,
  MapPin,
  Bed,
  Bath,
  Maximize,
  Phone,
  MessageCircle,
  Mail,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { mockProperties } from '@/mocks/properties';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PropertyDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const property = mockProperties.find(p => p.id === id);

  const [isLiked, setIsLiked] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const flatListRef = useRef<FlatList<string>>(null);

  if (!property) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Property not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const allMedia = [property.videoUrl, ...property.images];

  const toggleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLiked(!isLiked);
  };

  const agentPhoneRaw = property.agent?.phone ?? '+971501234567';
  const agentEmail = property.agent?.email ?? `${property.agentName.toLowerCase().replace(' ', '.')}@saqan.com`;

  const agentPhoneDigits = agentPhoneRaw.replace(/[^0-9]/g, '');

  const openPhone = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const telUrl = `tel:${agentPhoneRaw}`;
    if (await Linking.canOpenURL(telUrl)) {
      await Linking.openURL(telUrl);
    }
  };

  const openWhatsApp = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const text = `Hi, I'm interested in ${property.title}`;
    const encodedText = encodeURIComponent(text);

    // App deep link
    const appUrl = `whatsapp://send?phone=${agentPhoneDigits}&text=${encodedText}`;

    // Universal web fallback
    const webUrl = `https://wa.me/${agentPhoneDigits}?text=${encodedText}`;

    if (await Linking.canOpenURL(appUrl)) {
      await Linking.openURL(appUrl);
      return;
    }

    await Linking.openURL(webUrl);
  };

  const openEmail = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const subject = encodeURIComponent(`Inquiry about ${property.title}`);
    const body = encodeURIComponent(
      `Hi ${property.agentName},\n\nI'm interested in ${property.title}. Could you share more details?\n\nThanks!`
    );

    const mailtoUrl = `mailto:${agentEmail}?subject=${subject}&body=${body}`;
    if (await Linking.canOpenURL(mailtoUrl)) {
      await Linking.openURL(mailtoUrl);
    }
  };

  const scrollToImage = (index: number) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setCurrentImageIndex(index);
  };

  const renderMediaItem = ({ item, index }: { item: string; index: number }) => {
    if (index === 0) {
      return (
        <View style={styles.mediaItem}>
          <Video
            source={{ uri: item }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            useNativeControls
            isLooping
          />
        </View>
      );
    }

    return (
      <View style={styles.mediaItem}>
        <Image source={{ uri: item }} style={styles.image} resizeMode="cover" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.mediaContainer}>
          <FlatList
            ref={flatListRef}
            data={allMedia}
            renderItem={renderMediaItem}
            keyExtractor={(item, index) => `${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setCurrentImageIndex(index);
            }}
            scrollEventThrottle={16}
            getItemLayout={(data, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
          />

          <View style={styles.mediaControls}>
            {currentImageIndex > 0 && (
              <Pressable
                style={[styles.mediaArrow, styles.mediaArrowLeft]}
                onPress={() => scrollToImage(currentImageIndex - 1)}
              >
                <ChevronLeft size={scaleWidth(24)} color={Colors.textLight} />
              </Pressable>
            )}
            {currentImageIndex < allMedia.length - 1 && (
              <Pressable
                style={[styles.mediaArrow, styles.mediaArrowRight]}
                onPress={() => scrollToImage(currentImageIndex + 1)}
              >
                <ChevronRight size={scaleWidth(24)} color={Colors.textLight} />
              </Pressable>
            )}
          </View>

          <View style={styles.mediaIndicators}>
            {allMedia.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.indicator,
                  index === currentImageIndex && styles.indicatorActive,
                ]}
              />
            ))}
          </View>

          <Pressable style={styles.headerBackButton} onPress={() => router.back()}>
            <View style={styles.headerButtonCircle}>
              <ArrowLeft size={scaleWidth(24)} color={Colors.text} />
            </View>
          </Pressable>

          <Pressable style={styles.headerLikeButton} onPress={toggleLike}>
            <View style={styles.headerButtonCircle}>
              <Heart
                size={scaleWidth(24)}
                color={isLiked ? Colors.bronze : Colors.text}
                fill={isLiked ? Colors.bronze : 'transparent'}
              />
            </View>
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.headerSection}>
            <View style={styles.headerLeft}>
              <Text style={styles.propertyTitle}>{property.title}</Text>
              <View style={styles.locationRow}>
                <MapPin size={scaleWidth(14)} color={Colors.textSecondary} />
                <Text style={styles.locationText}>
                  {property.location.area}, {property.location.city}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.priceCard}>
            <Text style={styles.price}>
              {property.currency} {property.price.toLocaleString()}
              {property.listingType === 'RENT' ? '/year' : ''}
            </Text>
            <View style={styles.listingTypeBadge}>
              <Text style={styles.listingTypeText}>{property.listingType}</Text>
            </View>
          </View>

          <View style={styles.keyDetailsCard}>
            <View style={styles.detailItem}>
              <Bed size={scaleWidth(28)} color={Colors.bronze} />
              <Text style={styles.detailLabel}>Bedrooms</Text>
              <Text style={styles.detailValue}>{property.bedrooms}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailItem}>
              <Bath size={scaleWidth(28)} color={Colors.bronze} />
              <Text style={styles.detailLabel}>Bathrooms</Text>
              <Text style={styles.detailValue}>{property.bathrooms}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailItem}>
              <Maximize size={scaleWidth(28)} color={Colors.bronze} />
              <Text style={styles.detailLabel}>Size</Text>
              <Text style={styles.detailValue}>{property.sizeSqft.toLocaleString()} sqft</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{property.description}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenitiesGrid}>
              {property.amenities.map((amenity, index) => (
                <View key={index} style={styles.amenityChip}>
                  <Text style={styles.amenityText}>{amenity}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lifestyle</Text>
            <View style={styles.lifestyleRow}>
              {property.lifestyle.map((lifestyle, index) => (
                <View key={index} style={styles.lifestyleBadge}>
                  <Text style={styles.lifestyleBadgeText}>{lifestyle.replace('_', ' ')}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.agentCard}>
            <Text style={styles.sectionTitle}>Agent Information</Text>
            <View style={styles.agentRow}>
              <View style={styles.agentAvatar}>
                <Text style={styles.agentInitial}>{property.agentName.charAt(0)}</Text>
              </View>
              <View style={styles.agentInfo}>
                <Text style={styles.agentName}>{property.agentName}</Text>
                <Text style={styles.agentRole}>Real Estate Agent</Text>
                <Text style={styles.agentStats}>12 Properties • 4.8 ⭐</Text>
              </View>
            </View>
          </View>

          <View style={styles.spacer} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
            <Pressable
          style={styles.scheduleButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
        >
          <Calendar size={scaleWidth(20)} color={Colors.textLight} />
          <Text style={styles.scheduleButtonText}>Schedule Visit</Text>
        </Pressable>
        <View style={styles.contactButtons}>
        
          <Pressable
            style={styles.contactIconButton}
            onPress={openPhone}
          >
            <Phone size={scaleWidth(20)} color={Colors.bronze} />
          </Pressable>
          <Pressable
            style={styles.contactIconButton}
            onPress={openWhatsApp}
          >
            <MessageCircle size={scaleWidth(20)} color={Colors.bronze} />
          </Pressable>
          <Pressable
            style={styles.contactIconButton}
            onPress={openEmail}
          >
            <Mail size={scaleWidth(20)} color={Colors.bronze} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  mediaContainer: {
    height: scaleHeight(400),
    position: 'relative' as const,
  },
  mediaItem: {
    width: SCREEN_WIDTH,
    height: scaleHeight(400),
  },
  video: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  mediaControls: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(20),
  },
  mediaArrow: {
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: scaleWidth(20),
    backgroundColor: Colors.overlayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaArrowLeft: {},
  mediaArrowRight: {},
  mediaIndicators: {
    position: 'absolute' as const,
    bottom: scaleHeight(20),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: scaleWidth(8),
  },
  indicator: {
    width: scaleWidth(8),
    height: scaleWidth(8),
    borderRadius: scaleWidth(4),
    backgroundColor: 'rgba(243, 237, 223, 0.5)',
  },
  indicatorActive: {
    backgroundColor: Colors.textLight,
    width: scaleWidth(24),
  },
  headerBackButton: {
    position: 'absolute' as const,
    top: scaleHeight(60),
    left: scaleWidth(20),
  },
  headerLikeButton: {
    position: 'absolute' as const,
    top: scaleHeight(60),
    right: scaleWidth(20),
  },
  headerButtonCircle: {
    width: scaleWidth(44),
    height: scaleWidth(44),
    borderRadius: scaleWidth(22),
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: scaleWidth(20),
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scaleHeight(20),
  },
  headerLeft: {
    flex: 1,
  },
  propertyTitle: {
    fontSize: scaleFont(20),
    fontWeight: '700',
    color: Colors.text,
    marginBottom: scaleHeight(8),
    lineHeight: scaleFont(36),
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(6),
  },
  locationText: {
    fontSize: scaleFont(14),
    color: Colors.textSecondary,
  },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.textLight,
    padding: scaleWidth(20),
    borderRadius: scaleWidth(16),
    marginBottom: scaleHeight(20),
    borderWidth: 1,
    borderColor: Colors.bronze,
  },
  price: {
    fontSize: scaleFont(20),
    fontWeight: '500',
    color: Colors.bronze,
  },
  listingTypeBadge: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.bronze,
    paddingVertical: scaleHeight(8),
    paddingHorizontal: scaleWidth(16),
    borderRadius: scaleWidth(20),
  },
  listingTypeText: {
    color: Colors.bronze,
    fontSize: scaleFont(14),
    fontWeight: '500',
  },
  keyDetailsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.textLight,
    padding: scaleWidth(20),
    borderRadius: scaleWidth(16),
    marginBottom: scaleHeight(24),
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
    gap: scaleHeight(8),
  },
  detailDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: scaleWidth(12),
  },
  detailLabel: {
    fontSize: scaleFont(12),
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: scaleFont(14),
    color: Colors.text,
    fontWeight: '700',
  },
  section: {
    marginBottom: scaleHeight(28),
  },
  sectionTitle: {
    fontSize: scaleFont(20),
    fontWeight: '700',
    color: Colors.text,
    marginBottom: scaleHeight(12),
  },
  description: {
    fontSize: scaleFont(14),
    color: Colors.textSecondary,
    lineHeight: scaleFont(24),
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scaleWidth(12),
  },
  amenityChip: {
    backgroundColor: Colors.textLight,
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(16),
    borderRadius: scaleWidth(20),
    borderWidth: 1,
    borderColor: Colors.border,
  },
  amenityText: {
    fontSize: scaleFont(14),
    color: Colors.text,
    fontWeight: '500',
  },
  lifestyleRow: {
    flexDirection: 'row',
    gap: scaleWidth(12),
  },
  lifestyleBadge: {
    backgroundColor: Colors.background,
    borderWidth:1,
    borderColor: Colors.bronze,
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(20),
    borderRadius: scaleWidth(20),
  },
  lifestyleBadgeText: {
    fontSize: scaleFont(14),
    color: Colors.bronze,
    fontWeight: '500',
  },
  agentCard: {
    backgroundColor: Colors.textLight,
    padding: scaleWidth(20),
    borderRadius: scaleWidth(16),
    marginBottom: scaleHeight(24),
    borderWidth: 1,
    borderColor: Colors.border,
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(16),
  },
  agentAvatar: {
    width: scaleWidth(60),
    height: scaleWidth(60),
    borderRadius: scaleWidth(30),
    backgroundColor: Colors.bronze,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentInitial: {
    fontSize: scaleFont(24),
    fontWeight: '700',
    color: Colors.textLight,
  },
  agentInfo: {
    flex: 1,
    gap: scaleHeight(4),
  },
  agentName: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: Colors.text,
  },
  agentRole: {
    fontSize: scaleFont(14),
    color: Colors.textSecondary,
  },
  agentStats: {
    fontSize: scaleFont(13),
    color: Colors.textSecondary,
  },
  spacer: {
    height: scaleHeight(100),
  },
  footer: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    padding: scaleWidth(20),
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    gap: scaleWidth(12),
  },
  contactButtons: {
    flexDirection: 'row',
    gap: scaleWidth(12),
  },
  contactIconButton: {
    width: scaleWidth(48),
    height: scaleWidth(48),
    borderRadius: scaleWidth(24),
    backgroundColor: Colors.background,
    borderWidth:1,
    borderColor: Colors.bronze,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bronze,
    paddingVertical: scaleHeight(14),
    borderRadius: scaleWidth(24),
    gap: scaleWidth(8),
  },
  scheduleButtonText: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: Colors.textLight,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: scaleWidth(32),
  },
  errorText: {
    fontSize: scaleFont(18),
    fontWeight: '600',
    color: Colors.text,
    marginBottom: scaleHeight(20),
  },
  backButton: {
    backgroundColor: Colors.bronze,
    paddingVertical: scaleHeight(14),
    paddingHorizontal: scaleWidth(32),
    borderRadius: scaleWidth(24),
  },
  backButtonText: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: Colors.textLight,
  },
});