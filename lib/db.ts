import { Pool } from "pg";

const globalPool = global as typeof global & { _pgPool?: Pool };

if (!globalPool._pgPool) {
  globalPool._pgPool = new Pool({
    connectionString: process.env.POSTGRES_URI,
  });
}

export const pool = globalPool._pgPool;
