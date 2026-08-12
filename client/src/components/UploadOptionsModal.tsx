/**
 * UploadOptionsModal.tsx
 * Popup shown when the upload button is tapped. Lets the user choose:
 *   - Today's records
 *   - All records
 *   - Custom (last N days, user-entered number)
 * Purely presentational - all upload logic lives in useUploadFlow.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { COLORS } from '../utils/constants';
import { UploadRange } from '../utils/dateFilters';

interface Props {
  visible: boolean;
  uploading: boolean;
  progress: { completed: number; total: number };
  onClose: () => void;
  onConfirm: (range: UploadRange, customDays?: number) => void;
  title?: string;
}

const RANGE_OPTIONS: { label: string; value: UploadRange; description: string }[] = [
  { label: "Today's records", value: 'TODAY', description: 'Only records from today' },
  { label: 'All records', value: 'ALL', description: 'Everything currently loaded' },
  { label: 'Custom range', value: 'CUSTOM', description: 'Records from the last N days' },
];

export default function UploadOptionsModal({
  visible,
  uploading,
  progress,
  onClose,
  onConfirm,
  title = 'Upload to CRM',
}: Props) {
  const [selectedRange, setSelectedRange] = useState<UploadRange>('TODAY');
  const [customDays, setCustomDays] = useState('30');
  const [customDaysError, setCustomDaysError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selectedRange === 'CUSTOM') {
      const days = parseInt(customDays, 10);
      if (!days || days <= 0) {
        setCustomDaysError('Enter a number greater than 0');
        return;
      }
      setCustomDaysError(null);
      onConfirm('CUSTOM', days);
      return;
    }
    onConfirm(selectedRange);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={uploading ? undefined : onClose}>
        {/* Inner Pressable with an empty handler stops taps inside the
            sheet from bubbling up and closing the modal. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>

          {uploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.uploadingText}>
                Uploading {progress.completed} of {progress.total}...
              </Text>
            </View>
          ) : (
            <>
              {RANGE_OPTIONS.map(option => {
                const isActive = selectedRange === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.option, isActive && styles.optionActive]}
                    onPress={() => setSelectedRange(option.value)}
                  >
                    <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                      {isActive && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.optionTextWrap}>
                      <Text style={styles.optionLabel}>{option.label}</Text>
                      <Text style={styles.optionDescription}>{option.description}</Text>
                    </View>
                  </Pressable>
                );
              })}

              {selectedRange === 'CUSTOM' && (
                <View style={styles.customRow}>
                  <Text style={styles.customLabel}>Last</Text>
                  <TextInput
                    style={styles.customInput}
                    value={customDays}
                    onChangeText={text => {
                      setCustomDays(text.replace(/[^0-9]/g, ''));
                      setCustomDaysError(null);
                    }}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                  <Text style={styles.customLabel}>days</Text>
                </View>
              )}
              {customDaysError ? <Text style={styles.errorText}>{customDaysError}</Text> : null}

              <View style={styles.actions}>
                <Pressable style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.uploadButton} onPress={handleConfirm}>
                  <Text style={styles.uploadButtonText}>Upload</Text>
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#EFF6FF',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioOuterActive: {
    borderColor: COLORS.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  optionTextWrap: { flex: 1 },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  optionDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  customLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginHorizontal: 8,
  },
  customInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 15,
    color: COLORS.textPrimary,
    minWidth: 60,
    textAlign: 'center',
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  uploadButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  uploadingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  uploadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});