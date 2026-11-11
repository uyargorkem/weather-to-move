import {defineTheme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral';

// Rightmove's visual language, lifted from the saved property page's CSS:
// navy ink (#000433), teal core CTA (#00deb6 with navy text), dark-teal links
// (#107a84), #6c6d7f captions, #dedee2 hairlines, 4px cards / 8px buttons,
// Effra 400/500. Light mode only — the demo page has no dark mode.
export const rm = {
  navy: '#000433',
  navyHover: '#22254e',
  teal: '#00deb6',
  tealHover: '#24bca1',
  tealFocus: '#2cdebe',
  link: '#107a84',
  textSecondary: '#6c6d7f',
  placeholder: '#4e516b',
  border: '#dedee2',
  borderStrong: '#c3c4c9',
  tint: '#f6f8ff',
  grey: '#f2f3f4',
  periwinkle: '#9bb9f7',
  red: '#de0000',
  redText: '#c20000',
  redTint: '#faf3f3',
  tealTint: '#e6fbf7',
} as const;

const fontBody = 'Effra, Tahoma, sans-serif';

export const rightmoveTheme = defineTheme({
  name: 'rightmove',
  extends: neutralTheme,
  tokens: {
    '--font-family-body': fontBody,
    '--font-family-heading': fontBody,
    '--font-weight-semibold': '500',
    '--font-weight-bold': '500',

    '--color-text-primary': rm.navy,
    '--color-text-secondary': rm.textSecondary,
    '--color-text-accent': rm.link,
    '--color-icon-primary': rm.navy,
    '--color-icon-secondary': rm.textSecondary,
    '--color-icon-accent': rm.link,
    '--color-accent': rm.link,
    '--color-accent-muted': rm.tealTint,
    '--color-on-accent': '#ffffff',

    '--color-background-body': '#ffffff',
    '--color-background-surface': '#ffffff',
    '--color-background-card': '#ffffff',
    '--color-background-popover': '#ffffff',
    '--color-background-muted': rm.tint,
    '--color-border': rm.border,
    '--color-border-emphasized': rm.borderStrong,
    '--color-skeleton': rm.grey,

    '--color-error': rm.red,
    '--color-text-error': rm.redText,

    '--radius-inner': '2px',
    '--radius-element': '4px',
    '--radius-container': '4px',
    '--radius-page': '8px',
  },
  components: {
    button: {
      base: {borderRadius: '8px', fontWeight: '500', letterSpacing: '.1px'},
      'variant:primary': {backgroundColor: rm.teal, color: rm.navy},
      'variant:secondary': {backgroundColor: '#ffffff', color: rm.navy, borderColor: rm.navy},
    },
    card: {
      base: {borderRadius: '4px', borderColor: rm.border},
    },
    // Repurposed as delta badges: teal = better than London, red = worse, gray = about the same.
    badge: {
      base: {fontWeight: '500', letterSpacing: '.1px'},
      'variant:teal': {backgroundColor: rm.tealTint, color: rm.link},
      'variant:red': {backgroundColor: rm.redTint, color: rm.redText},
      'variant:gray': {backgroundColor: rm.grey, color: rm.placeholder},
    },
    link: {
      base: {color: rm.link, textDecoration: 'underline', fontWeight: '500'},
    },
  },
});
