// Sinal simples para esconder o widget de suporte enquanto o modal do teste está aberto.
const subscribers = new Set<() => void>();
let active = false;

export function setQuizModalOpen(value: boolean) {
  if (active === value) return;
  active = value;
  for (const cb of subscribers) cb();
}

export function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function getQuizModalOpen() {
  return active;
}
