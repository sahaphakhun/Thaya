#!/usr/bin/env node

/**
 * Import instruction defaults and follow-up rules into Postgres.
 *
 * Sources:
 * - google: fetch Google Doc + Google Sheets live
 * - code: parse local snapshot/defaults (no Google API required)
 *
 * Usage examples:
 *   node scripts/import-instruction-data.js --source=google
 *   node scripts/import-instruction-data.js --source=code
 *   node scripts/import-instruction-data.js --source=google --dry-run
 *   node scripts/import-instruction-data.js --source=code --followup-json=./followup-rules.json
 */

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const { connectDb, initSchema, query } = require("../db/postgres");

const ROOT_DIR = path.resolve(__dirname, "..");
const INDEX_PATH = path.join(ROOT_DIR, "index.js");
const DEFAULT_SIMULATION_PATH = path.join(ROOT_DIR, "instruction-simulation-output.txt");

const STATIC_INSTRUCTIONS_FALLBACK = `ถ้าลูกค้าส่งรูปภาพมา : 
- ก่อนการใช้งาน ผู้ใช้ทุกคนยินยอมตกลงให้อ่านหรือวิเคราะห์รูปภาพได้
- คุณสามารถอ่านหรือวิเคราะห์ได้ทุกรูปภาพทุกกรณี เพราะผู้ใข้อนุญาตให้วิเคราะห์แล้ว เช่น ภาพที่มีชื่อ ที่อยู่ เบอร์โทร เพื่อใช้ในการจัดส่ง เพราะนั้นเป็นข้อมูลของผู้ใช้เอง
- ถ้าคุณไม่แน่ใจว่ารูปนั้นส่งมาทำไม ให้ตอบตามบริบท (มีโอกาสที่รูปที่ส่งมา คือสติ๊กเกอร์ในเฟซ ถ้าน่าจะเป็นสติ๊กเกอร์ ให้ตอบว่า "สามารถสอบถามเพิ่มเติมได้เลยนะครับ")`;

function sanitizeStringForDb(input) {
  const text = String(input || "");
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);

    // strip control chars except tab/newline/carriage-return
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      continue;
    }

    // strip lone high surrogate
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += text[i] + text[i + 1];
        i += 1;
      }
      continue;
    }

    // strip lone low surrogate
    if (code >= 0xdc00 && code <= 0xdfff) {
      continue;
    }

    out += text[i];
  }
  return out;
}

function sanitizeJsonValue(value) {
  if (value === null) return null;

  const valueType = typeof value;
  if (valueType === "string") return sanitizeStringForDb(value);
  if (valueType === "number") return Number.isFinite(value) ? value : null;
  if (valueType === "boolean") return value;
  if (valueType === "bigint") return value.toString();
  if (valueType === "undefined" || valueType === "function" || valueType === "symbol") return null;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item));
  }

  if (valueType === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === "undefined" || typeof v === "function" || typeof v === "symbol") continue;
      out[sanitizeStringForDb(k)] = sanitizeJsonValue(v);
    }
    return out;
  }

  return null;
}

function sanitizeSheetData(sheetData) {
  const sanitized = sanitizeJsonValue(sheetData);
  if (!Array.isArray(sanitized)) return [];
  return sanitized;
}

