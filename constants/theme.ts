export type ThemeColors = {
  /** App background (screen root). */
  background: string;
  /** Elevated surfaces such as cards, modals, sheets. */
  surface: string;

  text: string;
  textSecondary: string;

  border: string;

  /** Brand primary (matches existing bronze). */
  primary: string;
  /** Secondary brand accent (matches existing brown). */
  secondary: string;

  /** Text displayed on top of `primary`. */
  textOnPrimary: string;

  /** Overlays used on top of media/backgrounds. */
  overlay: string;
  overlayLight: string;

  white: string;
  black: string;

  footerOverlay: string;
  footerOverlayText: string;
};

/**
 * Light theme values are aligned with the existing `constants/colors.ts` palette
 * so migrating screens is mostly a drop-in change.
 */
export const lightColors: ThemeColors = {
  background: '#f3eddf',
  surface: '#f3eddf',

  text: '#3d3d3d',
  textSecondary: 'rgba(61, 61, 61, 0.7)',

  border: '#3d3d3d',

  primary: '#b87818',
  secondary: '#6e3919',

  textOnPrimary: '#f3eddf',

  overlay: 'rgba(61, 61, 61, 0.85)',
  overlayLight: 'rgba(61, 61, 61, 0.5)',

  white: '#FFFFFF',
  black: '#000000',

  footerOverlay: 'rgba(255, 255, 255, 0.2)',
  footerOverlayText: 'rgba(0, 0, 0, 0.75)',
};

/**
 * Dark theme palette.
 *
 * Notes:
 * - We keep brand colors (primary/secondary) consistent.
 * - Background/surface are tuned for OLED-friendly dark UI.
 * - Borders use low-alpha white to avoid harsh outlines.
 */
export const darkColors: ThemeColors = {
  background: '#0f0f10',
  surface: '#17181a',

  text: '#f2f2f2',
  textSecondary: 'rgba(242, 242, 242, 0.72)',

  border: 'rgba(255, 255, 255, 0.18)',

  primary: '#b87818',
  secondary: '#6e3919',

  textOnPrimary: '#ffffff',

  overlay: 'rgba(0, 0, 0, 0.75)',
  overlayLight: 'rgba(0, 0, 0, 0.45)',

  white: '#FFFFFF',
  black: '#000000',

  footerOverlay: 'rgba(0, 0, 0, 0.25)',
  footerOverlayText: 'rgba(255, 255, 255, 0.8)',
};

export const getThemeColors = (isDarkMode: boolean): ThemeColors => (isDarkMode ? darkColors : lightColors);
