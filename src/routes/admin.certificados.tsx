import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, Download, Flame, Loader2, RefreshCw, Search } from "lucide-react";
import { MemberAvatar } from "@/components/mm/member-avatar";
import {
  getCertificatePdfByCode,
  getCertificatesOverview,
  previewCertificatePdf,
} from "@/lib/admin-certificates.functions";

export const Route = createFileRoute("/admin/certificados")({
  head: () => ({
    meta: [
      { title: "Certificados & Sequências — Admin MM Club" },
      {
        name: "description",
        content: "Certificados emitidos, sequências de estudo dos alunos e pré-visualização do modelo oficial.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminCertificatesPage,
});

type Tab = "certificados" | "sequencias" | "modelo";

function AdminCertificatesPage() {
  const [tab, setTab] = useState<Tab>("certificados");
  const [query, setQuery] = useState("");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin", "certificados"],
    queryFn: () => getCertificatesOverview(),
    staleTime: 60_000,
  });

  const certificates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data?.certificates ?? [];
    if (!q) return list;
    return list.filter((c) =>
      [c.memberName, c.courseTitle, c.code].some((v) => v.toLowerCase().includes(q)),
    );
  }, [data, query]);

  const streaks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data?.streaks ?? [];
    if (!q) return list;
    return list.filter((s) => s.name.toLowerCase().includes(q));
  }, [data, query]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-admin-fg">
            Certificados & Sequências
          </h1>
          <p className="mt-1 text-[13px] text-admin-muted">
            Quem já concluiu cursos, quem está em sequência de estudo e o modelo oficial do certificado.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-admin-panel-2 px-3 py-1.5 text-[13px] text-admin-fg transition hover:bg-admin-hover"
        >
          <RefreshCw strokeWidth={1.8} className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Certificados emitidos" value={data?.totals.certificates ?? 0} />
        <Stat label="Alunos certificados" value={data?.totals.membersWithCertificate ?? 0} />
        <Stat label="Sequências ativas" value={data?.totals.activeStreaks ?? 0} />
        <Stat label="Minutos (7 dias)" value={data?.totals.weekMinutes ?? 0} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["certificados", "Certificados"],
            ["sequencias", "Sequências"],
            ["modelo", "Modelo do certificado"],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] transition ${
              tab === key
                ? "bg-admin-fg text-admin-bg"
                : "bg-admin-panel-2 text-admin-muted hover:bg-admin-hover hover:text-admin-fg"
            }`}
          >
            {label}
          </button>
        ))}
        {tab !== "modelo" && (
          <div className="ml-auto flex h-9 min-w-[220px] items-center gap-2 rounded-lg bg-admin-panel-2 px-3">
            <Search strokeWidth={1.8} className="h-3.5 w-3.5 text-admin-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar aluno, curso ou código"
              className="h-full flex-1 bg-transparent text-[13px] text-admin-fg outline-none placeholder:text-admin-faint"
            />
          </div>
        )}
      </div>

      {isLoading && tab !== "modelo" ? (
        <div className="flex items-center gap-2 rounded-xl bg-admin-panel p-6 text-[13px] text-admin-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
        </div>
      ) : tab === "certificados" ? (
        <CertificatesTable rows={certificates} />
      ) : tab === "sequencias" ? (
        <StreaksTable rows={streaks} />
      ) : (
        <TemplatePreview />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-admin-panel p-4">
      <p className="text-[20px] font-semibold text-admin-fg">{value.toLocaleString("pt-PT")}</p>
      <p className="mt-1 text-[12px] text-admin-faint">{label}</p>
    </div>
  );
}

function CertificatesTable({
  rows,
}: {
  rows: Array<{
    code: string;
    courseTitle: string;
    memberName: string;
    hours: number;
    lessonsTotal: number;
    issuedAt: string;
    userId: string;
    avatarUrl: string | null;
  }>;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (code: string) => {
    setBusy(code);
    try {
      const res = await getCertificatePdfByCode({ data: { code } });
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn("Falha ao gerar PDF", error);
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-admin-panel p-6 text-[13px] text-admin-muted">
        Ainda não há certificados emitidos.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-admin-panel">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-admin-faint">
            <th className="px-4 py-2.5 font-normal">Aluno</th>
            <th className="px-4 py-2.5 font-normal">Curso</th>
            <th className="px-4 py-2.5 font-normal">Horas</th>
            <th className="px-4 py-2.5 font-normal">Código</th>
            <th className="px-4 py-2.5 font-normal">Emitido</th>
            <th className="px-4 py-2.5 font-normal" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code} className="border-t border-admin-border/60">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <MemberAvatar name={row.memberName} avatarUrl={row.avatarUrl} size={28} />
                  <span className="text-admin-fg">{row.memberName}</span>
                </div>
              </td>
              <td className="max-w-[280px] truncate px-4 py-2.5 text-admin-muted">{row.courseTitle}</td>
              <td className="px-4 py-2.5 tabular-nums text-admin-muted">{row.hours}h</td>
              <td className="px-4 py-2.5 font-mono text-[12px] text-admin-muted">{row.code}</td>
              <td className="px-4 py-2.5 text-admin-muted">
                {new Date(row.issuedAt).toLocaleDateString("pt-PT")}
              </td>
              <td className="px-4 py-2.5 text-right">
                <button
                  type="button"
                  onClick={() => void download(row.code)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-admin-panel-2 px-2.5 py-1.5 text-[12px] text-admin-fg transition hover:bg-admin-hover"
                >
                  {busy === row.code ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download strokeWidth={1.8} className="h-3.5 w-3.5" />
                  )}
                  PDF
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StreaksTable({
  rows,
}: {
  rows: Array<{
    userId: string;
    name: string;
    avatarUrl: string | null;
    currentStreak: number;
    longestStreak: number;
    weekMinutes: number;
    totalMinutes: number;
    lessonsCompleted: number;
    lastActiveDay: string | null;
  }>;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-admin-panel p-6 text-[13px] text-admin-muted">
        Ainda não há atividade de estudo registada.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl bg-admin-panel">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-admin-faint">
            <th className="px-4 py-2.5 font-normal">Aluno</th>
            <th className="px-4 py-2.5 font-normal">Sequência atual</th>
            <th className="px-4 py-2.5 font-normal">Recorde</th>
            <th className="px-4 py-2.5 font-normal">Min. 7 dias</th>
            <th className="px-4 py-2.5 font-normal">Min. total</th>
            <th className="px-4 py-2.5 font-normal">Aulas concluídas</th>
            <th className="px-4 py-2.5 font-normal">Último dia</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId} className="border-t border-admin-border/60">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <MemberAvatar name={row.name} avatarUrl={row.avatarUrl} size={28} />
                  <span className="text-admin-fg">{row.name}</span>
                </div>
              </td>
              <td className="px-4 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-admin-fg">
                  <Flame
                    strokeWidth={1.8}
                    className={`h-3.5 w-3.5 ${row.currentStreak > 0 ? "text-orange-400" : "text-admin-faint"}`}
                  />
                  {row.currentStreak} {row.currentStreak === 1 ? "dia" : "dias"}
                </span>
              </td>
              <td className="px-4 py-2.5 tabular-nums text-admin-muted">{row.longestStreak}</td>
              <td className="px-4 py-2.5 tabular-nums text-admin-muted">{row.weekMinutes}</td>
              <td className="px-4 py-2.5 tabular-nums text-admin-muted">{row.totalMinutes}</td>
              <td className="px-4 py-2.5 tabular-nums text-admin-muted">{row.lessonsCompleted}</td>
              <td className="px-4 py-2.5 text-admin-muted">
                {row.lastActiveDay ? new Date(row.lastActiveDay).toLocaleDateString("pt-PT") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TemplatePreview() {
  const [memberName, setMemberName] = useState("Victor Muabi");
  const [courseTitle, setCourseTitle] = useState("Dropshipping do Zero ao Primeiro Lucro");
  const [hours, setHours] = useState(8);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const render = async () => {
    setBusy(true);
    try {
      const res = await previewCertificatePdf({ data: { memberName, courseTitle, hours } });
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
      const next = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      setUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return next;
      });
    } catch (error) {
      console.warn("Falha na pré-visualização", error);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl bg-admin-panel p-4 md:grid-cols-[1fr_1fr_120px_auto]">
        <label className="space-y-1">
          <span className="text-[12px] text-admin-faint">Nome do aluno</span>
          <input
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            className="h-9 w-full rounded-lg bg-admin-panel-2 px-3 text-[13px] text-admin-fg outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[12px] text-admin-faint">Curso</span>
          <input
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
            className="h-9 w-full rounded-lg bg-admin-panel-2 px-3 text-[13px] text-admin-fg outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[12px] text-admin-faint">Horas</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="h-9 w-full rounded-lg bg-admin-panel-2 px-3 text-[13px] text-admin-fg outline-none"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void render()}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-admin-fg px-3 text-[13px] font-medium text-admin-bg transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Award strokeWidth={1.8} className="h-3.5 w-3.5" />}
            Pré-visualizar
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-admin-panel p-2">
        {url ? (
          <iframe title="Modelo do certificado" src={url} className="h-[560px] w-full rounded-lg bg-black" />
        ) : (
          <div className="flex h-[560px] items-center justify-center text-[13px] text-admin-muted">
            {busy ? "A gerar modelo…" : "Sem pré-visualização"}
          </div>
        )}
      </div>
      {url && (
        <a
          href={url}
          download="Modelo-Certificado-MMClub.pdf"
          className="inline-flex items-center gap-1.5 rounded-lg bg-admin-panel-2 px-3 py-1.5 text-[13px] text-admin-fg transition hover:bg-admin-hover"
        >
          <Download strokeWidth={1.8} className="h-3.5 w-3.5" />
          Descarregar modelo
        </a>
      )}
    </div>
  );
}
