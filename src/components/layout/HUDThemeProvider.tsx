import { useState, useCallback, useEffect } from 'react';
import {
  HUDThemeContext,
  HUD_THEMES,
  THEME_PARTICLE_COLORS,
  applyThemeVars,
  type HUDThemeId,
} from '@/hooks/useHUDTheme';

interface HUDThemeProviderProps {
  children: React.ReactNode;
}

const STORAGE_KEY = 'lyricforge-hud-theme';

export function HUDThemeProvider({ children }: HUDThemeProviderProps) {
  const [activeThemeId, setActiveThemeId] = useState<HUDThemeId>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as HUDThemeId | null;
    return stored ?? 'azure';
  });

  const activeTheme = HUD_THEMES.find(t => t.id === activeThemeId) ?? HUD_THEMES[0];

  // Apply vars on mount + whenever theme changes
  useEffect(() => {
    applyThemeVars(activeTheme);
    console.log(`[HUDTheme] Applied theme: ${activeTheme.name}`);
  }, [activeTheme]);

  const setTheme = useCallback((id: HUDThemeId) => {
    setActiveThemeId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  return (
    <HUDThemeContext.Provider
      value={{
        activeTheme,
        setTheme,
        particleColors: THEME_PARTICLE_COLORS[activeThemeId],
      }}
    >
      {children}
    </HUDThemeContext.Provider>
  );
}
