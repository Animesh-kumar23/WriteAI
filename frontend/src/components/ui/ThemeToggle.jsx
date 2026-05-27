import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

function ThemeToggle({ className = "" }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`relative size-9 rounded-full flex items-center justify-center transition-all duration-200
        text-gray-500 hover:text-amber-500 hover:bg-amber-50
        dark:text-slate-400 dark:hover:text-violet-400 dark:hover:bg-violet-400/10
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2
        dark:focus-visible:ring-offset-slate-900 ${className}`}
    >
      <Sun
        className={`size-[18px] absolute transition-all duration-300 ${
          isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-75"
        }`}
      />
      <Moon
        className={`size-[18px] absolute transition-all duration-300 ${
          isDark ? "opacity-0 -rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"
        }`}
      />
    </button>
  );
}

export default ThemeToggle;
