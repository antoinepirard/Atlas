import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowDownTrayIcon, XMarkIcon, ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { listen } from '@tauri-apps/api/event';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'up-to-date';

interface UpdateToastProps {
  onOpenSettings?: () => void;
}

export function UpdateToast({ onOpenSettings }: UpdateToastProps) {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const checkForUpdates = useCallback(async (manual = false) => {
    setStatus('checking');
    setError(null);
    
    // Only show the toast immediately for manual checks
    if (manual) {
      setIsVisible(true);
    }
    
    try {
      const updateResult = await check();
      
      if (updateResult) {
        setUpdate(updateResult);
        setStatus('available');
        setIsVisible(true); // Show toast when update is available
      } else {
        setStatus('up-to-date');
        // Only show "up to date" message for manual checks
        if (manual) {
          setTimeout(() => setIsVisible(false), 3000);
        }
      }
    } catch (err) {
      console.error('Update check failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to check for updates');
      setStatus('error');
      // Only show error for manual checks
      if (manual) {
        setIsVisible(true);
      }
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!update) return;
    
    setStatus('downloading');
    setProgress(0);
    
    try {
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            setProgress(0);
            total = event.data.contentLength ?? 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (total > 0) {
              setProgress(Math.round((downloaded / total) * 100));
            }
            break;
          case 'Finished':
            setProgress(100);
            setStatus('ready');
            break;
        }
      });
    } catch (err) {
      console.error('Download failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to download update');
      setStatus('error');
    }
  }, [update]);

  const restartApp = useCallback(async () => {
    try {
      await relaunch();
    } catch (err) {
      console.error('Relaunch failed:', err);
      setError('Failed to restart. Please restart manually.');
    }
  }, []);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    // Reset state after animation
    setTimeout(() => {
      if (status !== 'ready') {
        setStatus('idle');
        setUpdate(null);
        setProgress(0);
        setError(null);
      }
    }, 300);
  }, [status]);

  // Listen for menu event to check for updates
  useEffect(() => {
    const unlisten = listen('check-for-updates', () => {
      checkForUpdates(true);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [checkForUpdates]);

  // Listen for settings menu event
  useEffect(() => {
    const unlisten = listen('open-settings', () => {
      onOpenSettings?.();
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [onOpenSettings]);

  // Auto-check for updates on app start (with delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates(false);
    }, 5000); // Check 5 seconds after app start

    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-6 right-6 z-[100]"
        >
          <div className="bg-white rounded-2xl shadow-2xl shadow-stone-900/15 border border-stone-200/50 overflow-hidden w-80">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  {status === 'checking' ? (
                    <ArrowPathIcon className="w-4 h-4 text-white animate-spin" />
                  ) : status === 'available' || status === 'downloading' || status === 'ready' ? (
                    <SparklesIcon className="w-4 h-4 text-white" />
                  ) : (
                    <ArrowDownTrayIcon className="w-4 h-4 text-white" />
                  )}
                </div>
                <span className="font-medium text-stone-800 text-sm">
                  {status === 'checking' && 'Checking for updates...'}
                  {status === 'available' && 'Update Available'}
                  {status === 'downloading' && 'Downloading...'}
                  {status === 'ready' && 'Ready to Install'}
                  {status === 'up-to-date' && 'Up to Date'}
                  {status === 'error' && 'Update Error'}
                </span>
              </div>
              {(status !== 'downloading') && (
                <button
                  onClick={dismiss}
                  className="p-1 text-stone-400 hover:text-stone-600 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              {status === 'checking' && (
                <p className="text-sm text-stone-500">
                  Looking for new versions...
                </p>
              )}

              {status === 'up-to-date' && (
                <p className="text-sm text-stone-500">
                  You're running the latest version of Atlas.
                </p>
              )}

              {status === 'available' && update && (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-stone-700">
                      <span className="font-medium">Version {update.version}</span> is available
                    </p>
                    {update.body && (
                      <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                        {update.body}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={dismiss}
                      className="flex-1 px-3 py-2 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                    >
                      Later
                    </button>
                    <button
                      onClick={downloadAndInstall}
                      className="flex-1 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      Update
                    </button>
                  </div>
                </div>
              )}

              {status === 'downloading' && (
                <div className="space-y-3">
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-xs text-stone-500 text-center">
                    Downloading update... {progress}%
                  </p>
                </div>
              )}

              {status === 'ready' && (
                <div className="space-y-3">
                  <p className="text-sm text-stone-600">
                    Update downloaded! Restart Atlas to apply the changes.
                  </p>
                  <button
                    onClick={restartApp}
                    className="w-full px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                    Restart Now
                  </button>
                </div>
              )}

              {status === 'error' && (
                <div className="space-y-3">
                  <p className="text-sm text-red-600">
                    {error || 'An error occurred while checking for updates.'}
                  </p>
                  <button
                    onClick={() => checkForUpdates(true)}
                    className="w-full px-3 py-2 text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

