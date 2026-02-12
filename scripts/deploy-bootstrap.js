#!/usr/bin/env node

const path = require("path");
const { spawnSync } = require("child_process");

function hasDbUrl() {
  return Boolean(
    process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.PG_CONNECTION_STRING
  );
}

function runImportScript() {
  const sourceRaw = String(process.env.IMPORT_INSTRUCTION_SOURCE || "code")
    .trim()
    .toLowerCase();
  const source = sourceRaw === "google" ? "google" : "code";

  const args = [
    path.join(__dirname, "import-instruction-data.js"),
    `--source=${source}`,
  ];

  if (process.env.IMPORT_INSTRUCTION_FOLLOWUP_JSON) {
    args.push(`--followup-json=${process.env.IMPORT_INSTRUCTION_FOLLOWUP_JSON}`);
  }
  if (process.env.IMPORT_INSTRUCTION_SIMULATION_FILE) {
    args.push(`--simulation-file=${process.env.IMPORT_INSTRUCTION_SIMULATION_FILE}`);
  }
  if (process.env.IMPORT_INSTRUCTION_NO_ACTIVATE === "true") {
    args.push("--no-activate");
  }
  if (process.env.IMPORT_INSTRUCTION_DRY_RUN === "true") {
    args.push("--dry-run");
  }

  console.log(
    `[bootstrap] Importing instruction data to Postgres (source=${source})...`
  );
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }
  return result.status || 0;
}

function main() {
  const autoImportEnabled = process.env.AUTO_IMPORT_INSTRUCTION_DB !== "false";
  if (!autoImportEnabled) {
    console.log("[bootstrap] AUTO_IMPORT_INSTRUCTION_DB=false, skip auto import.");
    return;
  }

  if (!hasDbUrl()) {
    console.log("[bootstrap] DATABASE_URL not configured, skip auto import.");
    return;
  }

  const allowFailure = process.env.IMPORT_INSTRUCTION_ALLOW_FAILURE !== "false";
  const status = runImportScript();
  if (status !== 0) {
    if (allowFailure) {
      console.warn(
        `[bootstrap] Import failed with exit code ${status}, continue because IMPORT_INSTRUCTION_ALLOW_FAILURE=true.`
      );
      return;
    }
    process.exit(status);
  }
}

try {
  main();
} catch (err) {
  const allowFailure = process.env.IMPORT_INSTRUCTION_ALLOW_FAILURE !== "false";
  console.error("[bootstrap] Auto import error:", err.message || err);
  if (!allowFailure) {
    process.exit(1);
  }
}
