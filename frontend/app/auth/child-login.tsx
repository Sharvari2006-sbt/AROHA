import AuthForm from '@/src/components/AuthForm';
import { colors } from '@/src/theme';

export default function ChildLogin() {
  return (
    <AuthForm
      mode="login"
      role="child"
      eyebrow="CHILD"
      title="Hi there, learner!"
      subtitle="Sign in and pop in the invite code your parent shared."
      accent={colors.orange}
      homeRoute="/child/home"
      otherModeRoute="/auth/child-signup"
      otherModeLabel="Create account"
    />
  );
}
