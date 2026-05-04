import React, { createContext, useContext, useState } from 'react';

export interface GlassTheme {
  blur: number;           // 0–100
  // 漸層色 1（起始色）
  r: number;              // 0–255
  g: number;
  b: number;
  opacity: number;        // 0–1
  // 漸層色 2（終止色）
  r2: number;
  g2: number;
  b2: number;
  opacity2: number;       // 0–1
  // 漸層角度 0–360
  angle: number;
  borderOpacity: number;  // 0–1
}

export const DEFAULT_GLASS: GlassTheme = {
  blur: 8,
  r: 255, g: 255, b: 255, opacity: 0.25,
  r2: 187, g2: 187, b2: 255, opacity2: 0.12,
  angle: 180,
  borderOpacity: 0.5,
};

interface GlassThemeCtx {
  theme: GlassTheme;
  update: (partial: Partial<GlassTheme>) => void;
}

const Ctx = createContext<GlassThemeCtx | null>(null);

export function GlassThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<GlassTheme>(DEFAULT_GLASS);
  const update = (partial: Partial<GlassTheme>) =>
    setTheme(prev => ({ ...prev, ...partial }));
  return <Ctx.Provider value={{ theme, update }}>{children}</Ctx.Provider>;
}

export function useGlassTheme(): GlassThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) return { theme: DEFAULT_GLASS, update: () => {} };
  // Merge with DEFAULT_GLASS so new fields always have a value even after hot-reload
  return { theme: { ...DEFAULT_GLASS, ...ctx.theme }, update: ctx.update };
}
