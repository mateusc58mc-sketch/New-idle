import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Arte do Paperdoll é servida como estático; nenhum optimizador de imagem
  // entra no caminho crítico do loop de combate.
  images: { unoptimized: true },
  experimental: {
    // O loop de combate vive no cliente; nada de SSR pesado por rota.
    optimizePackageImports: ['@supabase/supabase-js'],
  },
  async headers() {
    return [
      {
        // Assets do paperdoll são imutáveis (versionados por nome de ficheiro).
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
