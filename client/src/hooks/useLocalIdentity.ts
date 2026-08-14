import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {LocalIdentity} from '../types/CallLog.types';
import {LocalIdentityService} from '../services/LocalIdentityService';

interface UseLocalIdentityOptions {
  /**
   * When true, automatically open the identity
   * modal if no saved identity exists.
   *
   * This should only be true on HomeScreen.
   */
  promptIfMissing?: boolean;
}

interface UseLocalIdentityResult {
  identity: LocalIdentity | null;
  loadingIdentity: boolean;
  identityModalVisible: boolean;

  saveIdentity: (
    identity: LocalIdentity,
  ) => Promise<void>;

  reloadIdentity: () => Promise<void>;

  openIdentityModal: () => void;
  closeIdentityModal: () => void;
}

export function useLocalIdentity(
  options: UseLocalIdentityOptions = {},
): UseLocalIdentityResult {
  const {
    promptIfMissing = false,
  } = options;

  const [identity, setIdentity] =
    useState<LocalIdentity | null>(null);

  const [loadingIdentity, setLoadingIdentity] =
    useState(true);

  const [
    identityModalVisible,
    setIdentityModalVisible,
  ] = useState(false);

  /**
   * Load identity from AsyncStorage.
   */
  const loadIdentity = useCallback(async () => {
    try {
      setLoadingIdentity(true);

      const savedIdentity =
        await LocalIdentityService.getLocalIdentity();

      setIdentity(savedIdentity);

      /**
       * Only HomeScreen should automatically
       * show the setup modal.
       */
      if (!savedIdentity && promptIfMissing) {
        setIdentityModalVisible(true);
      }

      /**
       * If identity exists, make sure an old
       * automatic modal state is cleared.
       */
      if (savedIdentity) {
        setIdentityModalVisible(false);
      }
    } catch (error) {
      console.warn(
        '[useLocalIdentity] Failed to load identity:',
        error,
      );

      setIdentity(null);

      if (promptIfMissing) {
        setIdentityModalVisible(true);
      }
    } finally {
      setLoadingIdentity(false);
    }
  }, [promptIfMissing]);

  /**
   * Initial identity load.
   */
  useEffect(() => {
    loadIdentity();
  }, [loadIdentity]);

  /**
   * Save/update identity.
   */
  const saveIdentity = useCallback(
    async (
      newIdentity: LocalIdentity,
    ): Promise<void> => {
      const saved =
        await LocalIdentityService.setLocalIdentity(
          newIdentity,
        );

      setIdentity(saved);
      setIdentityModalVisible(false);
    },
    [],
  );

  /**
   * Manually open modal.
   *
   * Used by HomeScreen when user presses Edit.
   */
  const openIdentityModal =
    useCallback(() => {
      setIdentityModalVisible(true);
    }, []);

  /**
   * For first-time setup, we don't allow the
   * modal to close until identity exists.
   */
  const closeIdentityModal =
    useCallback(() => {
      if (identity) {
        setIdentityModalVisible(false);
      }
    }, [identity]);

  return {
    identity,
    loadingIdentity,
    identityModalVisible,

    saveIdentity,

    reloadIdentity: loadIdentity,

    openIdentityModal,
    closeIdentityModal,
  };
}