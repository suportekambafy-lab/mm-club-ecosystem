# Guia de Linguagem MM Club

Documento central. Qualquer texto visível ao membro segue estas regras.

## Tratamento

- ✓ **tu** ("Continua", "A tua subscrição", "Queres eliminar?")
- ✗ **você**, ✗ "o utilizador deve", ✗ formas impessoais frias

## Ortografia

Português de Portugal (Acordo Ortográfico de 1990).

- ✓ diretamente, ação, ativo, objetivo, período
- ✗ directamente, acção, activo, objectivo

Nunca usar vocabulário do Brasil: ✗ tela, ✗ celular, ✗ time, ✗ excluir, ✗ arquivo, ✗ senha.
Usar: ecrã, telemóvel, equipa, eliminar, ficheiro, palavra-passe.

## Tom

Profissional · Próximo · Direto.
Frases curtas. Sem exageros de marketing dentro da app. Sem emojis em UI.

## Botões e ações (vocabulário único)

| Ação | Usar sempre | Nunca |
| --- | --- | --- |
| Gravar alterações | **Guardar** | Salvar, Save |
| Abandonar | **Cancelar** | Voltar atrás, Sair |
| Apagar definitivamente | **Eliminar** | Remover, Apagar, Delete, Excluir |
| Prosseguir | **Continuar** | Avançar, Seguinte, Próximo |
| Nova entrada | **Adicionar** | Criar novo, Inserir |
| Enviar formulário | **Enviar** | Submeter, Submit |
| Repetir após erro | **Tentar novamente** | Retry, Recarregar |
| Encerrar sessão | **Terminar sessão** | Logout, Sair da conta |

## Mensagens

- **Sucesso** → toast curto, verbo no passado: "Perfil atualizado.", "Cartão adicionado."
- **Erro que impede continuar** → banner inline, explica e dá saída: "Não foi possível carregar as lives. Tentar novamente."
- **Estado vazio** → o que falta + o próximo passo: "Ainda sem publicações. Sê o primeiro a partilhar."
- Nunca mostrar mensagens técnicas cruas ao membro (códigos, stack traces, nomes de tabelas).

## Confirmações destrutivas

Título com a ação ("Eliminar este Short?"), descrição com a consequência ("Esta ação não pode ser desfeita."), botão destrutivo com o verbo exato ("Eliminar").
Nunca `window.confirm()`.

## Datas, moeda e números

- Datas em português: "28 jul 2026", "há 3 horas".
- Moeda: `29,90 €` (vírgula decimal, espaço antes do símbolo).
- Horas em formato 24h.

## Implementação

As etiquetas canónicas estão em `src/lib/language-guide.ts` (`L`). Usa-as em vez de escrever texto de botão à mão.
