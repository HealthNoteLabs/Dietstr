import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

/**
 * Check if the app is running as a native app using Capacitor
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Check if the app is running on Android
 */
export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/**
 * Check if the app is running on iOS
 */
export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

/**
 * Store a preference in Capacitor Preferences storage
 * 
 * @param key The key for the preference
 * @param value The value to store
 */
export async function storePreference(key: string, value: string): Promise<void> {
  if (!isNativeApp()) return;
  
  await Preferences.set({
    key,
    value,
  });
}

/**
 * Get a preference from Capacitor Preferences storage
 * 
 * @param key The key for the preference
 * @returns The value of the preference or null if not found
 */
export async function getPreference(key: string): Promise<string | null> {
  if (!isNativeApp()) return null;
  
  const { value } = await Preferences.get({ key });
  return value;
}

/**
 * Remove a preference from Capacitor Preferences storage
 * 
 * @param key The key for the preference to remove
 */
export async function removePreference(key: string): Promise<void> {
  if (!isNativeApp()) return;
  
  await Preferences.remove({ key });
}

/**
 * Register listeners for app lifecycle events
 * 
 * @param onResume Function to call when the app is resumed
 * @param onPause Function to call when the app is paused
 * @param onBackButton Function to call when back button is pressed (Android)
 * @returns A cleanup function to unregister the listeners
 */
export function registerAppListeners(
  onResume?: () => void,
  onPause?: () => void,
  onBackButton?: () => boolean
): () => void {
  // Variables to store listener handles that might be set later
  let resumeListener: PluginListenerHandle | null = null;
  let pauseListener: PluginListenerHandle | null = null;
  let backButtonListener: PluginListenerHandle | null = null;

  // Only register listeners if running in native environment
  if (isNativeApp()) {
    // Resume event listener
    if (onResume) {
      App.addListener('resume', onResume).then(listener => {
        resumeListener = listener;
      }).catch(err => {
        console.error('Failed to add resume listener:', err);
      });
    }
    
    // Pause event listener
    if (onPause) {
      App.addListener('pause', onPause).then(listener => {
        pauseListener = listener;
      }).catch(err => {
        console.error('Failed to add pause listener:', err);
      });
    }
    
    // Back button event listener (Android)
    if (onBackButton) {
      App.addListener('backButton', () => {
        // Return true from the handler to prevent default back button behavior
        return { shouldPrevent: onBackButton() };
      }).then(listener => {
        backButtonListener = listener;
      }).catch(err => {
        console.error('Failed to add back button listener:', err);
      });
    }
  }

  // Return a cleanup function that removes all listeners
  return () => {
    if (resumeListener) {
      resumeListener.remove();
    }
    
    if (pauseListener) {
      pauseListener.remove();
    }
    
    if (backButtonListener) {
      backButtonListener.remove();
    }
  };
}

/**
 * Register a handler for app URL open events
 * 
 * @param handler Function to call when the app is opened with a URL
 * @returns A cleanup function to unregister the handler
 */
export function registerAppUrlOpenHandler(
  handler: (url: string) => void
): () => void {
  let urlListener: PluginListenerHandle | null = null;

  // Only setup if running natively
  if (isNativeApp()) {
    App.addListener('appUrlOpen', (data) => {
      handler(data.url);
    }).then(listener => {
      urlListener = listener;
    }).catch(err => {
      console.error('Failed to add URL listener:', err);
    });
  }

  // Return cleanup function
  return () => {
    if (urlListener) {
      urlListener.remove();
    }
  };
}

/**
 * Setup Capacitor for the web app
 * This should be called in main.tsx
 */
export function setupCapacitor(): void {
  if (isNativeApp()) {
    // Add capacitor class to html element for CSS targeting
    document.documentElement.classList.add('capacitor');
    
    // Set meta viewport for mobile apps
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, viewport-fit=cover'
      );
    }
  }
}