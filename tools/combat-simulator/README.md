# Talune — Simulador de Combate MVP

Primeiro protótipo independente para testar combate automático antes de integrar o sistema à interface do jogo.

> Atenção: o repositório já possui um motor de combate mais completo em `src/lib/game/combat.ts`. Esse motor é a base de produção a ser auditada e testada. Este simulador independente é apenas um protótipo histórico de balanceamento, não deve ser tratado como uma segunda fonte de verdade.

## Requisitos

- Node.js 22 ou superior.
- Nenhuma dependência externa.

## Executar

Na pasta `tools/combat-simulator/`:

```powershell
node --experimental-strip-types .\combat-simulator.ts
node --experimental-strip-types .\combat-simulator.ts --boss
node --experimental-strip-types .\combat-simulator.test.ts
```

## O que já está implementado

- Party configurável de 1 a 4 personagens.
- Fila de prioridade de habilidades por personagem.
- Habilidade indisponível é ignorada; usa a próxima disponível ou ataque básico.
- ASPD controla somente ataques básicos.
- Haste reduz recargas de habilidades, sem alterar ASPD.
- Cura prioriza aliado com menor percentual de HP.
- Monstro ataca periodicamente e escolhe um membro vivo.
- Chefe com golpe especial anunciado, janela de reação e transição de fase por percentual de HP.
- Seed determinística, registro de eventos e métricas por personagem.

## Parâmetros provisórios

Atributos, HP, dano, defesa, ASPD, Haste, recargas e fórmulas são valores de teste, não balanceamento final aprovado.

## Limitações conhecidas

- Fórmula simplificada: `max(1, ataque - defesa * 0.5)`.
- Sem crítico, esquiva, precisão, resistência elemental, buffs/debuffs complexos ou múltiplos inimigos simultâneos.
- A fase 2 do chefe registra a transição, mas ainda não altera seu conjunto de habilidades.
- Esta é uma bancada de balanceamento simplificada, não o motor principal nem o servidor autoritativo.

## Próximas melhorias

O próximo trabalho principal deve usar diretamente `src/lib/game/combat.ts`, construir fixtures e executar baterias de simulação determinísticas. Consulte `docs/TALUNE_HANDOFF.md` para as divergências identificadas e o plano.
