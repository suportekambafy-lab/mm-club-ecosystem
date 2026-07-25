import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ComingSoon } from "../components/mm/coming-soon";
import { Toaster } from "../components/ui/sonner";

const COMING_SOON_HOSTS = new Set([
  "mmclub.pt",
  "mmclub.online",
  "www.mmclub.online",
  "www.mmclub.pt",
  "mm-club-ecosystem.lovable.app",
]);

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-display text-primary text-sm tracking-[0.3em] uppercase">MM Club</p>
        <h1 className="mt-6 font-display text-7xl text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-medium text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Este caminho não faz parte do clube.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-soft"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-display text-primary text-sm tracking-[0.3em] uppercase">MM Club</p>
        <h1 className="mt-6 font-display text-2xl text-foreground">
          Algo correu mal
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Estamos a investigar. Tenta novamente ou volta ao início.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-soft"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border bg-transparent px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "MM Club" },
      { name: "application-name", content: "MM Club" },
      { title: "MM Club — Ecossistema privado da Marca Milionária" },
      {
        name: "description",
        content:
          "O clube privado da Marca Milionária. Academia, Suporte IA, comunidade, lives e ferramentas para empreendedores portugueses. Premium por design.",
      },
      { name: "author", content: "Marca Milionária" },
      { name: "theme-color", content: "#0d0c0a" },
      { property: "og:title", content: "MM Club — Ecossistema privado da Marca Milionária" },
      {
        property: "og:description",
        content:
          "O clube privado da Marca Milionária. Academia, Suporte IA, comunidade, lives e ferramentas para empreendedores portugueses. Premium por design.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MM Club — Ecossistema privado da Marca Milionária" },
      { name: "twitter:description", content: "O clube privado da Marca Milionária. Academia, Suporte IA, comunidade, lives e ferramentas para empreendedores portugueses. Premium por design." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/bf418ae8-168a-4717-89ff-021ffc2e0334" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/bf418ae8-168a-4717-89ff-021ffc2e0334" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Syne:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const THEME_INIT_SCRIPT = `
try {
  var s = localStorage.getItem('mm.theme');
  var t = s === 'light' || s === 'dark'
    ? s
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.classList.add(t);
  document.documentElement.style.colorScheme = t;
} catch(e) {}
`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Compute coming-soon gate only after hydration to avoid SSR/CSR mismatch
  // (React error #418) — server always renders <Outlet />, client swaps in
  // after mount if the host requires it.
  const [showComingSoon, setShowComingSoon] = useState(false);
  useEffect(() => {
    setShowComingSoon(
      COMING_SOON_HOSTS.has(window.location.hostname) &&
        !window.location.search.includes("preview=1") &&
        window.localStorage.getItem("mm_bypass") !== "1",
    );
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {showComingSoon ? <ComingSoon /> : <Outlet />}
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
