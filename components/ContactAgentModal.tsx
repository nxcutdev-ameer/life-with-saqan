import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  Linking,
} from 'react-native';
import { Phone, MessageCircle, Mail, Send, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Property } from '@/types';

interface ContactAgentModalProps {
  visible: boolean;
  onClose: () => void;
  property: Property;
}

export default function ContactAgentModal({
  visible,
  onClose,
  property,
}: ContactAgentModalProps) {
  const handleCall = () => {
    const phoneNumber = property.agent.phone;
    Linking.openURL(`tel:${phoneNumber}`);
    onClose();
  };

  const handleWhatsApp = () => {
    const phoneNumber = property.agent.phone.replace(/[^0-9]/g, '');
    const message = `Hi, I'm interested in ${property.title}. Is it still available?`;
    const url = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      alert('Make sure WhatsApp is installed on your device');
    });
    onClose();
  };

  const handleEmail = () => {
    const email = property.agent.email;
    const subject = `Inquiry: ${property.title}`;
    const body = `Hi ${property.agent.name},\n\nI'm interested in the property "${property.title}" listed at ${property.price} AED.\n\nCould you please provide more information?\n\nThank you.`;
    Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    onClose();
  };

  const handleInAppMessage = () => {
    onClose();
  };

  const ContactOption = ({
    icon: Icon,
    title,
    description,
    onPress,
    color,
  }: {
    icon: any;
    title: string;
    description: string;
    onPress: () => void;
    color: string;
  }) => (
    <Pressable
      style={({ pressed }) => [
        styles.contactOption,
        pressed && styles.contactOptionPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: color }]}>
        <Icon size={24} color={Colors.textLight} />
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactTitle}>{title}</Text>
        <Text style={styles.contactDescription}>{description}</Text>
      </View>
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
            <Text style={styles.modalTitle}>Contact Agent</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.text} />
            </Pressable>
          </View>

          <View style={styles.agentInfo}>
            <View style={styles.agentAvatar}>
              <Text style={styles.agentInitial}>
                {property.agent.name.charAt(0)}
              </Text>
            </View>
            <View>
              <Text style={styles.agentName}>{property.agent.name}</Text>
              <Text style={styles.agentAgency}>{property.agent.agency}</Text>
            </View>
          </View>

          <View style={styles.contactOptions}>
            <ContactOption
              icon={Phone}
              title="Call"
              description="Talk directly with agent"
              onPress={handleCall}
              color="#3498db"
            />
            <ContactOption
              icon={MessageCircle}
              title="WhatsApp"
              description="Message on WhatsApp"
              onPress={handleWhatsApp}
              color="#25D366"
            />
            <ContactOption
              icon={Mail}
              title="Email"
              description="Send an email inquiry"
              onPress={handleEmail}
              color="#e74c3c"
            />
            <ContactOption
              icon={Send}
              title="In-App Message"
              description="Chat within Saqan"
              onPress={handleInAppMessage}
              color={Colors.bronze}
            />
          </View>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  agentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    padding: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  agentAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.bronze,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textLight,
  },
  agentName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  agentAgency: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  contactOptions: {
    gap: 12,
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contactOptionPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  contactDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
