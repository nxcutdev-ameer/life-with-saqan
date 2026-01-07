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
  Dimensions,
} from 'react-native';
import { VideoScrubber } from '@/components/VideoScrubber';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video } from 'expo-av';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { Colors } from '@/constants/colors';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { PropertyType, TransactionType } from '@/types';
import * as ImagePicker from 'expo-image-picker';
import { useSubscription } from '@/contexts/SubscriptionContext';

export default function UploadScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { canPost, tier, postsUsed, postsLimit, refreshSubscription } = useSubscription();
  const [step, setStep] = useState<'select' | 'edit' | 'selectHighlights' | 'details'>('select');
  const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);
  const [overlayText, setOverlayText] = useState('');
  const [overlayTextSize, setOverlayTextSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [overlayTextColor, setOverlayTextColor] = useState<'white' | 'black' | 'yellow'>('white');
  const [overlayTextPosition, setOverlayTextPosition] = useState<'top' | 'center' | 'bottom'>('center');
  const [showShareModal, setShowShareModal] = useState(false);

  const highlightSteps = ['Kitchen', 'Living room', 'Bedroom', 'Bathroom', 'View', 'Balcony', 'Terrace'] as const;
  type HighlightStep = (typeof highlightSteps)[number];
  const [activeHighlightStepIndex, setActiveHighlightStepIndex] = useState(0);
  const [highlightsByRoom, setHighlightsByRoom] = useState<Partial<Record<HighlightStep, number>>>({});

  const videoRef = React.useRef<Video>(null);
  const [videoCurrentTimeSec, setVideoCurrentTimeSec] = useState(0);
  const [videoDurationSec, setVideoDurationSec] = useState(0);
  const [isHighlightsPlaying, setIsHighlightsPlaying] = useState(true);
  const [isHighlightsMuted, setIsHighlightsMuted] = useState(false);
  const [isHighlightsVideoLoaded, setIsHighlightsVideoLoaded] = useState(false);

  const formatTimeMmSs = (totalSeconds: number) => {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

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
    location: '',
    description: '',
  });

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
              onPress: () => router.push('/paywall')
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
              onPress: () => router.push('/paywall')
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
          onPress: () => router.push('/(tabs)/profile'),
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
              location: '',
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
    setActiveHighlightStepIndex(0);
    setIsHighlightsMuted(false);
    setIsHighlightsVideoLoaded(false);
    setIsHighlightsPlaying(false);
    setStep('selectHighlights');
  };

  useEffect(() => {
    if (step !== 'selectHighlights') return;

    // Start playback smoothly when the highlights modal opens.
    setIsHighlightsVideoLoaded(false);
    setIsHighlightsPlaying(false);

    const id = requestAnimationFrame(async () => {
      try {
        await videoRef.current?.playAsync();
        setIsHighlightsPlaying(true);
      } catch {
        // ignore
      }
    });

    return () => cancelAnimationFrame(id);
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
   const activeRoom = highlightSteps[activeHighlightStepIndex];

   const seek = async (sec: number) => {
     try {
       await videoRef.current?.setPositionAsync(Math.max(0, sec * 1000));
       setVideoCurrentTimeSec(sec);
     } catch {
       // ignore seek errors
     }
   };

   const handleSelectThisHighlight = () => {
     setHighlightsByRoom((prev) => ({ ...prev, [activeRoom]: videoCurrentTimeSec }));
   };

   const handleDone = async () => {
     try {
       await videoRef.current?.pauseAsync();
     } catch {}
     setIsHighlightsPlaying(false);
     setStep('details');
   };

   const goPrevious = async () => {
     // return back to edit step
     try {
       await videoRef.current?.pauseAsync();
     } catch {}
     setIsHighlightsPlaying(false);
     setStep('edit');
   };

   return (
     <View style={styles.container}>
       {/* Dimmed background */}
       <View style={styles.highlightsOverlay} />

       {/* 85% height sheet */}
       <View
         style={[
           styles.highlightsSheet,
           {
             height: Dimensions.get('window').height * 0.85,
             bottom: tabBarHeight,
           },
         ]}
       >
         <View style={styles.highlightsHeader}>
           <Pressable onPress={goPrevious}>
             <Text style={styles.highlightsBack}>Back</Text>
           </Pressable>
           <Text style={styles.highlightsTitle}>Select Highlights</Text>
           {/* <Pressable onPress={() => setStep('details')}>
             <Text style={styles.highlightsClose}>Close</Text>
           </Pressable> */}
         </View>

         <ScrollView
           style={styles.highlightsScroll}
           contentContainerStyle={[
             styles.highlightsContent,
             { paddingBottom: (insets?.bottom ?? 0) + scaleHeight(24) },
           ]}
           showsVerticalScrollIndicator={false}
         >
           {/* Video preview (not full-sheet) */}
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
                   onPress={async () => {
                     if (!isHighlightsVideoLoaded) return;
                     try {
                       if (isHighlightsPlaying) {
                         await videoRef.current?.pauseAsync();
                         setIsHighlightsPlaying(false);
                       } else {
                         await videoRef.current?.playAsync();
                         setIsHighlightsPlaying(true);
                       }
                     } catch {}
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
                   thumbSize={12}
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
   {/* Picker */}
           <ScrollView
             horizontal
             showsHorizontalScrollIndicator={false}
             contentContainerStyle={styles.highlightsPicker}
           >
             {highlightSteps.map((room, idx) => {
               const isActive = idx === activeHighlightStepIndex;
               return (
                 <Pressable
                   key={room}
                   style={[styles.highlightsPickerChip, isActive && styles.highlightsPickerChipActive]}
                   onPress={() => setActiveHighlightStepIndex(idx)}
                 >
                   <Text
                     style={[
                       styles.highlightsPickerChipText,
                       isActive && styles.highlightsPickerChipTextActive,
                     ]}
                   >
                     {room}
                   </Text>
                 </Pressable>
               );
             })}
           </ScrollView>
             <Text style={styles.highlightsStepTitle}>Skip to highlights</Text>
             <Text style={styles.highlightsStepSubtitle}>
               Drag the bar to find the moment, then tap the button bellow.
             </Text>

             {/* Select button under the video */}
             <Pressable style={styles.highlightsSelectButton} onPress={handleSelectThisHighlight}>
               <Text style={styles.highlightsSelectButtonText}>{`Set Skip to ${activeRoom}`}</Text>
             </Pressable>
           </View>

    

           <View style={styles.highlightsBody}>
             {/* Circular highlight picker under the Select button */}
             <ScrollView
               horizontal
               showsHorizontalScrollIndicator={false}
               contentContainerStyle={styles.highlightsCirclePicker}
             >
               {highlightSteps.map((room, idx) => {
                 const value = highlightsByRoom[room];
                 const isActive = idx === activeHighlightStepIndex;

                 const Icon =
                   room === 'Kitchen'
                     ? Utensils
                     : room === 'Living room'
                       ? Sofa
                       : room === 'Bedroom'
                         ? Bed
                         : room === 'Bathroom'
                           ? Bath
                           : room === 'View'
                             ? Eye
                             : room === 'Balcony'
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

             <Pressable style={styles.highlightsDoneButton} onPress={handleDone}>
               <Text style={styles.highlightsDoneButtonText}>Done</Text>
             </Pressable>
           </View>
         </ScrollView>
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
            // Move the footer above the bottom tab bar (tab bar overlays the screen)
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

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Property Status *</Text>
          <View style={styles.radioRow}>
            <Pressable
              style={styles.radioOption}
              onPress={() =>
                setPropertyDetails({
                  ...propertyDetails,
                  developmentStatus: 'READY',
                })
              }
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
              onPress={() =>
                setPropertyDetails({
                  ...propertyDetails,
                  developmentStatus: 'OFF_PLAN',
                })
              }
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
          <Text style={styles.formLabel}>Location *</Text>
          <Pressable style={styles.locationInput}>
            <Text style={[styles.locationInputText, !propertyDetails.location && styles.placeholder]}>
              {propertyDetails.location || 'Select location'}
            </Text>
            <ChevronRight size={scaleWidth(20)} color={Colors.textSecondary} />
          </Pressable>
        </View>

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
    flex: 1,
    width: '100%',
    height: '100%',
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
    aspectRatio: 9 / 16,
    backgroundColor: '#000',
    borderRadius: scaleWidth(16),
    overflow: 'hidden',
  },
  highlightsVideo: {
    width: '100%',
    height: '100%',
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
    paddingTop: scaleHeight(12),
    gap: scaleHeight(10),
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
    gap: scaleHeight(10),
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
    paddingTop: scaleHeight(6),
    paddingBottom: scaleHeight(2),
    gap: scaleWidth(14),
    paddingRight: scaleWidth(16),
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
    marginTop: scaleHeight(14),
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
    borderWidth:1,
    borderColor: Colors.bronze,
    borderRadius: scaleWidth(12),
    paddingVertical: scaleHeight(12),
    alignItems: 'center',
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
