import AuthForm from '@/src/components/AuthForm';
import { colors } from '@/src/theme';

export default function ChildSignup() {
  return (
    <AuthForm
      mode="signup"
      role="child"
      eyebrow="CHILD"
      title="Let's set you up."
      subtitle="Ask your parent for their invite code to join their space."
      accent={colors.orange}
      homeRoute="/child/home"
      otherModeRoute="/auth/child-login"
      otherModeLabel="Log in"
    />
  );
}
