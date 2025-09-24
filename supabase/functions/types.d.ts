// Ambient declarations so the local TypeScript compiler can understand the
// Supabase Edge Function environment (Deno).

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  interface ServeInit {
    port?: number
    hostname?: string
    signal?: AbortSignal
    onListen?: (params: { hostname: string; port: number }) => void
  }

  export function serve(
    handler: (request: Request) => Response | Promise<Response>,
    options?: ServeInit
  ): Promise<void>
}

declare const Deno: {
  env: {
    get(name: string): string | undefined
  }
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js"
}
