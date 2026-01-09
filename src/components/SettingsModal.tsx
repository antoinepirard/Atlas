import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  XMarkIcon,
  ExclamationTriangleIcon,
  Cog6ToothIcon,
  CloudIcon,
  ShieldCheckIcon,
  KeyIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import * as tauri from "../lib/tauri";
import { BACKUP_INTERVAL_MINUTES, formatBackupInterval } from "../lib/backup";
import { useVault } from "./VaultProvider";
import type { AiSettings, AiUsageDay } from "../types";
import { SettingsSidebar } from "./settings/SettingsSidebar";
import { SettingsGeneralTab } from "./settings/SettingsGeneralTab";
import { SettingsAiTab } from "./settings/SettingsAiTab";
import { SettingsSecurityTab } from "./settings/SettingsSecurityTab";
import { SettingsCloudTab } from "./settings/SettingsCloudTab";
import { SettingsAccessTab } from "./settings/SettingsAccessTab";

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

  const loadSettings = useCallback(async () => {
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
  }, [refreshBackupSettings]);

  const checkAccessibility = useCallback(async () => {
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
  }, []);

  // Load current settings when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSettings();
      checkAccessibility();
    }
  }, [isOpen, loadSettings, checkAccessibility]);

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

  const handleStartEditVaultName = useCallback(() => {
    setVaultNameDraft(status.name?.trim() ?? "");
    setIsEditingVaultName(true);
  }, [status.name]);

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
  const currentMonthLabel = now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthSpent = aiUsageHistory
    .filter((day) => new Date(day.date) >= currentMonthStart)
    .reduce((sum, day) => sum + (day.total_cost_usd ?? 0), 0);

  const budgetPercentUsed = monthlyBudget
    ? (currentMonthSpent / monthlyBudget) * 100
    : 0;
  const isNearBudget = Boolean(
    monthlyBudget && budgetPercentUsed >= warningThreshold * 100
  );
  const isOverBudget = Boolean(
    monthlyBudget && currentMonthSpent >= monthlyBudget
  );

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
              <SettingsSidebar
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                accessibilityGranted={accessibilityGranted}
                isEditingVaultName={isEditingVaultName}
                vaultNameDraft={vaultNameDraft}
                vaultNameInputRef={vaultNameInputRef}
                onVaultNameChange={setVaultNameDraft}
                onVaultNameKeyDown={handleVaultNameKeyDown}
                onVaultNameBlur={handleSaveVaultName}
                displayVaultLabel={displayVaultLabel}
                onStartEditVaultName={handleStartEditVaultName}
                onStartNewVault={handleStartNewVault}
                onOpenExistingVault={handleOpenExistingVault}
                isSwitchingVault={isSwitchingVault}
              />

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
                    <SettingsGeneralTab
                      storagePath={storagePath}
                      isMigrating={isMigrating}
                      onBrowseFolder={handleBrowseFolder}
                      migrationResult={migrationResult}
                      isMigratingImages={isMigratingImages}
                      onMigrateImages={handleMigrateImages}
                      reindexResult={reindexResult}
                      isReindexing={isReindexing}
                      onReindexEmbeddings={handleReindexEmbeddings}
                    />
                  )}

                  {activeTab === "ai" && (
                    <SettingsAiTab
                      apiKey={apiKey}
                      maskedApiKey={maskedApiKey}
                      showApiKey={showApiKey}
                      onApiKeyChange={setApiKey}
                      onToggleShowApiKey={() => setShowApiKey((prev) => !prev)}
                      onSaveApiKey={handleSaveApiKey}
                      isSavingApiKey={isSavingApiKey}
                      apiKeySaved={apiKeySaved}
                      apiKeyRemoved={apiKeyRemoved}
                      onRemoveApiKey={handleRemoveApiKey}
                      isRemovingApiKey={isRemovingApiKey}
                      aiUsageHistory={aiUsageHistory}
                      aiUsageTotalCost={aiUsageTotalCost}
                      aiUsageTotalTokens={aiUsageTotalTokens}
                      aiUsageTotalRequests={aiUsageTotalRequests}
                      aiUsageMaxTokens={aiUsageMaxTokens}
                      aiUsageHasData={aiUsageHasData}
                      isLoadingAiUsage={isLoadingAiUsage}
                      onRefreshAiUsage={refreshAiUsage}
                      monthlyBudget={monthlyBudget}
                      warningThreshold={warningThreshold}
                      onMonthlyBudgetChange={updateMonthlyBudget}
                      onWarningThresholdChange={updateWarningThreshold}
                      aiSettingsChanged={aiSettingsChanged}
                      onSaveAiSettings={handleSaveAiSettings}
                      isSavingAiSettings={isSavingAiSettings}
                      aiSettingsSaved={aiSettingsSaved}
                      currentMonthLabel={currentMonthLabel}
                      currentMonthSpent={currentMonthSpent}
                      budgetPercentUsed={budgetPercentUsed}
                      isNearBudget={isNearBudget}
                      isOverBudget={isOverBudget}
                    />
                  )}

                  {activeTab === "security" && (
                    <SettingsSecurityTab
                      autoLockMinutes={status.auto_lock_minutes}
                      onAutoLockMinutesChange={(value) =>
                        setAutoLockMinutes(value)
                      }
                      biometricsAvailable={status.biometrics_available}
                      biometricsEnabled={status.biometrics_enabled}
                      onToggleBiometrics={handleToggleBiometrics}
                      isTogglingBiometrics={isTogglingBiometrics}
                    />
                  )}

                  {activeTab === "cloud" && (
                    <SettingsCloudTab
                      backupEnabled={backupEnabled}
                      backupIntervalLabel={backupIntervalLabel}
                      backupPath={backupPath}
                      lastBackupLabel={lastBackupLabel}
                      isTogglingBackup={isTogglingBackup}
                      onToggleBackup={handleToggleBackup}
                      isSelectingBackupPath={isSelectingBackupPath}
                      onChooseBackupFolder={handleChooseBackupFolder}
                      isRunningBackup={isRunningBackup}
                      onRunBackup={handleRunBackup}
                    />
                  )}

                  {activeTab === "access" && (
                    <SettingsAccessTab
                      accessibilityGranted={accessibilityGranted}
                      isCheckingAccess={isCheckingAccess}
                      onRequestAccessibility={handleRequestAccessibility}
                      onOpenAccessibilitySettings={
                        handleOpenAccessibilitySettings
                      }
                      onRefreshAccessibility={checkAccessibility}
                    />
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
