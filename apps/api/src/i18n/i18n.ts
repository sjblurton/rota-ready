import { createInstance } from 'i18next';
import { en } from './en.js';

const i18n = createInstance();
await i18n.init({
  lng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
});

export const t = i18n.t.bind(i18n);
