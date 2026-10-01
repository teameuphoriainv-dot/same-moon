import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Read once, when `npx cap sync ios` runs, and baked into the native project.
 * Set it to the deployed web app (https) or a LAN dev server such as
 * http://192.168.1.20:8931. Unset, the app opens the bundled offline page.
 */
const serverUrl = process.env.CAP_SERVER_URL?.trim() || undefined;

const config: CapacitorConfig = {
  appId: "com.samemoon.app",
  appName: "Same Moon",
  webDir: "native-shell",
  backgroundColor: "#0a0f1c",
  ios: {
    // The page already pads for the notch and home bar with safe-area insets.
    contentInset: "never",
  },
  // Tradeoff: the shell loads the hosted web app instead of bundling it, since the Next API routes rule out a static export tonight.
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: serverUrl.startsWith("http://"),
        // Shown from the bundle when the hosted app cannot be reached.
        errorPath: "index.html",
      }
    : undefined,
};

export default config;
