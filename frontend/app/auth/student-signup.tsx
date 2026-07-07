import AuthForm from '@/src/components/AuthForm';
import { colors } from '@/src/theme';

export default function StudentSignup() {
  return (
    <AuthForm
      mode="signup"
      role="student"
      eyebrow="INDEPENDENT LEARNING"
      title="Create your account."
      subtitle="Meet your Digital Twin and start learning your way."
      accent={colors.orange}
      homeRoute="/student/home"
      otherModeRoute="/auth/student-login"
      otherModeLabel="Log in"
    />
  );
}
