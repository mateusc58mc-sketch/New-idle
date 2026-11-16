# Talune — Contexto de continuidade

Atualizado em 2026-11-16.

## Objetivo
Construir um MMORPG idle cooperativo de fantasia, com combate automático em party de quatro, progressão compartilhada da party e progressão individual dos personagens. Prioridade atual: sistemas jogáveis e um MVP funcional; lore é apoio, não eixo do desenvolvimento.

## Direção visual e mundo
- Paperdoll 2D ilustrado, fantasia colorida, semi-chibi, pintura manual; não pixel art.
- Mobile-first 9:16 e desktop responsivo, com foco em desempenho em dispositivos modestos.
- Mundo hierárquico: mundo → continentes → regiões → áreas de caça → etapas de farm → encontros especiais/masmorras → chefes regionais → desbloqueios.
- Mapa ilustrado para navegação; combate ocorre em cenas/arenas separadas.
- Primeira região provisória: Vale de Brumafonte; hub Acampamento da Travessia; Campos da Margem, Bosque das Raízes e Ruínas da Nascente; chefe Guardião da Fenda.
- MVP de criaturas: Lodo-de-Rio (resistente/lento), Lobo-de-Várzea (rápido/agressivo), Broto de Raiz (controle à distância) e Guardião da Fenda (chefe com telegráfico e segunda fase).

## Inspirações centrais
Manter a identidade original inicialmente definida a partir de Ragnarok Online, Ulala: Idle Adventure, TapTap Heroes e Lineage II. Referências de wikis de browser idle/MMORPG servem para estudar soluções de sistemas, nunca para substituir a direção central ou copiar conteúdo.
- Drakoria Idle: party de até 4, caça automática, configuração individual de helper por personagem, progressão offline; dificuldade altera HP/dano/recompensas e densidade de monstros. Fonte: https://jogo.drakoriaidle.com.br/wiki/
- Continent of Legend: mapas com etapas de horda e etapa de chefe; desbloqueios após derrotar o chefe; sistemas de progressão e forja. Fonte: https://continentoflegend.com.br/wiki/
- Steelwage (inspiração não-idle): identidade mecânica por classe, atributos, vantagens elementais, regiões por faixa de nível, dungeons com chefes e conteúdo de grupo. Fonte: https://steelwage.com/guia/
Aplicar somente ideias que respeitem o ritmo idle, party cooperativa e economia/progressão planejadas para Talune.

## Regras de combate aprovadas
- ASPD governa somente frequência de ataques básicos; a visão desejada inclui velocidades muito altas no endgame.
- Haste reduz recargas de habilidades, não altera ataques básicos.
- Combate automático verifica habilidades em ordem de prioridade; habilidade indisponível é ignorada; ataque básico é fallback.
- Party de quatro; bots ocupam vagas sem jogadores e são menos eficientes que humanos equivalentes.
- Party só avança enquanto ao menos um membro real estiver online; sem membros online, permanece no estágio atual farmando.
- Qualquer membro online pode alterar táticas compartilhadas (habilidades desbloqueadas e ordem), mas não gastar recursos nem alterar equipamentos/atributos de outros.
- Chefe deve ter telegráficos, fases e pressão de mitigação; evitar imunidade total a dano.

