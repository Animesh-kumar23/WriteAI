import { Toaster } from "sonner";
import { useTheme } from "../contexts/ThemeContext";

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster position="bottom-right" richColors theme={theme} />;
}

export default ThemedToaster;
