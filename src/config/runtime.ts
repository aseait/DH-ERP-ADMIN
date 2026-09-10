type AppConfig = { API_BASE?: string };
declare global {
  interface Window {
    __APP_CONFIG__?: AppConfig;
  }
}

const cfg = (typeof window !== 'undefined' && window.__APP_CONFIG__) || {};
export const API_BASE = (cfg.API_BASE || '').replace(/\/+$/, '');
