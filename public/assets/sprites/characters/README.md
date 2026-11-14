# Corpos Base das Raças — Especificação de Arte (`characters/`)

Sprites dos manequins base (níveis 1–9, "raça pura", antes da escolha de
classe). Estilo: chibi hand-painted com sombreamento suave e contorno limpo.

## Convenção de nomes e resolução

- **Slug primeiro**: `race.human` → `human.png` (o artista nomeia raças pelo
  nome curto). O candidato secundário é o id completo (`race.human.png`).
- O caminho canónico é `/assets/sprites/characters/[slug].png`, declarado em
  `buildPaperdoll()` (`src/data/races.ts`) e resolvido por
  `raceBodyAssetPath()` (`src/lib/game/sprite-assets.ts`).
- A fonte de verdade em runtime é o manifesto gerado
  (`src/data/sprite-asset-manifest.ts`). PNG ausente do manifesto → o corpo
  cai no template vectorial `hero-body` sem partir a renderização.

## Encaixe no Paperdoll (alinhamento obrigatório)

- Canvas lógico: **256×256** (`PAPERDOLL_CANVAS`).
- O `RasterLayer` desenha o PNG **inteiro** dentro do art-rect oficial do
  corpo: `{ x: 32, y: 24, size: 192 }` (`PAPERDOLL_ART_RECTS.body`), via
  `viewBox="32 24 192 192"`. Ou seja: o PNG é esticado da tela 256×256 do
  ficheiro para o rect 192×192 do canvas — em coordenadas PNG:
  - **centro horizontal**: x = 128 (só o corpo difere entre raças; nunca o
    centro);
  - **cabeça**: centro ~y = 50, topo da silhueta ~y ≥ 14;
  - **pés**: base da silhueta ~y = 238;
  - **tronco**: túnica entre y = 94 e y = 170.
- Este envelope cobre exactamente o espaço do template vectorial
  `hero-body` (cabeça (32,12.5), pés ~59.4 no tile 64×64), garantindo que
  armas e nameplates alinham com qualquer raça sem calibração.

## Checklist de qualidade

- RGBA 256×256, fundo transparente (cantos e céu à volta da silhueta).
- Contorno escuro limpo de ~2px em toda a silhueta.
- Luz consistente de topo-esquerda (highlight à esquerda, sombra à direita).
- Identidade de raça legível em miniatura: orelhas, chifres, presas, barba,
  focinho, topknot, olhos de caveira — conforme `src/data/races.ts`.
- Túnica na cor `primary` da raça (aventureiro básico: cinto de couro,
  ombreiras, botas) — níveis 1–9 não usam armadura de classe.
- Sem texto, assinaturas ou metadados visuais.
