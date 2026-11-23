# Programas de créditos de IA e nuvem (atualizado em 23/11/2026)

> Para todos os outros benefícios (ferramentas para estudante, outros provedores de IA, SaaS e programas brasileiros), veja [varredura-completa.md](varredura-completa.md).

Lista de partida para o [prompt adaptado](prompt-adaptado.md). Os valores mudam com frequência:
**confira sempre o link oficial antes de se inscrever.**

**Legenda**
- **[PF]** dá para pessoa física · **[PJ]** exige empresa/CNPJ · **[VC]** exige investidor ou aceleradora parceira
- **Confiança:** ✅ lido na página oficial · 🔎 trecho oficial via busca (página bloqueada na rede da pesquisa) · ⚠️ só fontes de terceiros, conflitante ou provavelmente encerrado

## 1. O que uma pessoa física no Brasil consegue agora (sem CNPJ)

| # | Programa | Valor | Precisa | Cobre | Link |
|---|---|---|---|---|---|
| 1 | AWS Free Tier (conta nova) | até US$200 (US$100 + US$100 por tarefas), 6 meses no plano Free | Nunca ter tido conta AWS. Desde out/2026, "a maioria dos clientes novos" não precisa de cartão | Nuvem; o Bedrock está disponível no plano Free, mas ⚠️ nenhuma página oficial diz que o crédito paga o Claude (cobrado via Marketplace) | aws.amazon.com/free ✅ |
| 2 | Google Cloud Free Trial | US$300 / 90 dias | Cartão; nunca ter usado GCP pago | **Para cadastros desde 16/11/2026, NÃO paga Gemini/Vertex, Gemini API, modelos de parceiros (Claude), GPUs nem Marketplace.** Serve só para nuvem comum | docs.cloud.google.com/free/docs/free-cloud-features ✅ |
| 3 | Gemini API, nível grátis (AI Studio) | Grátis, limites baixos; modelos Flash | Conta Google; dados podem ser usados pelo Google | API Gemini | aistudio.google.com 🔎 |
| 4 | Azure free account | US$200 / 30 dias | Cartão de crédito | Qualquer serviço da Microsoft fora da lista grátis (Azure OpenAI provavelmente incluída, mas sem texto oficial explícito). **Claude vetado** em free trial | azure.microsoft.com/free ✅ |
| 5 | NVIDIA Developer Program / NIM API | **Acesso grátis e ilimitado para prototipagem** (sem crédito numerado); produção exige licença | Só cadastro | Modelos abertos via NIM | developer.nvidia.com/nim ✅ |
| 6 | Vercel AI Gateway (free tier) | US$5 a cada 30 dias | Conta Vercel (perde o grátis se comprar créditos) | 109 modelos (GPT-5, Gemini Flash, Llama, Mistral, Qwen…). **Nenhum modelo Claude** | vercel.com/ai-gateway/models ✅ |
| 7 | v0 Free | US$5/mês + 7 msgs/dia | Conta Vercel | v0 | v0.app/pricing ⚠️ |
| 8 | Anthropic, créditos de conta nova | ⚠️ provavelmente não existe mais: a ajuda oficial manda adicionar saldo pago | — | API Claude | support.claude.com/en/articles/8114531 ✅ |

**Se você se encaixa em algum perfil especial:**

