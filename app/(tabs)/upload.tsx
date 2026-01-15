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
} from 'lucide-react-native';
import { uploadVideoWithProperty } from '@/utils/videosApi';
import { Colors } from '@/constants/colors';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { PropertyType, TransactionType } from '@/types';
import * as ImagePicker from 'expo-image-picker';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuthStore } from '@/stores/authStore';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  District,
  Emirate,
  OffPlanProjectListItem,
  fetchDistricts,
  fetchEmirates,
  fetchOffPlanProjects,
} from '@/utils/propertiesApi';

export default function UploadScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false } as any);
  }, [navigation]);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sessionTokens = useAuthStore((s) => s.session?.tokens) ?? null;
  const { canPost, tier, postsUsed, postsLimit, refreshSubscription } = useSubscription();
  const [step, setStep] = useState<'select' | 'edit' | 'selectHighlights' | 'details'>('select');
  const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);
  const [overlayText, setOverlayText] = useState('');
  const [overlayTextSize, setOverlayTextSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [overlayTextColor, setOverlayTextColor] = useState<'white' | 'black' | 'yellow'>('white');
  const [overlayTextPosition, setOverlayTextPosition] = useState<'top' | 'center' | 'bottom'>('center');
  const [showShareModal, setShowShareModal] = useState(false);

  type HighlightStep = string;

  const DEFAULT_HIGHLIGHT_OPTIONS = ['Kitchen', 'Living room', 'Bedroom', 'Bathroom'] as const;
  type HighlightOption = (typeof DEFAULT_HIGHLIGHT_OPTIONS)[number];

  const [highlightSteps, setHighlightSteps] = useState<HighlightStep[]>([...DEFAULT_HIGHLIGHT_OPTIONS]);
  const [activeHighlightStepIndex, setActiveHighlightStepIndex] = useState(0);
  const [highlightsByRoom, setHighlightsByRoom] = useState<Partial<Record<HighlightStep, number>>>({});
  const [highlightTimestamps, setHighlightTimestamps] = useState<
    { room: string; start_time: string; end_time: number }[]
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

  const [offPlanPickerOpen, setOffPlanPickerOpen] = useState(false);
  const [offPlanSearch, setOffPlanSearch] = useState('');

  const [propertyDetails, setPropertyDetails] = useState({
    title: '',
    price: '',
    // Determines whether to show Listing Type (Ready property) or hide it (Off plan)
    developmentStatus: 'READY' as 'READY' | 'OFF_PLAN',
    listingType: 'RENT' as TransactionType,
    propertyType: 'apartment' as PropertyType,
    bedrooms: '',
    bathrooms: '',
    sizeSqft: '',

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
    longitude: '',
    latitude: '',

    description: '',
  });

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

  const {
    data: offPlanPages,
    isLoading: isOffPlanLoading,
    isError: isOffPlanError,
    refetch: refetchOffPlan,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['properties', 'offplan', { view: 'list', order_by: 'created_at', size: 'xs', limit: 20 }],
    queryFn: ({ pageParam }) => fetchOffPlanProjects({ page: Number(pageParam ?? 1), limit: 20 }),
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

  useEffect(() => {
    if (step !== 'details') return;
    if (!offPlanPages) return;
    // Debug: log off-plan API response when entering Property Details step
  }, [step, offPlanPages]);

  // TODO: Replace Building/Area static lists with API endpoints when available.

  const BUILDINGS_BY_DISTRICT: Record<string, string[]> = {
    'Downtown Dubai': ['Burj Khalifa', 'Address Downtown', 'South Ridge'],
    'Dubai Marina': ['Marina Gate', 'Cayan Tower', 'Princess Tower'],
    Jumeirah: ['City Walk', 'La Mer'],
    'Business Bay': ['Damac Towers', 'The Opus'],
  };

  const AREAS_BY_BUILDING: Record<string, string[]> = {
    'Marina Gate': ['Marina Gate 1', 'Marina Gate 2'],
    'Burj Khalifa': ['Downtown'],
  };

  const getBuildingOptions = () => BUILDINGS_BY_DISTRICT[propertyDetails.districtName] ?? [];
  const getAreaOptions = () => AREAS_BY_BUILDING[propertyDetails.building] ?? [];

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

  const checkSubscription = () => {
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

  const handlePublish = async () => {
    if (!checkSubscription()) return;

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

      // If user never tapped “Set <room>”, fall back to whatever is stored in highlightsByRoom.
      const timestampsFromMap = Object.entries(highlightsByRoom)
        .filter(([, value]) => value != null)
        .map(([room, value]) => ({
          room,
          start_time: formatTimeMmSs(value as number),
          end_time: 0,
        }));

      const roomTimestamps = highlightTimestamps.length ? highlightTimestamps : timestampsFromMap;

      if (!roomTimestamps.length) {
        Alert.alert('Missing highlights', 'Please select at least one highlight timestamp.');
        return;
      }

      try {
        const fileName = selectedVideoUri.split('/').pop() || 'video.mp4';
        const res = await uploadVideoWithProperty({
          videoFile: { uri: selectedVideoUri, name: fileName, type: 'video/mp4' },
          propertyReference: propertyDetails.offPlanProjectReferenceId,
          roomTimestamps,
          uploadToCloudflare: true,
          generateSubtitles: true,
          agentId: 1,
        });

        if (res?.success) {
          Alert.alert('Success', res?.message || 'Uploaded successfully.');
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
      }

      return;
    }

    // READY: existing mock publish flow
    const currentMonth = new Date().toISOString().slice(0, 7);
    const current = parseInt(await AsyncStorage.getItem(`@posts_used_${currentMonth}`) || '0');
    await AsyncStorage.setItem(`@posts_used_${currentMonth}`, (current + 1).toString());
    await refreshSubscription();

    Alert.alert(
      'Property Published!',
      'Your property has been published successfully.',
      [
        {
          text: 'View Property',
          onPress: () => router.replace('/(tabs)/profile'),
        },
        {
          text: 'Upload Another',
          onPress: () => {
            setStep('select');
            setPropertyDetails({
              title: '',
              price: '',
              developmentStatus: 'READY',
              listingType: 'RENT',
              propertyType: 'apartment',
              bedrooms: '',
              bathrooms: '',
              sizeSqft: '',

              offPlanProjectId: null,
              offPlanProjectReferenceId: '',
              offPlanProjectTitle: '',

              emirateId: null,
              emirateName: '',
              districtId: null,
              districtName: '',
              building: '',
              area: '',
              longitude: '',
              latitude: '',

              description: '',
            });
          },
        },
      ]
    );
  };

  const handleShareModalClose = () => {
    setShowShareModal(false);
    setStep('details');
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

  // Note: upload requires an authenticated session + tokens from OTP verification.
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
       return [...prev, nextName];
     });
     setActiveHighlightStepIndex((prev) => prev);
     setShowAddHighlightModal(false);
   };

   const activeRoom = highlightSteps[activeHighlightStepIndex];

   const seek = async (sec: number) => {
     if (!isHighlightsVideoLoaded) return;
     try {
       await videoRef.current?.setPositionAsync(Math.max(0, sec * 1000));
       setVideoCurrentTimeSec(sec);
     } catch {
       // ignore seek errors
     }
   };

   const handleSelectThisHighlight = () => {
     setHighlightsByRoom((prev) => ({ ...prev, [activeRoom]: videoCurrentTimeSec }));

     const start_time = formatTimeMmSs(videoCurrentTimeSec);
     setHighlightTimestamps((prev) => {
       const next = [...prev];
       const idx = next.findIndex((t) => t.room === activeRoom);
       const item = { room: activeRoom, start_time, end_time: 0 };
       if (idx >= 0) next[idx] = item;
       else next.push(item);
       return next;
     });
   };

   const handleDone = () => {
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
        <Pressable onPress={() => setStep('select')}>
          <X size={scaleWidth(24)} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Property Details</Text>
        <Pressable onPress={handlePublish}>
          <Text style={styles.publishButton}>Publish</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        {propertyDetails.developmentStatus !== 'OFF_PLAN' ? (
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

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Price (AED) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 2300000"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="numeric"
                value={propertyDetails.price}
                onChangeText={(text) => setPropertyDetails({ ...propertyDetails, price: text })}
              />
            </View>
          </>
        ) : null}

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Property Status *</Text>
          <View style={styles.radioRow}>
            <Pressable
              style={styles.radioOption}
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
              style={styles.radioOption}
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
                  longitude: '',
                  latitude: '',
                });
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
          </View>
        </View>

        {propertyDetails.developmentStatus === 'READY' && (
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Listing Type *</Text>
            <View style={styles.chipRow}>
              {(['BUY', 'RENT', 'STAY'] as TransactionType[]).map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.chip,
                    propertyDetails.listingType === type && styles.chipSelected,
                  ]}
                  onPress={() => setPropertyDetails({ ...propertyDetails, listingType: type })}
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

        {propertyDetails.developmentStatus === 'OFF_PLAN' && (
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

        {propertyDetails.developmentStatus === 'READY' && (
          <>
        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Property Type *</Text>
          <View style={styles.chipRow}>
            {(['apartment', 'villa', 'townhouse', 'penthouse', 'studio'] as PropertyType[]).map((type) => (
              <Pressable
                key={type}
                style={[
                  styles.chip,
                  propertyDetails.propertyType === type && styles.chipSelected,
                ]}
                onPress={() => setPropertyDetails({ ...propertyDetails, propertyType: type })}
              >
                <Text
                  style={[
                    styles.chipText,
                    propertyDetails.propertyType === type && styles.chipTextSelected,
                  ]}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.formRow}>
          <View style={styles.formColumn}>
            <Text style={styles.formLabel}>Bedrooms *</Text>
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
            <Text style={styles.formLabel}>Bathrooms *</Text>
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
          <Text style={styles.formLabel}>Size (sqft) *</Text>
          <TextInput
            style={styles.input}
            placeholder="1200"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="numeric"
            value={propertyDetails.sizeSqft}
            onChangeText={(text) => setPropertyDetails({ ...propertyDetails, sizeSqft: text })}
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Property Location</Text>

          <Text style={styles.formLabel}>Emirate *</Text>
          <Pressable
            style={styles.locationInput}
            onPress={() => setLocationPicker('emirate')}
          >
            <Text style={[styles.locationInputText, !propertyDetails.emirateId && styles.placeholder]}>
              {propertyDetails.emirateName || 'Select emirate'}
            </Text>
            <ChevronRight size={scaleWidth(20)} color={Colors.textSecondary} />
          </Pressable>

          <Text style={[styles.formLabel, { marginTop: scaleHeight(12) }]}>District *</Text>
          <Pressable
            style={[styles.locationInput, !propertyDetails.emirateId && styles.disabledInput]}
            disabled={!propertyDetails.emirateId}
            onPress={() => setLocationPicker('district')}
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
            <ChevronRight size={scaleWidth(20)} color={Colors.textSecondary} />
          </Pressable>

          <Text style={[styles.formLabel, { marginTop: scaleHeight(12) }]}>Building</Text>
          <Pressable
            style={[styles.locationInput, !propertyDetails.districtId && styles.disabledInput]}
            disabled={!propertyDetails.districtId}
            onPress={() => setLocationPicker('building')}
          >
            <Text
              style={[
                styles.locationInputText,
                !propertyDetails.building && styles.placeholder,
                !propertyDetails.districtId && styles.disabledText,
              ]}
            >
              {propertyDetails.building || 'Select building'}
            </Text>
            <ChevronRight size={scaleWidth(20)} color={Colors.textSecondary} />
          </Pressable>

          <Text style={[styles.formLabel, { marginTop: scaleHeight(12) }]}>Area</Text>
          <Pressable
            style={[styles.locationInput, !propertyDetails.building && styles.disabledInput]}
            disabled={!propertyDetails.building}
            onPress={() => setLocationPicker('area')}
          >
            <Text
              style={[
                styles.locationInputText,
                !propertyDetails.area && styles.placeholder,
                !propertyDetails.building && styles.disabledText,
              ]}
            >
              {propertyDetails.area || 'Select area'}
            </Text>
            <ChevronRight size={scaleWidth(20)} color={Colors.textSecondary} />
          </Pressable>

          <View style={[styles.formRow, { marginTop: scaleHeight(12) }]}>
            <View style={styles.formColumn}>
              <Text style={styles.formLabel}>Longitude</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 55.2708"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="numbers-and-punctuation"
                value={propertyDetails.longitude}
                onChangeText={(text) => setPropertyDetails({ ...propertyDetails, longitude: text })}
              />
            </View>
            <View style={styles.formColumn}>
              <Text style={styles.formLabel}>Latitude</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 25.2048"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="numbers-and-punctuation"
                value={propertyDetails.latitude}
                onChangeText={(text) => setPropertyDetails({ ...propertyDetails, latitude: text })}
              />
            </View>
          </View>
        </View>

        
        <Modal
          visible={locationPicker !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setLocationPicker(null)}
        >
          <View style={{ flex: 1 }}>
            <Pressable
              style={[styles.locationModal, { paddingBottom: keyboardHeight }]}
              onPress={() => {
                Keyboard.dismiss();
                setLocationPicker(null);
              }}
            >
              <Pressable
                style={[styles.modal, { height: windowHeight * 0.7 }]}
                onPress={() => Keyboard.dismiss()}
              >
                <Text style={styles.modalTitle}>
                  {locationPicker === 'emirate'
                    ? 'Select Emirate'
                    : locationPicker === 'district'
                      ? 'Select District'
                      : locationPicker === 'building'
                        ? 'Select Building'
                        : 'Select Area'}
                </Text>

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

              {locationPicker === 'district' && (
                <TextInput
                  style={[styles.input, styles.searchInput]}
                  placeholder="Search district..."
                  placeholderTextColor={Colors.textSecondary}
                  value={districtSearch}
                  onChangeText={setDistrictSearch}
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
                <FlatList<string>
                  data={
                    locationPicker === 'building'
                      ? getBuildingOptions()
                      : getAreaOptions()
                  }
                  keyExtractor={(item) => item}
                  ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.pickerItem}
                      onPress={() => {
                        if (locationPicker === 'building') {
                          setPropertyDetails({
                            ...propertyDetails,
                            building: item,
                            area: '',
                          });
                        }
                        if (locationPicker === 'area') {
                          setPropertyDetails({
                            ...propertyDetails,
                            area: item,
                          });
                        }
                        setLocationPicker(null);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{item}</Text>
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyPickerText}>
                      {locationPicker === 'building'
                        ? 'Select a district first'
                        : locationPicker === 'area'
                          ? 'Select a building first'
                          : 'No options'}
                    </Text>
                  }
                />
              )}
              </Pressable>
            </Pressable>
          </View>
        </Modal>

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Description</Text>
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
                <Pressable
                  style={styles.modalCloseButton}
                  onPress={() => setOffPlanPickerOpen(false)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <X size={scaleWidth(18)} color={Colors.text} />
                </Pressable>

                <Text style={styles.modalTitle}>Select project</Text>

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
                  data={offPlanOptions.filter((p) =>
                    p.title.toLowerCase().includes(offPlanSearch.trim().toLowerCase())
                  )}
                  keyExtractor={(item) => String(item.id)}
                  ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
                  onEndReachedThreshold={0.5}
                  onEndReached={() => {
                    // Only paginate when not searching.
                    if (offPlanSearch.trim().length) return;
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
                          setPropertyDetails({
                            ...propertyDetails,
                            offPlanProjectId: item.id,
                            offPlanProjectReferenceId: item.reference_id ?? '',
                            offPlanProjectTitle: item.title,
                          });
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
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: Colors.bronze,
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
    fontSize: scaleFont(20),
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
  formLabel: {
    fontSize: scaleFont(15),
    fontWeight: '600',
    color: Colors.text,
    marginBottom: scaleHeight(8),
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
    flexDirection: 'row',
    gap: scaleWidth(16),
    flexWrap: 'wrap',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(8),
    paddingVertical: scaleHeight(10),
    marginLeft: scaleWidth(8),
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
  locationInputText: {
    fontSize: scaleFont(16),
    color: Colors.text,
  },
  placeholder: {
    color: Colors.textSecondary,
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
    zIndex: 999,
    elevation: 999,
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
    zIndex: 999,
    elevation: 999,
  },
  modal: {
    width: '100%',
    backgroundColor: Colors.background,
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleHeight(24),
    borderTopLeftRadius: scaleWidth(20),
    borderTopRightRadius: scaleWidth(20),
  },
  modalCloseButton: {
    position: 'absolute',
    top: scaleHeight(16),
    right: scaleWidth(16),
    width: scaleWidth(32),
    height: scaleWidth(32),
    borderRadius: scaleWidth(16),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
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
    zIndex: 5,
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
