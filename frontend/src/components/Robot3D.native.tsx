import React, { Suspense } from 'react';
import { View, StyleSheet } from 'react-native';

import RobotMascot from '@/src/components/RobotMascot';

export type RobotMood = 'idle' | 'happy' | 'worried' | 'celebrating' | 'sleepy' | 'wave' | 'thinking';

type Props = {
  mood?: RobotMood;
  stage?: 1 | 2 | 3 | 4 | 5;
  size?: number;
  testID?: string;
};

// Metro keeps import() as a separate development chunk. That lets Expo Go
// open the screen before parsing Three.js, instead of timing out on the QR.
const Robot3DScene = React.lazy(() => import('./Robot3DScene.native'));

export default function Robot3D(props: Props) {
  const size = props.size ?? 200;
  return (
    <Suspense
      fallback={(
        <View style={[styles.fallback, { width: size, height: size }]} testID={props.testID}>
          <RobotMascot size={Math.round(size * 0.72)} />
        </View>
      )}
    >
      <Robot3DScene {...props} />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
