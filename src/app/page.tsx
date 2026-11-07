/**
 * Aetheria — página raiz.
 *
 * Existe para que `https://<deploy>.vercel.app/` responda 200 em vez de 404.
 * Apresenta o estado do projeto e aponta para as demos interactivas das
 * etapas já entregues, que estão em `/docs/*.html`.
 *
 * Quando o shell autenticado de `(game)/tower` estiver completo, esta página
 * passa a redireccionar para ele. Por agora é um índice honesto: mostra o que
 * funciona e o que falta.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aetheria — Idle RPG 2D',
  description: 'Idle RPG de navegador com Paperdoll 2D, torre de andares e mercado entre jogadores.',
};

interface Stage {
  readonly step: string;
  readonly title: string;
  readonly detail: string;
  readonly status: 'done' | 'partial' | 'pending';
  readonly href: string | null;
}

const STAGES: readonly Stage[] = [
  {
    step: '01',
    title: 'Estrutura e tipagens',
    detail: 'types/game.ts — 1 400 linhas, sem any, TypeScript estrito.',
    status: 'done',
    href: null,
  },
  {
    step: '02',
    title: 'Motor de combate',
    detail: 'Fórmulas, RNG determinístico, loop de passo fixo, progressão híbrida de pontos.',
    status: 'done',
    href: '/sandbox.html',
  },
  {
    step: '03',
    title: 'Catálogos e Paperdoll',
    detail: '9 raças, 4 classes, 8 specs, 96 talentos, 32 skills, 20 itens, 30 andares.',
    status: 'done',
    href: '/paperdoll.html',
  },
  {
    step: '04',
    title: 'Skills, drops e torre',
    detail: 'Executor de DoT/HoT/escudo/controlo, sorteio de loot, máquina de estados da torre.',
    status: 'done',
    href: '/etapa4.html',
  },
  {
    step: '05',
    title: 'Integração no HUD',
    detail: 'Motor real no ArenaView, floating combat text, transições de wave e andar.',
    status: 'partial',
    href: '/etapa5.html',
  },
  {
    step: '06',
    title: 'Supabase',
    detail: 'Migrations, RLS, persistência de progresso e mercado.',
    status: 'pending',
    href: null,
  },
] as const;

const STATUS_LABEL: Readonly<Record<Stage['status'], string>> = {
  done: 'Concluído',
  partial: 'Parcial',
  pending: 'Pendente',
};

const STATUS_COLOR: Readonly<Record<Stage['status'], string>> = {
  done: '#4ade80',
  partial: '#fbbf24',
  pending: '#64748b',
};

export default function HomePage() {
  const done = STAGES.filter((stage) => stage.status === 'done').length;
  const progress = Math.round((done / STAGES.length) * 100);

  return (
    <main
      style={{
        minHeight: '100vh',
        margin: 0,
        padding: '48px 20px 72px',
        background:
          'radial-gradient(1200px 600px at 50% -10%, #1b2440 0%, transparent 60%), radial-gradient(800px 400px at 90% 110%, #2a1630 0%, transparent 60%), #07070c',
        color: '#e5e7eb',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              fontSize: 22,
              background: 'linear-gradient(145deg, #1e293b, #0f172a)',
              border: '1px solid #334155',
              boxShadow: '0 0 22px rgba(56,189,248,0.25)',
            }}
          >
            🗼
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 0.4 }}>Aetheria</h1>
            <p style={{ margin: 0, fontSize: 12.5, color: '#94a3b8' }}>
              Idle RPG 2D · Paperdoll · torre de andares · mercado entre jogadores
            </p>
          </div>
        </header>

        <a
          href="/game"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            marginTop: 18,
            padding: '9px 14px',
            border: '1px solid #0ea5e9',
            borderRadius: 9,
            color: '#bae6fd',
            fontSize: 12,
            textDecoration: 'none',
            background: 'rgba(14,165,233,0.12)',
          }}
        >
          Abrir arena
        </a>

        <section
          style={{
            marginTop: 24,
            marginBottom: 28,
            padding: 16,
            borderRadius: 14,
            border: '1px solid #232342',
            background: 'linear-gradient(180deg, rgba(18,18,31,0.95), rgba(11,11,20,0.95))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
            <span>Progresso do MVP</span>
            <span style={{ fontFamily: 'ui-monospace, monospace', color: '#e2e8f0' }}>{progress}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: '#1e293b', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #0ea5e9, #7dd3fc)',
                transition: 'width 300ms',
              }}
            />
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 11.5, color: '#64748b', lineHeight: 1.7 }}>
            Etapas 1 a 4 fechadas e validadas. Etapa 5 integrada no HUD com 179 de 180 testes a passar —
            resta um teste de cooldown de skill em investigação. Etapa 6 (Supabase) por iniciar.
          </p>
        </section>

        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          {STAGES.map((stage) => (
            <li
              key={stage.step}
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid #232342',
                background: 'rgba(15,23,42,0.6)',
              }}
            >
              <span
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 12,
                  color: '#475569',
                  paddingTop: 2,
                  minWidth: 22,
                }}
              >
                {stage.step}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 13.5 }}>{stage.title}</strong>
                  <span
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: 9.5,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      padding: '2px 7px',
                      borderRadius: 5,
                      color: STATUS_COLOR[stage.status],
                      border: `1px solid ${STATUS_COLOR[stage.status]}44`,
                      background: `${STATUS_COLOR[stage.status]}11`,
                    }}
                  >
                    {STATUS_LABEL[stage.status]}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#94a3b8', lineHeight: 1.6 }}>
                  {stage.detail}
                </p>
              </div>
              {stage.href ? (
                <a
                  href={stage.href}
                  style={{
                    fontSize: 11.5,
                    color: '#7dd3fc',
                    textDecoration: 'none',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    padding: '5px 10px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  abrir demo
                </a>
              ) : null}
            </li>
          ))}
        </ol>

        <footer style={{ marginTop: 32, fontSize: 11, color: '#475569', lineHeight: 1.8, textAlign: 'center' }}>
          Next.js · TypeScript estrito · Tailwind · Supabase
          <br />
          As demos são páginas estáticas em <code style={{ fontFamily: 'ui-monospace, monospace' }}>/public</code> e
          replicam a lógica de <code style={{ fontFamily: 'ui-monospace, monospace' }}>src/lib/game/*</code>.
        </footer>
      </div>
    </main>
  );
}
