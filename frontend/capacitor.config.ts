import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.phimtnui.mobitv',
  appName: 'PHIMTNUI',
  webDir: '../dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: ['*'],
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0E0E10',
  },
};

export default config;
