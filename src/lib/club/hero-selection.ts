export type HeroKey = "live" | "weekly" | "mmcast" | "academy";

export function heroKeys(hasLive: boolean, hasEpisode: boolean): HeroKey[] {
  return [
    ...(hasLive ? ["live" as const] : []),
    "weekly",
    ...(hasEpisode ? ["mmcast" as const] : []),
    ...(!hasLive && !hasEpisode ? ["academy" as const] : []),
  ];
}

export function activeHeroKey(keys: HeroKey[], selected: HeroKey | null, onAir: boolean): HeroKey {
  if (onAir && keys.includes("live")) return "live";
  return selected && keys.includes(selected) ? selected : (keys[0] ?? "academy");
}