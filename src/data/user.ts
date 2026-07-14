import type { CurrentUser } from "./types";

// Utilizador mock. A estrutura já suporta permissões e Dashboard personalizado.
export const currentUser: CurrentUser = {
  id: "u_1",
  name: "João",
  email: "joao@marcamilionaria.com",
  avatarInitials: "JM",
  entitlements: ["public", "purchased", "club"], // não tem "premium" ainda
  dashboard: {
    blocks: [
      "continue",
      "next-live",
      "recommended",
      "news",
      "top-tools",
      "upcoming-events",
      "jade",
      "community",
    ],
  },
};
