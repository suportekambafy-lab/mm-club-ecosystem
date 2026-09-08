import { useEffect, useState } from "react";
import { getViewAs, subscribeViewAs, type ViewAsTarget } from "@/lib/admin/view-as";

/** Conta que o admin escolheu "ver como cliente" (null em uso normal). */
export function useViewAs(): ViewAsTarget | null {
  const [target, setTarget] = useState<ViewAsTarget | null>(null);

  useEffect(() => {
    const read = () => setTarget(getViewAs());
    read();
    return subscribeViewAs(read);
  }, []);

  return target;
}
