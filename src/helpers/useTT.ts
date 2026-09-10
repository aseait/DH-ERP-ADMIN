import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export function useTT() {
  const { t, ...rest } = useTranslation();

  const tt = useCallback((key: string, options?: Record<string, any>): string => {
    let text = String((t as any)(key, options));

    if (options && typeof options === 'object') {
      Object.keys(options).forEach((k) => {
        const val = options[k] == null ? '' : String(options[k]);
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), val);
      });
    }

    return text;
  }, [t]);

  return { tt, t, ...rest };
}

type ServiceConfig = {
  [key: string]: string; // type -> translation key
};

/**
 * Build service labels from URL types
 */
export function buildServiceLabels(
  types: string[],
  tt: (key: string) => string,
  config: ServiceConfig,
  emptyKey: string
): string {
  const labels = types
    .map((t) => config[t])
    .filter(Boolean)
    .map((ttKey) => tt(ttKey));

  return labels.length ? labels.join(' + ') : tt(emptyKey);
}
