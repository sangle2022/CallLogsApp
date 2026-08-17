import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {Calendar} from 'react-native-calendars';
import {COLORS} from '../utils/constants';
import {buildDateRange, todayDateKey} from '../utils/dateRange';
import {DateRange, SyncProgress} from '../types/Sync.types';

interface Props {
  visible: boolean;
  uploading: boolean;
  progress: SyncProgress;
  onClose: () => void;
  onConfirm: (range: DateRange) => Promise<void>;
}

/**
 * Recording-specific date selector.
 *
 * Recordings are intentionally limited to ONE calendar day per sync.
 * Call Logs continue using the existing SyncDateRangeModal and its 7-day limit.
 */
export default function RecordingDateRangeModal({
  visible,
  uploading,
  progress,
  onClose,
  onConfirm,
}: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setSelectedDate(null);
      setError(null);
    }
  }, [visible]);

  const handleConfirm = async () => {
    if (!selectedDate) {
      setError('Select one date to upload recordings.');
      return;
    }

    setError(null);

    try {
      // startDate === endDate, therefore this is always exactly one calendar day.
      const range = buildDateRange(selectedDate, selectedDate, 1);
      await onConfirm(range);
    } catch (err: any) {
      setError(err?.message || 'Invalid recording date.');
    }
  };

  const markedDates = selectedDate
    ? {
        [selectedDate]: {
          selected: true,
          selectedColor: COLORS.primary,
          selectedTextColor: '#FFFFFF',
        },
      }
    : {};

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      navigationBarTranslucent={false}
      statusBarTranslucent={false}
      onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.backdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onClose}
              disabled={uploading}
            />

            <View style={styles.sheet}>
              <ScrollView bounces={false} contentContainerStyle={styles.content}>
                <Text style={styles.title}>Upload recordings to CRM</Text>
                <Text style={styles.subtitle}>
                  Select one date. Recording upload is limited to one calendar day per sync.
                </Text>

                <Calendar
                  markedDates={markedDates}
                  onDayPress={day => {
                    setSelectedDate(day.dateString);
                    setError(null);
                  }}
                  maxDate={todayDateKey()}
                  disableAllTouchEventsForDisabledDays
                />

                <View style={styles.rangeTextWrap}>
                  <Text style={styles.rangeText}>
                    Selected date: {selectedDate || 'Not selected'}
                  </Text>
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                {uploading ? (
                  <View style={styles.progressWrap}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.progressText}>
                      Uploading {progress.completed} of {progress.total} recordings...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.actions}>
                    <Pressable style={styles.cancel} onPress={onClose}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>

                    <Pressable style={styles.sync} onPress={handleConfirm}>
                      <Text style={styles.syncText}>Upload selected day</Text>
                    </Pressable>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
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
  },
  content: {
    padding: 18,
    paddingBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 6,
    marginBottom: 10,
  },
  rangeTextWrap: {
    marginTop: 12,
  },
  rangeText: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  error: {
    color: COLORS.danger,
    marginTop: 10,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  cancel: {
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  sync: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
  },
  syncText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 10,
  },
  progressText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
});
