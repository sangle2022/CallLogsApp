/**
 * RecordingItem.tsx
 * Presentational component - renders a single call-recording file row.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CallRecordingFile } from '../types/Recording.types';
import { formatDateTime, formatFileSize } from '../utils/formatters';
import { COLORS } from '../utils/constants';

interface Props {
  recording: CallRecordingFile;
}

function RecordingItem({ recording }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.fileName} numberOfLines={1}>
          {recording.fileName}
        </Text>
        <Text style={styles.extension}>{recording.extension.toUpperCase()}</Text>
      </View>
      <Text style={styles.path} numberOfLines={2}>
        {recording.filePath}
      </Text>
      <View style={styles.row}>
        <Text style={styles.meta}>{formatFileSize(recording.fileSize)}</Text>
        <Text style={styles.meta}>{formatDateTime(recording.createdDate)}</Text>
      </View>
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
  fileName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flexShrink: 1,
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
  path: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  meta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
});
