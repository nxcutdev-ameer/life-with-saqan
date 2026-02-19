import React from 'react';
import Svg, { Path } from 'react-native-svg';

export type HomeSharpProps = {
  size?: number;
  color?: string;
};

/**
 * Sharp-edged filled home icon intended for tab bars.
 * Uses `color` as fill.
 */
export default function HomeSharp({ size = 20, color = '#FFFFFF' }: HomeSharpProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Roof */}
      <Path
        d="M12 3L2 11V21H22V11L12 3Z"
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </Svg>
  );
}
