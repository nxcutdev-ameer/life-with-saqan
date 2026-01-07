import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Send, MoreVertical } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Message } from '@/types';

const mockMessages: Message[] = [
  {
    id: '1',
    senderId: 'user-1',
    receiverId: 'agent-1',
    propertyId: '1',
    text: "Hi! I'm interested in the Luxury Beachfront Apartment. Is it still available?",
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    isRead: true,
  },
  {
    id: '2',
    senderId: 'agent-1',
    receiverId: 'user-1',
    text: "Hello! Yes, it's still available. It's a beautiful property with stunning views. Would you like to schedule a visit?",
    timestamp: new Date(Date.now() - 55 * 60 * 1000),
    isRead: true,
  },
  {
    id: '3',
    senderId: 'user-1',
    receiverId: 'agent-1',
    text: "That would be great! What times are available this week?",
    timestamp: new Date(Date.now() - 50 * 60 * 1000),
    isRead: true,
  },
  {
    id: '4',
    senderId: 'agent-1',
    receiverId: 'user-1',
    text: "I have availability on Thursday at 2 PM or Friday at 10 AM. Which works better for you?",
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    isRead: false,
  },
];

const agentNames: Record<string, string> = {
  'agent-1': 'Fatima Al-Mansouri',
};

const agentPhotos: Record<string, string> = {
  'agent-1': 'https://i.pravatar.cc/150?img=5',
};

export default function ChatScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [inputText, setInputText] = useState('');

  const agentId = 'agent-1';
  const agentName = agentNames[agentId];
  const agentPhoto = agentPhotos[agentId];
  const userId = 'user-1';

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: `${Date.now()}`,
      senderId: userId,
      receiverId: agentId,
      text: inputText.trim(),
      timestamp: new Date(),
      isRead: false,
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Image source={{ uri: agentPhoto }} style={styles.headerAvatar} />
          <View>
            <Text style={styles.headerName}>{agentName}</Text>
            <Text style={styles.headerStatus}>Active now</Text>
          </View>
        </View>
        <Pressable style={styles.moreButton}>
          <MoreVertical size={22} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => {
          const isOwnMessage = message.senderId === userId;
          return (
            <View
              key={message.id}
              style={[
                styles.messageWrapper,
                isOwnMessage ? styles.ownMessageWrapper : styles.otherMessageWrapper,
              ]}
            >
              <View
                style={[
                  styles.messageBubble,
                  isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
                  ]}
                >
                  {message.text}
                </Text>
              </View>
              <Text style={styles.messageTime}>{formatTime(message.timestamp)}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={Colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <Pressable
          style={[
            styles.sendButton,
            !inputText.trim() && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Send size={20} color={Colors.textLight} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginLeft: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.border,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  headerStatus: {
    fontSize: 12,
    color: Colors.bronze,
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageWrapper: {
    marginBottom: 16,
    maxWidth: '75%',
  },
  ownMessageWrapper: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherMessageWrapper: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    marginBottom: 4,
  },
  ownMessageBubble: {
    backgroundColor: Colors.bronze,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  ownMessageText: {
    color: Colors.textLight,
  },
  otherMessageText: {
    color: Colors.text,
  },
  messageTime: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 15,
    color: Colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bronze,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.textSecondary,
  },
});
