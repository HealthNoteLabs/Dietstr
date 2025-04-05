import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNativeApp } from '@/capacitor';

/**
 * Take a photo using the device camera
 * Uses Capacitor Camera API on native apps, falls back to file input on web
 */
export async function takeCameraPhoto(): Promise<string | null> {
  try {
    // If we're on a native app, use Capacitor Camera API
    if (isNativeApp()) {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        direction: 'rear',
      });
      
      return image.dataUrl || null;
    } else {
      throw new Error('Not a native app');
    }
  } catch (error) {
    console.error('Error taking photo:', error);
    return null;
  }
}

/**
 * Check if camera permissions are granted
 */
export async function checkCameraPermissions(): Promise<boolean> {
  try {
    if (!isNativeApp()) return true;
    
    const permissions = await Camera.checkPermissions();
    return permissions.camera === 'granted';
  } catch (error) {
    console.error('Error checking camera permissions:', error);
    return false;
  }
}

/**
 * Request camera permissions
 */
export async function requestCameraPermissions(): Promise<boolean> {
  try {
    if (!isNativeApp()) return true;
    
    const permissions = await Camera.requestPermissions();
    return permissions.camera === 'granted';
  } catch (error) {
    console.error('Error requesting camera permissions:', error);
    return false;
  }
}