import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.healthnotelabs.dietstr',
  appName: 'Dietstr',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  },
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'app'
  }
};

export default config;