import { scaleFont, scaleHeight } from '@/utils/responsive';
import { Tabs, usePathname } from 'expo-router';
import { useUiLockStore } from '@/stores/uiLockStore';
import { Play, Bookmark, User, Plus } from 'lucide-react-native';
import HomeSharp from '@/components/icons/HomeSharp';
import { StyleSheet, View } from 'react-native';
// fill="#F3EDDF"
const IconWithShadow = ({ Icon, color, size }: { Icon: any; color: string; size: number }) => (
  <View style={styles.iconShadow}>
    <Icon size={size} color={color} fill={color} />
  </View>
);

export default function TabsLayout() {
  const pathname = usePathname();
  const uploadLocked = useUiLockStore((s) => s.uploadLocked);
  const isUploadActive = pathname?.includes('/(tabs)/upload');
  return (
    <Tabs
      screenOptions={{
        // Block tab switching while the upload flow is locked (e.g. selecting highlights).
        // This prevents accidental swipe/tab navigation away from upload.
        // Note: bottom tabs normally don't swipe, but this covers tab taps and any gesture-based tab changes.

        headerShown: false,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.6)',
        tabBarStyle: {
          backgroundColor: '#141414',
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          height: scaleHeight(75), //70
          paddingBottom: scaleHeight(12),
          paddingTop: scaleHeight(4),
          elevation: 0,
          position: 'absolute',
        },
        tabBarLabelStyle: {
          fontSize: scaleFont(12),
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        listeners={{
            tabPress: (e) => {
              if (uploadLocked && isUploadActive) {
                e.preventDefault();
              }
            },
          }}
          options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <IconWithShadow Icon={HomeSharp} color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="reels"
        listeners={{
            tabPress: (e) => {
              if (uploadLocked && isUploadActive) {
                e.preventDefault();
              }
            },
          }}
          options={{
          title: 'Reels',
          tabBarIcon: ({ color, size }) => <IconWithShadow Icon={Play} color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="upload"
        listeners={{
            tabPress: (e) => {
              if (uploadLocked && isUploadActive) {
                e.preventDefault();
              }
            },
          }}
          options={{
          title: 'Upload',
          tabBarIcon: ({ color, size }) => <IconWithShadow Icon={Plus} color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        listeners={{
            tabPress: (e) => {
              if (uploadLocked && isUploadActive) {
                e.preventDefault();
              }
            },
          }}
          options={{
          title: 'Saved',
          tabBarIcon: ({ color, size }) => <IconWithShadow Icon={Bookmark} color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        listeners={{
            tabPress: (e) => {
              if (uploadLocked && isUploadActive) {
                e.preventDefault();
              }
            },
          }}
          options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <IconWithShadow Icon={User} color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
});
