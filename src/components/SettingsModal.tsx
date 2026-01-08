import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  XMarkIcon,
  EyeIcon,
  EyeSlashIcon,
  FolderIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  FingerPrintIcon,
  Cog6ToothIcon,
  CloudIcon,
  ShieldCheckIcon,
  KeyIcon,
  ArrowTopRightOnSquareIcon,
  CommandLineIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PhotoIcon,
  MagnifyingGlassIcon,
  LockClosedIcon,
  PlusIcon,
  ChartBarIcon,
  TrashIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import * as tauri from "../lib/tauri";
import { BACKUP_INTERVAL_MINUTES, formatBackupInterval } from "../lib/backup";
import { useVault } from "./VaultProvider";
import type { AiSettings, AiUsageDay } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = "general" | "ai" | "security" | "cloud" | "access";

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    status,
    enableBiometrics,
    disableBiometrics,
    setAutoLockMinutes,
    switchVault,
    startNewVault,
    refreshStatus,
    backupSettings,
    refreshBackupSettings,
    setBackupEnabled,
    setBackupPath,
    runBackup,
  } = useVault();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [apiKey, setApiKey] = useState("");
  const [maskedApiKey, setMaskedApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [storagePath, setStoragePath] = useState("");
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [vaultNameDraft, setVaultNameDraft] = useState("");
  const [isEditingVaultName, setIsEditingVaultName] = useState(false);
  const [isSavingVaultName, setIsSavingVaultName] = useState(false);
  const vaultNameInputRef = useRef<HTMLInputElement | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isSwitchingVault, setIsSwitchingVault] = useState(false);
  const [isMigratingImages, setIsMigratingImages] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    migrated: number;
    failed: number;
    skipped: number;
  } | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<{
    indexed: number;
    skipped: number;
    failed: number;
  } | null>(null);
  const [isTogglingBiometrics, setIsTogglingBiometrics] = useState(false);
  const [isTogglingBackup, setIsTogglingBackup] = useState(false);
  const [isSelectingBackupPath, setIsSelectingBackupPath] = useState(false);
  const [isRunningBackup, setIsRunningBackup] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [apiKeyRemoved, setApiKeyRemoved] = useState(false);
  const [isRemovingApiKey, setIsRemovingApiKey] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [aiSettingsDraft, setAiSettingsDraft] = useState<AiSettings | null>(
    null
  );
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false);
  const [aiSettingsSaved, setAiSettingsSaved] = useState(false);
  const [aiUsageHistory, setAiUsageHistory] = useState<AiUsageDay[]>([]);
  const [isLoadingAiUsage, setIsLoadingAiUsage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessibilityGranted, setAccessibilityGranted] = useState<
    boolean | null
  >(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);

  // Load current settings when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSettings();
      checkAccessibility();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setVaultNameDraft(status.name?.trim() ?? "");
      setIsEditingVaultName(false);
    }
  }, [isOpen, status.name]);

  useEffect(() => {
    if (!isEditingVaultName) return;
    vaultNameInputRef.current?.focus();
    vaultNameInputRef.current?.select();
  }, [isEditingVaultName]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoadingAiUsage(true);
    try {
      const [masked, path, settings, usage] = await Promise.all([
        tauri.getApiKeyMasked(),
        tauri.getStoragePath(),
        tauri.getAiSettings(),
        tauri.getAiUsageHistory(30),
      ]);
      setMaskedApiKey(masked);
      setStoragePath(path);
      setAiSettings(settings);
      setAiSettingsDraft(settings);
      setAiUsageHistory(usage);
      setApiKey("");
      setApiKeySaved(false);
      setApiKeyRemoved(false);
      setShowApiKey(false);
      setAiSettingsSaved(false);
      setError(null);
      await refreshBackupSettings();
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setIsLoadingAiUsage(false);
    }
  };

  const checkAccessibility = async () => {
    setIsCheckingAccess(true);
    try {
      const granted = await tauri.checkAccessibilityPermission();
      setAccessibilityGranted(granted);
    } catch (err) {
      console.error("Failed to check accessibility:", err);
      setAccessibilityGranted(false);
    } finally {
      setIsCheckingAccess(false);
    }
  };

  const handleRequestAccessibility = async () => {
    try {
      // This will show the system prompt to grant accessibility
      await tauri.requestAccessibilityPermission();
      // Check again after a short delay
      setTimeout(checkAccessibility, 500);
    } catch (err) {
      console.error("Failed to request accessibility:", err);
    }
  };

  const handleOpenAccessibilitySettings = async () => {
    try {
      await tauri.openAccessibilitySettings();
    } catch (err) {
      console.error("Failed to open accessibility settings:", err);
    }
  };

  const handleSaveApiKey = useCallback(async () => {
    if (!apiKey.trim()) return;

    setIsSavingApiKey(true);
    setError(null);
    setApiKeyRemoved(false);
    try {
      await tauri.saveApiKey(apiKey.trim());
      const masked = await tauri.getApiKeyMasked();
      setMaskedApiKey(masked);
      setApiKey("");
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save API key");
    } finally {
      setIsSavingApiKey(false);
    }
  }, [apiKey]);

  const handleRemoveApiKey = useCallback(async () => {
    if (!maskedApiKey || isRemovingApiKey) return;
    const confirmed = window.confirm(
      "Remove the saved API key from this device?"
    );
    if (!confirmed) return;

    setIsRemovingApiKey(true);
    setError(null);
    try {
      await tauri.removeApiKey();
      setMaskedApiKey(null);
      setApiKey("");
      setShowApiKey(false);
      setApiKeySaved(false);
      setApiKeyRemoved(true);
      setTimeout(() => setApiKeyRemoved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove API key");
    } finally {
      setIsRemovingApiKey(false);
    }
  }, [maskedApiKey, isRemovingApiKey]);

  const handleSaveAiSettings = useCallback(async () => {
    if (!aiSettingsDraft || isSavingAiSettings) return;
    setIsSavingAiSettings(true);
    setError(null);
    try {
      const saved = await tauri.setAiSettings(aiSettingsDraft);
      setAiSettings(saved);
      setAiSettingsDraft(saved);
      setAiSettingsSaved(true);
      setTimeout(() => setAiSettingsSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save AI limits");
    } finally {
      setIsSavingAiSettings(false);
    }
  }, [aiSettingsDraft, isSavingAiSettings]);

  const updateMonthlyBudget = useCallback((value: number | null) => {
    setAiSettingsDraft((prev) => ({
      ...(prev ?? { monthly_budget_usd: null, warning_threshold_percent: 0.8 }),
      monthly_budget_usd: value,
    }));
  }, []);

  const updateWarningThreshold = useCallback((value: number) => {
    const clamped = Math.min(Math.max(value, 0), 1);
    setAiSettingsDraft((prev) => ({
      ...(prev ?? { monthly_budget_usd: null, warning_threshold_percent: 0.8 }),
      warning_threshold_percent: clamped,
    }));
  }, []);

  const refreshAiUsage = useCallback(async () => {
    setIsLoadingAiUsage(true);
    try {
      const usage = await tauri.getAiUsageHistory(30);
      setAiUsageHistory(usage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh usage");
    } finally {
      setIsLoadingAiUsage(false);
    }
  }, []);

  const handleBrowseFolder = useCallback(async () => {
    try {
      const selectedPath = await tauri.pickStorageFolder(
        "Choose new storage location"
      );
      if (selectedPath) {
        setIsMigrating(true);
        setError(null);
        await switchVault(selectedPath, "move");
        const updatedPath = await tauri.getStoragePath();
        setStoragePath(updatedPath);
        setIsMigrating(false);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to change storage location"
      );
      setIsMigrating(false);
    }
  }, [switchVault]);

  const handleOpenExistingVault = useCallback(async () => {
    try {
      const selectedPath = await tauri.pickStorageFolder(
        "Choose existing vault folder"
      );
      if (!selectedPath) return;
      setIsSwitchingVault(true);
      setError(null);
      await switchVault(selectedPath, "switch");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch vault");
    } finally {
      setIsSwitchingVault(false);
    }
  }, [switchVault]);

  const handleStartNewVault = useCallback(() => {
    startNewVault();
    onClose();
  }, [startNewVault, onClose]);

  const handleMigrateImages = useCallback(async () => {
    setIsMigratingImages(true);
    setError(null);
    setMigrationResult(null);
    try {
      const result = await tauri.migrateAllImages();
      setMigrationResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to migrate images");
    } finally {
      setIsMigratingImages(false);
    }
  }, []);

  const handleReindexEmbeddings = useCallback(async () => {
    setIsReindexing(true);
    setError(null);
    setReindexResult(null);
    try {
      const result = await tauri.reindexAllEmbeddings();
      setReindexResult(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reindex embeddings"
      );
    } finally {
      setIsReindexing(false);
    }
  }, []);

  const handleSaveVaultName = useCallback(async () => {
    if (isSavingVaultName) return;
    const trimmed = vaultNameDraft.trim();
    const current = status.name?.trim() ?? "";
    if (trimmed === current) {
      setIsEditingVaultName(false);
      return;
    }

    setIsSavingVaultName(true);
    setError(null);
    try {
      await tauri.setVaultName(trimmed ? trimmed : null);
      await refreshStatus();
      setIsEditingVaultName(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update vault name"
      );
    } finally {
      setIsSavingVaultName(false);
    }
  }, [vaultNameDraft, status.name, refreshStatus, isSavingVaultName]);

  const handleVaultNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.stopPropagation();
        e.preventDefault();
        handleSaveVaultName();
      }
    },
    [handleSaveVaultName]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  const handleToggleBiometrics = useCallback(async () => {
    setIsTogglingBiometrics(true);
    setError(null);
    try {
      if (status.biometrics_enabled) {
        await disableBiometrics();
      } else {
        await enableBiometrics();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update Touch ID setting"
      );
    } finally {
      setIsTogglingBiometrics(false);
    }
  }, [status.biometrics_enabled, enableBiometrics, disableBiometrics]);

  const handleToggleBackup = useCallback(async () => {
    if (isTogglingBackup) return;
    setIsTogglingBackup(true);
    setError(null);
    try {
      await setBackupEnabled(!(backupSettings?.enabled ?? false));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update backup setting"
      );
    } finally {
      setIsTogglingBackup(false);
    }
  }, [isTogglingBackup, setBackupEnabled, backupSettings?.enabled]);

  const handleChooseBackupFolder = useCallback(async () => {
    if (isSelectingBackupPath) return;
    setIsSelectingBackupPath(true);
    setError(null);
    try {
      const selectedPath = await tauri.pickStorageFolder(
        "Choose backup folder"
      );
      if (selectedPath) {
        await setBackupPath(selectedPath);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to set backup folder"
      );
    } finally {
      setIsSelectingBackupPath(false);
    }
  }, [isSelectingBackupPath, setBackupPath]);

  const handleRunBackup = useCallback(async () => {
    if (isRunningBackup) return;
    setIsRunningBackup(true);
    setError(null);
    try {
      await runBackup();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run backup");
    } finally {
      setIsRunningBackup(false);
    }
  }, [isRunningBackup, runBackup]);

  const formatBackupTimestamp = (value?: string | null) => {
    if (!value) return "Never";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  const tabs: { id: SettingsTab; label: string; icon: typeof Cog6ToothIcon }[] =
    [
      { id: "general", label: "General", icon: Cog6ToothIcon },
      { id: "ai", label: "AI & Usage", icon: ChartBarIcon },
      { id: "security", label: "Security", icon: ShieldCheckIcon },
      { id: "cloud", label: "Cloud", icon: CloudIcon },
      { id: "access", label: "Access", icon: KeyIcon },
    ];
  const backupEnabled = backupSettings?.enabled ?? false;
  const backupPath = backupSettings?.path ?? "";
  const backupIntervalLabel = formatBackupInterval(BACKUP_INTERVAL_MINUTES);
  const lastBackupLabel = formatBackupTimestamp(backupSettings?.last_backup_at);
  const vaultLabel = status.name?.trim();
  const displayVaultLabel = vaultLabel || "Untitled Vault";
  const aiUsageTotalTokens = aiUsageHistory.reduce(
    (sum, day) => sum + day.total_tokens,
    0
  );
  const aiUsageTotalRequests = aiUsageHistory.reduce(
    (sum, day) => sum + day.request_count,
    0
  );
  const aiUsageTotalCost = aiUsageHistory.reduce(
    (sum, day) => sum + (day.total_cost_usd ?? 0),
    0
  );
  const aiUsageMaxTokens = aiUsageHistory.reduce(
    (max, day) => (day.total_tokens > max ? day.total_tokens : max),
    0
  );
  const aiUsageHasData = aiUsageTotalTokens > 0;

  // Budget settings
  const monthlyBudget = aiSettingsDraft?.monthly_budget_usd ?? null;
  const warningThreshold = aiSettingsDraft?.warning_threshold_percent ?? 0.8;
  const aiSettingsChanged =
    aiSettings && aiSettingsDraft
      ? aiSettingsDraft.monthly_budget_usd !== aiSettings.monthly_budget_usd ||
        aiSettingsDraft.warning_threshold_percent !==
          aiSettings.warning_threshold_percent
      : false;

  // Calculate current month's spending (filter to current month)
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthSpent = aiUsageHistory
    .filter((day) => new Date(day.date) >= currentMonthStart)
    .reduce((sum, day) => sum + (day.total_cost_usd ?? 0), 0);

  const budgetPercentUsed = monthlyBudget
    ? (currentMonthSpent / monthlyBudget) * 100
    : 0;
  const isNearBudget =
    monthlyBudget && budgetPercentUsed >= warningThreshold * 100;
  const isOverBudget = monthlyBudget && currentMonthSpent >= monthlyBudget;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            onKeyDown={handleKeyDown}
          >
            <div className="bg-white rounded-2xl shadow-2xl shadow-stone-900/10 overflow-hidden w-full max-w-2xl h-[600px] max-h-[calc(100vh-2rem)] pointer-events-auto flex">
              {/* Sidebar */}
              <div className="w-44 flex-shrink-0 bg-stone-50 border-r border-stone-200 flex flex-col">
                <nav className="pt-4 px-2 pb-2 flex-1">
                  <div className="px-3 pb-3">
                    {isEditingVaultName ? (
                      <input
                        ref={vaultNameInputRef}
                        value={vaultNameDraft}
                        onChange={(e) => setVaultNameDraft(e.target.value)}
                        onKeyDown={handleVaultNameKeyDown}
                        onBlur={handleSaveVaultName}
                        placeholder="Untitled Vault"
                        className="w-full px-0 py-0 text-sm font-medium text-stone-700 bg-transparent border-0 border-b border-transparent placeholder-stone-400 focus:outline-none focus:border-stone-300 focus:ring-0"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setVaultNameDraft(vaultLabel ?? "");
                          setIsEditingVaultName(true);
                        }}
                        className="w-full text-left text-sm font-medium text-stone-700 truncate hover:underline hover:decoration-dotted hover:decoration-stone-300 hover:underline-offset-2 transition-colors"
                        title={displayVaultLabel}
                      >
                        {displayVaultLabel}
                      </button>
                    )}
                  </div>
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${
                          activeTab === tab.id
                            ? "bg-white text-stone-900 shadow-sm"
                            : "text-stone-600 hover:text-stone-800 hover:bg-stone-100"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                        {tab.id === "access" &&
                          accessibilityGranted === false && (
                            <span className="ml-auto w-2 h-2 bg-amber-400 rounded-full" />
                          )}
                      </button>
                    );
                  })}
                </nav>
                <div className="px-3 pb-3 pt-2">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={handleStartNewVault}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 transition-colors"
                      title="Create new vault"
                    >
                      <PlusIcon className="w-4 h-4" />
                      <span>New vault</span>
                    </button>
                    <button
                      onClick={handleOpenExistingVault}
                      disabled={isSwitchingVault}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Open existing vault"
                    >
                      {isSwitchingVault ? (
                        <span className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                      ) : (
                        <FolderIcon className="w-4 h-4" />
                      )}
                      <span>Open vault</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
                  <h3 className="text-sm font-medium text-stone-500">
                    {tabs.find((t) => t.id === activeTab)?.label}
                  </h3>
                  <button
                    onClick={onClose}
                    className="p-1 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 modal-scrollable">
                  {/* Error message */}
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm mb-4">
                      <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {activeTab === "general" && (
                    <div className="space-y-5">
                      {/* Storage Location */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          Storage Location
                        </label>
                        <div className="flex gap-2">
                          <div
                            className="flex-1 min-w-0 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-600 truncate"
                            title={storagePath}
                          >
                            {storagePath || "Loading..."}
                          </div>
                          <button
                            onClick={handleBrowseFolder}
                            disabled={isMigrating}
                            className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 flex-shrink-0"
                          >
                            {isMigrating ? (
                              <>
                                <span className="w-3.5 h-3.5 border-2 border-stone-400/30 border-t-stone-600 rounded-full animate-spin" />
                                <span>Moving...</span>
                              </>
                            ) : (
                              <>
                                <FolderIcon className="w-4 h-4" />
                                <span>Browse</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-stone-400">
                          Your encrypted vault location. Changing moves your
                          data.
                        </p>
                      </div>

                      {/* Image Storage Optimization */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          Image Storage Optimization
                        </label>
                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                              <PhotoIcon className="w-4 h-4 text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-stone-700">
                                Migrate legacy images
                              </p>
                              <p className="text-xs text-stone-500 mt-0.5">
                                Move images from database to separate encrypted
                                files. Creates thumbnails for faster loading.
                              </p>
                            </div>
                          </div>

                          {migrationResult && (
                            <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                              <p className="text-xs text-emerald-700">
                                ✓ Migrated {migrationResult.migrated} image
                                {migrationResult.migrated !== 1 ? "s" : ""}
                                {migrationResult.failed > 0 &&
                                  `, ${migrationResult.failed} failed`}
                                {migrationResult.skipped > 0 &&
                                  `, ${migrationResult.skipped} skipped`}
                              </p>
                            </div>
                          )}

                          <div className="mt-3">
                            <button
                              onClick={handleMigrateImages}
                              disabled={isMigratingImages}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {isMigratingImages ? (
                                <>
                                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  <span>Migrating...</span>
                                </>
                              ) : (
                                <>
                                  <PhotoIcon className="w-3.5 h-3.5" />
                                  <span>Optimize Images</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-stone-400">
                          Improves performance for vaults with many images. Safe
                          to run multiple times.
                        </p>
                      </div>

                      {/* Search Index Optimization */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          Search Index
                        </label>
                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <MagnifyingGlassIcon className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-stone-700">
                                Rebuild search index
                              </p>
                              <p className="text-xs text-stone-500 mt-0.5">
                                Reindex all embeddings for faster semantic
                                search. Run this after importing items.
                              </p>
                            </div>
                          </div>

                          {reindexResult && (
                            <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                              <p className="text-xs text-emerald-700">
                                ✓ Indexed {reindexResult.indexed} item
                                {reindexResult.indexed !== 1 ? "s" : ""}
                                {reindexResult.failed > 0 &&
                                  `, ${reindexResult.failed} failed`}
                                {reindexResult.skipped > 0 &&
                                  `, ${reindexResult.skipped} skipped`}
                              </p>
                            </div>
                          )}

                          <div className="mt-3">
                            <button
                              onClick={handleReindexEmbeddings}
                              disabled={isReindexing}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {isReindexing ? (
                                <>
                                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  <span>Reindexing...</span>
                                </>
                              ) : (
                                <>
                                  <MagnifyingGlassIcon className="w-3.5 h-3.5" />
                                  <span>Rebuild Index</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-stone-400">
                          Improves search speed by building a dedicated index.
                          Safe to run multiple times.
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === "ai" && (
                    <div className="space-y-5">
                      {/* OpenAI API Key */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          OpenAI API Key
                        </label>
                        {maskedApiKey && (
                          <p className="text-xs text-stone-500">
                            Current:{" "}
                            <code className="px-1 py-0.5 bg-stone-100 rounded text-[11px]">
                              {maskedApiKey}
                            </code>
                          </p>
                        )}
                        <div className="flex gap-2">
                          <div className="relative flex-1 min-w-0">
                            <input
                              type={showApiKey ? "text" : "password"}
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                              placeholder={
                                maskedApiKey ? "Enter new key..." : "sk-..."
                              }
                              className="w-full px-3 py-1.5 pr-9 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-600"
                            >
                              {showApiKey ? (
                                <EyeSlashIcon className="w-4 h-4" />
                              ) : (
                                <EyeIcon className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <button
                            onClick={handleSaveApiKey}
                            disabled={!apiKey.trim() || isSavingApiKey}
                            className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 flex-shrink-0"
                          >
                            {isSavingApiKey ? (
                              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : apiKeySaved ? (
                              <CheckIcon className="w-3.5 h-3.5" />
                            ) : (
                              "Save"
                            )}
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                          <span>Stored locally in Keychain.</span>
                          <span>
                            <code className="px-1 py-0.5 bg-stone-100 rounded text-[11px]">
                              OPENAI_API_KEY
                            </code>{" "}
                            overrides.
                          </span>
                          {(maskedApiKey || apiKeyRemoved) && (
                            <button
                              type="button"
                              onClick={handleRemoveApiKey}
                              disabled={!maskedApiKey || isRemovingApiKey}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {isRemovingApiKey ? (
                                <span className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                              ) : apiKeyRemoved ? (
                                <CheckIcon className="w-3.5 h-3.5" />
                              ) : (
                                <TrashIcon className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {apiKeyRemoved ? "Removed" : "Remove key"}
                              </span>
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-stone-400">
                          For AI tagging and semantic search.{" "}
                          <a
                            href="https://platform.openai.com/api-keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-600 hover:underline"
                          >
                            Get an API key
                          </a>
                        </p>
                      </div>

                      {/* Usage Overview */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          Usage overview
                        </label>
                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-stone-700">
                                Last 30 days
                              </p>
                              <p className="text-xs text-stone-500 mt-0.5">
                                Tokens from AI calls made on this device.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={refreshAiUsage}
                              disabled={isLoadingAiUsage}
                              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {isLoadingAiUsage ? (
                                <span className="w-3 h-3 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                              ) : (
                                <ArrowPathIcon className="w-3.5 h-3.5" />
                              )}
                              <span>Refresh</span>
                            </button>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="p-2 bg-white border border-stone-200 rounded-lg">
                              <p className="text-[11px] uppercase tracking-wide text-stone-400">
                                Est. Cost
                              </p>
                              <p className="text-sm font-medium text-stone-700">
                                ${aiUsageTotalCost.toFixed(4)}
                              </p>
                            </div>
                            <div className="p-2 bg-white border border-stone-200 rounded-lg">
                              <p className="text-[11px] uppercase tracking-wide text-stone-400">
                                Tokens
                              </p>
                              <p className="text-sm font-medium text-stone-700">
                                {aiUsageTotalTokens.toLocaleString()}
                              </p>
                            </div>
                            <div className="p-2 bg-white border border-stone-200 rounded-lg">
                              <p className="text-[11px] uppercase tracking-wide text-stone-400">
                                Requests
                              </p>
                              <p className="text-sm font-medium text-stone-700">
                                {aiUsageTotalRequests.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3">
                            {isLoadingAiUsage ? (
                              <div className="flex items-center justify-center h-20 bg-white border border-dashed border-stone-200 rounded-lg">
                                <span className="text-xs text-stone-400">
                                  Loading usage...
                                </span>
                              </div>
                            ) : aiUsageHasData ? (
                              <div className="flex items-end gap-1 h-20">
                                {aiUsageHistory.map((day) => {
                                  const maxTokens = aiUsageMaxTokens || 1;
                                  const height = Math.max(
                                    (day.total_tokens / maxTokens) * 100,
                                    4
                                  );
                                  const barClass =
                                    day.total_tokens > 0
                                      ? "bg-amber-300"
                                      : "bg-stone-200";
                                  return (
                                    <div
                                      key={day.date}
                                      className="flex-1 h-full flex items-end"
                                    >
                                      <div
                                        className={`${barClass} w-full rounded-sm`}
                                        style={{ height: `${height}%` }}
                                        title={`${day.date}: ${day.total_tokens} tokens`}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-20 bg-white border border-dashed border-stone-200 rounded-lg">
                                <span className="text-xs text-stone-400">
                                  No usage yet
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                            <span>Billing totals live in OpenAI.</span>
                            <a
                              href="https://platform.openai.com/usage"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-amber-600 hover:underline flex items-center gap-1"
                            >
                              Open usage dashboard
                              <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Monthly Budget */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          Monthly budget
                        </label>
                        <div
                          className={`p-3 rounded-xl border ${
                            isOverBudget
                              ? "bg-red-50 border-red-200"
                              : isNearBudget
                              ? "bg-amber-50 border-amber-200"
                              : "bg-stone-50 border-stone-200"
                          }`}
                        >
                          {/* Current month status */}
                          {monthlyBudget && (
                            <div className="mb-3 pb-3 border-b border-stone-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-stone-600">
                                  {now.toLocaleDateString("en-US", {
                                    month: "long",
                                    year: "numeric",
                                  })}
                                </span>
                                <span
                                  className={`text-xs font-medium ${
                                    isOverBudget
                                      ? "text-red-600"
                                      : isNearBudget
                                      ? "text-amber-600"
                                      : "text-stone-600"
                                  }`}
                                >
                                  ${currentMonthSpent.toFixed(4)} / $
                                  {monthlyBudget.toFixed(2)}
                                </span>
                              </div>
                              <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    isOverBudget
                                      ? "bg-red-500"
                                      : isNearBudget
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                  }`}
                                  style={{
                                    width: `${Math.min(
                                      budgetPercentUsed,
                                      100
                                    )}%`,
                                  }}
                                />
                              </div>
                              {isOverBudget && (
                                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                                  <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                                  Budget exceeded. AI features are paused until
                                  next month.
                                </p>
                              )}
                              {isNearBudget && !isOverBudget && (
                                <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                                  <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                                  Approaching budget limit (
                                  {Math.round(budgetPercentUsed)}% used)
                                </p>
                              )}
                            </div>
                          )}

                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-stone-700">
                                Monthly limit
                              </p>
                              <p className="text-xs text-stone-500 mt-0.5">
                                Hard stop when budget is reached.
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-stone-400">$</span>
                              <input
                                type="number"
                                min={0}
                                step={0.5}
                                value={monthlyBudget ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateMonthlyBudget(
                                    val === "" ? null : Number(val)
                                  );
                                }}
                                placeholder="No limit"
                                className="w-20 px-2 py-1 bg-white border border-stone-200 rounded-md text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                              />
                              <span className="text-xs text-stone-400">
                                USD
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-stone-700">
                                Warning threshold
                              </p>
                              <p className="text-xs text-stone-500 mt-0.5">
                                Get warned when approaching limit.
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={50}
                                max={100}
                                step={5}
                                value={Math.round(warningThreshold * 100)}
                                onChange={(e) =>
                                  updateWarningThreshold(
                                    Number(e.target.value) / 100
                                  )
                                }
                                className="w-16 px-2 py-1 bg-white border border-stone-200 rounded-md text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                              />
                              <span className="text-xs text-stone-400">%</span>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <p className="text-xs text-stone-500">
                              Leave empty for no limit.
                            </p>
                            <button
                              type="button"
                              onClick={handleSaveAiSettings}
                              disabled={
                                !aiSettingsChanged || isSavingAiSettings
                              }
                              className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-medium hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                            >
                              {isSavingAiSettings ? (
                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : aiSettingsSaved ? (
                                <CheckIcon className="w-3.5 h-3.5" />
                              ) : (
                                "Save"
                              )}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-stone-400">
                          Costs are estimates based on current OpenAI pricing.
                        </p>
                      </div>

                      {/* Pricing Reference */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          Pricing reference
                        </label>
                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                              <ChartBarIcon className="w-4 h-4 text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-stone-700">
                                Estimated pricing
                              </p>
                              <p className="text-xs text-stone-500 mt-0.5">
                                Costs are calculated using current OpenAI rates.
                                Actual billing may vary.
                              </p>
                              <div className="mt-2 space-y-1.5 text-xs">
                                <div className="flex items-center justify-between p-1.5 bg-white border border-stone-200 rounded-lg">
                                  <span className="text-stone-600 font-medium">
                                    gpt-4o-mini
                                  </span>
                                  <span className="text-stone-500">
                                    $0.15 / $0.60 per 1M tokens
                                  </span>
                                </div>
                                <div className="flex items-center justify-between p-1.5 bg-white border border-stone-200 rounded-lg">
                                  <span className="text-stone-600 font-medium">
                                    text-embedding-3-small
                                  </span>
                                  <span className="text-stone-500">
                                    $0.02 per 1M tokens
                                  </span>
                                </div>
                              </div>
                              <a
                                href="https://platform.openai.com/pricing"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-xs text-amber-600 hover:underline"
                              >
                                Check current OpenAI pricing
                                <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-stone-400">
                          Pricing embedded in app is updated periodically but
                          may lag behind OpenAI changes.
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === "security" && (
                    <div className="space-y-5">
                      {/* Auto-lock */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          Auto-lock
                        </label>
                        <div className="flex items-center justify-between p-3 bg-stone-50 border border-stone-200 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center">
                              <LockClosedIcon className="w-4 h-4 text-stone-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-stone-700">
                                Lock after inactivity
                              </p>
                              <p className="text-xs text-stone-500">
                                Automatically lock your vault
                              </p>
                            </div>
                          </div>
                          <select
                            value={status.auto_lock_minutes}
                            onChange={(e) =>
                              setAutoLockMinutes(Number(e.target.value))
                            }
                            className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                          >
                            <option value={5}>5 minutes</option>
                            <option value={15}>15 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={60}>1 hour</option>
                            <option value={0}>Never</option>
                          </select>
                        </div>
                      </div>

                      {/* Touch ID */}
                      {status.biometrics_available && (
                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium text-stone-700">
                            Touch ID
                          </label>
                          <div className="flex items-center justify-between p-3 bg-stone-50 border border-stone-200 rounded-xl">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                                <FingerPrintIcon className="w-4 h-4 text-amber-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-stone-700">
                                  Unlock with Touch ID
                                </p>
                                <p className="text-xs text-stone-500">
                                  {status.biometrics_enabled
                                    ? "Enabled for quick unlock"
                                    : "Use your fingerprint"}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={handleToggleBiometrics}
                              disabled={isTogglingBiometrics}
                              className={`relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0 ${
                                status.biometrics_enabled
                                  ? "bg-amber-500"
                                  : "bg-stone-300"
                              }`}
                            >
                              {isTogglingBiometrics ? (
                                <span className="absolute inset-0 flex items-center justify-center">
                                  <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                </span>
                              ) : (
                                <span
                                  className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform duration-200 ${
                                    status.biometrics_enabled
                                      ? "translate-x-[18px]"
                                      : "translate-x-0"
                                  }`}
                                />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-stone-400">
                            Key stored securely in macOS Keychain.
                          </p>
                        </div>
                      )}

                      {!status.biometrics_available && (
                        <div className="text-center py-6">
                          <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-2">
                            <FingerPrintIcon className="w-5 h-5 text-stone-400" />
                          </div>
                          <p className="text-sm text-stone-500">
                            Touch ID not available on this device
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "cloud" && (
                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          Backup Storage
                        </label>
                        <div className="flex items-center justify-between p-3 bg-stone-50 border border-stone-200 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                              <CloudIcon className="w-4 h-4 text-sky-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-stone-700">
                                Enable backup storage
                              </p>
                              <p className="text-xs text-stone-500">
                                Create encrypted snapshots in your selected
                                folder.
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleToggleBackup}
                            disabled={isTogglingBackup}
                            className={`relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0 ${
                              backupEnabled ? "bg-sky-500" : "bg-stone-300"
                            }`}
                          >
                            {isTogglingBackup ? (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                              </span>
                            ) : (
                              <span
                                className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform duration-200 ${
                                  backupEnabled
                                    ? "translate-x-[18px]"
                                    : "translate-x-0"
                                }`}
                              />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-stone-400">
                          Backups run every {backupIntervalLabel} while Atlas is
                          open.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          Backup Folder
                        </label>
                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                          <div className="flex items-center gap-2">
                            <div
                              className="flex-1 min-w-0 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-600 truncate"
                              title={backupPath}
                            >
                              {backupPath || "No folder selected"}
                            </div>
                            <button
                              onClick={handleChooseBackupFolder}
                              disabled={isSelectingBackupPath}
                              className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 flex-shrink-0"
                            >
                              {isSelectingBackupPath ? (
                                <>
                                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  <span>Choosing...</span>
                                </>
                              ) : (
                                <>
                                  <FolderIcon className="w-4 h-4" />
                                  <span>Choose Folder</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-stone-500">
                              Last backup: {lastBackupLabel}
                            </p>
                            <button
                              onClick={handleRunBackup}
                              disabled={
                                !backupEnabled || !backupPath || isRunningBackup
                              }
                              className="px-3 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {isRunningBackup ? (
                                <>
                                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block align-middle" />
                                  <span className="ml-1">Backing up...</span>
                                </>
                              ) : (
                                "Backup now"
                              )}
                            </button>
                          </div>
                          {backupEnabled && !backupPath && (
                            <div className="mt-3 flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                              <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
                              <span>
                                Choose a backup folder to start saving
                                snapshots.
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-stone-400">
                          Snapshots are saved under Atlas
                          Backups/YYYY-MM-DD_HH-MM-SS in this folder. Your
                          provider just syncs the files.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          Supported Providers
                        </label>
                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            <a
                              href="https://www.icloud.com/iclouddrive"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-stone-700 hover:border-stone-300 hover:bg-stone-100 transition-colors"
                            >
                              <span>iCloud Drive</span>
                              <ArrowTopRightOnSquareIcon className="w-4 h-4 text-stone-400" />
                            </a>
                            <a
                              href="https://www.dropbox.com/install"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-stone-700 hover:border-stone-300 hover:bg-stone-100 transition-colors"
                            >
                              <span>Dropbox</span>
                              <ArrowTopRightOnSquareIcon className="w-4 h-4 text-stone-400" />
                            </a>
                            <a
                              href="https://www.google.com/drive/download/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-stone-700 hover:border-stone-300 hover:bg-stone-100 transition-colors"
                            >
                              <span>Google Drive</span>
                              <ArrowTopRightOnSquareIcon className="w-4 h-4 text-stone-400" />
                            </a>
                            <a
                              href="https://www.microsoft.com/onedrive/download"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-stone-700 hover:border-stone-300 hover:bg-stone-100 transition-colors"
                            >
                              <span>OneDrive</span>
                              <ArrowTopRightOnSquareIcon className="w-4 h-4 text-stone-400" />
                            </a>
                          </div>
                        </div>
                        <p className="text-xs text-stone-400">
                          Any provider that syncs a local folder works.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          Best Practices
                        </label>
                        <div className="space-y-2 text-xs text-stone-500">
                          <div className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-stone-600 font-medium text-[10px]">
                              1
                            </span>
                            <p>
                              Use Open vault to restore from a backup snapshot
                              folder.
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-stone-600 font-medium text-[10px]">
                              2
                            </span>
                            <p>
                              Let syncing finish before restoring or switching
                              devices.
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-stone-600 font-medium text-[10px]">
                              3
                            </span>
                            <p>
                              Atlas stores encrypted data only; your provider
                              sees ciphertext.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "access" && (
                    <div className="space-y-5">
                      {/* Accessibility Permission */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          Accessibility Permission
                        </label>

                        <div
                          className={`p-3 rounded-xl border ${
                            accessibilityGranted
                              ? "bg-emerald-50 border-emerald-200"
                              : "bg-amber-50 border-amber-200"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                accessibilityGranted
                                  ? "bg-emerald-100"
                                  : "bg-amber-100"
                              }`}
                            >
                              {isCheckingAccess ? (
                                <span className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                              ) : accessibilityGranted ? (
                                <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <ExclamationCircleIcon className="w-4 h-4 text-amber-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm font-medium ${
                                  accessibilityGranted
                                    ? "text-emerald-800"
                                    : "text-amber-800"
                                }`}
                              >
                                {isCheckingAccess
                                  ? "Checking..."
                                  : accessibilityGranted
                                  ? "Access granted"
                                  : "Access required"}
                              </p>
                              <p
                                className={`text-xs mt-0.5 ${
                                  accessibilityGranted
                                    ? "text-emerald-600"
                                    : "text-amber-700"
                                }`}
                              >
                                {accessibilityGranted
                                  ? "Quick Capture can read selected text."
                                  : "Needed to read selected text with ⌘⇧S."}
                              </p>
                            </div>
                          </div>

                          {!accessibilityGranted && !isCheckingAccess && (
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={handleRequestAccessibility}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors"
                              >
                                Grant Access
                              </button>
                              <button
                                onClick={handleOpenAccessibilitySettings}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-amber-700 border border-amber-300 rounded-lg text-xs font-medium hover:bg-amber-50 transition-colors"
                              >
                                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                                Open Settings
                              </button>
                              <button
                                onClick={checkAccessibility}
                                className="px-3 py-1.5 bg-white text-amber-700 border border-amber-300 rounded-lg text-xs font-medium hover:bg-amber-50 transition-colors"
                              >
                                Refresh
                              </button>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-stone-400">
                          Find Atlas in System Settings → Accessibility and
                          enable it.
                        </p>
                      </div>

                      {/* Quick Capture Shortcut Info */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          Quick Capture Shortcut
                        </label>

                        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0">
                              <CommandLineIcon className="w-4 h-4 text-stone-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5">
                                <kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded text-stone-700 font-mono text-[11px] shadow-sm">
                                  ⌘
                                </kbd>
                                <span className="text-stone-400 text-xs">
                                  +
                                </span>
                                <kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded text-stone-700 font-mono text-[11px] shadow-sm">
                                  ⇧
                                </kbd>
                                <span className="text-stone-400 text-xs">
                                  +
                                </span>
                                <kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded text-stone-700 font-mono text-[11px] shadow-sm">
                                  S
                                </kbd>
                              </div>
                              <p className="text-xs text-stone-500 mt-1.5">
                                Capture selected text or current URL from any
                                app.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* How it works */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          How It Works
                        </label>

                        <div className="space-y-1.5 text-xs text-stone-500">
                          <div className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-stone-600 font-medium text-[10px]">
                              1
                            </span>
                            <p>
                              Select text or open a page in Safari, Chrome, Arc,
                              or Brave
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-stone-600 font-medium text-[10px]">
                              2
                            </span>
                            <p>
                              Press{" "}
                              <kbd className="px-1 py-0.5 bg-stone-100 rounded font-mono text-[10px]">
                                ⌘⇧S
                              </kbd>{" "}
                              to trigger Quick Capture
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-stone-600 font-medium text-[10px]">
                              3
                            </span>
                            <p>
                              Atlas opens with captured content ready to save
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