## Auditoria técnica do motor existente (main em 2026-11-16)
A fonte de combate existente em `src/lib/game/combat.ts` é muito mais completa do que o simulador independente e deve ser a base dos próximos testes. É um módulo funcional puro/determinístico, não assumir ainda que todo o fluxo de produção já é autoritativo no servidor.
- Já contém auto-ataques, crítico, HIT/FLEE, dano físico/mágico, targeting por linhas, habilidades, cooldowns, MP, efeitos DoT/HoT, buffs/debuffs, escudos, controlo, métricas e RNG determinístico.
- `src/lib/game/balance.ts` centraliza os números de balanceamento; `formulas.ts`, `skills.ts`, `rng.ts` e `src/types/game.ts` sustentam o motor.
- Divergência 1: `BALANCE.stats.attackSpeed.maxAttacksPerSec` está em 2.5. Isso conflita com a intenção aprovada de ASPD muito alta no endgame. Não alterar até criar cenários de teste e decidir progressão/limites com dados.
- Divergência 2: a tipagem/derivação inspecionada usa castTime e attackSpeed, mas ainda não foi localizada uma estatística Haste integrada à recarga de skills. Precisamos mapear toda a cadeia de stats antes de implementar.
- Divergência 3: `castSkills` percorre a lista equipada e pode lançar mais de uma habilidade pronta no mesmo tick; a regra de prioridade aprovada precisa ser comparada com o comportamento desejado (primeira disponível, depois reavaliar) e alinhada sem quebrar classes existentes.
- Auto-ataques e skills são processados no mesmo avanço; a ordem atual de resolução precisa ser incluída nos testes de regressão.
- Não substituir o motor nem mexer nas fórmulas de produção antes de construir a bateria de simulação e preservar testes existentes.

## Simulador independente preservado
Código em `tools/combat-simulator/`.
- Protótipo TypeScript sem dependências, party 1–4, fila simples, ASPD/Haste separados, cura, ataques inimigos, telegráfico, fase 2, seed e métricas por personagem.
- Não é a fonte principal do combate. Serve como protótipo histórico e comparação conceitual.
- Requer Node.js 22+: `node --experimental-strip-types .\\combat-simulator.test.ts` dentro da pasta.
- Todos os números e fórmulas são placeholders; não são balanceamento final.
- Limitações: fórmula de dano simplificada; sem crítico/esquiva/precisão/resistências/buffs/debuffs/múltiplos inimigos; fase 2 registra transição mas não muda conjunto de habilidades.

## Próximos passos técnicos
1. Ler por completo os testes atuais de combat.ts e rodar a suíte do repositório em ambiente local/CI.
2. Construir um harness de benchmark que importe diretamente `advanceCombat`, `createCombatState` e `createRng`, sem duplicar fórmulas.
3. Criar fixtures reais de personagens/classes e monstros do Vale de Brumafonte.
4. Rodar centenas/milhares de seeds por party 1–4 e por composição; coletar duração, vitória/derrota, DPS, dano recebido, cura efetiva, críticos, misses, mortes e uso de skills.
5. Adicionar testes para ASPD/Haste e prioridade; registrar as divergências antes de corrigir.
6. Só então ajustar parâmetros no balance.ts e validar regressões.

## Vercel e acesso
- A conexão Vercel disponível nesta sessão lista apenas o projeto `new-idle` no team Aincrad, ligado ao GitHub `mateusc58mc-sketch/New-idle`.
- O dashboard mostrado pelo usuário também exibe `aetheria-arena` e `aetheria-idle`, mas a integração atual não conseguiu consultá-los; o endpoint retornou projeto não encontrado. No dashboard, ambos exibem “Connect Git Repository”.
- Para reutilizar esses projetos com segurança, identificar primeiro o repositório/arquivo-fonte de cada um e conectar o repositório Git correspondente ao projeto Vercel; não ligar a um repositório vazio nem promover mudanças à produção sem revisar a origem.
- O primeiro preview da branch de checkpoint falhou porque o commit inicial continha somente documentação/arquivos do simulador e não preservava a árvore completa do app. Corrigido em `ce61a2ebc3ca04b1b720a44ace072481ac2cdbb1`, que reconstrói a branch sobre a árvore completa da main. Um novo preview foi disparado e precisa ser verificado.

## Observação sobre a base
O repositório atual é um projeto Next.js/TypeScript com PixiJS e Supabase, nome de pacote `aetheria`. Antes de alterar identidade, arquitetura ou conteúdo, verificar o estado atual do projeto e manter Talune como direção de produto aprovada.
