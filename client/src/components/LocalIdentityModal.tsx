import React, {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { LocalIdentity } from '../types/CallLog.types';
import {
  IdentityValidationErrors,
  normalizePhoneNumber,
  validateLocalIdentity,
} from '../utils/localIdentityValidation';
import { COLORS } from '../utils/constants';

interface Props {
  visible: boolean;
  existingIdentity?: LocalIdentity | null;
  onSave: (
    identity: LocalIdentity,
  ) => Promise<void>;
  onClose?: () => void;
}

export default function LocalIdentityModal({
  visible,
  existingIdentity,
  onSave,
  onClose,
}: Props) {
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] =
    useState('');

  const [errors, setErrors] =
    useState<IdentityValidationErrors>({});

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setName(existingIdentity?.name || '');
    setPhoneNumber(
      existingIdentity?.phoneNumber || '',
    );

    setErrors({});
  }, [visible, existingIdentity]);

  const handleSave = async () => {
    const identity: LocalIdentity = {
      name: name.trim(),
      phoneNumber:
        normalizePhoneNumber(phoneNumber),
    };

    const validationErrors =
      validateLocalIdentity(identity);

    if (
      Object.keys(validationErrors).length > 0
    ) {
      setErrors(validationErrors);
      return;
    }

    try {
      setSaving(true);
      setErrors({});

      await onSave(identity);
    } catch (error) {
      console.warn(
        '[LocalIdentityModal] Save failed:',
        error,
      );

      setErrors({
        phoneNumber:
          'Unable to save details. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const isFirstSetup = !existingIdentity;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!isFirstSetup) {
          onClose?.();
        }
      }}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <View style={styles.container}>
          <Text style={styles.title}>
            {isFirstSetup
              ? 'Your Details'
              : 'Edit Your Details'}
          </Text>

          <Text style={styles.description}>
            These details are used to correctly
            identify the caller and receiver in your
            call records.
          </Text>

          <Text style={styles.label}>
            Your Name
          </Text>

          <TextInput
            value={name}
            onChangeText={value => {
              setName(value);

              if (errors.name) {
                setErrors(current => ({
                  ...current,
                  name: undefined,
                }));
              }
            }}
            placeholder="e.g. Suraj Sangle"
            placeholderTextColor="#94A3B8"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={80}
            style={[
              styles.input,
              errors.name && styles.inputError,
            ]}
          />

          {errors.name ? (
            <Text style={styles.errorText}>
              {errors.name}
            </Text>
          ) : null}

          <Text style={styles.label}>
            Phone Number
          </Text>

          <TextInput
            value={phoneNumber}
            onChangeText={value => {
              setPhoneNumber(value);

              if (errors.phoneNumber) {
                setErrors(current => ({
                  ...current,
                  phoneNumber: undefined,
                }));
              }
            }}
            placeholder="+91 98765 43210"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            autoCorrect={false}
            maxLength={20}
            style={[
              styles.input,
              errors.phoneNumber &&
                styles.inputError,
            ]}
          />

          {errors.phoneNumber ? (
            <Text style={styles.errorText}>
              {errors.phoneNumber}
            </Text>
          ) : null}

          <Text style={styles.helper}>
            Prefer entering your number with country
            code, for example +91 98765 43210.
          </Text>

          <View style={styles.actions}>
            {!isFirstSetup && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={saving}
              >
                <Text
                  style={styles.cancelButtonText}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.saveButton,
                saving &&
                  styles.saveButtonDisabled,
              ]}
              disabled={saving}
              onPress={handleSave}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={styles.saveButtonText}
                >
                  Save & Continue
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    padding: 20,
  },

  container: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 22,
  },

  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  description: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
    marginBottom: 22,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 7,
    marginTop: 8,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
    backgroundColor: '#FFFFFF',
  },

  inputError: {
    borderColor: COLORS.danger,
  },

  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 5,
  },

  helper: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textSecondary,
    marginTop: 8,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
    gap: 10,
  },

  cancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
  },

  cancelButtonText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 140,
    alignItems: 'center',
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});