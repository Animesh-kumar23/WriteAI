import { useState } from "react";
import { useAuthContext } from "../contexts/AuthContext";
import { Link, useNavigate, useLocation } from "react-router";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { LogoIcon } from "../components";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import { validateEmail, validatePassword } from "../utils/helpers";

function SignInPage() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const { authenticateUser } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  // get the page user was trying to access, default to dashboard
  // see ProtectedRoute.jsx
  const fromPath = location.state?.from?.pathname || "/dashboard";

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = (trimmedData) => {
    const emailError = validateEmail(trimmedData.email);
    const passwordError = validatePassword(trimmedData.password);

    setErrors({
      email: emailError,
      password: passwordError,
    });

    return !emailError && !passwordError;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedData = {
      email: formData.email.trim(),
      password: formData.password.trim(),
    };

    if (!validateForm(trimmedData)) {
      return;
    }

    setIsLoading(true);

    try {
      const { data } = await axiosInstance.post(
        API_ENDPOINTS.AUTH.LOGIN,
        trimmedData
      );

      authenticateUser(data.user);

      toast.success("Welcome back!");

      navigate(fromPath, { replace: true });
    } catch (error) {
      console.error("Error signing in:", error?.message);

      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Sign in failed. Please try again.";

      toast.error(errorMessage, { duration: 5000 });

      setErrors((prev) => ({
        ...prev,
        password: errorMessage,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 flex justify-center items-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="mx-auto mb-3 sm:mb-4 flex justify-center">
            <LogoIcon size={56} />
          </div>

          <h1 className="text-slate-900 dark:text-slate-50 text-2xl sm:text-3xl font-bold">
            Welcome Back
          </h1>

          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mt-2">
            Sign in to continue from where you left off.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 sm:p-8 shadow-lg dark:shadow-black/30">
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-y-5 sm:gap-y-6"
          >
            <div className="w-full grid grid-cols-1 gap-y-2">
              <label
                htmlFor="email"
                className="text-gray-700 dark:text-slate-300 text-sm font-medium"
              >
                <span>Email</span>
                <span className="text-red-500">*</span>
              </label>

              <div className="relative">
                <div className="pl-3 flex justify-center items-center pointer-events-none absolute inset-y-0 left-0">
                  <Mail className="size-4 text-gray-400 dark:text-slate-500" />
                </div>

                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="email@example.com"
                  className={`w-full h-11 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-50 text-sm placeholder-gray-400 dark:placeholder-slate-500 px-3 py-2 border rounded-xl pl-10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed ${
                    errors.email
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-200 dark:border-slate-700 focus:border-transparent"
                  }`}
                  aria-invalid={errors.email ? "true" : "false"}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
              </div>

              {errors.email && (
                <p
                  id="email-error"
                  className="text-red-600 dark:text-red-400 text-xs mt-1"
                  role="alert"
                >
                  {errors.email}
                </p>
              )}
            </div>

            <div className="w-full grid grid-cols-1 gap-y-2">
              <label
                htmlFor="password"
                className="text-gray-700 dark:text-slate-300 text-sm font-medium"
              >
                <span>Password</span>
                <span className="text-red-500">*</span>
              </label>

              <div className="relative">
                <div className="pl-3 flex justify-center items-center pointer-events-none absolute inset-y-0 left-0">
                  <LockKeyhole className="size-4 text-gray-400 dark:text-slate-500" />
                </div>

                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                  className={`w-full h-11 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-50 text-sm placeholder-gray-400 dark:placeholder-slate-500 px-3 py-2 border rounded-xl pl-10 pr-10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed ${
                    errors.password
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-200 dark:border-slate-700 focus:border-transparent"
                  }`}
                  aria-invalid={errors.password ? "true" : "false"}
                  aria-describedby={errors.password ? "password-error" : undefined}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 focus:outline-none focus:text-violet-600 transition-colors duration-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>

              {errors.password && (
                <p
                  id="password-error"
                  className="text-red-600 dark:text-red-400 text-xs mt-1"
                  role="alert"
                >
                  {errors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              aria-label={isLoading ? "Signing in..." : "Sign in"}
              className="w-full font-medium whitespace-nowrap inline-flex justify-center items-center gap-2 transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed bg-linear-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:from-violet-700 hover:to-purple-700 focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 text-sm px-4 py-2.5 rounded-xl"
            >
              {isLoading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </form>

          <p className="text-slate-600 dark:text-slate-400 text-center text-xs sm:text-sm mt-6 sm:mt-8">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-violet-600 dark:text-violet-400 font-medium transition-all duration-200 hover:text-violet-700 dark:hover:text-violet-300 hover:underline focus-visible:text-violet-700 focus-visible:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default SignInPage;
