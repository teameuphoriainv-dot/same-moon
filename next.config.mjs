/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // There is a stray lockfile in the home directory; pin the root to this project.
  outputFileTracingRoot: import.meta.dirname,
  // A second build can sit beside the running dev server without the two
  // writing over each other. Only the test run sets this.
  distDir: process.env.SM_DIST_DIR || ".next",
};

export default nextConfig;
