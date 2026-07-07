import AuthForm from '@/src/components/AuthForm';
import { colors } from '@/src/theme';

export default function ChildLogin() {
  return (
    <AuthForm
      mode="login"
      role="child"
      eyebrow="CHILD"
      title="Hi there, learner!"
      subtitle="Enter your details and your parent's invite code."
      accent={colors.orange}
      homeRoute="/child/home"
      otherModeRoute="/auth/child-signup"
      otherModeLabel="Create account"
    />
  );
}
