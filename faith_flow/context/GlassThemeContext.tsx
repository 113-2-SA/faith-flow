import React, { createContext, useContext, useState } from 'react';

export interface GlassTheme {
  blur: number;
  r: number; g: number; b: number; opacity: number;
  r2: number; g2: number; b2: number; opacity2: number;
  r3: number; g3: number; b3: number; opacity3: number;
  angle: number;
  borderOpacity: number;
  borderR: number; borderG: number; borderB: number;
}

// #B3CADA → #75859B → #415367, CSS 60° (lower-left to upper-right), blur 15, border #C2D4FF@50%
export const DEFAULT_GLASS: GlassTheme = {
  blur: 15,
  r: 179, g: 202, b: 218, opacity: 0.1,    // #B3CADA
  r2: 117, g2: 133, b2: 155, opacity2: 0.1,// #75859B
  r3: 65,  g3: 83,  b3: 103, opacity3: 0.1,// #415367
  angle: 30,                                // CSS 60°: lower-left → upper-right
  borderOpacity: 0.5,
  borderR: 194, borderG: 212, borderB: 255, // #C2D4FF
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
  return { theme: { ...DEFAULT_GLASS, ...ctx.theme }, update: ctx.update };
}
