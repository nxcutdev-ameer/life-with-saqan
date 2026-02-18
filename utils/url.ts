import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

/**
 * Ensure a string is an absolute http(s) URL. If it looks like a domain without a scheme,
 * it will be prefixed with https://.
 */
export function normalizeHttpUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;

  // Already has a scheme
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return value;

  // Looks like domain/path, default to https
  return `https://${value}`;
}

/**
 * Prefer opening web URLs in an in-app browser for a more consistent UX.
 */
export async function openWebUrl(raw: string | null | undefined): Promise<void> {
  const url = normalizeHttpUrl(raw);
  if (!url) return;

  // WebBrowser is generally more reliable for http(s) URLs than Linking on mobile.
  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
    return;
  } catch {
    // Fallback to system handler
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
    }
  }
}
