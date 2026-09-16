import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static export — required for InfinityFree (PHP/Apache shared
  // hosting, no Node runtime). No Server Components rendering per
  // request, no Server Actions, no middleware/proxy, no Route Handlers
  // with dynamic behavior. All of that has been moved to the browser
  // (RLS is now the authorization boundary) or to Supabase Edge
  // Functions for the two operations that need the service-role key.
  output: "export",
  images: {
    // The Next.js Image Optimization API needs a server; static export
    // can't run it, so images are served unoptimized as-is.
    unoptimized: true,
  },
  // Apache resolves directories to index.html, so /dashboard needs to
  // export as /dashboard/index.html rather than /dashboard.html.
  trailingSlash: true,
};

export default nextConfig;
