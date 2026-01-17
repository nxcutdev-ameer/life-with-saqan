import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View, Pressable } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { scaleHeight } from '@/utils/responsive';
import { Plus } from 'lucide-react-native';
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
  onSubtitleSelect?: (subtitleUrl: string) => void;
  /** Navigate to property details (only triggered from the footer tap area). */
  onNavigateToProperty?: () => void;
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
  onNavigateToProperty,
}: PropertyFooterProps) {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageTranslation | null>(null);
  const bottomTabBarHeight = useBottomTabBarHeight?.() ?? 0;

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
      <View
        style={[
          styles.floatingActionsBar,
          { bottom: scaleHeight(140) + bottomTabBarHeight },
        ]}
      >
        <View style={styles.agentSection}>
          <TranslationOverlay
            agentName={item.agentName}
            languages={translations}
            onLanguageSelect={(lang) => {
              setSelectedLanguage(lang);
              if (lang.subtitleUrl) {
                onSubtitleSelect?.(lang.subtitleUrl);
              }
            }}
          />
          <Pressable
            style={styles.footerActionButton}
            onPress={() => router.push('/(tabs)/profile' as any)}
            hitSlop={10}
          >
            <View style={styles.agentAvatarContainer}>
              <View style={styles.agentAvatar}>
               <Text style={styles.agentInitial}>{item.agentName.charAt(0)}</Text>
              </View>
              {/* size 14 */}
              <View style={styles.agentPlusIcon}>
                <Plus size={12} color={Colors.textLight} strokeWidth={2.5} />
              </View>
            </View>
          </Pressable>
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

      {/* Black footer bar with progress and property info (sits above bottom tabs) */}
      <View style={[styles.globalFooterBar, { bottom: bottomTabBarHeight }]}>
        {/* Property info (tap to navigate) */}
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
        {/* Progress bar should sit right above the bottom tabs */}
        <PropertyProgressBar currentTime={currentTime} duration={duration} onSeek={onSeek} />
      </View>
    </>
  );
}
