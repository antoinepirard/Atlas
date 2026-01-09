import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  CommandLineIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";

interface SettingsAccessTabProps {
  accessibilityGranted: boolean | null;
  isCheckingAccess: boolean;
  onRequestAccessibility: () => void;
  onOpenAccessibilitySettings: () => void;
  onRefreshAccessibility: () => void;
}

export function SettingsAccessTab({
  accessibilityGranted,
  isCheckingAccess,
  onRequestAccessibility,
  onOpenAccessibilitySettings,
  onRefreshAccessibility,
}: SettingsAccessTabProps) {
  return (
    <div className="space-y-5">
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
                accessibilityGranted ? "bg-emerald-100" : "bg-amber-100"
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
                  accessibilityGranted ? "text-emerald-800" : "text-amber-800"
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
                  accessibilityGranted ? "text-emerald-600" : "text-amber-700"
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
                onClick={onRequestAccessibility}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors"
              >
                Grant Access
              </button>
              <button
                onClick={onOpenAccessibilitySettings}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-amber-700 border border-amber-300 rounded-lg text-xs font-medium hover:bg-amber-50 transition-colors"
              >
                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                Open Settings
              </button>
              <button
                onClick={onRefreshAccessibility}
                className="px-3 py-1.5 bg-white text-amber-700 border border-amber-300 rounded-lg text-xs font-medium hover:bg-amber-50 transition-colors"
              >
                Refresh
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-stone-400">
          Find Atlas in System Settings → Accessibility and enable it.
        </p>
      </div>

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
                <span className="text-stone-400 text-xs">+</span>
                <kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded text-stone-700 font-mono text-[11px] shadow-sm">
                  ⇧
                </kbd>
                <span className="text-stone-400 text-xs">+</span>
                <kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded text-stone-700 font-mono text-[11px] shadow-sm">
                  S
                </kbd>
              </div>
              <p className="text-xs text-stone-500 mt-1.5">
                Capture selected text or current URL from any app.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-stone-700">
          How It Works
        </label>

        <div className="space-y-1.5 text-xs text-stone-500">
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-stone-600 font-medium text-[10px]">
              1
            </span>
            <p>Select text or open a page in Safari, Chrome, Arc, or Brave</p>
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
            <p>Atlas opens with captured content ready to save</p>
          </div>
        </div>
      </div>
    </div>
  );
}
