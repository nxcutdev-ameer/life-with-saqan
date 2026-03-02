import { getThemeColors } from '@/constants/theme';
import { useThemeStore } from '@/stores/themeStore';

/**
 * Small convenience hook to access the current theme.
 *
 * Manual toggle only (does not follow system color scheme).
 */
export const useTheme = () => {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const setDarkMode = useThemeStore((s) => s.setDarkMode);
  const toggleDarkMode = useThemeStore((s) => s.toggleDarkMode);

  const colors = getThemeColors(isDarkMode);

  return {
    isDarkMode,
    colors,
    setDarkMode,
    toggleDarkMode,
  };
};
