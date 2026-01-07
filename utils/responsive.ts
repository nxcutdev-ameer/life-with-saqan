import { Dimensions, PixelRatio } from 'react-native';

/**
 * Responsive scaling helpers.
 *
 * These helpers convert a size defined against a baseline design to a size
 * that fits the current device's window.
 *
 * Baseline chosen: iPhone X/11 Pro (375 x 812).
 */

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

function getWindowSize() {
  return Dimensions.get('window');
}

/**
 * Scale a size according to current window width.
 */
export function scaleWidth(size: number, baseWidth: number = BASE_WIDTH): number {
  const { width } = getWindowSize();
  return PixelRatio.roundToNearestPixel((width / baseWidth) * size);
}

/**
 * Scale a size according to current window height.
 */
export function scaleHeight(size: number, baseHeight: number = BASE_HEIGHT): number {
  const { height } = getWindowSize();
  return PixelRatio.roundToNearestPixel((height / baseHeight) * size);
}

/**
 * Scale a font size with a conservative approach: use the smaller of width/height scaling.
 */
export function scaleFont(size: number): number {
  const w = scaleWidth(size);
  const h = scaleHeight(size);
  return Math.min(w, h);
}

/**
 * Backwards-compatible aliases.
 *
 * @deprecated Prefer scaleWidth/scaleHeight/scaleFont
 */
export const getWidthEquivalent = scaleWidth;

/** @deprecated Prefer scaleWidth/scaleHeight/scaleFont */
export const getHeightEquivalent = scaleHeight;

/** @deprecated Prefer scaleWidth/scaleHeight/scaleFont */
export const getFontEquivalent = scaleFont;

/**
 * Convenience alias often used for spacing.
 */
export const s = scaleWidth;
