/**
 * HomeScreen.tsx
 *
 * Responsibilities:
 * - Landing screen
 * - Load locally saved user identity
 * - Ask for identity on first use
 * - Allow identity editing
 * - Navigate to Call Logs / Call Recordings
 *
 * Identity is managed ONLY from this screen.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import type {RootStackParamList} from '../navigation/AppNavigator';

import {COLORS} from '../utils/constants';

import {useLocalIdentity} from '../hooks/useLocalIdentity';

import LocalIdentityModal from '../components/LocalIdentityModal';
import LoadingIndicator from '../components/LoadingIndicator';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'Home'
>;

export default function HomeScreen({
  navigation,
}: Props) {
  const {
    identity,
    loadingIdentity,
    identityModalVisible,
    saveIdentity,
    openIdentityModal,
    closeIdentityModal,
  } = useLocalIdentity({
    promptIfMissing: true,
  });

  /**
   * Wait until AsyncStorage identity has been checked.
   */
  if (loadingIdentity) {
    return (
      <LoadingIndicator message="Loading user details..." />
    );
  }

  /**
   * Prevent users from opening feature screens
   * before completing their identity.
   */
  const canContinue = Boolean(identity);

  const openCallLogs = () => {
    if (!canContinue) {
      openIdentityModal();
      return;
    }

    navigation.navigate('CallLogs');
  };

  const openCallRecordings = () => {
    if (!canContinue) {
      openIdentityModal();
      return;
    }

    navigation.navigate('CallRecordings');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.heading}>
          Call Manager
        </Text>

        <Text style={styles.subheading}>
          View your call history and manage call
          recordings stored on this device.
        </Text>

        {/* USER IDENTITY */}
        {identity ? (
          <TouchableOpacity
            style={styles.identityCard}
            onPress={openIdentityModal}
            activeOpacity={0.8}
          >
            <View style={styles.identityContent}>
              <Text style={styles.identityLabel}>
                Current User
              </Text>

              <Text style={styles.identityName}>
                {identity.name}
              </Text>

              <Text style={styles.identityPhone}>
                {identity.phoneNumber}
              </Text>
            </View>

            <View style={styles.editContainer}>
              <Text style={styles.editText}>
                Edit
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.setupIdentityCard}
            onPress={openIdentityModal}
            activeOpacity={0.8}
          >
            <Text style={styles.setupIdentityTitle}>
              Complete your profile
            </Text>

            <Text
              style={styles.setupIdentityDescription}
            >
              Enter your name and phone number before
              accessing call logs or recordings.
            </Text>

            <Text style={styles.setupIdentityAction}>
              Add Details
            </Text>
          </TouchableOpacity>
        )}

        {/* CALL LOGS */}
        <TouchableOpacity
          style={[
            styles.card,
            !canContinue && styles.cardDisabled,
          ]}
          onPress={openCallLogs}
          activeOpacity={0.8}
        >
          <Text style={styles.cardTitle}>
            📞 Call Logs
          </Text>

          <Text style={styles.cardDescription}>
            Browse incoming, outgoing, and missed
            calls with caller, receiver, duration,
            and time.
          </Text>
        </TouchableOpacity>

        {/* CALL RECORDINGS */}
        <TouchableOpacity
          style={[
            styles.card,
            !canContinue && styles.cardDisabled,
          ]}
          onPress={openCallRecordings}
          activeOpacity={0.8}
        >
          <Text style={styles.cardTitle}>
            🎙️ Call Recordings
          </Text>

          <Text style={styles.cardDescription}>
            Find recorded call audio files saved on
            your device.
          </Text>
        </TouchableOpacity>
      </View>

      {/* Identity setup/edit modal */}
      <LocalIdentityModal
        visible={identityModalVisible}
        existingIdentity={identity}
        onSave={saveIdentity}
        onClose={closeIdentityModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },

  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },

  subheading: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },

  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    backgroundColor: COLORS.card,

    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,

    paddingHorizontal: 18,
    paddingVertical: 15,

    marginBottom: 22,
  },

  identityContent: {
    flex: 1,
  },

  identityLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  identityName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  identityPhone: {
    marginTop: 3,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  editContainer: {
    paddingLeft: 15,
    paddingVertical: 10,
  },

  editText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },

  setupIdentityCard: {
    backgroundColor: COLORS.card,

    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,

    padding: 18,
    marginBottom: 22,
  },

  setupIdentityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },

  setupIdentityDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },

  setupIdentityAction: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },

  card: {
    backgroundColor: COLORS.card,

    borderRadius: 14,

    padding: 20,

    marginBottom: 16,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  cardDisabled: {
    opacity: 0.55,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },

  cardDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },
});