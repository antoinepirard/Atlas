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
} from '@heroicons/react/24/outline';
import * as tauri from '../lib/tauri';
import { useVault } from './VaultProvider';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { status, enableBiometrics, disableBiometrics } = useVault();
  const [apiKey, setApiKey] = useState('');
  const [maskedApiKey, setMaskedApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [storagePath, setStoragePath] = useState('');
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isTogglingBiometrics, setIsTogglingBiometrics] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current settings when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSettings();
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
            <div className="bg-white rounded-2xl shadow-2xl shadow-stone-900/10 overflow-hidden w-full max-w-md pointer-events-auto">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
                <h2 className="text-lg font-medium text-stone-800">Settings</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-6">
                {/* Error message */}
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                    <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* OpenAI API Key */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-stone-700">
                    OpenAI API Key
                  </label>
                  {maskedApiKey && (
                    <p className="text-xs text-stone-500">
                      Current: <code className="px-1 py-0.5 bg-stone-100 rounded">{maskedApiKey}</code>
                    </p>
                  )}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={maskedApiKey ? 'Enter new key to update...' : 'sk-...'}
                        className="w-full px-3 py-2 pr-10 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600"
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
                      className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                      {isSavingApiKey ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : apiKeySaved ? (
                        <CheckIcon className="w-4 h-4" />
                      ) : (
                        'Save'
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-stone-400">
                    Used for AI-powered tagging and semantic search.{' '}
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
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-stone-700">
                    Storage Location
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-600 truncate" title={storagePath}>
                      {storagePath || 'Loading...'}
                    </div>
                    <button
                      onClick={handleBrowseFolder}
                      disabled={isMigrating}
                      className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                      {isMigrating ? (
                        <>
                          <span className="w-4 h-4 border-2 border-stone-400/30 border-t-stone-600 rounded-full animate-spin" />
                          Migrating...
                        </>
                      ) : (
                        <>
                          <FolderIcon className="w-4 h-4" />
                          Browse...
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-stone-400">
                    Where your encrypted vault is stored. Changing this will move your data.
                  </p>
                </div>

                {/* Touch ID */}
                {status.biometrics_available && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-stone-700">
                      Touch ID
                    </label>
                    <div className="flex items-center justify-between p-3 bg-stone-50 border border-stone-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                          <FingerPrintIcon className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-stone-700">
                            Unlock with Touch ID
                          </p>
                          <p className="text-xs text-stone-500">
                            {status.biometrics_enabled 
                              ? 'Touch ID is enabled for quick unlock' 
                              : 'Use your fingerprint to unlock'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleToggleBiometrics}
                        disabled={isTogglingBiometrics}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
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
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                              status.biometrics_enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-stone-400">
                      Your encryption key is securely stored in the macOS Keychain.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 bg-stone-50 border-t border-stone-100">
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 text-sm text-stone-600 hover:text-stone-800 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

