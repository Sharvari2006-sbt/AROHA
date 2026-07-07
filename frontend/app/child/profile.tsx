import ProfileScreen from '@/src/components/ProfileScreen';

export default function ChildProfile() {
  return (
    <ProfileScreen
      role="child"
      name="Mia Sharma"
      email="mia@aroha.app"
      stats={[
        { label: 'Stars', value: '12' },
        { label: 'XP', value: '320' },
        { label: 'Streak', value: '5d' },
      ]}
      testID="child-profile"
    />
  );
}
