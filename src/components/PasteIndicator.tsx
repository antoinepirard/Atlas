import { motion, AnimatePresence } from "motion/react";

interface PasteIndicatorProps {
  isVisible: boolean;
}

export function PasteIndicator({ isVisible }: PasteIndicatorProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-3 px-5 py-3 bg-stone-900 text-white rounded-full shadow-xl">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-sm font-medium">Adding to your mind...</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
