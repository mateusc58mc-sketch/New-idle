# Aetheria — Idle RPG 2D (Torre + RMT)

Idle RPG de navegador com avatares padronizados em **Paperdoll 2D**, progressão
automática de squad, torre de andares e ecossistema de mercado/cosméticos.

**Stack:** Next.js (App Router) · TypeScript estrito (sem `any`) · Tailwind CSS · Supabase

---

## Estado do projeto

| Etapa | Entrega | Estado |
| --- | --- | --- |
| 1 | Estrutura de pastas + `types/game.ts` | ✅ |
| 2 | Config + motor de combate determinístico + fórmulas + progressão | ✅ |
| 3 | Catálogos (9 raças, 4 classes, 8 specs, 96 talentos, 32 skills, 20 itens, 30 andares) + Paperdoll | ✅ |
| 4 | Executor de efeitos, sorteio de loot, máquina de estados da torre | ✅ |
| 5 | Integração no `advanceCombat` + HUD real + floating combat text | ⚠️ 178/180 testes |
| 6 | Supabase: migrations, RLS, persistência | ⏳ |

> **Nota sobre a etapa 5:** dois testes de integração estão em investigação
> (`cooldown impede o MESMO skill de repetir`, `wave completa resolve`).
> A lógica de cooldown foi corrigida e validada por probe; a transição de fase
> ainda não está fechada. Ver `src/lib/game/integration.test.ts`.

---

## Estrutura

```
src/
├─ app/(game)/{tower,character,inventory,market,temple}/   rotas autenticadas
├─ app/api/health/
├─ components/
│  ├─ paperdoll/PaperdollAvatar.tsx      camadas PNG sobrepostas
│  ├─ combat/ArenaView.tsx               HUD ligado ao motor
│  └─ combat/FloatingCombatText.tsx      números de dano/cura
├─ hooks/{useGameLoop,useCombat,usePaperdoll,useFloatingText}.ts
├─ lib/game/
│  ├─ balance.ts       todos os parâmetros de tuning
│  ├─ formulas.ts      ATK/MATK/HIT/FLEE/CRIT/ASPD/DEF/dano/XP
│  ├─ rng.ts           xorshift128 determinístico
│  ├─ stats.ts         resolução de stats derivados
│  ├─ combat.ts        motor puro + castSkills + spawnWave
│  ├─ skills.ts        executor de DoT/HoT/shield/buff/control
│  ├─ drops.ts         sorteio de loot e raridade por andar
│  ├─ tower.ts         máquina de estados andar/wave/chefe/checkpoint
│  ├─ actors.ts        Character/Monster → Combatant
│  ├─ progression.ts   sistema híbrido de pontos
│  └─ paperdoll.ts     resolvedor de camadas
├─ data/                catálogos estáticos
├─ types/game.ts        fonte de verdade (1.400 linhas)
└─ styles/rarity.css    tokens de raridade

docs/                   demos estáticos das etapas 2–5
supabase/migrations/    SQL versionado
public/assets/          arte (PNGs de camada ainda por produzir)
```

## Princípios

1. **O motor é puro.** `advanceCombat(state, dt, {rng, now})` não toca em React,
   DOM nem `Math.random()`. O mesmo seed reproduz a mesma luta — o servidor pode
   reexecutar e validar.
2. **Cliente é apresentação.** Nenhuma mutação de moeda, inventário ou andar
   acontece no cliente.
3. **Paperdoll é dado.** `resolvePaperdoll()` é função pura; o componente só
   faz `map()`. Inventário, mercado e squad usam a mesma resolução.
4. **Âncoras partilhadas.** As 9 raças passam pela mesma função de construção —
   é estruturalmente impossível desalinhar uma raça.

## Comandos

```bash
npm install
npm run dev          # desenvolvimento
npm run typecheck    # tsc --noEmit (strict)
npm test             # vitest (180 testes)
```

## Variáveis de ambiente

Copiar `.env.example` para `.env.local` e preencher:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — **apenas** em route handlers/server actions
