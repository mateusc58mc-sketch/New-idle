/**
 * Gera `src/data/sprite-asset-manifest.ts` a partir do que existe em disco.
 *
 * Porque é preciso: o Paperdoll tem de decidir, em tempo de resolução, entre
 * PNG raster e template vetorial. Um `fetch`/`HEAD` por camada seria latência
 * e ruído na consola; um manifesto estático dá a mesma resposta de graça.
 *
 * Uso:
 *   npm run assets:manifest
 *
 * Corre automaticamente em `npm run dev` e `npm run build` (predev/prebuild).
 * É por isso que o manifesto é o ÚNICO ficheiro gerado que se commita: garante
 * que um clone limpo compila antes de qualquer artista largar um PNG.
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const projectRoot = process.cwd();
const publicDir = join(projectRoot, 'public');
const spritesDir = join(publicDir, 'assets', 'sprites');
const outputFile = join(projectRoot, 'src', 'data', 'sprite-asset-manifest.ts');

const RASTER_EXTENSIONS = /\.(png|webp)$/i;

/** Lista recursiva de ficheiros (devolve [] se a pasta ainda não existir). */
function walk(directory) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries.flatMap((entry) => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const assets = walk(spritesDir)
  .filter((file) => RASTER_EXTENSIONS.test(file))
  .map((file) => `/${relative(publicDir, file).split(sep).join('/')}`)
  .sort((a, b) => a.localeCompare(b));

const entries = assets.map((asset) => `  '${asset}',`).join('\n');
const setLiteral = assets.length > 0 ? `[\n${entries}\n]` : '[]';

const content = `/**
 * AUTO-GERADO — não edites à mão.
 *
 * Fonte de verdade dos PNGs hand-painted disponíveis no Paperdoll.
 * Regenera com \`npm run assets:manifest\` (ou corre \`npm run dev\` / \`npm run build\`,
 * que já o fazem por ti).
 *
 * Um caminho ausente daqui faz o motor cair no template vetorial de
 * \`src/lib/sprite-lab/svg-templates.ts\` — nunca parte a renderização.
 */
export const SPRITE_ASSET_MANIFEST: ReadonlySet<string> = new Set<string>(${setLiteral});

/** Quantidade de artes raster registadas (útil em diagnóstico). */
export const SPRITE_ASSET_COUNT = ${assets.length};
`;

writeFileSync(outputFile, content, 'utf8');

console.log(
  `[sprite-manifest] ${assets.length} PNG(s) registado(s) em src/data/sprite-asset-manifest.ts`,
);
