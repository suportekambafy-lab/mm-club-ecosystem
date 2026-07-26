import { CreditCard } from "lucide-react";

/**
 * Card-scheme / wallet marks. Brand colours are intentional literals inside
 * the SVGs — these are trademarks, not themeable UI colours.
 */
type Props = { brand?: string | null; method?: string | null; className?: string };

function normalize(brand?: string | null, method?: string | null): string {
  const raw = `${brand ?? ""} ${method ?? ""}`.toLowerCase().replace(/[\s_-]/g, "");
  if (raw.includes("visa")) return "visa";
  if (raw.includes("mastercard") || raw.includes("maestro")) return "mastercard";
  if (raw.includes("amex") || raw.includes("americanexpress")) return "amex";
  if (raw.includes("paypal")) return "paypal";
  if (raw.includes("applepay")) return "applepay";
  if (raw.includes("googlepay")) return "googlepay";
  if (raw.includes("bancontact")) return "bancontact";
  if (raw.includes("ideal")) return "ideal";
  if (raw.includes("multibanco")) return "multibanco";
  if (raw.includes("mbway")) return "mbway";
  if (raw.includes("directdebit") || raw.includes("sepa")) return "sepa";
  return "generic";
}

export function PaymentBrandMark({ brand, method, className }: Props) {
  const key = normalize(brand, method);
  const box = `h-6 w-10 rounded-[4px] bg-white ring-1 ring-black/10 ${className ?? ""}`;

  if (key === "generic") {
    return (
      <span className="flex h-6 w-10 items-center justify-center rounded-[4px] bg-surface-3 ring-1 ring-border">
        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
    );
  }

  return (
    <span className={box} aria-hidden>
      <svg viewBox="0 0 40 24" className="h-full w-full">
        {key === "visa" ? (
          <text
            x="20"
            y="16.5"
            textAnchor="middle"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontStyle="italic"
            fontWeight="700"
            fontSize="11"
            letterSpacing="0.5"
            fill="#1A1F71"
          >
            VISA
          </text>
        ) : null}

        {key === "mastercard" ? (
          <g>
            <circle cx="16" cy="12" r="7" fill="#EB001B" />
            <circle cx="24" cy="12" r="7" fill="#F79E1B" />
            <path
              d="M20 6.6a7 7 0 0 0 0 10.8 7 7 0 0 0 0-10.8Z"
              fill="#FF5F00"
            />
          </g>
        ) : null}

        {key === "amex" ? (
          <g>
            <rect width="40" height="24" rx="4" fill="#2E77BC" />
            <text
              x="20"
              y="15"
              textAnchor="middle"
              fontFamily="Helvetica, Arial, sans-serif"
              fontWeight="700"
              fontSize="7"
              fill="#FFFFFF"
            >
              AMEX
            </text>
          </g>
        ) : null}

        {key === "paypal" ? (
          <g>
            <text
              x="20"
              y="16"
              textAnchor="middle"
              fontFamily="Helvetica, Arial, sans-serif"
              fontStyle="italic"
              fontWeight="700"
              fontSize="9"
            >
              <tspan fill="#003087">Pay</tspan>
              <tspan fill="#009CDE">Pal</tspan>
            </text>
          </g>
        ) : null}

        {key === "applepay" ? (
          <g fill="#000000">
            <path d="M12.9 8.6c.5-.6.8-1.4.7-2.2-.7 0-1.6.5-2.1 1.1-.5.5-.9 1.4-.7 2.2.8.05 1.6-.4 2.1-1.1Zm.7 1.2c-1.2-.07-2.2.66-2.7.66-.6 0-1.4-.63-2.3-.61-1.2.02-2.3.7-2.9 1.77-1.2 2.14-.3 5.3.9 7.04.6.85 1.3 1.8 2.2 1.77.9-.04 1.2-.57 2.3-.57s1.4.57 2.3.55c1-.02 1.6-.86 2.2-1.72.7-.98 1-1.94 1-1.99-.02-.02-1.9-.74-1.9-2.92-.02-1.82 1.5-2.7 1.6-2.75-.9-1.3-2.2-1.44-2.7-1.47Z" />
            <text
              x="26"
              y="17"
              fontFamily="Helvetica, Arial, sans-serif"
              fontWeight="600"
              fontSize="9"
            >
              Pay
            </text>
          </g>
        ) : null}

        {key === "googlepay" ? (
          <text
            x="20"
            y="16"
            textAnchor="middle"
            fontFamily="Helvetica, Arial, sans-serif"
            fontWeight="600"
            fontSize="9"
          >
            <tspan fill="#4285F4">G</tspan>
            <tspan fill="#5F6368"> Pay</tspan>
          </text>
        ) : null}

        {key === "bancontact" ? (
          <g>
            <rect x="4" y="8" width="16" height="8" rx="2" fill="#005498" />
            <rect x="18" y="8" width="18" height="8" rx="2" fill="#FFD800" />
          </g>
        ) : null}

        {key === "ideal" ? (
          <text
            x="20"
            y="16"
            textAnchor="middle"
            fontFamily="Helvetica, Arial, sans-serif"
            fontWeight="700"
            fontSize="10"
            fill="#CC0066"
          >
            iDEAL
          </text>
        ) : null}

        {key === "multibanco" ? (
          <text
            x="20"
            y="15"
            textAnchor="middle"
            fontFamily="Helvetica, Arial, sans-serif"
            fontWeight="700"
            fontSize="6.5"
            fill="#0A2E6E"
          >
            MULTIBANCO
          </text>
        ) : null}

        {key === "mbway" ? (
          <text
            x="20"
            y="16"
            textAnchor="middle"
            fontFamily="Helvetica, Arial, sans-serif"
            fontWeight="700"
            fontSize="9"
            fill="#E30613"
          >
            MB WAY
          </text>
        ) : null}

        {key === "sepa" ? (
          <text
            x="20"
            y="16"
            textAnchor="middle"
            fontFamily="Helvetica, Arial, sans-serif"
            fontWeight="700"
            fontSize="8"
            fill="#10298E"
          >
            SEPA
          </text>
        ) : null}
      </svg>
    </span>
  );
}

/** Human label for a stored method, e.g. "Visa", "MB WAY", "Cartão". */
export function paymentBrandLabel(
  brand?: string | null,
  method?: string | null,
): string {
  const map: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    paypal: "PayPal",
    applepay: "Apple Pay",
    googlepay: "Google Pay",
    bancontact: "Bancontact",
    ideal: "iDEAL",
    multibanco: "Multibanco",
    mbway: "MB WAY",
    sepa: "Débito direto SEPA",
  };
  const key = normalize(brand, method);
  return map[key] ?? (brand ?? method ?? "Cartão");
}
