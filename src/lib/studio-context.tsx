import { createContext, useContext } from "react";

export type StudioCtx = {
  balance: number;
  brand: Record<string, unknown> | null;
  products: Array<Record<string, unknown>>;
  refresh: () => void;
};

export const StudioContext = createContext<StudioCtx | null>(null);

export function useStudio(): StudioCtx {
  const value = useContext(StudioContext);
  if (!value) throw new Error("MM Studio ainda não carregou o contexto.");
  return value;
}