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
  `${RNFS.ExternalStorageDirectoryPath}/Call`,
  `${RNFS.ExternalStorageDirectoryPath}/Calls`,

  `${RNFS.ExternalStorageDirectoryPath}/CallRecordings`,
  `${RNFS.ExternalStorageDirectoryPath}/Call Recordings`,

  `${RNFS.ExternalStorageDirectoryPath}/Recordings/Call`,
  `${RNFS.ExternalStorageDirectoryPath}/Recordings/Calls`,
  `${RNFS.ExternalStorageDirectoryPath}/Recordings/CallRecordings`,
  `${RNFS.ExternalStorageDirectoryPath}/Recordings/Call Recordings`,

  `${RNFS.ExternalStorageDirectoryPath}/Recorder/Call`,
  `${RNFS.ExternalStorageDirectoryPath}/Recorder/Calls`,
  `${RNFS.ExternalStorageDirectoryPath}/Recorder/CallRecordings`,
  `${RNFS.ExternalStorageDirectoryPath}/Recorder/Call Recordings`,

  `${RNFS.ExternalStorageDirectoryPath}/MIUI/sound_recorder/call_rec`,

  `${RNFS.ExternalStorageDirectoryPath}/Sounds/CallRecordings`,
  `${RNFS.ExternalStorageDirectoryPath}/Sounds/Call Recordings`,

  `${RNFS.ExternalStorageDirectoryPath}/PhoneRecord`,

  `${RNFS.ExternalStorageDirectoryPath}/Music/CallRecordings`,
  `${RNFS.ExternalStorageDirectoryPath}/Music/Call Recordings`,
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
