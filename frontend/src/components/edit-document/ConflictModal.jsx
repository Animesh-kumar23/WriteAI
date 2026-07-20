import { useEffect } from "react";

function ConflictModal({ isOpen, conflictedOrders, onKeepMine, onUseServer }) {
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && isOpen) onKeepMine();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onKeepMine]);

  if (!isOpen) return null;

  return (
    <div className="overflow-y-auto fixed inset-0 z-50">
      <div className="min-h-screen px-4 py-8 flex justify-center items-center">
        <div onClick={onKeepMine} className="bg-black/50 backdrop-blur-sm fixed inset-0" aria-hidden="true" />
        <section role="dialog" aria-modal="true" aria-labelledby="conflict-modal-title" className="max-w-md w-full bg-slate-800 rounded-xl p-5 md:p-6 shadow-xl relative">
      <h3 id="conflict-modal-title" className="text-slate-50 text-base md:text-lg font-semibold mb-5">
        Edit Conflict Detected
      </h3>
      <p className="text-gray-600 dark:text-slate-400 mb-5">
        This document was edited in another tab or session while you were writing.
        Choose how to resolve the conflict.
      </p>

      <div className="space-y-3">
        <button
          type="button"
          onClick={onKeepMine}
          className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors duration-150"
        >
          <p className="font-medium text-gray-900 dark:text-slate-50 text-sm">Keep my version</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Overwrite the server with your local changes
          </p>
        </button>

        <button
          type="button"
          onClick={onUseServer}
          className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors duration-150"
        >
          <p className="font-medium text-gray-900 dark:text-slate-50 text-sm">Use server version</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Discard your local changes and load the latest saved content
          </p>
        </button>
      </div>

      <p className="text-xs text-gray-400 dark:text-slate-500 mt-4">
        {conflictedOrders?.length ?? 0} chunk(s) affected
      </p>
        </section>
      </div>
    </div>
  );
}

export default ConflictModal;
