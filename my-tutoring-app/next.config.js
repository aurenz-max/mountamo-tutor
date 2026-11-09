/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Next 14.0.4 defaults this off. Release each compiler's memory before
    // starting the next compiler or collecting page data.
    webpackBuildWorker: true,
    // Bound page-generation concurrency on memory-limited build machines.
    cpus: 2,
    // A native binary, one per platform: webpack must leave it alone so the server loads the right one.
    serverComponentsExternalPackages: ['@resvg/resvg-js'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