| Perfil | Programa | Valor | Link |
|---|---|---|---|
| Mantenedor/contribuidor OSS relevante | Claude for Open Source | 6 meses de Claude Ultra grátis | claude.com/contact-sales/claude-for-oss ✅ |
| Mantenedor OSS | Codex for Open Source (OpenAI) | 6 meses de ChatGPT Pro com Codex + créditos do Codex Open Source Fund (US$1M) | developers.openai.com/community/codex-for-oss ✅ |
| Líder de comunidade que usa Claude | Claude Community Ambassadors | créditos mensais de API (valor não publicado) | claude.com/community/ambassadors ✅ |
| Pesquisador (qualquer um) | Anthropic AI for Science | **até US$50k em API por projeto** | anthropic.com/news/expanding-support-for-scientists ✅ |
| Pesquisador | OpenAI Researcher Access | até US$1.000 em API / 12 meses; **próxima rodada de análise em dezembro** | openai.com/form/researcher-access-program ✅ |
| Pesquisador acadêmico | **ChatGPT for Academic Researchers** (novo) | ChatGPT Plus grátis para o pesquisador + 2 colaboradores; 50 mil bolsas, **por ordem de chegada, abriu em 23/11/2026**; não inclui API | chatgpt.com/academic-researchers/apply ✅ |
| PI (líder de grupo de pesquisa) | Claude Team for Scientists | assento Standard grátis por 12 meses | claude.com/programs/team-plan-for-scientists ✅ |
| Professor/pesquisador | Google Cloud for Education | US$100/professor, US$50/aluno; pesquisa US$5k | cloud.google.com/edu ✅ |
| Estudante | Azure for Students | US$100 / 12 meses, **sem cartão** | azure.microsoft.com/free/students ✅ |
| Estudante universitário (18+) | Google AI Plus | 12 meses (app, não API); resgate até 31/12/2026; depois R$24,99/mês | one.google.com/ai-student 🔎 |
| Estudante | Claude Campus | bolsa US$3.600 + API para o clube; **fechado até o próximo ciclo** | claude.com/programs/campus ✅ |
| Assinante pago Claude Max/Ultra/Team | Créditos de API inclusos | US$100/mês (Max), US$200/mês (Ultra), Team até US$500/mês compartilhados; não cobre Claude Code | platform.claude.com/docs/en/about-claude/api-credits-for-subscribers ✅ |
| Assinante ChatGPT Pro/Business | Créditos de API inclusos | Pro US$100/200/500 por mês; Business US$20–100 por assento, teto de US$500 | developers.openai.com/api/docs/guides/chatgpt-api-credits ✅ |
| Assinante Google AI Pro/Ultra | Google Developer Program | US$10–100/mês em créditos Cloud | developers.google.com/program 🔎 |
| Quem faz trilhas da NVIDIA | NVIDIA Developer Program "Earn Credits" (novo) | créditos Google Cloud/NVIDIA ao concluir trilhas; valor não publicado | developer.nvidia.com/developer-program ✅ |
| ONG | Claude for Nonprofits / OpenAI for Nonprofits | desconto em plano Team/Business (não é API) | claude.com/solutions/nonprofits ✅ |

## 2. Com empresa (CNPJ, site e e-mail no domínio)

| Programa | Tag | Requisitos principais | Valor | Link |
|---|---|---|---|---|
| AWS Activate Founders | [PJ] | self-funded, pré-Série B, ≤10 anos, **conta no plano Paid** (o Free não recebe Activate), e-mail corporativo | **US$1.000, alguns selecionados até US$5.000**; cobre Claude no Bedrock | aws.amazon.com/startups/credits ✅ |
| Kiro Startup Credits (AWS, novo) | [PJ] | sem créditos Activate em uso; e-mail no domínio; estágio máximo Série A ou B (fontes divergem) | até 1 ano de Kiro Pro+ para 2, 10 ou 30 usuários | kiro.dev/startups 🔎 |
| Google for Startups Cloud: Start | [PJ] | ≤2 anos, MVP, plano de captar | US$2.000 | cloud.google.com/startup/apply ✅ |
| Grok for Startups (xAI) | [PJ] | **aplicação direta** (há também trilha via VC); e-mail corporativo; valor depende de captação, receita e gasto com IA | ~6 meses de uso; 20% na aprovação, créditos expiram em 6 meses | x.ai/startups/apply 🔎 |
| NVIDIA Inception | [PJ] | empresa constituída, <10 anos, site, usa tecnologia NVIDIA; **exclui consultorias** | sem crédito próprio fixo; acesso a parceiros (ex.: Lambda US$1.000) | nvidia.com/en-us/startups ✅ |
| Microsoft for Startups | [PJ] | empresa privada com fins lucrativos; **exclui consultorias e agências** ✅ | US$200 iniciais (doc de 20/11) ou US$1.000 (outra página) ⚠️; até US$5k com verificação; não cobre Claude | learn.microsoft.com/en-us/startups ✅ |
| Programas AWS regionais (RJ / RS / Startup Inception) | [PJ] | editais locais + Activate | RJ até R$25,5 mil; RS até US$5 mil | editais municipais/estaduais ⚠️ |

