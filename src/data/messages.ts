export type Conversation = {
  id: string;
  name: string;
  initials: string;
  role: string;
  lastMessage: string;
  timeAgo: string;
  unread?: number;
  online?: boolean;
  pinned?: boolean;
};

export type Message = {
  id: string;
  author: "me" | "them";
  text: string;
  time: string;
  status?: "sent" | "delivered" | "read";
};

export type ConversationThread = {
  conversationId: string;
  messages: Message[];
};

export const conversations: Conversation[] = [
  {
    id: "andre",
    name: "André Marques",
    initials: "AM",
    role: "Fundador · MM Club",
    lastMessage: "Bem-vindo. Diz-me em que estás a trabalhar.",
    timeAgo: "agora",
    unread: 2,
    online: true,
    pinned: true,
  },
  {
    id: "sofia",
    name: "Sofia Almeida",
    initials: "SA",
    role: "E-commerce · Porto",
    lastMessage: "Consegui fechar 3 clientes esta semana 🚀",
    timeAgo: "12 min",
    unread: 1,
    online: true,
  },
  {
    id: "ricardo",
    name: "Ricardo Nunes",
    initials: "RN",
    role: "Agência de tráfego",
    lastMessage: "Manda os criativos quando puderes.",
    timeAgo: "1 h",
    online: false,
  },
  {
    id: "beatriz",
    name: "Beatriz Costa",
    initials: "BC",
    role: "Coach · Lisboa",
    lastMessage: "Vou aplicar a estrutura da última live.",
    timeAgo: "3 h",
    online: false,
  },
  {
    id: "miguel",
    name: "Miguel Ferreira",
    initials: "MF",
    role: "SaaS · Founder",
    lastMessage: "Podemos falar amanhã às 10?",
    timeAgo: "ontem",
    online: true,
  },
  {
    id: "ines",
    name: "Inês Rocha",
    initials: "IR",
    role: "Copywriter",
    lastMessage: "Enviei-te o rascunho.",
    timeAgo: "ontem",
    online: false,
  },
  {
    id: "tomas",
    name: "Tomás Silva",
    initials: "TS",
    role: "Consultor financeiro",
    lastMessage: "Obrigado pela indicação!",
    timeAgo: "2 d",
    online: false,
  },
];

export const threads: Record<string, Message[]> = {
  andre: [
    { id: "a1", author: "them", text: "Bem-vindo ao MM Club 👋", time: "10:12" },
    { id: "a2", author: "them", text: "Diz-me em que estás a trabalhar neste momento — negócio, offer, tráfego?", time: "10:12" },
    { id: "a3", author: "me", text: "Estou a lançar uma agência de tráfego. Já tenho 2 clientes.", time: "10:14", status: "read" },
    { id: "a4", author: "them", text: "Boa. Vê a aula 3 do módulo de aquisição — vai poupar-te semanas.", time: "10:15" },
    { id: "a5", author: "them", text: "Depois conta-me como correu.", time: "10:15" },
  ],
  sofia: [
    { id: "s1", author: "them", text: "Consegui fechar 3 clientes esta semana 🚀", time: "09:41" },
    { id: "s2", author: "me", text: "Brutal! Qual foi a alavanca?", time: "09:43", status: "read" },
    { id: "s3", author: "them", text: "Segui o script de discovery à risca. Faz toda a diferença.", time: "09:45" },
  ],
  ricardo: [
    { id: "r1", author: "them", text: "Manda os criativos quando puderes.", time: "ontem" },
  ],
  beatriz: [
    { id: "b1", author: "them", text: "Vou aplicar a estrutura da última live.", time: "ontem" },
  ],
  miguel: [
    { id: "m1", author: "them", text: "Podemos falar amanhã às 10?", time: "ontem" },
  ],
  ines: [
    { id: "i1", author: "them", text: "Enviei-te o rascunho.", time: "ontem" },
  ],
  tomas: [
    { id: "t1", author: "them", text: "Obrigado pela indicação!", time: "há 2 dias" },
  ],
};
