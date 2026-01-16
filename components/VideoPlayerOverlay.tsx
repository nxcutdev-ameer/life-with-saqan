import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, Pressable, Modal } from 'react-native';
import { FastForward } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface Room {
  name: string;
  timestamp: number;
}

interface VideoPlayerOverlayProps {
  onSeek: (timestamp: number) => void;
  rooms?: Room[];
}

const defaultRooms: Room[] = [
  { name: 'Kitchen', timestamp: 10 },
  { name: 'Bedroom', timestamp: 30 },
  { name: 'Living Room', timestamp: 50 },
  { name: 'Bathroom', timestamp: 20 },
  { name: 'View', timestamp: 40 },
  { name: 'Balcony', timestamp: 60 },
  { name: 'Terrace', timestamp: 70 },
];

export default function VideoPlayerOverlay({ onSeek, rooms = defaultRooms }: VideoPlayerOverlayProps) {
  const [visible, setVisible] = useState(false);

  const ffScale = useRef(new Animated.Value(1)).current;
  const ffTranslateX = useRef(new Animated.Value(0)).current;
  const ffOpacity = useRef(new Animated.Value(1)).current;

  const ffAnimatedStyle = useMemo(
    () => ({
      transform: [{ translateX: ffTranslateX }, { scale: ffScale }],
      opacity: ffOpacity,
    }),
    [ffOpacity, ffScale, ffTranslateX]
  );

  const handleRoomPress = (timestamp: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSeek(timestamp);
    setVisible(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Pressable
        style={styles.triggerButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

          // Fast-forward micro animation
          ffScale.stopAnimation();
          ffTranslateX.stopAnimation();
          ffOpacity.stopAnimation();
          ffScale.setValue(1);
          ffTranslateX.setValue(0);
          ffOpacity.setValue(1);

          Animated.parallel([
            Animated.sequence([
              Animated.timing(ffTranslateX, {
                toValue: 6,
                duration: 110,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.timing(ffTranslateX, {
                toValue: 0,
                duration: 180,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(ffScale, {
                toValue: 1.08,
                duration: 110,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.spring(ffScale, {
                toValue: 1,
                stiffness: 260,
                damping: 16,
                mass: 0.9,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(ffOpacity, {
                toValue: 0.9,
                duration: 110,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(ffOpacity, {
                toValue: 1,
                duration: 180,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
          ]).start();

          setVisible(true);
        }}
      >
        <Animated.View style={[styles.iconShadow, ffAnimatedStyle]}>
          <FastForward size={25} color={Colors.textLight} fill={Colors.textLight} />
        </Animated.View>
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
            <Text style={styles.modalTitle}>Skip to Highlights</Text>
            
            <View style={styles.roomsContainer}>
              {rooms.map((room, index) => (
                <Pressable
                  key={index}
                  style={styles.roomButton}
                  onPress={() => handleRoomPress(room.timestamp)}
                >
                  <LinearGradient
                    colors={['#121212', '#454444']}
                    style={styles.roomButtonGradient}
                  >
                    <Text style={styles.roomName}>{room.name}</Text>
                    <Text style={styles.roomTime}>{formatTime(room.timestamp)}</Text>
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
    gap: 2,
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
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 32,
  },
  roomsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    maxWidth: '100%',
  },
  roomButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  roomButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  roomName: {
    color: Colors.textLight,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  roomTime: {
    color: Colors.textLight,
    fontSize: 11,
    opacity: 0.8,
    textAlign: 'center',
  },
});
