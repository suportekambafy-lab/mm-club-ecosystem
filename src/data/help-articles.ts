export type HelpCategory =
  | "Academia"
  | "Comunidade"
  | "Ferramentas"
  | "Lives"
  | "Conta e subscrição";

export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  category: HelpCategory;
  /** Rota interna da função descrita (link direto). */
  action?: { label: string; to: string };
  /** Passos curtos, uma linha cada. */
  steps: string[];
  keywords?: string;
};

export const helpCategories: HelpCategory[] = [
  "Academia",
  "Comunidade",
  "Ferramentas",
  "Lives",
  "Conta e subscrição",
];

export const helpArticles: HelpArticle[] = [
  {
    slug: "testes-de-modulo",
    title: "Testes de fim de módulo (MM Quiz)",
    summary:
      "No fim de cada módulo respondes a um teste curto. Com 80% de acerto desbloqueias o módulo seguinte.",
    category: "Academia",
    action: { label: "Ir para a Academia", to: "/academia" },
    steps: [
      "Vê todas as aulas do módulo.",
      "Na última aula, o botão Continuar leva-te ao teste.",
      "Precisas de 80% de respostas certas para passar.",
      "Se erras, mostramos a resposta correta e o minuto da aula para rever.",
      "Podes repetir o teste as vezes que precisares.",
    ],
    keywords: "quiz teste perguntas modulo desbloquear bloqueado",
  },
  {
    slug: "continuar-a-ver",
    title: "Continuar a ver onde parei",
    summary:
      "A tua aula retoma no ponto exato onde saíste, em qualquer dispositivo.",
    category: "Academia",
    action: { label: "Continuar a ver", to: "/dashboard" },
    steps: [
      "No Início, o cartão Continuar leva-te à aula em curso.",
      "Aulas já concluídas voltam a começar do início.",
      "Repetir uma aula concluída não altera o teu progresso nem as horas.",
    ],
    keywords: "retomar progresso continuar aula memoria",
  },
  {
    slug: "notas-de-aula",
    title: "Notas dentro da aula",
    summary:
      "Escreve notas com o minuto do vídeo guardado. Ao clicar na nota, o vídeo salta para esse momento.",
    category: "Academia",
    action: { label: "Abrir a Academia", to: "/academia" },
    steps: [
      "Abre uma aula e usa o painel de notas ao lado do vídeo.",
      "Cada nota guarda o minuto atual.",
      "Clica numa nota para voltar a esse ponto do vídeo.",
    ],
    keywords: "notas apontamentos minuto timecode",
  },
  {
    slug: "certificados",
    title: "Certificados de conclusão",
    summary:
      "Vê quantas aulas faltam para o certificado de cada curso e descarrega o PDF quando terminas.",
    category: "Academia",
    action: { label: "Os meus certificados", to: "/certificados" },
    steps: [
      "Abre Certificados para ver o progresso de cada curso.",
      "Ao concluir 100% do curso, o certificado é emitido automaticamente.",
      "Recebes também o certificado por email, em PDF.",
      "Cada certificado tem um código público de verificação.",
    ],
    keywords: "certificado diploma pdf conclusao",
  },
  {
    slug: "streak-de-estudo",
    title: "Sequência de estudo (streak)",
    summary: "Estuda todos os dias para manter a tua sequência ativa.",
    category: "Academia",
    action: { label: "Ver a minha sequência", to: "/dashboard" },
    steps: [
      "Ver aulas conta como atividade do dia.",
      "A sequência quebra se passares um dia sem estudar.",
      "A sequência aparece no Início.",
    ],
    keywords: "streak sequencia habito dias seguidos",
  },
  {
    slug: "mm-inteligence",
    title: "MM Inteligence: perguntar sobre as aulas",
    summary:
      "O assistente responde com base nas aulas do clube e indica o curso e o minuto.",
    category: "Academia",
    action: { label: "Abrir MM Inteligence", to: "/jade" },
    steps: [
      "Escreve a tua dúvida em linguagem normal.",
      "Se a pergunta servir para vários cursos, escolhe o curso sugerido.",
      "As conversas ficam guardadas no teu histórico.",
    ],
    keywords: "jade assistente ia chat duvidas",
  },
  {
    slug: "mm-shorts",
    title: "Publicar MM Shorts",
    summary: "Vídeos verticais curtos, com likes e visualizações.",
    category: "Comunidade",
    action: { label: "Abrir MM Shorts", to: "/shorts" },
    steps: [
      "Abre MM Shorts e toca em Adicionar.",
      "Escolhe um vídeo vertical (até 2 GB).",
      "Publica: o vídeo passa por moderação automática antes de ficar visível.",
    ],
    keywords: "shorts reels video vertical publicar",
  },
  {
    slug: "notificacoes",
    title: "Notificações de likes, respostas e menções",
    summary: "O sino mostra tudo o que acontece nas tuas publicações.",
    category: "Comunidade",
    action: { label: "Ir para a Comunidade", to: "/comunidade" },
    steps: [
      "O sino no topo mostra likes, comentários e menções.",
      "Podes ativar notificações no telemóvel ao instalar a app.",
      "Também recebes email — podes desativar no teu perfil.",
    ],
    keywords: "sino notificacoes push email mencoes",
  },
  {
    slug: "codigo-do-clube",
    title: "Código do Clube e moderação",
    summary:
      "Regras de convivência. Um agente verifica publicações antes de ficarem visíveis.",
    category: "Comunidade",
    action: { label: "Ler o Código do Clube", to: "/codigo" },
    steps: [
      "Pedidos de reembolso, faturas ou acessos não são tratados na Comunidade — usa o suporte.",
      "Conteúdo com dados pessoais é removido.",
      "Incumprimentos repetidos levam a aviso e depois suspensão temporária.",
      "Se discordares de uma sanção, podes apresentar recurso.",
    ],
    keywords: "regras moderacao sancao banimento recurso",
  },
  {
    slug: "ranking-comunidade",
    title: "Ranking e distintivos da Comunidade",
    summary: "Participar dá pontos e coloca-te no ranking semanal.",
    category: "Comunidade",
    action: { label: "Ver o ranking", to: "/comunidade" },
    steps: [
      "Publicar, comentar e receber likes soma pontos.",
      "O Top 5 recebe distintivo visível no perfil.",
      "A equipa do clube não entra no ranking.",
    ],
    keywords: "ranking gamificacao pontos badge top",
  },
  {
    slug: "mm-studio",
    title: "MM Studio: imagens, vídeos e logotipos",
    summary:
      "Cria criativos publicitários com IA a partir das fotos do teu produto.",
    category: "Ferramentas",
    action: { label: "Abrir MM Studio", to: "/ferramentas/studio" },
    steps: [
      "Guarda o produto na biblioteca (fotos e ficha).",
      "Escolhe o módulo: imagens, vídeos ou logotipos.",
      "Cada geração consome créditos; o saldo aparece no topo do Studio.",
    ],
    keywords: "studio ia imagens videos logotipos creditos",
  },
  {
    slug: "product-lab",
    title: "MM Product Lab",
    summary:
      "Quadro para encontrar, organizar e validar produtos com Score MM.",
    category: "Ferramentas",
    action: { label: "Abrir Product Lab", to: "/ferramentas/product-lab" },
    steps: [
      "Adiciona produtos ao quadro.",
      "A análise de IA dá-te o Score MM e pontos de atenção.",
      "Move os cartões entre colunas até validar.",
    ],
    keywords: "product lab mineracao produtos score",
  },
  {
    slug: "thumbnails",
    title: "Thumbnail Builder",
    summary: "Cola o link do YouTube e recebe duas thumbnails 16:9 prontas.",
    category: "Ferramentas",
    action: { label: "Criar thumbnail", to: "/ferramentas/thumbnails" },
    steps: [
      "Cola o link do vídeo.",
      "Recebes duas propostas em 16:9.",
      "Descarrega a que preferires.",
    ],
    keywords: "thumbnail youtube capa",
  },
  {
    slug: "links-uteis",
    title: "Links úteis das aulas",
    summary:
      "Todas as plataformas usadas nas aulas num só lugar, com ofertas de parceiro.",
    category: "Ferramentas",
    action: { label: "Ver links úteis", to: "/ferramentas/links" },
    steps: [
      "Pesquisa pela plataforma ou filtra por categoria.",
      "Cada cartão tem link direto e a oferta disponível.",
    ],
    keywords: "links ferramentas externas stack parceiros",
  },
  {
    slug: "mm-suporte",
    title: "MM Suporte (chat de ajuda)",
    summary:
      "Botão flutuante no canto do ecrã. Responde de imediato e escala para a equipa quando é preciso.",
    category: "Conta e subscrição",
    action: { label: "Voltar ao Início", to: "/dashboard" },
    steps: [
      "Toca no botão de suporte no canto inferior direito.",
      "Escolhe um tema ou escreve a tua questão.",
      "Se precisares de uma pessoa, o chat encaminha para a equipa.",
      "Durante um teste de módulo o botão fica escondido.",
    ],
    keywords: "suporte ajuda chat whatsapp",
  },
  {
    slug: "assistir-lives",
    title: "Lives e gravações",
    summary:
      "Entra nas sessões em direto e vê as gravações quando quiseres — com memória de onde parou.",
    category: "Lives",
    action: { label: "Ir para Ao Vivo", to: "/lives" },
    steps: [
      "Recebes aviso por email e no sino quando uma live começa.",
      "Na sala interativa podes ligar câmara, microfone e partilhar ecrã.",
      "As gravações ficam disponíveis na página Ao Vivo.",
      "A gravação retoma no ponto onde saíste.",
    ],
    keywords: "live direto gravacao sala interativa partilhar ecra",
  },
  {
    slug: "gerir-subscricao",
    title: "Gerir a subscrição e pagamentos",
    summary:
      "Vê o teu plano, próximas cobranças, faturas e método de pagamento.",
    category: "Conta e subscrição",
    action: { label: "Gerir subscrição", to: "/subscricao" },
    steps: [
      "Abre Subscrição para ver plano e próxima cobrança.",
      "Podes atualizar o método de pagamento.",
      "As faturas estão disponíveis em PDF.",
    ],
    keywords: "subscricao plano pagamento fatura cancelar cartao",
  },
  {
    slug: "instalar-app",
    title: "Instalar a app no telemóvel",
    summary:
      "O MM Club instala-se como app e recebe notificações no telemóvel.",
    category: "Conta e subscrição",
    action: { label: "Abrir o meu perfil", to: "/perfil" },
    steps: [
      "iPhone: Safari → Partilhar → Adicionar ao ecrã principal.",
      "Android: Chrome → menu → Instalar aplicação.",
      "Depois de instalar, aceita as notificações.",
    ],
    keywords: "pwa instalar app telemovel notificacoes",
  },
];

export function findHelpArticle(slug: string): HelpArticle | undefined {
  return helpArticles.find((a) => a.slug === slug);
}
