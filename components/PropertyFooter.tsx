import React, { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Text, View, Pressable } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { scaleHeight } from '@/utils/responsive';
import { Check, Plus } from 'lucide-react-native';
import { Property } from '@/types';
import { Colors } from '@/constants/colors';
import { feedStyles as styles } from '@/constants/feedStyles';
import PropertyProgressBar from '@/components/PropertyProgressBar';
import PropertyInfo from '@/components/PropertyInfo';
import EngagementButtons from '@/components/EngagementButtons';
import VideoPlayerOverlay from '@/components/VideoPlayerOverlay';
import TranslationOverlay from '@/components/TranslationOverlay';

interface PropertyFooterProps {
  item: Property;
  currentTime: number;
  duration: number;
  isLiked: boolean;
  isSaved: boolean;
  onToggleLike: (id: string) => void;
  onToggleSave: (id: string) => void;
  onOpenComments: (id: string) => void;
  onShare?: (id: string) => void;
  onSeek: (timestamp: number) => void;
  onSubtitleSelect?: (subtitleUrl: string, languageCode: string) => void;
  selectedSubtitleCode?: string;
  /** Navigate to property details (only triggered from the footer tap area). */
  onNavigateToProperty?: () => void;

  /** Optional: called before navigating away (e.g., agent profile). */
  onNavigateAway?: () => void;

  /** Notify parent when user starts/ends scrubbing the progress bar. */
  onScrubStart?: () => void;
  onScrubEnd?: () => void;

  /** When true, hide all footer overlays except the progress bar (TikTok-like scrubbing mode). */
  scrubbing?: boolean;
}

interface LanguageTranslation {
  code: string;
  name: string;
  translation: string;
  subtitleUrl?: string;
}

/**
 * Complete property footer component that combines:
 * - Progress bar
 * - Property information (left side)
 * - Engagement buttons (right side)
 * - Agent section with translation overlay
 * - Video player overlay
 */
export default function PropertyFooter({
  item,
  currentTime,
  duration,
  isLiked,
  isSaved,
  onToggleLike,
  onToggleSave,
  onOpenComments,
  onShare,
  onSeek,
  onSubtitleSelect,
  selectedSubtitleCode,
  onNavigateToProperty,
  onNavigateAway,
  onScrubStart,
  onScrubEnd,
  scrubbing = false,
}: PropertyFooterProps) {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageTranslation | null>(null);
  const bottomTabBarHeight = useBottomTabBarHeight?.() ?? 0;

  const [followIconState, setFollowIconState] = useState<'plus' | 'check' | 'hidden'>('plus');
  const followIconScale = useRef(new Animated.Value(1)).current;
  const followIconOpacity = useRef(new Animated.Value(1)).current;

  const onPressFollow = useCallback(() => {
    if (followIconState !== 'plus') return;

    Animated.sequence([
      Animated.timing(followIconScale, {
        toValue: 0,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(followIconScale, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.delay(650),
      Animated.parallel([
        Animated.timing(followIconOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(followIconScale, {
          toValue: 0.6,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished) setFollowIconState('hidden');
    });

    // Swap icon to check just after the "shrink".
    setTimeout(() => setFollowIconState('check'), 90);
  }, [followIconOpacity, followIconScale, followIconState]);

  const toAbsoluteUrl = (maybePath?: string | null) => {
    if (!maybePath) return '';
    if (maybePath.startsWith('http://') || maybePath.startsWith('https://')) return maybePath;
    if (maybePath.startsWith('/')) return `https://api.saqan.com${maybePath}`;
    return `https://api.saqan.com/${maybePath}`;
  };

  const translations: LanguageTranslation[] = item.subtitles?.length
    ? item.subtitles.map((s) => ({
        code: s.code,
        // label is already expected to be native script (Arabic/Chinese/etc)
        name: s.label || s.code,
        translation: '',
        subtitleUrl: toAbsoluteUrl(s.url || s.filePath || null),
      }))
    : [
        { code: 'en', name: 'English', translation: item.description },
        { code: 'ar', name: 'العربية', translation: '' },
        { code: 'fr', name: 'Français', translation: '' },
        { code: 'es', name: 'Español', translation: '' },
        { code: 'ru', name: 'Русский', translation: '' },
        { code: 'zh', name: '中文', translation: '' },
      ];

  return (
    <>
      {/* Action buttons floating above footer (exclude bottom tab bar height) */}
      {!scrubbing ? (
        <View
          style={[styles.floatingActionsBar, { bottom: scaleHeight(140) + bottomTabBarHeight }]}
        >
        <View style={styles.agentSection}>
       <TranslationOverlay
            agentName={item.agentName}
            languages={translations}
            selectedCode={selectedSubtitleCode}
            onLanguageSelect={(lang) => {
              setSelectedLanguage(lang);
              if (lang.subtitleUrl) {
                onSubtitleSelect?.(lang.subtitleUrl, lang.code);
              }
            }}
          />
          <View style={styles.footerActionButton}>
            <View style={styles.agentAvatarContainer}>
              <Pressable
                onPress={() => {
                  onNavigateAway?.();
                  const agentId = item.agent?.agentId ?? Number(item.agent?.id);
                  if (agentId) router.push(`/agent/${agentId}` as any);
                }}
                hitSlop={10}
              >
                <View style={styles.agentAvatar}>
                  <Text style={styles.agentInitial}>
                    {(item.agentName || item.agent?.name || 'A').trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
              </Pressable>

              {followIconState !== 'hidden' ? (
                <Pressable
                  style={styles.agentPlusIcon}
                  hitSlop={10}
                  onPress={onPressFollow}
                >
                  <Animated.View
                    style={{
                      transform: [{ scale: followIconScale }],
                      opacity: followIconOpacity,
                    }}
                  >
                    {followIconState === 'check' ? (
                      <Check size={14} color={Colors.textLight} strokeWidth={3} />
                    ) : (
                      <Plus size={14} color={Colors.textLight} strokeWidth={2.5} />
                    )}
                  </Animated.View>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        <EngagementButtons
          item={item}
          isLiked={isLiked}
          isSaved={isSaved}
          onToggleLike={onToggleLike}
          onToggleSave={onToggleSave}
          onOpenComments={onOpenComments}
          onShare={onShare}
        />

        <VideoPlayerOverlay onSeek={onSeek} rooms={item.rooms} />
        </View>
      ) : null}

      {/* Black footer bar with progress and property info (sits above bottom tabs) */}
      <View style={[styles.globalFooterBar, { bottom: bottomTabBarHeight }]}> 
        {/* Property info (tap to navigate) */}
        {!scrubbing ? (
          <Pressable
            style={styles.footerMainContent}
            onPress={onNavigateToProperty}
            disabled={!onNavigateToProperty}
          >
            <PropertyInfo
              item={item}
              translationContent={
                selectedLanguage && selectedLanguage.translation
                  ? {
                      agentName: item.agentName,
                      translation: selectedLanguage.translation,
                    }
                  : null
              }
            />
          </Pressable>
        ) : null}
        {/* Progress bar should sit right above the bottom tabs */}
        <PropertyProgressBar
          currentTime={currentTime}
          duration={duration}
          onSeek={onSeek}
          onScrubStart={onScrubStart}
          onScrubEnd={onScrubEnd}
          showTimeLabel={scrubbing}
        />
      </View>
    </>
  );
}
