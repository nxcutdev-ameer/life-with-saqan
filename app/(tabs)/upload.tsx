import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Share,
  Modal,
  FlatList,
  Keyboard,
  useWindowDimensions,
  Image,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { VideoScrubber } from '@/components/VideoScrubber';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video } from 'expo-av';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import {
  Camera,
  Image as ImageIcon,
  Video as VideoIcon,
  X,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Utensils,
  Sofa,
  Bed,
  Bath,
  Eye,
  Sun,
  Mountain,
  Check,
} from 'lucide-react-native';
import { uploadGenericVideo, uploadVideoWithProperty } from '@/utils/videosApi';
import { Colors } from '@/constants/colors';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { PropertyType, TransactionType } from '@/types';
import * as ImagePicker from 'expo-image-picker';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useUiLockStore } from '@/stores/uiLockStore';
import { useAuthStore } from '@/stores/authStore';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  Amenity,
  Area,
  Building,
  District,
  Emirate,
  OffPlanProjectListItem,
  attachPropertyMedia,
  createDraftProperty,
  fetchAmenities,
  fetchAreas,
  fetchBuildings,
  fetchDistricts,
  fetchEmirates,
  fetchOffPlanProjects,
  unAttachPropertyMedia,
  updateProperty,
  uploadMedia,
} from '@/utils/propertiesApi';

type HighlightStep = string;
const DEFAULT_HIGHLIGHT_OPTIONS = ['Kitchen', 'Living room', 'Bedroom', 'Bathroom'] as const;