## 3. Com investidor ou aceleradora parceira

| Programa | Tag | Valor | Link |
|---|---|---|---|
| Google for Startups Cloud: Scale | [VC] | até US$200k em 2 anos | cloud.google.com/startup/apply ✅ |
| Google for Startups Cloud: AI (startups construídas sobre Gemini) | [VC] | até US$350k em 2 anos | cloud.google.com/startup/ai ✅ |
| AWS Activate Portfolio | [VC] | **até US$200k** (precisa do Org ID do provider) | aws.amazon.com/startups/credits ✅ |
| AWS Credits for AI Startups (novo) | convite | US$200k ou mais, só por convite depois do Portfolio | aws.amazon.com/startups/credits ✅ |
| OpenAI for Startups | [VC] | créditos de API (valor não publicado), precisa de código do VC | openai.com/business/why-openai/startups ✅ |
| Vercel for Startups | [VC] | até US$30k em Flexible Commitment + acesso Enterprise | vercel.com/startups ✅ |
| AWS Generative AI Accelerator | seleção | até US$1M; janela 2026 fechou | aws.amazon.com/startups/accelerators/generative-ai 🔎 |
| Google for Startups Accelerator: Brasil | seleção | mentoria + créditos; exige receita; turma 2026 fechada (costuma abrir em janeiro) | startup.google.com/programs/accelerator/brazil ✅ |

## 4. Fechados ou encerrados (não gastar tempo agora)

- **Claude for Startups (Anthropic):** coorte cheia, inscrições fechadas desde 13/10/2026 (continua assim em 23/11) ✅.
- **OpenAI Grove:** só existiu a coorte de jan/2026 ✅.
- **Codex for Students / ChatGPT Back to School:** só EUA/Canadá; o segundo encerrou em 31/10/2026 ✅.
- **xAI:** não há mais crédito grátis mensal; a documentação de cobrança só fala em pré-pago ✅.
- **Vercel AI Accelerator:** coorte 2026 encerrada ✅.
- **Vercel Open Source Program:** inscrições fechadas; o valor era US$3.600 ao longo de 3 anos ✅.

## 5. Pegadinhas

- **Claude via Azure:** créditos de free trial, Students e startup **não** podem ser usados com Claude no Foundry ✅. Houve caso de conta de US$17,6k por isso.
- **Claude via AWS:** créditos Activate valem para Claude no Bedrock ✅. Para o crédito do Free Tier, não há confirmação.
- **Google Cloud trial:** para contas criadas desde 16/11/2026, **não serve para IA** ✅.
- **Vercel AI Gateway grátis:** não inclui Claude ✅.
- **Créditos de assinante (Claude Max/ChatGPT Pro):** são para a API, **não** para Claude Code ou Codex.
- **Nível grátis do Gemini:** seus dados podem ser usados para treinar; não envie nada sensível.
- Nunca cadastre cartão "só para testar" sem configurar **alerta de orçamento** na conta. O plano Paid da AWS aceita limite de gasto a partir de US$20.

## Pendências de verificação

- Se o crédito do AWS Free Tier paga Claude no Bedrock.
- Valor inicial do Microsoft for Startups (US$200 ou US$1.000).
- Se o crédito do Azure free cobre Azure OpenAI (provável, sem texto explícito).
- v0 Free, Gemini API free tier e Google Developer Program (domínios bloqueados na pesquisa).
