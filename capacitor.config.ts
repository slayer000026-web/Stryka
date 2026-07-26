import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stryka.coach',
  appName: 'Stryka Coach',
  webDir: '.',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0a0a0a",
      showSpinner: false
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0a0a"
    }
  }
};

export default config;
