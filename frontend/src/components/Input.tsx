import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius, spacing } from '@/src/theme';

type Props = TextInputProps & {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  isPassword?: boolean;
  testID?: string;
};

export default function Input({ label, icon, isPassword, testID, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!isPassword);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, focused && styles.fieldFocused]}>
        {icon ? <Feather name={icon} size={18} color={colors.onSurfaceMuted} style={{ marginRight: spacing.sm }} /> : null}
        <TextInput
          testID={testID}
          placeholderTextColor={colors.onSurfaceMuted}
          style={[styles.input, style]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={hidden}
          autoCapitalize="none"
          {...rest}
        />
        {isPassword ? (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={8} testID={`${testID}-toggle`}>
            <Feather name={hidden ? 'eye' : 'eye-off'} size={18} color={colors.onSurfaceMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceMuted,
    marginBottom: spacing.xs + 2,
    marginLeft: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 54,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fieldFocused: {
    borderColor: colors.brand,
    backgroundColor: '#FBF7F1',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.onSurface,
    paddingVertical: 0,
  },
});
