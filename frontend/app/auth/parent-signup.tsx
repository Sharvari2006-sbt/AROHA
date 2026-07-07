import AuthForm from '@/src/components/AuthForm';
import { colors } from '@/src/theme';

export default function ParentSignup() {
  return (
    <AuthForm
      mode="signup"
      role="parent"
      eyebrow="PARENT"
      title="Create your parent account."
      subtitle="Invite your children and set gentle goals."
      accent={colors.brand}
      homeRoute="/parent/home"
      otherModeRoute="/auth/parent-login"
      otherModeLabel="Log in"
    />
  );
}
