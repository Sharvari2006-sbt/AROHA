import React, { useState } from 'react';
import { Text, View, StyleSheet, Pressable } from 'react-native';
import { Link, useRouter } from 'expo-router';

import AuthLayout from '@/src/components/AuthLayout';
import Input from '@/src/components/Input';
import PrimaryButton from '@/src/components/PrimaryButton';
import { colors, spacing } from '@/src/theme';

type Mode = 'login' | 'signup';
type Role = 'student' | 'parent' | 'child';

type Props = {
  mode: Mode;
  role: Role;
  eyebrow: string;
  title: string;
  subtitle?: string;
  accent?: string;
  homeRoute: string;
  otherModeRoute: string;
  otherModeLabel: string;
};

export default function AuthForm({
  mode,
  role,
  eyebrow,
  title,
  subtitle,
  accent = colors.brand,
  homeRoute,
  otherModeRoute,
  otherModeLabel,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const showName = mode === 'signup';
  const showInvite = role === 'child';

  const submit = () => {
    setErr(null);
    if (mode === 'signup' && !name.trim()) return setErr('Please enter your name.');
    if (!email.trim() || !email.includes('@')) return setErr('Please enter a valid email.');
    if (!password || password.length < 4) return setErr('Password must be at least 4 characters.');
    if (showInvite && !invite.trim()) return setErr('Please enter your parent invite code.');
    setLoading(true);
    // mock delay then navigate
    setTimeout(() => {
      setLoading(false);
      router.replace(homeRoute as any);
    }, 700);
  };

  return (
    <AuthLayout eyebrow={eyebrow} title={title} subtitle={subtitle} accent={accent}>
      {showName ? (
        <Input
          label="Name"
          icon="user"
          placeholder="Your full name"
          value={name}
          onChangeText={setName}
          testID={`${role}-name-input`}
          autoCapitalize="words"
        />
      ) : null}
      <Input
        label="Email"
        icon="mail"
        placeholder="you@example.com"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        testID={`${role}-email-input`}
      />
      <Input
        label="Password"
        icon="lock"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        isPassword
        testID={`${role}-password-input`}
      />
      {showInvite ? (
        <Input
          label="Parent Invite Code"
          icon="key"
          placeholder="e.g. TWIN-4821"
          value={invite}
          onChangeText={setInvite}
          autoCapitalize="characters"
          testID="child-invite-input"
        />
      ) : null}

      {err ? (
        <View style={styles.errorBox} testID="auth-error">
          <Text style={styles.errorText}>{err}</Text>
        </View>
      ) : null}

      <PrimaryButton
        label={mode === 'login' ? 'Log in' : 'Create account'}
        onPress={submit}
        loading={loading}
        testID={`${role}-${mode}-submit`}
        style={{ marginTop: spacing.md, backgroundColor: accent }}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>
          {mode === 'login' ? 'New here?' : 'Already have an account?'}
        </Text>
        <Link href={otherModeRoute as any} asChild>
          <Pressable testID={`${role}-switch-mode`}>
            <Text style={[styles.switchLink, { color: accent }]}>{otherModeLabel}</Text>
          </Pressable>
        </Link>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: '#FBECE4',
    borderWidth: 1,
    borderColor: '#F1C7B4',
  },
  errorText: { color: '#8A3B18', fontSize: 13, fontWeight: '600' },
  switchRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  switchText: { color: colors.onSurfaceMuted, fontSize: 14 },
  switchLink: { fontSize: 14, fontWeight: '700' },
});
