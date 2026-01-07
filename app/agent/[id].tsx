import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  MapPin,
  Star,
  Phone,
  Mail,
  CheckCircle,
  Award,
  TrendingUp,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { mockProperties } from '@/mocks/properties';

export default function AgentProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();

  const agentProperty = mockProperties.find(p => p.agent.id === params.id);
  const agent = agentProperty?.agent;

  const agentProperties = mockProperties.filter(
    p => p.agent.id === params.id
  );

  if (!agent) {
    return (
      <View style={styles.container}>
        <Text>Agent not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: agent.photo }}
              style={styles.avatar}
            />
            {agent.isVerified && (
              <View style={styles.verifiedBadge}>
                <CheckCircle size={20} color={Colors.textLight} />
              </View>
            )}
          </View>

          <Text style={styles.agentName}>{agent.name}</Text>
          <Text style={styles.agencyName}>{agent.agency}</Text>

          {agent.rating && (
            <View style={styles.ratingContainer}>
              <Star size={16} color={Colors.bronze} fill={Colors.bronze} />
              <Text style={styles.ratingText}>
                {agent.rating} ({agent.totalReviews} reviews)
              </Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{agentProperties.length}</Text>
              <Text style={styles.statLabel}>Properties</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{agent.yearsExperience}+</Text>
              <Text style={styles.statLabel}>Years</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {agentProperties.reduce((sum, p) => sum + p.likesCount, 0)}
              </Text>
              <Text style={styles.statLabel}>Total Likes</Text>
            </View>
          </View>
        </View>

        {agent.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{agent.bio}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specializations</Text>
          <View style={styles.badges}>
            {agent.isVerified && (
              <View style={styles.badge}>
                <CheckCircle size={14} color={Colors.bronze} />
                <Text style={styles.badgeText}>Verified Agent</Text>
              </View>
            )}
            <View style={styles.badge}>
              <Award size={14} color={Colors.bronze} />
              <Text style={styles.badgeText}>Top Performer</Text>
            </View>
            <View style={styles.badge}>
              <TrendingUp size={14} color={Colors.bronze} />
              <Text style={styles.badgeText}>Quick Responder</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.contactCard}>
            <View style={styles.contactItem}>
              <View style={styles.contactIcon}>
                <Phone size={18} color={Colors.bronze} />
              </View>
              <Text style={styles.contactText}>{agent.phone}</Text>
            </View>
            <View style={styles.contactItem}>
              <View style={styles.contactIcon}>
                <Mail size={18} color={Colors.bronze} />
              </View>
              <Text style={styles.contactText}>{agent.email}</Text>
            </View>
            {agent.licenseNumber && (
              <View style={styles.contactItem}>
                <View style={styles.contactIcon}>
                  <Award size={18} color={Colors.bronze} />
                </View>
                <Text style={styles.contactText}>
                  License: {agent.licenseNumber}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Properties ({agentProperties.length})
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.propertiesScroll}
          >
            {agentProperties.map((property) => (
              <Pressable
                key={property.id}
                style={styles.propertyCard}
                onPress={() => router.push(`/property/${property.id}` as any)}
              >
                <Image
                  source={{ uri: property.thumbnailUrl }}
                  style={styles.propertyImage}
                />
                <View style={styles.propertyInfo}>
                  <Text style={styles.propertyTitle} numberOfLines={2}>
                    {property.title}
                  </Text>
                  <Text style={styles.propertyPrice}>
                    {property.currency} {property.price.toLocaleString()}
                  </Text>
                  <View style={styles.propertyLocation}>
                    <MapPin size={12} color={Colors.textSecondary} />
                    <Text style={styles.propertyLocationText}>
                      {property.location.area}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.contactButton}
          onPress={() => {}}
        >
          <Phone size={20} color={Colors.textLight} />
          <Text style={styles.contactButtonText}>Contact Agent</Text>
        </Pressable>
      </View>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatarContainer: {
    position: 'relative' as const,
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.border,
  },
  verifiedBadge: {
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bronze,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.background,
  },
  agentName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  agencyName: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 20,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingTop: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.bronze,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  section: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.text,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: `${Colors.bronze}15`,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.bronze,
  },
  contactCard: {
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Colors.bronze}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: {
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  propertiesScroll: {
    gap: 16,
    paddingRight: 24,
  },
  propertyCard: {
    width: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  propertyImage: {
    width: '100%',
    height: 120,
    backgroundColor: Colors.border,
  },
  propertyInfo: {
    padding: 12,
  },
  propertyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  propertyPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.bronze,
    marginBottom: 6,
  },
  propertyLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  propertyLocationText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  bottomSpacer: {
    height: 40,
  },
  footer: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.bronze,
    paddingVertical: 16,
    borderRadius: 12,
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textLight,
  },
});
