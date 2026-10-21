// Logótipos oficiais simplificados dos métodos de pagamento, em SVG inline.
// Renderizados em pills claras para contraste no checkout escuro.

function LogoPill({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span
      title={label}
      aria-label={label}
      className="flex h-7 items-center justify-center rounded-md bg-white px-2.5 ring-1 ring-black/10"
    >
      {children}
    </span>
  );
}

export function VisaLogo() {
  return (
    <LogoPill label="Visa">
      <svg viewBox="0 0 48 16" className="h-3.5 w-auto" aria-hidden>
        <text
          x="24"
          y="12.5"
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
      </svg>
    </LogoPill>
  );
}

export function MastercardLogo() {
  return (
    <LogoPill label="Mastercard">
      <svg viewBox="0 0 36 22" className="h-4 w-auto" aria-hidden>
        <circle cx="13" cy="11" r="9" fill="#EB001B" />
        <circle cx="23" cy="11" r="9" fill="#F79E1B" fillOpacity="0.92" />
        <path d="M18 4.4a9 9 0 0 1 0 13.2 9 9 0 0 1 0-13.2Z" fill="#FF5F00" />
      </svg>
    </LogoPill>
  );
}

export function ApplePayLogo() {
  return (
    <LogoPill label="Apple Pay">
      <svg viewBox="0 0 50 20" className="h-4 w-auto" aria-hidden>
        <path
          fill="#000"
          d="M8.6 4.2c-.5.6-1.3 1-2 1-.1-.8.3-1.6.7-2.1.5-.6 1.3-1 2-1 .1.7-.2 1.5-.7 2.1m.7 1.2c-1.1-.1-2 .6-2.6.6-.5 0-1.3-.6-2.2-.6C3.4 5.5 2.2 6.2 1.6 7.2c-1.3 2.2-.3 5.5.9 7.3.6.9 1.3 1.8 2.2 1.8.9 0 1.2-.6 2.3-.6s1.4.6 2.3.6c.9 0 1.5-.9 2.1-1.7.7-1 .9-1.9.9-2 0 0-1.8-.7-1.8-2.8 0-1.7 1.4-2.5 1.5-2.6-.8-1.2-2-1.3-2.7-1.8"
        />
        <text
          x="16"
          y="14.5"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="12"
          fontWeight="600"
          fill="#000"
        >
          Pay
        </text>
      </svg>
    </LogoPill>
  );
}

export function GooglePayLogo() {
  return (
    <LogoPill label="Google Pay">
      <svg viewBox="0 0 52 20" className="h-4 w-auto" aria-hidden>
        <path
          fill="#4285F4"
          d="M10.6 10.2c0-.4 0-.8-.1-1.1H5.5v2.1h2.9c-.1.7-.5 1.3-1.1 1.6v1.3h1.8c1-.9 1.5-2.3 1.5-3.9Z"
        />
        <path
          fill="#34A853"
          d="M5.5 15c1.4 0 2.5-.5 3.3-1.2l-1.8-1.3c-.5.3-1.1.5-1.8.5-1.4 0-2.6-.9-3-2.2H.3v1.4C1.2 13.8 3.2 15 5.5 15Z"
        />
        <path fill="#FBBC05" d="M2.2 10.8c-.1-.3-.2-.7-.2-1.1s.1-.8.2-1.1V7.2H.3C.1 7.8 0 8.4 0 9.7s.1 1.9.3 2.5l1.9-1.4Z" />
        <path
          fill="#EA4335"
          d="M5.5 6.4c.8 0 1.4.3 1.9.8l1.6-1.6C8 4.7 6.9 4.2 5.5 4.2 3.2 4.2 1.2 5.4.3 7.2l1.9 1.4c.4-1.3 1.6-2.2 3.3-2.2Z"
        />
        <text
          x="14"
          y="14.5"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="12"
          fontWeight="600"
          fill="#5F6368"
        >
          Pay
        </text>
      </svg>
    </LogoPill>
  );
}

export function MbWayLogo() {
  return (
    <LogoPill label="MB WAY">
      <svg viewBox="0 0 52 16" className="h-3.5 w-auto" aria-hidden>
        <text
          x="26"
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
      className="flex h-7 items-center justify-center rounded-md bg-[#FFB3C7] px-2.5 ring-1 ring-black/10"
    >
      <svg viewBox="0 0 56 16" className="h-3.5 w-auto" aria-hidden>
        <text
          x="28"
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

export function PaymentLogosRow() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <VisaLogo />
      <MastercardLogo />
      <ApplePayLogo />
      <GooglePayLogo />
      <MbWayLogo />
      <KlarnaLogo />
    </div>
  );
}
