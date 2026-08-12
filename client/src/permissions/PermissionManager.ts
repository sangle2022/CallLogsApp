/**
 * PermissionManager.ts
 * Centralised runtime-permission handling for Android.
 *
 * CHANGE (fix for "app never asks for permission"):
 * Android silently blocks the permission popup once a permission has been
 * denied before (or denied while the app was previously crashing during
 * setup). PermissionsAndroid.requestMultiple() then just returns "denied"
 * with NO dialog shown — which looks identical to "nothing happened".
 *
 * This version explicitly detects that "permanently denied" state so the
 * UI can tell the user to open Settings instead of retrying forever.
 */
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import RNFS from 'react-native-fs';

export type PermissionResult = {
  granted: boolean;
  deniedPermissions: string[];
  permanentlyDenied: boolean; // true = must go to Settings, popup won't show again
};

class PermissionManagerClass {
  async requestCallLogPermissions(): Promise<PermissionResult> {
    if (Platform.OS !== 'android') {
      return { granted: false, deniedPermissions: ['UNSUPPORTED_PLATFORM'], permanentlyDenied: false };
    }
    const permissions = [
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
    ];
    return this.requestMultiple(permissions);
  }

  async requestStoragePermissions(): Promise<PermissionResult> {
    if (Platform.OS !== 'android') {
      return { granted: false, deniedPermissions: ['UNSUPPORTED_PLATFORM'], permanentlyDenied: false };
    }

    const sdkInt = Platform.Version as number;
    const permissions =
      sdkInt >= 33
        ? [PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO]
        : [
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          ];

    const normalResult = await this.requestMultiple(permissions);

    if (sdkInt >= 30) {
      const hasAllFilesAccess = await this.hasManageExternalStorage();
      if (!hasAllFilesAccess) {
        return {
          granted: false,
          deniedPermissions: [...normalResult.deniedPermissions, 'MANAGE_EXTERNAL_STORAGE'],
          // MANAGE_EXTERNAL_STORAGE can ONLY be granted via Settings, never a popup.
          permanentlyDenied: true,
        };
      }
    }

    return normalResult;
  }

  async hasManageExternalStorage(): Promise<boolean> {
    try {
      await RNFS.readDir(RNFS.ExternalStorageDirectoryPath);
      return true;
    } catch {
      return false;
    }
  }

  /** Opens this app's main Settings page (works on every Android version). */
  openAppSettings(): void {
    Linking.openSettings();
  }

  /** Opens the "All files access" screen specifically (API 30+ only). */
  async openManageStorageSettings(): Promise<void> {
    try {
      await Linking.sendIntent(
        'android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION',
        [{ key: 'package', value: 'package:com.callrecorderapp' }],
      );
    } catch (error) {
      console.warn('[PermissionManager] Falling back to app settings:', error);
      this.openAppSettings();
    }
  }

  async requestAllPermissions(): Promise<PermissionResult> {
    const callLogResult = await this.requestCallLogPermissions();
    const storageResult = await this.requestStoragePermissions();
    return {
      granted: callLogResult.granted && storageResult.granted,
      deniedPermissions: [...callLogResult.deniedPermissions, ...storageResult.deniedPermissions],
      permanentlyDenied: callLogResult.permanentlyDenied || storageResult.permanentlyDenied,
    };
  }

  private async requestMultiple(permissions: string[]): Promise<PermissionResult> {
    try {
      // Step 1: check current status BEFORE requesting, so we know if a
      // popup is even possible.
      const preCheckResults = await Promise.all(
        permissions.map(p => PermissionsAndroid.check(p as any)),
      );
      const alreadyGranted = preCheckResults.every(Boolean);
      if (alreadyGranted) {
        return { granted: true, deniedPermissions: [], permanentlyDenied: false };
      }

      // Step 2: request. If a permission was already permanently denied,
      // Android returns 'never_ask_again' immediately with NO dialog shown.
      const results = await PermissionsAndroid.requestMultiple(permissions as any);

      const deniedPermissions: string[] = [];
      let permanentlyDenied = false;

      Object.entries(results).forEach(([permission, status]) => {
        if (status !== PermissionsAndroid.RESULTS.GRANTED) {
          deniedPermissions.push(permission);
        }
        if (status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          permanentlyDenied = true;
        }
      });

      console.log('[PermissionManager] Request results:', results);

      return { granted: deniedPermissions.length === 0, deniedPermissions, permanentlyDenied };
    } catch (error) {
      console.warn('[PermissionManager] Permission request failed:', error);
      return { granted: false, deniedPermissions: permissions, permanentlyDenied: false };
    }
  }
}

export const PermissionManager = new PermissionManagerClass();