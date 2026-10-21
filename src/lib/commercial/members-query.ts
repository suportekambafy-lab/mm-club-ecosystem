/**
 * Opções de query partilhadas da listagem de utilizadores comerciais.
 * Vive fora das rotas para preservar o code splitting do TanStack Router.
 */
import { queryOptions } from "@tanstack/react-query";
import { commercialMembers } from "@/lib/commercial/commercial.functions";

export const commercialMembersOptions = queryOptions({
  queryKey: ["commercial-members"],
  queryFn: () => commercialMembers({ data: { search: "" } }),
});
