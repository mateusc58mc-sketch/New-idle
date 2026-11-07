# Aetheria — Idle RPG 2D (Torre + RMT)

Mapa de processo e estrutura de pastas. **Etapa 1 concluída**: estrutura + `src/types/game.ts`.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | Next.js (App Router) + TypeScript estrito (sem `any`) |
| Estilo | Tailwind CSS (dark/fantasy, glow por raridade) |
| Backend | Supabase (Auth, Postgres, Storage, Realtime) |
| Render | Paperdoll 2D em camadas (DOM/CSS, animação por sprite-sheet) |

## Árvore

```
aetheria/
├─ src/
│  ├─ app/
│  │  ├─ (game)/                 # route group autenticado, shell com HUD
│  │  │  ├─ tower/               # loop idle: andares, waves, boss
│  │  │  ├─ character/           # atributos, talents, paperdoll grande
│  │  │  ├─ inventory/           # itens, refino, sockets, cartas
│  │  │  ├─ market/              # leilão P2P / RMT
│  │  │  └─ temple/              # sorteio de skills + pity
│  │  └─ api/health/             # route handler de liveness
│  ├─ components/
│  │  ├─ paperdoll/              # PaperdollAvatar.tsx (camadas PNG)
│  │  ├─ combat/                 # DamageMeter, FloatingNumbers, BossBar
│  │  ├─ squad/                  # SquadCard, FormationPicker
│  │  ├─ market/                 # ListingCard, Filters
│  │  └─ ui/                     # primitivas (Button, Panel, RarityFrame)
│  ├─ hooks/                     # useGameLoop, useCombat, usePaperdoll
│  ├─ lib/
│  │  ├─ game/                   # stats, formulas, rng, targeting, guards
│  │  └─ supabase/               # client, server, mappers, queries
│  ├─ data/                      # catálogo estático (races, classes, skills, items)
│  ├─ types/                     # game.ts (fonte de verdade)
│  └─ styles/                    # tokens de raridade e tema
├─ public/assets/
│  ├─ paperdoll/{races,armor,helmet,weapon,wings,aura,vfx}
│  ├─ backgrounds/
│  └─ ui/
├─ supabase/migrations/          # SQL versionado
└─ docs/
```

## Pipeline de etapas

| # | Entrega | Estado |
| --- | --- | --- |
| 1 | Estrutura de pastas + `types/game.ts` | ✅ |
| 2 | `package.json`, `tsconfig` estrito, Tailwind, `next.config`, env | ⏳ |
| 3 | `lib/game/`: rng determinístico, guards, fórmulas (ATK/MATK/HIT/FLEE/CRIT/ASPD), derivados | ⏳ |
| 4 | `data/`: raças, classes, skills, itens, andares, tabelas de drop | ⏳ |
| 5 | `hooks/useGameLoop.ts` (RAF + acumulador fixo) e `hooks/useCombat.ts` (waves, targeting, boss) | ⏳ |
| 6 | `components/paperdoll/PaperdollAvatar.tsx` + `usePaperdoll` (resolvedor de camadas) | ⏳ |
| 7 | UI da Torre (Arena-like: Front/Mid/Back, Damage Meter, HP/MP, auto) | ⏳ |
| 8 | Supabase: migrations, RLS, RPC de progresso e mercado com escrow | ⏳ |
| 9 | Mercado/RMT: anúncios, filtros, taxa, transacções, auditoria | ⏳ |
| 10 | Progresso offline (cap 8h) + reconciliação server-side | ⏳ |

## Fronteiras arquitecturais (não violar)

- **Cliente é apresentação.** Nenhuma mutação de moeda, inventário, andar ou mercado acontece no cliente; o cliente envia intenção, o servidor valida e devolve snapshot.
- **`types/game.ts` não importa nada.** É a raiz do grafo de tipos.
- **Domínio é camelCase; Postgres é snake_case.** Conversão só em `lib/supabase/mappers.ts`.
- **Loop determinístico.** `CombatState` carrega `seed` + `rngCursor`; o mesmo seed reproduz a luta (testes e anti-cheat).
- **Paperdoll é dado, não componente.** `PaperdollAvatar` recebe `PaperdollState` resolvido; nada de lógica de jogo dentro do render.

## Decisões ainda abertas (herdadas da wiki)

- Intervalo `X` entre bosses e regra de checkpoint ao morrer.
- Fórmula final de mitigação (`HP / Defesa` é ambígua).
- Fórmula de dano unificada + ordem de multiplicadores.
- Escopo exacto de RMT, moedas e conversões (validar com a plataforma/legislação).
- CSS/DOM vs Canvas para o Paperdoll (decidir após protótipo com 4 avatares).
