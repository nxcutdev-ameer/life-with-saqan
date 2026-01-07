import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Conversation } from '@/types';

const mockConversations: Conversation[] = [
  {
    id: '1',
    participants: ['user-1', 'agent-1'],
    lastMessage: {
      id: 'msg-1',
      senderId: 'agent-1',
      receiverId: 'user-1',
      propertyId: '1',
      text: "Hi! Yes, the property is still available. Would you like to schedule a visit?",
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      isRead: false,
    },
    unreadCount: 2,
  },
  {
    id: '2',
    participants: ['user-1', 'agent-2'],
    lastMessage: {
      id: 'msg-2',
      senderId: 'user-1',
      receiverId: 'agent-2',
      propertyId: '2',
      text: "I'm interested in viewing the villa. When are you available?",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      isRead: true,
    },
    unreadCount: 0,
  },
  {
    id: '3',
    participants: ['user-1', 'agent-3'],
    lastMessage: {
      id: 'msg-3',
      senderId: 'agent-3',
      receiverId: 'user-1',
      text: "Thank you for your interest! I'll send you more details shortly.",
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      isRead: true,
    },
    unreadCount: 0,
  },
];

const agentNames: Record<string, string> = {
  'agent-1': 'Fatima Al-Mansouri',
  'agent-2': 'Marcus Green',
  'agent-3': 'Zara Khan',
};

const agentPhotos: Record<string, string> = {
  'agent-1': 'https://i.pravatar.cc/150?img=5',
  'agent-2': 'https://i.pravatar.cc/150?img=12',
  'agent-3': 'https://i.pravatar.cc/150?img=9',
};

export default function MessagesScreen() {
  const router = useRouter();
  const [conversations] = useState<Conversation[]>(mockConversations);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    }
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getAgentId = (conversation: Conversation) => {
    return conversation.participants.find(p => p.startsWith('agent-')) || '';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>Messages</Text>
        <Pressable style={styles.searchButton}>
          <Search size={22} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {conversations.map((conversation) => {
          const agentId = getAgentId(conversation);
          const agentName = agentNames[agentId] || 'Agent';
          const agentPhoto = agentPhotos[agentId];

          return (
            <Pressable
              key={conversation.id}
              style={styles.conversationCard}
              onPress={() => router.push(`/messages/${conversation.id}` as any)}
            >
              <View style={styles.avatarContainer}>
                <Image
                  source={{ uri: agentPhoto }}
                  style={styles.avatar}
                />
                {conversation.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>
                      {conversation.unreadCount}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.conversationContent}>
                <View style={styles.conversationHeader}>
                  <Text style={styles.agentName}>{agentName}</Text>
                  <Text style={styles.timestamp}>
                    {formatTime(conversation.lastMessage.timestamp)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.lastMessage,
                    conversation.unreadCount > 0 && styles.lastMessageUnread,
                  ]}
                  numberOfLines={2}
                >
                  {conversation.lastMessage.text}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {conversations.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Messages Yet</Text>
            <Text style={styles.emptyText}>
              Start a conversation by contacting an agent on a property
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarContainer: {
    position: 'relative' as const,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.border,
  },
  unreadBadge: {
    position: 'absolute' as const,
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.bronze,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textLight,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  agentName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  lastMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  lastMessageUnread: {
    color: Colors.text,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
