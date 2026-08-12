// /**
//  * UploadFab.tsx
//  * Floating action button (bottom-right) that opens the upload options
//  * popup. Kept as its own component so it can be dropped onto any screen.
//  */
// import React from 'react';
// import { StyleSheet, Text, TouchableOpacity } from 'react-native';
// import { COLORS } from '../utils/constants';

// interface Props {
//   onPress: () => void;
//   disabled?: boolean;
// }

// export default function UploadFab({ onPress, disabled }: Props) {
//   return (
//     <TouchableOpacity
//       style={[styles.fab, disabled && styles.fabDisabled]}
//       onPress={onPress}
//       disabled={disabled}
//       activeOpacity={0.85}
//       accessibilityLabel="Upload to CRM"
//     >
//       <Text style={styles.icon}>⬆</Text>
//     </TouchableOpacity>
//   );
// }

// const styles = StyleSheet.create({
//   fab: {
//     position: 'absolute',
//     right: 20,
//     bottom: 24,
//     width: 56,
//     height: 56,
//     borderRadius: 28,
//     backgroundColor: COLORS.primary,
//     alignItems: 'center',
//     justifyContent: 'center',
//     elevation: 5,
//     shadowColor: '#000',
//     shadowOpacity: 0.25,
//     shadowRadius: 6,
//     shadowOffset: { width: 0, height: 3 },
//   },
//   fabDisabled: {
//     opacity: 0.5,
//   },
//   icon: {
//     color: '#fff',
//     fontSize: 24,
//     fontWeight: '700',
//   },
// });

/**
 * UploadFab.tsx
 * Floating action button (bottom-right) that opens the upload options
 * popup. Kept as its own component so it can be dropped onto any screen.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { COLORS } from '../utils/constants';

interface Props {
  onPress: () => void;
  disabled?: boolean;
}

export default function UploadFab({ onPress, disabled }: Props) {
  return (
    <TouchableOpacity
      style={[styles.fab, disabled && styles.fabDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityLabel="Upload to CRM"
    >
      <Text style={styles.icon}>⬆</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabDisabled: {
    opacity: 0.5,
  },
  icon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
});