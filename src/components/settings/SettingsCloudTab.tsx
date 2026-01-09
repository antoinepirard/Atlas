import {
  ArrowTopRightOnSquareIcon,
  CloudIcon,
  ExclamationTriangleIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";

interface SettingsCloudTabProps {
  backupEnabled: boolean;
  backupIntervalLabel: string;
  backupPath: string;
  lastBackupLabel: string;
  isTogglingBackup: boolean;
  onToggleBackup: () => void;
  isSelectingBackupPath: boolean;
  onChooseBackupFolder: () => void;
  isRunningBackup: boolean;
  onRunBackup: () => void;
}

export function SettingsCloudTab({
  backupEnabled,
  backupIntervalLabel,
  backupPath,
  lastBackupLabel,
  isTogglingBackup,
  onToggleBackup,
  isSelectingBackupPath,
  onChooseBackupFolder,
  isRunningBackup,
  onRunBackup,
}: SettingsCloudTabProps) {
  return (
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
                Create encrypted snapshots in your selected folder.
              </p>
            </div>
          </div>
          <button
            onClick={onToggleBackup}
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
                  backupEnabled ? "translate-x-[18px]" : "translate-x-0"
                }`}
              />
            )}
          </button>
        </div>
        <p className="text-xs text-stone-400">
          Backups run every {backupIntervalLabel} while Atlas is open.
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
              onClick={onChooseBackupFolder}
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
              onClick={onRunBackup}
              disabled={!backupEnabled || !backupPath || isRunningBackup}
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
              <span>Choose a backup folder to start saving snapshots.</span>
            </div>
          )}
        </div>
        <p className="text-xs text-stone-400">
          Snapshots are saved under Atlas Backups/YYYY-MM-DD_HH-MM-SS in this
          folder. Your provider just syncs the files.
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
            <p>Use Open vault to restore from a backup snapshot folder.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-stone-600 font-medium text-[10px]">
              2
            </span>
            <p>Let syncing finish before restoring or switching devices.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-stone-600 font-medium text-[10px]">
              3
            </span>
            <p>
              Atlas stores encrypted data only; your provider sees ciphertext.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
