import React, { useState } from 'react';
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
  /** Navigate to property details (only triggered from the footer tap area). */
  onNavigateToProperty?: () => void;
}

interface LanguageTranslation {
  code: string;
  name: string;
  translation: string;
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
  onNavigateToProperty,
}: PropertyFooterProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageTranslation | null>(null);
  const bottomTabBarHeight = useBottomTabBarHeight?.() ?? 0;

  const translations: LanguageTranslation[] = [
    { code: 'en', name: 'English', translation: item.description },
    { code: 'ar', name: 'Arabic', translation: 'شقة فاخرة على شاطئ البحر مع إطلالات بانورامية رائعة' },
    { code: 'fr', name: 'French', translation: 'Appartement de luxe en bord de mer avec des vues panoramiques' },
    { code: 'es', name: 'Spanish', translation: 'Apartamento de lujo frente al mar con vistas panorámicas' },
    { code: 'ru', name: 'Russian', translation: 'Роскошная квартира на берегу моря с панорамным видом' },
    { code: 'zh', name: 'Chinese', translation: '豪华海滨公寓，享有全景海景' },
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
            onLanguageSelect={setSelectedLanguage}
          />
          <Pressable style={styles.footerActionButton}>
            <View style={styles.agentAvatarContainer}>
              <View style={styles.agentAvatar}>
                <Text style={styles.agentInitial}>{item.agentName.charAt(0)}</Text>
              </View>
              <View style={styles.agentPlusIcon}>
                <Plus size={14} color={Colors.textLight} strokeWidth={3} />
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

        <VideoPlayerOverlay onSeek={onSeek} />
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
