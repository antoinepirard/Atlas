import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import * as tauri from "../lib/tauri";
import type { VaultStatus, BackupSettings } from "../types";
import { BACKUP_INTERVAL_MINUTES } from "../lib/backup";

interface VaultContextValue {
  status: VaultStatus;
  isLoading: boolean;
  wasManuallyLocked: boolean;
  isCreatingNew: boolean;
  startNewVault: () => void;
  createVault: (password: string, name?: string) => Promise<string[]>;
  unlock: (password: string) => Promise<boolean>;
  unlockWithPhrase: (phrase: string[]) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  enableBiometrics: () => Promise<void>;
  disableBiometrics: () => Promise<void>;
  lock: () => Promise<void>;
  setAutoLockMinutes: (minutes: number) => Promise<void>;
  resetVault: () => Promise<void>;
  switchVault: (
    path: string,
    mode: "move" | "switch" | "create"
  ) => Promise<void>;
  refreshStatus: () => Promise<void>;
  backupSettings: BackupSettings | null;
  refreshBackupSettings: () => Promise<void>;
  setBackupEnabled: (enabled: boolean) => Promise<BackupSettings>;
  setBackupPath: (path: string | null) => Promise<BackupSettings>;
  runBackup: () => Promise<BackupSettings>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function useVault(): VaultContextValue {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error("useVault must be used within a VaultProvider");
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
    name: null,
    auto_lock_minutes: 30,
    biometrics_available: false,
    biometrics_enabled: false,
  });
  const [backupSettings, setBackupSettings] = useState<BackupSettings | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [wasManuallyLocked, setWasManuallyLocked] = useState(false);
  const [isWindowVisible, setIsWindowVisible] = useState(!document.hidden);
  const lastActivityRef = useRef<number>(Date.now());
  const autoLockTimerRef = useRef<number | null>(null);
  const backupTimerRef = useRef<number | null>(null);
  const backupInProgressRef = useRef(false);

  // Track window visibility to disable auto-lock when app is in background
  // This allows background saves to work without the vault auto-locking
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsWindowVisible(visible);
      // Reset activity timer when window becomes visible again
      if (visible) {
        lastActivityRef.current = Date.now();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Fetch vault status
  const refreshStatus = useCallback(async () => {
    try {
      const newStatus = await tauri.getVaultStatus();
      setStatus(newStatus);
    } catch (error) {
      console.error("Failed to get vault status:", error);
    }
  }, []);

  const refreshBackupSettings = useCallback(async () => {
    try {
      const settings = await tauri.getBackupSettings();
      setBackupSettings(settings);
    } catch (error) {
      console.error("Failed to get backup settings:", error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshStatus().finally(() => setIsLoading(false));
  }, [refreshStatus]);

  useEffect(() => {
    refreshBackupSettings();
  }, [refreshBackupSettings]);

  // Track user activity for auto-lock
  useEffect(() => {
    if (!status.unlocked) return;

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = [
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "mousemove",
    ];
    events.forEach((event) =>
      window.addEventListener(event, updateActivity, { passive: true })
    );

    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, updateActivity)
      );
    };
  }, [status.unlocked]);

  // Auto-lock timer - disabled when window is not visible (background mode)
  // This allows the app to save content in background via global shortcut
  // without auto-locking during the save operation
  useEffect(() => {
    if (!status.unlocked) {
      if (autoLockTimerRef.current) {
        clearInterval(autoLockTimerRef.current);
        autoLockTimerRef.current = null;
      }
      return;
    }

    // Don't auto-lock when window is hidden (background mode)
    // This is important for background quick capture to work
    if (!isWindowVisible) {
      if (autoLockTimerRef.current) {
        clearInterval(autoLockTimerRef.current);
        autoLockTimerRef.current = null;
      }
      return;
    }

    autoLockTimerRef.current = window.setInterval(async () => {
      const inactiveMs = Date.now() - lastActivityRef.current;
      const timeoutMs = status.auto_lock_minutes * 60 * 1000;

      if (status.auto_lock_minutes > 0 && inactiveMs >= timeoutMs) {
        await lock();
      }
    }, 10000);

    return () => {
      if (autoLockTimerRef.current) {
        clearInterval(autoLockTimerRef.current);
      }
    };
  }, [status.unlocked, status.auto_lock_minutes, isWindowVisible]);

  const createVault = useCallback(
    async (password: string, name?: string): Promise<string[]> => {
      const recoveryPhrase = await tauri.createVault(password, name);
      await refreshStatus();
      setIsCreatingNew(false);
      lastActivityRef.current = Date.now();
      return recoveryPhrase;
    },
    [refreshStatus]
  );

  const startNewVault = useCallback(() => {
    setIsCreatingNew(true);
  }, []);

  const unlock = useCallback(
    async (password: string): Promise<boolean> => {
      const success = await tauri.unlockVault(password);
      if (success) {
        setWasManuallyLocked(false);
        await refreshStatus();
        lastActivityRef.current = Date.now();
      }
      return success;
    },
    [refreshStatus]
  );

  const unlockWithPhrase = useCallback(
    async (phrase: string[]): Promise<boolean> => {
      const success = await tauri.unlockWithPhrase(phrase);
      if (success) {
        setWasManuallyLocked(false);
        await refreshStatus();
        lastActivityRef.current = Date.now();
      }
      return success;
    },
    [refreshStatus]
  );

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

  const setBackupEnabled = useCallback(async (enabled: boolean) => {
    const updated = await tauri.setBackupEnabled(enabled);
    setBackupSettings(updated);
    return updated;
  }, []);

  const setBackupPath = useCallback(async (path: string | null) => {
    const updated = await tauri.setBackupPath(path);
    setBackupSettings(updated);
    return updated;
  }, []);

  const runBackup = useCallback(async () => {
    if (backupInProgressRef.current) {
      if (backupSettings) return backupSettings;
      const current = await tauri.getBackupSettings();
      setBackupSettings(current);
      return current;
    }

    backupInProgressRef.current = true;
    try {
      const updated = await tauri.runBackup();
      setBackupSettings(updated);
      return updated;
    } finally {
      backupInProgressRef.current = false;
    }
  }, [backupSettings]);

  useEffect(() => {
    if (!backupSettings?.enabled || !backupSettings.path || !status.exists) {
      if (backupTimerRef.current) {
        clearInterval(backupTimerRef.current);
        backupTimerRef.current = null;
      }
      return;
    }

    if (backupTimerRef.current) {
      clearInterval(backupTimerRef.current);
    }

    backupTimerRef.current = window.setInterval(
      async () => {
        try {
          await runBackup();
        } catch (error) {
          console.error("Failed to run scheduled backup:", error);
        }
      },
      BACKUP_INTERVAL_MINUTES * 60 * 1000
    );

    return () => {
      if (backupTimerRef.current) {
        clearInterval(backupTimerRef.current);
      }
    };
  }, [backupSettings?.enabled, backupSettings?.path, status.exists, runBackup]);

  const resetVault = useCallback(async () => {
    await tauri.resetVault();
    await refreshStatus();
  }, [refreshStatus]);

  const switchVault = useCallback(
    async (path: string, mode: "move" | "switch" | "create") => {
      await tauri.setStoragePath(path, mode);
      setWasManuallyLocked(false);
      await refreshStatus();
      setIsCreatingNew(false);
      lastActivityRef.current = Date.now();
    },
    [refreshStatus]
  );

  return (
    <VaultContext.Provider
      value={{
        status,
        isLoading,
        wasManuallyLocked,
        isCreatingNew,
        startNewVault,
        createVault,
        unlock,
        unlockWithPhrase,
        unlockWithBiometrics,
        enableBiometrics,
        disableBiometrics,
        lock,
        setAutoLockMinutes,
        resetVault,
        switchVault,
        refreshStatus,
        backupSettings,
        refreshBackupSettings,
        setBackupEnabled,
        setBackupPath,
        runBackup,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}
