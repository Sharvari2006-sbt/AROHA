import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
  colorA?: string;
  colorB?: string;
  variant?: 'a' | 'b' | 'c';
};

// Decorative soft organic blobs to sit inside cards (top-right corner style).
export default function BlobBackground({
  width = 140,
  height = 140,
  colorA = '#F4A261',
  colorB = '#E9C46A',
  variant = 'a',
}: Props) {
  const paths = {
    a: 'M120 20 C150 30 150 90 110 100 C80 108 60 130 30 110 C5 92 20 50 55 40 C80 33 100 14 120 20 Z',
    b: 'M110 10 C140 25 138 80 100 90 C70 98 55 120 30 100 C10 84 15 55 45 40 C70 28 90 0 110 10 Z',
    c: 'M100 15 C138 20 145 75 115 95 C90 112 65 120 40 105 C15 90 15 55 45 35 C70 18 80 12 100 15 Z',
  };
  return (
    <Svg width={width} height={height} viewBox="0 0 160 140">
      <Path d={paths[variant]} fill={colorA} opacity={0.85} />
      <Path
        d={paths[variant === 'a' ? 'b' : variant === 'b' ? 'c' : 'a']}
        fill={colorB}
        opacity={0.55}
        transform="translate(-15,15) scale(0.85)"
      />
      <Circle cx="30" cy="115" r="6" fill={colorA} opacity={0.5} />
      <Circle cx="140" cy="120" r="4" fill={colorB} opacity={0.7} />
    </Svg>
  );
}