export default function UploadScreen() { 
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const navigation = useNavigation();
  const setUploadLocked = useUiLockStore((s) => s.setUploadLocked);
  const shouldResetOnNextFocus = React.useRef(false);
  const wasHighlightsPlayingRef = React.useRef(false);
  const isHighlightsScrubbingRef = React.useRef(false);
  const pendingSeekSecRef = React.useRef(0);
  const [step, setStep] = useState<'select' | 'edit' | 'selectHighlights' | 'details'>('select');

  type DetailsFlow =
    | 'status'
    | 'ready_step_1'
    | 'ready_step_2'
    | 'ready_step_3'
    | 'ready_step_4'
    | 'offplan_project'
    | 'generic_publish';
  const [detailsFlow, setDetailsFlow] = useState<DetailsFlow>('status');
  const [isAdvancingFlow, setIsAdvancingFlow] = useState(false);

  const flowAnimOpacity = React.useRef(new Animated.Value(1)).current;
  const flowAnimTranslateX = React.useRef(new Animated.Value(0)).current;

  const animateToFlow = React.useCallback(
    async (next: DetailsFlow, direction: 'forward' | 'back' = 'forward') => {
      const distance = 28;

      // Fade out + slight slide opposite direction
      await new Promise<void>((resolve) => {
        Animated.parallel([
          Animated.timing(flowAnimOpacity, {
            toValue: 0,
            duration: 140,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(flowAnimTranslateX, {
            // fade + slide to the right
            toValue: direction === 'forward' ? distance : -distance,
            duration: 140,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => resolve());
      });

      setDetailsFlow(next);

      // Prepare next view offscreen to the right (forward) or left (back)
      flowAnimTranslateX.setValue(direction === 'forward' ? distance : -distance);

      // Fade in + slide into place
      await new Promise<void>((resolve) => {
        Animated.parallel([
          Animated.timing(flowAnimOpacity, {
            toValue: 1,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(flowAnimTranslateX, {
            toValue: 0,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => resolve());
      });
    },
    [flowAnimOpacity, flowAnimTranslateX]
  );

  useEffect(() => {
    // avoid accidental navigation back to previous screens (e.g. Lifestyle)
    navigation.setOptions({ gestureEnabled: false } as any);

    // Lock tab switching only during highlight picking.
    setUploadLocked(step === 'selectHighlights');

    return () => {
      setUploadLocked(false);
    };
  }, [navigation, setUploadLocked, step]);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sessionTokens = useAuthStore((s) => s.session?.tokens) ?? null;
  const { canPost, tier, postsUsed, postsLimit, refreshSubscription } = useSubscription();
  
  // lightweight toast UI (will be used for save/update feedback)
  const [toast, setToast] = useState<{ visible: boolean; message: string }>(
    { visible: false, message: '' }
  );
  const showToast = (message: string) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), 1200);
  };

  const [, setIsSavingProperty] = useState(false);
  const [, setLastSavedAt] = useState<number | null>(null);
  const [, setSaveError] = useState<string | null>(null);
  const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [overlayTextSize, setOverlayTextSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [overlayTextColor, setOverlayTextColor] = useState<'white' | 'black' | 'yellow'>('white');
  const [overlayTextPosition, setOverlayTextPosition] = useState<'top' | 'center' | 'bottom'>('center');
  const [showShareModal, setShowShareModal] = useState(false);

  type HighlightOption = (typeof DEFAULT_HIGHLIGHT_OPTIONS)[number];

  const [highlightSteps, setHighlightSteps] = useState<HighlightStep[]>([...DEFAULT_HIGHLIGHT_OPTIONS]);
  const [activeHighlightStepIndex, setActiveHighlightStepIndex] = useState(0);
  const [highlightsByRoom, setHighlightsByRoom] = useState<Partial<Record<HighlightStep, number>>>({});
  const [highlightTimestamps, setHighlightTimestamps] = useState<
    { room: string; start_time: number; end_time: number }[]
  >([]);

  const [showAddHighlightModal, setShowAddHighlightModal] = useState(false);

  const { height: windowHeight } = useWindowDimensions();

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const videoRef = React.useRef<Video>(null);
  const [videoCurrentTimeSec, setVideoCurrentTimeSec] = useState(0);
  const [videoDurationSec, setVideoDurationSec] = useState(0);
  const [isHighlightsPlaying, setIsHighlightsPlaying] = useState(false);
  const [isHighlightsMuted, setIsHighlightsMuted] = useState(false);
  const [isHighlightsVideoLoaded, setIsHighlightsVideoLoaded] = useState(false);

  // Property Location dropdown state
  const [locationPicker, setLocationPicker] = useState<
    null | 'emirate' | 'district' | 'building' | 'area'
  >(null);
  const [emirateSearch, setEmirateSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');

  useEffect(() => {
    // Ensure location picker can only be used on ready_step_3.
    if (detailsFlow !== 'ready_step_3' && locationPicker !== null) {
      setLocationPicker(null);
    }
  }, [detailsFlow, locationPicker]);

  const [offPlanPickerOpen, setOffPlanPickerOpen] = useState(false);
  const [offPlanSearch, setOffPlanSearch] = useState('');
  const [debouncedOffPlanSearch, setDebouncedOffPlanSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedOffPlanSearch(offPlanSearch), 300);
    return () => clearTimeout(t);
  }, [offPlanSearch]);

  const [draftPropertyReferenceId, setDraftPropertyReferenceId] = useState<string | null>(null);
  const createDraftInflightRef = React.useRef<Promise<string | null> | null>(null);

  const resetReadyPropertyFlow = async () => {
    const referenceId = draftPropertyReferenceId;
    const propertiesToken = sessionTokens?.propertiesToken;

    // Best-effort detach any attached media
    if (referenceId && propertiesToken) {
      const attachIds = selectedImages
        .map((img) => img.attachId)
        .filter((id): id is number => typeof id === 'number');

      for (const id of attachIds) {
        try {
          await unAttachPropertyMedia({ propertiesToken, referenceId, id });
        } catch {
          // ignore
        }
      }
    }

    // Reset all local state (form + UI)
    setSelectedImages([]);
    setSelectedAmenityIds([]);
    setAmenitiesSearch('');
    setAmenitiesModalVisible(false);

    setEmirateSearch('');
    setDistrictSearch('');
    setLocationSearch('');
    setLocationPicker(null);

    setOffPlanPickerOpen(false);
    setOffPlanSearch('');

    setDraftPropertyReferenceId(null);
    createDraftInflightRef.current = null;

    setPropertyDetails({
      title: '',
      price: '',
      developmentStatus: 'GENERIC' as 'READY' | 'OFF_PLAN' | 'GENERIC',
      listingType: 'RENT' as TransactionType,
      propertyType: 'apartment' as PropertyType,
      bedrooms: '',
      bathrooms: '',
      sizeSqft: '',
      isFurnished: false,
      hasParking: false,
      offPlanProjectId: null as number | null,
      offPlanProjectReferenceId: '' as string,
      offPlanProjectTitle: '',
      emirateId: null as number | null,
      emirateName: '',
      districtId: null as number | null,
      districtName: '',
      building: '',
      area: '',
      defaultPricing: 'month' as 'day' | 'week' | 'month' | 'year',
      dayPrice: '',
      weekPrice: '',
      monthPrice: '',
      yearPrice: '',
      builtYear: '',
      floor: '',
      description: '',
    });
  };

  const ensureDraftPropertyReferenceId = async (): Promise<string | null> => {
    const propertiesToken = sessionTokens?.propertiesToken;
    if (!propertiesToken) return null;
    if (propertyDetails.developmentStatus !== 'READY') return null;

    // Already have one
    if (draftPropertyReferenceId) return draftPropertyReferenceId;

    // Reuse inflight
    if (createDraftInflightRef.current) {
      return createDraftInflightRef.current;
    }

    createDraftInflightRef.current = (async () => {
      try {
        const res = await createDraftProperty({
          propertiesToken,
          type: 'sale',
          state: 'draft',
        });

        const referenceId = res?.payload?.reference_id ?? null;
        if (!res?.success || !referenceId) {
          return null;
        }

        setDraftPropertyReferenceId(referenceId);
        return referenceId;
      } catch {
        return null;
      } finally {
        createDraftInflightRef.current = null;
      }
    })();

    return createDraftInflightRef.current;
  };


  const [amenitiesModalVisible, setAmenitiesModalVisible] = useState(false);
  const [amenitiesSearch, setAmenitiesSearch] = useState('');
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<number[]>([]);

  type SelectedImage = {
    uri: string;
    uploadId?: number | null; // returned from POST /media
    attachId?: number | null; // returned from POST /properties/{ref}/media
    uploading?: boolean;
  };
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);

  const initialPropertyDetails = {
    title: '',
    price: '',
    // Determines whether to show Listing Type (Ready property) or hide it (Off plan)
    developmentStatus: 'GENERIC' as 'READY' | 'OFF_PLAN' | 'GENERIC',
    listingType: 'RENT' as TransactionType,
    propertyType: 'apartment' as PropertyType,
    bedrooms: '',
    bathrooms: '',
    sizeSqft: '',
    isFurnished: false,
    hasParking: false,

    // If OFF_PLAN, user selects an existing off-plan project.
    offPlanProjectId: null as number | null,
    offPlanProjectReferenceId: '' as string,
    offPlanProjectTitle: '',

    // Property Location (READY only)
    emirateId: null as number | null,
    emirateName: '',
    districtId: null as number | null,
    districtName: '',
    building: '',
    area: '',

    defaultPricing: 'month' as 'day' | 'week' | 'month' | 'year',
    dayPrice: '',
    weekPrice: '',
    monthPrice: '',
    yearPrice: '',
    builtYear: '',
    floor: '',

    description: '',
  };

  const [propertyDetails, setPropertyDetails] = useState(initialPropertyDetails);

  const developmentStatusLabel = React.useMemo(() => {
    switch (propertyDetails.developmentStatus) {
      case 'READY':
        return 'Ready property';
      case 'OFF_PLAN':
        return 'Off plan';
      case 'GENERIC':
        return 'Generic video';
      default:
        return '—';
    }
  }, [propertyDetails.developmentStatus]);

  const {
    data: emirates,
    isLoading: isEmiratesLoading,
    isError: isEmiratesError,
    refetch: refetchEmirates,
  } = useQuery({
    queryKey: ['properties', 'emirates', { limit: 999, size: 'mini' }],
    queryFn: fetchEmirates,
    staleTime: 1000 * 60 * 60, // 1h
    gcTime: 1000 * 60 * 60 * 24, // 24h
  });

  const emirateOptions: Emirate[] = emirates ?? [];

  const {
    data: districts,
    isLoading: isDistrictsLoading,
    isError: isDistrictsError,
    refetch: refetchDistricts,
  } = useQuery({
    queryKey: ['properties', 'districts', { emirateId: propertyDetails.emirateId, limit: 999, size: 'mini' }],
    queryFn: () => fetchDistricts(propertyDetails.emirateId as number),
    enabled: typeof propertyDetails.emirateId === 'number',
    staleTime: 1000 * 60 * 60, // 1h
    gcTime: 1000 * 60 * 60 * 24, // 24h
  });

  const districtOptions: District[] = districts ?? [];

  const propertiesToken = sessionTokens?.propertiesToken;
  const {
    data: amenities,
    isLoading: isAmenitiesLoading,
    isError: isAmenitiesError,
    refetch: refetchAmenities,
  } =  useQuery({
    queryKey: ['properties', 'amenities'],
    queryFn: () => fetchAmenities({ propertiesToken: propertiesToken as string }),
    enabled: amenitiesModalVisible && typeof propertiesToken === 'string',
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const amenitiesOptions: Amenity[] = amenities ?? [];
  const filteredAmenities = amenitiesOptions.filter((a) =>
    a.name.toLowerCase().includes(amenitiesSearch.trim().toLowerCase())
  );

  const {
    data: buildingsPages,
    isLoading: isBuildingsLoading,
    isError: isBuildingsError,
    fetchNextPage: fetchNextBuildingsPage,
    hasNextPage: hasNextBuildingsPage,
    isFetchingNextPage: isFetchingNextBuildingsPage,
    refetch: refetchBuildings,
  } = useInfiniteQuery({
    queryKey: ['properties', 'buildings'],
    enabled: locationPicker === 'building' && typeof propertiesToken === 'string',
    queryFn: async ({ pageParam }) => {
      const res = await fetchBuildings({ propertiesToken: propertiesToken as string, page: pageParam });
      if (!res.success) throw new Error(res.message || 'Failed to load buildings');
      return res.payload;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const nextUrl = lastPage.next_page_url;
      if (!nextUrl) return undefined;
      const match = nextUrl.match(/page=(\d+)/);
      return match ? Number(match[1]) : undefined;
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const buildingsOptions: Building[] = buildingsPages?.pages.flatMap((p) => p.data) ?? [];

  const {
    data: areasOptions,
    isLoading: isAreasLoading,
    isError: isAreasError,
    refetch: refetchAreas,
  } = useQuery({
    queryKey: ['properties', 'areas'],
    enabled: locationPicker === 'area' && typeof propertiesToken === 'string',
    queryFn: () => fetchAreas({ propertiesToken: propertiesToken as string, limit: 9999 }),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const selectedBuildingLabel =
    propertyDetails.building && buildingsOptions.find((b) => b.slug === propertyDetails.building)?.name;
  const selectedAreaLabel =
    propertyDetails.area && (areasOptions ?? []).find((a) => a.slug === propertyDetails.area)?.name;

  const {
    data: offPlanPages,
    isLoading: isOffPlanLoading,
    isError: isOffPlanError,
    refetch: refetchOffPlan,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'properties',
      'offplan',
      {
        view: 'list',
        order_by: 'created_at',
        size: 'xs',
        limit: 20,
        name: debouncedOffPlanSearch.trim(),
      },
    ],
    queryFn: ({ pageParam }) =>
      fetchOffPlanProjects({
        page: Number(pageParam ?? 1),
        limit: 20,
        name: debouncedOffPlanSearch.trim(),
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage) return undefined;
      if (lastPage.lastPage && lastPage.currentPage >= lastPage.lastPage) return undefined;
      return lastPage.currentPage + 1;
    },
    enabled: propertyDetails.developmentStatus === 'OFF_PLAN',
    staleTime: 1000 * 60 * 5, // 5m
    gcTime: 1000 * 60 * 60, // 1h
  });

  const offPlanOptions: OffPlanProjectListItem[] =
    offPlanPages?.pages.flatMap((p) => p.data) ?? [];



  // Draft creation for READY is deferred until user advances from Property Status.


  // Debounced update to properties.vzite.com whenever READY fields change.
  useEffect(() => {
    if (step !== 'details') return;
    if (propertyDetails.developmentStatus !== 'READY') return;

    const propertiesToken = sessionTokens?.propertiesToken;
    if (!propertiesToken) return;

    const referenceId = draftPropertyReferenceId;
    if (!referenceId) return;

    // Prepare payload.
    const amenitiesCsv = selectedAmenityIds.length ? selectedAmenityIds.join(',') : '';
    const body: Record<string, unknown> = {
      reference_id: referenceId,
      state: 'draft',
      // Listing Type -> type
      type: propertyDetails.listingType || null,
      // Pricing rules:
      //  BUY  => sale_price = Price(AED), hide default pricing/prices
      //  RENT => default_pricing = 'year', year_price = Price(AED), hide default pricing/prices, sale_price = null
      //  STAY => default_pricing = selected value, prices from day/week/month/year fields, sale_price = null
      sale_price:
        propertyDetails.listingType === 'BUY'
          ? propertyDetails.price
            ? Number(propertyDetails.price)
            : null
          : null,
      default_pricing:
        propertyDetails.listingType === 'STAY'
          ? propertyDetails.defaultPricing
          : propertyDetails.listingType === 'RENT'
            ? 'year'
            : null,
      title: propertyDetails.title || null,
      description: propertyDetails.description || null,
      emirate_id: propertyDetails.emirateId ? String(propertyDetails.emirateId) : null,
      district_id: propertyDetails.districtId ? String(propertyDetails.districtId) : null,
      building: propertyDetails.building || null,
      area: propertyDetails.area || null,
      property_type: propertyDetails.propertyType || null,
      square: propertyDetails.sizeSqft ? Number(propertyDetails.sizeSqft) : null,
      bedrooms: propertyDetails.bedrooms ? Number(propertyDetails.bedrooms) : null,
      bathrooms: propertyDetails.bathrooms ? Number(propertyDetails.bathrooms) : null,
      furnished: Boolean(propertyDetails.isFurnished),
      garage: Boolean(propertyDetails.hasParking),
      amenitites: amenitiesCsv,
      built_year: propertyDetails.builtYear ? Number(propertyDetails.builtYear) : null,
      floor: propertyDetails.floor ? Number(propertyDetails.floor) : null,
      day_price:
        propertyDetails.listingType === 'STAY' && propertyDetails.dayPrice
          ? Number(propertyDetails.dayPrice)
          : null,
      week_price:
        propertyDetails.listingType === 'STAY' && propertyDetails.weekPrice
          ? Number(propertyDetails.weekPrice)
          : null,
      month_price:
        propertyDetails.listingType === 'STAY' && propertyDetails.monthPrice
          ? Number(propertyDetails.monthPrice)
          : null,
      year_price:
        propertyDetails.listingType === 'RENT'
          ? propertyDetails.price
            ? Number(propertyDetails.price)
            : null
          : propertyDetails.listingType === 'STAY' && propertyDetails.yearPrice
            ? Number(propertyDetails.yearPrice)
            : null,
    };

    // Debounce save.
    const timeout = setTimeout(async () => {
      try {
        setIsSavingProperty(true);
        setSaveError(null);
        const res = await updateProperty({
          propertiesToken,
          referenceId,
          body,
        });

        if (!res?.success) {
          const msg = res?.message || 'Failed to save changes';
          setSaveError(msg);
          showToast(msg);
          return;
        }

        setLastSavedAt(Date.now());
        showToast('Saved');
      } catch (err: any) {
        const msg = err?.message || 'Failed to save changes';
        setSaveError(msg);
        showToast(msg);
      } finally {
        setIsSavingProperty(false);
      }
    }, 900);

    return () => clearTimeout(timeout);
  }, [
    step,
    propertyDetails,
    selectedAmenityIds,
    selectedImages,
    draftPropertyReferenceId,
    sessionTokens?.propertiesToken,
  ]);

  // TODO: Replace Building/Area static lists with API endpoints when available.

  const formatTimeMmSs = (totalSeconds: number) => {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please grant camera roll permissions to upload videos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedVideoUri(result.assets[0].uri);
      setStep('edit');
    }
  };

  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please grant camera permissions to record videos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 1,
    });
    if (!result.canceled) {
      setSelectedVideoUri(result.assets[0].uri);
      setStep('edit');
    }
  };

  const DISABLE_SUBSCRIPTION_GUARD = true; // TODO: re-enable when backend subscription is ready

  const checkSubscription = () => {
    if (DISABLE_SUBSCRIPTION_GUARD) return true;

    if (!canPost) {
      if (tier === 'free') {
        Alert.alert(
          'Free Post Used',
          "You've used your 1 free post. Subscribe to post more properties!",
          [
            {
              text: 'View Plans',
              onPress: () => router.replace('/paywall')
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return false;
      } else if (tier === 'basic') {
        Alert.alert(
          'Monthly Limit Reached',
          `You've used all ${postsLimit} posts this month. Upgrade to Premium for unlimited posts!`,
          [
            {
              text: 'Upgrade to Premium',
              onPress: () => router.replace('/paywall')
            },
            {
              text: 'Buy Extra Post (15 AED)',
              onPress: () => handleBuyExtraPost()
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return false;
      }
    }
    return true;
  };

  const handleBuyExtraPost = async () => {
    Alert.alert(
      'Extra Post',
      'Mock payment of 15 AED successful! You can now post 1 more property.',
      [{
        text: 'OK',
        onPress: async () => {
          const currentMonth = new Date().toISOString().slice(0, 7);
          const current = postsUsed;
          await AsyncStorage.setItem(`@posts_used_${currentMonth}`, (current - 1).toString());
          await refreshSubscription();
        }
      }]
    );
  };

  const resetUploadFlow = React.useCallback(() => {
    // Core flow
    setStep('select');
    setDetailsFlow('status');
    setSelectedVideoUri(null);

    // Editor/UI
    setOverlayText('');
    setOverlayTextSize('medium');
    setOverlayTextColor('white');
    setOverlayTextPosition('center');

    setShowShareModal(false);
    setShowAddHighlightModal(false);

    // Save/draft state
    setIsSavingProperty(false);
    setLastSavedAt(null);
    setSaveError(null);
    setDraftPropertyReferenceId(null);

    // Highlights
    setHighlightSteps([...DEFAULT_HIGHLIGHT_OPTIONS]);
    setHighlightsByRoom({});
    setHighlightTimestamps([]);
    setActiveHighlightStepIndex(0);
    setVideoCurrentTimeSec(0);
    setVideoDurationSec(0);
    setIsHighlightsMuted(false);
    setIsHighlightsVideoLoaded(false);
    setIsHighlightsPlaying(false);

    // Pickers/modals/search
    setLocationPicker(null);
    setEmirateSearch('');
    setDistrictSearch('');
    setLocationSearch('');

    setOffPlanPickerOpen(false);
    setOffPlanSearch('');

    setAmenitiesModalVisible(false);
    setAmenitiesSearch('');
    setSelectedAmenityIds([]);
    setSelectedImages([]);

    // Toast
    setToast({ visible: false, message: '' });

    // Form fields
    setPropertyDetails({
      title: '',
      price: '',
      developmentStatus: 'READY',
      listingType: 'RENT',
      propertyType: 'apartment',
      bedrooms: '',
      bathrooms: '',
      sizeSqft: '',
      isFurnished: false,
      hasParking: false,

      emirateId: null,
      emirateName: '',
      districtId: null,
      districtName: '',
      building: '',
      area: '',

      defaultPricing: 'month',
      dayPrice: '',
      weekPrice: '',
      monthPrice: '',
      yearPrice: '',
      builtYear: '',
      floor: '',

      description: '',
      offPlanProjectId: null,
      offPlanProjectReferenceId: '',
      offPlanProjectTitle: '',
    });
  }, []);

  useEffect(() => {
    const unsubscribe = (navigation as any).addListener?.('focus', () => {
      // When user navigates away after a successful upload (e.g. View Property),
      // reset the upload screen the next time it becomes active.
      if (shouldResetOnNextFocus.current && !isPublishing) {
        shouldResetOnNextFocus.current = false;
        resetUploadFlow();
      }
    });

    return unsubscribe;
  }, [navigation, isPublishing, resetUploadFlow]);

  const toggleAmenity = (id: number) => {
    setSelectedAmenityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handlePublish = async () => {
    if (isPublishing) return;
    if (!checkSubscription()) return;

    // GENERIC: upload video + timestamps without linking to any property.
    if (propertyDetails.developmentStatus === 'GENERIC') {
      if (!selectedVideoUri) {
        Alert.alert('Missing video', 'Please record or select a video first.');
        return;
      }

      // If user never tapped “Set <room>”, fall back to whatever is stored in highlightsByRoom.
      const timestampsFromMap = Object.entries(highlightsByRoom)
        .filter(([, value]) => value != null)
        .map(([room, value]) => ({
          room,
          start_time: Math.floor(value as number),
          end_time: 0,
        }));

      const roomTimestamps = highlightTimestamps.length ? highlightTimestamps : timestampsFromMap;

      // Highlights are optional

      setIsPublishing(true);

      try {
        const saqanToken = sessionTokens?.saqancomToken;
        if (!saqanToken) {
          Alert.alert('Authentication required', 'Missing Saqan token. Please login again.');
          return;
        }

        const fileName = selectedVideoUri.split('/').pop() || 'video.mp4';
        const res = await uploadGenericVideo({
          saqancomToken: saqanToken,
          videoFile: { uri: selectedVideoUri, name: fileName, type: 'video/mp4' },
          roomTimestamps,
          uploadToCloudflare: true,
          generateSubtitles: true,
          agentId: 1,
        });

        const isSuccess =
          res?.success === true ||
          (typeof res?.message === 'string' && res.message.toLowerCase().includes('uploaded successfully')) ||
          Boolean((res as any)?.data?.video_id);

        if (isSuccess) {
          Alert.alert('Success', res?.message || 'Uploaded successfully.', [
            { text: 'OK', onPress: resetUploadFlow },
          ]);
          return;
        }

        Alert.alert('Upload failed', res?.message || 'Something went wrong.');
      } catch (err: any) {
        const body = err?.body as any;
        const message = body?.message || err?.message || 'Upload failed. Please try again.';

        const errors = body?.errors;
        if (errors && typeof errors === 'object') {
          const lines: string[] = [];
          for (const [field, msgs] of Object.entries(errors)) {
            if (Array.isArray(msgs)) lines.push(`${field}: ${msgs.join(', ')}`);
          }
          Alert.alert(message, lines.join('\n'));
          return;
        }

        Alert.alert('Upload failed', message);
      } finally {
        setIsPublishing(false);
      }

      return;
    }

    // OFF_PLAN: upload video + timestamps and link to selected project.
    if (propertyDetails.developmentStatus === 'OFF_PLAN') {
      if (!selectedVideoUri) {
        Alert.alert('Missing video', 'Please record or select a video first.');
        return;
      }
      if (!propertyDetails.offPlanProjectReferenceId) {
        Alert.alert('Missing project', 'Please select an off-plan project.');
        return;
      }

      setIsPublishing(true);

      // If user never tapped “Set <room>”, fall back to whatever is stored in highlightsByRoom.
      const timestampsFromMap = Object.entries(highlightsByRoom)
        .filter(([, value]) => value != null)
        .map(([room, value]) => ({
          room,
          start_time: Math.floor(value as number),
          end_time: 0,
        }));

      const roomTimestamps = highlightTimestamps.length ? highlightTimestamps : timestampsFromMap;

      // Highlights are optional

      try {
        const saqanToken = sessionTokens?.saqancomToken;
        if (!saqanToken) {
          Alert.alert('Authentication required', 'Missing Saqan token. Please login again.');
          return;
        }

        const fileName = selectedVideoUri.split('/').pop() || 'video.mp4';
        const res = await uploadVideoWithProperty({
          saqancomToken: saqanToken,
          videoFile: { uri: selectedVideoUri, name: fileName, type: 'video/mp4' },
          propertyReference: propertyDetails.offPlanProjectReferenceId,
          roomTimestamps,
          uploadToCloudflare: true,
          generateSubtitles: true,
          agentId: 1,
        });

        const isSuccess =
          res?.success === true ||
          (typeof res?.message === 'string' && res.message.toLowerCase().includes('uploaded successfully')) ||
          Boolean((res as any)?.data?.video_id);

        if (isSuccess) {
          Alert.alert('Success', res?.message || 'Uploaded successfully.', [
            { text: 'OK', onPress: resetUploadFlow },
          ]);
          return;
        }

        Alert.alert('Upload failed', res?.message || 'Something went wrong.');
      } catch (err: any) {
        const body = err?.body as any;
        const message =
          body?.message ||
          err?.message ||
          'Upload failed. Please try again.';

        const errors = body?.errors;
        if (errors && typeof errors === 'object') {
          const lines: string[] = [];
          for (const [field, msgs] of Object.entries(errors)) {
            if (Array.isArray(msgs)) lines.push(`${field}: ${msgs.join(', ')}`);
          }
          Alert.alert(message, lines.join('\n'));
          return;
        }

        Alert.alert('Upload failed', message);
      } finally {
        setIsPublishing(false);
      }

      return;
    }

    // READY: publish via saqan upload-with-property
    try {
      const saqanToken = sessionTokens?.saqancomToken;
      if (!saqanToken) {
        Alert.alert('Authentication required', 'Missing Saqan token. Please login again.');
        return;
      }

      if (!selectedVideoUri) {
        Alert.alert('Video required', 'Please select or record a video first.');
        return;
      }

      // Highlights are optional

      let propertyReference = draftPropertyReferenceId;
      if (!propertyReference) {
        // Ensure draft is created before uploading.
        propertyReference = await ensureDraftPropertyReferenceId();
      }
      if (!propertyReference) {
        Alert.alert('Property not ready', 'Draft property reference is missing. Please wait a moment and try again.');
        return;
      }

      if (!propertyDetails.title.trim()) {
        Alert.alert('Missing title', 'Please enter a title.');
        return;
      }
      if (!propertyDetails.bedrooms.trim() || !propertyDetails.bathrooms.trim()) {
        Alert.alert('Missing details', 'Please enter bedrooms and bathrooms.');
        return;
      }
      if (!propertyDetails.emirateId || !propertyDetails.districtId) {
        Alert.alert('Missing location', 'Please select Emirate and District.');
        return;
      }

      setIsPublishing(true);
      showToast('Uploading...');

      const roomTimestamps = highlightTimestamps.map((t) => ({
        room: t.room,
        start_time: t.start_time,
        end_time: 0,
      }));

      const fileName = `property_${propertyReference}.mp4`;
      const res = await uploadVideoWithProperty({
        saqancomToken: saqanToken,
        videoFile: {
          uri: selectedVideoUri,
          name: fileName,
          type: 'video/mp4',
        },
        propertyReference,
        roomTimestamps,
        uploadToCloudflare: true,
        generateSubtitles: true,
        agentId: 1,
      });
      const isSuccess =
        res?.success === true ||
        (typeof res?.message === 'string' && res.message.toLowerCase().includes('uploaded successfully')) ||
        Boolean((res as any)?.data?.video_id);

      if (!isSuccess) {
        Alert.alert('Upload failed', res?.message || 'Upload failed. Please try again.');
        return;
      }

      const currentMonth = new Date().toISOString().slice(0, 7);
      const current = parseInt(await AsyncStorage.getItem(`@posts_used_${currentMonth}`) || '0');
      await AsyncStorage.setItem(`@posts_used_${currentMonth}`, (current + 1).toString());
      await refreshSubscription();

      Alert.alert('Property Published!', 'Your property has been published successfully.', [
        {
          text: 'View Property',
          onPress: () => {
            shouldResetOnNextFocus.current = true;
            router.replace('/(tabs)/profile');
          },
        },
        {
          text: 'Upload Another',
          onPress: resetUploadFlow,
        },
      ]);

      return;
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message || 'Upload failed. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleShareModalClose = () => {
    setShowShareModal(false);
    setStep('details');
  };

  const uploadMediaAndAttachToProperty = async (params: {
    uri: string;
    referenceId: string;
    propertiesToken: string;
  }): Promise<{ uploadId: number; attachId: number }> => {
    const t0 = Date.now();

    console.log('[media] upload start', { uri: params.uri, referenceId: params.referenceId });
    const uploadRes = await uploadMedia({
      propertiesToken: params.propertiesToken,
      uri: params.uri,
      featured: '1',
    });
    console.log('[media] upload response', uploadRes?.success, `t=${Date.now() - t0}ms`, uploadRes);

    if (!uploadRes?.success || !uploadRes?.payload?.id) {
      throw new Error(uploadRes?.message || 'Failed to upload image');
    }

    const uploadId = uploadRes.payload.id;

    const t1 = Date.now();
    console.log('[media] attach start', { referenceId: params.referenceId, upload_id: uploadId });

    const attachRes = await attachPropertyMedia({
      propertiesToken: params.propertiesToken,
      referenceId: params.referenceId,
      type: 'other',
      upload_id: uploadId,
    });

    console.log('[media] attach response', attachRes?.success, `t=${Date.now() - t1}ms`, attachRes);

    if (!attachRes?.success || !attachRes.data?.id) {
      throw new Error(attachRes?.message || 'Failed to attach image');
    }

    const attachId = attachRes.data.id;
    console.log('[media] complete', { uploadId, attachId, totalMs: Date.now() - t0 });

    return { uploadId, attachId };
  };


  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please grant photo library permissions to select images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (result.canceled) return;

    const picked = result.assets.map((a) => a.uri);

    // IMPORTANT: compute new URIs outside setState.
    // React may defer running the state updater function, so mutating `newUris` inside it can
    // cause `newUris.length` to be 0 here even though we added items to state (stuck spinners).
    const existingNow = new Set(selectedImages.map((p) => p.uri));
    const newUris = picked.filter((uri) => !existingNow.has(uri));

    if (!newUris.length) return;

    setSelectedImages((prev) => {
      const existing = new Set(prev.map((p) => p.uri));
      const merged = [...prev];
      for (const uri of newUris) {
        if (existing.has(uri)) continue;
        existing.add(uri);
        merged.push({ uri, uploadId: null, attachId: null, uploading: true });
      }
      return merged;
    });

    const propertiesToken = sessionTokens?.propertiesToken;
    const referenceId = draftPropertyReferenceId;

    if (!propertiesToken || !referenceId) {
      setSelectedImages((prev) => prev.map((img) => ({ ...img, uploading: false })));
      Alert.alert(
        'Cannot upload images',
        !propertiesToken
          ? 'Missing properties token. Please login again.'
          : 'Draft property reference is missing. Please wait a moment and try again.'
      );
      return;
    }

    showToast('Uploading images...');

    for (const uri of newUris) {
      try {
        const ids = await uploadMediaAndAttachToProperty({
          uri,
          referenceId,
          propertiesToken,
        });

        setSelectedImages((prev) =>
          prev.map((img) =>
            img.uri === uri
              ? { ...img, uploadId: ids.uploadId, attachId: ids.attachId, uploading: false }
              : img
          )
        );
      } catch (err: any) {
        setSelectedImages((prev) =>
          prev.map((img) => (img.uri === uri ? { ...img, uploading: false } : img))
        );
        Alert.alert('Image upload failed', err?.message || 'Failed to upload image.');
      }
    }
  };

  const handleSkipToHighlights = () => {
    setShowShareModal(false);
    // Reset highlights and start the highlight picker flow.
    setHighlightsByRoom({});
    setHighlightTimestamps([]);
    setActiveHighlightStepIndex(0);
    setIsHighlightsMuted(false);
    setIsHighlightsVideoLoaded(false);
    setIsHighlightsPlaying(false);
    setStep('selectHighlights');
  };

  useEffect(() => {
    if (step !== 'selectHighlights') return;

    // On Android, calling playAsync/pauseAsync during load/seek can crash.
    // Drive playback using the `shouldPlay` prop only.
    setIsHighlightsVideoLoaded(false);
    // Video should be paused initially when entering this step.
    setIsHighlightsPlaying(false);

    return () => {
      // stop when leaving
      setIsHighlightsPlaying(false);
    };
  }, [step, selectedVideoUri]);

  const handleDeleteVideo = () => {
    Alert.alert(
      'Delete Video',
      'Delete this video? This cannot be undone.',
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: () => {
            setSelectedVideoUri(null);
            setOverlayText('');
            setStep('select');
          },
          style: 'destructive',
        },
      ]
    );
  };

  // Tokens are stored globally via `useAuthStore` and persisted with AsyncStorage.
  if (!isAuthenticated || !sessionTokens?.backofficeToken) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Upload Property</Text>
        </View>

        <View style={[styles.contentContainer, { paddingBottom: tabBarHeight + scaleHeight(16) }]}>
          <View style={styles.authGateCard}>
            <Text style={styles.authGateTitle}>Login required</Text>
            <Text style={styles.authGateDescription}>
              Only logged in users can upload videos.
            </Text>
            <Pressable
              style={styles.authGateButton}
              onPress={() => router.replace('/auth/login' as any)}
            >
              <Text style={styles.authGateButtonText}>Log in</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (step === 'select') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Upload Property</Text>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: tabBarHeight + scaleHeight(16) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Add a video of your property</Text>
          <Text style={styles.sectionDescription}>
            Create a short vertical video (9:16) showcasing your property. Maximum 60 seconds.
          </Text>

          <View style={styles.optionsContainer}>
            <Pressable style={styles.uploadOption} onPress={recordVideo}>
              <View style={styles.uploadOptionIcon}>
                <Camera size={scaleWidth(32)} color={Colors.bronze} />
              </View>
              <Text style={styles.uploadOptionTitle}>Record Video</Text>
              <Text style={styles.uploadOptionDescription}>
                Use your camera to record a property tour
              </Text>
            </Pressable>

            <Pressable style={styles.uploadOption} onPress={pickVideo}>
              <View style={styles.uploadOptionIcon}>
                <VideoIcon size={scaleWidth(32)} color={Colors.bronze} />
              </View>
              <Text style={styles.uploadOptionTitle}>Choose from Gallery</Text>
              <Text style={styles.uploadOptionDescription}>
                Select a video from your device
              </Text>
            </Pressable>

            <Pressable style={styles.uploadOption} disabled>
              <View style={styles.uploadOptionIcon}>
                <ImageIcon size={scaleWidth(32)} color={Colors.textSecondary} />
              </View>
              <Text style={[styles.uploadOptionTitle, styles.disabledText]}>
                Photo Slideshow
              </Text>
              <Text style={[styles.uploadOptionDescription, styles.disabledText]}>
                Coming soon
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

 if (step === 'selectHighlights') {
   const addHighlightStep = (option: HighlightOption) => {
     setHighlightSteps((prev) => {
       const base = option;
       // Determine next available suffix for duplicates: Kitchen, Kitchen 2, Kitchen 3, ...
       let maxSuffix = 0;
       for (const name of prev) {
         if (name === base) {
           maxSuffix = Math.max(maxSuffix, 1);
           continue;
         }
         if (name.startsWith(base + ' ')) {
           const suffix = Number(name.slice((base + ' ').length));
           if (Number.isFinite(suffix) && suffix > 0) {
             maxSuffix = Math.max(maxSuffix, suffix);
           }
         }
       }

       const nextName = maxSuffix === 0 ? base : `${base} ${maxSuffix + 1}`;
       const next = [...prev, nextName];
        setActiveHighlightStepIndex(next.length - 1);
        showToast(`added ${nextName}`);
        return next;
     });
     setShowAddHighlightModal(false);
   };

   const activeRoom = highlightSteps[activeHighlightStepIndex];

    const snapSec = (sec: number) => {
      const snapped = Math.round(sec * 2) / 2;
      const clampedMin = Math.max(0, snapped);
      // Clamp to duration if known to avoid no-op / invalid seeks.
      if (Number.isFinite(videoDurationSec) && videoDurationSec > 0) {
        return Math.min(videoDurationSec, clampedMin);
      }
      return clampedMin;
    };

   const seek = async (sec: number) => {
     if (!isHighlightsVideoLoaded) return;
     try {
       const next = snapSec(sec);
        // Update UI immediately (so dragging the scrubber updates the displayed time smoothly)
        setVideoCurrentTimeSec(next);
        pendingSeekSecRef.current = next;

        // Avoid spamming setPositionAsync during a drag (it causes "Seeking interrupted").
        if (!isHighlightsScrubbingRef.current) {
          void videoRef.current
            ?.setPositionAsync(next * 1000)
            .catch(() => {
              // Ignore interruptions during rapid updates.
            });
        }
     } catch {
       // ignore seek errors
     }
   };

   const handleSelectThisHighlight = () => {
     setHighlightsByRoom((prev) => ({ ...prev, [activeRoom]: videoCurrentTimeSec }));

     const start_time = Math.floor(videoCurrentTimeSec);
     setHighlightTimestamps((prev) => {
       const next = [...prev];
       const idx = next.findIndex((t) => t.room === activeRoom);
       const item = { room: activeRoom, start_time, end_time: 0 };
       if (idx >= 0) next[idx] = item;
       else next.push(item);

      showToast(`highlight set for: ${activeRoom} at ${start_time}`);
       return next;
     });
   };

   const handleDone = () => {
    //  // Require at least one highlight timestamp before proceeding.
    //  if (!highlightTimestamps.length) {
    //    Alert.alert('Highlights required', 'Please set at least one highlight timestamp to continue.');
    //    return;
    //  }

     setIsHighlightsPlaying(false);
     setStep('details');
   };

   // const goPrevious = () => {
   //   // return back to edit step
   //   setIsHighlightsPlaying(false);
   //   setStep('edit');
   // };

   return (
     <View style={styles.container}>
        {toast.visible && (
          <View style={styles.toastContainer} pointerEvents="none">
            <View style={styles.toastInner}>
              <Text style={styles.toastText}>{toast.message}</Text>
            </View>
          </View>
        )}
       {/* Dimmed background */}
       <View style={styles.highlightsOverlay} />

       {/* 85% height sheet */}
       <View
         style={[
           styles.highlightsSheet,
           {
             height: '100%',
             bottom: tabBarHeight,
           },
         ]}
       >
         {/* <View style={styles.highlightsHeader}>
           <Pressable onPress={goPrevious}>
             <Text style={styles.highlightsBack}>Back</Text>
           </Pressable>
           <Text style={styles.highlightsTitle}>Select Highlights</Text>
           <Pressable onPress={() => setStep('details')}>
             <Text style={styles.highlightsClose}>Close</Text>
           </Pressable> 
         </View> */}

         <View style={styles.highlightsScroll}>
           {/* Video preview (edge-to-edge) */}
           <View style={styles.highlightsVideoOuter}>
             <View style={styles.highlightsVideoContainer}>
               <Video
                 ref={videoRef}
                 source={{ uri: selectedVideoUri! }}
                 style={styles.highlightsVideo}
                 resizeMode={'cover' as any}
                 shouldPlay={isHighlightsPlaying}
                 isMuted={isHighlightsMuted}
                 isLooping
                 onPlaybackStatusUpdate={(status: any) => {
                   if (!status?.isLoaded) return;
                   if (!isHighlightsVideoLoaded) setIsHighlightsVideoLoaded(true);
                   setVideoCurrentTimeSec((status.positionMillis ?? 0) / 1000);
                   setVideoDurationSec((status.durationMillis ?? 0) / 1000);
                 }}
               />

                {/* Invisible nudge zones (tap edges to move -0.5s / +0.5s) */}
                <Pressable
                  style={styles.highlightsNudgeZoneLeft}
                  onPress={() => seek((pendingSeekSecRef.current || videoCurrentTimeSec) - 0.5)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                />
                <Pressable
                  style={styles.highlightsNudgeZoneRight}
                  onPress={() => seek((pendingSeekSecRef.current || videoCurrentTimeSec) + 0.5)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                />

                
               {/* Video controls */}
               <View style={styles.highlightsVideoControls}>
                 <Pressable
                   style={styles.highlightsVideoControlButton}
                   onPress={() => {
                     if (!isHighlightsVideoLoaded) return;
                     setIsHighlightsPlaying((p) => !p);
                   }}
                 >
                   {isHighlightsPlaying ? (
                     <Pause size={scaleWidth(18)} color={Colors.textLight} />
                   ) : (
                     <Play size={scaleWidth(18)} color={Colors.textLight} />
                   )}
                 </Pressable>

                 <Pressable
                   style={styles.highlightsVideoControlButton}
                   onPress={() => setIsHighlightsMuted((m) => !m)}
                 >
                   {isHighlightsMuted ? (
                     <VolumeX size={scaleWidth(18)} color={Colors.textLight} />
                   ) : (
                     <Volume2 size={scaleWidth(18)} color={Colors.textLight} />
                   )}
                 </Pressable>
               </View>

               {/* Integrated time + movable scrubber overlay */}
               <View style={styles.highlightsScrubberOverlay}>
<View style={styles.highlightsTimeRowOverlay}>
                   <Text style={styles.highlightsTimeTextOverlay}>{formatTimeMmSs(videoCurrentTimeSec)}</Text>
                   <Text style={styles.highlightsTimeTextOverlay}>{formatTimeMmSs(videoDurationSec)}</Text>
                 </View>
                 <VideoScrubber
                   currentTime={videoCurrentTimeSec}
                   duration={videoDurationSec}
                   onSeek={seek}
                    onScrubStart={() => {
                      isHighlightsScrubbingRef.current = true;
                      wasHighlightsPlayingRef.current = isHighlightsPlaying;
                      setIsHighlightsPlaying(false);
                    }}
                    onScrubEnd={() => {
                      isHighlightsScrubbingRef.current = false;
                      const finalSec = pendingSeekSecRef.current;
                      void videoRef.current?.setPositionAsync(finalSec * 1000).catch(() => {
                        // Ignore interruptions
                      });

                      if (wasHighlightsPlayingRef.current) {
                        setIsHighlightsPlaying(true);
                      }
                    }}
                   trackColor={'rgba(255,255,255,0.35)'}
                   fillColor={Colors.textLight}
                   height={3.5}
                   thumbSize={14}
                   thumbColor={Colors.textLight}
                 />
               </View>

               {/* reuse overlay text preview */}
               {overlayText && (
                  <View
                    pointerEvents="none"
                    style={[
                     styles.textOverlayPreview,
                     overlayTextPosition === 'top' && styles.textTop,
                     overlayTextPosition === 'center' && styles.textCenter,
                     overlayTextPosition === 'bottom' && styles.textBottom,
                   ]}
                 >
                   <Text
                     style={[
                       styles.overlayTextPreview,
                       overlayTextSize === 'small' && { fontSize: scaleFont(12) },
                       overlayTextSize === 'medium' && { fontSize: scaleFont(18) },
                       overlayTextSize === 'large' && { fontSize: scaleFont(24) },
                       overlayTextColor === 'white' && { color: '#ffffff' },
                       overlayTextColor === 'black' && { color: '#000000' },
                       overlayTextColor === 'yellow' && { color: '#FFD700' },
                     ]}
                   >
                     {overlayText}
                   </Text>
                 </View>
               )}
             </View>
             {/* <Text style={styles.highlightsStepTitle}>Skip to highlights</Text>
             <Text style={styles.highlightsStepSubtitle}>
               Drag the bar to find the moment, then tap the button bellow.
             </Text> */}

           </View>

           {/* Padded content below the video */}
           <View
             style={[
               styles.highlightsContent,
               { paddingBottom: scaleHeight(20) },
             ]}
           >
             <View style={styles.highlightsBody}>
             {/* Circular highlight picker under the Select button */}
             <ScrollView
               horizontal
               showsHorizontalScrollIndicator={false}
               contentContainerStyle={styles.highlightsCirclePicker}
>
               <Pressable
                 style={styles.highlightsCircleItem}
                 onPress={() => setShowAddHighlightModal(true)}
               >
                 <View style={styles.highlightsCircleAdd}>
                   <Text style={styles.highlightsCircleAddText}>+</Text>
                 </View>
                 <Text style={styles.highlightsCircleTime}>Add</Text>
               </Pressable>

               {highlightSteps.map((room, idx) => {
                 const value = highlightsByRoom[room];
                 const isActive = idx === activeHighlightStepIndex;

                 const baseRoom = room.replace(/\s\d+$/, '');
                 const Icon =
                   baseRoom === 'Kitchen'
                     ? Utensils
                     : baseRoom === 'Living room'
                       ? Sofa
                       : baseRoom === 'Bedroom'
                         ? Bed
                         : baseRoom === 'Bathroom'
                           ? Bath
                           : baseRoom === 'View'
                             ? Eye
                             : baseRoom === 'Balcony'
                               ? Sun
                               : Mountain; // Terrace fallback

                 return (
                   <Pressable
                     key={room}
                     style={styles.highlightsCircleItem}
                     onPress={() => setActiveHighlightStepIndex(idx)}
                   >
                     <View
                       style={[
                         styles.highlightsCircle,
                         isActive && styles.highlightsCircleActive,
                       ]}
                     >
                       <Icon
                         size={scaleWidth(20)}
                         color={isActive ? Colors.bronze : Colors.text}
                       />
                     </View>
                     <Text
                       style={[
                         styles.highlightsCircleTime,
                         isActive && styles.highlightsCircleTimeActive,
                       ]}
                     >
                       {value != null ? formatTimeMmSs(value) : 'Not set'}
                     </Text>
                   </Pressable>
                 );
               })}
             </ScrollView>
           <View style={styles.highlightsActionsRow}>
             <Pressable style={styles.highlightsSelectButton} onPress={handleSelectThisHighlight}>
               <Text style={styles.highlightsSelectButtonText}>{`Set ${activeRoom}`}</Text>
             </Pressable>
             <Pressable style={styles.highlightsDoneButton} onPress={handleDone}>
               <Text style={styles.highlightsDoneButtonText}>Done</Text>
             </Pressable>
           </View>
           </View>

           <Modal
             visible={showAddHighlightModal}
             transparent
             animationType="fade"
             onRequestClose={() => setShowAddHighlightModal(false)}
           >
             <View style={styles.highlightsAddOverlay}>
               <View style={styles.highlightsAddModal}>
                 <Text style={styles.highlightsAddTitle}>Add highlight</Text>
                 <View style={styles.highlightsAddGrid}>
                   {DEFAULT_HIGHLIGHT_OPTIONS.map((option) => {
                     const Icon =
                       option === 'Kitchen'
                         ? Utensils
                         : option === 'Living room'
                           ? Sofa
                           : option === 'Bedroom'
                             ? Bed
                             : Bath;

                     return (
                       <Pressable
                         key={option}
                         style={styles.highlightsAddCircleItem}
                         onPress={() => addHighlightStep(option)}
                       >
                         <View style={styles.highlightsAddCircle}>
                           <Icon size={scaleWidth(22)} color={Colors.text} />
                         </View>
                         <Text style={styles.highlightsAddCircleLabel}>{option}</Text>
                       </Pressable>
                     );
                   })}
                 </View>
                 <Pressable
                   style={styles.highlightsAddCancel}
                   onPress={() => setShowAddHighlightModal(false)}
                 >
                   <Text style={styles.highlightsAddCancelText}>Cancel</Text>
                 </Pressable>
               </View>
             </View>
           </Modal>
           </View>
         </View>
       </View>
     </View>
   );
 }

 if (step === 'edit') {
    return (
      <View style={styles.container}>
        <View  style={styles.header}>
          <Pressable onPress={() => { setStep('select'); setSelectedVideoUri(null); }}>
            <X size={scaleWidth(24)} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Video</Text>
          <Pressable onPress={handleDeleteVideo}>
            <Text style={styles.deleteButton}>Delete</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.editContent}
          contentContainerStyle={{
            padding: scaleWidth(20),
            // Leave room for the fixed footer + tab bar
            paddingBottom: scaleHeight(140) + tabBarHeight,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.videoPreviewContainer}>
            <Video
              source={{ uri: selectedVideoUri! }}
              style={styles.videoPreview}
              resizeMode={'cover' as any}
              useNativeControls={true}
            />
            {overlayText && (
              <View style={[
                styles.textOverlayPreview,
                overlayTextPosition === 'top' && styles.textTop,
                overlayTextPosition === 'center' && styles.textCenter,
                overlayTextPosition === 'bottom' && styles.textBottom,
              ]}>
                <Text style={[
                  styles.overlayTextPreview,
                  overlayTextSize === 'small' && { fontSize: scaleFont(12) },
                  overlayTextSize === 'medium' && { fontSize: scaleFont(18) },
                  overlayTextSize === 'large' && { fontSize: scaleFont(24) },
                  overlayTextColor === 'white' && { color: '#ffffff' },
                  overlayTextColor === 'black' && { color: '#000000' },
                  overlayTextColor === 'yellow' && { color: '#FFD700' },
                ]}>
                  {overlayText}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.controlSection}>
            <Text style={styles.controlTitle}>Text Overlay</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Add text to video..."
              placeholderTextColor={Colors.textSecondary}
              value={overlayText}
              onChangeText={setOverlayText}
              maxLength={50}
            />

            {overlayText && (
              <>
                <View style={styles.controlSubsection}>
                  <Text style={styles.controlLabel}>Font Size</Text>
                  <View style={styles.buttonGroup}>
                    {['small', 'medium', 'large'].map((size) => (
                      <Pressable
                        key={size}
                        style={[
                          styles.controlButton,
                          overlayTextSize === size && styles.controlButtonSelected,
                        ]}
                        onPress={() => setOverlayTextSize(size as any)}
                      >
                        <Text style={[
                          styles.controlButtonText,
                          overlayTextSize === size && styles.controlButtonTextSelected,
                        ]}>
                          {size.charAt(0).toUpperCase() + size.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.controlSubsection}>
                  <Text style={styles.controlLabel}>Text Color</Text>
                  <View style={styles.buttonGroup}>
                    {['white', 'black', 'yellow'].map((color) => (
                      <Pressable
                        key={color}
                        style={[
                          styles.controlButton,
                          overlayTextColor === color && styles.controlButtonSelected,
                        ]}
                        onPress={() => setOverlayTextColor(color as any)}
                      >
                        <Text style={[
                          styles.controlButtonText,
                          overlayTextColor === color && styles.controlButtonTextSelected,
                        ]}>
                          {color.charAt(0).toUpperCase() + color.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.controlSubsection}>
                  <Text style={styles.controlLabel}>Position</Text>
                  <View style={styles.buttonGroup}>
                    {['top', 'center', 'bottom'].map((pos) => (
                      <Pressable
                        key={pos}
                        style={[
                          styles.controlButton,
                          overlayTextPosition === pos && styles.controlButtonSelected,
                        ]}
                        onPress={() => setOverlayTextPosition(pos as any)}
                      >
                        <Text style={[
                          styles.controlButtonText,
                          overlayTextPosition === pos && styles.controlButtonTextSelected,
                        ]}>
                          {pos.charAt(0).toUpperCase() + pos.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>

        <View
          style={[
            styles.editFooter,
            // Move the footer above the bottom tab bar
            { marginBottom: tabBarHeight },
          ]}
        >
          <Pressable
            style={styles.continueButton}
            onPress={() => {
              setShowShareModal(true);
            }}
          >
            <Text style={styles.continueButtonText}>
              {overlayText ? 'Next' : 'Skip Text'}
            </Text>
          </Pressable>
        </View>

        {showShareModal && (
          <View
            style={[
              styles.modalOverlay,
              { paddingBottom: tabBarHeight },
            ]}
          >
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Share this video?</Text>
              <Text style={styles.modalDescription}>
                Share your video to your network or save to camera roll
              </Text>
              <View style={styles.modalButtonGroup}>
                <Pressable
                  style={styles.modalButton}
                  onPress={() => {
                    Share.share({
                      message: 'Check out my property video on Saqan!',
                      url: selectedVideoUri || '',
                      title: 'Share Property Video',
                    });
                    handleShareModalClose();
                  }}
                >
                  <Text style={styles.modalButtonText}>Share</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={handleSkipToHighlights}
                >
                  <Text style={styles.modalButtonTextSecondary}>Skip</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setStep('select')}
          disabled={isPublishing}
          style={isPublishing ? { opacity: 0.4 } : undefined}
        >
          <X size={scaleWidth(24)} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Property Details</Text>
        {/* Publish is controlled by the segmented wizard footer (Back/Next/Publish) */}
        <View style={{ width: scaleWidth(70) }} />
      </View>

      {toast.visible && (
        <View style={styles.toastContainer} pointerEvents="none">
          <View style={styles.toastInner}>
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        </View>
      )}

      {isPublishing && (
        <View style={styles.publishingOverlay}>
          <ActivityIndicator size="large" color={Colors.bronze} />
          <Text style={styles.publishingOverlayText}>Uploading...</Text>
        </View>
      )}

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: flowAnimOpacity, transform: [{ translateX: flowAnimTranslateX }] }}>
          {detailsFlow === 'status' && (
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Property Status *</Text>
          <View style={styles.radioRow}>
            <Pressable
              style={[
                styles.radioOption,
                propertyDetails.developmentStatus === 'READY' && styles.radioOptionSelected,
              ]}
              onPress={() => {
                setOffPlanPickerOpen(false);
                setOffPlanSearch('');
                setPropertyDetails({
                  ...propertyDetails,
                  developmentStatus: 'READY',
                  offPlanProjectId: null,
                  offPlanProjectReferenceId: '',
                  offPlanProjectTitle: '',
                });
                setDraftPropertyReferenceId(null);
              }}
            >
              <View
                style={[
                  styles.radioOuter,
                  propertyDetails.developmentStatus === 'READY' && styles.radioOuterSelected,
                ]}
              >
                {propertyDetails.developmentStatus === 'READY' && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>Ready property</Text>
            </Pressable>

            <Pressable
              style={[
                styles.radioOption,
                propertyDetails.developmentStatus === 'OFF_PLAN' && styles.radioOptionSelected,
              ]}
              onPress={() => {
                // Clear READY-only fields when switching to OFF_PLAN.
                setOffPlanPickerOpen(false);
                setOffPlanSearch('');
                setPropertyDetails({
                  ...propertyDetails,
                  developmentStatus: 'OFF_PLAN',
                  // Clear READY-only fields when switching to OFF_PLAN
                  title: '',
                  price: '',
                  listingType: 'BUY',
                  emirateId: null,
                  emirateName: '',
                  districtId: null,
                  districtName: '',
                  building: '',
                  area: '',
                });

                // Clear any existing READY draft reference and wait for user to pick a project.
                setDraftPropertyReferenceId(null);
              }}
            >
              <View
                style={[
                  styles.radioOuter,
                  propertyDetails.developmentStatus === 'OFF_PLAN' && styles.radioOuterSelected,
                ]}
              >
                {propertyDetails.developmentStatus === 'OFF_PLAN' && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>Off plan</Text>
            </Pressable>

            <Pressable
              style={styles.radioOption}
              onPress={() => {
                // GENERIC: hide all property fields and clear property state.
                setOffPlanPickerOpen(false);
                setOffPlanSearch('');
                setLocationPicker(null);
                setEmirateSearch('');
                setDistrictSearch('');
                setLocationSearch('');

                setAmenitiesModalVisible(false);
                setAmenitiesSearch('');
                setSelectedAmenityIds([]);
                setSelectedImages([]);

                setDraftPropertyReferenceId(null);

                setPropertyDetails((prev) => ({
                  ...prev,
                  developmentStatus: 'GENERIC',
                  // Clear everything that is related to a property
                  title: '',
                  price: '',
                  listingType: 'BUY',
                  propertyType: 'apartment',
                  bedrooms: '',
                  bathrooms: '',
                  sizeSqft: '',
                  isFurnished: false,
                  hasParking: false,

                  offPlanProjectId: null,
                  offPlanProjectReferenceId: '',
                  offPlanProjectTitle: '',

                  emirateId: null,
                  emirateName: '',
                  districtId: null,
                  districtName: '',
                  building: '',
                  area: '',

                  defaultPricing: 'month',
                  dayPrice: '',
                  weekPrice: '',
                  monthPrice: '',
                  yearPrice: '',
                  builtYear: '',
                  floor: '',

                  description: '',
                }));
              }}
            >
              <View
                style={[
                  styles.radioOuter,
                  propertyDetails.developmentStatus === 'GENERIC' && styles.radioOuterSelected,
                ]}
              >
                {propertyDetails.developmentStatus === 'GENERIC' && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>My video is generic</Text>
            </Pressable>
          </View>
        </View>
          )}

        {detailsFlow === 'ready_step_1' && propertyDetails.developmentStatus === 'READY' ? (
          <>
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Luxury 2BR Marina View Apartment"
                placeholderTextColor={Colors.textSecondary}
                value={propertyDetails.title}
                onChangeText={(text) => setPropertyDetails({ ...propertyDetails, title: text })}
              />
            </View>
          </>
        ) : null}

    
        {detailsFlow === 'ready_step_1' && propertyDetails.developmentStatus === 'READY' && (
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Listing Type</Text>
            <View style={styles.chipRow}>
              {(['BUY', 'RENT', 'STAY'] as TransactionType[]).map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.chip,
                    propertyDetails.listingType === type && styles.chipSelected,
                  ]}
                  onPress={() => {
                    setPropertyDetails((prev) => {
                      // Pricing UI rules:
                      // BUY/RENT => show only main Price (AED). Clear STAY pricing fields so hidden values aren't submitted.
                      // STAY     => show Default Pricing + Prices, hide main Price (AED).
                      if (type === 'BUY' || type === 'RENT') {
                        return {
                          ...prev,
                          listingType: type,
                          // main price remains user-entered for BUY/RENT, but we clear it on type switch to avoid cross-type mistakes
                          price: '',
                          // clear STAY fields
                          defaultPricing: 'month',
                          dayPrice: '',
                          weekPrice: '',
                          monthPrice: '',
                          yearPrice: '',
                        };
                      }

                      // STAY: clear main price since UI hides it; keep STAY pricing fields.
                      return { ...prev, listingType: type, price: '' };
                    });
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      propertyDetails.listingType === type && styles.chipTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

          {detailsFlow === 'ready_step_1' && propertyDetails.developmentStatus === 'READY' && (
            <>
              {/* BUY/RENT: show main Price (AED) only. STAY: hide main price and show Default Pricing + Prices */}
              {propertyDetails.listingType !== 'STAY' && (
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Price (AED)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 2300000"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="numeric"
                    value={propertyDetails.price}
                    onChangeText={(text) => setPropertyDetails({ ...propertyDetails, price: text })}
                  />
                </View>
              )}

              {propertyDetails.listingType === 'STAY' && (
                <>
                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>Default Pricing</Text>
                    <View style={styles.buttonGroup}>
                      {(['day', 'week', 'month', 'year'] as const).map((p) => (
                        <Pressable
                          key={p}
                          style={[
                            styles.controlButton,
                            propertyDetails.defaultPricing === p && styles.controlButtonSelected,
                          ]}
                          onPress={() => {
                            setPropertyDetails({ ...propertyDetails, defaultPricing: p });
                            showToast('Default pricing updated');
                          }}
                        >
                          <Text
                            style={[
                              styles.controlButtonText,
                              propertyDetails.defaultPricing === p && styles.controlButtonTextSelected,
                            ]}
                          >
                            {p.toUpperCase()}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>Prices</Text>
                    <View style={styles.formRow}>
                      <View style={styles.formColumn}>
                        <Text style={styles.formLabelSmall}>Day</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="0"
                          placeholderTextColor={Colors.textSecondary}
                          keyboardType="numeric"
                          value={propertyDetails.dayPrice}
                          onChangeText={(text) => {
                            setPropertyDetails({ ...propertyDetails, dayPrice: text });
                            showToast('Day price updated');
                          }}
                        />
                      </View>
                      <View style={styles.formColumn}>
                        <Text style={styles.formLabelSmall}>Week</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="0"
                          placeholderTextColor={Colors.textSecondary}
                          keyboardType="numeric"
                          value={propertyDetails.weekPrice}
                          onChangeText={(text) => {
                            setPropertyDetails({ ...propertyDetails, weekPrice: text });
                            showToast('Week price updated');
                          }}
                        />
                      </View>
                    </View>
                    <View style={styles.formRow}>
                      <View style={styles.formColumn}>
                        <Text style={styles.formLabelSmall}>Month</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="0"
                          placeholderTextColor={Colors.textSecondary}
                          keyboardType="numeric"
                          value={propertyDetails.monthPrice}
                          onChangeText={(text) => {
                            setPropertyDetails({ ...propertyDetails, monthPrice: text });
                            showToast('Month price updated');
                          }}
                        />
                      </View>
                      <View style={styles.formColumn}>
                        <Text style={styles.formLabelSmall}>Year</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="0"
                          placeholderTextColor={Colors.textSecondary}
                          keyboardType="numeric"
                          value={propertyDetails.yearPrice}
                          onChangeText={(text) => {
                            setPropertyDetails({ ...propertyDetails, yearPrice: text });
                            showToast('Year price updated');
                          }}
                        />
                      </View>
                    </View>
                  </View>
                </>
              )}
            </>
          )}


        {detailsFlow === 'offplan_project' && propertyDetails.developmentStatus === 'OFF_PLAN' && (
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Off-plan project *</Text>
            <Pressable
              style={styles.locationInput}
              onPress={() => setOffPlanPickerOpen(true)}
            >
              <Text
                style={[
                  styles.locationInputText,
                  !propertyDetails.offPlanProjectId && styles.placeholder,
                ]}
              >
                {propertyDetails.offPlanProjectTitle || 'Select project'}
              </Text>
              <ChevronRight size={scaleWidth(20)} color={Colors.textSecondary} />
            </Pressable>
          </View>
        )}

        {detailsFlow === 'ready_step_2' && propertyDetails.developmentStatus === 'READY' && (
          <>
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Property Type</Text>
              <View style={styles.chipRow}>
                {(['apartment', 'villa', 'townhouse', 'penthouse', 'studio'] as PropertyType[]).map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.chip, propertyDetails.propertyType === type && styles.chipSelected]}
                    onPress={() => setPropertyDetails({ ...propertyDetails, propertyType: type })}
                  >
                    <Text
                      style={[styles.chipText, propertyDetails.propertyType === type && styles.chipTextSelected]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formColumn}>
                <Text style={styles.formLabel}>Bedrooms</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="numeric"
                  value={propertyDetails.bedrooms}
                  onChangeText={(text) => setPropertyDetails({ ...propertyDetails, bedrooms: text })}
                />
              </View>
              <View style={styles.formColumn}>
                <Text style={styles.formLabel}>Bathrooms</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="numeric"
                  value={propertyDetails.bathrooms}
                  onChangeText={(text) => setPropertyDetails({ ...propertyDetails, bathrooms: text })}
                />
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Size (sqft)</Text>
              <TextInput
                style={styles.input}
                placeholder="1200"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="numeric"
                value={propertyDetails.sizeSqft}
                onChangeText={(text) => setPropertyDetails({ ...propertyDetails, sizeSqft: text })}
              />
            </View>

            {/* <View style={styles.formSection}>
              <View style={styles.checkboxRow}>
                <Pressable
                  style={[styles.checkbox, propertyDetails.isFurnished && styles.checkboxChecked]}
                  onPress={() =>
                    setPropertyDetails({ ...propertyDetails, isFurnished: !propertyDetails.isFurnished })
                  }
                >
                  {propertyDetails.isFurnished ? <Check size={scaleWidth(14)} color="#fff" /> : null}
                </Pressable>
                <View style={styles.checkboxTextWrap}>
                  <Text style={styles.formLabel}>Furnished</Text>
                  <Text style={styles.helperText}>Is this property furnished?</Text>
                </View>
              </View>
            </View>

            <View style={styles.formSection}>
              <View style={styles.checkboxRow}>
                <Pressable
                  style={[styles.checkbox, propertyDetails.hasParking && styles.checkboxChecked]}
                  onPress={() =>
                    setPropertyDetails({ ...propertyDetails, hasParking: !propertyDetails.hasParking })
                  }
                >
                  {propertyDetails.hasParking ? <Check size={scaleWidth(14)} color="#fff" /> : null}
                </Pressable>
                <View style={styles.checkboxTextWrap}>
                  <Text style={styles.formLabel}>Garage</Text>
                  <Text style={styles.helperText}>Does this property have a garage?</Text>
                </View>
              </View>
            </View> */}
          </>
        )}

        {detailsFlow === 'ready_step_3' && propertyDetails.developmentStatus === 'READY' && (
          <>
            {/* <View style={styles.formSection}>
              <Text style={styles.formLabel}>Property Status</Text>
              <Text style={styles.summaryValueText}>{developmentStatusLabel}</Text>
            </View> */}

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Property Location</Text>

              <Text style={styles.formLabel}>Emirate *</Text>
              <Pressable
                style={styles.locationInput}
                onPress={() => requestAnimationFrame(() => setLocationPicker('emirate'))}
              >
            <Text style={[styles.locationInputText, !propertyDetails.emirateId && styles.placeholder]}>
              {propertyDetails.emirateName || 'Select emirate'}
            </Text>
            <View style={styles.selectRight}>
              {propertyDetails.emirateId ? (
                <Pressable
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => {
                    setPropertyDetails({
                      ...propertyDetails,
                      emirateId: null,
                      emirateName: '',
                      districtId: null,
                      districtName: '',
                      building: '',
                      area: '',
                    });
                  }}
                >
                  <X size={scaleWidth(18)} color={Colors.textSecondary} />
                </Pressable>
              ) : (
                <ChevronRight size={scaleWidth(20)} color={Colors.textSecondary} />
              )}
            </View>
          </Pressable>

          <Text style={[styles.formLabel, { marginTop: scaleHeight(12) }]}>District *</Text>
          <Pressable
            style={[styles.locationInput, !propertyDetails.emirateId && styles.disabledInput]}
            disabled={!propertyDetails.emirateId}
            onPress={() => requestAnimationFrame(() => setLocationPicker('district'))}
          >
            <Text
              style={[
                styles.locationInputText,
                !propertyDetails.districtId && styles.placeholder,
                !propertyDetails.emirateId && styles.disabledText,
              ]}
            >
              {propertyDetails.districtName || 'Select district'}
            </Text>
            <View style={styles.selectRight}>
              {propertyDetails.districtId ? (
                <Pressable
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => {
                    setPropertyDetails({
                      ...propertyDetails,
                      districtId: null,
                      districtName: '',
                      building: '',
                      area: '',
                    });
                  }}
                >
                  <X size={scaleWidth(18)} color={Colors.textSecondary} />
                </Pressable>
              ) : (
                <ChevronRight size={scaleWidth(20)} color={Colors.textSecondary} />
              )}
            </View>
          </Pressable>

          <Text style={[styles.formLabel, { marginTop: scaleHeight(12) }]}>Building</Text>
          <Pressable
            style={[styles.locationInput, !propertyDetails.districtId && styles.disabledInput]}
            disabled={!propertyDetails.districtId}
            onPress={() => requestAnimationFrame(() => setLocationPicker('building'))}
          >
            <Text
              style={[
                styles.locationInputText,
                !propertyDetails.building && styles.placeholder,
                !propertyDetails.districtId && styles.disabledText,
              ]}
            >
              {selectedBuildingLabel || propertyDetails.building || 'Select building'}
            </Text>
            <View style={styles.selectRight}>
              {propertyDetails.building ? (
                <Pressable
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => {
                    setPropertyDetails({
                      ...propertyDetails,
                      building: '',
                      area: '',
                    });
                  }}
                >
                  <X size={scaleWidth(18)} color={Colors.textSecondary} />
                </Pressable>
              ) : (
                <ChevronRight size={scaleWidth(20)} color={Colors.textSecondary} />
              )}
            </View>
          </Pressable>

          <Text style={[styles.formLabel, { marginTop: scaleHeight(12) }]}>Area</Text>
          <Pressable
            style={[styles.locationInput, !propertyDetails.building && styles.disabledInput]}
            disabled={!propertyDetails.building}
            onPress={() => requestAnimationFrame(() => setLocationPicker('area'))}
          >
            <Text
              style={[
                styles.locationInputText,
                !propertyDetails.area && styles.placeholder,
                !propertyDetails.building && styles.disabledText,
              ]}
            >
              {selectedAreaLabel || propertyDetails.area || 'Select area'}
            </Text>
            <View style={styles.selectRight}>
              {propertyDetails.area ? (
                <Pressable
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => {
                    setPropertyDetails({
                      ...propertyDetails,
                      area: '',
                    });
                  }}
                >
                  <X size={scaleWidth(18)} color={Colors.textSecondary} />
                </Pressable>
              ) : (
                <ChevronRight size={scaleWidth(20)} color={Colors.textSecondary} />
              )}
            </View>
          </Pressable>

        </View>
      </>
        )}

        {detailsFlow === 'ready_step_4' && propertyDetails.developmentStatus === 'READY' && (
        <> 
        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Amenities</Text>
          <Pressable
            style={styles.locationInput}
            onPress={() => {
              setAmenitiesSearch('');
              setAmenitiesModalVisible(true);
            }}
          >
            <Text style={[styles.locationInputText, !selectedAmenityIds.length && styles.placeholder]}>
              {selectedAmenityIds.length ? `${selectedAmenityIds.length} selected` : 'Select amenities'}
            </Text>
            <View style={styles.selectRight}>
              {selectedAmenityIds.length ? (
                <Pressable
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => {
                    setSelectedAmenityIds([]);
                    showToast('Amenities cleared');
                  }}
                >
                  <X size={scaleWidth(18)} color={Colors.textSecondary} />
                </Pressable>
              ) : (
                <ChevronRight size={scaleWidth(20)} color={Colors.textSecondary} />
              )}
            </View>
          </Pressable>

          {selectedAmenityIds.length > 0 && (
            <View style={styles.amenitiesChipsWrap}>
              {selectedAmenityIds
                .map((id) => amenitiesOptions.find((a) => a.id === id))
                .filter(Boolean)
                .map((amenity) => (
                  <Pressable
                    key={(amenity as Amenity).id}
                    style={styles.amenitiesChip}
                    onPress={() => toggleAmenity((amenity as Amenity).id)}
                  >
                    <Text style={styles.amenitiesChipText} numberOfLines={1}>
                      {(amenity as Amenity).name}
                    </Text>
                    <X size={scaleWidth(14)} color={Colors.textSecondary} />
                  </Pressable>
                ))}
            </View>
          )}
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Images</Text>
          <Pressable style={styles.imageDropzone} onPress={pickImages}>
            <Text style={styles.imageDropzoneText}>
              {selectedImages.length ? 'Add more images' : 'Tap to select images'}
            </Text>
            <Text style={styles.imageDropzoneHint}>Select property images</Text>
          </Pressable>

          {selectedImages.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageThumbRow}>
              {selectedImages.map((img) => (
                <View key={img.uri} style={styles.imageThumbWrap}>
                  <Image source={{ uri: img.uri }} style={styles.imageThumb} />
                  {img.uploading ? (
                    <View style={styles.imageUploadingOverlay} pointerEvents="none">
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  ) : null}
                  <Pressable
                    style={styles.imageThumbRemove}
                    onPress={async () => {
                      try {
                        const referenceId = draftPropertyReferenceId;
                        const propertiesToken = sessionTokens?.propertiesToken;
                        const attachId = img.attachId;

                        if (referenceId && propertiesToken && typeof attachId === 'number') {
                          const res = await unAttachPropertyMedia({
                            propertiesToken,
                            referenceId,
                            id: attachId,
                          });

                          if (!res.success) {
                            Alert.alert('Remove failed', res.message || 'Failed to remove image');
                            return;
                          }
                        }

                        // Remove from UI state
                        setSelectedImages((prev) => prev.filter((p) => p.uri !== img.uri));
                        showToast('Image removed');
                      } catch (err: any) {
                        Alert.alert('Remove failed', err?.message || 'Failed to remove image.');
                      }
                    }}
                  >
                    <X size={scaleWidth(14)} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.formRow}>
          <View style={styles.formColumn}>
            <Text style={styles.formLabel}>Built year</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 2024"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="numeric"
              value={propertyDetails.builtYear}
              onChangeText={(text) => {
                setPropertyDetails({ ...propertyDetails, builtYear: text });
                showToast('Built year updated');
              }}
            />
          </View>
          <View style={styles.formColumn}>
            <Text style={styles.formLabel}>Floor</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 10"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="numeric"
              value={propertyDetails.floor}
              onChangeText={(text) => {
                setPropertyDetails({ ...propertyDetails, floor: text });
                showToast('Floor updated');
              }}
            />
          </View>
        </View>

        <Modal
          visible={false}
          transparent
          animationType="fade"
          onRequestClose={() => setLocationPicker(null)}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={[styles.locationModal, { paddingBottom: keyboardHeight }]}
              onPress={() => {
                Keyboard.dismiss();
                setLocationPicker(null);
              }}
            >
              <View
                style={[styles.modal, { height: windowHeight * 0.55 }]}
                onStartShouldSetResponder={() => true}
                onResponderRelease={() => Keyboard.dismiss()}
              >
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderSpacer} />
                  <Text style={styles.modalTitle}>
                    {locationPicker === 'emirate'
                      ? 'Select Emirate'
                      : locationPicker === 'district'
                        ? 'Select District'
                        : locationPicker === 'building'
                          ? 'Select Building'
                          : 'Select Area'}
                  </Text>
                  <Pressable style={styles.modalHeaderCloseButton} onPress={() => setLocationPicker(null)}>
                    <X size={scaleWidth(18)} color={Colors.textSecondary} />
                  </Pressable>
                </View>

              {locationPicker === 'emirate' && (
                <TextInput
                  style={[styles.input, styles.searchInput]}
                  placeholder="Search emirate..."
                  placeholderTextColor={Colors.textSecondary}
                  value={emirateSearch}
                  onChangeText={setEmirateSearch}
                  autoCorrect={false}
                  autoCapitalize="none"
                  clearButtonMode="while-editing"
                />
              )}

              {(locationPicker === 'district' || locationPicker === 'building' || locationPicker === 'area') && (
                <TextInput
                  style={[styles.input, styles.searchInput]}
                  placeholder={
                    locationPicker === 'district'
                      ? 'Search district...'
                      : locationPicker === 'building'
                        ? 'Search building...'
                        : 'Search area...'
                  }
                  placeholderTextColor={Colors.textSecondary}
                  value={locationPicker === 'district' ? districtSearch : locationSearch}
                  onChangeText={locationPicker === 'district' ? setDistrictSearch : setLocationSearch}
                  autoCorrect={false}
                  autoCapitalize="none"
                  clearButtonMode="while-editing"
                />
              )}

              {locationPicker === 'emirate' && isEmiratesError && (
                <Pressable
                  style={[styles.modalButton, { marginBottom: scaleHeight(12) }]}
                  onPress={() => refetchEmirates()}
                >
                  <Text style={styles.modalButtonText}>Retry loading emirates</Text>
                </Pressable>
              )}

              {locationPicker === 'district' && isDistrictsError && (
                <Pressable
                  style={[styles.modalButton, { marginBottom: scaleHeight(12) }]}
                  onPress={() => refetchDistricts()}
                >
                  <Text style={styles.modalButtonText}>Retry loading districts</Text>
                </Pressable>
              )}

              {locationPicker === 'emirate' ? (
                <FlatList<Emirate>
                  data={emirateOptions.filter((e) =>
                    e.name.toLowerCase().includes(emirateSearch.trim().toLowerCase())
                  )}
                  keyExtractor={(item) => String(item.id)}
                  ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.pickerItem}
                      onPress={() => {
                        setPropertyDetails({
                          ...propertyDetails,
                          emirateId: item.id,
                          emirateName: item.name,
                          districtId: null,
                          districtName: '',
                          building: '',
                          area: '',
                        });
                        setEmirateSearch('');
                        setDistrictSearch('');
                        setLocationPicker(null);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{item.name}</Text>
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyPickerText}>
                      {isEmiratesLoading
                        ? 'Loading emirates...'
                        : emirateSearch.trim().length
                          ? 'No emirates match your search'
                          : 'No emirates'}
                    </Text>
                  }
                />
              ) : locationPicker === 'district' ? (
                <FlatList<District>
                  data={districtOptions.filter((d) =>
                    d.name.toLowerCase().includes(districtSearch.trim().toLowerCase())
                  )}
                  keyExtractor={(item) => String(item.id)}
                  ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.pickerItem}
                      onPress={() => {
                        setPropertyDetails({
                          ...propertyDetails,
                          districtId: item.id,
                          districtName: item.name,
                          building: '',
                          area: '',
                        });
                        setDistrictSearch('');
                        setLocationPicker(null);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{item.name}</Text>
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyPickerText}>
                      {isDistrictsLoading
                        ? 'Loading districts...'
                        : districtSearch.trim().length
                          ? 'No districts match your search'
                          : 'No districts'}
                    </Text>
                  }
                />
              ) : (
                locationPicker === 'building' ? (
                  <>
                    {isBuildingsError && (
                      <Pressable
                        style={[styles.modalButton, { marginBottom: scaleHeight(12) }]}
                        onPress={() => refetchBuildings()}
                      >
                        <Text style={styles.modalButtonText}>Retry loading buildings</Text>
                      </Pressable>
                    )}

                    {isBuildingsLoading ? (
                      <View style={{ paddingVertical: scaleHeight(16) }}>
                        <ActivityIndicator />
                      </View>
                    ) : (
                      <FlatList<Building>
                        data={buildingsOptions.filter((b) =>
                          b.name.toLowerCase().includes(locationSearch.trim().toLowerCase())
                        )}
                        keyExtractor={(item) => String(item.id)}
                        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
                        onEndReachedThreshold={0.5}
                        onEndReached={() => {
                          if (locationSearch.trim().length) return;
                          if (!hasNextBuildingsPage || isFetchingNextBuildingsPage) return;
                          fetchNextBuildingsPage();
                        }}
                        ListFooterComponent={
                          isFetchingNextBuildingsPage ? (
                            <Text style={styles.emptyPickerText}>Loading more…</Text>
                          ) : null
                        }
                        renderItem={({ item }) => (
                          <Pressable
                            style={styles.pickerItem}
                            onPress={() => {
                              setPropertyDetails({
                                ...propertyDetails,
                                building: item.slug,
                                area: '',
                              });
                              setLocationPicker(null);
                            }}
                          >
                            <Text style={styles.pickerItemText}>{item.name}</Text>
                          </Pressable>
                        )}
                        ListEmptyComponent={
                          <Text style={styles.emptyPickerText}>
                            {locationSearch.trim().length
                              ? 'No buildings match your search'
                              : 'No buildings'}
                          </Text>
                        }
                      />
                    )}
                  </>
                ) : (
                  <>
                    {isAreasError && (
                      <Pressable
                        style={[styles.modalButton, { marginBottom: scaleHeight(12) }]}
                        onPress={() => refetchAreas()}
                      >
                        <Text style={styles.modalButtonText}>Retry loading areas</Text>
                      </Pressable>
                    )}

                    {isAreasLoading ? (
                      <View style={{ paddingVertical: scaleHeight(16) }}>
                        <ActivityIndicator />
                      </View>
                    ) : (
                      <FlatList<Area>
                        data={(areasOptions ?? []).filter((a) =>
                          a.name.toLowerCase().includes(locationSearch.trim().toLowerCase())
                        )}
                        keyExtractor={(item) => String(item.id)}
                        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
                        renderItem={({ item }) => (
                          <Pressable
                            style={styles.pickerItem}
                            onPress={() => {
                              setPropertyDetails({
                                ...propertyDetails,
                                area: item.slug,
                              });
                              setLocationPicker(null);
                            }}
                          >
                            <Text style={styles.pickerItemText}>{item.name}</Text>
                          </Pressable>
                        )}
                        ListEmptyComponent={
                          <Text style={styles.emptyPickerText}>
                            {locationSearch.trim().length
                              ? 'No areas match your search'
                              : 'No areas'}
                          </Text>
                        }
                      />
                    )}
                  </>
                )
              )}
              </View>
            </Pressable>
          </View>
        </Modal>



        <Modal
          visible={amenitiesModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAmenitiesModalVisible(false)}
        >
          <View style={{ flex: 1 }}>
            <Pressable
              style={[styles.locationModal, { paddingBottom: keyboardHeight }]}
              onPress={() => {
                Keyboard.dismiss();
                setAmenitiesModalVisible(false);
              }}
            >
              <Pressable style={[styles.modal, { height: windowHeight * 0.55 }]} onPress={() => Keyboard.dismiss()}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderSpacer} />
                  <Text style={styles.modalTitle}>Select Amenities</Text>
                  <Pressable
                    style={styles.modalHeaderCloseButton}
                    onPress={() => {
                      Keyboard.dismiss();
                      setAmenitiesModalVisible(false);
                    }}
                  >
                    <X size={scaleWidth(18)} color={Colors.textSecondary} />
                  </Pressable>
                </View>

                <TextInput
                  style={[styles.input, styles.searchInput]}
                  placeholder="Search amenities..."
                  placeholderTextColor={Colors.textSecondary}
                  value={amenitiesSearch}
                  onChangeText={setAmenitiesSearch}
                  autoCorrect={false}
                  autoCapitalize="none"
                  clearButtonMode="while-editing"
                />

                {isAmenitiesError && (
                  <Pressable
                    style={[styles.modalButton, { marginBottom: scaleHeight(12) }]}
                    onPress={() => refetchAmenities()}
                  >
                    <Text style={styles.modalButtonText}>Retry loading amenities</Text>
                  </Pressable>
                )}

                <View style={{ flex: 1 }}>
                  {isAmenitiesLoading ? (
                    <View style={{ paddingVertical: scaleHeight(16) }}>
                      <ActivityIndicator />
                    </View>
                  ) : (
                    <FlatList<Amenity>
                      data={filteredAmenities}
                      keyExtractor={(item) => String(item.id)}
                      ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
                      contentContainerStyle={{ paddingBottom: scaleHeight(70) }}
                      renderItem={({ item }) => {
                        const selected = selectedAmenityIds.includes(item.id);
                        return (
                          <Pressable
                            style={styles.amenityItem}
                            onPress={() => {
                              toggleAmenity(item.id);
                            }}
                          >
                            <View style={styles.amenityLeft}>
                              <Text style={styles.pickerItemText}>{item.name}</Text>
                            </View>
                            <View style={[styles.amenityCheck, selected && styles.amenityCheckSelected]}>
                              {selected ? <Check size={scaleWidth(14)} color="#fff" /> : null}
                            </View>
                          </Pressable>
                        );
                      }}
                      ListEmptyComponent={
                        <Text style={styles.emptyPickerText}>
                          {amenitiesSearch.trim().length ? 'No results' : 'No amenities'}
                        </Text>
                      }
                    />
                  )}

                  <View style={styles.modalFooter}>
                    <Pressable
                      style={styles.modalDoneButton}
                      onPress={() => {
                        setAmenitiesModalVisible(false);
                        showToast('Amenities updated');
                      }}
                    >
                      <Text style={styles.modalDoneButtonText}>Done</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            </Pressable>
          </View>
        </Modal>

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your property..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={propertyDetails.description}
            onChangeText={(text) => setPropertyDetails({ ...propertyDetails, description: text })}
          />
        </View>
      </>
        )}

        <Modal
          visible={offPlanPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setOffPlanPickerOpen(false)}
        >
          <View style={{ flex: 1 }}>
            <Pressable
              style={[styles.locationModal, { paddingBottom: keyboardHeight }]}
              onPress={() => {
                Keyboard.dismiss();
                setOffPlanPickerOpen(false);
              }}
            >
              <Pressable
                style={[styles.modal, { height: windowHeight * 0.55 }]}
                onPress={() => Keyboard.dismiss()}
              >
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderSpacer} />
                  <Text style={styles.modalTitle}>Select project</Text>
                  <Pressable style={styles.modalHeaderCloseButton} onPress={() => setOffPlanPickerOpen(false)}>
                    <X size={scaleWidth(18)} color={Colors.textSecondary} />
                  </Pressable>
                </View>

                <TextInput
                  style={[styles.input, styles.searchInput]}
                  placeholder="Search project..."
                  placeholderTextColor={Colors.textSecondary}
                  value={offPlanSearch}
                  onChangeText={setOffPlanSearch}
                  autoCorrect={false}
                  autoCapitalize="none"
                  clearButtonMode="while-editing"
                />

                {isOffPlanError && (
                  <Pressable
                    style={[styles.modalButton, { marginBottom: scaleHeight(12) }]}
                    onPress={() => refetchOffPlan()}
                  >
                    <Text style={styles.modalButtonText}>Retry loading projects</Text>
                  </Pressable>
                )}

                <FlatList<OffPlanProjectListItem>
                  data={offPlanOptions}
                  keyExtractor={(item) => String(item.id)}
                  ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
                  onEndReachedThreshold={0.5}
                  onEndReached={() => {
                    if (!hasNextPage || isFetchingNextPage) return;
                    fetchNextPage();
                  }}
                  ListFooterComponent={
                    isFetchingNextPage ? (
                      <Text style={styles.emptyPickerText}>Loading more…</Text>
                    ) : null
                  }
                  renderItem={({ item }) => {
                    const thumbUrl = item.media?.[0]?.upload?.url;
                    return (
                      <Pressable
                        style={styles.offPlanItem}
                        onPress={() => {
                          const referenceId = item.reference_id ?? '';
                          setPropertyDetails({
                            ...propertyDetails,
                            offPlanProjectId: item.id,
                            offPlanProjectReferenceId: referenceId,
                            offPlanProjectTitle: item.title,
                          });

                          // OFF_PLAN: uses the selected project's reference_id.
                          setDraftPropertyReferenceId(referenceId || null);

                          setOffPlanSearch('');
                          setOffPlanPickerOpen(false);
                        }}
                      >
                        <View style={styles.offPlanThumb}>
                          {thumbUrl ? (
                            <Image
                              source={{ uri: thumbUrl }}
                              style={styles.offPlanThumbImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.offPlanThumbPlaceholder} />
                          )}
                        </View>
                        <Text style={styles.offPlanTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                      </Pressable>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={styles.emptyPickerText}>
                      {isOffPlanLoading
                        ? 'Loading projects...'
                        : offPlanSearch.trim().length
                          ? 'No projects match your search'
                          : 'No projects'}
                    </Text>
                  }
                />
              </Pressable>
            </Pressable>
          </View>
        </Modal>

        <View style={styles.bottomPadding} />
        </Animated.View>
      </ScrollView>

      <Modal
        visible={locationPicker !== null && detailsFlow === 'ready_step_3'}
        transparent
        animationType="fade"
        onRequestClose={() => setLocationPicker(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={[styles.locationModal, { paddingBottom: keyboardHeight }]}
            onPress={() => {
              Keyboard.dismiss();
              setLocationPicker(null);
            }}
          >
            <View
              style={[styles.modal, { height: windowHeight * 0.55 }]}
              onStartShouldSetResponder={() => true}
              onResponderRelease={() => Keyboard.dismiss()}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderSpacer} />
                <Text style={styles.modalTitle}>
                  {locationPicker === 'emirate'
                    ? 'Select Emirate'
                    : locationPicker === 'district'
                      ? 'Select District'
                      : locationPicker === 'building'
                        ? 'Select Building'
                        : 'Select Area'}
                </Text>
                <Pressable style={styles.modalHeaderCloseButton} onPress={() => setLocationPicker(null)}>
                  <X size={scaleWidth(18)} color={Colors.textSecondary} />
                </Pressable>
              </View>

              {(locationPicker === 'district' || locationPicker === 'building' || locationPicker === 'area') && (
                <TextInput
                  style={[styles.input, styles.searchInput]}
                  placeholder={`Search ${
                    locationPicker === 'district'
                      ? 'districts'
                      : locationPicker === 'building'
                        ? 'buildings'
                        : 'areas'
                  }...`}
                  placeholderTextColor={Colors.textSecondary}
                  value={locationPicker === 'district' ? districtSearch : locationSearch}
                  onChangeText={locationPicker === 'district' ? setDistrictSearch : setLocationSearch}
                  autoCorrect={false}
                  autoCapitalize="none"
                  clearButtonMode="while-editing"
                />
              )}

              {locationPicker === 'emirate' ? (
                <FlatList
                  data={emirateOptions.filter((e) =>
                    e.name.toLowerCase().includes(emirateSearch.trim().toLowerCase())
                  )}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.pickerItem}
                      onPress={() => {
                        setPropertyDetails({
                          ...propertyDetails,
                          emirateId: item.id,
                          emirateName: item.name,
                          districtId: null,
                          districtName: '',
                          building: '',
                          area: '',
                        });
                        setDistrictSearch('');
                        setLocationSearch('');
                        setLocationPicker(null);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{item.name}</Text>
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    isEmiratesLoading ? (
                      <Text style={styles.emptyPickerText}>Loading emirates...</Text>
                    ) : (
                      <Text style={styles.emptyPickerText}>No emirates found.</Text>
                    )
                  }
                />
              ) : locationPicker === 'district' ? (
                <FlatList
                  data={districtOptions.filter((d) =>
                    d.name.toLowerCase().includes(districtSearch.trim().toLowerCase())
                  )}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.pickerItem}
                      onPress={() => {
                        setPropertyDetails({
                          ...propertyDetails,
                          districtId: item.id,
                          districtName: item.name,
                          building: '',
                          area: '',
                        });
                        setLocationSearch('');
                        setLocationPicker(null);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{item.name}</Text>
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    isDistrictsLoading ? (
                      <Text style={styles.emptyPickerText}>Loading districts...</Text>
                    ) : (
                      <Text style={styles.emptyPickerText}>No districts found.</Text>
                    )
                  }
                />
              ) : locationPicker === 'building' ? (
                <FlatList
                  data={buildingsOptions.filter((b) =>
                    b.name.toLowerCase().includes(locationSearch.trim().toLowerCase())
                  )}
                  keyExtractor={(item) => `${item.id}-${item.slug}`}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.pickerItem}
                      onPress={() => {
                        setPropertyDetails({
                          ...propertyDetails,
                          building: item.slug,
                          area: '',
                        });
                        setLocationSearch('');
                        setLocationPicker(null);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{item.name}</Text>
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    isBuildingsLoading ? (
                      <Text style={styles.emptyPickerText}>Loading buildings...</Text>
                    ) : (
                      <Text style={styles.emptyPickerText}>No buildings found.</Text>
                    )
                  }
                />
              ) : (
                <FlatList
                  data={(areasOptions ?? []).filter((a) =>
                    a.name.toLowerCase().includes(locationSearch.trim().toLowerCase())
                  )}
                  keyExtractor={(item) => `${item.id}-${item.slug}`}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.pickerItem}
                      onPress={() => {
                        setPropertyDetails({
                          ...propertyDetails,
                          area: item.slug,
                        });
                        setLocationSearch('');
                        setLocationPicker(null);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{item.name}</Text>
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    isAreasLoading ? (
                      <Text style={styles.emptyPickerText}>Loading areas...</Text>
                    ) : (
                      <Text style={styles.emptyPickerText}>No areas found.</Text>
                    )
                  }
                />
              )}
            </View>
          </Pressable>
        </View>
      </Modal>

      {(() => {
        const isReadyStep1Valid = Boolean(propertyDetails.title?.trim());
        const isReadyStep3Valid = Boolean(propertyDetails.emirateId) && Boolean(propertyDetails.districtId);
        const isReadyStep4DescriptionValid = Boolean(propertyDetails.description?.trim());
        const hasAnyImages = selectedImages.length > 0;
        const areAllImagesAttached =
          hasAnyImages && selectedImages.every((img) => typeof img.attachId === 'number' && !img.uploading);

        const isNextBlocked =
          (detailsFlow === 'ready_step_1' && !isReadyStep1Valid) ||
          (detailsFlow === 'ready_step_3' && !isReadyStep3Valid) ||
          (detailsFlow === 'ready_step_4' && !isReadyStep4DescriptionValid);

        const isPublishBlocked =
          (detailsFlow === 'ready_step_4' && (!isReadyStep4DescriptionValid || !areAllImagesAttached)) ||
          (detailsFlow === 'offplan_project' && !propertyDetails.offPlanProjectTitle) ||
          (detailsFlow === 'generic_publish' && false) ||
          (detailsFlow === 'status' && propertyDetails.developmentStatus === 'GENERIC' && false);

        const primaryDisabled = isPublishing || isAdvancingFlow || isNextBlocked || isPublishBlocked;

        return (
          <View style={[styles.wizardFooter, { marginBottom: tabBarHeight }]}>

        <Pressable
          style={[styles.wizardButton, styles.wizardButtonSecondary]}
          disabled={isPublishing || isAdvancingFlow}
          onPress={async () => {
            if (detailsFlow === 'status') {
              // Highlights are optional, but allow navigating back to the highlight picker.
              setStep('selectHighlights');
              return;
            }
            if (detailsFlow === 'generic_publish') {
              // Highlights are optional; return to details flow instead.
              setStep('details');
              return;
            }
            if (detailsFlow === 'offplan_project') {
              await resetReadyPropertyFlow();
              await animateToFlow('status', 'back');
              return;
            }
            if (detailsFlow === 'ready_step_1') {
              await resetReadyPropertyFlow();
              await animateToFlow('status', 'back');
              return;
            }
            if (detailsFlow === 'ready_step_2') {
              await animateToFlow('ready_step_1', 'back');
              return;
            }
            if (detailsFlow === 'ready_step_3') {
              await animateToFlow('ready_step_2', 'back');
              return;
            }
            if (detailsFlow === 'ready_step_4') {
              await animateToFlow('ready_step_3', 'back');
              return;
            }
          }}
        >
          <Text style={[styles.wizardButtonText, styles.wizardButtonTextSecondary]}>Back</Text>
        </Pressable>

        <Pressable
          style={[styles.wizardButton, primaryDisabled && styles.publishButtonDisabled]}
          disabled={primaryDisabled}
          onPress={async () => {
            if (detailsFlow === 'status') {
              if (propertyDetails.developmentStatus === 'READY') {
                try {
                  setIsAdvancingFlow(true);
                  const ref = await ensureDraftPropertyReferenceId();
                  if (!ref) {
                    Alert.alert('Failed to create draft', 'Please try again.');
                    return;
                  }
                  await animateToFlow('ready_step_1', 'forward');
                } finally {
                  setIsAdvancingFlow(false);
                }
                return;
              }

              if (propertyDetails.developmentStatus === 'OFF_PLAN') {
                await animateToFlow('offplan_project', 'forward');
                return;
              }

              if (propertyDetails.developmentStatus === 'GENERIC') {
                // Generic videos can be published immediately
                await handlePublish();
                return;
              }
            }

            if (detailsFlow === 'ready_step_1') {
              if (!isReadyStep1Valid) {
                Alert.alert('Missing title', 'Please enter a title to continue.');
                return;
              }
              await animateToFlow('ready_step_2', 'forward');
              return;
            }
            if (detailsFlow === 'ready_step_2') {
              await animateToFlow('ready_step_3', 'forward');
              return;
            }
            if (detailsFlow === 'ready_step_3') {
              if (!isReadyStep3Valid) {
                Alert.alert('Missing location', 'Please select Emirate and District to continue.');
                return;
              }
              await animateToFlow('ready_step_4', 'forward');
              return;
            }

            // Publish flows
            if (detailsFlow === 'ready_step_4' || detailsFlow === 'offplan_project' || detailsFlow === 'generic_publish') {
              if (detailsFlow === 'ready_step_4') {
                if (!isReadyStep4DescriptionValid) {
                  Alert.alert('Missing description', 'Please enter a description to publish.');
                  return;
                }
                if (!areAllImagesAttached) {
                  Alert.alert('Images still uploading', 'Please wait until all images finish uploading.');
                  return;
                }
              }
              await handlePublish();
              return;
            }
          }}
        >
          <Text style={styles.wizardButtonText}>
            {detailsFlow === 'ready_step_4' ||
            detailsFlow === 'offplan_project' ||
            detailsFlow === 'generic_publish' ||
            (detailsFlow === 'status' && propertyDetails.developmentStatus === 'GENERIC')
              ? isPublishing
                ? 'Publishing...'
                : 'Publish'
              : isAdvancingFlow
                ? 'Loading...'
                : 'Next'}
          </Text>
        </Pressable>
          </View>
        );
      })()}
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: Colors.text,
  },
  publishButton: {
    backgroundColor: Colors.bronze,
    borderRadius: scaleWidth(12),
    paddingHorizontal: scaleWidth(14),
    paddingVertical: scaleHeight(10),
    minWidth: scaleWidth(110),
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishButtonText: {
    fontSize: scaleFont(14),
    fontWeight: '800',
    color: Colors.textLight,
  },
  wizardFooter: {
    flexDirection: 'row',
    gap: scaleWidth(12),
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleHeight(16),
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  wizardButton: {
    flex: 1,
    paddingVertical: scaleHeight(14),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bronze,
  },
  wizardButtonSecondary: {
    backgroundColor: Colors.textLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  wizardButtonText: {
    fontSize: scaleFont(15),
    fontWeight: '700',
    color: Colors.textLight,
  },
  summaryValueText: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: scaleHeight(6),
  },
  wizardButtonTextSecondary: {
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: scaleWidth(20),
  },
  authGateCard: {
    marginTop: scaleHeight(20),
    backgroundColor: Colors.textLight,
    borderRadius: scaleWidth(16),
    padding: scaleWidth(20),
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  authGateTitle: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: Colors.text,
    marginBottom: scaleHeight(6),
  },
  authGateDescription: {
    fontSize: scaleFont(14),
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: scaleFont(20),
    marginBottom: scaleHeight(14),
  },
  authGateButton: {
    width: '100%',
    backgroundColor: Colors.bronze,
    paddingVertical: scaleHeight(14),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    marginBottom: scaleHeight(12),
  },
  authGateButtonText: {
    color: Colors.textLight,
    fontSize: scaleFont(16),
    fontWeight: '700',
  },
  authGateLink: {
    color: Colors.brown,
    fontSize: scaleFont(14),
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: Colors.text,
    marginBottom: scaleHeight(8),
  },
  sectionDescription: {
    fontSize: scaleFont(14),
    color: Colors.textSecondary,
    marginBottom: scaleHeight(32),
    lineHeight: scaleFont(22),
  },
  optionsContainer: {
    gap: scaleWidth(16),
  },
  uploadOption: {
    backgroundColor: Colors.textLight,
    borderRadius: scaleWidth(16),
    padding: scaleWidth(24),
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  uploadOptionIcon: {
    width: scaleWidth(64),
    height: scaleWidth(64),
    borderRadius: scaleWidth(32),
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scaleHeight(16),
  },
  uploadOptionTitle: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: Colors.text,
    marginBottom: scaleHeight(4),
  },
  uploadOptionDescription: {
    fontSize: scaleFont(14),
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  disabledText: {
    color: Colors.textSecondary,
    opacity: 0.5,
  },
  form: {
    flex: 1,
    padding: scaleWidth(20),
  },
  formSection: {
    marginBottom: scaleHeight(24),
  },
  imageDropzone: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: scaleWidth(12),
    paddingVertical: scaleHeight(16),
    paddingHorizontal: scaleWidth(12),
    backgroundColor: Colors.textLight,
  },
  imageDropzoneText: {
    fontSize: scaleFont(14),
    fontWeight: '800',
    color: Colors.text,
  },
  imageDropzoneHint: {
    marginTop: scaleHeight(6),
    fontSize: scaleFont(12),
    color: Colors.textSecondary,
  },
  imageThumbRow: {
    marginTop: scaleHeight(10),
  },
  imageThumbWrap: {
    marginRight: scaleWidth(10),
    borderRadius: scaleWidth(10),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  imageThumb: {
    width: scaleWidth(80),
    height: scaleWidth(80),
  },
  imageUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: scaleWidth(12),
  },
  imageThumbRemove: {
    position: 'absolute',
    top: scaleWidth(6),
    right: scaleWidth(6),
    width: scaleWidth(22),
    height: scaleWidth(22),
    borderRadius: scaleWidth(11),
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(12),
  },
  checkbox: {
    width: scaleWidth(22),
    height: scaleWidth(22),
    borderRadius: scaleWidth(6),
    borderWidth: 1,
    borderColor: 'black',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.bronze,
    borderColor: Colors.bronze,
  },
  checkboxTextWrap: {
    flex: 1,
  },
  helperText: {
    fontSize: scaleFont(12),
    color: Colors.textSecondary,
    marginTop: scaleHeight(4),
  },
  amenitiesChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scaleWidth(8),
    marginTop: scaleHeight(10),
  },
  amenitiesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(6),
    paddingVertical: scaleHeight(8),
    paddingHorizontal: scaleWidth(10),
    borderRadius: scaleWidth(999),
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.textLight,
    maxWidth: '100%',
  },
  amenitiesChipText: {
    color: Colors.text,
    fontSize: scaleFont(12),
    fontWeight: '700',
    maxWidth: scaleWidth(220),
  },
  modalFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: scaleWidth(14),
    paddingVertical: scaleHeight(12),
    backgroundColor: Colors.textLight,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalDoneButton: {
    backgroundColor: Colors.bronze,
    borderRadius: scaleWidth(12),
    paddingVertical: scaleHeight(12),
    alignItems: 'center',
  },
  modalDoneButtonText: {
    color: Colors.textLight,
    fontSize: scaleFont(14),
    fontWeight: '800',
  },
  formLabel: {
    fontSize: scaleFont(15),
    fontWeight: '600',
    color: Colors.text,
    marginBottom: scaleHeight(8),
  },
  formLabelSmall: {
    fontSize: scaleFont(13),
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: scaleHeight(6),
  },
  input: {
    backgroundColor: Colors.textLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: scaleWidth(12),
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(14),
    fontSize: scaleFont(16),
    color: Colors.text,
  },
  textArea: {
    minHeight: scaleHeight(120),
    paddingTop: scaleHeight(14),
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scaleWidth(8),
  },
  chip: {
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(18),
    borderRadius: scaleWidth(20),
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.textLight,
  },
  chipSelected: {
    backgroundColor: Colors.bronze,
    borderColor: Colors.bronze,
  },
  chipText: {
    fontSize: scaleFont(14),
    fontWeight: '500',
    color: Colors.text,
  },
  chipTextSelected: {
    color: Colors.textLight,
  },
  radioRow: {
    flexDirection: 'column',
    //gap: scaleWidth(26),
    flexWrap: 'wrap',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(8),
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(16),
    borderRadius: scaleWidth(12),
    borderWidth: 1,
    borderColor: Colors.border,
    marginLeft: scaleWidth(8),
    width: "90%",
    height: scaleHeight(80),
    marginTop: scaleHeight(20),
  },
  radioOptionSelected: {
    borderColor: Colors.bronze,
  },
  radioOuter: {
    width: scaleWidth(20),
    height: scaleWidth(20),
    borderRadius: scaleWidth(10),
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  radioOuterSelected: {
    borderColor: Colors.bronze,
  },
  radioInner: {
    width: scaleWidth(10),
    height: scaleWidth(10),
    borderRadius: scaleWidth(5),
    backgroundColor: Colors.bronze,
  },
  radioLabel: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: Colors.text,
  },
  formRow: {
    flexDirection: 'row',
    gap: scaleWidth(16),
    marginBottom: scaleHeight(24),
  },
  formColumn: {
    flex: 1,
  },
  locationInput: {
    backgroundColor: Colors.textLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: scaleWidth(12),
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: scaleWidth(10),
  },
  locationInputText: {
    fontSize: scaleFont(16),
    color: Colors.text,
  },
  placeholder: {
    color: Colors.textSecondary,
  },
  toastContainer: {
    position: 'absolute',
    top: scaleHeight(64),
    left: scaleWidth(16),
    right: scaleWidth(16),
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  toastInner: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(14),
    borderRadius: scaleWidth(10),
    maxWidth: '100%',
  },
  toastText: {
    color: '#fff',
    fontSize: scaleFont(13),
    fontWeight: '800',
  },

  publishingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  publishingOverlayText: {
    marginTop: scaleHeight(12),
    fontSize: scaleFont(14),
    fontWeight: '800',
    color: Colors.text,
  },

  bottomPadding: {
    height: scaleHeight(120),
  },
  editContent: {
    flex: 1,
  },
  videoPreviewContainer: {
    width: '100%',
    aspectRatio: 9/16,
    backgroundColor: Colors.text,
    borderRadius: scaleWidth(16),
    overflow: 'hidden',
    marginBottom: scaleHeight(24),
    position: 'relative',
  },
  videoPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  textOverlayPreview: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
  },
  textTop: {
    top: scaleHeight(20),
  },
  textCenter: {
    top: '50%',
    marginTop: -scaleHeight(20),
  },
  textBottom: {
    bottom: scaleHeight(20),
  },
  overlayTextPreview: {
    fontWeight: '700',
    textAlign: 'center',
  },
  controlSection: {
    marginBottom: scaleHeight(20),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaleHeight(12),
  },
  modalHeaderSpacer: {
    width: scaleWidth(24),
  },
  modalHeaderCloseButton: {
    width: scaleWidth(24),
    height: scaleWidth(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlTitle: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: Colors.text,
    marginBottom: scaleHeight(12),
  },
  textInput: {
    backgroundColor: Colors.textLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: scaleWidth(12),
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(14),
    fontSize: scaleFont(16),
    color: Colors.text,
    marginBottom: scaleHeight(16),
  },
  controlSubsection: {
    marginBottom: scaleHeight(16),
  },
  controlLabel: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: Colors.text,
    marginBottom: scaleHeight(8),
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: scaleWidth(8),
  },
  controlButton: {
    flex: 1,
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(12),
    borderRadius: scaleWidth(8),
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.textLight,
    alignItems: 'center',
  },
  controlButtonSelected: {
    backgroundColor: Colors.bronze,
    borderColor: Colors.bronze,
  },
  controlButtonText: {
    fontSize: scaleFont(13),
    fontWeight: '600',
    color: Colors.text,
  },
  controlButtonTextSelected: {
    color: Colors.textLight,
  },
  editFooter: {
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleHeight(16),
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  continueButton: {
    backgroundColor: Colors.bronze,
    borderRadius: scaleWidth(12),
    paddingVertical: scaleHeight(14),
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: Colors.textLight,
  },
  deleteButton: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#FF3B30',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  locationModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  modal: {
    width: '100%',
    backgroundColor: Colors.background,
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleHeight(24),
    borderTopLeftRadius: scaleWidth(20),
    borderTopRightRadius: scaleWidth(20),
  },
  modalTitle: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: scaleFont(14),
    color: Colors.textSecondary,
    marginBottom: scaleHeight(24),
    lineHeight: scaleFont(20),
  },
  modalButtonGroup: {
    flexDirection: 'row',
    gap: scaleWidth(12),
  },
  modalButton: {
    flex: 1,
    backgroundColor: Colors.bronze,
    borderRadius: scaleWidth(12),
    paddingVertical: scaleHeight(14),
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: Colors.textLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalButtonText: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: Colors.textLight, 
  },
  modalButtonTextSecondary: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: Colors.text,
  },

  disabledInput: {
    opacity: 0.7,
  },
  pickerItem: {
    paddingVertical: scaleHeight(14),
  },
  pickerItemText: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: Colors.text,
  },
  listSeparator: {
    height: 1,
    backgroundColor: Colors.border,
    opacity: 0.2,
  },
  emptyPickerText: {
    paddingVertical: scaleHeight(16),
    color: Colors.textSecondary,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scaleHeight(12),
    paddingHorizontal: scaleWidth(12),
  },
  amenityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(10),
    flexShrink: 1,
  },
  amenityIcon: {
    width: scaleWidth(22),
    height: scaleWidth(22),
    resizeMode: 'contain',
  },
  amenityIconFallback: {
    width: scaleWidth(22),
    height: scaleWidth(22),
    borderRadius: scaleWidth(6),
    backgroundColor: Colors.border,
  },
  amenityCheck: {
    width: scaleWidth(22),
    height: scaleWidth(22),
    borderRadius: scaleWidth(6),
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.textLight,
  },
  amenityCheckSelected: {
    backgroundColor: Colors.bronze,
    borderColor: Colors.bronze,
  },
  searchInput: {
    marginTop: scaleHeight(12),
    marginBottom: scaleHeight(8),
  },

  offPlanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(12),
    paddingVertical: scaleHeight(12),
  },
  offPlanThumb: {
    width: scaleWidth(80),
    height: scaleWidth(68),
    borderRadius: scaleWidth(10),
    overflow: 'hidden',
    backgroundColor: Colors.textLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  offPlanThumbImage: {
    width: '100%',
    height: '100%',
  },
  offPlanThumbPlaceholder: {
    flex: 1,
    backgroundColor: Colors.border,
    opacity: 0.25,
  },
  offPlanTitle: {
    flex: 1,
    fontSize: scaleFont(15),
    fontWeight: '600',
    color: Colors.text,
  },

  highlightsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 0,
  },
  highlightsSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    borderTopLeftRadius: scaleWidth(20),
    borderTopRightRadius: scaleWidth(20),
    overflow: 'hidden',
  },
  highlightsHeader: {
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(14),
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  highlightsTitle: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: Colors.text,
  },
  highlightsBack: {
    fontSize: scaleFont(14),
    fontWeight: '700',
    color: Colors.bronze,
  },
  highlightsClose: {
    fontSize: scaleFont(14),
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  highlightsVideoContainer: {
    width: '100%',
    alignSelf: 'stretch',
    // Fill available space above the highlight controls.
    flex: 1,
    minHeight: 0,
    backgroundColor: '#000',
    borderRadius: 0,
    overflow: 'hidden',
  },
  highlightsVideo: {
    width: '100%',
    height: '100%',
    flex: 1,
    alignSelf: 'stretch',
  },
  highlightsVideoControls: {
    position: 'absolute',
    // Lift controls above the scrubber overlay
    bottom: scaleHeight(56),
    left: scaleWidth(10),
    flexDirection: 'row',
    gap: scaleWidth(10),
    zIndex: 8,
  },
  highlightsVideoControlButton: {
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: scaleWidth(20),
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightsScroll: {
    flex: 1,
  },
  highlightsContent: {
    paddingHorizontal: scaleWidth(16),
    paddingTop: scaleHeight(10),
    gap: scaleHeight(10),
    // Let the controls take only the space they need; video fills the rest.
    flexGrow: 0,
    flexShrink: 0,
  },
  highlightsPicker: {
    paddingRight: scaleWidth(16),
    gap: scaleWidth(8),
  },
  highlightsPickerChip: {
    paddingHorizontal: scaleWidth(14),
    paddingVertical: scaleHeight(8),
    borderRadius: scaleWidth(2),
    borderBottomWidth: 2.5,
    borderColor: Colors.border,
    backgroundColor: Colors.textLight,
  },
  highlightsPickerChipActive: {
    //backgroundColor: Colors.bronze,
    borderBottomColor: Colors.bronze,
  },
  highlightsPickerChipText: {
    fontSize: scaleFont(13),
    fontWeight: '800',
    color: Colors.text,
  },
  highlightsPickerChipTextActive: {
    color: Colors.bronze,
  },
  highlightsVideoOuter: {
    width: '100%',
    // Give the video more of the sheet height so there's no unused white area below.
    flex: 2,
    minHeight: 0,
    alignSelf: 'stretch',
    // Ensure no inset around the edge-to-edge video.
    paddingHorizontal: 0,
    marginHorizontal: 0,
    marginTop: 0,
  },
  highlightsScrubberOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: scaleWidth(10),
    paddingBottom: scaleHeight(10),
    paddingTop: scaleHeight(10),
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 4,
  },
  highlightsNudgeZoneLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: scaleWidth(20),
    zIndex: 6,
  },
  highlightsNudgeZoneRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: scaleWidth(20),
    zIndex: 6,
  },
  highlightsTimeRowOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scaleHeight(6),
  },
  highlightsTimeTextOverlay: {
    fontSize: scaleFont(12),
    fontWeight: '800',
    color: Colors.textLight,
  },
  highlightsCirclePicker: {
    paddingTop: scaleHeight(2),
    paddingBottom: 0,
    gap: scaleWidth(14),
    paddingRight: scaleWidth(16),
    flexDirection: 'row',
    alignItems: 'center',
  },
  highlightsCircleItem: {
    alignItems: 'center',
    width: scaleWidth(72),
  },
  highlightsCircle: {
    width: scaleWidth(54),
    height: scaleWidth(54),
    borderRadius: scaleWidth(27),
    backgroundColor: Colors.textLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightsCircleActive: {
    backgroundColor: Colors.textLight,
    borderColor: Colors.bronze,
  },
  highlightsCircleAdd: {
    width: scaleWidth(54),
    height: scaleWidth(54),
    borderRadius: scaleWidth(27),
    backgroundColor: Colors.textLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightsCircleAddText: {
    fontSize: scaleFont(26),
    fontWeight: '400',
    color: Colors.bronze,
    marginTop: -2,
  },
  highlightsAddOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: scaleWidth(20),
  },
  highlightsAddModal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.background,
    borderRadius: scaleWidth(16),
    padding: scaleWidth(16),
  },
  highlightsAddTitle: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: Colors.text,
    marginBottom: scaleHeight(12),
  },
  highlightsAddGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: scaleWidth(14),
  },
  highlightsAddCircleItem: {
    width: scaleWidth(86),
    alignItems: 'center',
    marginBottom: scaleHeight(10),
  },
  highlightsAddCircle: {
    width: scaleWidth(64),
    height: scaleWidth(64),
    borderRadius: scaleWidth(32),
    backgroundColor: Colors.textLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightsAddCircleLabel: {
    marginTop: scaleHeight(8),
    fontSize: scaleFont(13),
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  highlightsAddCancel: {
    marginTop: scaleHeight(14),
    paddingVertical: scaleHeight(12),
    alignItems: 'center',
    borderRadius: scaleWidth(12),
    borderWidth: 1,
    borderColor: Colors.border,
  },
  highlightsAddCancelText: {
    fontSize: scaleFont(14),
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  highlightsCircleTime: {
    marginTop: scaleHeight(6),
    fontSize: scaleFont(12),
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  highlightsCircleTimeActive: {
    color: Colors.bronze,
  },
  highlightsDoneButton: {
    flex: 1,
    marginTop: 0,
    backgroundColor: Colors.bronze,
    // borderWidth:1,
    // borderColor: Colors.bronze,
    borderRadius: scaleWidth(12),
    paddingVertical: scaleHeight(12),
    alignItems: 'center',
  },
  highlightsDoneButtonText: {
    color: Colors.textLight,
    fontSize: scaleFont(14),
    fontWeight: '800',
  },
  highlightsBody: {
    paddingTop: scaleHeight(2),
  },
  highlightsStepTitle: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: Colors.text,
     marginTop: scaleHeight(14),
  },
  highlightsStepSubtitle: {
    //marginTop: scaleHeight(2),
    marginBottom: scaleHeight(8),
    fontSize: scaleFont(12),
    color: Colors.textSecondary,
    lineHeight: scaleFont(18),
  },
  highlightsActionsRow: {
    marginTop: scaleHeight(14),
    flexDirection: 'row',
    gap: scaleWidth(12),
  },
  highlightsSelectButton: {
    flex: 1,
    backgroundColor: Colors.textLight,
    borderWidth: 1,
    borderColor: Colors.bronze,
    borderRadius: scaleWidth(12),
    paddingVertical: scaleHeight(12),
    alignItems: 'center',
    marginTop: 0,
  },
  highlightsSelectButtonText: {
    color: Colors.bronze,
    fontSize: scaleFont(14),
    fontWeight: '800',
  },
  highlightsNextButton: {
    flex: 1,
    backgroundColor: Colors.textLight,
    borderRadius: scaleWidth(12),
    paddingVertical: scaleHeight(12),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  highlightsNextButtonText: {
    color: Colors.text,
    fontSize: scaleFont(14),
    fontWeight: '800',
  },
});
