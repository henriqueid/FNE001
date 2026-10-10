declare module "cloudflare:workers" {
  type D1Statement = {
    bind(...values: unknown[]): D1Statement;
    first<T = unknown>(): Promise<T | null>;
    all<T = unknown>(): Promise<{ results: T[] }>;
    run(): Promise<{ success: boolean; meta?: Record<string, unknown> }>;
  };

  export const env: {
    DB: {
      prepare(query: string): D1Statement;
      batch<T = unknown>(statements: unknown[]): Promise<T[]>;
      exec(query: string): Promise<{ count: number; duration: number }>;
    };
  };
}
