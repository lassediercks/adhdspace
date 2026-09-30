import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests',
  testMatch:'**/*.spec.js',
  timeout:60000,
  workers:1,
  use:{viewport:{width:1440,height:1000},launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']}},
  webServer:{command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI},
});
