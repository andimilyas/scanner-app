import sql from "mssql";

const configUserManajemen = {
  user: process.env.DB_USERM_USER,
  password: process.env.DB_USERM_PASS,
  server: process.env.DB_USERM_HOST,
  database: process.env.DB_USERM_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

const configSimartDB = {
  user: process.env.DB_SIMART_USER,
  password: process.env.DB_SIMART_PASS,
  server: process.env.DB_SIMART_HOST,
  database: process.env.DB_SIMART_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

let poolUserManajemen: sql.ConnectionPool;
let poolSimartDB: sql.ConnectionPool;

export async function getUserDB() {
  try {
    if (poolUserManajemen) return poolUserManajemen;
    
    if (
      !configUserManajemen.user ||
      !configUserManajemen.password ||
      !configUserManajemen.server ||
      !configUserManajemen.database
    ) {
      throw new Error("Database configuration for USER_MANAJEMEN is incomplete. Please check your .env.local file.");
    }
    
    console.log("🔌 Attempting to connect to USER_MANAJEMEN database...");
    poolUserManajemen = await sql.connect({
      ...configUserManajemen,
      user: configUserManajemen.user as string,
      password: configUserManajemen.password as string,
      server: configUserManajemen.server as string,
      database: configUserManajemen.database as string,
    });
    return poolUserManajemen;
  } catch (err) {
    throw err;
  }
}

export async function getSimartDB() {
  try {
    if (poolSimartDB) return poolSimartDB;
    if (
      !configSimartDB.user ||
      !configSimartDB.password ||
      !configSimartDB.server ||
      !configSimartDB.database
    ) {
      throw new Error("Database configuration for simartdb is incomplete.");
    }
    poolSimartDB = await sql.connect({
      ...configSimartDB,
      user: configSimartDB.user as string,
      password: configSimartDB.password as string,
      server: configSimartDB.server as string,
      database: configSimartDB.database as string,
    });
    return poolSimartDB;
  } catch (err) {
    throw err;
  }
}