import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ResizeMode, Video } from 'expo-av';
import { ArrowLeft, Pause, Play, RotateCcw } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { useRecordingStore } from '@/stores/recordingStore';

export default function RecordVideoPreviewScreen() {
  const router = useRouter();
  const videoRef = useRef<Video>(null);
  const recordedVideoUri = useRecordingStore((s) => s.recordedVideoUri);
  const setRecordedVideoUri = useRecordingStore((s) => s.setRecordedVideoUri);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // If we landed here without a video (e.g. direct navigation), go back.
  // Important: run this check only on mount, otherwise clearing the URI for "Retake"
  // would trigger an extra back navigation (preview -> record-video -> upload).
  const initialRecordedVideoUri = recordedVideoUri;
  useEffect(() => {
    if (!initialRecordedVideoUri) {
      router.back();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!recordedVideoUri) {
    return null;
  }

  const handleRetake = () => {
    setRecordedVideoUri(null);
    // Always go to the recording screen (do not rely on history)
    router.replace('/record-video' as any);
  };

  const handleUseVideo = () => {
    // Keep the video in the store and go directly to Upload's text overlay step.
    router.replace({
      pathname: '/(tabs)/upload',
      params: { openTextOverlay: '1' },
    } as any);
  };

  const togglePlayPause = async () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      await videoRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await videoRef.current.playAsync();
      setIsPlaying(true);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleRetake} hitSlop={10}>
          <ArrowLeft size={scaleWidth(24)} color={Colors.textLight} />
        </Pressable>
        <Text style={styles.headerTitle}>Preview</Text>
        <View style={{ width: scaleWidth(24) }} />
      </View>

      {/* Video Preview */}
      <View style={styles.videoContainer}>
        <Video
          ref={videoRef}
          source={{ uri: recordedVideoUri }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          isLooping={true}
          shouldPlay={false}
          onLoadStart={() => setIsLoading(true)}
          onLoad={() => setIsLoading(false)}
          onPlaybackStatusUpdate={(status) => {
            if ('isLoaded' in status && status.isLoaded) {
              setIsPlaying(status.isPlaying);
            }
          }}
        />
        
        {/* Loading overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}

      </View>

      {/* Footer with action buttons */}
      <View style={styles.footer}>
        <Pressable style={styles.actionButton} onPress={handleRetake}>
          <RotateCcw size={scaleWidth(24)} color={Colors.textLight} />
          <Text style={styles.actionButtonText}>Retake</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={togglePlayPause}>
          {isPlaying ? (
            <>
              <Pause size={scaleWidth(24)} color={Colors.textLight} />
              <Text style={styles.actionButtonText}>Pause</Text>
            </>
          ) : (
            <>
              <Play size={scaleWidth(24)} color={Colors.textLight} />
              <Text style={styles.actionButtonText}>Play</Text>
            </>
          )}
        </Pressable>

        <Pressable style={styles.actionButton} onPress={handleUseVideo}>
          <Text style={styles.useVideoButtonText}>Use Video</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingTop: scaleHeight(40),
    paddingHorizontal: scaleWidth(20),
    paddingBottom: scaleHeight(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: Colors.textLight,
    fontSize: scaleFont(16),
    fontWeight: '800',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: scaleWidth(20),
    paddingTop: scaleHeight(16),
    paddingBottom: scaleHeight(28),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scaleWidth(12),
  },
  actionButton: {
    flex: 1,
    height: scaleHeight(66),
    width: scaleWidth(128),
    paddingVertical: scaleHeight(14),
    borderRadius: scaleWidth(12),
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleHeight(4),
  },
  actionButtonText: {
    color: Colors.textLight,
    fontSize: scaleFont(12),
    fontWeight: '700',
    marginTop: scaleHeight(2),
  },
  useVideoButton: {
    backgroundColor: Colors.BLACK,
  },
  useVideoButtonText: {
    color: '#fff',
    fontSize: scaleFont(15),
    fontWeight: '800',
  },
});
