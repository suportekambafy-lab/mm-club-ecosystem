// Sinal global: esconde chrome (widget de suporte, barra inferior) enquanto
// qualquer modal/pop-up estiver aberto.
const subscribers = new Set<() => void>();
let count = 0;

function emit() {
  for (const cb of subscribers) cb();
}

export function setQuizModalOpen(value: boolean) {
  const next = value ? Math.max(count, 1) : 0;
  if (next === count) return;
  count = next;
  emit();
}

/** Registra um overlay aberto. Devolve a função para o remover. */
export function pushOverlay() {
  count += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    count = Math.max(0, count - 1);
    emit();
  };
}

export function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function getQuizModalOpen() {
  return count > 0;
}
