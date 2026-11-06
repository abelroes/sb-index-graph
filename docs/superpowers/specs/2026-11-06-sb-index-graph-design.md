# sb-index-graph — Design

**Data:** 2026-11-06  
**Status:** draft para revisão  
**Repo:** `sb-index-graph`

## 1. Problema

Tornar um space SilverBullet um second-brain útil para agentes de IA (Cursor, Claude, Kimi, etc.): leitura/escrita já existem via MCP nativo; falta **recuperação estruturada** — o agente deve decidir com um recorte relevante do índice (tags, relações, conexões), sem varrer o space inteiro nem aplicar cotas arbitrárias de “N páginas”.

## 2. Decisão de abordagem (o que *não* somos)

| Opção | Veredito |
|---|---|
| **Graphify** | Canhão para formiga neste escopo. Brilha em AST/código e grafo de projetos; o corpus aqui é o **space SB** (um Git). Não entra no v1. |
| **RAG vetorial próprio** | Mesmo *job* (recuperação seletiva), mecanismo diferente. SB já tem busca; o gap real é **conexões no índice**, não embeddings. Fora do v1. |
| **Ahmad-A0/silverbullet-mcp** | Bridge CRUD maduro; redundante com MCP nativo em multi-space/Desktop. Não é camada de grafo. Fora do v1. |
| **Só skills de agente (Cursor/etc.)** | Sem lógica no SB o agente improvisaria `search`+`read`. Insuficiente como núcleo. |
| **Plug TypeScript no SB** | Padrão *secundário*. Doc oficial: começar por Library/Space Lua. Plug TS só se o spike mostrar limite real. |
| **Library Space Lua + skills `meta/skill`** | **Escolhida.** Padrão primário de extensão do SB; uma implementação para todos os clientes MCP. |

**Nome:** `sb-index-graph` — enfatiza o **índice** de objetos/relações/tags, não o Graph View (UI humana).

## 3. Objetivos e não-objetivos

### Objetivos (v1)

- Expor consulta ao índice de relações/tags do space como API Space Lua consumível via MCP `lua`.
- Devolver recortes **semanticamente** determinados (relevância, ciclo/comunidade local), não limites fixos de páginas/tokens.
- Skills mínimas (`meta/skill`) que ensinam o agente a preferir essa API antes de leitura em massa.
- Distribuir como **Library** instalável (GitHub + Library Manager).
- Código simples: DRY, YAGNI, Clean Code, manutenível.

### Não-objetivos (v1)

- Indexar ou “digerir” repositórios de código externos (preocupação herdada do Graphify; o space é um único Git).
- Graphify, Neo4j, embeddings, servidor MCP paralelo.
- Finetuning elaborado de skills (esperado em versões seguintes).
- Plug TypeScript, UI rica além de no máximo 1–2 commands espelho opcionais.
- Fallback para `search`+`read` quando Lua estiver indisponível.

## 4. Arquitetura

Três camadas, responsabilidades claras:

1. **MCP nativo do SilverBullet** — transporte e CRUD (`help`, `read`, `write`, `edit`, `search`, `lua`, `screenshot`). Não reimplementar.
2. **Library `sb-index-graph`** — única dona da lógica de recuperação sobre o índice SB (vizinhos, path, digest).
3. **Agente** — interpreta o resultado e age; skills orientam o protocolo de uso.

```
Agente (Cursor / Claude / …)
    │  MCP nativo (CRUD + lua)
    ▼
SilverBullet (multi-space / Desktop)
    │  índice tags + relations (mesmo do Graph View)
    ▼
Library sb-index-graph (Space Lua + meta/skill)
```

**Fonte de verdade:** índice de objetos/relações/tags do SB. Sem índice paralelo no v1.

**Pré-requisito de runtime:** Runtime API habilitado no space (necessário para `lua`). Sem isso, a ferramenta está **indisponível**.

## 5. Componentes

### 5.1 API Space Lua (núcleo)

| Função | Entrada | Saída |
|---|---|---|
| `neighbors(page, opts?)` | página âncora; opts: kinds de relação e critérios de expansão semântica (não cota fixa de páginas) | nós ligados + tipos de relação + evidência curta já no índice |
| `path(from, to, opts?)` | duas páginas; opts: critério de parada da busca | caminho ordenado ou ausência explícita |
| `digest(anchor, opts?)` | âncora = página, tag ou consulta textual resolvida no índice | subgrafo/resumo fechado pela estratégia de expansão + evidência suficiente para decidir |

