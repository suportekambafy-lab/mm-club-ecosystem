import { queryOptions } from "@tanstack/react-query";
import { commercialMembers } from "./commercial.functions";
import { listLeads } from "@/lib/aplicacao/aplicacao.functions";

export const commercialMembersOptions = queryOptions({ queryKey: ["commercial-members"], queryFn: () => commercialMembers({ data: { search: "" } }) });
export const commercialApplicationsOptions = queryOptions({ queryKey: ["commercial-home-applications"], queryFn: () => listLeads(), staleTime: 10_000, refetchInterval: 30_000 });
