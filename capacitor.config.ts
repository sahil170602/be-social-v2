import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.your.appid',
  appName: 'Be Social',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  // --- ADD THIS SECTION ---
  plugins: {
    SplashScreen: {
      launchShowDuration: 0, // Set to 0 to hide it immediately
      backgroundColor: "#0a0a0a", // Match your app background
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;