Nomes finais dos módulos/funções seguem convenções Space Lua da library (`Library/...`); a superfície acima é o contrato externo.

**Removido do contrato:** `pointers()` / qualquer API voltada a repos externos.

### 5.2 Estratégia de expansão (digest)

O que limita o contexto **não** é cota arbitrária (N páginas, budget de tokens).

Critérios admitidos (implementação concreta no plan; YAGNI até o spike validar o mínimo):

- Relevância de relação/tag a partir da âncora.
- Fechamento de ciclo ou comunidade local (parar quando o próximo hop não acrescenta sinal).
- Evidência já presente no índice preferida a `read` em massa.

`read` pontual via MCP só quando um nó específico no digest exigir o corpo da página e a evidência indexada for insuficiente — motivado pela relevância do grafo, não por lista “top N”.

**Fora do v1:** políticas de truncation/budget estourado.

### 5.3 Skills (`meta/skill`)

- Mínimas no v1: quando chamar `digest` / `path` / `neighbors`; não varrer o space; write-back opcional de lições (formato fino depois).
- Finetuning esperado em versões posteriores — não bloquear o v1.

### 5.4 Commands humanos (opcional, YAGNI)

No máximo 1–2 commands que espelham a API para debug humano. Não são o produto.

## 6. Fluxo de dados

1. Agente chama `help` / carrega skill da library.
2. Agente invoca `digest` / `path` / `neighbors` via MCP `lua`.
3. A library consulta o índice SB e aplica a estratégia de expansão.
4. Agente decide com o resultado; `read`/`write`/`edit` só quando o grafo indicar necessidade pontual.
5. Write-back de aprendizado: convenção da skill (evoluir depois).

## 7. Erros e degradação

| Situação | Comportamento |
|---|---|
| Runtime Lua / Runtime API indisponível | **Falha explícita.** Ferramenta indisponível. Sem improvisar com `search`+`read`. |
| Página inexistente ou aspirante | Resposta explícita; sem inventar nós. |
| Path inexistente sob o critério de busca | `not_found` (ou equivalente claro); sem arestas inventadas. |
| Space pouco linkado / pouco tagueado | Digest pobre; esperado — a library não “alucina” conexões. |

## 8. Distribuição e layout do repo

- Repo GitHub `sb-index-graph`, instalável como Library no SB (prefixo `Library/` conforme convenção).
- Spec e plans em `docs/superpowers/`.
- Conteúdo da library (Space Lua + skills) como páginas Markdown do space, versionadas neste repo.
- Deploy do usuário: Docker multi-space + Desktop; space versionado no GitHub — a library instala nesse space.

## 9. Testes e critério de sucesso

### Automatizáveis / fixtures

- Space fixture pequeno com tags e relações conhecidas.
- `neighbors` retorna o conjunto esperado.
- `path` encontra caminho existente e reporta ausência corretamente.
- `digest` fecha um recorte coerente sem inventar arestas.
- Sem Runtime → erro explícito (quando testável no harness escolhido).

### Sucesso manual (v1)

Numa pergunta real no space do usuário, o agente responde com base no digest (e no máximo `read` pontual motivado pelo grafo), **sem** varrer o space.

## 10. Princípios de implementação

- **DRY / YAGNI / Clean Code:** API pequena; uma fonte de verdade; sem camadas “para o futuro”.
- Reutilizar o modelo mental que o SB já incentiva (tags, relações) — flexibilidade por caso de uso fica no conteúdo do space, não em configuração complexa da library.
- Separação: MCP conecta; library recupera; agente consome.

## 11. Roadmap curto (fora do plano de implementação imediato)

- Finetuning de skills.
- Plug TypeScript só se Lua/índice forem insuficientes.
- Reavaliar Graphify/RAG apenas se o *job* mudar (ex.: recuperação por similaridade vetorial passar a ser o gargalo).

## 12. Abertas para o plan de implementação (não bloqueiam este design)

- Forma exata de resolver “consulta textual” → âncora no índice (pode ser tag, página, ou busca mínima *dentro* da library — detalhar no plan sem expandir escopo).
- Empacotamento preciso da Library (páginas, `Library/` paths, README de install).
- Harness de teste (fixtures Markdown + runner Space Lua vs. asserts manuais no primeiro slice).
