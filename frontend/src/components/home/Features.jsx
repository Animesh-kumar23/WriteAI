import { createElement } from "react";
import { useAuthContext } from "../../contexts/AuthContext";
import { FEATURES } from "../../utils/constants";
import { Link } from "react-router";
import { ArrowRight, ChevronRight } from "lucide-react";

function Features() {
  const { isAuthenticated } = useAuthContext();

  return (
    <section
      id="features"
      className="bg-white dark:bg-slate-900 py-16 sm:py-20 lg:py-32 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-linear-to-b from-violet-50/50 via-transparent to-purple-50/50 dark:from-violet-950/30 dark:via-transparent dark:to-purple-950/30" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <header className="text-center mb-14 sm:mb-16 lg:mb-20">
          <div className="inline-flex items-center gap-2 bg-violet-100 dark:bg-violet-500/15 text-violet-900 dark:text-violet-300 rounded-full px-4 py-2 mb-5">
            <span className="size-2 rounded-full bg-violet-600 dark:bg-violet-400 animate-pulse" />
            <span className="text-sm font-semibold">Why WriteAI</span>
          </div>

          <h2 className="text-gray-900 dark:text-slate-50 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight px-4">
            Everything You Need to
            <br />
            <span className="text-gradient">Write Faster and Better</span>
          </h2>

          <p className="max-w-2xl mx-auto mt-5 px-4 text-gray-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
            AI-powered writing, editing, organization, and exports—built for
            people who actually create documents, not toy demos.
          </p>
        </header>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {FEATURES.map(
            ({ title, icon, description, bgGradientColors, shadowColor }) => (
              <li
                key={title}
                className="group relative bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-6 sm:p-7 transition-all duration-300 hover:-translate-y-1 hover:border-violet-200 dark:hover:border-violet-600 hover:shadow-xl hover:shadow-violet-500/10 dark:hover:shadow-violet-500/5"
              >
                <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-violet-50/0 to-purple-50/0 dark:from-violet-900/0 dark:to-purple-900/0 transition-all duration-300 group-hover:from-violet-50/50 group-hover:to-purple-50/50 dark:group-hover:from-violet-900/20 dark:group-hover:to-purple-900/20" />

                <div className="relative space-y-4">
                  <div
                    className={`size-14 rounded-xl bg-linear-to-br ${bgGradientColors} shadow-lg ${shadowColor} flex items-center justify-center transition-transform duration-300 group-hover:scale-105`}
                  >
                    {createElement(icon, { className: "size-7 text-white" })}
                  </div>

                  <div>
                    <h3 className="text-gray-900 dark:text-slate-50 text-lg sm:text-xl font-bold mb-3 group-hover:text-violet-900 dark:group-hover:text-violet-300 transition-colors">
                      {title}
                    </h3>

                    <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                      {description}
                    </p>
                  </div>

                  <Link
                    to={isAuthenticated ? "/dashboard" : "/login"}
                    className="inline-flex items-center gap-1 pt-2 text-violet-600 dark:text-violet-400 opacity-0 transition-all duration-300 group-hover:opacity-100"
                  >
                    <span className="text-sm font-medium">
                      {isAuthenticated ? "Open workspace" : "Get started"}
                    </span>
                    <ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </li>
            )
          )}
        </ul>

        <footer className="text-center mt-14 sm:mt-16">
          <p className="text-gray-600 dark:text-slate-400 text-sm sm:text-base mb-6">
            Ready to start writing with AI?
          </p>

          <Link
            to={isAuthenticated ? "/dashboard" : "/login"}
            className="inline-flex items-center gap-2 bg-linear-to-r from-violet-600 to-purple-600 text-white font-semibold text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4 rounded-xl shadow-lg shadow-violet-500/30 transition-all duration-200 hover:scale-101 hover:shadow-violet-500/50 group"
          >
            <span>
              {isAuthenticated ? "Go to Dashboard" : "Create Your First Document"}
            </span>
            <ArrowRight className="size-4 sm:size-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </footer>
      </div>
    </section>
  );
}

export default Features;
