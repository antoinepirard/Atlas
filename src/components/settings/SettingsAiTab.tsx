import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ChartBarIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { AiUsageDay } from "../../types";

interface SettingsAiTabProps {
  apiKey: string;
  maskedApiKey: string | null;
  showApiKey: boolean;
  onApiKeyChange: (value: string) => void;
  onToggleShowApiKey: () => void;
  onSaveApiKey: () => void;
  isSavingApiKey: boolean;
  apiKeySaved: boolean;
  apiKeyRemoved: boolean;
  onRemoveApiKey: () => void;
  isRemovingApiKey: boolean;
  aiUsageHistory: AiUsageDay[];
  aiUsageTotalCost: number;
  aiUsageTotalTokens: number;
  aiUsageTotalRequests: number;
  aiUsageMaxTokens: number;
  aiUsageHasData: boolean;
  isLoadingAiUsage: boolean;
  onRefreshAiUsage: () => void;
  monthlyBudget: number | null;
  warningThreshold: number;
  onMonthlyBudgetChange: (value: number | null) => void;
  onWarningThresholdChange: (value: number) => void;
  aiSettingsChanged: boolean;
  onSaveAiSettings: () => void;
  isSavingAiSettings: boolean;
  aiSettingsSaved: boolean;
  currentMonthLabel: string;
  currentMonthSpent: number;
  budgetPercentUsed: number;
  isNearBudget: boolean;
  isOverBudget: boolean;
}

export function SettingsAiTab({
  apiKey,
  maskedApiKey,
  showApiKey,
  onApiKeyChange,
  onToggleShowApiKey,
  onSaveApiKey,
  isSavingApiKey,
  apiKeySaved,
  apiKeyRemoved,
  onRemoveApiKey,
  isRemovingApiKey,
  aiUsageHistory,
  aiUsageTotalCost,
  aiUsageTotalTokens,
  aiUsageTotalRequests,
  aiUsageMaxTokens,
  aiUsageHasData,
  isLoadingAiUsage,
  onRefreshAiUsage,
  monthlyBudget,
  warningThreshold,
  onMonthlyBudgetChange,
  onWarningThresholdChange,
  aiSettingsChanged,
  onSaveAiSettings,
  isSavingAiSettings,
  aiSettingsSaved,
  currentMonthLabel,
  currentMonthSpent,
  budgetPercentUsed,
  isNearBudget,
  isOverBudget,
}: SettingsAiTabProps) {
  return (
    <div className="space-y-5">
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
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder={maskedApiKey ? "Enter new key..." : "sk-..."}
              className="w-full px-3 py-1.5 pr-9 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 text-sm"
            />
            <button
              type="button"
              onClick={onToggleShowApiKey}
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
            onClick={onSaveApiKey}
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
              onClick={onRemoveApiKey}
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
              <span>{apiKeyRemoved ? "Removed" : "Remove key"}</span>
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

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-stone-700">
          Usage overview
        </label>
        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-stone-700">Last 30 days</p>
              <p className="text-xs text-stone-500 mt-0.5">
                Tokens from AI calls made on this device.
              </p>
            </div>
            <button
              type="button"
              onClick={onRefreshAiUsage}
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
                <span className="text-xs text-stone-400">Loading usage...</span>
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
                    day.total_tokens > 0 ? "bg-amber-300" : "bg-stone-200";
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
                <span className="text-xs text-stone-400">No usage yet</span>
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
          {monthlyBudget && (
            <div className="mb-3 pb-3 border-b border-stone-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-stone-600">
                  {currentMonthLabel}
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
                  ${currentMonthSpent.toFixed(4)} / ${monthlyBudget.toFixed(2)}
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
                  style={{ width: `${Math.min(budgetPercentUsed, 100)}%` }}
                />
              </div>
              {isOverBudget && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                  Budget exceeded. AI features are paused until next month.
                </p>
              )}
              {isNearBudget && !isOverBudget && (
                <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                  <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                  Approaching budget limit ({Math.round(budgetPercentUsed)}%
                  used)
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
                  onMonthlyBudgetChange(val === "" ? null : Number(val));
                }}
                placeholder="No limit"
                className="w-20 px-2 py-1 bg-white border border-stone-200 rounded-md text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
              <span className="text-xs text-stone-400">USD</span>
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
                  onWarningThresholdChange(Number(e.target.value) / 100)
                }
                className="w-16 px-2 py-1 bg-white border border-stone-200 rounded-md text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
              <span className="text-xs text-stone-400">%</span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-stone-500">Leave empty for no limit.</p>
            <button
              type="button"
              onClick={onSaveAiSettings}
              disabled={!aiSettingsChanged || isSavingAiSettings}
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
                Costs are calculated using current OpenAI rates. Actual billing
                may vary.
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
                  <span className="text-stone-500">$0.02 per 1M tokens</span>
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
          Pricing embedded in app is updated periodically but may lag behind
          OpenAI changes.
        </p>
      </div>
    </div>
  );
}
