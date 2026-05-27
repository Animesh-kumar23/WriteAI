import { Quote } from "lucide-react";
import { TESTIMONIALS } from "../../utils/constants";

const Testimonials = () => (
  <article
    id="testimonials"
    className="bg-linear-to-br from-violet-50 via-purple-50 to-white dark:from-slate-950 dark:via-violet-950 dark:to-slate-900 py-16 sm:py-20 lg:py-32 overflow-hidden relative"
  >
    {/* Decorative bg elements */}
    <div className="size-64 bg-violet-200/30 dark:bg-violet-500/10 backdrop-blur-3xl rounded-full absolute top-20 right-10 animate-pulse" />
    <div className="size-96 bg-purple-200/20 dark:bg-purple-500/10 backdrop-blur-3xl rounded-full absolute bottom-20 left-10 animate-pulse delay-700" />

    <div className="max-w-7xl px-6 lg:px-8 mx-auto relative">
      {/* Header */}
      <header className="text-center space-y-4 mb-12 sm:mb-16 lg:mb-20">
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-violet-100 dark:border-violet-700 rounded-full px-4 py-2 shadow-sm inline-flex items-center w-fit mx-auto">
          <span className="text-violet-900 dark:text-violet-300 text-sm font-semibold">
            Testimonials
          </span>
        </div>

        <h2 className="text-gray-900 dark:text-slate-50 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight px-4">
          What Users Could Say
          <br />
          <span className="text-gradient">About Write AI</span>
        </h2>

        <p className="max-w-2xl text-gray-600 dark:text-slate-400 text-sm sm:text-base lg:text-lg leading-relaxed mx-auto px-4">
          A preview of how customer feedback can be showcased once real users start
          using the platform.
        </p>
      </header>

      {/* Testimonials grid */}
      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {TESTIMONIALS.map(({ username, designation, quote, avatarSrc }) => (
          <li
            key={username}
            className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-6 sm:p-7 lg:p-8 border border-gray-100 dark:border-slate-700 relative group transition-all duration-300 hover:border-violet-200 dark:hover:border-violet-600 hover:shadow-2xl hover:shadow-violet-500/10 dark:hover:shadow-violet-500/5 hover:-translate-y-2"
          >
            {/* Quote icon */}
            <div className="size-10 sm:size-12 bg-linear-to-br from-violet-500 to-purple-600 rounded-xl sm:rounded-2xl shadow-lg shadow-violet-500/30 flex items-center justify-center absolute -left-3 sm:-left-4 -top-3 sm:-top-4 rotate-6">
              <Quote className="size-5 sm:size-6 text-white" />
            </div>

            {/* Demo badge */}
            <div className="mb-5 inline-flex rounded-full border border-violet-200 dark:border-violet-700 bg-violet-50 dark:bg-violet-500/10 px-3 py-1">
              <span className="text-xs font-semibold text-violet-700 dark:text-violet-400">
                DEMO ONLY
              </span>
            </div>

            {/* Placeholder quote */}
            <blockquote className="text-gray-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed mb-6 sm:mb-8">
              &ldquo;{quote}&rdquo;
            </blockquote>

            {/* Author info */}
            <footer className="flex items-center gap-x-3 sm:gap-x-4">
              <div className="relative shrink-0">
                <div className="bg-linear-to-br from-violet-500 to-purple-600 rounded-full opacity-20 absolute inset-0 blur-sm" />
                <img
                  src={avatarSrc}
                  alt={username}
                  className="size-12 sm:size-14 object-cover rounded-full ring-2 ring-white dark:ring-slate-700 shadow-lg relative"
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-gray-900 dark:text-slate-50 text-sm sm:text-base font-semibold truncate">
                  {username}
                </p>
                <p className="text-gray-500 dark:text-slate-400 text-xs sm:text-sm truncate">
                  {designation}
                </p>
              </div>
            </footer>

            {/* Hover overlay */}
            <div className="bg-linear-to-br from-violet-50/0 to-purple-50/0 dark:from-violet-900/0 dark:to-purple-900/0 rounded-2xl sm:rounded-3xl absolute inset-0 -z-10 transition-colors duration-300 group-hover:from-violet-50/50 group-hover:to-purple-50/30 dark:group-hover:from-violet-900/20 dark:group-hover:to-purple-900/10" />
          </li>
        ))}
      </ul>
    </div>
  </article>
);

export default Testimonials;
