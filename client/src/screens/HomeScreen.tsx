import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/AppNavigator';

import type { LocalIdentity } from '../types/CallLog.types';

import { LocalIdentityService } from '../services/LocalIdentityService';

import { COLORS } from '../utils/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/**
 * Country-code options.
 *
 * Add more countries here later if required.
 * No additional npm package is required.
 */
type CountryCodeOption = {
  country: string;
  flag: string;
  code: string;
};

const COUNTRY_CODES: CountryCodeOption[] = [
  {
    country: 'India',
    flag: '🇮🇳',
    code: '+91',
  },
  {
    country: 'United States / Canada',
    flag: '🇺🇸',
    code: '+1',
  },
  {
    country: 'United Kingdom',
    flag: '🇬🇧',
    code: '+44',
  },
  {
    country: 'United Arab Emirates',
    flag: '🇦🇪',
    code: '+971',
  },
  {
    country: 'Saudi Arabia',
    flag: '🇸🇦',
    code: '+966',
  },
  {
    country: 'Singapore',
    flag: '🇸🇬',
    code: '+65',
  },
  {
    country: 'Australia',
    flag: '🇦🇺',
    code: '+61',
  },
  {
    country: 'New Zealand',
    flag: '🇳🇿',
    code: '+64',
  },
  {
    country: 'Germany',
    flag: '🇩🇪',
    code: '+49',
  },
  {
    country: 'France',
    flag: '🇫🇷',
    code: '+33',
  },
  {
    country: 'Italy',
    flag: '🇮🇹',
    code: '+39',
  },
  {
    country: 'Spain',
    flag: '🇪🇸',
    code: '+34',
  },
  {
    country: 'Netherlands',
    flag: '🇳🇱',
    code: '+31',
  },
  {
    country: 'Switzerland',
    flag: '🇨🇭',
    code: '+41',
  },
  {
    country: 'Ireland',
    flag: '🇮🇪',
    code: '+353',
  },
  {
    country: 'Japan',
    flag: '🇯🇵',
    code: '+81',
  },
  {
    country: 'China',
    flag: '🇨🇳',
    code: '+86',
  },
  {
    country: 'South Korea',
    flag: '🇰🇷',
    code: '+82',
  },
  {
    country: 'Malaysia',
    flag: '🇲🇾',
    code: '+60',
  },
  {
    country: 'Indonesia',
    flag: '🇮🇩',
    code: '+62',
  },
  {
    country: 'Thailand',
    flag: '🇹🇭',
    code: '+66',
  },
  {
    country: 'Philippines',
    flag: '🇵🇭',
    code: '+63',
  },
  {
    country: 'Vietnam',
    flag: '🇻🇳',
    code: '+84',
  },
  {
    country: 'Bangladesh',
    flag: '🇧🇩',
    code: '+880',
  },
  {
    country: 'Sri Lanka',
    flag: '🇱🇰',
    code: '+94',
  },
  {
    country: 'Nepal',
    flag: '🇳🇵',
    code: '+977',
  },
  {
    country: 'Pakistan',
    flag: '🇵🇰',
    code: '+92',
  },
  {
    country: 'Qatar',
    flag: '🇶🇦',
    code: '+974',
  },
  {
    country: 'Kuwait',
    flag: '🇰🇼',
    code: '+965',
  },
  {
    country: 'Oman',
    flag: '🇴🇲',
    code: '+968',
  },
  {
    country: 'Bahrain',
    flag: '🇧🇭',
    code: '+973',
  },
  {
    country: 'South Africa',
    flag: '🇿🇦',
    code: '+27',
  },
  {
    country: 'Brazil',
    flag: '🇧🇷',
    code: '+55',
  },
];

/**
 * Determine whether the user still needs
 * to configure local identity.
 */
function isIdentityMissing(identity: LocalIdentity | null): boolean {
  if (!identity) {
    return true;
  }

  const name = String(identity.name || '').trim();

  const phone = String(identity.phoneNumber || '').trim();

  if (!name || !phone) {
    return true;
  }

  if (name.toLowerCase() === 'local user') {
    return true;
  }

  return false;
}

/**
 * Split an already-saved number:
 *
 * +919876543210
 *
 * into:
 *
 * countryCode = +91
 * mobileNumber = 9876543210
 *
 * Existing storage structure is NOT changed.
 */
