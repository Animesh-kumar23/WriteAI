import "./index.css";
import { StrictMode } from "react";
import { AuthContextProvider } from "./contexts/AuthContext";
import { ThemeContextProvider } from "./contexts/ThemeContext";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import router from "./routes/router";
import ThemedToaster from "./components/ThemedToaster";

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
