import React, { useState, useMemo } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { ArrowLeft } from 'lucide-react-native';
import { SavingSpinner } from '@/components/SavingSpinner';

export default function PdfViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string | string[]; title?: string | string[] }>();

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
          <ArrowLeft size={20} color="#222" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F4F7',
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
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFEFEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginHorizontal: 10,
  },

  viewerWrapper: {
    flex: 1,
    marginTop: 120,
    marginHorizontal: 8,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
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
    backgroundColor: '#FFF',
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },

  webview: {
    flex: 1,
    backgroundColor: '#FFF',
  },
});
