/**
 * SafeModalContainer.tsx
 *
 * Every React Native <Modal> should render its contents inside this
 * component.
 *
 * A Modal is rendered in a separate native window on Android, so we
 * create another SafeAreaProvider inside that native modal window.
 */

import React, { ReactNode } from 'react';

import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  children: ReactNode;

  /**
   * Set true for forms containing TextInput.
   */
  keyboardAware?: boolean;
}

export default function SafeModalContainer({
  children,
  keyboardAware = false,
}: Props) {
  if (keyboardAware) {
    return (
      <SafeAreaProvider style={styles.provider}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView
            style={styles.flex}
            edges={['top', 'bottom', 'left', 'right']}
          >
            {children}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider style={styles.provider}>
      <SafeAreaView
        style={styles.flex}
        edges={['top', 'bottom', 'left', 'right']}
      >
        {children}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  provider: {
    flex: 1,
  },

  flex: {
    flex: 1,
  },
});
