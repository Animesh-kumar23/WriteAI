import { useAuthContext } from "../../contexts/AuthContext";
import { Link } from "react-router";
import LogoIcon from "../LogoIcon";

const socials = [
  {
    href: "https://github.com/Animesh-kumar23/WriteAI",
    ariaLabel: "Visit the WriteAI GitHub repository",
    imgSrc: "/social-icons/github.svg",
  },
  {
    href: "https://www.linkedin.com/in/animesh-kumar-78620217b/",
    ariaLabel: "Visit my LinkedIn",
    imgSrc: "/social-icons/linkedin.svg",
  },
];

function SocialButton({ href, ariaLabel, imgSrc }) {
  const cls =
    "size-9 sm:size-10 bg-white/5 backdrop-blur-sm rounded-lg inline-flex justify-center items-center transition-all duration-200 hover:bg-violet-600 hover:scale-101 focus-visible:bg-violet-600 focus-visible:scale-101";

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel} className={cls}>
      <img src={imgSrc} alt="" className="size-4 sm:size-5 brightness-0 invert" />
    </a>
  );
}

function Footer() {
  const { isAuthenticated } = useAuthContext();

  return (
    <footer className="bg-linear-to-br from-gray-950 via-gray-950 to-violet-950 text-white overflow-hidden relative">
      {/* Subtle decorative background pattern */}
      <div className="opacity-5 absolute inset-0 pointer-events-none">
        <div className="size-96 bg-violet-500 rounded-full blur-3xl absolute top-0 right-0" />
      </div>

      <div className="max-w-7xl px-6 lg:px-8 mx-auto relative">
        {/* Footer content */}
        <div className="py-12 sm:py-14 lg:py-16 grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Branding */}
          <div className="lg:col-span-2 space-y-5 sm:space-y-6">
            {/* Logo */}
            <a
              href="/"
              className="inline-flex items-center gap-x-2.5 group w-fit"
            >
              <span className="size-9 sm:size-10 bg-linear-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/30 inline-flex justify-center items-center transition-all duration-300 group-hover:shadow-violet-500/50 group-hover:scale-105 group-focus-visible:shadow-violet-500/50 group-focus-visible:scale-105">
                <LogoIcon className="size-4 sm:size-5 text-white" />
              </span>

              <span className="text-lg sm:text-xl font-semibold tracking-tight">
                WriteAI
              </span>
            </a>

            <div className="space-y-2">
              <p className="max-w-md text-gray-400 text-sm sm:text-base leading-relaxed">
                Helping writers think, draft, and create with AI assistance.
              </p>

              <a
                href="mailto:animeshkumar.bgs@gmail.com"
                className="text-violet-400 text-sm sm:text-base transition-colors duration-200 hover:text-violet-300"
              >
                animeshkumar.bgs@gmail.com
              </a>
            </div>

            {/* Social links */}
            <ul className="pt-2 flex items-center gap-x-3">
              {socials.map((social, index) => (
                <li key={index}>
                  <SocialButton {...social} />
                </li>
              ))}
            </ul>
          </div>

          {/* Quick links */}
          <nav className="lg:col-span-1 lg:justify-self-end">
            <h3 className="text-white text-sm font-semibold mb-4">
              Quick Links
            </h3>

            <ul className="space-y-2">
              <li>
                <Link
                  to={isAuthenticated ? "/dashboard" : "/login"}
                  className="text-gray-400 text-sm transition-colors duration-300 hover:text-violet-400 focus-visible:text-violet-400 inline-block"
                >
                  Jump In
                </Link>
              </li>

              <li>
                <a
                  href="#features"
                  className="text-gray-400 text-sm transition-colors duration-300 hover:text-violet-400 focus-visible:text-violet-400 inline-block"
                >
                  Features
                </a>
              </li>
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-y-3 sm:gap-y-0">
            <p className="text-gray-400 text-xs sm:text-sm text-center sm:text-left">
              &copy; {new Date().getFullYear()} WriteAI — Licensed under the{" "}
              <a
                href="https://github.com/Animesh-kumar23/WriteAI/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 transition-colors hover:text-violet-400 focus-visible:text-violet-400"
              >
                Apache 2.0 License
              </a>
            </p>

            <p className="text-gray-500 text-xs sm:text-sm flex items-center gap-x-1.5">
              <span>Crafted with</span>
              <span className="text-violet-400 text-base">💜</span>
              <span>
                by{" "}
                <a
                  href="https://github.com/Animesh-kumar23"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white transition-all duration-200 hover:underline focus-visible:underline"
                >
                  AnimeshKumar
                </a>
              </span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
