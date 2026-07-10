import { useEffect, useRef, useState } from "react";

export default function Dropdown({
  trigger,
  children,
  contentClassName = "",
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownContainerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClicks = (event) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) document.addEventListener("mousedown", handleOutsideClicks);
    return () => document.removeEventListener("mousedown", handleOutsideClicks);
  }, [isOpen]);

  useEffect(() => {
    if (!disabled) return undefined;

    const frame = requestAnimationFrame(() => setIsOpen(false));
    return () => cancelAnimationFrame(frame);
  }, [disabled]);

  const toggleDropdown = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  return (
    <div ref={dropdownContainerRef} className="relative">
      <div
        onClick={toggleDropdown}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleDropdown();
          }
        }}
        role="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        className="inline-flex focus:outline-none focus-visible:outline-none"
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className={`w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg mt-2 shadow-lg dark:shadow-black/30 absolute right-0 z-20 animate-in fade-in slide-in-from-top duration-200 origin-top-right focus:outline-none overflow-hidden ${contentClassName}`}
        >
          <div role="none" className="py-1">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export const DropdownItem = ({ children, onClick, disabled = false }) => {
  const handleClick = (event) => {
    if (disabled) return;
    onClick?.(event);
  };

  const handleKeyDown = (event) => {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.(event);
    }
  };

  return (
    <button
      type="button"
      role="menuitem"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      className={`w-full text-slate-700 dark:text-slate-300 px-4 py-2 text-sm text-left flex items-center gap-2 transition-colors duration-200 ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-slate-100 dark:hover:bg-slate-700 focus-visible:bg-slate-100 dark:focus-visible:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500"
      }`}
    >
      {children}
    </button>
  );
};
