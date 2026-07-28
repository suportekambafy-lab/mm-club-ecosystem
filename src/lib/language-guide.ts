/**
 * MM Club — Guia de Linguagem (etiquetas canónicas).
 * Regras completas em docs/MM-LANGUAGE-GUIDE.md.
 *
 * Tratamento: "tu". Ortografia: português de Portugal (AO90).
 * Usa estas constantes em vez de escrever texto de botão à mão, para que
 * a app fale sempre da mesma forma.
 */
export const L = {
  save: "Guardar",
  cancel: "Cancelar",
  delete: "Eliminar",
  continue: "Continuar",
  add: "Adicionar",
  send: "Enviar",
  retry: "Tentar novamente",
  close: "Fechar",
  back: "Voltar",
  edit: "Editar",
  signOut: "Terminar sessão",
  loading: "A carregar…",
  irreversible: "Esta ação não pode ser desfeita.",
  genericError: "Algo correu mal. Tenta novamente dentro de momentos.",
} as const;

export type LanguageLabel = keyof typeof L;
