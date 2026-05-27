import "./index.css";
import { StrictMode } from "react";
import { AuthContextProvider } from "./contexts/AuthContext";
import { ThemeContextProvider, useTheme } from "./contexts/ThemeContext";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import router from "./routes/router";
import { Toaster } from "sonner";

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster position="bottom-right" richColors theme={theme} />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeContextProvider>
      <AuthContextProvider>
        <RouterProvider router={router} />
        <ThemedToaster />
      </AuthContextProvider>
    </ThemeContextProvider>
  </StrictMode>
);
