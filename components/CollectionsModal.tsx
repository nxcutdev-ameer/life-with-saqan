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
import { X, Plus, Folder, Check } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Collection } from '@/types';

interface CollectionsModalProps {
  visible: boolean;
  onClose: () => void;
  propertyId: string;
  collections: Collection[];
  onSaveToCollection: (collectionId: string) => void;
  onCreateCollection: (name: string, color: string) => void;
}

const COLLECTION_COLORS = [
  Colors.bronze,
  '#3498db',
  '#e74c3c',
  '#2ecc71',
  '#9b59b6',
  '#f39c12',
  '#1abc9c',
  '#34495e',
];

export default function CollectionsModal({
  visible,
  onClose,
  propertyId,
  collections,
  onSaveToCollection,
  onCreateCollection,
}: CollectionsModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLLECTION_COLORS[0]);

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) {
      Alert.alert('Error', 'Please enter a collection name');
      return;
    }
    onCreateCollection(newCollectionName.trim(), selectedColor);
    setNewCollectionName('');
    setSelectedColor(COLLECTION_COLORS[0]);
    setIsCreating(false);
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
            <Text style={styles.modalTitle}>
              {isCreating ? 'Create Collection' : 'Save to Collection'}
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.text} />
            </Pressable>
          </View>

          {isCreating ? (
            <View style={styles.createForm}>
              <TextInput
                style={styles.input}
                placeholder="Collection name"
                placeholderTextColor={Colors.textSecondary}
                value={newCollectionName}
                onChangeText={setNewCollectionName}
                autoFocus
              />

              <Text style={styles.colorLabel}>Choose Color</Text>
              <View style={styles.colorGrid}>
                {COLLECTION_COLORS.map((color) => (
                  <Pressable
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => setSelectedColor(color)}
                  >
                    {selectedColor === color && (
                      <Check size={20} color={Colors.textLight} />
                    )}
                  </Pressable>
                ))}
              </View>

              <View style={styles.createActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsCreating(false);
                    setNewCollectionName('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.createButton}
                  onPress={handleCreateCollection}
                >
                  <Text style={styles.createButtonText}>Create</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <ScrollView style={styles.collectionsList}>
                {collections.map((collection) => {
                  const isSaved = collection.propertyIds.includes(propertyId);
                  return (
                    <Pressable
                      key={collection.id}
                      style={styles.collectionItem}
                      onPress={() => onSaveToCollection(collection.id)}
                    >
                      <View style={styles.collectionLeft}>
                        <View
                          style={[
                            styles.collectionIcon,
                            { backgroundColor: collection.color },
                          ]}
                        >
                          <Folder size={20} color={Colors.textLight} />
                        </View>
                        <View style={styles.collectionInfo}>
                          <Text style={styles.collectionName}>
                            {collection.name}
                          </Text>
                          <Text style={styles.collectionCount}>
                            {collection.propertyIds.length} properties
                          </Text>
                        </View>
                      </View>
                      {isSaved && (
                        <Check size={20} color={Colors.bronze} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Pressable
                style={styles.newCollectionButton}
                onPress={() => setIsCreating(true)}
              >
                <Plus size={20} color={Colors.bronze} />
                <Text style={styles.newCollectionText}>
                  Create New Collection
                </Text>
              </Pressable>
            </>
          )}
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
    maxHeight: '70%',
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
  createForm: {
    gap: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.text,
  },
  colorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: -8,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: Colors.text,
  },
  createActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  createButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.bronze,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textLight,
  },
  collectionsList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  collectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  collectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  collectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionInfo: {
    flex: 1,
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  collectionCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  newCollectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.bronze,
    borderStyle: 'dashed',
  },
  newCollectionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.bronze,
  },
});
