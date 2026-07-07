import ProfileScreen from '@/src/components/ProfileScreen';

export default function ParentProfile() {
  return (
    <ProfileScreen
      role="parent"
      name="Priya Sharma"
      email="priya@aroha.app"
      stats={[
        { label: 'Children', value: '3' },
        { label: 'Plans', value: '5' },
        { label: 'Streak', value: '12d' },
      ]}
      testID="parent-profile"
    />
  );
}
