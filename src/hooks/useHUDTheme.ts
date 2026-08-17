import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type HUDThemeId = 'azure' | 'crimson' | 'jade' | 'void';

export interface HUDTheme {
  id: HUDThemeId;
  name: string;
  swatch: string;          // hex for the UI swatch
  swatchAccent: string;    // secondary hex
  /** All CSS custom property overrides injected on :root */
  vars: Record<string, string>;
}

export const HUD_THEMES: HUDTheme[] = [
  {
    id: 'azure',
    name: 'Azure',
    swatch: '#0b84f3',
    swatchAccent: '#00e5ff',
    vars: {
      '--background':       '225 39% 3%',
      '--foreground':       '210 40% 96%',
      '--border':           '225 20% 14%',
      '--input':            '225 20% 12%',
      '--ring':             '213 95% 50%',
      '--primary':          '213 95% 50%',
      '--card':             '225 30% 6%',
      '--muted':            '225 20% 15%',
      '--muted-foreground': '215 15% 55%',
      '--hud-blue':         '213 95% 50%',
      '--hud-teal':         '180 85% 50%',
      '--hud-magenta':      '300 80% 55%',
      '--hud-amber':        '38 95% 55%',
      '--hud-green':        '145 75% 50%',
      '--hud-surface':      '225 30% 6%',
      '--hud-glass':        '225 25% 8%',
      '--hud-border':       '213 50% 25%',
      '--hud-glow':         '213 95% 60%',
      '--sidebar-background':'225 35% 4%',
    },
  },
  {
    id: 'crimson',
    name: 'Crimson',
    swatch: '#f03030',
    swatchAccent: '#ff8c00',
    vars: {
      '--background':       '0 30% 3%',
      '--foreground':       '15 30% 95%',
      '--border':           '0 18% 13%',
      '--input':            '0 18% 11%',
      '--ring':             '0 90% 52%',
      '--primary':          '0 90% 52%',
      '--card':             '0 25% 6%',
      '--muted':            '0 18% 14%',
      '--muted-foreground': '10 12% 54%',
      '--hud-blue':         '0 90% 52%',        // primary = crimson red
      '--hud-teal':         '22 100% 55%',      // accent = orange
      '--hud-magenta':      '340 85% 60%',      // pink-red
      '--hud-amber':        '38 100% 55%',      // kept amber
      '--hud-green':        '0 75% 48%',        // deep red
      '--hud-surface':      '0 25% 5%',
      '--hud-glass':        '0 22% 7%',
      '--hud-border':       '0 45% 22%',
      '--hud-glow':         '0 90% 60%',
      '--sidebar-background':'0 28% 4%',
    },
  },
  {
    id: 'jade',
    name: 'Jade',
    swatch: '#00c87a',
    swatchAccent: '#00ffe0',
    vars: {
      '--background':       '160 30% 3%',
      '--foreground':       '160 25% 95%',
      '--border':           '160 18% 13%',
      '--input':            '160 18% 11%',
      '--ring':             '155 90% 42%',
      '--primary':          '155 90% 42%',
      '--card':             '160 25% 6%',
      '--muted':            '160 18% 14%',
      '--muted-foreground': '160 12% 54%',
      '--hud-blue':         '155 90% 42%',      // jade green
      '--hud-teal':         '175 90% 48%',      // cyan-teal
      '--hud-magenta':      '135 75% 48%',      // forest green
      '--hud-amber':        '65 90% 50%',       // lime-yellow
      '--hud-green':        '145 80% 52%',
      '--hud-surface':      '160 25% 5%',
      '--hud-glass':        '160 22% 7%',
      '--hud-border':       '155 45% 20%',
      '--hud-glow':         '155 90% 55%',
      '--sidebar-background':'160 28% 4%',
    },
  },
  {
    id: 'void',
    name: 'Void',
    swatch: '#e8e8e8',
    swatchAccent: '#555555',
    vars: {
      '--background':       '0 0% 3%',
      '--foreground':       '0 0% 95%',
      '--border':           '0 0% 12%',
      '--input':            '0 0% 10%',
      '--ring':             '0 0% 70%',
      '--primary':          '0 0% 85%',
      '--card':             '0 0% 6%',
      '--muted':            '0 0% 14%',
      '--muted-foreground': '0 0% 50%',
      '--hud-blue':         '0 0% 82%',         // near-white
      '--hud-teal':         '0 0% 65%',         // mid-grey
      '--hud-magenta':      '0 0% 50%',         // grey
      '--hud-amber':        '0 0% 70%',
      '--hud-green':        '0 0% 75%',
      '--hud-surface':      '0 0% 5%',
      '--hud-glass':        '0 0% 7%',
      '--hud-border':       '0 0% 22%',
      '--hud-glow':         '0 0% 90%',
      '--sidebar-background':'0 0% 4%',
    },
  },
];

/** Map each theme to particle colors for PreviewCanvas */
export const THEME_PARTICLE_COLORS: Record<HUDThemeId, { primary: string; accent: string }> = {
  azure:   { primary: '#0b84f3', accent: '#00e5ff' },
  crimson: { primary: '#f03030', accent: '#ff8c00' },
  jade:    { primary: '#00c87a', accent: '#00ffe0' },
  void:    { primary: '#cccccc', accent: '#888888' },
};

// ── Context ─────────────────────────────────────────────────────────────────

export interface HUDThemeContextValue {
  activeTheme: HUDTheme;
  setTheme: (id: HUDThemeId) => void;
  particleColors: { primary: string; accent: string };
}

export const HUDThemeContext = createContext<HUDThemeContextValue>({
  activeTheme: HUD_THEMES[0],
  setTheme: () => {},
  particleColors: THEME_PARTICLE_COLORS.azure,
});

export function useHUDTheme() {
  return useContext(HUDThemeContext);
}

/** Apply a theme's CSS variables directly on :root */
export function applyThemeVars(theme: HUDTheme) {
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(theme.vars)) {
    root.style.setProperty(prop, value);
  }
}
