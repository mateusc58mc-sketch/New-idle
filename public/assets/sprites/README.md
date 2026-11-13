# Sprites hand-painted — Paperdoll (Fase 2)

Arte raster 2D **Chibi hand-painted** que substitui, peça a peça, os templates
vetoriais do Sprite Lab. O motor decide sozinho: PNG presente → desenha o PNG;
PNG ausente → cai no template vetorial. Nada quebra a meio da migração.

## Estrutura

```
public/assets/sprites/
├── weapons/     ← /assets/sprites/weapons/[itemId].png
├── armor/       ← /assets/sprites/armor/[itemId].png   (inclui botas)
├── helmets/     ← /assets/sprites/helmets/[itemId].png
└── characters/  ← /assets/sprites/characters/[raceId].png
```

## Regras de export

- **Canvas**: 64×64 px, fundo transparente (o motor amplia para o `artRect`
  oficial do canvas 256×256 — ver `src/data/paperdoll-layers.ts`).
- **Alinhamento**: a peça deve tocar o centro do tile, como os templates
  vetoriais. Não desenhar sombra projectada fora do tile.
- **Formato**: PNG-8/PNG-24 com alfa (WebP também é aceite).
- **Nomes**: `item.wpn.iron_sword.png` (id completo) **ou** `iron_sword.png`
  (id curto). O id completo tem prioridade.

## Fluxo de trabalho

1. Largar o PNG numa das quatro pastas.
2. `npm run assets:manifest` — regista os ficheiros em
   `src/data/sprite-asset-manifest.ts`.
   (Já corre automaticamente em `npm run dev` e `npm run build`.)
3. Ver no jogo (`/game`) e no catálogo (`/admin/sprite-lab`).

O teste `src/lib/game/sprite-assets.test.ts` compara o manifesto com o disco:
se alguém adicionar um PNG e esquecer o passo 2, o `npm test` avisa.

## Fallback

- Manifesto sem o caminho → template vetorial (`src/lib/sprite-lab/svg-templates.ts`).
- Manifesto desactualizado (PNG apagado) → o componente detecta o 404 e troca
  para o template vetorial em runtime.
