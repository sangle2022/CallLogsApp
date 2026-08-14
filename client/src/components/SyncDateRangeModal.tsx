import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { COLORS } from '../utils/constants';
import { MAX_SYNC_RANGE_DAYS } from '../config/syncConfig';
import { buildDateRange, calendarDaySpan, todayDateKey } from '../utils/dateRange';
import { DateRange, SyncProgress } from '../types/Sync.types';

interface Props {
  visible: boolean;
  uploading: boolean;
  progress: SyncProgress;
  onClose: () => void;
  onConfirm: (range: DateRange) => Promise<void>;
}

function dateKeysBetween(start: string, end: string): string[] {
  if (!start || !end) return [];
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const cursor = new Date(Date.UTC(sy, sm - 1, sd));
  const last = new Date(Date.UTC(ey, em - 1, ed));
  const result: string[] = [];

  while (cursor <= last) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

export default function SyncDateRangeModal({
  visible,
  uploading,
  progress,
  onClose,
  onConfirm,
}: Props) {
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const markedDates = useMemo(() => {
    if (!startDate) return {};
    if (!endDate) {
      return {
        [startDate]: {
          startingDay: true,
          endingDay: true,
          color: COLORS.primary,
          textColor: '#fff',
        },
      };
    }

    const keys = dateKeysBetween(startDate, endDate);
    return Object.fromEntries(
      keys.map((key, index) => [
        key,
        {
          startingDay: index === 0,
          endingDay: index === keys.length - 1,
          color: COLORS.primary,
          textColor: '#fff',
        },
      ]),
    );
  }, [startDate, endDate]);

  const handleDayPress = (day: { dateString: string }) => {
    const selected = day.dateString;
    setError(null);

    if (!startDate || endDate) {
      setStartDate(selected);
      setEndDate(null);
      return;
    }

    if (selected < startDate) {
      setStartDate(selected);
      setEndDate(null);
      return;
    }

    const span = calendarDaySpan(startDate, selected);
    if (span > MAX_SYNC_RANGE_DAYS) {
      setError(`Maximum sync range is ${MAX_SYNC_RANGE_DAYS} calendar days.`);
      return;
    }
    setEndDate(selected);
  };

  const handleConfirm = async () => {
    if (!startDate || !endDate) {
      setError('Select both a start date and an end date.');
      return;
    }
    try {
      const range = buildDateRange(startDate, endDate);
      await onConfirm(range);
    } catch (err: any) {
      setError(err?.message || 'Invalid date range.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} disabled={uploading} />
        <View style={styles.sheet}>
          <ScrollView bounces={false}>
            <Text style={styles.title}>Sync calls to CRM</Text>
            <Text style={styles.subtitle}>
              Select a start and end date. Maximum {MAX_SYNC_RANGE_DAYS} days per sync.
            </Text>

            <Calendar
              markingType="period"
              markedDates={markedDates}
              onDayPress={handleDayPress}
              maxDate={todayDateKey()}
              disableAllTouchEventsForDisabledDays
            />

            <View style={styles.rangeTextWrap}>
              <Text style={styles.rangeText}>Start: {startDate || 'Not selected'}</Text>
              <Text style={styles.rangeText}>End: {endDate || 'Not selected'}</Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {uploading ? (
              <View style={styles.progressWrap}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.progressText}>
                  Syncing {progress.completed} of {progress.total} calls...
                </Text>
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable style={styles.cancel} onPress={onClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.sync} onPress={handleConfirm}>
                  <Text style={styles.syncText}>Sync selected range</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    paddingBottom: 30,
  },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 6, marginBottom: 10 },
  rangeTextWrap: { marginTop: 12 },
  rangeText: { fontSize: 13, color: COLORS.textPrimary, marginTop: 3 },
  error: { color: COLORS.danger, marginTop: 10, fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  cancel: { paddingHorizontal: 16, paddingVertical: 11 },
  cancelText: { color: COLORS.textSecondary, fontWeight: '600' },
  sync: { backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 8 },
  syncText: { color: '#fff', fontWeight: '700' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 10 },
  progressText: { color: COLORS.textSecondary, fontSize: 13 },
});
