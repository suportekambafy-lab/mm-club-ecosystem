export function canConfirmCommercialAccount(isAdmin: boolean, roles: string[]) {
  return isAdmin && roles.some(role => role === "sdr" || role === "closer");
}