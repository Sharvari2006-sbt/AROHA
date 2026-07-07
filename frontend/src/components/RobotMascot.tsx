import React from 'react';
import Svg, { Circle, Rect, Path, G, Ellipse, Defs, LinearGradient, Stop } from 'react-native-svg';

type Props = { size?: number; accent?: string; body?: string };

// A cute rounded futuristic robot companion.
export default function RobotMascot({ size = 160, accent = '#F4A261', body = '#FFFFFF' }: Props) {
  const w = size;
  const h = size * 1.15;
  return (
    <Svg width={w} height={h} viewBox="0 0 160 184">
      <Defs>
        <LinearGradient id="bodyG" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={body} />
          <Stop offset="1" stopColor="#F5EFEB" />
        </LinearGradient>
        <LinearGradient id="visorG" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#4A4036" />
          <Stop offset="1" stopColor="#2E2822" />
        </LinearGradient>
      </Defs>
      {/* soft shadow ellipse */}
      <Ellipse cx="80" cy="176" rx="46" ry="6" fill="#4A4036" opacity={0.08} />
      {/* antenna */}
      <Path d="M80 14 L80 30" stroke="#9CAF88" strokeWidth={4} strokeLinecap="round" />
      <Circle cx="80" cy="12" r="6" fill={accent} />
      {/* head */}
      <G>
        <Rect x="24" y="30" width="112" height="90" rx="30" fill="url(#bodyG)" stroke="#EBE3DB" strokeWidth={2} />
        {/* visor */}
        <Rect x="40" y="52" width="80" height="46" rx="22" fill="url(#visorG)" />
        {/* eyes */}
        <Circle cx="66" cy="76" r="6" fill="#E9C46A" />
        <Circle cx="94" cy="76" r="6" fill="#E9C46A" />
        <Circle cx="68" cy="74" r="1.6" fill="#FFFFFF" />
        <Circle cx="96" cy="74" r="1.6" fill="#FFFFFF" />
        {/* cheek blush */}
        <Circle cx="42" cy="96" r="4" fill="#F4A261" opacity={0.45} />
        <Circle cx="118" cy="96" r="4" fill="#F4A261" opacity={0.45} />
        {/* side lights */}
        <Circle cx="30" cy="60" r="3" fill="#9CAF88" />
        <Circle cx="130" cy="60" r="3" fill="#9CAF88" />
      </G>
      {/* body */}
      <G>
        <Rect x="46" y="118" width="68" height="46" rx="20" fill="url(#bodyG)" stroke="#EBE3DB" strokeWidth={2} />
        <Circle cx="80" cy="141" r="8" fill={accent} />
        <Circle cx="80" cy="141" r="3" fill="#FFFFFF" />
        {/* arms */}
        <Circle cx="34" cy="132" r="8" fill={body} stroke="#EBE3DB" strokeWidth={2} />
        <Circle cx="126" cy="132" r="8" fill={body} stroke="#EBE3DB" strokeWidth={2} />
      </G>
    </Svg>
  );
}
