/**
 * Song Quest — Next.js configuration.
 *
 * The game is a fully static site. `next build` writes plain HTML, JS and JSON
 * to `out/`, which GitHub Pages serves as-is: there are no route handlers and
 * no server. Every bird's dossier is pre-generated into `public/data/species/`
 * by `scripts/generate-dossiers.ts`, which is the only thing that ever touches
 * the Xeno-canto API key.
 *
 * Browsers load audio, photographs and map tiles straight from Xeno-canto,
 * iNaturalist, GBIF and CARTO. All four allow cross-origin use.
 */

/**
 * GitHub Pages serves a project site under `/<repo>/`, so every asset and route
 * needs that prefix in production. It is set only by the deploy workflow;
 * locally it stays empty and the game runs at the root of localhost.
 */
const basePath = process.env.PAGES_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath,
  // `/solo/` is written as `solo/index.html`, which static hosts resolve
  // without any rewrite rules.
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  // The image optimiser needs a server. Photos use a plain <img> anyway.
  images: { unoptimized: true },
  // `basePath` is applied to <Link> and the router but not to a raw fetch(),
  // so it is exposed for building dossier URLs by hand.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
