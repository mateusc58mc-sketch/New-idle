# Talune — Simulador de Combate MVP

Primeiro protótipo independente para testar combate automático antes de integrar o sistema à interface do jogo.

## Requisitos

- Node.js 22 ou superior.
- Nenhuma dependência externa.

## Executar

Na pasta deste arquivo:

```powershell
node --experimental-strip-types .\combat-simulator.ts
```

Para simular o chefe:

```powershell
node --experimental-strip-types .\combat-simulator.ts --boss
```

O Node 22 pode mostrar um aviso de que o suporte a TypeScript por remoção de tipos ainda é experimental. Isso não impede a execução deste protótipo.

## O que já está implementado

- Party configurável de 1 a 4 personagens.
- Fila de prioridade de habilidades por personagem.
- Habilidade indisponível é ignorada; o personagem usa a próxima habilidade disponível ou o ataque básico.
- Ataques básicos usam ASPD.
- Haste reduz recargas de habilidades e não altera ASPD.
- Habilidades de cura priorizam o aliado com menor percentual de HP e são ignoradas quando ninguém precisa de cura.
- Monstro ataca periodicamente e escolhe um membro vivo da party.
- Chefe tem golpe especial anunciado, tempo de reaãão e segunda fase por percentual de HP.
- Seed determinística para repetir os mesmos resultados.
- Registro de eventos e resumo de vitória, derrota ou timeout.

## Parâmetros provisórios

Os atributos, HP, dano, defesa, ASPD, Haste, recargas e fórmulas no arquivo são apenas valores de teste. Não são balanceamento aprovado nem valores finais de Talune.

## Limitações conhecidas desta primeira versão

- Fórmula de dano simplificada: `max(1, ataque - defesa * 0.5)`.
- Sem crítico, esquiva, precisão, resistência elemental, buffs, debuffs complexos, posicionamento ou múltiplos inimigos simultâneos.
- A fase 2 do chefe está representada por um evento de transição; ainda não altera seu conjto de habilidades.