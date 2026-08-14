/**
 * UploadFab.tsx
 *
 * Floating upload button.
 *
 * Uses the device's actual bottom safe-area inset rather than a fixed
 * `bottom: 24`, so it remains above gesture navigation and Android
 * navigation buttons.
 */

import React from 'react';

import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '../utils/constants';

interface Props {
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export default function UploadFab({
  onPress,
  disabled = false,
  accessibilityLabel = 'Upload to CRM',
}: Props) {
  const insets = useSafeAreaInsets();

  /**
   * We keep at least a small visual margin even on phones that report
   * zero bottom inset.
   */
  const safeBottom = Math.max(insets.bottom, 12) + 16;

  return (
    <TouchableOpacity
      style={[
        styles.fab,
        {
          bottom: safeBottom,
        },
        disabled && styles.fabDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.icon}>↥</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',

    right: 20,

    width: 56,
    height: 56,

    borderRadius: 28,

    backgroundColor: COLORS.primary,

    alignItems: 'center',
    justifyContent: 'center',

    elevation: 8,

    shadowColor: '#000000',

    shadowOpacity: 0.25,

    shadowRadius: 6,

    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  fabDisabled: {
    opacity: 0.5,
  },

  icon: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '700',
  },
});
