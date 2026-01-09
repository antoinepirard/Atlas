import {
  FolderIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";

interface MigrationResult {
  migrated: number;
  failed: number;
  skipped: number;
}

interface ReindexResult {
  indexed: number;
  skipped: number;
  failed: number;
}

interface SettingsGeneralTabProps {
  storagePath: string;
  isMigrating: boolean;
  onBrowseFolder: () => void;
  migrationResult: MigrationResult | null;
  isMigratingImages: boolean;
  onMigrateImages: () => void;
  reindexResult: ReindexResult | null;
  isReindexing: boolean;
  onReindexEmbeddings: () => void;
}

export function SettingsGeneralTab({
  storagePath,
  isMigrating,
  onBrowseFolder,
  migrationResult,
  isMigratingImages,
  onMigrateImages,
  reindexResult,
  isReindexing,
  onReindexEmbeddings,
}: SettingsGeneralTabProps) {
  return (
    <div className="space-y-5">
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
            onClick={onBrowseFolder}
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
                Move images from database to separate encrypted files. Creates
                thumbnails for faster loading.
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
              onClick={onMigrateImages}
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
          Improves performance for vaults with many images. Safe to run multiple
          times.
        </p>
      </div>

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
                Reindex all embeddings for faster semantic search. Run this
                after importing items.
              </p>
            </div>
          </div>

          {reindexResult && (
            <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-xs text-emerald-700">
                ✓ Indexed {reindexResult.indexed} item
                {reindexResult.indexed !== 1 ? "s" : ""}
                {reindexResult.failed > 0 && `, ${reindexResult.failed} failed`}
                {reindexResult.skipped > 0 &&
                  `, ${reindexResult.skipped} skipped`}
              </p>
            </div>
          )}

          <div className="mt-3">
            <button
              onClick={onReindexEmbeddings}
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
          Improves search speed by building a dedicated index. Safe to run
          multiple times.
        </p>
      </div>
    </div>
  );
}
