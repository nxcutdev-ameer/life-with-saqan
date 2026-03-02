import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { X, Calendar, Clock } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/utils/useTheme';

interface ScheduleVisitModalProps {
  visible: boolean;
  onClose: () => void;
  onSchedule: (date: Date, time: Date) => void;
  propertyTitle: string;
}

export default function ScheduleVisitModal({
  visible,
  onClose,
  onSchedule,
  propertyTitle,
}: ScheduleVisitModalProps) {
  const { colors, isDarkMode } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDarkMode), [colors, isDarkMode]);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<Date>(new Date());
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const handleConfirm = () => {
    onSchedule(selectedDate, selectedTime);
    onClose();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (time: Date) => {
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

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
            <Text style={styles.modalTitle}>Schedule Visit</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color={isDarkMode ? colors.white : colors.text} />
            </Pressable>
          </View>

          <View style={styles.propertyInfo}>
            <Text style={styles.propertyLabel}>Property</Text>
            <Text style={styles.propertyTitle} numberOfLines={2}>
              {propertyTitle}
            </Text>
          </View>

          <View style={styles.selectionContainer}>
            <Text style={styles.sectionLabel}>Select Date & Time</Text>

            <Pressable
              style={styles.selector}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setPickerMode((prev) => (prev === 'date' ? null : 'date'));
              }}
            >
              <View style={styles.selectorLeft}>
                <View style={styles.selectorIcon}>
                  <Calendar size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.selectorLabel}>Date</Text>
                  <Text style={styles.selectorValue}>
                    {formatDate(selectedDate)}
                  </Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              style={styles.selector}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setPickerMode((prev) => (prev === 'time' ? null : 'time'));
              }}
            >
              <View style={styles.selectorLeft}>
                <View style={styles.selectorIcon}>
                  <Clock size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.selectorLabel}>Time</Text>
                  <Text style={styles.selectorValue}>
                    {formatTime(selectedTime)}
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>

          {pickerMode && (
            <DateTimePicker
              value={pickerMode === 'date' ? selectedDate : selectedTime}
              mode={pickerMode}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              textColor={Platform.OS === 'ios' ? (isDarkMode ? '#FFFFFF' : '#000000') : undefined}
              onChange={(event, value) => {
                // On Android, picker is a dialog; close after selection/cancel.
                if (Platform.OS !== 'ios') {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setPickerMode(null);
                }

                if (!value) return;
                if (pickerMode === 'date') setSelectedDate(value);
                else setSelectedTime(value);
              }}
              minimumDate={pickerMode === 'date' ? new Date() : undefined}
            />
          )}

          <Pressable style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmButtonText}>Confirm Visit</Text>
          </Pressable>
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
  propertyInfo: {
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  propertyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: isDarkMode ? 'rgba(255, 255, 255, 0.72)' : colors.textSecondary,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: isDarkMode ? colors.white : colors.text,
  },
  selectionContainer: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: isDarkMode ? colors.white : colors.text,
    marginBottom: 12,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 12,
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDarkMode ? 'rgba(183, 120, 24, 0.18)' : 'rgba(183, 120, 24, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorLabel: {
    fontSize: 12,
    color: isDarkMode ? 'rgba(255, 255, 255, 0.72)' : colors.textSecondary,
    marginBottom: 2,
  },
  selectorValue: {
    fontSize: 16,
    fontWeight: '600',
    color: isDarkMode ? colors.white : colors.text,
  },
  confirmButton: {
    backgroundColor: isDarkMode ? colors.black : colors.primary,
    borderWidth: isDarkMode ? 1 : 0,
    borderColor: isDarkMode ? colors.primary : 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: isDarkMode ? colors.white : colors.textOnPrimary,
  },
});
