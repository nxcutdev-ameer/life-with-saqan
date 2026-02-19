import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft, ExternalLink } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';

export default function PdfViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string | string[]; title?: string | string[] }>();

  const url = useMemo(() => {
    const value = Array.isArray(params.url) ? params.url[0] : params.url;
    return (value ?? '').trim();
  }, [params.url]);

  const title = useMemo(() => {
    const value = Array.isArray(params.title) ? params.title[0] : params.title;
    return (value ?? 'PDF').trim() || 'PDF';
  }, [params.title]);

  const [opening, setOpening] = useState(false);

  const open = useCallback(async () => {
    if (!url) {
      Alert.alert('Missing file URL', 'Unable to open this file.');
      return;
    }

    try {
      setOpening(true);
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        enableBarCollapsing: true,
        showTitle: true,
      });
    } catch {
      Alert.alert('Unable to open file', 'Please try again later.');
    } finally {
      setOpening(false);
      router.back()
    }
  }, [url]);

  useEffect(() => {
    // Auto-open when navigating to this screen.
    open();
  }, [open]);

 // return (
    // <View style={styles.container}>
    //   <View style={styles.header}>
    //     <Pressable onPress={() => router.back()} style={styles.headerButton}>
    //       <ArrowLeft size={20} color={Colors.text} />
    //     </Pressable>
    //     <Text style={styles.headerTitle} numberOfLines={1}>
    //       {title}
    //     </Text>
    //     <View style={{ width: scaleWidth(40) }} />
    //   </View>

    //   <View style={styles.content}>
    //     <Text style={styles.helpText}>
    //       {opening ? 'Opening…' : 'If the file did not open automatically, tap below.'}
    //     </Text>

    //     <Pressable onPress={open} style={styles.openButton} disabled={opening}>
    //       {opening ? <ActivityIndicator color={Colors.textLight} /> : <ExternalLink size={18} color={Colors.textLight} />}
    //       <Text style={styles.openButtonText}>{opening ? 'Opening' : 'Open PDF'}</Text>
    //     </Pressable>

    //     <Text style={styles.urlText} numberOfLines={2}>
    //       {url}
    //     </Text>
    //   </View>
    // </View>
 // );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: scaleHeight(60),
    paddingHorizontal: scaleWidth(20),
    paddingBottom: scaleHeight(16),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(12),
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: {
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: scaleWidth(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.textLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    flex: 1,
    padding: scaleWidth(20),
    justifyContent: 'center',
    gap: scaleHeight(16),
  },
  helpText: {
    textAlign: 'center',
    fontSize: scaleFont(14),
    color: Colors.textSecondary,
    lineHeight: scaleFont(22),
  },
  openButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(8),
    backgroundColor: Colors.bronze,
    paddingVertical: scaleHeight(14),
    paddingHorizontal: scaleWidth(22),
    borderRadius: scaleWidth(999),
  },
  openButtonText: {
    fontSize: scaleFont(14),
    fontWeight: '800',
    color: Colors.textLight,
  },
  urlText: {
    textAlign: 'center',
    fontSize: scaleFont(12),
    color: Colors.textSecondary,
  },
});
