import type { ComponentType, KeyboardEvent, RefObject, SVGProps } from "react";
import { FolderIcon, PlusIcon } from "@heroicons/react/24/outline";

type SettingsTabId = "general" | "ai" | "security" | "cloud" | "access";

interface SettingsTab {
  id: SettingsTabId;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

interface SettingsSidebarProps {
  tabs: SettingsTab[];
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
  accessibilityGranted: boolean | null;
  isEditingVaultName: boolean;
  vaultNameDraft: string;
  vaultNameInputRef: RefObject<HTMLInputElement>;
  onVaultNameChange: (value: string) => void;
  onVaultNameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onVaultNameBlur: () => void;
  displayVaultLabel: string;
  onStartEditVaultName: () => void;
  onStartNewVault: () => void;
  onOpenExistingVault: () => void;
  isSwitchingVault: boolean;
}

export function SettingsSidebar({
  tabs,
  activeTab,
  onTabChange,
  accessibilityGranted,
  isEditingVaultName,
  vaultNameDraft,
  vaultNameInputRef,
  onVaultNameChange,
  onVaultNameKeyDown,
  onVaultNameBlur,
  displayVaultLabel,
  onStartEditVaultName,
  onStartNewVault,
  onOpenExistingVault,
  isSwitchingVault,
}: SettingsSidebarProps) {
  return (
    <div className="w-44 flex-shrink-0 bg-stone-50 border-r border-stone-200 flex flex-col">
      <nav className="pt-4 px-2 pb-2 flex-1">
        <div className="px-3 pb-3">
          {isEditingVaultName ? (
            <input
              ref={vaultNameInputRef}
              value={vaultNameDraft}
              onChange={(e) => onVaultNameChange(e.target.value)}
              onKeyDown={onVaultNameKeyDown}
              onBlur={onVaultNameBlur}
              placeholder="Untitled Vault"
              className="w-full px-0 py-0 text-sm font-medium text-stone-700 bg-transparent border-0 border-b border-transparent placeholder-stone-400 focus:outline-none focus:border-stone-300 focus:ring-0"
            />
          ) : (
            <button
              type="button"
              onClick={onStartEditVaultName}
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
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${
                activeTab === tab.id
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-600 hover:text-stone-800 hover:bg-stone-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.id === "access" && accessibilityGranted === false && (
                <span className="ml-auto w-2 h-2 bg-amber-400 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>
      <div className="px-3 pb-3 pt-2">
        <div className="flex flex-col gap-1">
          <button
            onClick={onStartNewVault}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 transition-colors"
            title="Create new vault"
          >
            <PlusIcon className="w-4 h-4" />
            <span>New vault</span>
          </button>
          <button
            onClick={onOpenExistingVault}
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
  );
}
