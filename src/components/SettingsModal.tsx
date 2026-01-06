import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  XMarkIcon, 
  EyeIcon, 
  EyeSlashIcon, 
  FolderIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  FingerPrintIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  KeyIcon,
  ArrowTopRightOnSquareIcon,
  CommandLineIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import * as tauri from '../lib/tauri';
import { useVault } from './VaultProvider';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'security' | 'access';

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { status, enableBiometrics, disableBiometrics } = useVault();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [apiKey, setApiKey] = useState('');
  const [maskedApiKey, setMaskedApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [storagePath, setStoragePath] = useState('');
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isTogglingBiometrics, setIsTogglingBiometrics] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessibilityGranted, setAccessibilityGranted] = useState<boolean | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);

  // Load current settings when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSettings();
      checkAccessibility();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const [masked, path] = await Promise.all([
        tauri.getApiKeyMasked(),
        tauri.getStoragePath(),
      ]);
      setMaskedApiKey(masked);
      setStoragePath(path);
      setApiKey('');
      setApiKeySaved(false);
      setError(null);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const checkAccessibility = async () => {
    setIsCheckingAccess(true);
    try {
      const granted = await tauri.checkAccessibilityPermission();
      setAccessibilityGranted(granted);
    } catch (err) {
      console.error('Failed to check accessibility:', err);
      setAccessibilityGranted(false);
    } finally {
      setIsCheckingAccess(false);
    }
  };

  const handleOpenAccessibilitySettings = async () => {
    try {
      await tauri.openAccessibilitySettings();
    } catch (err) {
      console.error('Failed to open accessibility settings:', err);
    }
  };

  const handleSaveApiKey = useCallback(async () => {
    if (!apiKey.trim()) return;

    setIsSavingApiKey(true);
    setError(null);
    try {
      await tauri.saveApiKey(apiKey.trim());
      const masked = await tauri.getApiKeyMasked();
      setMaskedApiKey(masked);
      setApiKey('');
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key');
    } finally {
      setIsSavingApiKey(false);
    }
  }, [apiKey]);

  const handleBrowseFolder = useCallback(async () => {
    try {
      const selectedPath = await tauri.pickStorageFolder();
      if (selectedPath) {
        setIsMigrating(true);
        setError(null);
        await tauri.setStoragePath(selectedPath);
        setStoragePath(selectedPath + '/vault.db');
        setIsMigrating(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change storage location');
      setIsMigrating(false);
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

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
      setError(err instanceof Error ? err.message : 'Failed to update Touch ID setting');
    } finally {
      setIsTogglingBiometrics(false);
    }
  }, [status.biometrics_enabled, enableBiometrics, disableBiometrics]);

  const tabs: { id: SettingsTab; label: string; icon: typeof Cog6ToothIcon }[] = [
    { id: 'general', label: 'General', icon: Cog6ToothIcon },
    { id: 'security', label: 'Security', icon: ShieldCheckIcon },
    { id: 'access', label: 'Access', icon: KeyIcon },
  ];

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
            <div className="bg-white rounded-2xl shadow-2xl shadow-stone-900/10 overflow-hidden w-full max-w-2xl pointer-events-auto flex">
              {/* Sidebar */}
              <div className="w-44 flex-shrink-0 bg-stone-50 border-r border-stone-200 flex flex-col">
                <div className="px-4 py-5 border-b border-stone-200">
                  <h2 className="text-lg font-medium text-stone-800">Settings</h2>
                </div>
                <nav className="p-2 flex-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${
                          activeTab === tab.id
                            ? 'bg-white text-stone-900 shadow-sm'
                            : 'text-stone-600 hover:text-stone-800 hover:bg-stone-100'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                        {tab.id === 'access' && accessibilityGranted === false && (
                          <span className="ml-auto w-2 h-2 bg-amber-400 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col min-h-[420px] min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
                  <h3 className="text-sm font-medium text-stone-500">
                    {tabs.find(t => t.id === activeTab)?.label}
                  </h3>
                  <button
                    onClick={onClose}
                    className="p-1 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {/* Error message */}
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm mb-4">
                      <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {activeTab === 'general' && (
                    <div className="space-y-5">
                      {/* OpenAI API Key */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          OpenAI API Key
                        </label>
                        {maskedApiKey && (
                          <p className="text-xs text-stone-500">
                            Current: <code className="px-1 py-0.5 bg-stone-100 rounded text-[11px]">{maskedApiKey}</code>
                          </p>
                        )}
                        <div className="flex gap-2">
                          <div className="relative flex-1 min-w-0">
                            <input
                              type={showApiKey ? 'text' : 'password'}
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                              placeholder={maskedApiKey ? 'Enter new key...' : 'sk-...'}
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
                              'Save'
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-stone-400">
                          For AI tagging and semantic search.{' '}
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

                      {/* Storage Location */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          Storage Location
                        </label>
                        <div className="flex gap-2">
                          <div className="flex-1 min-w-0 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-600 truncate" title={storagePath}>
                            {storagePath || 'Loading...'}
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
                          Your encrypted vault location. Changing moves your data.
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'security' && (
                    <div className="space-y-5">
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
                                    ? 'Enabled for quick unlock' 
                                    : 'Use your fingerprint'}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={handleToggleBiometrics}
                              disabled={isTogglingBiometrics}
                              className={`relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0 ${
                                status.biometrics_enabled 
                                  ? 'bg-amber-500' 
                                  : 'bg-stone-300'
                              }`}
                            >
                              {isTogglingBiometrics ? (
                                <span className="absolute inset-0 flex items-center justify-center">
                                  <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                </span>
                              ) : (
                                <span 
                                  className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform duration-200 ${
                                    status.biometrics_enabled ? 'translate-x-[18px]' : 'translate-x-0'
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

                  {activeTab === 'access' && (
                    <div className="space-y-5">
                      {/* Accessibility Permission */}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-stone-700">
                          Accessibility Permission
                        </label>
                        
                        <div className={`p-3 rounded-xl border ${
                          accessibilityGranted 
                            ? 'bg-emerald-50 border-emerald-200' 
                            : 'bg-amber-50 border-amber-200'
                        }`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              accessibilityGranted 
                                ? 'bg-emerald-100' 
                                : 'bg-amber-100'
                            }`}>
                              {isCheckingAccess ? (
                                <span className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                              ) : accessibilityGranted ? (
                                <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <ExclamationCircleIcon className="w-4 h-4 text-amber-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${
                                accessibilityGranted ? 'text-emerald-800' : 'text-amber-800'
                              }`}>
                                {isCheckingAccess 
                                  ? 'Checking...' 
                                  : accessibilityGranted 
                                    ? 'Access granted' 
                                    : 'Access required'}
                              </p>
                              <p className={`text-xs mt-0.5 ${
                                accessibilityGranted ? 'text-emerald-600' : 'text-amber-700'
                              }`}>
                                {accessibilityGranted 
                                  ? 'Quick Capture can read selected text.' 
                                  : 'Needed to read selected text with ⌘⇧S.'}
                              </p>
                            </div>
                          </div>
                          
                          {!accessibilityGranted && !isCheckingAccess && (
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={handleOpenAccessibilitySettings}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors"
                              >
                                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                                Open Settings
                              </button>
                              <button
                                onClick={checkAccessibility}
                                className="px-3 py-1.5 bg-white text-amber-700 border border-amber-300 rounded-lg text-xs font-medium hover:bg-amber-50 transition-colors"
                              >
                                Check Again
                              </button>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-stone-400">
                          Find Atlas in System Settings → Accessibility and enable it.
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
                                <kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded text-stone-700 font-mono text-[11px] shadow-sm">⌘</kbd>
                                <span className="text-stone-400 text-xs">+</span>
                                <kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded text-stone-700 font-mono text-[11px] shadow-sm">⇧</kbd>
                                <span className="text-stone-400 text-xs">+</span>
                                <kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded text-stone-700 font-mono text-[11px] shadow-sm">S</kbd>
                              </div>
                              <p className="text-xs text-stone-500 mt-1.5">
                                Capture selected text or current URL from any app.
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
                            <span className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-stone-600 font-medium text-[10px]">1</span>
                            <p>Select text or open a page in Safari, Chrome, Arc, or Brave</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-stone-600 font-medium text-[10px]">2</span>
                            <p>Press <kbd className="px-1 py-0.5 bg-stone-100 rounded font-mono text-[10px]">⌘⇧S</kbd> to trigger Quick Capture</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-stone-600 font-medium text-[10px]">3</span>
                            <p>Atlas opens with captured content ready to save</p>
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
