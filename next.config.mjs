/**
 * Song Quest — Next.js configuration.
 *
 * Audio is never referenced cross-origin from the browser: every Xeno-canto
 * clip is rewritten to `/api/audio?src=…` so the host allow-list lives in one
 * route handler. Photos are the exception — iNaturalist serves them from two
 * static hosts with permissive CORS, so `next/image` may fetch them directly
 * and both hosts are enumerated below.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'inaturalist-open-data.s3.amazonaws.com',
        pathname: '/photos/**',
      },
      {
        protocol: 'https',
        hostname: 'static.inaturalist.org',
        pathname: '/photos/**',
      },
    ],
  },
};

export default nextConfig;