function splitSavedPhoneNumber(rawPhoneNumber: string): {
  countryCode: string;
  mobileNumber: string;
} {
  const cleaned = String(rawPhoneNumber || '')
    .trim()
    .replace(/[\s\-()]/g, '');

  if (!cleaned) {
    return {
      countryCode: '+91',
      mobileNumber: '',
    };
  }

  /**
   * Try longest codes first.
   *
   * Important for:
   * +971
   * +966
   * +977
   * etc.
   */
  const sortedCountryCodes = [...COUNTRY_CODES].sort(
    (first, second) => second.code.length - first.code.length,
  );

  const matchedCountry = sortedCountryCodes.find(item =>
    cleaned.startsWith(item.code),
  );

  if (matchedCountry) {
    return {
      countryCode: matchedCountry.code,

      mobileNumber: cleaned
        .substring(matchedCountry.code.length)
        .replace(/\D/g, ''),
    };
  }

  /**
   * Backward compatibility:
   *
   * Older saved numbers may not contain
   * a country code.
   *
   * Default to India and keep the original
   * number as the mobile number.
   */
  return {
    countryCode: '+91',

    mobileNumber: cleaned.replace(/\D/g, ''),
  };
}

export default function HomeScreen({ navigation }: Props) {
  const [identity, setIdentity] = useState<LocalIdentity | null>(null);

  const [identityLoaded, setIdentityLoaded] = useState(false);

  const [identityModalVisible, setIdentityModalVisible] = useState(false);

  const [name, setName] = useState('');

  /**
   * NEW:
   * Country code and mobile number are
   * maintained separately in the UI.
   */
  const [countryCode, setCountryCode] = useState('+91');

  const [mobileNumber, setMobileNumber] = useState('');

  const [countryPickerVisible, setCountryPickerVisible] = useState(false);

  const [savingIdentity, setSavingIdentity] = useState(false);

  /**
   * ============================================================
   * LOAD IDENTITY INTO FORM
   * ============================================================
   */

  const populateIdentityFields = useCallback(
    (currentIdentity: LocalIdentity | null) => {
      setName(
        currentIdentity?.name === 'Local User'
          ? ''
          : currentIdentity?.name || '',
      );

      const phoneParts = splitSavedPhoneNumber(
        currentIdentity?.phoneNumber || '',
      );

      setCountryCode(phoneParts.countryCode);

      setMobileNumber(phoneParts.mobileNumber);
    },
    [],
  );

  /**
   * ============================================================
   * LOAD USER DETAILS
   * ============================================================
   */

  const loadIdentity = useCallback(
    async (showInitialPrompt = false) => {
      try {
        const savedIdentity = await LocalIdentityService.getLocalIdentity();

        const resolvedIdentity = savedIdentity || null;

        setIdentity(resolvedIdentity);

        populateIdentityFields(resolvedIdentity);

        /**
         * First application setup.
         */
        if (showInitialPrompt && isIdentityMissing(resolvedIdentity)) {
          setIdentityModalVisible(true);
        }
      } catch (error) {
        console.warn('[HomeScreen] Could not load local identity:', error);
      } finally {
        setIdentityLoaded(true);
      }
    },
    [populateIdentityFields],
  );

  useEffect(() => {
    void loadIdentity(true);
  }, [loadIdentity]);

  /**
   * Reload the identity whenever Home
   * becomes active again.
   */
  useFocusEffect(
    useCallback(() => {
      if (!identityLoaded) {
        return;
      }

      void loadIdentity(false);
    }, [identityLoaded, loadIdentity]),
  );

  /**
   * ============================================================
   * PROFILE BUTTON
   * ============================================================
   */

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerProfileButton}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Edit user details"
          onPress={() => {
            populateIdentityFields(identity);

            setIdentityModalVisible(true);
          }}
        >
          <Text style={styles.headerProfileIcon}>👤</Text>
        </TouchableOpacity>
      ),
    });
  }, [identity, navigation, populateIdentityFields]);

  /**
   * ============================================================
   * SAVE USER DETAILS
   * ============================================================
   */

  const saveUserDetails = useCallback(async () => {
    const cleanedName = name.trim();

    const cleanedMobileNumber = mobileNumber.replace(/\D/g, '');

    if (!cleanedName) {
      Alert.alert('Name required', 'Please enter your name.');

      return;
    }

    if (!cleanedMobileNumber) {
      Alert.alert('Phone number required', 'Please enter your mobile number.');

      return;
    }

    /**
     * The UI has two values:
     *
     * +91
     * 9876543210
     *
     * But existing application storage
     * continues receiving ONE value:
     *
     * +919876543210
     */
    const fullPhoneNumber = `${countryCode}${cleanedMobileNumber}`;

    const newIdentity: LocalIdentity = {
      name: cleanedName,

      phoneNumber: fullPhoneNumber,
    };

    try {
      setSavingIdentity(true);

      /**
       * Existing service.
       *
       * No storage architecture change.
       */
      await LocalIdentityService.setLocalIdentity(newIdentity);

      setIdentity(newIdentity);

      setIdentityModalVisible(false);
    } catch (error) {
      console.warn('[HomeScreen] Could not save user details:', error);

      Alert.alert(
        'Unable to save',
        'Could not save your user details. Please try again.',
      );
    } finally {
      setSavingIdentity(false);
    }
  }, [name, countryCode, mobileNumber]);

  /**
   * First-time setup cannot be cancelled.
   *
   * Existing users can cancel while editing.
   */
  const userCanCancel = !isIdentityMissing(identity);

  const closeIdentityModal = useCallback(() => {
    if (!userCanCancel) {
      Alert.alert(
        'User details required',
        'Please enter your name and phone number before continuing.',
      );

      return;
    }

    setIdentityModalVisible(false);
  }, [userCanCancel]);

  /**
   * Selected country details used in
   * the small dropdown button.
   */
  const selectedCountry = COUNTRY_CODES.find(item => item.code === countryCode);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ====================================================
            HERO
        ==================================================== */}

        <View style={styles.hero}>
          <View style={[styles.decorativeCircle, styles.circleOne]} />

          <View style={[styles.decorativeCircle, styles.circleTwo]} />

          <View style={styles.heroContent}>
            <View style={styles.badge}>
              <View style={styles.badgeDot} />

              <Text style={styles.badgeText}>ANDROID CALL MANAGER</Text>
            </View>

            {identity && !isIdentityMissing(identity) ? (
              <Text style={styles.welcomeText}>Welcome, {identity.name}</Text>
            ) : null}

            <Text style={styles.heroTitle}>
              Manage your calls
              {'\n'}
              <Text style={styles.heroTitleAccent}>in one place</Text>
            </Text>

            <Text style={styles.heroDescription}>
              Access call history, manage recordings and sync important call
              information to CRM.
            </Text>

            <View style={styles.featureRow}>
              <View style={styles.featureChip}>
                <Text style={styles.featureChipIcon}>✓</Text>

                <Text style={styles.featureChipText}>Call Logs</Text>
              </View>

              <View style={styles.featureChip}>
                <Text style={styles.featureChipIcon}>✓</Text>

                <Text style={styles.featureChipText}>Recordings</Text>
              </View>

              <View style={styles.featureChip}>
                <Text style={styles.featureChipIcon}>✓</Text>

                <Text style={styles.featureChipText}>CRM Sync</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ====================================================
            QUICK ACCESS
        ==================================================== */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Access</Text>

          <Text style={styles.sectionDescription}>
            Choose what you want to manage
          </Text>
        </View>

        {/* ====================================================
            CALL LOGS
        ==================================================== */}

        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.86}
          onPress={() => navigation.navigate('CallLogs')}
        >
          <View style={[styles.iconContainer, styles.callIconContainer]}>
            <Text style={styles.iconText}>☎</Text>
          </View>

          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Call Logs</Text>

              <View style={styles.readyBadge}>
                <View style={styles.readyDot} />

                <Text style={styles.readyText}>Ready</Text>
              </View>
            </View>

            <Text style={styles.cardDescription}>
              View incoming, outgoing and missed calls with phone number,
              duration and call time.
            </Text>

            <View style={styles.cardFooter}>
              <Text style={styles.openText}>View call history</Text>

              <View style={styles.arrowButton}>
                <Text style={styles.arrowText}>›</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* ====================================================
            RECORDINGS
        ==================================================== */}

        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.86}
          onPress={() => navigation.navigate('CallRecordings')}
        >
          <View style={[styles.iconContainer, styles.recordingIconContainer]}>
            <Text style={styles.recordingIcon}>●</Text>
          </View>

          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Call Recordings</Text>

              <View style={styles.readyBadge}>
                <View style={styles.readyDot} />

                <Text style={styles.readyText}>Ready</Text>
              </View>
            </View>

            <Text style={styles.cardDescription}>
              Find, play and sync call recordings available on your Android
              device.
            </Text>

            <View style={styles.cardFooter}>
              <Text style={styles.openText}>View recordings</Text>

              <View style={styles.arrowButton}>
                <Text style={styles.arrowText}>›</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        
      </ScrollView>

      {/* ======================================================
          USER DETAILS MODAL
      ====================================================== */}

      <Modal
        visible={identityModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent={false}
        navigationBarTranslucent={false}
        onRequestClose={closeIdentityModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalProfileIcon}>
              <Text style={styles.modalProfileIconText}>👤</Text>
            </View>

            <Text style={styles.modalTitle}>User Details</Text>

            <Text style={styles.modalDescription}>
              These details are used to identify the local caller or receiver
              when syncing call information.
            </Text>

            {/* NAME */}

            <Text style={styles.inputLabel}>Name</Text>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#94A3B8"
              editable={!savingIdentity}
              style={styles.input}
              returnKeyType="next"
            />

            {/* PHONE NUMBER */}

            <Text style={[styles.inputLabel, styles.phoneLabel]}>
              Phone Number
            </Text>

            {/*
             * NEW:
             *
             * Country code + mobile number
             * are kept in the SAME ROW.
             */}

            <View style={styles.phoneRow}>
              {/* COUNTRY CODE DROPDOWN */}

              <TouchableOpacity
                style={styles.countryCodeButton}
                disabled={savingIdentity}
                activeOpacity={0.75}
                onPress={() => setCountryPickerVisible(true)}
              >
                <Text style={styles.countryFlag}>
                  {selectedCountry?.flag || '🌐'}
                </Text>

                <Text style={styles.countryCodeText}>{countryCode}</Text>

                <Text style={styles.countryArrow}>▼</Text>
              </TouchableOpacity>

              {/* MOBILE NUMBER */}

              <TextInput
                value={mobileNumber}
                onChangeText={value => {
                  const digitsOnly = value.replace(/\D/g, '');

                  setMobileNumber(digitsOnly);
                }}
                placeholder="Mobile number"
                placeholderTextColor="#94A3B8"
                editable={!savingIdentity}
                keyboardType="phone-pad"
                style={styles.mobileNumberInput}
              />
            </View>

            {/* ACTION BUTTONS */}

            <View style={styles.modalActions}>
              {userCanCancel ? (
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  disabled={savingIdentity}
                  activeOpacity={0.8}
                  onPress={closeIdentityModal}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,

                  !userCanCancel && styles.fullSaveButton,

                  savingIdentity && styles.disabledButton,
                ]}
                disabled={savingIdentity}
                activeOpacity={0.8}
                onPress={saveUserDetails}
              >
                <Text style={styles.saveButtonText}>
                  {savingIdentity ? 'Saving...' : 'Save Details'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================
          COUNTRY CODE PICKER
      ====================================================== */}

      <Modal
        visible={countryPickerVisible}
        transparent
        animationType="fade"
        statusBarTranslucent={false}
        navigationBarTranslucent={false}
        onRequestClose={() => setCountryPickerVisible(false)}
      >
        <Pressable
          style={styles.countryPickerOverlay}
          onPress={() => setCountryPickerVisible(false)}
        >
          {/*
           * Prevent touches inside the card
           * from closing the popup.
           */}

          <Pressable style={styles.countryPickerCard} onPress={() => {}}>
            <View style={styles.countryPickerHeader}>
              <Text style={styles.countryPickerTitle}>Select Country Code</Text>

              <TouchableOpacity
                style={styles.countryPickerClose}
                activeOpacity={0.7}
                onPress={() => setCountryPickerVisible(false)}
              >
                <Text style={styles.countryPickerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={(item, index) =>
                `${item.country}-${item.code}-${index}`
              }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.countryListContent}
              renderItem={({ item }) => {
                const selected = item.code === countryCode;

                return (
                  <TouchableOpacity
                    style={[
                      styles.countryOption,

                      selected && styles.countryOptionSelected,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => {
                      setCountryCode(item.code);

                      setCountryPickerVisible(false);
                    }}
                  >
                    <Text style={styles.countryOptionFlag}>{item.flag}</Text>

                    <Text style={styles.countryOptionName}>{item.country}</Text>

                    <Text
                      style={[
                        styles.countryOptionCode,

                        selected && styles.countryOptionCodeSelected,
                      ]}
                    >
                      {item.code}
                    </Text>

                    {selected ? (
                      <Text style={styles.countrySelectedMark}>✓</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,

    backgroundColor: '#F4F7FC',
  },

  scrollContent: {
    paddingHorizontal: 18,

    paddingTop: 18,

    paddingBottom: 34,
  },

  /* ========================================================
       HEADER PROFILE
    ======================================================== */

  headerProfileButton: {
    width: 38,
    height: 38,

    borderRadius: 19,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: COLORS.card,

    borderWidth: 1,

    borderColor: 'rgba(255,255,255,0.28)',
  },

  headerProfileIcon: {
    fontSize: 19,
  },

  /* ========================================================
       HERO
    ======================================================== */

  hero: {
    position: 'relative',

    overflow: 'hidden',

    backgroundColor: COLORS.primary,

    borderRadius: 24,

    minHeight: 270,

    marginBottom: 30,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 8,
    },

    shadowOpacity: 0.16,

    shadowRadius: 14,

    elevation: 7,
  },

  heroContent: {
    position: 'relative',

    zIndex: 2,

    paddingHorizontal: 22,

    paddingVertical: 25,
  },

  decorativeCircle: {
    position: 'absolute',

    borderRadius: 999,

    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  circleOne: {
    width: 190,

    height: 190,

    right: -70,

    top: -60,
  },

  circleTwo: {
    width: 120,

    height: 120,

    right: 25,

    bottom: -65,
  },

  badge: {
    alignSelf: 'flex-start',

    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: 'rgba(255,255,255,0.15)',

    borderRadius: 30,

    paddingHorizontal: 11,

    paddingVertical: 7,

    marginBottom: 15,
  },

  badgeDot: {
    width: 7,

    height: 7,

    borderRadius: 4,

    backgroundColor: '#86EFAC',

    marginRight: 7,
  },

  badgeText: {
    color: '#FFFFFF',

    fontSize: 10,

    fontWeight: '700',

    letterSpacing: 1,
  },

  welcomeText: {
    color: '#BFDBFE',

    fontSize: 13,

    fontWeight: '700',

    marginBottom: 7,
  },

  heroTitle: {
    color: '#FFFFFF',

    fontSize: 30,

    lineHeight: 37,

    fontWeight: '800',

    letterSpacing: -0.5,
  },

  heroTitleAccent: {
    color: '#BFDBFE',
  },

  heroDescription: {
    color: '#DBEAFE',

    fontSize: 13,

    lineHeight: 20,

    marginTop: 12,

    maxWidth: 310,
  },

  featureRow: {
    flexDirection: 'row',

    flexWrap: 'wrap',

    marginTop: 20,

    gap: 8,
  },

  featureChip: {
    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: 'rgba(255,255,255,0.12)',

    borderRadius: 20,

    paddingHorizontal: 10,

    paddingVertical: 6,
  },

  featureChipIcon: {
    color: '#86EFAC',

    fontSize: 11,

    fontWeight: '800',

    marginRight: 5,
  },

  featureChipText: {
    color: '#FFFFFF',

    fontSize: 11,

    fontWeight: '600',
  },

  /* ========================================================
       SECTION
    ======================================================== */

  sectionHeader: {
    marginBottom: 14,

    paddingHorizontal: 2,
  },

  sectionTitle: {
    fontSize: 20,

    fontWeight: '800',

    color: COLORS.textPrimary,
  },

  sectionDescription: {
    marginTop: 4,

    fontSize: 13,

    color: COLORS.textSecondary,
  },

  /* ========================================================
       CARDS
    ======================================================== */

  actionCard: {
    flexDirection: 'row',

    backgroundColor: COLORS.card,

    borderRadius: 20,

    padding: 16,

    marginBottom: 14,

    borderWidth: 1,

    borderColor: '#E7ECF3',

    shadowColor: '#0F172A',

    shadowOffset: {
      width: 0,
      height: 3,
    },

    shadowOpacity: 0.06,

    shadowRadius: 8,

    elevation: 3,
  },

  iconContainer: {
    width: 54,

    height: 54,

    borderRadius: 17,

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 14,
  },

  callIconContainer: {
    backgroundColor: '#DBEAFE',
  },

  recordingIconContainer: {
    backgroundColor: '#FEE2E2',
  },

  iconText: {
    color: COLORS.primary,

    fontSize: 27,

    fontWeight: '700',
  },

  recordingIcon: {
    color: '#EF4444',

    fontSize: 29,

    lineHeight: 32,
  },

  cardContent: {
    flex: 1,
  },

  cardTitleRow: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',
  },

  cardTitle: {
    flexShrink: 1,

    fontSize: 17,

    fontWeight: '800',

    color: COLORS.textPrimary,

    marginRight: 8,
  },

  readyBadge: {
    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: '#F0FDF4',

    borderRadius: 20,

    paddingHorizontal: 8,

    paddingVertical: 4,
  },

  readyDot: {
    width: 6,

    height: 6,

    borderRadius: 3,

    backgroundColor: '#22C55E',

    marginRight: 5,
  },

  readyText: {
    color: '#15803D',

    fontSize: 9,

    fontWeight: '700',
  },

  cardDescription: {
    marginTop: 8,

    color: COLORS.textSecondary,

    fontSize: 12.5,

    lineHeight: 18,
  },

  cardFooter: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    marginTop: 14,
  },

  openText: {
    color: COLORS.primary,

    fontSize: 12,

    fontWeight: '700',
  },

  arrowButton: {
    width: 27,

    height: 27,

    borderRadius: 14,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#EFF6FF',
  },

  arrowText: {
    color: COLORS.primary,

    fontSize: 23,

    lineHeight: 24,

    fontWeight: '500',

    marginTop: -2,
  },

  /* ========================================================
       CRM INFO
    ======================================================== */

  infoCard: {
    flexDirection: 'row',

    alignItems: 'center',

    marginTop: 6,

    padding: 15,

    borderRadius: 17,

    backgroundColor: '#EFF6FF',

    borderWidth: 1,

    borderColor: '#DBEAFE',
  },

  infoIcon: {
    width: 40,

    height: 40,

    borderRadius: 13,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFFFFF',

    marginRight: 12,
  },

  infoIconText: {
    color: COLORS.primary,

    fontSize: 22,

    fontWeight: '700',
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    color: COLORS.textPrimary,

    fontSize: 13,

    fontWeight: '800',
  },

  infoDescription: {
    color: COLORS.textSecondary,

    fontSize: 11.5,

    lineHeight: 17,

    marginTop: 3,
  },

  /* ========================================================
       FOOTER
    ======================================================== */

  footer: {
    alignItems: 'center',

    marginTop: 30,
  },

  footerLine: {
    width: 34,

    height: 3,

    borderRadius: 2,

    backgroundColor: '#CBD5E1',

    marginBottom: 12,
  },

  footerText: {
    color: '#475569',

    fontSize: 12,

    fontWeight: '700',
  },

  footerSubText: {
    color: '#94A3B8',

    fontSize: 10,

    marginTop: 4,
  },

  /* ========================================================
       USER DETAILS MODAL
    ======================================================== */

  modalOverlay: {
    flex: 1,

    backgroundColor: 'rgba(15,23,42,0.55)',

    justifyContent: 'center',

    paddingHorizontal: 22,
  },

  modalCard: {
    backgroundColor: '#FFFFFF',

    borderRadius: 22,

    paddingHorizontal: 20,

    paddingVertical: 24,

    elevation: 10,

    shadowColor: '#000000',

    shadowOffset: {
      width: 0,
      height: 8,
    },

    shadowOpacity: 0.2,

    shadowRadius: 18,
  },

  modalProfileIcon: {
    alignSelf: 'center',

    width: 62,

    height: 62,

    borderRadius: 31,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#EFF6FF',

    marginBottom: 14,
  },

  modalProfileIconText: {
    fontSize: 31,
  },

  modalTitle: {
    textAlign: 'center',

    color: COLORS.textPrimary,

    fontSize: 21,

    fontWeight: '800',
  },

  modalDescription: {
    textAlign: 'center',

    color: COLORS.textSecondary,

    fontSize: 12.5,

    lineHeight: 18,

    marginTop: 7,

    marginBottom: 22,
  },

  inputLabel: {
    color: COLORS.textPrimary,

    fontSize: 12,

    fontWeight: '700',

    marginBottom: 7,
  },

  phoneLabel: {
    marginTop: 15,
  },

  input: {
    minHeight: 50,

    borderWidth: 1,

    borderColor: '#D8E0EA',

    borderRadius: 12,

    paddingHorizontal: 14,

    fontSize: 15,

    color: COLORS.textPrimary,

    backgroundColor: '#F8FAFC',
  },

  /* ========================================================
       PHONE NUMBER ROW
    ======================================================== */

  phoneRow: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 9,
  },

  countryCodeButton: {
    height: 50,

    width: 112,

    borderWidth: 1,

    borderColor: '#D8E0EA',

    borderRadius: 12,

    paddingHorizontal: 10,

    backgroundColor: '#F8FAFC',

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',
  },

  countryFlag: {
    fontSize: 18,

    marginRight: 5,
  },

  countryCodeText: {
    color: COLORS.textPrimary,

    fontSize: 14,

    fontWeight: '700',
  },

  countryArrow: {
    color: COLORS.textSecondary,

    fontSize: 8,

    marginLeft: 6,
  },

  mobileNumberInput: {
    flex: 1,

    height: 50,

    borderWidth: 1,

    borderColor: '#D8E0EA',

    borderRadius: 12,

    paddingHorizontal: 13,

    backgroundColor: '#F8FAFC',

    color: COLORS.textPrimary,

    fontSize: 15,
  },

  /* ========================================================
       MODAL ACTIONS
    ======================================================== */

  modalActions: {
    flexDirection: 'row',

    marginTop: 24,

    gap: 10,
  },

  modalButton: {
    flex: 1,

    minHeight: 48,

    borderRadius: 12,

    alignItems: 'center',

    justifyContent: 'center',
  },

  cancelButton: {
    backgroundColor: '#F8FAFC',

    borderWidth: 1,

    borderColor: '#D8E0EA',
  },

  cancelButtonText: {
    color: COLORS.textPrimary,

    fontSize: 14,

    fontWeight: '700',
  },

  saveButton: {
    backgroundColor: COLORS.primary,
  },

  fullSaveButton: {
    flex: 1,
  },

  saveButtonText: {
    color: '#FFFFFF',

    fontSize: 14,

    fontWeight: '700',
  },

  disabledButton: {
    opacity: 0.65,
  },

  /* ========================================================
       COUNTRY CODE PICKER
    ======================================================== */

  countryPickerOverlay: {
    flex: 1,

    justifyContent: 'center',

    paddingHorizontal: 22,

    backgroundColor: 'rgba(15,23,42,0.60)',
  },

  countryPickerCard: {
    maxHeight: '70%',

    backgroundColor: '#FFFFFF',

    borderRadius: 20,

    overflow: 'hidden',

    elevation: 15,

    shadowColor: '#000000',

    shadowOffset: {
      width: 0,
      height: 8,
    },

    shadowOpacity: 0.22,

    shadowRadius: 18,
  },

  countryPickerHeader: {
    minHeight: 58,

    paddingHorizontal: 18,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    borderBottomWidth: 1,

    borderBottomColor: '#E2E8F0',
  },

  countryPickerTitle: {
    color: COLORS.textPrimary,

    fontSize: 18,

    fontWeight: '800',
  },

  countryPickerClose: {
    width: 34,

    height: 34,

    borderRadius: 17,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#F1F5F9',
  },

  countryPickerCloseText: {
    color: COLORS.textSecondary,

    fontSize: 16,

    fontWeight: '700',
  },

  countryListContent: {
    paddingVertical: 6,
  },

  countryOption: {
    minHeight: 54,

    paddingHorizontal: 18,

    flexDirection: 'row',

    alignItems: 'center',

    borderBottomWidth: 1,

    borderBottomColor: '#F1F5F9',
  },

  countryOptionSelected: {
    backgroundColor: '#EFF6FF',
  },

  countryOptionFlag: {
    width: 38,

    fontSize: 21,
  },

  countryOptionName: {
    flex: 1,

    color: COLORS.textPrimary,

    fontSize: 14,
  },

  countryOptionCode: {
    color: COLORS.textSecondary,

    fontSize: 14,

    fontWeight: '700',

    marginLeft: 10,
  },

  countryOptionCodeSelected: {
    color: COLORS.primary,
  },

  countrySelectedMark: {
    color: COLORS.primary,

    fontSize: 15,

    fontWeight: '800',

    marginLeft: 10,
  },
});
