/**
 * constants.ts
 * App-wide constants: colors, common folder paths for call recordings
 * (these vary by OEM - Samsung, Xiaomi/MIUI, OnePlus, stock Android, etc.)
 */
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

// Common directories where OEM dialers / recorder apps store call recordings.
// We scan all of these (skipping any that don't exist) and merge results.
export const CALL_RECORDING_DIRECTORIES: string[] = Platform.select({
  android: [
    `${RNFS.ExternalStorageDirectoryPath}/Call`,                       // Generic
    `${RNFS.ExternalStorageDirectoryPath}/CallRecordings`,             // Generic
    `${RNFS.ExternalStorageDirectoryPath}/Recordings/Call Recordings`, // MIUI / Xiaomi
    `${RNFS.ExternalStorageDirectoryPath}/MIUI/sound_recorder/call_rec`, // MIUI legacy
    `${RNFS.ExternalStorageDirectoryPath}/Android/data/com.samsung.android.dialer/files/Recordings`, // Samsung
    `${RNFS.ExternalStorageDirectoryPath}/Sounds/CallRecordings`,      // OnePlus / Oppo
    `${RNFS.ExternalStorageDirectoryPath}/PhoneRecord`,                // Vivo
    `${RNFS.ExternalStorageDirectoryPath}/Music/CallRecordings`,       // Some OEMs store under Music
  ],
  default: [],
}) as string[];

// Audio file extensions considered valid call recordings.
export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'amr', 'wav', '3gp', 'aac'];

export const COLORS = {
  primary: '#2563EB',
  primaryDark: '#1E40AF',
  background: '#F8FAFC',
  card: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  danger: '#DC2626',
  success: '#16A34A',
};
