/**
 * RecordingItem.tsx
 *
 * Displays one local recording and allows playback directly inside the app.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Sound from 'react-native-sound';
import { CallRecordingFile } from '../types/Recording.types';
import { formatDateTime, formatFileSize } from '../utils/formatters';
import { COLORS } from '../utils/constants';

Sound.setCategory('Playback');

interface Props {
  recording: CallRecordingFile;
  synced?: boolean;
}

function RecordingItem({ recording, synced = false }: Props) {
  const soundRef = useRef<Sound | null>(null);

  const [loadingAudio, setLoadingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return () => {
      soundRef.current?.release();
      soundRef.current = null;
    };
  }, []);

  const playLoadedSound = (sound: Sound) => {
    setIsPlaying(true);

    sound.play(success => {
      setIsPlaying(false);

      if (!success) {
        Alert.alert(
          'Playback failed',
          'Android could not decode this recording format.',
        );
        return;
      }

      // Prepare the same Sound object for replay.
      sound.setCurrentTime(0);
    });
  };

  const handlePlayPause = () => {
    if (loadingAudio) {
      return;
    }

    if (soundRef.current && isPlaying) {
      soundRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (soundRef.current) {
      playLoadedSound(soundRef.current);
      return;
    }

    setLoadingAudio(true);

    const sound = new Sound(recording.filePath, '', error => {
      setLoadingAudio(false);

      if (error) {
        sound.release();
        soundRef.current = null;

        console.warn(
          '[RecordingItem] Failed to load recording:',
          recording.filePath,
          error,
        );

        Alert.alert(
          'Unable to play recording',
          'The file exists, but this audio format could not be opened on this device.',
        );
        return;
      }

      soundRef.current = sound;
      playLoadedSound(sound);
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.fileName} numberOfLines={1}>
          {recording.fileName}
        </Text>

        <View style={styles.badges}>
          {synced ? <Text style={styles.syncedBadge}>SYNCED</Text> : null}

          <Text style={styles.extension}>
            {recording.extension.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.path} numberOfLines={2}>
        {recording.filePath}
      </Text>

      <View style={styles.row}>
        <Text style={styles.meta}>{formatFileSize(recording.fileSize)}</Text>
        <Text style={styles.meta}>
          {recording.recordingTime > 0
            ? formatDateTime(recording.recordingTime)
            : 'Time unavailable'}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.playButton}
        activeOpacity={0.8}
        onPress={handlePlayPause}
        disabled={loadingAudio}
        accessibilityLabel={isPlaying ? 'Pause recording' : 'Play recording'}
      >
        {loadingAudio ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <Text style={styles.playButtonText}>
            {isPlaying ? '❚❚  Pause' : '▶  Play'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default React.memo(RecordingItem);

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  extension: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  syncedBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  path: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 5,
  },
  meta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 7,
  },
  playButton: {
    marginTop: 12,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  playButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
});
