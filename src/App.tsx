import { VaultProvider, useVault } from './components/VaultProvider';
import { VaultSetup } from './components/VaultSetup';
import { VaultUnlock } from './components/VaultUnlock';
import { MymindApp } from './components/MymindApp';

function VaultContent() {
  const { status, isLoading } = useVault();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-stone-200 border-t-stone-500 rounded-full animate-spin" />
          <p className="text-sm text-stone-400">Loading vault...</p>
        </div>
      </div>
    );
  }

  if (!status.exists) {
    return <VaultSetup />;
  }

  if (!status.unlocked) {
    return <VaultUnlock />;
  }

  return <MymindApp />;
}

export default function App() {
  return (
    <VaultProvider>
      <VaultContent />
    </VaultProvider>
  );
}

