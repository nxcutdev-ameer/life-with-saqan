import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Dimensions,
  FlatList,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { openWebUrl } from '@/utils/url';
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
  ExternalLink,
  FileText,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { mockProperties } from '@/mocks/properties';
import {
  fetchOffPlanPropertyByReference,
  fetchPropertyByReferenceResponse,
  PropertyDetailsPayload,
} from '@/utils/propertiesApi';
import {
  isOffplanApiResponsePayload,
  mapOffplanPayloadToDetails,
  normalizeOffplanDetails,
  type OffplanDetails,
} from '@/utils/offplanMapper';
import type { Property, TransactionType, PropertyType, LifestyleType } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useEngagementStore } from '@/stores/engagementStore';
import { usePropertyLikeStore } from '@/stores/propertyLikeStore';
import ScheduleVisitModal from '@/components/ScheduleVisitModal';
import { SavingSpinner } from '@/components/SavingSpinner';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PropertyDetailScreen() {
  const router = useRouter();
  // Route param is treated as the property reference.
  const { id, videoId, mode } = useLocalSearchParams<{
    id?: string | string[];
    videoId?: string | string[];
    mode?: string | string[];
  }>();
  const propertyReference = Array.isArray(id) ? id[0] : id;
  const videoIdParam = Array.isArray(videoId) ? videoId[0] : videoId;
  const modeParam = Array.isArray(mode) ? mode[0] : mode;
  const isOffplanMode = (modeParam || '').toLowerCase() === 'offplan';
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
  const [offplanDetails, setOffplanDetails] = useState<OffplanDetails | null>(null);

  const mapApiPayloadToProperty = (payload: PropertyDetailsPayload, videoIdOverride?: string): Property => {
    const parseNum = (value: unknown, fallback = 0) => {
      const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
      return Number.isFinite(n) ? n : fallback;
    };

    const weekPrice = parseNum(payload.meta?.week_price, 0);
    const monthPrice = parseNum(payload.meta?.month_price, 0);
    const yearPrice = parseNum(payload.meta?.year_price, 0);
    const salePrice = parseNum(payload.meta?.sale_price, 0);

    const hasPeriodPricing = Boolean(weekPrice || monthPrice || yearPrice);

    // Sometimes backend omits `type`. Infer it from available pricing fields.
    const backendType = (payload.type ?? '').toLowerCase();
    const inferredListingType: TransactionType = backendType === 'rent'
      ? 'RENT'
      : backendType === 'stay'
        ? 'STAY'
        : backendType === 'sale'
          ? 'BUY'
          : backendType
            ? 'BUY'
            : hasPeriodPricing
              ? 'RENT'
              : 'BUY';

    const listingType = inferredListingType;

    const pricing = (payload.default_pricing ?? '').toLowerCase();

    const periodPrices = hasPeriodPricing
      ? {
          week: weekPrice || undefined,
          month: monthPrice || undefined,
          year: yearPrice || undefined,
        }
      : undefined;

    // Main `price` used by existing UI is set to the most relevant period.
    let price = 0;
    if (listingType === 'BUY') {
      price = salePrice;
    } else {
      if (pricing === 'week') price = weekPrice;
      else if (pricing === 'year') price = yearPrice;
      else if (pricing === 'month') price = monthPrice;
      else {
        // No default pricing: prefer month, then year, then week.
        price = monthPrice || yearPrice || weekPrice;
      }
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
    // Filter out video from images list if needed
    const images = mediaUrls.filter((u) => !u.endsWith('.mp4'));

    return {
      id: videoIdOverride || payload.reference_id,
      propertyReference: payload.reference_id,
      title: payload.title ?? 'Untitled property',
      description: payload.description ?? '',
      defaultPricing: payload.default_pricing ?? undefined,
      periodPrices,
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
        phone: payload.agent?.phone ?? '',
        email: payload.agent?.email ?? '',
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
        const cacheKey = isOffplanMode
          ? `@property_cache_offplan_${propertyReference}`
          : `@property_cache_ready_${propertyReference}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (isOffplanMode) setOffplanDetails(normalizeOffplanDetails(parsed));
          else setProperty(parsed);
        }
      } catch {
        // ignore
      }

      // 2) Fetch the latest from API
      try {
        setLoading(true);

        const response = isOffplanMode
          ? await fetchOffPlanPropertyByReference(propertyReference, { timeoutMs: 15000 })
          : await fetchPropertyByReferenceResponse(propertyReference, { timeoutMs: 15000 });

        if (!response.success) {
          throw new Error(response.message || 'Property not found');
        }

        const payload = response.payload as any;

        if (isOffplanMode && isOffplanApiResponsePayload(payload)) {
          const rawDetails = mapOffplanPayloadToDetails(payload);
          const details = normalizeOffplanDetails(rawDetails) ?? rawDetails;
          setOffplanDetails(details);
          setActivePaymentPlanId(details.paymentPlans[0]?.id ?? null);

          const cacheKey = `@property_cache_offplan_${propertyReference}`;
          await AsyncStorage.setItem(cacheKey, JSON.stringify(details));
        } else {
          const mapped = mapApiPayloadToProperty(payload as PropertyDetailsPayload, videoIdParam);
          setProperty(mapped);

          const cacheKey = `@property_cache_ready_${propertyReference}`;
          await AsyncStorage.setItem(cacheKey, JSON.stringify(mapped));
        }
      } catch (e: any) {
        setLoadError(e?.message ?? 'Failed to load property');
      } finally {
        setLoading(false);
      }
    })();
  }, [propertyReference, videoIdParam, isOffplanMode]);

  const { hydrated: videoLikesHydrated, hydrate: hydrateVideoLikes, toggleLike: toggleVideoLike } = useEngagementStore();
  const {
    hydrated: propertyLikesHydrated,
    hydrate: hydratePropertyLikes,
    toggleLike: togglePropertyLike,
  } = usePropertyLikeStore();

  // Primary likes are tracked against *public video ids* (see engagementStore + /videos/:id/like endpoint).
  // Fallback likes are tracked against `propertyReference` for entry points that don't have a video id.
  const likeVideoId = videoIdParam ? String(videoIdParam) : property?.id ? String(property.id) : null;
  const likePropertyRef = (propertyReference ?? '').trim() || null;

  const isVideoLiked = useEngagementStore((s) => (likeVideoId ? s.isLiked(likeVideoId) : false));
  const isPropertyLiked = usePropertyLikeStore((s) => (likePropertyRef ? s.isLiked(likePropertyRef) : false));
  const isLiked = likeVideoId ? isVideoLiked : isPropertyLiked;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [scheduleVisitOpen, setScheduleVisitOpen] = useState(false);
  const [unitsExpanded, setUnitsExpanded] = useState(false);
  const [unitsSectionY, setUnitsSectionY] = useState(0);
  const [activePaymentPlanId, setActivePaymentPlanId] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const flatListRef = useRef<FlatList<string>>(null);

  const isVideoUrl = useCallback((url: string) => {
    const u = (url ?? '').toLowerCase();
    return u.endsWith('.mp4') || u.includes('video');
  }, []);

  const allMedia = useMemo(() => {
    if (isOffplanMode) {
      return offplanDetails?.images ?? [];
    }

    if (!property) return [] as string[];
    return [...(property.videoUrl ? [property.videoUrl] : []), ...(property.images ?? [])];
  }, [isOffplanMode, offplanDetails, property]);

  const hasMedia = allMedia.length > 0;

  // Prefetch current/adjacent images so swiping feels instant.
  useEffect(() => {
    if (!hasMedia) return;

    const candidates = [
      allMedia[currentImageIndex],
      allMedia[currentImageIndex + 1],
      allMedia[currentImageIndex - 1],
      allMedia[currentImageIndex + 2],
    ].filter((u): u is string => typeof u === 'string' && u.length > 0 && !isVideoUrl(u));

    Image.prefetch(candidates);
  }, [allMedia, currentImageIndex, hasMedia, isVideoUrl]);

  const renderMediaItem = useCallback(
    ({ item }: { item: string }) => {
      if (isVideoUrl(item)) {
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
          <Image
            source={{ uri: item }}
            style={styles.image}
            contentFit="cover"
            transition={150}
            cachePolicy="disk"
            recyclingKey={item}
          />
        </View>
      );
    },
    [isVideoUrl]
  );

  React.useEffect(() => {
    if (!videoLikesHydrated) hydrateVideoLikes();
  }, [hydrateVideoLikes, videoLikesHydrated]);

  React.useEffect(() => {
    if (!propertyLikesHydrated) hydratePropertyLikes();
  }, [hydratePropertyLikes, propertyLikesHydrated]);

  const toggleLike = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Prefer video likes (persisted + synced). Fallback to local propertyReference likes.
    if (likeVideoId) {
      try {
        const res = await toggleVideoLike(likeVideoId);
        void res;
      } catch {
        // ignore
      }
      return;
    }

    if (likePropertyRef) {
      try {
        await togglePropertyLike(likePropertyRef);
      } catch {
        // ignore
      }
    }
  };

  if (!property && !(isOffplanMode && offplanDetails)) {
    return (
      <View style={styles.errorContainer}>
        {loading ? (
             <SavingSpinner size={40} color={Colors.bronze} accessibilityLabel="Loading..." />
        ) : (
          <Text style={styles.errorText}>Property not found</Text>
        )}
        {/* <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable> */}
      </View>
    );
  }

  const agentPhoneRaw = property?.agent?.phone ?? '+971501234567';

  const getInitials = (name: string) => {
    const cleaned = (name ?? '').trim();
    if (!cleaned) return 'A';
    const parts = cleaned.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? parts[1]?.[0] ?? '' : '';
    const initials = `${first}${second}`.toUpperCase();
    return initials || 'A';
  };

  const agentDisplayName = (property?.agent?.name || property?.agentName || 'Agent').trim() || 'Agent';
  const agentAvatarUrl = (property?.agent?.photo || property?.agentPhoto || '').trim();
  const agentInitials = getInitials(agentDisplayName);

  const agentEmail =
    property?.agent?.email ?? `${agentDisplayName.toLowerCase().replace(/\s+/g, '.')}@saqan.com`;

  const agentPhoneDigits = agentPhoneRaw.replace(/[^0-9]/g, '');

  const showMultiPeriodPricing = Boolean(
    property &&
      !property.type &&
      property.periodPrices &&
      (property.periodPrices.week || property.periodPrices.month || property.periodPrices.year)
  );

  const openPhone = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const telUrl = `tel:${agentPhoneRaw}`;
    if (await Linking.canOpenURL(telUrl)) {
      await Linking.openURL(telUrl);
    }
  };

  const openWhatsApp = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const text = `Hi, I'm interested in ${property?.title ?? offplanDetails?.title ?? 'this property'}`;
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

    const subject = encodeURIComponent(`Inquiry about ${property?.title ?? offplanDetails?.title ?? 'a property'}`);
    const body = encodeURIComponent(
      `Hi ${agentDisplayName},\n\nI'm interested in ${property?.title ?? offplanDetails?.title ?? 'this property'}. Could you share more details?\n\nThanks!`
    );

    const mailtoUrl = `mailto:${agentEmail}?subject=${subject}&body=${body}`;
    if (await Linking.canOpenURL(mailtoUrl)) {
      await Linking.openURL(mailtoUrl);
    }
  };

  const developerPhoneRaw = (offplanDetails?.developerContact?.phone ?? '').trim();
  const developerPhoneDigits = developerPhoneRaw.replace(/[^0-9]/g, '');
  const developerWebsite = (offplanDetails?.developerContact?.website ?? offplanDetails?.developerWebsite ?? '').trim();
  const showOffplanFooter = Boolean(isOffplanMode && developerPhoneDigits);
  const showFooter = isOffplanMode ? showOffplanFooter : true;

  const openDeveloperPhone = async () => {
    if (!developerPhoneRaw) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const telUrl = `tel:${developerPhoneRaw}`;
      if (!(await Linking.canOpenURL(telUrl))) {
        Alert.alert('Unable to call', 'Calling is not supported on this device.');
        return;
      }
      await Linking.openURL(telUrl);
    } catch {
      Alert.alert('Unable to call', 'Please try again later.');
    }
  };

  const openDeveloperWhatsApp = async () => {
    if (!developerPhoneDigits) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const text = `Hi, I'm interested in ${offplanDetails?.title ?? 'this project'}`;
    const encodedText = encodeURIComponent(text);

    const appUrl = `whatsapp://send?phone=${developerPhoneDigits}&text=${encodedText}`;
    const webUrl = `https://wa.me/${developerPhoneDigits}?text=${encodedText}`;

    try {
      if (await Linking.canOpenURL(appUrl)) {
        await Linking.openURL(appUrl);
        return;
      }
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert('WhatsApp not available', 'Please install WhatsApp to contact the developer.');
    }
  };

  const scrollToImage = (index: number) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setCurrentImageIndex(index);
  };

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollViewRef} style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
              keyExtractor={(item, index) => `${index}-${item}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              removeClippedSubviews
              initialNumToRender={1}
              maxToRenderPerBatch={2}
              windowSize={3}
              onScroll={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setCurrentImageIndex(index);
              }}
              scrollEventThrottle={16}
              getItemLayout={(_, index) => ({
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
          {isOffplanMode && offplanDetails ? (
            <>
              <View style={styles.headerSection}>
                <View style={styles.headerLeft}>
                  <Text style={styles.propertyTitle}>{offplanDetails.title}</Text>
                  <View style={styles.locationRow}>
                    <MapPin size={scaleWidth(14)} color={Colors.textSecondary} />
                    <Text style={styles.locationText}>{offplanDetails.locationLabel}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.offplanSummaryCard}>
                <View style={styles.offplanRow}>
                  <Text style={styles.offplanLabel}>Price</Text>
                  <Text style={styles.offplanValue}>{offplanDetails.priceRangeLabel}</Text>
                </View>
                <View style={styles.offplanDivider} />
                <View style={styles.offplanRow}>
                  <Text style={styles.offplanLabel}>Developer</Text>
                  <Text style={styles.offplanValue}>{offplanDetails.developerName}</Text>
                </View>
                {offplanDetails.developerWebsite ? (
                  <>
                    <View style={styles.offplanDivider} />
                    <Pressable
                      onPress={() => openWebUrl(offplanDetails.developerWebsite!)}
                      style={styles.offplanRow}
                    >
                      <Text style={styles.offplanLabel}>Developer website</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scaleWidth(6) }}>
                        <Text style={styles.offplanValue}>Open</Text>
                        <ExternalLink size={scaleWidth(14)} color={Colors.textSecondary} />
                      </View>
                    </Pressable>
                  </>
                ) : null}
                <View style={styles.offplanDivider} />
                <View style={styles.offplanRow}>
                  <Text style={styles.offplanLabel}>Delivery date</Text>
                  <Text style={styles.offplanValue}>{offplanDetails.deliveryDateLabel}</Text>
                </View>
                <View style={styles.offplanDivider} />
                <View style={styles.offplanRow}>
                  <Text style={styles.offplanLabel}>Reference ID</Text>
                  <Text style={styles.offplanValue}>{offplanDetails.referenceId}</Text>
                </View>
                <View style={styles.offplanDivider} />
                <View style={styles.offplanRow}>
                  <Text style={styles.offplanLabel}>Location</Text>
                  <Text style={styles.offplanValue}>{offplanDetails.locationLabel}</Text>
                </View>
              </View>

            </>
          ) : (
            <>
              <View style={styles.headerSection}>
                <View style={styles.headerLeft}>
                  <Text style={styles.propertyTitle}>{property?.title}</Text>
                  <View style={styles.locationRow}>
                    <MapPin size={scaleWidth(14)} color={Colors.textSecondary} />
                    <Text style={styles.locationText}>
                      {property?.location.area}, {property?.location.city}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.priceCard}>
                <View style={{ flex: 1, gap: scaleHeight(6) }}>
                  {/* If backend `type` is missing but period pricing exists, show all */}
                  {!property?.type && property?.periodPrices && (property.periodPrices.week || property.periodPrices.month || property.periodPrices.year) ? (
                    <>
                      {property.periodPrices.week ? (
                        <Text style={styles.priceSubLine}>
                          {property.currency} {property.periodPrices.week.toLocaleString()}/week
                        </Text>
                      ) : null}
                      {property.periodPrices.month ? (
                        <Text style={styles.priceSubLine}>
                          {property.currency} {property.periodPrices.month.toLocaleString()}/month
                        </Text>
                      ) : null}
                      {property.periodPrices.year ? (
                        <Text style={styles.priceSubLine}>
                          {property.currency} {property.periodPrices.year.toLocaleString()}/year
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text style={styles.price}>
                      {property?.currency} {property?.price.toLocaleString()}
                      {property?.defaultPricing
                        ? `/${property?.defaultPricing}`
                        : property?.listingType === 'RENT'
                          ? '/year'
                          : ''}
                    </Text>
                  )}
                </View>

                {showMultiPeriodPricing ? null : (
                  <View style={styles.listingTypeBadge}>
                    <Text style={styles.listingTypeText}>{property?.listingType}</Text>
                  </View>
                )}
              </View>

              <View style={styles.keyDetailsCard}>
                <View style={styles.detailItem}>
                  <Bed size={scaleWidth(28)} color={Colors.bronze} />
                  <Text style={styles.detailLabel}>Bedrooms</Text>
                  <Text style={styles.detailValue}>{property?.bedrooms}</Text>
                </View>
                <View style={styles.detailDivider} />
                <View style={styles.detailItem}>
                  <Bath size={scaleWidth(28)} color={Colors.bronze} />
                  <Text style={styles.detailLabel}>Bathrooms</Text>
                  <Text style={styles.detailValue}>{property?.bathrooms}</Text>
                </View>
                <View style={styles.detailDivider} />
                <View style={styles.detailItem}>
                  <Maximize size={scaleWidth(28)} color={Colors.bronze} />
                  <Text style={styles.detailLabel}>Size</Text>
                  <Text style={styles.detailValue}>{property?.sizeSqft.toLocaleString()} sqft</Text>
                </View>
              </View>
            </>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>
              {isOffplanMode && offplanDetails ? offplanDetails.description : property?.description}
            </Text>
          </View>

          {isOffplanMode && offplanDetails ? (
            <>
              {(offplanDetails.amenities?.length ?? 0) > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Amenities</Text>
                  <View style={styles.amenitiesGrid}>
                    {(offplanDetails.amenities ?? []).map((amenity, index) => (
                      <View key={`${amenity}-${index}`} style={styles.amenityChip}>
                        <Text style={styles.amenityText}>{amenity}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {(offplanDetails.units?.length ?? 0) > 0 ? (
                <View
                  style={styles.section}
                  onLayout={(e) => setUnitsSectionY(e.nativeEvent.layout.y)}
                >
                  <Text style={styles.sectionTitle}>Units</Text>
                  <View style={{ gap: scaleHeight(12) }}>
                    {(unitsExpanded ? (offplanDetails.units ?? []) : (offplanDetails.units ?? []).slice(0, 12)).map((u) => (
                      <View key={u.id} style={styles.unitCard}>
                        <View style={styles.unitHeaderRow}>
                          <Text style={styles.unitTitle}>{u.label}</Text>
                          <Text style={styles.unitPrice}>{u.priceLabel}</Text>
                        </View>
                        <View style={styles.unitMetaRow}>
                          {u.sizeLabel ? <Text style={styles.unitMetaText}>{u.sizeLabel}</Text> : null}
                          {u.metaLabel ? <Text style={styles.unitMetaText}>{u.metaLabel}</Text> : null}
                        </View>
                      </View>
                    ))}

                    {(offplanDetails.units?.length ?? 0) > 12 ? (
                      <Pressable
                        onPress={() => {
                          if (unitsExpanded) {
                            setUnitsExpanded(false);
                            requestAnimationFrame(() => {
                              scrollViewRef.current?.scrollTo({ y: unitsSectionY, animated: true });
                            });
                          } else {
                            setUnitsExpanded(true);
                          }
                        }}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        <Text style={[styles.helperText, { color: Colors.bronze, fontWeight: '700' }]}>
                          {unitsExpanded ? 'Show less' : `Show all (${offplanDetails.units?.length ?? 0})`}
                        </Text>
                        {!unitsExpanded ? (
                          <Text style={styles.helperText}>Showing 12 of {offplanDetails.units?.length ?? 0} units</Text>
                        ) : null}
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {offplanDetails.paymentPlans.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Payment plans</Text>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
                    {offplanDetails.paymentPlans.map((plan) => {
                      const active = (activePaymentPlanId ?? offplanDetails.paymentPlans[0]?.id) === plan.id;
                      return (
                        <Pressable
                          key={plan.id}
                          onPress={() => setActivePaymentPlanId(plan.id)}
                          style={[styles.tabChip, active && styles.tabChipActive]}
                        >
                          <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                            {plan.title}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {(() => {
                    const selectedId = activePaymentPlanId ?? offplanDetails.paymentPlans[0]?.id;
                    const activePlan = offplanDetails.paymentPlans.find((p) => p.id === selectedId) ?? offplanDetails.paymentPlans[0];
                    if (!activePlan) return null;

                    return (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: scaleHeight(12) }}>
                        <View style={styles.phaseRow}>
                          {activePlan.phases.map((ph, idx) => (
                            <React.Fragment key={ph.id}>
                              <View style={styles.phaseBox}>
                                <Text style={styles.phaseValue}>{ph.value}</Text>
                                <Text style={styles.phaseLabel}>{ph.label}</Text>
                              </View>
                              {idx < activePlan.phases.length - 1 ? (
                                <View style={styles.phaseArrowWrap}>
                                  <Text style={styles.phaseArrowText}>→</Text>
                                </View>
                              ) : null}
                            </React.Fragment>
                          ))}
                        </View>
                      </ScrollView>
                    );
                  })()}
                </View>
              ) : null}

              {offplanDetails.attachments.length > 0 ? (
                <View style={styles.section}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>Files</Text>
                  </View>

                  <View style={{ gap: scaleHeight(10) }}>
                    {offplanDetails.attachments.map((att) => (
                      <View key={att.id} style={styles.attachmentRow}>
                        <View style={styles.attachmentLeft}>
                          <FileText size={16} color={Colors.bronze} />
                          <Text style={styles.attachmentText} numberOfLines={1}>
                            {att.name}
                          </Text>
                        </View>

                        <Pressable
                          onPress={() => {
                            router.push({
                              pathname: '/pdf-viewer' as any,
                              params: { url: att.url, title: att.name },
                            });
                          }}
                          style={styles.attachmentButton}
                        >
                          <Text style={styles.attachmentButtonText}>View{" "}
                          <ExternalLink size={scaleWidth(12)} color={Colors.bronze} />
                          </Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

        
            </>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.amenitiesGrid}>
                {(property?.amenities ?? []).map((amenity: string, index: number) => (
                  <View key={index} style={styles.amenityChip}>
                    <Text style={styles.amenityText}>{amenity}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

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

          {!isOffplanMode ? (
          <View style={styles.agentCard}>
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
          ) : null}

          {showFooter ? <View style={styles.spacer} /> : null}
        </View>
      </ScrollView>

      {showFooter ? <View style={styles.footer}>
        {isOffplanMode ? (
          <>
            <Pressable
              style={[styles.scheduleButton, { flex: 1 }]}
              onPress={openDeveloperPhone}
              disabled={!developerPhoneRaw}
            >
              <Phone size={scaleWidth(20)} color={Colors.textLight} />
              <Text style={styles.scheduleButtonText} numberOfLines={1}>
                Call Agent
              </Text>
            </Pressable>

            <View style={styles.contactButtons}>
              <Pressable
                style={[styles.contactIconButton, !developerPhoneDigits && { opacity: 0.4 }]}
                onPress={openDeveloperWhatsApp}
                disabled={!developerPhoneDigits}
              >
                <MessageCircle size={scaleWidth(20)} color={Colors.bronze} />
              </Pressable>

              {developerWebsite ? (
                <Pressable style={styles.contactIconButton} onPress={() => openWebUrl(developerWebsite)}>
                  <ExternalLink size={scaleWidth(20)} color={Colors.bronze} />
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <ScheduleVisitModal
              visible={scheduleVisitOpen}
              onClose={() => setScheduleVisitOpen(false)}
              propertyTitle={property?.title ?? ''}
              onSchedule={(date, time) => {
                setScheduleVisitOpen(false);
                Alert.alert(
                  'Visit Scheduled',
                  `Your visit to "${property?.title ?? ''}" has been scheduled for ${date.toLocaleDateString()} at ${time.toLocaleTimeString()}.`
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
              <Pressable style={styles.contactIconButton} onPress={openPhone}>
                <Phone size={scaleWidth(20)} color={Colors.bronze} />
              </Pressable>
              <Pressable style={styles.contactIconButton} onPress={openWhatsApp}>
                <MessageCircle size={scaleWidth(20)} color={Colors.bronze} />
              </Pressable>
              <Pressable style={styles.contactIconButton} onPress={openEmail}>
                <Mail size={scaleWidth(20)} color={Colors.bronze} />
              </Pressable>
            </View>
          </>
        )}
      </View> : null}
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
  priceSubLine: {
    fontSize: scaleFont(14),
    fontWeight: '600',
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
  offplanSummaryCard: {
    backgroundColor: Colors.textLight,
    padding: scaleWidth(20),
    borderRadius: scaleWidth(16),
    marginBottom: scaleHeight(20),
    borderWidth: 1,
    borderColor: Colors.border,
  },
  offplanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scaleWidth(12),
  },
  offplanLabel: {
    fontSize: scaleFont(14),
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  offplanValue: {
    flex: 1,
    textAlign: 'right' as const,
    fontSize: scaleFont(12),
    color: Colors.text,
    fontWeight: '600',
  },
  offplanDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: scaleHeight(12),
  },
  unitCard: {
    backgroundColor: Colors.textLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: scaleWidth(12),
    padding: scaleWidth(14),
  },
  unitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: scaleWidth(10),
  },
  unitTitle: {
    flex: 1,
    fontSize: scaleFont(14),
    fontWeight: '700',
    color: Colors.text,
  },
  unitPrice: {
    fontSize: scaleFont(14),
    fontWeight: '700',
    color: Colors.bronze,
  },
  unitMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scaleWidth(10),
    marginTop: scaleHeight(8),
  },
  unitMetaText: {
    fontSize: scaleFont(12),
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  helperText: {
    marginTop: scaleHeight(8),
    fontSize: scaleFont(12),
    color: Colors.textSecondary,
  },
  tabBar: {
    flexDirection: 'row',
    gap: scaleWidth(10),
    paddingVertical: scaleHeight(4),
  },
  tabChip: {
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(14),
    borderRadius: scaleWidth(999),
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.textLight,
    marginRight:scaleWidth(14),
  },
  tabChipActive: {
    borderColor: Colors.bronze,
    backgroundColor: 'rgba(183, 138, 59, 0.12)',
  },
  tabText: {
    fontSize: scaleFont(12),
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.bronze,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flexWrap: 'nowrap',
  },
  phaseBox: {
    width: scaleWidth(120),
    borderRadius: scaleWidth(12),
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.textLight,
    padding: scaleWidth(12),
  },
  phaseValue: {
    fontSize: scaleFont(18),
    fontWeight: '800',
    color: Colors.bronze,
  },
  phaseLabel: {
    marginTop: scaleHeight(6),
    fontSize: scaleFont(12),
    color: Colors.text,
    fontWeight: '600',
  },
  phaseArrowWrap: {
    width: scaleWidth(26),
    justifyContent: 'center',
    alignItems: 'center',
  },
  phaseArrowText: {
    fontSize: scaleFont(18),
    color: Colors.textSecondary,
    fontWeight: '900',
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
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scaleWidth(10),
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scaleWidth(12),
    paddingVertical: scaleHeight(12),
    paddingHorizontal: scaleWidth(14),
    borderRadius: scaleWidth(12),
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.textLight,
  },
  attachmentLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(10),
  },
  attachmentText: {
    flex: 1,
    fontSize: scaleFont(13),
    fontWeight: '600',
    color: Colors.text,
  },
  attachmentButton: {
    paddingVertical: scaleHeight(8),
    paddingHorizontal: scaleWidth(14),
    borderRadius: scaleWidth(999),
    borderWidth: 1,
    borderColor: Colors.bronze,
    backgroundColor: 'rgba(183, 138, 59, 0.10)',
  },
  attachmentButtonText: {
    fontSize: scaleFont(12),
    fontWeight: '600',
    color: Colors.bronze,
  },
  developerCard: {
    backgroundColor: Colors.textLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: scaleWidth(16),
    padding: scaleWidth(16),
    gap: scaleHeight(12),
  },
  developerNameText: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: Colors.text,
  },
  developerButtonsRow: {
    flexDirection: 'row',
    gap: scaleWidth(12),
  },
  developerMetaText: {
    fontSize: scaleFont(12),
    color: Colors.textSecondary,
    fontWeight: '600',
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
    height: scaleHeight(120),
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
    marginTop:scaleHeight(14),
  },
  backButtonText: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: Colors.textLight,
  },
});