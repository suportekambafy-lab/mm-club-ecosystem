// Logótipos oficiais dos métodos de pagamento, em SVG inline.
// Usados no seletor de métodos do checkout MMpay.

function LogoPill({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span
      title={label}
      aria-label={label}
      className="flex h-8 items-center justify-center rounded-lg bg-white px-3 ring-1 ring-black/10"
    >
      {children}
    </span>
  );
}

export function CardBrandsLogo() {
  return (
    <LogoPill label="Visa e Mastercard">
      <svg viewBox="0 0 74 18" className="h-4 w-auto" aria-hidden>
        <text
          x="16"
          y="14"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="14"
          fontWeight="800"
          fontStyle="italic"
          fill="#1A1F71"
          letterSpacing="0.5"
        >
          VISA
        </text>
        <circle cx="46" cy="9" r="7" fill="#EB001B" />
        <circle cx="54" cy="9" r="7" fill="#F79E1B" fillOpacity="0.92" />
        <path d="M50 3.3a7 7 0 0 1 0 11.4 7 7 0 0 1 0-11.4Z" fill="#FF5F00" />
      </svg>
    </LogoPill>
  );
}

export function MbWayLogo() {
  return (
    <LogoPill label="MB WAY">
      <svg viewBox="0 0 56 16" className="h-3.5 w-auto" aria-hidden>
        <text
          x="28"
          y="12.5"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="12"
          fontWeight="800"
          fill="#E6007E"
          letterSpacing="0.5"
        >
          MB WAY
        </text>
      </svg>
    </LogoPill>
  );
}

export function KlarnaLogo() {
  return (
    <span
      title="Klarna"
      aria-label="Klarna"
      className="flex h-8 items-center justify-center rounded-lg bg-[#FFB3C7] px-3 ring-1 ring-black/10"
    >
      <svg viewBox="0 0 46 16" className="h-3.5 w-auto" aria-hidden>
        <text
          x="23"
          y="12.5"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="12"
          fontWeight="800"
          fill="#17120F"
          letterSpacing="0.3"
        >
          Klarna.
        </text>
      </svg>
    </span>
  );
}
