import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

export async function initNativeShell(isDarkHeader: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({
      style: isDarkHeader ? Style.Light : Style.Dark,
    });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({
        color: isDarkHeader ? '#0f172a' : '#ffffff',
      });
    }
  } catch {
    // Ignore status bar errors on unsupported environments
  }

  try {
    await SplashScreen.hide();
  } catch {
    // Ignore splash screen errors
  }
}

export function registerAndroidBackHandler(
  handleBack: () => boolean,
): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};

  let listenerHandle: { remove: () => Promise<void> } | null = null;
  let disposed = false;

  CapacitorApp.addListener('backButton', () => {
    const consumed = handleBack();
    if (!consumed) {
      void CapacitorApp.exitApp();
    }
  })
    .then((handle) => {
      if (disposed) {
        void handle.remove();
      } else {
        listenerHandle = handle;
      }
    })
    .catch(() => {
      // Ignore if listener registration fails
    });

  return () => {
    disposed = true;
    if (listenerHandle) {
      void listenerHandle.remove();
    }
  };
}

export function triggerHaptic(
  kind: 'light' | 'medium' | 'success' | 'error',
): void {
  if (!Capacitor.isNativePlatform()) return;

  try {
    if (kind === 'light') {
      void Haptics.impact({ style: ImpactStyle.Light });
    } else if (kind === 'medium') {
      void Haptics.impact({ style: ImpactStyle.Medium });
    } else if (kind === 'success') {
      void Haptics.notification({ type: NotificationType.Success });
    } else {
      void Haptics.notification({ type: NotificationType.Error });
    }
  } catch {
    // Ignore haptic errors
  }
}
