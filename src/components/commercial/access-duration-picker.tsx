import { Button } from "@/components/ui/button";
import { ACCESS_DURATIONS, accessDurationLabel, type AccessDuration } from "@/lib/commercial/rules";

export function AccessDurationPicker({ value, onChange, disabled }: { value: AccessDuration; onChange: (value: AccessDuration) => void; disabled?: boolean }) {
  return <fieldset disabled={disabled}><legend className="mb-2 text-sm">Duração do acesso</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{ACCESS_DURATIONS.map(duration => <Button key={duration} type="button" variant={duration === value ? "default" : "outline"} aria-pressed={duration === value} onClick={() => onChange(duration)}>{accessDurationLabel(duration)}</Button>)}</div></fieldset>;
}