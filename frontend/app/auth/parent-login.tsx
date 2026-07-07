import AuthForm from '@/src/components/AuthForm';
import { colors } from '@/src/theme';

export default function ParentLogin() {
  return (
    <AuthForm
      mode="login"
      role="parent"
      eyebrow="PARENT"
      title="Welcome back, guide."
      subtitle="Track your child's progress with calm clarity."
      accent={colors.brand}
      homeRoute="/parent/home"
      otherModeRoute="/auth/parent-signup"
      otherModeLabel="Create account"
    />
  );
}
