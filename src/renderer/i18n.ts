import en from './locales/en.json'
import it from './locales/it.json'
export type Locale = 'en' | 'it'
export type CopyKey = keyof typeof en
export function translator(locale: Locale) {
  return (key: CopyKey): string => (locale === 'it' ? it : en)[key] ?? en[key]
}
