/**
 * Ascent Gate Idle — Portal Oficial de Entrada (Game Hub)
 *
 * Padrão Dark Fantasy imersivo (estilo clássico Ragnarök / MU Online).
 * Apresenta os pilares do jogo e pontos de acesso direto para a Arena de Combate,
 * o Sprite Lab Studio e os Catálogos de Paperdoll.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Ascent Gate Idle — Portal Oficial • Idle RPG 2D',
  description:
    'Idle RPG 2D de navegador com Paperdoll modular, combate tático em torre de andares e economia RMT entre jogadores.',
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-arcane-500 selection:text-slate-950 overflow-x-hidden">
      {/* ── Ambient Glow Background ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-sky-500/15 via-violet-600/10 to-transparent blur-3xl opacity-70" />
        <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] bg-amber-500/10 blur-3xl rounded-full opacity-40" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-rose-500/10 blur-3xl rounded-full opacity-40" />
      </div>

      {/* ── Top Navigation Bar ── */}
      <header className="relative z-10 h-16 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-sky-500 to-indigo-600 p-[1px] shadow-lg shadow-sky-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center text-lg">
              🗼
            </div>
          </div>
          <div>
            <span className="text-sm font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-sky-200 to-indigo-200 uppercase">
              Ascent Gate
            </span>
            <span className="block text-[10px] font-mono tracking-wider text-slate-400 uppercase">
              Idle RPG Studio
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-4 text-xs font-semibold">
          <Link
            href="/game"
            className="text-slate-300 hover:text-white transition-colors"
          >
            Arena
          </Link>
          <Link
            href="/admin/sprite-lab"
            className="text-slate-300 hover:text-white transition-colors"
          >
            Sprite Lab
          </Link>
          <a
            href="/paperdoll.html"
            className="text-slate-300 hover:text-white transition-colors"
          >
            Paperdoll
          </a>
          <div className="h-4 w-px bg-slate-800" />
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            ● Motor Determinístico
          </span>
        </nav>
      </header>

      {/* ── Main Content Container ── */}
      <main className="relative z-10 flex-1 max-w-6xl mx-auto px-6 py-12 flex flex-col items-center">
        {/* ── Hero Section ── */}
        <section className="text-center max-w-3xl my-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-amber-300 font-semibold mb-6 shadow-inner">
            <span>✨</span>
            <span>EXPERIÊNCIA OFICIAL • NAVEGADOR & MOBILE FIRST</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white leading-tight mb-4 drop-shadow-sm">
            ASCENT GATE{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-sky-400 to-purple-400">
              IDLE
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-300 font-medium mb-2">
            Idle RPG 2D • Paperdoll Modular • Torre de Andares • Mercado RMT
          </p>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Monte seu squad lendário de 4 heróis, escale centenas de andares repletos de chefes épicos,
            forje equipamentos mitológicos e participe da economia ativa no mercado aberto entre jogadores.
          </p>

          {/* ── Action Buttons Hub (Grid de 3 CTAs) ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10 max-w-3xl mx-auto">
            {/* CTA 1: Entrar na Arena */}
            <Link
              href="/game"
              className="group relative flex flex-col items-center justify-center p-5 rounded-2xl bg-gradient-to-b from-sky-500/20 to-sky-950/40 border border-sky-500/40 hover:border-sky-400 shadow-xl shadow-sky-500/10 hover:shadow-sky-500/25 transition-all duration-200 active:scale-95 text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform">
                ⚔️
              </div>
              <span className="text-base font-bold text-white group-hover:text-sky-200">
                Entrar na Arena
              </span>
              <span className="text-xs text-slate-400 mt-1">
                Combate tático, waves e chefes da torre
              </span>
              <span className="mt-3 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-sky-500/30 text-sky-200 border border-sky-400/30">
                JOGAR AGORA →
              </span>
            </Link>

            {/* CTA 2: Sprite Lab Studio */}
            <Link
              href="/admin/sprite-lab"
              className="group relative flex flex-col items-center justify-center p-5 rounded-2xl bg-gradient-to-b from-purple-500/20 to-purple-950/40 border border-purple-500/40 hover:border-purple-400 shadow-xl shadow-purple-500/10 hover:shadow-purple-500/25 transition-all duration-200 active:scale-95 text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform">
                🧪
              </div>
              <span className="text-base font-bold text-white group-hover:text-purple-200">
                Sprite Lab Studio
              </span>
              <span className="text-xs text-slate-400 mt-1">
                Editor vetorial SVG 256×256 & calibração
              </span>
              <span className="mt-3 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                ABRIR ESTÚDIO →
              </span>
            </Link>

            {/* CTA 3: Catálogos & Paperdoll */}
            <a
              href="/paperdoll.html"
              className="group relative flex flex-col items-center justify-center p-5 rounded-2xl bg-gradient-to-b from-amber-500/20 to-amber-950/40 border border-amber-500/40 hover:border-amber-400 shadow-xl shadow-amber-500/10 hover:shadow-amber-500/25 transition-all duration-200 active:scale-95 text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform">
                🛡️
              </div>
              <span className="text-base font-bold text-white group-hover:text-amber-200">
                Catálogos & Paperdoll
              </span>
              <span className="text-xs text-slate-400 mt-1">
                9 Raças, 9 Slots & Shaders de Raridade
              </span>
              <span className="mt-3 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 border border-amber-400/30">
                VER CATÁLOGO →
              </span>
            </a>
          </div>
        </section>

        {/* ── Os Três Pilares do Jogo ── */}
        <section className="w-full my-16">
          <div className="text-center mb-10">
            <h2 className="text-xs font-bold uppercase tracking-widest text-arcane-400 mb-2">
              Pilares Fundamentais da Arquitetura
            </h2>
            <h3 className="text-3xl font-black text-white">
              Engenharia e Imersão no Estilo Clássico
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pilar 1 */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-2xl mb-4">
                ⚔️
              </div>
              <h4 className="text-lg font-bold text-white mb-2">
                Combate Tático Determinístico
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed flex-1">
                Formações de 4 heróis divididos em linhas táticas (Front, Mid e Back). Sinergia entre
                Guerreiros, Caçadores, Clérigos e Magos com 8 especializações, árvore de talentos e
                motor de cálculo blindado com 184 testes unitários automatizados.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>RNG Determinístico</span>
                <span className="text-sky-400 font-mono font-semibold">184 Testes Verdes</span>
              </div>
            </div>

            {/* Pilar 2 */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-2xl mb-4">
                🎨
              </div>
              <h4 className="text-lg font-bold text-white mb-2">
                Paperdoll 2D & Sprites por Código
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed flex-1">
                Composição em 7 camadas rígidas de renderização com canvas base unificado de 256×256 pixels.
                Shader dinâmico de Glow de Raridade do Comum ao Mítico, refinos de +1 a +15 e suporte
                a SVGs paramétricos customizáveis em tempo real.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>6 Tiers de Raridade</span>
                <span className="text-purple-400 font-mono font-semibold">Glow Dinâmico</span>
              </div>
            </div>

            {/* Pilar 3 */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl mb-4">
                💎
              </div>
              <h4 className="text-lg font-bold text-white mb-2">
                Economia Viva & Mercado RMT
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed flex-1">
                Mercado aberto entre jogadores com moedas integradas: Ouro (farm contínuo), Cristais (progressão)
                e Saldo Cash. Transações atômicas seguras via banco de dados Supabase com Row-Level Security
                e rastreabilidade completa por UUIDs permanentes.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>Persistência RLS</span>
                <span className="text-amber-400 font-mono font-semibold">Postgres / Supabase</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Especificações Técnicas de Estúdio ── */}
        <section className="w-full max-w-4xl p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center text-xs text-slate-400 my-4">
          <div className="flex flex-wrap justify-center items-center gap-6 font-mono text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" /> Next.js 15 App Router
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> TypeScript 5.7 Estrito
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400" /> Tailwind CSS + PostCSS
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Supabase Realtime & RLS
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400" /> Vitest Suite (184 Testes)
            </span>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p className="mb-1 font-medium text-slate-400">
          Ascent Gate Idle © 2026 • Todos os direitos reservados.
        </p>
        <p className="text-[11px] text-slate-600">
          Arquitetura e desenvolvimento contínuo para RPGs de navegador de alto desempenho.
        </p>
      </footer>
    </div>
  );
}
