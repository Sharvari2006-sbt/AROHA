import { Redirect } from 'expo-router';

// Legacy sample quizzes are intentionally unavailable in supervised mode.
// Every child assessment must come from a real parent assignment.
export default function LegacyQuizRedirect() {
  return <Redirect href="/child/quiz" />;
}
