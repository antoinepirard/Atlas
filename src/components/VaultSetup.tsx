import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useVault } from './VaultProvider';

type SetupStep = 'password' | 'recovery';

function PasswordStrength({ password }: { password: string }) {
  const getStrength = (pwd: string): { level: number; label: string; color: string } => {
    if (pwd.length === 0) return { level: 0, label: '', color: 'bg-stone-200' };
    if (pwd.length < 8) return { level: 1, label: 'Too short', color: 'bg-red-400' };
    
    let score = 0;
    if (pwd.length >= 12) score++;
    if (pwd.length >= 16) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    
    if (score <= 1) return { level: 2, label: 'Weak', color: 'bg-orange-400' };
    if (score <= 3) return { level: 3, label: 'Good', color: 'bg-yellow-400' };
    return { level: 4, label: 'Strong', color: 'bg-green-500' };
  };
  
  const strength = getStrength(password);
  
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-colors ${
              level <= strength.level ? strength.color : 'bg-stone-200'
            }`}
          />
        ))}
      </div>
      {strength.label && (
        <p className={`text-xs ${
          strength.level <= 2 ? 'text-red-500' : 
          strength.level === 3 ? 'text-yellow-600' : 'text-green-600'
        }`}>
          {strength.label}
        </p>
      )}
    </div>
  );
}

function RecoveryPhraseDisplay({ 
  phrase, 
  onConfirm 
}: { 
  phrase: string[];
  onConfirm: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(phrase.join(' '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md space-y-6"
    >
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
          <ShieldCheckIcon className="w-8 h-8 text-amber-600" />
        </div>
        <h2 
          className="text-xl text-stone-700"
          style={{ fontFamily: "'Newsreader', 'Georgia', serif", fontStyle: 'italic' }}
        >
          Save your recovery phrase
        </h2>
        <p className="text-sm text-stone-500">
          Write these words down and store them safely. If you forget your password, this is the only way to recover your vault.
        </p>
      </div>
      
      <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
        <div className="grid grid-cols-3 gap-2">
          {phrase.map((word, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-stone-100"
            >
              <span className="text-xs text-stone-400 w-4">{index + 1}.</span>
              <span className="text-sm font-medium text-stone-700">{word}</span>
            </div>
          ))}
        </div>
        
        <button
          onClick={handleCopy}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-stone-600 hover:text-stone-900 transition-colors"
        >
          {copied ? (
            <>
              <CheckIcon className="w-4 h-4 text-green-500" />
              <span className="text-green-600">Copied!</span>
            </>
          ) : (
            <>
              <ClipboardDocumentIcon className="w-4 h-4" />
              <span>Copy to clipboard</span>
            </>
          )}
        </button>
      </div>
      
      <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
        <p className="text-xs text-amber-800">
          <strong>Important:</strong> Never share this phrase with anyone. Anyone with these words can access your vault. We cannot recover this phrase for you.
        </p>
      </div>
      
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative mt-0.5">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="sr-only"
          />
          <div className={`w-5 h-5 rounded border-2 transition-all ${
            confirmed 
              ? 'bg-stone-900 border-stone-900' 
              : 'border-stone-300 group-hover:border-stone-400'
          }`}>
            {confirmed && <CheckIcon className="w-4 h-4 text-white" />}
          </div>
        </div>
        <span className="text-sm text-stone-600">
          I have written down my recovery phrase and stored it securely
        </span>
      </label>
      
      <motion.button
        whileHover={{ scale: confirmed ? 1.02 : 1 }}
        whileTap={{ scale: confirmed ? 0.98 : 1 }}
        onClick={onConfirm}
        disabled={!confirmed}
        className={`w-full px-6 py-3 rounded-full text-sm font-medium transition-all ${
          confirmed
            ? 'bg-stone-900 text-white hover:bg-stone-800'
            : 'bg-stone-200 text-stone-400 cursor-not-allowed'
        }`}
      >
        Continue to my mind
      </motion.button>
    </motion.div>
  );
}

export function VaultSetup() {
  const { createVault } = useVault();
  const [step, setStep] = useState<SetupStep>('password');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  
  const isPasswordValid = password.length >= 8;
  const passwordsMatch = password === confirmPassword;
  const canCreate = isPasswordValid && passwordsMatch;
  
  const handleCreate = useCallback(async () => {
    if (!canCreate) return;
    
    setError('');
    setIsCreating(true);
    
    try {
      const phrase = await createVault(password);
      setRecoveryPhrase(phrase);
      setStep('recovery');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vault');
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  }, [canCreate, password, createVault]);
  
  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
      {/* Drag region for window */}
      <div data-tauri-drag-region className="fixed top-0 left-0 right-0 h-8" />
      <AnimatePresence mode="wait">
        {step === 'password' ? (
          <motion.div
            key="password"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md space-y-6"
          >
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                <LockClosedIcon className="w-8 h-8 text-amber-600" />
              </div>
              <h1 
                className="text-2xl text-stone-700"
                style={{ fontFamily: "'Newsreader', 'Georgia', serif", fontStyle: 'italic' }}
              >
                Create your vault
              </h1>
              <p className="text-sm text-stone-500">
                Your thoughts deserve privacy. Create a password to encrypt everything you save.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-stone-600">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full px-4 py-3 pr-12 bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <PasswordStrength password={password} />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-stone-600">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className={`w-full px-4 py-3 pr-12 bg-white border rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all ${
                      confirmPassword && !passwordsMatch 
                        ? 'border-red-300 focus:border-red-300' 
                        : 'border-stone-200 focus:border-stone-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    {showConfirm ? (
                      <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {confirmPassword && !passwordsMatch && (
                  <p className="text-xs text-red-500">Passwords don't match</p>
                )}
              </div>
            </div>
            
            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
            
            <motion.button
              whileHover={{ scale: canCreate && !isCreating ? 1.02 : 1 }}
              whileTap={{ scale: canCreate && !isCreating ? 0.98 : 1 }}
              onClick={handleCreate}
              disabled={!canCreate || isCreating}
              className={`w-full px-6 py-3 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                canCreate && !isCreating
                  ? 'bg-stone-900 text-white hover:bg-stone-800'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating vault...</span>
                </>
              ) : (
                <span>Create vault</span>
              )}
            </motion.button>
            
            <p className="text-xs text-center text-stone-400">
              Your password encrypts your data locally on your Mac. We never see or store your password.
            </p>
          </motion.div>
        ) : (
          <RecoveryPhraseDisplay
            key="recovery"
            phrase={recoveryPhrase}
            onConfirm={() => setRecoveryPhrase([])}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

