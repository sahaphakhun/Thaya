const { Pool } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.PG_CONNECTION_STRING;

let pool = null;

function getPool() {
  if (pool) return pool;
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  const shouldUseSsl =
    process.env.PGSSLMODE === "require" ||
    (typeof DATABASE_URL === "string" && DATABASE_URL.includes("sslmode=require"));

  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
  });

  return pool;
}

const RETRYABLE_SQLSTATE_CODES = new Set([
  "40001", // serialization_failure
  "40P01", // deadlock_detected
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
  "53300", // too_many_connections
  "08000", // connection_exception
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "08003", // connection_does_not_exist
  "08004", // sqlserver_rejected_establishment_of_sqlconnection
  "08006", // connection_failure
  "08007", // transaction_resolution_unknown
]);

function isRetryableDbError(err) {
  if (!err) return false;
  if (err.code && RETRYABLE_SQLSTATE_CODES.has(err.code)) return true;

  const message = String(err.message || "");
  return (
    message.includes("Connection terminated") ||
    message.includes("terminating connection") ||
    message.includes("connection error")
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withDbRetry(label, operation, retryCount = 1, retryDelayMs = 500) {
  const maxAttempts = Math.max(retryCount, 0) + 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const retryable = isRetryableDbError(err);
      if (!retryable || attempt >= maxAttempts) {
        throw err;
      }
      console.warn(
        `[Postgres] ${label} failed (attempt ${attempt}/${maxAttempts}), retrying: ${err.message || err}`
      );
      await sleep(retryDelayMs * attempt);
    }
  }

  throw lastError;
}

async function connectDb() {
  const activePool = getPool();
  await activePool.query("SELECT 1");
  return activePool;
}

async function query(text, params) {
  const activePool = getPool();
  return activePool.query(text, params);
}

async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id BIGSERIAL PRIMARY KEY,
      sender_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS chat_history_summaries (
      sender_id TEXT PRIMARY KEY,
      summary TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      from_timestamp TIMESTAMPTZ,
      to_timestamp TIMESTAMPTZ,
      message_count INTEGER
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS order_chat_history (
      id BIGSERIAL PRIMARY KEY,
      sender_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      fb_name TEXT,
      customer_name TEXT,
      address TEXT,
      phone TEXT,
      promotion TEXT,
      total TEXT,
      payment_method TEXT,
      note TEXT,
      page_source TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      status TEXT
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS customer_order_status (
      sender_id TEXT PRIMARY KEY,
      order_status TEXT,
      followup_index INTEGER,
      last_user_reply_at TIMESTAMPTZ,
      last_followup_at TIMESTAMPTZ,
      followup_disabled BOOLEAN,
      followup_disabled_at TIMESTAMPTZ,
      followup_enabled_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS active_user_status (
      sender_id TEXT PRIMARY KEY,
      ai_enabled BOOLEAN NOT NULL DEFAULT true,
      welcome_message_enabled BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_page_mapping (
      user_id TEXT PRIMARY KEY,
      page_key TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_contact_info (
      user_id TEXT PRIMARY KEY,
      address TEXT,
      phone TEXT,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS instruction_versions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      google_doc TEXT,
      sheet_data JSONB,
      static_instructions TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT false
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS chat_history_sender_timestamp_idx
    ON chat_history (sender_id, timestamp);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS order_chat_history_sender_timestamp_idx
    ON order_chat_history (sender_id, timestamp);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS orders_user_phone_promo_created_idx
    ON orders (user_id, phone, promotion, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS customer_order_status_followup_idx
    ON customer_order_status (order_status, followup_disabled, followup_index);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS instruction_versions_created_at_idx
    ON instruction_versions (created_at DESC);
  `);
}

module.exports = {
  getPool,
  query,
  connectDb,
  initSchema,
  withDbRetry,
};
