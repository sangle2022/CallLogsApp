/**
 * CallLogItem.tsx
 * Presentational component - renders a single call log row.
 * No business logic here; all data comes in via props.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CallLogEntry, CallType } from '../types/CallLog.types';
import { formatDuration } from '../utils/formatters';
import { COLORS } from '../utils/constants';

interface Props {
  entry: CallLogEntry;
}

// Small helper to give each call type a distinct color/label.
function getCallTypeStyle(type: CallType): { label: string; color: string } {
  switch (type) {
    case CallType.INCOMING:
      return { label: 'Incoming', color: COLORS.success };
    case CallType.OUTGOING:
      return { label: 'Outgoing', color: COLORS.primary };
    case CallType.MISSED:
      return { label: 'Missed', color: COLORS.danger };
    case CallType.REJECTED:
      return { label: 'Rejected', color: COLORS.danger };
    case CallType.BLOCKED:
      return { label: 'Blocked', color: COLORS.danger };
    case CallType.VOICEMAIL:
      return { label: 'Voicemail', color: COLORS.textSecondary };
    default:
      return { label: 'Unknown', color: COLORS.textSecondary };
  }
}

function CallLogItem({ entry }: Props) {
  const typeStyle = getCallTypeStyle(entry.callType);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.callerName}
        </Text>
        <Text style={[styles.callType, { color: typeStyle.color }]}>
          {typeStyle.label}
        </Text>
      </View>
      <Text style={styles.number}>{entry.phoneNumber}</Text>
      <View style={styles.row}>
        <Text style={styles.meta}>{formatDuration(entry.duration)}</Text>
        <Text style={styles.meta}>{entry.dateTime}</Text>
      </View>
    </View>
  );
}

// Memoized since call logs can be long lists that re-render on scroll.
export default React.memo(CallLogItem);

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
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  callType: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  number: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
});
