import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { buildPropertyDetailsRoute } from '@/utils/routes';
import { Bell, Heart, MessageSquare, Home, TrendingUp, Info, Check } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Notification } from '@/types';

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'engagement',
    title: 'New Like',
    message: 'Sarah liked your property "Luxury Beachfront Apartment"',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    isRead: false,
    propertyId: '1',
  },
  {
    id: '2',
    type: 'engagement',
    title: 'New Comment',
    message: 'Ahmed commented on your property',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    isRead: false,
    propertyId: '2',
  },
  {
    id: '3',
    type: 'activity',
    title: 'Property Saved',
    message: '3 people saved your property today',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    isRead: true,
    propertyId: '1',
  },
  {
    id: '4',
    type: 'marketing',
    title: 'New Properties',
    message: '5 new properties in Dubai Marina match your search',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    isRead: true,
  },
  {
    id: '5',
    type: 'agent',
    title: 'Inquiry Response',
    message: 'Fatima Al-Mansouri responded to your inquiry',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    isRead: true,
    agentId: 'agent-1',
  },
  {
    id: '6',
    type: 'system',
    title: 'Video Processing Complete',
    message: 'Your property video is now live',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    isRead: true,
    propertyId: '3',
  },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const getNotificationIcon = (type: Notification['type']) => {
    const iconProps = { size: 20, color: Colors.textLight };
    switch (type) {
      case 'engagement':
        return <Heart {...iconProps} />;
      case 'activity':
        return <TrendingUp {...iconProps} />;
      case 'marketing':
        return <Home {...iconProps} />;
      case 'agent':
        return <MessageSquare {...iconProps} />;
      case 'system':
        return <Info {...iconProps} />;
      default:
        return <Bell {...iconProps} />;
    }
  };

  const getIconColor = (type: Notification['type']) => {
    switch (type) {
      case 'engagement':
        return '#e74c3c';
      case 'activity':
        return '#3498db';
      case 'marketing':
        return Colors.bronze;
      case 'agent':
        return '#2ecc71';
      case 'system':
        return '#9b59b6';
      default:
        return Colors.textSecondary;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleNotificationPress = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.propertyId) {
      router.push(
        buildPropertyDetailsRoute({ propertyReference: notification.propertyId, id: notification.propertyId }) as any
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadCount}>
              {unreadCount} unread
            </Text>
          )}
        </View>
        {unreadCount > 0 && (
          <Pressable onPress={markAllAsRead} style={styles.markAllButton}>
            <Check size={18} color={Colors.bronze} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {notifications.map((notification) => (
          <Pressable
            key={notification.id}
            style={[
              styles.notificationCard,
              !notification.isRead && styles.notificationCardUnread,
            ]}
            onPress={() => handleNotificationPress(notification)}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: getIconColor(notification.type) },
              ]}
            >
              {getNotificationIcon(notification.type)}
            </View>

            <View style={styles.notificationContent}>
              <Text style={styles.notificationTitle}>
                {notification.title}
              </Text>
              <Text style={styles.notificationMessage} numberOfLines={2}>
                {notification.message}
              </Text>
              <Text style={styles.notificationTime}>
                {formatTime(notification.timestamp)}
              </Text>
            </View>

            {!notification.isRead && <View style={styles.unreadDot} />}
          </Pressable>
        ))}
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
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.text,
  },
  unreadCount: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: `${Colors.bronze}15`,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.bronze,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notificationCardUnread: {
    backgroundColor: `${Colors.bronze}08`,
    borderColor: `${Colors.bronze}30`,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.bronze,
    marginTop: 6,
  },
});
