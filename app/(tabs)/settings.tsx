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
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';

type SettingItemProps = {
  icon: any;
  title: string;
  onPress?: () => void;
  showArrow?: boolean;
  rightElement?: React.ReactNode;
};

const SettingItem = React.memo(function SettingItem({
  icon: Icon,
  title,
  onPress,
  showArrow = true,
  rightElement,
}: SettingItemProps) {
  return (
    <Pressable style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingLeft}>
        <Icon size={scaleFont(22)} color={Colors.text} />
        <Text style={styles.settingTitle}>{title}</Text>
      </View>
      {rightElement || (showArrow && <ChevronRight size={scaleFont(20)} color={Colors.textSecondary} />)}
    </Pressable>
  );
});

type SettingToggleProps = {
  id: string;
  icon: any;
  title: string;
  value: boolean;
  onToggle: () => void;
};

const SettingToggle = React.memo(function SettingToggle({
  id,
  icon: Icon,
  title,
  value,
  onToggle,
}: SettingToggleProps) {
  return (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <Icon size={scaleFont(22)} color={Colors.text} />
        <Text style={styles.settingTitle}>{title}</Text>
      </View>
      <Switch
        nativeID={id}
        testID={id}
        accessibilityLabel={title}
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: Colors.border, true: Colors.bronze }}
        thumbColor={Colors.background}
      />
    </View>
  );
});

export default function SettingsScreen() { 
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const [darkMode, setDarkMode] = React.useState(false);
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
          }, 800);
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Settings</Text>
        <View style={styles.card}>
          <SettingItem icon={User} title="Edit Profile" onPress={() => {}} />
          <View style={styles.divider} />
          <SettingItem icon={CreditCard} title="Subscription & Billing" onPress={() => router.push('/paywall')} />
          <View style={styles.divider} />
          <SettingItem icon={Lock} title="Change Password" onPress={() => {}} />
          <View style={styles.divider} />
          <SettingItem icon={Globe} title="Language (English)" onPress={() => {}} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <SettingToggle
            id="pushNotifications"
            icon={Bell}
            title="Push Notifications"
            value={pushNotifications}
            onToggle={() => setPushNotifications((prev) => !prev)}
          />
          <View style={styles.divider} />
          <SettingToggle
            id="emailNotifications"
            icon={Bell}
            title="Email Notifications"
            value={emailNotifications}
            onToggle={() => setEmailNotifications((prev) => !prev)}
          />
          <View style={styles.divider} />
          <SettingItem
            icon={Bell}
            title="Notification Preferences"
            onPress={() => router.push('/notification-preferences' as any)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.card}>
          <SettingItem icon={Lock} title="Profile Visibility" onPress={() => {}} />
          <View style={styles.divider} />
          <SettingItem icon={Lock} title="Blocked Users" onPress={() => {}} />
          <View style={styles.divider} />
          <SettingItem icon={FileText} title="Data & Privacy" onPress={() => {}} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Settings</Text>
        <View style={styles.card}>
          <SettingToggle
            id="darkMode"
            icon={Moon}
            title="Dark Mode"
            value={darkMode}
            onToggle={() => setDarkMode((prev) => !prev)}
          />
          <View style={styles.divider} />
          <SettingToggle
            id="autoPlayOnWifi"
            icon={Wifi}
            title="Auto-play on WiFi only"
            value={autoPlayOnWifi}
            onToggle={() => setAutoPlayOnWifi((prev) => !prev)}
          />
          <View style={styles.divider} />
          <SettingItem icon={Trash2} title="Clear Cache" onPress={() => {}} />
          <View style={styles.divider} />
          <SettingItem
            icon={Info}
            title="App Version"
            showArrow={false}
            rightElement={<Text style={styles.versionText}>1.0.0</Text>}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity</Text>
        <View style={styles.card}>
          <SettingItem
            icon={Activity}
            title="Activity Center"
            onPress={() => router.push('/activity-center' as any)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support & Legal</Text>
        <View style={styles.card}>
          <SettingItem icon={HelpCircle} title="Help Center" onPress={() => {}} />
          <View style={styles.divider} />
          <SettingItem icon={FileText} title="Contact Support" onPress={() => {}} />
          <View style={styles.divider} />
          <SettingItem icon={FileText} title="Terms of Service" onPress={() => {}} />
          <View style={styles.divider} />
          <SettingItem icon={FileText} title="Privacy Policy" onPress={() => {}} />
          <View style={styles.divider} />
          <SettingItem icon={FileText} title="Licenses" onPress={() => {}} />
        </View>
      </View>

      <View style={styles.section}>
        <Pressable
          style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
          onPress={onLogoutPress}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <ActivityIndicator size="small" color={Colors.textLight} />
          ) : (
            <LogOut size={scaleFont(20)} color={Colors.textLight} />
          )}
          <Text style={styles.logoutText}>{isLoggingOut ? 'Logging out…' : 'Log Out'}</Text>
        </Pressable>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: scaleHeight(60),
    paddingHorizontal: scaleWidth(24),
    paddingBottom: scaleHeight(20),
  },
  title: {
    fontSize: scaleFont(36),
    fontWeight: '700',
    color: Colors.text,
  },
  section: {
    paddingHorizontal: scaleWidth(24),
    marginBottom: scaleHeight(24),
  },
  sectionTitle: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: scaleHeight(12),
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: scaleWidth(12),
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: scaleWidth(50),
  },
  versionText: {
    fontSize: scaleFont(14),
    color: Colors.textSecondary,
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
    color: Colors.textLight,
  },
  bottomSpacer: {
    height: scaleHeight(60),
  },
});
