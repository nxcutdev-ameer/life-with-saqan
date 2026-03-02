import React from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  User,
  Bell,
  Lock,
  Globe,
  HelpCircle,
  FileText,
  LogOut,
  ChevronRight,
  Moon,
  Wifi,
  Trash2,
  Info,
  Activity,
  CreditCard,
} from 'lucide-react-native';
import type { ThemeColors } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { useTheme } from '@/utils/useTheme';

type SettingItemProps = {
  icon: any;
  title: string;
  onPress?: () => void;
  showArrow?: boolean;
  rightElement?: React.ReactNode;
  colors: ThemeColors;
};

const SettingItem = React.memo(function SettingItem({
  icon: Icon,
  title,
  onPress,
  showArrow = true,
  rightElement,
  colors,
}: SettingItemProps) {
  return (
    <Pressable style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingLeft}>
        <Icon size={scaleFont(22)} color={colors.text} />
        <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {rightElement || (showArrow && <ChevronRight size={scaleFont(20)} color={colors.textSecondary} />)}
    </Pressable>
  );
});

type SettingToggleProps = {
  id: string;
  icon: any;
  title: string;
  value: boolean;
  onToggle: () => void;
  colors: ThemeColors;
};

const SettingToggle = React.memo(function SettingToggle({
  id,
  icon: Icon,
  title,
  value,
  onToggle,
  colors,
}: SettingToggleProps) {
  return (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <Icon size={scaleFont(22)} color={colors.text} />
        <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
      </View>
      <Switch
        nativeID={id}
        testID={id}
        accessibilityLabel={title}
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );
});

export default function SettingsScreen() { 
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const { colors, isDarkMode, setDarkMode } = useTheme();
  const [pushNotifications, setPushNotifications] = React.useState(true);
  const [emailNotifications, setEmailNotifications] = React.useState(true);
  const [autoPlayOnWifi, setAutoPlayOnWifi] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const onLogoutPress = () => {
    if (isLoggingOut) return;

    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          setIsLoggingOut(true);

          // UI-only: show loading state briefly.
          setTimeout(() => {
            logout();
            setIsLoggingOut(false);
            router.push('/(tabs)/feed');
          }, 800);
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Account Settings</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingItem colors={colors} icon={User} title="Edit Profile" onPress={() => {}} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingItem colors={colors} icon={CreditCard} title="Subscription & Billing" onPress={() => router.push('/paywall')} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingItem colors={colors} icon={Lock} title="Change Password" onPress={() => {}} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingItem colors={colors} icon={Globe} title="Language (English)" onPress={() => {}} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Notifications</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingToggle
            id="pushNotifications"
            icon={Bell}
            title="Push Notifications"
            value={pushNotifications}
            onToggle={() => setPushNotifications((prev) => !prev)}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingToggle
            id="emailNotifications"
            icon={Bell}
            title="Email Notifications"
            value={emailNotifications}
            onToggle={() => setEmailNotifications((prev) => !prev)}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingItem
            colors={colors}
            icon={Bell}
            title="Notification Preferences"
            onPress={() => router.push('/notification-preferences' as any)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Privacy</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingItem colors={colors} icon={Lock} title="Profile Visibility" onPress={() => {}} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingItem colors={colors} icon={Lock} title="Blocked Users" onPress={() => {}} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingItem colors={colors} icon={FileText} title="Data & Privacy" onPress={() => {}} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>App Settings</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingToggle
            id="darkMode"
            icon={Moon}
            title="Dark Mode"
            value={isDarkMode}
            onToggle={() => setDarkMode(!isDarkMode)}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingToggle
            id="autoPlayOnWifi"
            icon={Wifi}
            title="Auto-play on WiFi only"
            value={autoPlayOnWifi}
            onToggle={() => setAutoPlayOnWifi((prev) => !prev)}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingItem colors={colors} icon={Trash2} title="Clear Cache" onPress={() => {}} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingItem
            colors={colors}
            icon={Info}
            title="App Version"
            showArrow={false}
            rightElement={<Text style={[styles.versionText, { color: colors.textSecondary }]}>1.0.0</Text>}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Activity</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingItem
            colors={colors}
            icon={Activity}
            title="Activity Center"
            onPress={() => router.push('/activity-center' as any)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Support & Legal</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingItem colors={colors} icon={HelpCircle} title="Help Center" onPress={() => {}} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingItem colors={colors} icon={FileText} title="Contact Support" onPress={() => {}} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingItem colors={colors} icon={FileText} title="Terms of Service" onPress={() => {}} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingItem colors={colors} icon={FileText} title="Privacy Policy" onPress={() => {}} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingItem colors={colors} icon={FileText} title="Licenses" onPress={() => {}} />
        </View>
      </View>

      <View style={styles.section}>
        <Pressable
          style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
          onPress={onLogoutPress}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <LogOut size={scaleFont(20)} color={colors.white} />
          )}
          <Text style={[styles.logoutText, { color: colors.white }]}>{isLoggingOut ? 'Logging out…' : 'Log Out'}</Text>
        </Pressable>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: scaleHeight(60),
    paddingHorizontal: scaleWidth(24),
    paddingBottom: scaleHeight(20),
  },
  title: {
    fontSize: scaleFont(36),
    fontWeight: '700',
  },
  section: {
    paddingHorizontal: scaleWidth(24),
    marginBottom: scaleHeight(24),
  },
  sectionTitle: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    marginBottom: scaleHeight(12),
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: scaleWidth(12),
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scaleHeight(16),
    paddingHorizontal: scaleWidth(16),
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(12),
    flex: 1,
  },
  settingTitle: {
    fontSize: scaleFont(16),
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginLeft: scaleWidth(50),
  },
  versionText: {
    fontSize: scaleFont(14),
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleWidth(8),
    backgroundColor: '#e74c3c',
    paddingVertical: scaleHeight(16),
    borderRadius: scaleWidth(12),
  },
  logoutButtonDisabled: {
    opacity: 0.7,
  },
  logoutText: {
    fontSize: scaleFont(16),
    fontWeight: '600',
  },
  bottomSpacer: {
    height: scaleHeight(60),
  },
});
