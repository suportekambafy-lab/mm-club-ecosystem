export type ApplicationNotice = { id: string; nome: string | null; classificacao: string | null };

/** First read is a silent baseline; only newly completed applications alert. */
export function createApplicationTracker() {
  let seen: Set<string> | undefined;
  return (rows: ApplicationNotice[]) => {
    const completed = rows.filter((row) => row.classificacao !== null);
    const fresh = seen ? completed.filter((row) => !seen?.has(row.id)) : [];
    seen ??= new Set();
    for (const row of completed) seen.add(row.id);
    return fresh;
  };
}