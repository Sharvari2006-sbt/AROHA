import AuthForm from '@/src/components/AuthForm';
import { colors } from '@/src/theme';

export default function StudentLogin() {
  return (
    <AuthForm
      mode="login"
      role="student"
      eyebrow="INDEPENDENT LEARNING"
      title="Welcome back."
      subtitle="Continue your journey with your Digital Twin."
      accent={colors.orange}
      homeRoute="/student/home"
      otherModeRoute="/auth/student-signup"
      otherModeLabel="Create account"
    />
  );
}
