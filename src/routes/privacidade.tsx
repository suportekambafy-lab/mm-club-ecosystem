import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — MM Club" },
      {
        name: "description",
        content:
          "Como o MM Club recolhe, utiliza e protege os teus dados pessoais.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-foreground">
      <h1 className="font-display text-4xl">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Última atualização: 15 de julho de 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="font-display text-xl">1. Responsável pelo tratamento</h2>
          <p className="mt-2">
            O responsável pelo tratamento dos teus dados pessoais é{" "}
            <strong>Kambafy, LLC</strong>, sociedade registada no Wyoming (EUA),
            EIN <strong>38-4416614</strong>, com morada em 7345 W Sand Lake Rd, Ste 210, Office 1331, Orlando, FL 32819, United States, que opera o serviço MM Club.
            Contacto:{" "}
            <a className="underline" href="mailto:geral@mmclub.pt">geral@mmclub.pt</a>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">2. Dados que recolhemos</h2>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Dados de conta: nome, email, palavra-passe (encriptada), avatar;</li>
            <li>Dados de utilização: cursos vistos, progresso, interações na comunidade;</li>
            <li>Dados técnicos: endereço IP, identificadores de dispositivo, logs;</li>
            <li>Comunicações: mensagens de suporte que nos envias;</li>
            <li>
              Dados de pagamento: geridos diretamente pela Paddle enquanto Merchant of Record —
              não armazenamos dados de cartão.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl">3. Finalidades e base legal</h2>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Criar e gerir a tua conta — execução do contrato;</li>
            <li>Prestar o Serviço, incluindo acesso a cursos e comunidade — execução do contrato;</li>
            <li>Prevenção de fraude e segurança — interesse legítimo;</li>
            <li>Suporte ao cliente — execução do contrato;</li>
            <li>Melhoria do produto — interesse legítimo;</li>
            <li>Comunicações de marketing — consentimento (podes retirar a qualquer momento);</li>
            <li>Cumprimento de obrigações legais e fiscais — obrigação legal.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl">4. Partilha de dados</h2>
          <p className="mt-2">Partilhamos dados apenas com:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>
              <strong>Paddle</strong> — Merchant of Record para venda, gestão de subscrições,
              processamento de pagamentos, faturação e conformidade fiscal;
            </li>
            <li>
              Prestadores de serviço (subprocessadores) — alojamento cloud, envio de email,
              analytics, ferramentas de suporte;
            </li>
            <li>Aconselhamento profissional — jurídico, contabilístico;</li>
            <li>Autoridades — quando exigido por lei.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl">5. Transferências internacionais</h2>
          <p className="mt-2">
            Alguns subprocessadores podem estar sediados fora do EEE. Nesses casos, garantimos
            salvaguardas adequadas (Cláusulas Contratuais Tipo da UE ou decisões de adequação).
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">6. Conservação</h2>
          <p className="mt-2">
            Conservamos os dados pelo tempo necessário para prestar o Serviço e cumprir
            obrigações legais (nomeadamente fiscais). Após esse período, os dados são eliminados
            ou anonimizados.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">7. Os teus direitos (RGPD)</h2>
          <p className="mt-2">Tens direito a:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Aceder aos teus dados;</li>
            <li>Retificar dados incorretos;</li>
            <li>Solicitar o apagamento;</li>
            <li>Limitar ou opor-te ao tratamento;</li>
            <li>Portabilidade dos dados;</li>
            <li>Retirar consentimento a qualquer momento;</li>
            <li>Reclamar junto da CNPD (www.cnpd.pt).</li>
          </ul>
          <p className="mt-2">
            Para exercer estes direitos escreve para{" "}
            <a className="underline" href="mailto:geral@mmclub.pt">geral@mmclub.pt</a>.
            Respondemos no prazo de 1 mês.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">8. Segurança</h2>
          <p className="mt-2">
            Aplicamos medidas técnicas e organizativas adequadas — encriptação em trânsito,
            controlos de acesso, monitorização — para proteger os teus dados.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">9. Cookies</h2>
          <p className="mt-2">
            Usamos cookies essenciais para autenticação e funcionamento do site. Cookies de
            analytics são utilizados apenas com consentimento e podes gerir preferências no teu
            navegador.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl">10. Contacto</h2>
          <p className="mt-2">
            Questões sobre privacidade:{" "}
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
