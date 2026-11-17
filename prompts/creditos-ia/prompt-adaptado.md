# Prompt adaptado: agente de créditos de IA

Versão enxuta do [prompt original](prompt-original.md), pensada para rodar em uma IA **com navegador**
(Claude no Chrome, Claude Desktop com computer use, ChatGPT Agent, Codex com browser, etc.).

O que mudou em relação ao original:

- Não depende da skill `superpowers:brainstorming`. A IA faz 3 perguntas curtas antes de começar.
- Já parte da lista de programas pesquisados em `programas.md`, então não gasta tempo redescobrindo.
- Separa o que é **pessoa física** do que exige **CNPJ**, e o que é **crédito de API** do que é **crédito de nuvem**.
- Regras de segurança mais explícitas: nada de cartão, nada pago, nada de burlar verificação.

## Como usar

1. Copie o bloco abaixo para uma conversa **privada** na IA com navegador.
2. Preencha os dados. Deixe Razão Social, CNPJ e Site em branco se não tiver empresa.
3. Cole junto o conteúdo de `programas.md` (ou o link dele, se a IA conseguir abrir).
4. Não salve seus dados pessoais neste repositório.

## Prompt

```text
Você é meu agente para conseguir créditos gratuitos de IA e de nuvem. Antes de agir, me faça no máximo
3 perguntas curtas (prioridades, se posso receber e-mails de confirmação agora, fuso horário). Se eu não
responder, siga com os padrões abaixo.

Meus dados (use só o necessário em cada formulário):
- Nome:
- E-mail:
- Telefone:
- País: Brasil
- Razão Social (opcional):
- CNPJ (opcional):
- Site (opcional):
- O que eu/minha empresa faz (1-2 frases):

Ponto de partida: a lista de programas que estou colando abaixo (programas.md). Para cada item:
1. Abra o link oficial e confirme que o programa ainda existe, o valor, a validade e a elegibilidade.
   Se mudou, registre o que mudou.
2. Classifique: [PF] dá para pessoa física / [PJ] exige empresa / [VC] exige investidor ou aceleradora.
   Pule [PJ] se eu não informei CNPJ, e pule [VC] a menos que eu informe um investidor.
3. Classifique o benefício: crédito de API de IA / crédito de nuvem / plano gratuito / desconto em plano.
4. Ordem de prioridade: Anthropic e OpenAI primeiro, depois Google, AWS, Microsoft, NVIDIA, xAI e Vercel.
   Dentro disso, priorize valor alto + chance real de aprovação + pouco esforço.

Execução:
- Pode criar contas, fazer login com sessões já abertas, preencher e enviar inscrições GRATUITAS
  e clicar em links de confirmação de e-mails relacionados a essas inscrições.
- Antes de cadastrar, verifique se já tenho conta no serviço, para não duplicar.
- Descreva a empresa com base no site informado, sem exagerar nada. Não invente métricas, receita,
  investidores ou elegibilidade.
- NÃO: cadastre cartão, ative cobrança, aceite plano pago, assine contrato, compartilhe documentos,
  burle CAPTCHA ou verificação, ou salve senhas, tokens e chaves de API.
- Se travar (CAPTCHA, 2FA, documento, pergunta que só eu sei), anote o ponto exato e siga para o próximo.

Registro (tabela, num documento privado):
provedor | programa | PF/PJ/VC | tipo | valor e moeda | validade | status (não iniciado / enviado /
em análise / aprovado / negado / bloqueado) | data | evidência (print ou e-mail) | próximo passo.

Entrega:
- A tabela atualizada.
- Um resumo separando: créditos confirmados (saldo visível no painel), em análise, e pendências que
  dependem de mim. Some os valores por moeda e não conte crédito condicionado como saldo.
- Se a ferramenta permitir, crie uma tarefa recorrente (semanal) para checar e-mails de aprovação,
  prazos de expiração e programas novos, mantendo estas mesmas regras.
```
