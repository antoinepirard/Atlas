import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useVault } from './VaultProvider';

type UnlockMode = 'password' | 'recovery';

function RecoveryPhraseInput({
  onBack,
  onReset,
}: {
  onBack: () => void;
  onReset: () => void;
}) {
  const { unlockWithPhrase } = useVault();
  const [words, setWords] = useState<string[]>(Array(12).fill(''));
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState('');
  const [showReset, setShowReset] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleWordChange = (index: number, value: string) => {
    if (value.includes(' ')) {
      const pastedWords = value.trim().toLowerCase().split(/\s+/);
      if (pastedWords.length === 12) {
        setWords(pastedWords);
        inputRefs.current[11]?.focus();
        return;
      }
    }

    const newWords = [...words];
    newWords[index] = value.toLowerCase().trim();
    setWords(newWords);
    setError('');

    if (value && !value.includes(' ') && index < 11) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !words[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleUnlock = async () => {
    const phrase = words.filter((w) => w.trim());
    if (phrase.length !== 12) {
      setError('Please enter all 12 words');
      return;
    }

    setIsUnlocking(true);
    setError('');

    try {
      const success = await unlockWithPhrase(phrase);
      if (!success) {
        setError('Invalid recovery phrase. Please check your words and try again.');
      }
    } catch {
      setError('Failed to unlock. Please try again.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const filledWords = words.filter((w) => w.trim()).length;
  const canUnlock = filledWords === 12;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-lg space-y-6"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to password
      </button>

      <div className="text-center space-y-2">
        <h2
          className="text-xl text-stone-700"
          style={{ fontFamily: "'Newsreader', 'Georgia', serif", fontStyle: 'italic' }}
        >
          Enter recovery phrase
        </h2>
        <p className="text-sm text-stone-500">
          Enter the 12 words you saved when creating your vault
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {words.map((word, index) => (
          <div key={index} className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 w-4">
              {index + 1}.
            </span>
            <input
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              value={word}
              onChange={(e) => handleWordChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-full pl-8 pr-3 py-2.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-all"
              placeholder="word"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <ExclamationTriangleIcon className="w-4 h-4" />
          {error}
        </div>
      )}

      <motion.button
        whileHover={{ scale: canUnlock && !isUnlocking ? 1.02 : 1 }}
        whileTap={{ scale: canUnlock && !isUnlocking ? 0.98 : 1 }}
        onClick={handleUnlock}
        disabled={!canUnlock || isUnlocking}
        className={`w-full px-6 py-3 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 ${
          canUnlock && !isUnlocking
            ? 'bg-stone-900 text-white hover:bg-stone-800'
            : 'bg-stone-200 text-stone-400 cursor-not-allowed'
        }`}
      >
        {isUnlocking ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Unlocking...</span>
          </>
        ) : (
          <span>Unlock vault</span>
        )}
      </motion.button>

      <div className="pt-4 border-t border-stone-200">
        {!showReset ? (
          <button
            onClick={() => setShowReset(true)}
            className="w-full text-sm text-stone-400 hover:text-stone-600 transition-colors"
          >
            Lost your recovery phrase?
          </button>
        ) : (
          <div className="space-y-3">
            <div className="p-4 bg-red-50 rounded-xl border border-red-100">
              <p className="text-sm text-red-700">
                <strong>Warning:</strong> Without your password or recovery phrase, your data cannot be recovered. Resetting will permanently delete all your saved content.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowReset(false)}
                className="flex-1 px-4 py-2 text-sm text-stone-600 hover:text-stone-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onReset}
                className="flex-1 px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Reset vault
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function VaultUnlock() {
  const { unlock, resetVault } = useVault();
  const [mode, setMode] = useState<UnlockMode>('password');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleUnlock = useCallback(async () => {
    if (!password.trim()) return;

    setIsUnlocking(true);
    setError('');

    try {
      const success = await unlock(password);
      if (!success) {
        setAttempts((prev) => prev + 1);
        setError('Incorrect password');
        setPassword('');
        inputRef.current?.focus();
      }
    } catch {
      setError('Failed to unlock. Please try again.');
    } finally {
      setIsUnlocking(false);
    }
  }, [password, unlock]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleUnlock();
    }
  };

  const handleReset = async () => {
    await resetVault();
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
      <AnimatePresence mode="wait">
        {mode === 'password' ? (
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
                Unlock your mind
              </h1>
              <p className="text-sm text-stone-500">
                Enter your password to access your saved thoughts
              </p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter your password"
                  className={`w-full px-4 py-3 pr-12 bg-white border rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all ${
                    error ? 'border-red-300 focus:border-red-300' : 'border-stone-200 focus:border-stone-300'
                  }`}
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
              {error && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  {error}
                </p>
              )}
            </div>

            <motion.button
              whileHover={{ scale: password && !isUnlocking ? 1.02 : 1 }}
              whileTap={{ scale: password && !isUnlocking ? 0.98 : 1 }}
              onClick={handleUnlock}
              disabled={!password || isUnlocking}
              className={`w-full px-6 py-3 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                password && !isUnlocking
                  ? 'bg-stone-900 text-white hover:bg-stone-800'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              {isUnlocking ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Unlocking...</span>
                </>
              ) : (
                <span>Unlock</span>
              )}
            </motion.button>

            {attempts >= 2 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-center"
              >
                <button
                  onClick={() => setMode('recovery')}
                  className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
                >
                  Forgot your password? Use recovery phrase
                </button>
              </motion.div>
            )}

            {attempts < 2 && (
              <button
                onClick={() => setMode('recovery')}
                className="w-full text-sm text-stone-400 hover:text-stone-600 transition-colors"
              >
                Use recovery phrase instead
              </button>
            )}
          </motion.div>
        ) : (
          <RecoveryPhraseInput
            key="recovery"
            onBack={() => setMode('password')}
            onReset={handleReset}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

