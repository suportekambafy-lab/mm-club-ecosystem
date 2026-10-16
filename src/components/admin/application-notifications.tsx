import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { listApplicationNotifications } from "@/lib/aplicacao/aplicacao.functions";
import { createApplicationTracker } from "@/lib/aplicacao/notification-tracker";

export function ApplicationNotifications() {
  const fetchNotices = useServerFn(listApplicationNotifications);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const tracker = useRef(createApplicationTracker());
  const audio = useRef<AudioContext | null>(null);
  const { data } = useQuery({
    queryKey: ["application-notifications"], queryFn: () => fetchNotices(),
    refetchInterval: 10_000, refetchIntervalInBackground: true, staleTime: 0,
  });

  useEffect(() => {
    // Browsers require a user gesture before playing notification audio.
    const unlock = () => {
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume().catch(() => {});
      } catch { /* Toasts remain available when sound is unsupported. */ }
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      void audio.current?.close().catch(() => {});
      audio.current = null;
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    const fresh = tracker.current(data);
    if (!fresh.length) return;
    for (const lead of fresh) toast.success("Nova aplicação recebida", {
      id: `application-${lead.id}`, description: `${lead.nome || "Novo contacto"} · Lead ${lead.classificacao}`,
      duration: 10_000, action: { label: "Ver aplicações", onClick: () => { void navigate({ to: "/admin/aplicacoes" }); } },
    });
    void qc.invalidateQueries({ queryKey: ["aplicacao-leads"] });
    try {
      const ctx = audio.current;
      if (!ctx || ctx.state !== "running") return;
      [659.25, 880].forEach((frequency, i) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + i * 0.18;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(start); oscillator.stop(start + 0.36);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch { /* Audio failure must not prevent the notification. */ }
  }, [data, navigate, qc]);
  return null;
}