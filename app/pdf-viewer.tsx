import React, { useState, useMemo } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { ArrowLeft } from 'lucide-react-native';
import { SavingSpinner } from '@/components/SavingSpinner';
import { useTheme } from '@/utils/useTheme';
import { ThemeColors } from '@/constants/theme';

export default function PdfViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string | string[]; title?: string | string[] }>();

  const { colors, isDarkMode } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDarkMode), [colors, isDarkMode]);

  const url = useMemo(() => {
    const value = Array.isArray(params.url) ? params.url[0] : params.url;
    return (value ?? '').trim();
  }, [params.url]);

  const title = useMemo(() => {
    const value = Array.isArray(params.title) ? params.title[0] : params.title;
    return (value ?? 'Document').trim() || 'Document';
  }, [params.title]);

  const [loading, setLoading] = useState(true);
  const fadeAnim = useState(new Animated.Value(0))[0];

  const onLoadEnd = () => {
    setLoading(false);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  if (!url) return null;

  return (
    <View style={styles.container}>
      {/* Floating Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>

        <Text style={styles.title} numberOfLines={1}>{title}</Text>

        <View style={{ width: 40 }} />
      </View>

      {/* PDF Viewer */}
      <View style={styles.viewerWrapper}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <SavingSpinner size={42} />
            <Text style={styles.loadingText}>Loading PDF…</Text>
          </View>
        )}

        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <WebView
            source={{
              uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`,
            }}
            onLoadEnd={onLoadEnd}
            style={styles.webview}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDarkMode: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    backgroundColor: isDarkMode ? 'rgba(23, 24, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOpacity: isDarkMode ? 0.3 : 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#EFEFEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: 10,
  },

  viewerWrapper: {
    flex: 1,
    marginTop: 120,
    marginHorizontal: 8,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: isDarkMode ? 0.2 : 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },

  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.textSecondary,
  },

  webview: {
    flex: 1,
    backgroundColor: colors.surface,
  },
});
