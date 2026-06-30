import { fpvI18n } from './i18n.js'

export function fmtNum(value: number, decimals = 1): string {
  return new Intl.NumberFormat(fpvI18n.locale === 'en' ? 'en-NZ' : fpvI18n.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value)
}
