const fs = require("fs");
const path = require("path");

let Pool;
try {
  ({ Pool } = require("pg"));
} catch (error) {
  Pool = null;
}

const databaseUrl = process.env.DATABASE_URL;
const enabled = Boolean(databaseUrl && Pool);
const missingDriver = Boolean(databaseUrl && !Pool);
let pool = null;

if (enabled) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
  });
}

function isEnabled() {
  return enabled;
}

function assertReady() {
  if (missingDriver) {
    throw new Error("DATABASE_URL is set but the pg package is not installed. Run npm install.");
  }
  if (!enabled) {
    throw new Error("DATABASE_URL is not configured.");
  }
}

async function query(text, params = []) {
  assertReady();
  return pool.query(text, params);
}

async function initialize() {
  if (!enabled) return { ok: true, mode: "json" };
  const schemaPath = path.join(__dirname, "schema.sql");
  await query(fs.readFileSync(schemaPath, "utf8"));
  return { ok: true, mode: "postgres" };
}

module.exports = {
  initialize,
  isEnabled,
  query
};
