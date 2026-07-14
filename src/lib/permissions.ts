import type { CurrentUser, Visibility } from "@/data/types";

export function canAccess(user: CurrentUser, visibility: Visibility): boolean {
  return user.entitlements.includes(visibility);
}

export function accessLabel(visibility: Visibility): string {
  switch (visibility) {
    case "public":
      return "Público";
    case "purchased":
      return "Adquirido";
    case "club":
      return "MM Club";
    case "premium":
      return "Premium";
  }
}
