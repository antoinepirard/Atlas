import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import * as tauri from '../lib/tauri';
import type { VaultStatus } from '../types';

interface VaultContextValue {
  status: VaultStatus;
  isLoading: boolean;
  wasManuallyLocked: boolean;
  createVault: (password: string) => Promise<string[]>;
  unlock: (password: string) => Promise<boolean>;
  unlockWithPhrase: (phrase: string[]) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  enableBiometrics: () => Promise<void>;
  disableBiometrics: () => Promise<void>;
  lock: () => Promise<void>;
  setAutoLockMinutes: (minutes: number) => Promise<void>;
  resetVault: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function useVault(): VaultContextValue {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}

interface VaultProviderProps {
  children: ReactNode;
}

export function VaultProvider({ children }: VaultProviderProps) {
  const [status, setStatus] = useState<VaultStatus>({
    exists: false,
    unlocked: false,
    auto_lock_minutes: 15,
    biometrics_available: false,
    biometrics_enabled: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [wasManuallyLocked, setWasManuallyLocked] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const autoLockTimerRef = useRef<number | null>(null);

  // Fetch vault status
  const refreshStatus = useCallback(async () => {
    try {
      const newStatus = await tauri.getVaultStatus();
      setStatus(newStatus);
    } catch (error) {
      console.error('Failed to get vault status:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshStatus().finally(() => setIsLoading(false));
  }, [refreshStatus]);

  // Track user activity for auto-lock
  useEffect(() => {
    if (!status.unlocked) return;

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    events.forEach((event) => window.addEventListener(event, updateActivity, { passive: true }));

    return () => {
      events.forEach((event) => window.removeEventListener(event, updateActivity));
    };
  }, [status.unlocked]);

  // Auto-lock timer
  useEffect(() => {
    if (!status.unlocked) {
      if (autoLockTimerRef.current) {
        clearInterval(autoLockTimerRef.current);
        autoLockTimerRef.current = null;
      }
      return;
    }

    autoLockTimerRef.current = window.setInterval(async () => {
      const inactiveMs = Date.now() - lastActivityRef.current;
      const timeoutMs = status.auto_lock_minutes * 60 * 1000;

      if (inactiveMs >= timeoutMs) {
        await lock();
      }
    }, 10000);

    return () => {
      if (autoLockTimerRef.current) {
        clearInterval(autoLockTimerRef.current);
      }
    };
  }, [status.unlocked, status.auto_lock_minutes]);

  const createVault = useCallback(async (password: string): Promise<string[]> => {
    const recoveryPhrase = await tauri.createVault(password);
    await refreshStatus();
    lastActivityRef.current = Date.now();
    return recoveryPhrase;
  }, [refreshStatus]);

  const unlock = useCallback(async (password: string): Promise<boolean> => {
    const success = await tauri.unlockVault(password);
    if (success) {
      setWasManuallyLocked(false);
      await refreshStatus();
      lastActivityRef.current = Date.now();
    }
    return success;
  }, [refreshStatus]);

  const unlockWithPhrase = useCallback(async (phrase: string[]): Promise<boolean> => {
    const success = await tauri.unlockWithPhrase(phrase);
    if (success) {
      setWasManuallyLocked(false);
      await refreshStatus();
      lastActivityRef.current = Date.now();
    }
    return success;
  }, [refreshStatus]);

  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    const success = await tauri.unlockWithBiometrics();
    if (success) {
      setWasManuallyLocked(false);
      await refreshStatus();
      lastActivityRef.current = Date.now();
    }
    return success;
  }, [refreshStatus]);

  const enableBiometrics = useCallback(async (): Promise<void> => {
    await tauri.enableBiometrics();
    await refreshStatus();
  }, [refreshStatus]);

  const disableBiometrics = useCallback(async (): Promise<void> => {
    await tauri.disableBiometrics();
    await refreshStatus();
  }, [refreshStatus]);

  const lock = useCallback(async () => {
    setWasManuallyLocked(true);
    await tauri.lockVault();
    await refreshStatus();
  }, [refreshStatus]);

  const setAutoLockMinutes = useCallback(async (minutes: number) => {
    await tauri.setAutoLockMinutes(minutes);
    setStatus((prev) => ({ ...prev, auto_lock_minutes: minutes }));
  }, []);

  const resetVault = useCallback(async () => {
    await tauri.resetVault();
    await refreshStatus();
  }, [refreshStatus]);

  return (
    <VaultContext.Provider
      value={{
        status,
        isLoading,
        wasManuallyLocked,
        createVault,
        unlock,
        unlockWithPhrase,
        unlockWithBiometrics,
        enableBiometrics,
        disableBiometrics,
        lock,
        setAutoLockMinutes,
        resetVault,
        refreshStatus,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

