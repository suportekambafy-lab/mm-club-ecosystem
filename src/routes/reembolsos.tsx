import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/reembolsos")({
  head: () => ({
    meta: [
      { title: "Política de Reembolsos — MM Club" },
      {
        name: "description",
        content:
          "Garantia de 30 dias no MM Club. Como pedir um reembolso através da Paddle.",
      },
    ],
  }),
  component: RefundsPage,
});

function RefundsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-foreground">
      <h1 className="font-display text-4xl">Política de Reembolsos</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Última atualização: 15 de julho de 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="font-display text-xl">Garantia de 30 dias</h2>
          <p className="mt-2">
            A <strong>Kambafy, LLC</strong> (EIN 38-4416614), operadora do MM Club,
            oferece uma garantia de satisfação de <strong>30 dias</strong>. Se não estiveres
            satisfeito com a tua subscrição no MM Club, podes pedir um reembolso integral no
            prazo de 30 dias após a data da compra.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">Como pedir o reembolso</h2>
          <p className="mt-2">
            Os pagamentos são processados pela Paddle, o nosso Merchant of Record. Para pedir
            um reembolso podes:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>
              Aceder a{" "}
              <a
                className="underline"
                href="https://paddle.net"
                target="_blank"
                rel="noopener noreferrer"
              >
                paddle.net
              </a>{" "}
              com o email usado na compra e submeter o pedido; ou
            </li>
            <li>
              Enviar-nos um email para{" "}
              <a className="underline" href="mailto:geral@mmclub.pt">
                geral@mmclub.pt
              </a>{" "}
              e nós tratamos do processo por ti.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl">Após o período de 30 dias</h2>
          <p className="mt-2">
            Passados 30 dias da compra, os pagamentos deixam de ser reembolsáveis. Podes
            cancelar a subscrição a qualquer momento — o cancelamento evita cobranças futuras
            e mantém o acesso até ao fim do período já pago.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">Contacto</h2>
          <p className="mt-2">
            Qualquer questão relativa a reembolsos:{" "}
            <a className="underline" href="mailto:geral@mmclub.pt">geral@mmclub.pt</a>.
          </p>
        </section>
      </div>

      <div className="mt-10">
        <Link to="/" className="text-sm underline">← Voltar ao início</Link>
      </div>
    </div>
  );
}
