import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the file-tracing root to this project (sibling repos add extra lockfiles).
  outputFileTracingRoot: process.cwd(),
  // Prisma ships platform binaries that must stay external to the server bundle.
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
};

export default nextConfig;
