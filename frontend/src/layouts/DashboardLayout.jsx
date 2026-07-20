import { useEffect, useState } from "react";
import { useAuthContext } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router";
import { LogoIcon, ProfileMenu } from "../components";

function DashboardLayout({ children }) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const { user, unauthenticateUser } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    const handleOutsideClicks = () => setIsProfileMenuOpen(false);
    document.addEventListener("click", handleOutsideClicks);
    return () => document.removeEventListener("click", handleOutsideClicks);
  }, [isProfileMenuOpen]);

  const handleSignout = () => {
    unauthenticateUser(() => navigate("/", { replace: true }));
  };

  return (
    <div className="h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      <header className="h-14 md:h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 px-4 md:px-6 flex justify-between items-center sticky top-0 z-20 shrink-0">
        {/* Logo section */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-x-2 md:gap-x-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 rounded-lg"
        >
          <LogoIcon
            size={32}
            className="transition-all duration-300 group-hover:scale-105 group-focus-visible:scale-105"
          />
          <span className="text-gray-900 dark:text-slate-50 font-bold text-lg md:text-xl">
            WriteAI
          </span>
        </Link>

        <div className="flex items-center gap-x-1">
          <ProfileMenu
            isOpen={isProfileMenuOpen}
            onToggle={(event) => {
              event.stopPropagation();
              setIsProfileMenuOpen(!isProfileMenuOpen);
            }}
            avatarUrl={user?.avatar || ""}
            username={user?.name || ""}
            email={user?.email || ""}
            signoutCallback={handleSignout}
          />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

export default DashboardLayout;
