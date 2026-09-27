import { Tabs } from 'expo-router';
import CustomTabBar from '@/src/components/CustomTabBar';

export default function ChildLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="study" options={{ title: 'Study' }} />
      <Tabs.Screen name="quiz" options={{ title: 'Quiz' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="assignment/[id]" options={{ href: null }} />
      <Tabs.Screen name="assessment/[id]" options={{ href: null }} />
      <Tabs.Screen name="learn/[mode]" options={{ href: null }} />
      <Tabs.Screen name="quiz/[id]" options={{ href: null }} />
      <Tabs.Screen name="revision/index" options={{ href: null }} />
      <Tabs.Screen name="revision/[id]" options={{ href: null }} />
    </Tabs>
  );
}
