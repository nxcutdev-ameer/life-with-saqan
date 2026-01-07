import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Heart, Send } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Image } from 'expo-image';

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: Date;
  likesCount: number;
  isLiked: boolean;
}

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  propertyId: string;
  commentsCount: number;
}

export default function CommentsModal({ visible, onClose, propertyId, commentsCount }: CommentsModalProps) {
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Comment[]>([
    {
      id: '1',
      userId: '1',
      userName: 'Sarah Ahmed',
      userAvatar: 'https://i.pravatar.cc/150?img=1',
      text: 'This property looks amazing! Is it still available?',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      likesCount: 12,
      isLiked: false,
    },
    {
      id: '2',
      userId: '2',
      userName: 'Mohammed Ali',
      userAvatar: 'https://i.pravatar.cc/150?img=2',
      text: 'Great location! Can we schedule a viewing?',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      likesCount: 8,
      isLiked: true,
    },
    {
      id: '3',
      userId: '3',
      userName: 'Layla Hassan',
      userAvatar: 'https://i.pravatar.cc/150?img=3',
      text: 'Love the view from the balcony! 😍',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      likesCount: 24,
      isLiked: false,
    },
  ]);

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleLikeComment = (commentId: string) => {
    setComments(
      comments.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              isLiked: !comment.isLiked,
              likesCount: comment.isLiked ? comment.likesCount - 1 : comment.likesCount + 1,
            }
          : comment
      )
    );
  };

  const handleSendComment = () => {
    if (commentText.trim()) {
      const newComment: Comment = {
        id: Date.now().toString(),
        userId: 'current-user',
        userName: 'You',
        userAvatar: 'https://i.pravatar.cc/150?img=10',
        text: commentText.trim(),
        timestamp: new Date(),
        likesCount: 0,
        isLiked: false,
      };
      setComments([newComment, ...comments]);
      setCommentText('');
    }
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentItem}>
      <Image source={{ uri: item.userAvatar }} style={styles.commentAvatar} contentFit="cover" />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUserName}>{item.userName}</Text>
          <Text style={styles.commentTimestamp}>{formatTimestamp(item.timestamp)}</Text>
        </View>
        <Text style={styles.commentText}>{item.text}</Text>
        <View style={styles.commentActions}>
          <Pressable
            style={styles.commentLikeButton}
            onPress={() => handleLikeComment(item.id)}
          >
            <Heart
              size={14}
              color={item.isLiked ? Colors.bronze : Colors.textSecondary}
              fill={item.isLiked ? Colors.bronze : 'none'}
            />
            {item.likesCount > 0 && (
              <Text style={[styles.commentLikeCount, item.isLiked && styles.commentLikeCountActive]}>
                {item.likesCount}
              </Text>
            )}
          </Pressable>
          <Pressable>
            <Text style={styles.commentReplyButton}>Reply</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Comments {commentsCount > 0 && `(${commentsCount})`}
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.text} />
            </Pressable>
          </View>

          <FlatList
            data={comments}
            renderItem={renderComment}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.commentsList}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.inputContainer}>
            <Image
              source={{ uri: 'https://i.pravatar.cc/150?img=10' }}
              style={styles.inputAvatar}
              contentFit="cover"
            />
            <TextInput
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor={Colors.textSecondary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <Pressable
              style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
              onPress={handleSendComment}
              disabled={!commentText.trim()}
            >
              <Send
                size={20}
                color={commentText.trim() ? Colors.bronze : Colors.textSecondary}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(61, 61, 61, 0.5)',
  },
  modalContent: {
    height: '80%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentsList: {
    padding: 20,
    gap: 20,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 12,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.textLight,
  },
  commentContent: {
    flex: 1,
    gap: 6,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  commentTimestamp: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  commentText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  commentLikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentLikeCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  commentLikeCountActive: {
    color: Colors.bronze,
  },
  commentReplyButton: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.textLight,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.textLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