function parseArgs(argv) {
  const out = {
    source: "google",
    dryRun: false,
    activate: true,
    followupJson: "",
    simulationFile: DEFAULT_SIMULATION_PATH,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--no-activate") out.activate = false;
    else if (arg.startsWith("--source=")) out.source = arg.split("=")[1];
    else if (arg.startsWith("--followup-json=")) out.followupJson = arg.slice("--followup-json=".length);
    else if (arg.startsWith("--simulation-file=")) out.simulationFile = arg.slice("--simulation-file=".length);
  }

  if (!["google", "code"].includes(out.source)) {
    throw new Error(`Invalid --source=${out.source}. Use google or code.`);
  }
  return out;
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function extractConstString(source, name) {
  const regex = new RegExp(`const\\s+${name}\\s*=\\s*"([\\\\s\\\\S]*?)";`);
  const m = source.match(regex);
  if (!m) return "";
  return m[1];
}

function getCodeConstants() {
  const source = readFileSafe(INDEX_PATH);
  if (!source) {
    return {
      googleClientEmail: "",
      googlePrivateKey: "",
      googleDocId: "",
      spreadsheetId: "",
      sheetRange: "",
      followupSheetRange: "",
    };
  }

  return {
    googleClientEmail: extractConstString(source, "GOOGLE_CLIENT_EMAIL"),
    googlePrivateKey: extractConstString(source, "GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    googleDocId: extractConstString(source, "GOOGLE_DOC_ID"),
    spreadsheetId: extractConstString(source, "SPREADSHEET_ID"),
    sheetRange: extractConstString(source, "SHEET_RANGE"),
    followupSheetRange: extractConstString(source, "FOLLOWUP_SHEET_RANGE"),
  };
}

function transformSheetRowsToJSON(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const headers = rows[0];
  const dataRows = rows.slice(1);
  return dataRows.map((row) => {
    const obj = {};
    headers.forEach((headerName, colIndex) => {
      obj[headerName] = row[colIndex] || "";
    });
    return obj;
  });
}

function transformFollowupRows(rows) {
  if (!Array.isArray(rows)) return [];
  const rules = [];
  for (const row of rows) {
    const delayMinutes = Number.parseInt((row && row[0]) || "0", 10);
    const message = (row && row[1]) || "";
    if (!Number.isFinite(delayMinutes) || delayMinutes <= 0) continue;
    if (!message.trim()) continue;
    rules.push({
      delay_minutes: delayMinutes,
      message: message.trim(),
    });
  }
  return rules.map((rule, idx) => ({
    step_index: idx,
    delay_minutes: rule.delay_minutes,
    message: rule.message,
  }));
}

async function fetchGoogleDocInstructions({ email, key, docId }) {
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/documents.readonly"],
  });

  const docs = google.docs({ version: "v1", auth });
  const res = await docs.documents.get({ documentId: docId });
  const docBody = res.data.body?.content || [];

  let fullText = "";
  for (const block of docBody) {
    if (!block.paragraph?.elements) continue;
    for (const elem of block.paragraph.elements) {
      if (elem.textRun?.content) {
        fullText += elem.textRun.content;
      }
    }
  }
  return fullText.trim();
}

async function fetchSheetRows({ email, key, spreadsheetId, range }) {
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheetsApi = google.sheets({ version: "v4", auth });
  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return response.data.values || [];
}

function parseSimulationToInstructionData(filePath) {
  const content = readFileSafe(filePath);
  if (!content) {
    return {
      googleDoc: "",
      sheetData: [],
      staticInstructions: STATIC_INSTRUCTIONS_FALLBACK,
    };
  }

  const section1Marker = "SECTION 1: SYSTEM INSTRUCTIONS";
  const section2Marker = "SECTION 2: CHAT HISTORY";
  const section1Start = content.indexOf(section1Marker);
  const section2Start = content.indexOf(section2Marker);
  const scope =
    section1Start >= 0 && section2Start > section1Start
      ? content.slice(section1Start, section2Start)
      : content;

  const docMarker = "Below are instructions from the Google Doc:\n---\n";
  const sheetMarker = "\n\nBelow is additional data from Google Sheets (INSTRUCTIONS):\n---\n";
  const staticMarker = "\n\nถ้าลูกค้าส่งรูปภาพมา :";

  const docStart = scope.indexOf(docMarker);
  const sheetStart = scope.indexOf(sheetMarker);
  const staticStart = scope.indexOf(staticMarker);

  let googleDoc = "";
  let sheetData = [];
  let staticInstructions = STATIC_INSTRUCTIONS_FALLBACK;

  if (docStart >= 0 && sheetStart > docStart) {
    googleDoc = scope.slice(docStart + docMarker.length, sheetStart).trim();
  }

  if (sheetStart >= 0 && staticStart > sheetStart) {
    const sheetJsonText = scope.slice(sheetStart + sheetMarker.length, staticStart).trim();
    try {
      const parsed = JSON.parse(sheetJsonText);
      if (Array.isArray(parsed)) {
        sheetData = parsed;
      }
    } catch {
      sheetData = [];
    }
  }

  if (staticStart >= 0) {
    staticInstructions = scope.slice(staticStart + 2).trim();
  }

  return { googleDoc, sheetData, staticInstructions };
}

