import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CallLogEntry, CallType } from '../types/CallLog.types';
import { formatDuration } from '../utils/formatters';
import { COLORS } from '../utils/constants';

interface Props {
  entry: CallLogEntry;
  acknowledged?: boolean;
}

function getCallTypeStyle(type: CallType): { label: string; color: string } {
  switch (type) {
    case CallType.INCOMING: return { label: 'Incoming', color: COLORS.success };
    case CallType.OUTGOING: return { label: 'Outgoing', color: COLORS.primary };
    case CallType.MISSED: return { label: 'Missed', color: COLORS.danger };
    case CallType.REJECTED: return { label: 'Rejected', color: COLORS.danger };
    case CallType.BLOCKED: return { label: 'Blocked', color: COLORS.danger };
    case CallType.VOICEMAIL: return { label: 'Voicemail', color: COLORS.textSecondary };
    default: return { label: 'Unknown', color: COLORS.textSecondary };
  }
}

function CallLogItem({ entry, acknowledged = false }: Props) {
  const typeStyle = getCallTypeStyle(entry.callType);
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.callerName} → {entry.receiverName}
        </Text>
        <Text style={[styles.callType, { color: typeStyle.color }]}>{typeStyle.label}</Text>
      </View>

      <Text style={styles.number} numberOfLines={1}>
        Remote: {entry.remoteName} · {entry.remoteNumber}
      </Text>

      <View style={styles.row}>
        <Text style={styles.meta}>{formatDuration(entry.duration)} · {entry.dateTime}</Text>
        {acknowledged ? <Text style={styles.synced}>Previously synced</Text> : null}
      </View>
    </View>
  );
}

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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
  callType: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  number: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 7, flexShrink: 1 },
  synced: { fontSize: 11, color: COLORS.success, fontWeight: '700', marginTop: 7 },
});
