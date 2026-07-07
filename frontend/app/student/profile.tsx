import ProfileScreen from '@/src/components/ProfileScreen';

export default function StudentProfile() {
  return (
    <ProfileScreen
      role="student"
      name="Alex Rivera"
      email="alex@twinstudy.app"
      stats={[
        { label: 'Streak', value: '7d' },
        { label: 'Subjects', value: '4' },
        { label: 'XP', value: '1,240' },
      ]}
      testID="student-profile"
    />
  );
}
