import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos e Condições — MM Club" },
      {
        name: "description",
        content:
          "Termos e Condições do MM Club — acesso, utilização, pagamentos e responsabilidades.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-foreground">
      <h1 className="font-display text-4xl">Termos e Condições</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Última atualização: 15 de julho de 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="font-display text-xl">1. Identificação do vendedor</h2>
          <p className="mt-2">
            Este website e o serviço MM Club (o &ldquo;Serviço&rdquo;) são operados
            por <strong>Kambafy, LLC</strong> (&ldquo;MM Club&rdquo;, &ldquo;nós&rdquo;, &ldquo;nosso&rdquo;),
            sociedade de responsabilidade limitada registada no Wyoming (EUA), EIN <strong>38-4416614</strong>, com morada em 7345 W Sand Lake Rd, Ste 210, Office 1331, Orlando, FL 32819, United States,
            contactável através de{" "}
            <a className="underline" href="mailto:geral@mmclub.pt">geral@mmclub.pt</a>.
            Ao utilizares o Serviço, contratas diretamente com a Kambafy, LLC.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">2. Aceitação</h2>
          <p className="mt-2">
            Ao criares conta, subscreveres ou utilizares o Serviço concordas com estes Termos.
            Se não concordares, não deves utilizar o Serviço.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">3. Descrição do serviço</h2>
          <p className="mt-2">
            O MM Club é um clube privado de educação e comunidade que inclui cursos online,
            lives, ferramentas, templates e acesso a uma comunidade de membros. Os conteúdos
            são disponibilizados online mediante subscrição ativa.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">4. Conta e credenciais</h2>
          <p className="mt-2">
            És responsável por manter a confidencialidade das tuas credenciais e por toda a
            atividade na tua conta. Deves fornecer informação verdadeira e mantê-la atualizada.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">5. Utilização aceitável</h2>
          <p className="mt-2">Não podes utilizar o Serviço para:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Fins ilegais, fraude ou spam;</li>
            <li>Violar direitos de propriedade intelectual de terceiros ou nossos;</li>
            <li>Interferir com a segurança do Serviço (malware, scraping, testes de intrusão);</li>
            <li>Partilhar credenciais ou revender o acesso.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl">6. Propriedade intelectual</h2>
          <p className="mt-2">
            Todos os conteúdos, cursos, materiais, software e marcas do MM Club são propriedade
            do MM Club ou dos seus licenciadores. É concedida uma licença limitada, não exclusiva
            e intransmissível para uso pessoal dentro do plano subscrito. Não é permitida a
            redistribuição, revenda ou engenharia inversa.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">7. Pagamentos e subscrições</h2>
          <p className="mt-2">
            O processamento de encomendas é realizado pelo nosso revendedor online Paddle.com.
            A Paddle.com é o Merchant of Record de todas as nossas encomendas. A Paddle trata
            de todos os pedidos de apoio ao cliente relativos a pagamentos e faturação, incluindo
            reembolsos.
          </p>
          <p className="mt-2">
            As condições de pagamento, faturação, impostos, renovações e cancelamentos regem-se
            pelos{" "}
            <a
              className="underline"
              href="https://www.paddle.com/legal/checkout-buyer-terms"
              target="_blank"
              rel="noopener noreferrer"
            >
              Termos de Comprador da Paddle
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">8. Reembolsos</h2>
          <p className="mt-2">
            Aplica-se a nossa{" "}
            <Link to="/reembolsos" className="underline">
              Política de Reembolsos
            </Link>
            . Oferecemos uma garantia de 30 dias.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">9. Nível de serviço</h2>
          <p className="mt-2">
            Esforçamo-nos por manter o Serviço disponível, mas não garantimos funcionamento
            ininterrupto ou isento de erros. Podem ocorrer interrupções para manutenção.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">10. Suspensão e cessação</h2>
          <p className="mt-2">
            Podemos suspender ou cessar o teu acesso em caso de: violação material destes Termos,
            falta de pagamento, risco de segurança ou fraude, ou violações repetidas das nossas
            políticas.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">11. Limitação de responsabilidade</h2>
          <p className="mt-2">
            Na medida máxima permitida por lei, a nossa responsabilidade agregada está limitada
            ao valor pago por ti nos 12 meses anteriores. Não somos responsáveis por danos
            indiretos, consequenciais ou lucros cessantes. Nada nestes Termos exclui a
            responsabilidade por dolo, morte ou lesões pessoais quando exigido por lei.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">12. Lei aplicável</h2>
          <p className="mt-2">
            Estes Termos regem-se pela lei portuguesa. Os tribunais competentes serão os da
            comarca do vendedor, salvo direitos imperativos do consumidor.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">13. Contacto</h2>
          <p className="mt-2">
            Para qualquer questão sobre estes Termos, contacta{" "}
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
