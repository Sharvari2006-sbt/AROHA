import AuthForm from '@/src/components/AuthForm';
import { colors } from '@/src/theme';

export default function ChildLogin() {
  return (
    <AuthForm
      mode="login"
      role="child"
      eyebrow="CHILD"
      title="Hi there, learner!"
      subtitle="Log in to continue with your assigned learning."
      accent={colors.orange}
      homeRoute="/child/home"
      otherModeRoute="/auth/child-signup"
      otherModeLabel="Create account"
    />
  );
}
