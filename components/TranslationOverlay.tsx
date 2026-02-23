import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, Modal, Platform } from 'react-native';
import { Captions } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { scaleFont, scaleWidth } from '@/utils/responsive';

interface Language {
  code: string;
  name: string;
  translation: string;
  subtitleUrl?: string;
}

interface TranslationOverlayProps {
  agentName: string;
  languages?: Language[];
  selectedCode?: string;
  onLanguageSelect?: (language: Language) => void;
}

const defaultLanguages: Language[] = [
  { code: 'en', name: 'English', translation: '' },
  { code: 'ar', name: 'العربية', translation: '' },
  { code: 'fr', name: 'Français', translation: '' },
  { code: 'hi', name: 'हिन्दी', translation: '' },
  { code: 'ur', name: 'اردو', translation: '' },
  { code: 'ru', name: 'Русский', translation: '' },
  { code: 'zh', name: '中文', translation: '' },
];

const nativeLanguageNameByCode: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
  hi: 'हिन्दी',
  ur: 'اردو',
  ru: 'Русский',
  zh: '中文',
};

function getNativeLanguageName(language: Language) {
  return nativeLanguageNameByCode[language.code] ?? language.name;
}

export default function TranslationOverlay({
  agentName,
  languages = defaultLanguages,
  selectedCode,
  onLanguageSelect
}: TranslationOverlayProps) {
  const [visible, setVisible] = useState(false);

  const handleLanguagePress = (language: Language) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLanguageSelect?.(language);
    setVisible(false);
  };

  return (
    <>
      <Pressable
        style={styles.triggerButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setVisible(true);
        }}
      >
        <View style={styles.iconShadow}>
          <Captions size={28} color={Colors.textLight} strokeWidth={1.8} />
        </View>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.dimmedBackground} onPress={() => setVisible(false)} />
          
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Language</Text>
            
            <View style={styles.languagesContainer}>
              {languages.map((language, index) => (
                <Pressable
                  key={index}
                  style={[styles.languageButton, selectedCode === language.code ? styles.languageButtonSelected : undefined]}
                  onPress={() => handleLanguagePress(language)}
                >
                  <LinearGradient
                    colors={['#121212', '#454444']}
                    style={styles.languageButtonGradient}
                  >
                    <Text style={styles.languageName}>{getNativeLanguageName(language)}</Text>
                  </LinearGradient>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  triggerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight:scaleWidth(8),
  },
 iconShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
    marginRight:5
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dimmedBackground: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    alignItems: 'center',
    zIndex: 10,
    paddingHorizontal: 24,
  },
  modalTitle: {
    color: Colors.textLight,
    fontSize: Platform.OS === 'android' ? scaleFont(16): scaleFont(24),
    fontWeight: '700',
    marginBottom: 32,
  },
  languagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    maxWidth: '100%',
  },
  languageButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  languageButtonSelected: {
    borderWidth: 2,
    borderColor: Colors.bronze,
  },
  languageButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  languageName: {
    color: Colors.textLight,
    fontSize: Platform.OS === 'android' ? scaleFont(10): scaleFont(14),
    fontWeight: '600',
    textAlign: 'center',
  },
});
