export interface JadeMessage {
  id: string;
  role: "user" | "jade";
  content: string;
}

export interface JadeConversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: JadeMessage[];
}

export const jadeSuggestions = [
  "Analisa o meu posicionamento atual",
  "Cria uma oferta premium para o meu nicho",
  "Escreve 5 headlines com o método MM",
  "Como estruturar a minha primeira agência IA?",
];

export const jadeConversations: JadeConversation[] = [
  {
    id: "jc1",
    title: "Posicionamento da minha marca",
    updatedAt: "hoje",
    messages: [
      { id: "m1", role: "user", content: "Como diferencio a minha marca num nicho saturado?" },
      {
        id: "m2",
        role: "jade",
        content:
          "No método Marca Milionária, a diferenciação nasce de três eixos: **contraste**, **origem** e **método próprio**. Vamos por partes — descreve-me o teu produto, o cliente ideal e três concorrentes que respeites.",
      },
    ],
  },
  {
    id: "jc2",
    title: "Estrutura de agência IA",
    updatedAt: "ontem",
    messages: [
      {
        id: "m1",
        role: "user",
        content: "Quero abrir uma agência com IA. Por onde começo?",
      },
      {
        id: "m2",
        role: "jade",
        content:
          "Comecemos pelo delivery, não pelo marketing. Antes de captar clientes, precisas de um serviço com processo claro. Vou desenhar contigo o **entregável mínimo lucrativo**.",
      },
    ],
  },
  {
    id: "jc3",
    title: "Copy do e-mail de lançamento",
    updatedAt: "há 3 dias",
    messages: [
      { id: "m1", role: "user", content: "Preciso do e-mail #1 do meu lançamento." },
      {
        id: "m2",
        role: "jade",
        content:
          "Ótimo. O e-mail #1 do modelo MM é o **e-mail de origem**: revela o problema pessoal que originou o método. Envia-me um parágrafo sobre como chegaste até aqui — trabalho a partir daí.",
      },
    ],
  },
];