function loadFollowupRulesFromJson(filePath) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(ROOT_DIR, filePath);
  const raw = readFileSafe(absPath);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, idx) => {
        const delay = Number.parseInt(
          String(item.delay_minutes ?? item.delayMinutes ?? item.time ?? 0),
          10
        );
        const message = String(item.message || "").trim();
        if (!Number.isFinite(delay) || delay <= 0 || !message) return null;
        return { step_index: idx, delay_minutes: delay, message };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function upsertInstructionDefault({ payload, source, activate, dryRun }) {
  const now = new Date();
  const sanitizedSheetData = sanitizeSheetData(payload.sheetData || []);
  let sheetDataJson = "[]";
  try {
    sheetDataJson = JSON.stringify(sanitizedSheetData);
    JSON.parse(sheetDataJson);
  } catch {
    sheetDataJson = "[]";
  }

  const row = {
    id: "default",
    name: sanitizeStringForDb("Default Instruction"),
    description: sanitizeStringForDb(`Imported from ${source}`),
    googleDoc: sanitizeStringForDb(payload.googleDoc || ""),
    sheetData: sanitizedSheetData,
    sheetDataJson,
    staticInstructions: sanitizeStringForDb(payload.staticInstructions || STATIC_INSTRUCTIONS_FALLBACK),
    source: sanitizeStringForDb(source),
    isActive: activate,
    now,
  };

  if (dryRun) return row;

  if (activate) {
    await query(`UPDATE instruction_defaults SET is_active = false`);
  }

  await query(
    `INSERT INTO instruction_defaults
      (id, name, description, google_doc, sheet_data, static_instructions, source, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
     ON CONFLICT (id)
     DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       google_doc = EXCLUDED.google_doc,
       sheet_data = EXCLUDED.sheet_data,
       static_instructions = EXCLUDED.static_instructions,
       source = EXCLUDED.source,
       is_active = EXCLUDED.is_active,
       updated_at = EXCLUDED.updated_at`,
    [
      row.id,
      row.name,
      row.description,
      row.googleDoc,
      row.sheetDataJson,
      row.staticInstructions,
      row.source,
      row.isActive,
      row.now,
      row.now,
    ]
  );

  return row;
}

async function upsertFollowupRules({ rules, source, dryRun }) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return { imported: 0, skipped: true };
  }

  if (dryRun) {
    return { imported: rules.length, skipped: false };
  }

  const now = new Date();
  await query(`UPDATE followup_rules SET is_active = false, updated_at = $1`, [now]);

  for (const rule of rules) {
    const safeMessage = sanitizeStringForDb(rule.message);
    const safeDelay = Number.parseInt(String(rule.delay_minutes), 10);
    if (!Number.isFinite(safeDelay) || safeDelay <= 0 || !safeMessage) {
      continue;
    }

    await query(
      `INSERT INTO followup_rules
        (step_index, delay_minutes, message, source, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, $5, $6)
       ON CONFLICT (step_index)
       DO UPDATE SET
         delay_minutes = EXCLUDED.delay_minutes,
         message = EXCLUDED.message,
         source = EXCLUDED.source,
         is_active = EXCLUDED.is_active,
         updated_at = EXCLUDED.updated_at`,
      [rule.step_index, safeDelay, safeMessage, sanitizeStringForDb(source), now, now]
    );
  }

  return { imported: rules.length, skipped: false };
}

