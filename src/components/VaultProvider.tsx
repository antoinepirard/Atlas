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
  createVault: (password: string) => Promise<string[]>;
  unlock: (password: string) => Promise<boolean>;
  unlockWithPhrase: (phrase: string[]) => Promise<boolean>;
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
  });
  const [isLoading, setIsLoading] = useState(true);
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
      await refreshStatus();
      lastActivityRef.current = Date.now();
    }
    return success;
  }, [refreshStatus]);

  const unlockWithPhrase = useCallback(async (phrase: string[]): Promise<boolean> => {
    const success = await tauri.unlockWithPhrase(phrase);
    if (success) {
      await refreshStatus();
      lastActivityRef.current = Date.now();
    }
    return success;
  }, [refreshStatus]);

  const lock = useCallback(async () => {
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
        createVault,
        unlock,
        unlockWithPhrase,
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

