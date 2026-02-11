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
  Alert,
  ActivityIndicator,
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
import {
  fetchPropertyByReferenceResponse,
  PropertyDetailsPayload,
} from '@/utils/propertiesApi';
import type { Property, TransactionType, PropertyType, LifestyleType } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useEngagementStore } from '@/stores/engagementStore';
import { useAuthStore } from '@/stores/authStore';
import ScheduleVisitModal from '@/components/ScheduleVisitModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PropertyDetailScreen() {
  const router = useRouter();
  // Route param is treated as the property reference.
  const { id, videoId } = useLocalSearchParams<{ id?: string | string[]; videoId?: string | string[] }>();
  const propertyReference = Array.isArray(id) ? id[0] : id;
  const videoIdParam = Array.isArray(videoId) ? videoId[0] : videoId;
  // `videoId` is optional; when provided, we keep it as the local property id for engagement tracking.

  const [property, setProperty] = useState<Property | null>(() => {
    // Allow mocked items to still work in dev.
    return (
      mockProperties.find((p) => p.propertyReference === propertyReference) ||
      mockProperties.find((p) => p.id === propertyReference) ||
      null
    );
  });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [agentAvatarError, setAgentAvatarError] = useState(false);
  const propertiesToken = useAuthStore((st) => st.session?.tokens?.propertiesToken) ?? null;
  const mapApiPayloadToProperty = (payload: PropertyDetailsPayload, videoIdOverride?: string): Property => {
    const parseNum = (value: unknown, fallback = 0) => {
      const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
      return Number.isFinite(n) ? n : fallback;
    };

    const listingType: TransactionType = payload.type === 'rent' ? 'RENT' : payload.type === 'stay' ? 'STAY' : 'BUY';

    const pricing = payload.default_pricing ?? 'month';
    
    let price = 0;
    if (listingType === 'BUY') {
      price = parseNum(payload.meta?.sale_price);
    } else {
        price =
        pricing === 'week'
            ? parseNum(payload.meta?.week_price)
            : pricing === 'year'
            ? parseNum(payload.meta?.year_price)
            : parseNum(payload.meta?.month_price);
    }

    const emirateName = payload.emirate?.name ?? 'UAE';
    const areaName = payload.area?.name ?? payload.district?.name ?? 'Unknown area';

    const fallbackThumb =
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80';

    const amenities = (payload.amenities ?? [])
      .map((a) => (typeof a?.name === 'string' ? a.name : ''))
      .filter((v) => Boolean(v));

    const mediaUrls = (payload.media ?? [])
      .map((m) => m?.original_url ?? m?.url ?? m?.file ?? m?.path)
      .filter((u): u is string => typeof u === 'string' && u.length > 0);

    const videoUrl = mediaUrls.find((u) => u.endsWith('.mp4')) ?? '';
    // Filter out video from images list if needed, or keep all. Usually images are non-mp4.
    const images = mediaUrls.filter((u) => !u.endsWith('.mp4'));

    return {
      id: videoIdOverride || payload.reference_id,
      propertyReference: payload.reference_id,
      title: payload.title ?? 'Untitled property',
      description: payload.description ?? '',
      defaultPricing: payload.default_pricing ?? undefined,
      price,
      currency: 'AED',
      listingType,
      propertyType: 'apartment' as PropertyType,
      bedrooms: parseNum(payload.meta?.bedrooms),
      bathrooms: parseNum(payload.meta?.bathrooms),
      sizeSqft: parseNum(payload.meta?.size) || parseNum(payload.meta?.square),
      location: {
        city: emirateName,
        area: areaName,
        latitude: 0,
        longitude: 0,
      },
      videoUrl,
      thumbnailUrl: images[0] ?? fallbackThumb,
      images: images.length > 0 ? images : [fallbackThumb],
      amenities,
      lifestyle: [] as LifestyleType[],
      agent: {
        id: String(payload.agent?.id ?? '0'),
        name: payload.agent?.name ?? `Agent ${payload.agent?.id ?? ''}`.trim(),
        agency: payload.agency?.agency_name ?? 'Agency',
        // Use real avatar URL if provided; otherwise keep empty so UI can fall back to initials.
        photo: payload.agent?.avatar?.url ?? '',
        phone: payload.agent?.phone ?? '+971501234567',
        email: payload.agent?.email ?? 'agent@vzite.com',
        isVerified: true,
      },
      agentName: payload.agent?.name ??(`Agent ${payload.agent?.id ?? ''}`.trim() || 'Agent'),
      // Keep empty when missing so initials render correctly.
      agentPhoto: payload.agent?.avatar?.url ?? '',
      likesCount: 0,
      savesCount: 0,
      sharesCount: 0,
      commentsCount: 0,
    };
  };

  React.useEffect(() => {
    console.log(propertyReference)
        if (!propertyReference) return;

    (async () => {
      setLoadError(null);

      // 1) Hydrate quickly from cache (if any)
      try {
        const cached = await AsyncStorage.getItem(`@property_cache_${propertyReference}`);
        if (cached) {
          setProperty(JSON.parse(cached));
        }
      } catch {
        // ignore
      }

      // 2) Fetch the latest from API
      try {
        setLoading(true);
          const response = await fetchPropertyByReferenceResponse(propertyReference, {
          timeoutMs: 15000,
          propertiesToken,
        });

        const payload = response.payload;
        console.log(response)
        const mapped = mapApiPayloadToProperty(payload, videoIdParam);
                setProperty(mapped);
        await AsyncStorage.setItem(`@property_cache_${propertyReference}`, JSON.stringify(mapped));
      } catch (e: any) {
                        setLoadError(e?.message ?? 'Failed to load property');
      } finally {
                setLoading(false);
      }
    })();
  }, [propertyReference, propertiesToken, videoIdParam]);

  const { hydrated: likesHydrated, hydrate: hydrateLikes, toggleLike: toggleLikeGlobal } = useEngagementStore();
  const likeVideoId = property?.id ? String(property.id) : null;
  const isLiked = useEngagementStore((s) => (likeVideoId ? s.isLiked(likeVideoId) : false));
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [scheduleVisitOpen, setScheduleVisitOpen] = useState(false);
  const flatListRef = useRef<FlatList<string>>(null);

  React.useEffect(() => {
    if (!likesHydrated) hydrateLikes();
  }, [hydrateLikes, likesHydrated]);

  const toggleLike = async () => {
    if (!likeVideoId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await toggleLikeGlobal(likeVideoId);
      // Store will keep latest likesCount so feed can reflect it when navigating back.
      // (No local UI count shown on this screen yet.)
      void res;
    } catch {
      // ignore
    }
  };

  if (!property) {
    return (
      <View style={styles.errorContainer}>
        {loading ? (
          <ActivityIndicator color={Colors.bronze} />
        ) : (
          <Text style={styles.errorText}>Property not found</Text>
        )}
        {/* {loadError ? <Text style={[styles.errorText, { marginTop: 12 }]}>{loadError}</Text> : null} */}
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const allMedia = [...(property.videoUrl ? [property.videoUrl] : []), ...(property.images ?? [])];
  const hasMedia = allMedia.length > 0;

  const agentPhoneRaw = property.agent?.phone ?? '+971501234567';

  const getInitials = (name: string) => {
    const cleaned = (name ?? '').trim();
    if (!cleaned) return 'A';
    const parts = cleaned.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? parts[1]?.[0] ?? '' : '';
    const initials = `${first}${second}`.toUpperCase();
    return initials || 'A';
  };

  const agentDisplayName = (property.agent?.name || property.agentName || 'Agent').trim() || 'Agent';
  const agentAvatarUrl = (property.agent?.photo || property.agentPhoto || '').trim();
  const agentInitials = getInitials(agentDisplayName);

  const agentEmail =
    property.agent?.email ?? `${agentDisplayName.toLowerCase().replace(/\s+/g, '.')}@saqan.com`;

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
      `Hi ${agentDisplayName},\n\nI'm interested in ${property.title}. Could you share more details?\n\nThanks!`
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

  const renderMediaItem = ({ item }: { item: string }) => {
    const isVideo = item.endsWith('.mp4') || item.includes('video');

    if (isVideo) {
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
          {loading ? (
            <View style={[styles.mediaItem, { alignItems: 'center', justifyContent: 'center' }]}>
              <ActivityIndicator color={Colors.textLight} />
            </View>
          ) : !hasMedia ? (
            <View
              style={[
                styles.mediaItem,
                {
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: Colors.overlayLight,
                },
              ]}
            >
              <Text style={{ color: Colors.textLight }}>No media available</Text>
            </View>
          ) : (
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
          )}

          <View style={styles.mediaControls}>
            {hasMedia && currentImageIndex > 0 && (
              <Pressable
                style={[styles.mediaArrow, styles.mediaArrowLeft]}
                onPress={() => scrollToImage(currentImageIndex - 1)}
              >
                <ChevronLeft size={scaleWidth(24)} color={Colors.textLight} />
              </Pressable>
            )}
            {hasMedia && currentImageIndex < allMedia.length - 1 && (
              <Pressable
                style={[styles.mediaArrow, styles.mediaArrowRight]}
                onPress={() => scrollToImage(currentImageIndex + 1)}
              >
                <ChevronRight size={scaleWidth(24)} color={Colors.textLight} />
              </Pressable>
            )}
          </View>
          {hasMedia ? (
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
          ) : null}

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
              {property.defaultPricing ? `/${property.defaultPricing}` : property.listingType === 'RENT' ? '/year' : ''}
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
              {property.amenities.map((amenity: string, index: number) => (
                <View key={index} style={styles.amenityChip}>
                  <Text style={styles.amenityText}>{amenity}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lifestyle</Text>
            <View style={styles.lifestyleRow}>
              {property.lifestyle.map((lifestyle: string, index: number) => (
                <View key={index} style={styles.lifestyleBadge}>
                  <Text style={styles.lifestyleBadgeText}>{lifestyle.replace('_', ' ')}</Text>
                </View>
              ))}
            </View>
          </View> */}

          <View style={styles.agentCard}>
            <Text style={styles.sectionTitle}>Agent Information</Text>
            <View style={styles.agentRow}>
               {agentAvatarUrl && !agentAvatarError ? (
                <Image
                  source={{ uri: agentAvatarUrl }}
                  style={styles.agentAvatar}
                  onError={() => setAgentAvatarError(true)}
                />
              ) : (
                <View style={[styles.agentAvatar, { overflow: 'hidden' }]}>
                  <Text style={styles.agentInitial}>{agentInitials}</Text>
                </View>
              )}
              <View style={styles.agentInfo}>
                <Text style={styles.agentName}>{agentDisplayName}</Text>
                <Text style={styles.agentRole}>Real Estate Agent</Text>
                <Text style={styles.agentStats}>12 Properties • 4.8 ⭐</Text>
              </View>
            </View>
          </View>

          <View style={styles.spacer} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <ScheduleVisitModal
          visible={scheduleVisitOpen}
          onClose={() => setScheduleVisitOpen(false)}
          propertyTitle={property.title}
          onSchedule={(date, time) => {
            setScheduleVisitOpen(false);
            Alert.alert(
              'Visit Scheduled',
              `Your visit to "${property.title}" has been scheduled for ${date.toLocaleDateString()} at ${time.toLocaleTimeString()}.`
            );
          }}
        />

        <Pressable
          style={styles.scheduleButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setScheduleVisitOpen(true);
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