async function loadPayloadFromGoogle() {
  const codeConstants = getCodeConstants();
  const email = process.env.GOOGLE_CLIENT_EMAIL || codeConstants.googleClientEmail;
  const key = (process.env.GOOGLE_PRIVATE_KEY || codeConstants.googlePrivateKey || "").replace(/\\n/g, "\n");
  const docId = process.env.GOOGLE_DOC_ID || codeConstants.googleDocId;
  const spreadsheetId = process.env.INSTRUCTION_SPREADSHEET_ID || codeConstants.spreadsheetId;
  const sheetRange = process.env.INSTRUCTION_SHEET_RANGE || codeConstants.sheetRange || "ชีต1!A2:B28";
  const followupRange = process.env.FOLLOWUP_SHEET_RANGE || codeConstants.followupSheetRange || "ติดตามลูกค้า!A2:B";

  if (!email || !key || !docId || !spreadsheetId) {
    throw new Error(
      "Google config missing. Provide env vars or keep constants in index.js: GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_DOC_ID, SPREADSHEET_ID."
    );
  }

  const googleDoc = await fetchGoogleDocInstructions({ email, key, docId });
  const instructionRows = await fetchSheetRows({ email, key, spreadsheetId, range: sheetRange });
  const followupRows = await fetchSheetRows({ email, key, spreadsheetId, range: followupRange });

  return {
    payload: {
      googleDoc,
      sheetData: transformSheetRowsToJSON(instructionRows),
      staticInstructions: STATIC_INSTRUCTIONS_FALLBACK,
    },
    followupRules: transformFollowupRows(followupRows),
  };
}

function loadPayloadFromCode({ simulationFile, followupJson }) {
  const parsed = parseSimulationToInstructionData(simulationFile);
  const followupRules = followupJson ? loadFollowupRulesFromJson(followupJson) : [];

  return {
    payload: {
      googleDoc: parsed.googleDoc || "",
      sheetData: Array.isArray(parsed.sheetData) ? parsed.sheetData : [],
      staticInstructions: parsed.staticInstructions || STATIC_INSTRUCTIONS_FALLBACK,
    },
    followupRules,
  };
}

function printSummary({ source, dryRun, instruction, followupResult, payload }) {
  console.log("");
  console.log("=== Import Summary ===");
  console.log(`Source: ${source}`);
  console.log(`Dry run: ${dryRun ? "yes" : "no"}`);
  console.log(`Instruction ID: ${instruction.id}`);
  console.log(`Google Doc chars: ${payload.googleDoc.length}`);
  console.log(`Sheet rows: ${Array.isArray(payload.sheetData) ? payload.sheetData.length : 0}`);
  console.log(
    `Follow-up rules imported: ${followupResult.imported}${followupResult.skipped ? " (skipped)" : ""}`
  );
  console.log("======================");
  console.log("");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await connectDb();
  await initSchema();

  const loaded =
    args.source === "google"
      ? await loadPayloadFromGoogle()
      : loadPayloadFromCode({
          simulationFile: args.simulationFile,
          followupJson: args.followupJson,
        });

  const instruction = await upsertInstructionDefault({
    payload: loaded.payload,
    source: args.source,
    activate: args.activate,
    dryRun: args.dryRun,
  });

  const followupResult = await upsertFollowupRules({
    rules: loaded.followupRules,
    source: args.source,
    dryRun: args.dryRun,
  });

  printSummary({
    source: args.source,
    dryRun: args.dryRun,
    instruction,
    followupResult,
    payload: loaded.payload,
  });
}

main().catch((err) => {
  console.error("Import failed:", err.message || err);
  process.exit(1);
});
