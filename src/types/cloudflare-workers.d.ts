declare module "cloudflare:workers" {
  export const env: {
    DB: {
      prepare(query: string): {
        bind(...values: unknown[]): {
          first<T = unknown>(): Promise<T | null>;
          all<T = unknown>(): Promise<{ results: T[] }>;
          run(): Promise<{ success: boolean; meta?: Record<string, unknown> }>;
        };
        first<T = unknown>(): Promise<T | null>;
        all<T = unknown>(): Promise<{ results: T[] }>;
        run(): Promise<{ success: boolean; meta?: Record<string, unknown> }>;
      };
      batch<T = unknown>(statements: unknown[]): Promise<T[]>;
      exec(query: string): Promise<{ count: number; duration: number }>;
    };
  };
}
