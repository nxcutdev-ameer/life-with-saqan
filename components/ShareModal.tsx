import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  Share,
  Alert,
} from 'react-native';
import { X, MessageCircle, Instagram, Link as LinkIcon, MoreHorizontal } from 'lucide-react-native';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/utils/useTheme';
import { Property } from '@/types';
import * as Clipboard from 'expo-clipboard';

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  property: Property;
}

export default function ShareModal({
  visible,
  onClose,
  property,
}: ShareModalProps) {
  const { colors, isDarkMode } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDarkMode), [colors, isDarkMode]);
  const propertyUrl = `https://saqan.app/property/${property.id}`;

  const handleShareWhatsApp = async () => {
    const message = `Check out this property: ${property.title}\n\n${propertyUrl}`;
    try {
      await Share.share({
        message: message,
        url: propertyUrl,
      });
      onClose();
    } catch {
      Alert.alert('Error', 'Could not share to WhatsApp');
    }
  };

  const handleShareInstagram = () => {
    Alert.alert(
      'Share to Instagram',
      'Instagram sharing opens in the app. Would you like to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Instagram',
          onPress: () => {
            onClose();
          },
        },
      ]
    );
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(propertyUrl);
    Alert.alert('Success', 'Link copied to clipboard');
    onClose();
  };

  const handleShareMore = async () => {
    try {
      await Share.share({
        message: `Check out this property: ${property.title}\n\n${propertyUrl}`,
        url: propertyUrl,
        title: property.title,
      });
      onClose();
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  const ShareOption = ({
    icon: Icon,
    title,
    color,
    onPress,
  }: {
    icon: any;
    title: string;
    color: string;
    onPress: () => void;
  }) => (
    <Pressable
      style={({ pressed }) => [
        styles.shareOption,
        pressed && styles.shareOptionPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.shareIcon, { backgroundColor: color }]}>
        <Icon size={24} color={colors.white} />
      </View>
      <Text style={styles.shareTitle}>{title}</Text>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.modalTitle}>Share Property</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color={isDarkMode ? colors.white : colors.text} />
            </Pressable>
          </View>

          <View style={styles.propertyPreview}>
            <Text style={styles.propertyTitle} numberOfLines={2}>
              {property.title}
            </Text>
            <Text style={styles.propertyPrice}>
              {property.currency} {property.price.toLocaleString()}
            </Text>
          </View>

          <View style={styles.shareOptions}>
            <ShareOption
              icon={MessageCircle}
              title="WhatsApp"
              color="#25D366"
              onPress={handleShareWhatsApp}
            />
            <ShareOption
              icon={Instagram}
              title="Instagram"
              color="#E4405F"
              onPress={handleShareInstagram}
            />
            <ShareOption
              icon={LinkIcon}
              title="Copy Link"
              color={colors.primary}
              onPress={handleCopyLink}
            />
            <ShareOption
              icon={MoreHorizontal}
              title="More"
              color="#3498db"
              onPress={handleShareMore}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors, isDarkMode: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: isDarkMode ? colors.white : colors.text,
  },
  closeButton: {
    padding: 4,
  },
  propertyPreview: {
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: isDarkMode ? colors.white : colors.text,
    marginBottom: 4,
  },
  propertyPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  shareOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  shareOption: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  shareOptionPressed: {
    opacity: 0.7,
  },
  shareIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: isDarkMode ? colors.white : colors.text,
    textAlign: 'center',
  },
});
