import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing } from '@/src/theme';

type IconName = keyof typeof Feather.glyphMap;

const ICONS: Record<string, IconName> = {
  home: 'home',
  subjects: 'book-open',
  study: 'edit-3',
  analytics: 'bar-chart-2',
  profile: 'user',
  schedule: 'calendar',
  students: 'users',
  tasks: 'check-square',
  quiz: 'help-circle',
};

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = (options.title ?? route.name) as string;
          const icon = ICONS[route.name] || 'circle';

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
          };

          return (
            <Pressable
              key={route.key}
              testID={`tab-${route.name}`}
              onPress={onPress}
              style={styles.item}
              hitSlop={6}
            >
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Feather name={icon} size={20} color={focused ? '#FFF' : colors.onSurfaceMuted} />
              </View>
              <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.brand,
  },
  label: {
    marginTop: 2,
    fontSize: 10,
    color: colors.onSurfaceMuted,
    fontWeight: '600',
  },
  labelActive: { color: colors.onSurface, fontWeight: '700' },
});
