import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { L } from "@/lib/language-guide";
import { trackUx } from "@/lib/ux-analytics";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Zona da app, para métricas anónimas. */
  surface?: string;
  /** Ação concreta, para métricas anónimas. */
  action?: string;
};

/**
 * Substitui window.confirm() por um diálogo consistente com a app.
 *
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   onClick={async () => { if (await confirm({ title: "Eliminar?" })) run(); }}
 *   ...
 *   {dialog}
 */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setOpen(true);
    trackUx("dialog_opened", { surface: opts.surface, action: opts.action });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback(
    (value: boolean) => {
      trackUx(value ? "dialog_confirmed" : "dialog_cancelled", {
        surface: options?.surface,
        action: options?.action,
      });
      resolver.current?.(value);
      resolver.current = null;
      setOpen(false);
    },
    [options],
  );

  const dialog = (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && open) settle(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {options?.description ?? L.irreversible}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>
            {options?.cancelLabel ?? L.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => settle(true)}
            className={
              options?.destructive === false
                ? undefined
                : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            }
          >
            {options?.confirmLabel ?? L.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
