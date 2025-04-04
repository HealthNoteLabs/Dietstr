import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setupCapacitor, isNativeApp } from "./capacitor";

// Initialize Capacitor if running on mobile
document.addEventListener('DOMContentLoaded', () => {
  if (isNativeApp()) {
    setupCapacitor();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
