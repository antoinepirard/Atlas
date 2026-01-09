import { FingerPrintIcon, LockClosedIcon } from "@heroicons/react/24/outline";

interface SettingsSecurityTabProps {
  autoLockMinutes: number;
  onAutoLockMinutesChange: (value: number) => void;
  biometricsAvailable: boolean;
  biometricsEnabled: boolean;
  onToggleBiometrics: () => void;
  isTogglingBiometrics: boolean;
}

export function SettingsSecurityTab({
  autoLockMinutes,
  onAutoLockMinutesChange,
  biometricsAvailable,
  biometricsEnabled,
  onToggleBiometrics,
  isTogglingBiometrics,
}: SettingsSecurityTabProps) {
  return (
    <div className="space-y-5">
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
            value={autoLockMinutes}
            onChange={(e) => onAutoLockMinutesChange(Number(e.target.value))}
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

      {biometricsAvailable && (
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
                  {biometricsEnabled
                    ? "Enabled for quick unlock"
                    : "Use your fingerprint"}
                </p>
              </div>
            </div>
            <button
              onClick={onToggleBiometrics}
              disabled={isTogglingBiometrics}
              className={`relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0 ${
                biometricsEnabled ? "bg-amber-500" : "bg-stone-300"
              }`}
            >
              {isTogglingBiometrics ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                </span>
              ) : (
                <span
                  className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    biometricsEnabled ? "translate-x-[18px]" : "translate-x-0"
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

      {!biometricsAvailable && (
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
  );
}
