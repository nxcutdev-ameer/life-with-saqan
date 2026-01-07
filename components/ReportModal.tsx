import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { X, Check } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => void;
  type: 'property' | 'user';
}

const REPORT_REASONS = {
  property: [
    'Scam/Fraud',
    'Misleading information',
    'Already sold/rented',
    'Inappropriate content',
    'Spam',
    'Copyright violation',
    'Other',
  ],
  user: [
    'Harassment',
    'Spam',
    'Fraud/Scam',
    'Impersonation',
    'Inappropriate behavior',
    'Other',
  ],
};

export default function ReportModal({
  visible,
  onClose,
  onSubmit,
  type,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');

  const handleSubmit = () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason');
      return;
    }
    onSubmit(selectedReason, details);
    setSelectedReason(null);
    setDetails('');
    onClose();
  };

  const reasons = REPORT_REASONS[type];

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
            <Text style={styles.modalTitle}>
              Report {type === 'property' ? 'Property' : 'User'}
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.subtitle}>
              Why are you reporting this {type}?
            </Text>

            <View style={styles.reasonsList}>
              {reasons.map((reason) => (
                <Pressable
                  key={reason}
                  style={[
                    styles.reasonOption,
                    selectedReason === reason && styles.reasonOptionSelected,
                  ]}
                  onPress={() => setSelectedReason(reason)}
                >
                  <Text
                    style={[
                      styles.reasonText,
                      selectedReason === reason && styles.reasonTextSelected,
                    ]}
                  >
                    {reason}
                  </Text>
                  {selectedReason === reason && (
                    <Check size={20} color={Colors.bronze} />
                  )}
                </Pressable>
              ))}
            </View>

            <Text style={styles.detailsLabel}>
              Additional details (optional)
            </Text>
            <TextInput
              style={styles.detailsInput}
              placeholder="Provide more information..."
              placeholderTextColor={Colors.textSecondary}
              value={details}
              onChangeText={setDetails}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Pressable
              style={[
                styles.submitButton,
                !selectedReason && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedReason}
            >
              <Text style={styles.submitButtonText}>Submit Report</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 24,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 16,
  },
  reasonsList: {
    gap: 10,
    marginBottom: 20,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  reasonOptionSelected: {
    borderColor: Colors.bronze,
    backgroundColor: `${Colors.bronze}15`,
  },
  reasonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  reasonTextSelected: {
    color: Colors.bronze,
    fontWeight: '600',
  },
  detailsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  detailsInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: Colors.text,
    minHeight: 100,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: Colors.textSecondary,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textLight,
  },
});
