import { X } from "lucide-react";
import { useEffect } from "react";

function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="overflow-y-auto fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="min-h-screen px-4 py-8 flex justify-center items-center">
        <div
          onClick={onClose}
          className="bg-black/50 backdrop-blur-sm fixed inset-0 animate-in fade-in duration-200"
          aria-hidden="true"
        />

        {/* Modal container */}
        <article
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="max-w-md w-full bg-white dark:bg-slate-800 text-left rounded-xl p-5 md:p-6 shadow-xl dark:shadow-black/40 relative animate-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <header className="mb-4 md:mb-5 flex justify-between items-start gap-x-4">
            <h3
              id="modal-title"
              className="text-gray-900 dark:text-slate-50 text-base md:text-lg font-semibold pr-8"
            >
              {title}
            </h3>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="text-gray-400 dark:text-slate-500 rounded-lg p-1.5 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-600 dark:hover:text-slate-300 focus-visible:bg-gray-100 dark:focus-visible:bg-slate-700 focus-visible:text-gray-600 dark:focus-visible:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 absolute top-4 md:top-5 right-4 md:right-5"
            >
              <X className="size-4 md:size-5" />
            </button>
          </header>

          {/* Content area */}
          <div className="text-sm md:text-base">{children}</div>
        </article>
      </div>
    </div>
  );
}

export default Modal;
