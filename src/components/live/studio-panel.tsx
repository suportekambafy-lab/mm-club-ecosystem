/**
 * Painel MM Studio — filtros de imagem e melhoramento de voz na sala ao vivo.
 */
import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_STUDIO_SETTINGS,
  STUDIO_PRESETS,
  getStudioSettings,
  setStudioSettings,
  subscribeStudio,
  type StudioPresetName,
  type StudioSettings,
} from "@/lib/studio-filters";

const PRESET_LABELS: Record<StudioPresetName, string> = {
  natural: "Natural",
  studio: "Estúdio",
  cinema: "Cinema",
  glow: "Glow",
};

export function StudioPanel({ className }: { className?: string }) {
  const [s, setS] = useState<StudioSettings>(DEFAULT_STUDIO_SETTINGS);

  useEffect(() => {
    setS(getStudioSettings());
    return subscribeStudio(setS);
  }, []);

  const update = (patch: Partial<StudioSettings>) => setStudioSettings(patch);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="MM Studio — filtros de imagem e voz"
          title="MM Studio — filtros de imagem e voz"
          className={cn(
            "grid h-9 w-9 place-items-center rounded-xl transition-colors",
            s.videoEnabled || s.audioEnabled
              ? "bg-amber-400/15 text-amber-300"
              : "bg-white/5 text-white/80 hover:bg-white/10",
            className,
          )}
        >
          <Sparkles className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        className="w-80 border-white/10 bg-neutral-950/95 text-white backdrop-blur-xl"
      >
        <div className="space-y-5">
          <header className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <h3 className="text-sm font-semibold">MM Studio</h3>
          </header>

          {/* -------- imagem -------- */}
          <section className="space-y-3">
            <Row
              label="Filtros de imagem"
              checked={s.videoEnabled}
              onCheckedChange={(v) => update({ videoEnabled: v })}
            />
            {s.videoEnabled && (
              <>
                <div className="grid grid-cols-4 gap-1.5">
                  {(Object.keys(STUDIO_PRESETS) as StudioPresetName[]).map((k) => (
                    <Button
                      key={k}
                      size="sm"
                      variant="secondary"
                      onClick={() => update(STUDIO_PRESETS[k])}
                      className="h-7 rounded-lg border border-white/10 bg-white/5 px-0 text-[11px] text-white/85 hover:bg-white/10"
                    >
                      {PRESET_LABELS[k]}
                    </Button>
                  ))}
                </div>
                <Knob label="Iluminação" value={s.brightness} min={0.6} max={1.7} step={0.01} onChange={(v) => update({ brightness: v })} />
                <Knob label="Contraste" value={s.contrast} min={0.6} max={1.7} step={0.01} onChange={(v) => update({ contrast: v })} />
                <Knob label="Cor" value={s.saturation} min={0} max={2} step={0.01} onChange={(v) => update({ saturation: v })} />
                <Knob label="Temperatura" value={s.warmth} min={-30} max={30} step={1} onChange={(v) => update({ warmth: v })} />
                <Knob label="Suavizar pele" value={s.softness} min={0} max={1} step={0.01} onChange={(v) => update({ softness: v })} />
                <Knob label="Vinheta" value={s.vignette} min={0} max={1} step={0.01} onChange={(v) => update({ vignette: v })} />
              </>
            )}
          </section>

          <div className="h-px bg-white/10" />

          {/* -------- voz -------- */}
          <section className="space-y-3">
            <Row
              label="Melhorar voz"
              checked={s.audioEnabled}
              onCheckedChange={(v) => update({ audioEnabled: v })}
            />
            {s.audioEnabled && (
              <>
                <Knob label="Redução de ruído" value={s.noiseReduction} min={0} max={1} step={0.01} onChange={(v) => update({ noiseReduction: v })} />
                <Knob label="Nivelar volume" value={s.voiceLeveling} min={0} max={1} step={0.01} onChange={(v) => update({ voiceLeveling: v })} />
                <Knob label="Clareza / presença" value={s.voiceClarity} min={0} max={1} step={0.01} onChange={(v) => update({ voiceClarity: v })} />
              </>
            )}
          </section>

          <p className="text-[11px] leading-snug text-white/45">
            As definições aplicam-se ao teu vídeo e microfone em direto (e à gravação) e ficam guardadas para a próxima sessão.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-white/85">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function Knob({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-white/60">
        <span>{label}</span>
        <span className="tabular-nums text-white/40">{Math.round(((value - min) / (max - min)) * 100)}%</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}
