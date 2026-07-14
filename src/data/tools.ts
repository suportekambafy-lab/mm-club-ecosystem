import type { Tool } from "./types";

export const tools: Tool[] = [
  {
    id: "t1",
    title: "Prompt: Análise de posicionamento",
    description: "Diagnóstico do posicionamento atual da tua marca em minutos.",
    category: "Prompts",
    visibility: "club",
    icon: "Sparkles",
  },
  {
    id: "t2",
    title: "Prompt: Criativos Meta Ads",
    description: "Gera 10 ângulos de criativo prontos a testar.",
    category: "Prompts",
    visibility: "club",
    icon: "Sparkles",
  },
  {
    id: "t3",
    title: "Template: Página de vendas premium",
    description: "Estrutura completa em Notion para landing de alto ticket.",
    category: "Templates",
    visibility: "club",
    icon: "LayoutTemplate",
  },
  {
    id: "t4",
    title: "Checklist: Lançamento em 14 dias",
    description: "Todos os passos operacionais de um lançamento premium.",
    category: "Checklists",
    visibility: "club",
    icon: "ListChecks",
  },
  {
    id: "t5",
    title: "Planilha: Cálculo de LTV/CAC",
    description: "Calcula LTV, CAC e payback em 3 minutos.",
    category: "Planilhas",
    visibility: "club",
    icon: "Table2",
  },
  {
    id: "t6",
    title: "Fornecedores LATAM verificados",
    description: "Lista curada de fornecedores para dropshipping LATAM.",
    category: "Fornecedores",
    visibility: "premium",
    icon: "Truck",
  },
  {
    id: "t7",
    title: "Scripts de vendas 1:1",
    description: "Scripts editáveis para closer de alto ticket.",
    category: "Scripts",
    visibility: "club",
    icon: "MessagesSquare",
  },
  {
    id: "t8",
    title: "Calculadora de pricing premium",
    description: "Encontra o preço ótimo com base em ancoragem e margem.",
    category: "Calculadoras",
    visibility: "club",
    icon: "Calculator",
  },
  {
    id: "t9",
    title: "Recursos: Biblioteca de swipes",
    description: "150+ referências de copy e criativos de marcas premium.",
    category: "Recursos",
    visibility: "club",
    icon: "Library",
  },
  {
    id: "t10",
    title: "Template: Onboarding de cliente",
    description: "Fluxo de onboarding para agências e consultores.",
    category: "Templates",
    visibility: "club",
    icon: "LayoutTemplate",
  },
];

export const toolCategories = [
  "Prompts",
  "Templates",
  "Checklists",
  "Planilhas",
  "Fornecedores",
  "Recursos",
  "Scripts",
  "Calculadoras",
] as const;

export const topTools = tools.slice(0, 4);
