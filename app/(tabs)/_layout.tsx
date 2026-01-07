import { scaleFont, scaleHeight } from '@/utils/responsive';
import { Tabs } from 'expo-router';
import { Home, Play, Bookmark, User, Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

const IconWithShadow = ({ Icon, color, size }: { Icon: any; color: string; size: number }) => (
  <View style={styles.iconShadow}>
    <Icon size={size} color={color} fill="#F3EDDF" />
  </View>
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.6)',
        tabBarStyle: {
          backgroundColor: '#141414',
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          height: scaleHeight(70),
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
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <IconWithShadow Icon={Home} color={color} size={size} />,
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
        options={{
          title: 'Reels',
          tabBarIcon: ({ color, size }) => <IconWithShadow Icon={Play} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Upload',
          tabBarIcon: ({ color, size }) => <IconWithShadow Icon={Plus} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color, size }) => <IconWithShadow Icon={Bookmark} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <IconWithShadow Icon={User} color={color} size={size} />,
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
