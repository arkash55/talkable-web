
'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';

type AdvancedCtx = {
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
  toggle: () => void;
};

const Ctx = createContext<AdvancedCtx | null>(null);

export function AdvancedModeProvider({ children }: { children: React.ReactNode }) {
  const [advanced, setAdvanced] = useState(false); 

  const value = useMemo(
    () => ({
      advanced,
      setAdvanced,
      toggle: () => setAdvanced(v => !v),
    }),
    [advanced]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdvancedMode() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdvancedMode must be used within AdvancedModeProvider');
  return ctx;
}
