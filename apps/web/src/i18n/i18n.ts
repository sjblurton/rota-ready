import { VENUE_NAME_MAX_LENGTH } from '@rota-ready/shared';
import i18n, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import { pseudoLocalise } from './pseudo';

const resources: Resource = { en: { translation: en } };
let lng = 'en';

if (
  import.meta.env.DEV &&
  new URLSearchParams(globalThis.location?.search).get('lng') === 'pseudo'
) {
  resources.pseudo = { translation: pseudoLocalise(en) };
  lng = 'pseudo';
}

await i18n.use(initReactI18next).init({
  lng,
  fallbackLng: 'en',
  resources,
  interpolation: {
    escapeValue: false,
    defaultVariables: { venueNameMaxLength: VENUE_NAME_MAX_LENGTH },
  },
});

export { i18n };
