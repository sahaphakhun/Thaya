/*******************************************************
 * โค้ด chatbot + Google Docs Instructions + 
 * Google Sheets (INSTRUCTIONS) + 
 * Google Sheets (ใหม่) สำหรับบันทึกออเดอร์
 * (ปรับแก้ให้สามารถปิด/เปิด AI ด้วยข้อความจากแอดมินเพจ)
 * + ปรับให้ทุกจุดเรียกโมเดลเป็น "gpt-4o-mini" เสมอ
 * + เพิ่ม log สำหรับ debugging Scheduler
 *******************************************************/
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const axios = require('axios');
const util = require('util');
const path = require('path');
const requestPost = util.promisify(request.post);
const requestGet = util.promisify(request.get);
const { google } = require('googleapis');
const { OpenAI } = require('openai');
const { connectDb, initSchema, query, withDbRetry } = require('./db/postgres');

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

// ====================== Serve Static Files for Instruction Manager ======================
app.use('/manager', express.static(path.join(__dirname, 'instruction-manager', 'public')));

// ====================== 1) ENV Config ======================
const PORT = process.env.PORT || 3000;
// เปลี่ยนจาก PAGE_ACCESS_TOKEN เป็น PAGE_ACCESS_TOKENS (รองรับหลายเพจ)
const PAGE_ACCESS_TOKENS = {
  default: process.env.PAGE_ACCESS_TOKEN, // เพจหลักเดิม
  page2: process.env.PAGE_ACCESS_TOKEN_2, // เพจที่ 2
  page3: process.env.PAGE_ACCESS_TOKEN_3, // เพจที่ 3
  page4: process.env.PAGE_ACCESS_TOKEN_4,  // เพจที่ 4
  page5: process.env.PAGE_ACCESS_TOKEN_5,  // เพจที่ 5
  page6: process.env.PAGE_ACCESS_TOKEN_6,  // เพจที่ 6
  page7: process.env.PAGE_ACCESS_TOKEN_7,  // เพจที่ 7
  page8: process.env.PAGE_ACCESS_TOKEN_8,  // เพจที่ 8
  page9: process.env.PAGE_ACCESS_TOKEN_9,  // เพจที่ 9
  page10: process.env.PAGE_ACCESS_TOKEN_10, // เพจที่ 10
  page11: process.env.PAGE_ACCESS_TOKEN_11, // เพจที่ 11
  page12: process.env.PAGE_ACCESS_TOKEN_12, // เพจที่ 12
  page13: process.env.PAGE_ACCESS_TOKEN_13,  // เพจที่ 13
  page14: process.env.PAGE_ACCESS_TOKEN_14,  // เพจที่ 14
};
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "AiDee_a4wfaw4";
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_CONNECTION_STRING;

const IMAGE_DOWNLOAD_FAIL_PLACEHOLDER = "[ข้อความจากระบบ: ผู้ใช้ส่งรูปภาพมา แต่ไม่สามารถดาวน์โหลดได้ โปรดแจ้งลูกค้าว่ารอแอดมินยืนยันหากเป็นรูปภาพการชำระเงิน หรือแจ้งให้รบกวนพิมพ์ที่อยู่มาหากเป็นรูปภาพที่อยู่ของการจัดส่ง (ถามผู้ใช้หรือวิเคราะห์จากบริบท)]";

function getIntEnv(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCommandText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasAnyKeyword(normalizedText, keywords) {
  return keywords.some(keyword => normalizedText.includes(keyword));
}

const ADMIN_DISABLE_AI_KEYWORDS = [
  "แอดมิน thaya รอให้คำปรึกษาค่ะ",
  "#ปิดระบบ",
  "ปิดระบบ",
  "#ปิดบอท",
  "ปิดระบบ ai",
  "ปิด ai",
  "หยุด ai",
  "หยุดตอบอัตโนมัติ",
  "ให้แอดมินตอบ",
  "รอให้แอดมินตอบ",
  "handover"
].map(normalizeCommandText);

const ADMIN_ENABLE_AI_KEYWORDS = [
  "แอดมิน thaya ยินดีดูแลลูกค้าค่ะ",
  "#เปิดระบบ",
  "เปิดระบบ",
  "#เปิดบอท",
  "เปิดระบบ ai",
  "เปิด ai",
  "ให้ ai ตอบ",
  "ให้บอทตอบ",
  "กลับมาให้ ai ตอบ",
  "resume ai"
].map(normalizeCommandText);

const DEFAULT_HANDOVER_AUTO_REPLY = "ลูกค้าสนใจอยากปรึกษาด้านไหนดีคะ";
const ADMIN_HANDOVER_AUTO_REPLY = (
  process.env.ADMIN_HANDOVER_AUTO_REPLY === undefined
    ? DEFAULT_HANDOVER_AUTO_REPLY
    : process.env.ADMIN_HANDOVER_AUTO_REPLY
).trim();

const CHAT_HISTORY_MAX_MESSAGES = getIntEnv(process.env.CHAT_HISTORY_MAX_MESSAGES, 50);
const CHAT_HISTORY_SUMMARY_MIN_BATCH = getIntEnv(process.env.CHAT_HISTORY_SUMMARY_MIN_BATCH, 10);
const CHAT_HISTORY_SUMMARY_SOURCE_MAX_CHARS = getIntEnv(process.env.CHAT_HISTORY_SUMMARY_SOURCE_MAX_CHARS, 6000);
const CHAT_HISTORY_SUMMARY_MAX_CHARS = getIntEnv(process.env.CHAT_HISTORY_SUMMARY_MAX_CHARS, 1200);
const ENABLE_CHAT_SUMMARY = process.env.ENABLE_CHAT_SUMMARY !== "false";
const ENABLE_ORDER_CHAT_HISTORY = process.env.ENABLE_ORDER_CHAT_HISTORY === "true";
const MONGO_CONNECT_RETRY_COUNT = Math.max(getIntEnv(process.env.MONGO_CONNECT_RETRY_COUNT, 2), 0);
const MONGO_OPERATION_RETRY_COUNT = Math.max(getIntEnv(process.env.MONGO_OPERATION_RETRY_COUNT, 1), 0);
const MONGO_RETRY_DELAY_MS = Math.max(getIntEnv(process.env.MONGO_RETRY_DELAY_MS, 500), 100);
const WEBHOOK_SUMMARY_INTERVAL_MS = Math.max(getIntEnv(process.env.WEBHOOK_SUMMARY_INTERVAL_MS, 60000), 10000);

const LOG_LEVEL_RANK = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};
const CONFIGURED_LOG_LEVEL = String(process.env.LOG_LEVEL || "info").toLowerCase();
const ACTIVE_LOG_LEVEL = Object.prototype.hasOwnProperty.call(LOG_LEVEL_RANK, CONFIGURED_LOG_LEVEL)
  ? CONFIGURED_LOG_LEVEL
  : "info";

const rawConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function shouldLogLevel(level) {
  const rank = LOG_LEVEL_RANK[level];
  if (rank === undefined) return false;
  return rank <= LOG_LEVEL_RANK[ACTIVE_LOG_LEVEL];
}

function maskUserId(userId) {
  const str = String(userId || "");
  if (!str) return "unknown";
  if (str.length <= 4) return `***${str}`;
  return `${str.slice(0, 2)}***${str.slice(-2)}`;
}

function getAttachmentTypes(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .map(att => att && att.type)
    .filter(Boolean)
    .slice(0, 10);
}

function serializeError(err) {
  if (!err) return { message: "Unknown error" };
  return {
    name: err.name,
    message: err.message,
    code: err.code,
    status: err.status,
  };
}

function safeJsonStringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (key, current) => {
    if (current instanceof Error) {
      return serializeError(current);
    }
    if (typeof current === "string" && current.length > 400) {
      return `${current.slice(0, 400)}...[truncated]`;
    }
    if (typeof current === "object" && current !== null) {
      if (seen.has(current)) return "[circular]";
      seen.add(current);
    }
    return current;
  });
}

function writeStructuredLog(level, event, meta = {}) {
  if (!shouldLogLevel(level)) return;

  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...meta,
  };
  const line = safeJsonStringify(payload);

  if (level === "error") {
    rawConsole.error(line);
    return;
  }
  if (level === "warn") {
    rawConsole.warn(line);
    return;
  }
  rawConsole.log(line);
}

const logger = {
  debug: (event, meta) => writeStructuredLog("debug", event, meta),
  info: (event, meta) => writeStructuredLog("info", event, meta),
  warn: (event, meta) => writeStructuredLog("warn", event, meta),
  error: (event, meta) => writeStructuredLog("error", event, meta),
};

const ORDER_SKIP_LOG_SAMPLE_RATE = Math.min(
  Math.max(Number.parseFloat(process.env.ORDER_SKIP_LOG_SAMPLE_RATE || "0.1"), 0),
  1
);

function shouldSample(rate = ORDER_SKIP_LOG_SAMPLE_RATE) {
  return Math.random() < rate;
}

const LEGACY_NOISY_LOG_PATTERNS = [
  "[DEBUG]",
  "[Scheduler DEBUG]",
  "Skipping delivery/read event",
  "Skipping repeated mid:",
  ">> [Webhook] Received",
];

function shouldSuppressLegacyLog(args) {
  if (process.env.LOG_SUPPRESS_LEGACY_DEBUG === "false") return false;
  if (shouldLogLevel("debug")) return false;
  if (!Array.isArray(args) || args.length === 0) return false;

  const firstArg = typeof args[0] === "string" ? args[0] : "";
  return LEGACY_NOISY_LOG_PATTERNS.some(pattern => firstArg.includes(pattern));
}

console.log = (...args) => {
  if (shouldSuppressLegacyLog(args)) return;
  rawConsole.log(...args);
};

// เพิ่มการเก็บข้อมูลเพจ (pageId -> pageName)
const PAGE_MAPPING = {
  // ตัวอย่าง: 'page_id_1': 'default', 'page_id_2': 'page2', ...
  // จะถูกเติมข้อมูลอัตโนมัติเมื่อมีการรับ webhook
};

// หากมีการเชื่อมต่อ Google Docs, Sheets
const GOOGLE_CLIENT_EMAIL = "aitar-888@eminent-wares-446512-j8.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGhyeINArKZgaV\nitEcK+o89ilPYeRNTNZgJT7VNHB5hgNLLeAcFLJ7IlCIqTLMoJEnnoDQil6aKaz8\nExVL83uSXRrzk4zQvtt3tIP31+9wOCb9D4ZGWfVP1tD0qdD4WJ1qqg1j1/8879pH\nUeQGEMuCnyVbcQ3GbYQjyYb3wEz/Qv7kMVggF+MIaGGw2NQwM0XcufSFtyxvvX2S\nb8uGc1A8R+Dn/tmcgMODhbtEgcMg6yXI5Y26MPfDjVrEbk0lfCr7IGFJX4ASYeKl\n0jhm0RGb+aya2cb55auLN3VPO5MQ+cOp8gHBf5GiC/YgF1gbRgF5b7LgmENBxSfH\nb3WVQodLAgMBAAECggEACKB14M7LdekXZHyAQrZL0EitbzQknLv33Xyw2B3rvJ7M\nr4HM/nC4eBj7y+ciUc8GZQ+CWc2GzTHTa66+mwAia1qdYbPp3LuhGM4Leq5zn/o+\nA3rJuG6PS4qyUMy89msPXW5fSj/oE535QREiFKYP2dtlia2GI4xoag+x9uZwfMUO\nWKEe7tiUoZQEiGhwtjLq9lyST4kGGmlhNee9OyhDJcw4uCt8Cepr++hMDleWUF6c\nX0nbGmoSS0sZ5Boy8ATMhw/3luaOAlTUEz/nVDvbbWlNL9etwLKiAVw+AQXsPHNW\nNWF7gyEIsEi0qSM3PtA1X7IdReRXHqmfiZs0J3qSQQKBgQD1+Yj37Yuqj8hGi5PY\n+M0ieMdGcbUOmJsM1yUmBMV4bfaTiqm504P6DIYAqfDDWeozcHwcdpG1AfFAihEi\nh6lb0qRk8YaGbzvac8mWhwo/jDA5QB97fjFa6uwtlewZ0Er/U3QmOeVVnVC1y1b0\nrbJD5yjvI3ve+gpwAz0glpIMiwKBgQDOnpD7p7ylG4NQunqmzzdozrzZP0L6EZyE\n141st/Hsp9rtO9/ADuH6WhpirQ516l5LLv7mLPA8S9CF/cSdWF/7WlxBPjM8WRs9\nACFNBJIwUfjzPnvECmtsayzRlKuyCAspnNSkzgtdtvf2xI82Z3BGov9goZfu+D4A\n36b1qXsIQQKBgQCO1CojhO0vyjPKOuxL9hTvqmBUWFyBMD4AU8F/dQ/RYVDn1YG+\npMKi5Li/E+75EHH9EpkO0g7Do3AaQNG4UjwWVJcfAlxSHa8Mp2VsIdfilJ2/8KsX\nQ2yXVYh04/Rn/No/ro7oT4AKmcGu/nbstxuncEgFrH4WOOzspATPsn72BwKBgG5N\nBAT0NKbHm0B7bIKkWGYhB3vKY8zvnejk0WDaidHWge7nabkzuLtXYoKO9AtKxG/K\ndNUX5F+r8XO2V0HQLd0XDezecaejwgC8kwp0iD43ZHkmQBgVn+dPB6wSe94coSjj\nyjj4reSnipQ3tmRKsAtldIN3gI5YA3Gf85dtlHqBAoGAD5ePt7cmu3tDZhA3A8f9\no8mNPvqz/WGs7H2Qgjyfc3jUxEGhVt1Su7J1j+TppfkKtJIDKji6rVA9oIjZtpZT\ngxnU6hcYuiwbLh3wGEFIjP1XeYYILudqfWOEbwnxD1RgMkCqfSHf/niWlfiH6p3F\ndnBsLY/qXdKfS/OXyezAm4M=\n-----END PRIVATE KEY-----\n";

// ------------------- (A) Google Docs -------------------
const GOOGLE_DOC_ID = "1IDvCXWa_5QllMTKrVSvhLRQPNNGkYgxb8byaDGGEhyU";

// ------------------- (B) Google Sheet สำหรับ "INSTRUCTIONS" -------------------
const SPREADSHEET_ID = "1esN_P6JuPzYUGesR60zVuIGeuvSnRM1hlyaxCJbhI_c";
const SHEET_RANGE = "ชีต1!A2:B28";  // (ยังคงเดิม ไม่แก้ส่วนนี้)

// ------------------- (C) Google Sheet สำหรับ "บันทึกออเดอร์" (ใหม่) -------------------
const ORDERS_SPREADSHEET_ID = "1f783DDFR0ZZDM4wG555Zpwmq6tQ2e9tWT28H0qRBPhU";
const SHEET_NAME_FOR_ORDERS = "บันทึกออเดอร์";
const ORDERS_RANGE = `${SHEET_NAME_FOR_ORDERS}!A2:K`;

// (NEW) สำหรับ Follow-up - แก้เป็น "A2:B" เพื่อไม่จำกัดจำนวนแถว
const FOLLOWUP_SHEET_RANGE = "ติดตามลูกค้า!A2:B";

// ====================== 2) PostgreSQL ======================
let dbSchemaReady = false;

async function withMongoRetry(label, operation, retryCount = MONGO_OPERATION_RETRY_COUNT) {
  return withDbRetry(label, operation, retryCount, MONGO_RETRY_DELAY_MS);
}

async function connectDB() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  return withDbRetry("connectDb", () => connectDb(), MONGO_CONNECT_RETRY_COUNT, MONGO_RETRY_DELAY_MS);
}

async function ensureMongoIndexes() {
  if (dbSchemaReady) return;
  await withMongoRetry("initSchema", async () => {
    await initSchema();
  }, MONGO_CONNECT_RETRY_COUNT);
  dbSchemaReady = true;
}

function stripRichContentForStorage(content) {
  if (!Array.isArray(content)) return content;

  const sanitized = [];
  for (const item of content) {
    if (item && item.type === "text" && typeof item.text === "string") {
      sanitized.push({ type: "text", text: item.text });
      continue;
    }
    if (item && item.type === "image_url") {
      sanitized.push({ type: "text", text: "[ผู้ใช้ส่งรูปภาพ]" });
      continue;
    }
    if (item && item.type === "video_url") {
      sanitized.push({ type: "text", text: "[ผู้ใช้ส่งวิดีโอ]" });
      continue;
    }
    sanitized.push({ type: "text", text: "[มีไฟล์แนบ]" });
  }
  return sanitized;
}

function sanitizeContentForStorage(content) {
  if (Array.isArray(content)) {
    return stripRichContentForStorage(content);
  }
  if (typeof content === "string" && content.startsWith("data:image/")) {
    return "[ผู้ใช้ส่งรูปภาพ]";
  }
  return content;
}

function parseStoredContent(rawContent) {
  if (typeof rawContent !== "string") return rawContent;
  try {
    return JSON.parse(rawContent);
  } catch (err) {
    return rawContent;
  }
}

function extractPlainTextFromContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map(item => {
        if (item && typeof item.text === "string") return item.text;
        return "[มีไฟล์แนบ]";
      })
      .join(" ");
  }
  return JSON.stringify(content);
}

function truncateText(text, maxChars) {
  if (typeof text !== "string") return text;
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}...[ตัดข้อความยาว]`;
}

// เพิ่มฟังก์ชันสำหรับบันทึกประวัติการสนทนาสำหรับโมเดลบันทึกออเดอร์
async function saveOrderChatHistory(userId, messageContent, role = "user") {
  if (!ENABLE_ORDER_CHAT_HISTORY) return;
  const sanitized = sanitizeContentForStorage(messageContent);
  let msgToSave;
  if (typeof sanitized === "string") {
    msgToSave = sanitized;
  } else {
    msgToSave = JSON.stringify(sanitized);
  }

  console.log(`[DEBUG] Saving order chat history => role=${role}`);
  await withMongoRetry("saveOrderChatHistory.insert", async () => {
    await query(
      `INSERT INTO order_chat_history (sender_id, role, content, timestamp)
       VALUES ($1, $2, $3, $4)`,
      [userId, role, msgToSave, new Date()]
    );
  });
  console.log(`[DEBUG] Saved order message. userId=${userId}, role=${role}`);
}

// เพิ่มฟังก์ชันสำหรับดึงประวัติการสนทนาสำหรับโมเดลบันทึกออเดอร์
async function getOrderChatHistory(userId) {
  if (!ENABLE_ORDER_CHAT_HISTORY) return [];
  const result = await withMongoRetry("getOrderChatHistory", async () =>
    query(
      `SELECT role, content
       FROM order_chat_history
       WHERE sender_id = $1
       ORDER BY timestamp ASC`,
      [userId]
    )
  );
  const chats = result.rows || [];

  return chats.map(ch => {
    const parsed = parseStoredContent(ch.content);
    return normalizeRoleContent(ch.role, parsed);
  });
}

// เพิ่มฟังก์ชันสำหรับลบประวัติการสนทนาสำหรับโมเดลบันทึกออเดอร์
async function clearOrderChatHistory(userId) {
  if (!ENABLE_ORDER_CHAT_HISTORY) return;
  console.log(`[DEBUG] Clearing order chat history for userId=${userId}`);
  await withMongoRetry("clearOrderChatHistory", async () => {
    await query(`DELETE FROM order_chat_history WHERE sender_id = $1`, [userId]);
  });
  console.log(`[DEBUG] Cleared order chat history for userId=${userId}`);
}

// เพิ่มฟังก์ชันสำหรับบันทึกข้อมูลที่อยู่และเบอร์โทรของผู้ใช้
async function saveUserContactInfo(userId, address, phone) {
  console.log(`[DEBUG] Saving user contact info => userId=${userId}`);
  await withMongoRetry("saveUserContactInfo", async () => {
    await query(
      `INSERT INTO user_contact_info (user_id, address, phone, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id)
       DO UPDATE SET address = EXCLUDED.address,
                     phone = EXCLUDED.phone,
                     updated_at = EXCLUDED.updated_at`,
      [userId, address, phone, new Date()]
    );
  });
  console.log(`[DEBUG] Saved user contact info. userId=${userId}`);
}

// เพิ่มฟังก์ชันสำหรับดึงข้อมูลที่อยู่และเบอร์โทรของผู้ใช้
async function getUserContactInfo(userId) {
  const result = await withMongoRetry("getUserContactInfo", async () =>
    query(`SELECT address, phone FROM user_contact_info WHERE user_id = $1`, [userId])
  );
  const info = result.rows?.[0];
  if (!info) {
    return { address: "", phone: "" };
  }

  return {
    address: info.address || "",
    phone: info.phone || ""
  };
}

// เพิ่มฟังก์ชันสำหรับสร้าง orderID
function generateOrderID() {
  const now = new Date();
  const timestamp = now.getTime();
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `ORD-${timestamp}-${randomStr}`;
}

// เพิ่มฟังก์ชันสำหรับตรวจสอบออเดอร์ซ้ำ
async function checkDuplicateOrder(userId, phone, address, promotion) {
  try {
    console.log(`[DEBUG] checkDuplicateOrder => userId=${userId}, phone=${phone}, promotion=${promotion}`);
    // ตรวจสอบว่ามีออเดอร์ที่มีข้อมูลตรงกันในช่วง 24 ชั่วโมงที่ผ่านมาหรือไม่
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const result = await withMongoRetry("checkDuplicateOrder", async () =>
      query(
        `SELECT *
         FROM orders
         WHERE user_id = $1
           AND phone = $2
           AND promotion = $3
           AND created_at >= $4
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, phone, promotion, oneDayAgo]
      )
    );

    return result.rows?.[0] || null;
  } catch (err) {
    console.error("checkDuplicateOrder error:", err);
    return null;
  }
}

// เพิ่มฟังก์ชันสำหรับบันทึกออเดอร์ลง DB
async function saveOrderToDB(orderData, orderID) {
  try {
    console.log(`[DEBUG] saveOrderToDB => orderID=${orderID}`);
    const createdAt = new Date();
    await withMongoRetry("saveOrderToDB.insert", async () => {
      await query(
        `INSERT INTO orders (
          order_id,
          user_id,
          fb_name,
          customer_name,
          address,
          phone,
          promotion,
          total,
          payment_method,
          note,
          page_source,
          created_at,
          status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )`,
        [
          orderID,
          orderData.userId,
          orderData.fb_name || "",
          orderData.customer_name || "",
          orderData.address || "",
          orderData.phone || "",
          orderData.promotion || "",
          orderData.total || "",
          orderData.payment_method || "",
          orderData.note || "",
          orderData.page_source || "default",
          createdAt,
          "new",
        ]
      );
    });
    console.log(`[DEBUG] Order saved to DB: ${orderID}`);
    return true;
  } catch (err) {
    console.error("saveOrderToDB error:", err);
    return false;
  }
}

function normalizeRoleContent(role, content) {
  if (typeof content === "string" || Array.isArray(content)) {
    return { role, content };
  }
  return { role, content: JSON.stringify(content) };
}

// ข้อ 3: ปรับ Image Processing - เพิ่ม size limit และ timeout
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB limit
const IMAGE_DOWNLOAD_TIMEOUT = 10000; // 10 seconds timeout

async function downloadImageAsBase64(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: IMAGE_DOWNLOAD_TIMEOUT,
      maxContentLength: MAX_IMAGE_SIZE,
      maxBodyLength: MAX_IMAGE_SIZE
    });

    // ตรวจสอบขนาดไฟล์
    const fileSize = response.data.length;
    if (fileSize > MAX_IMAGE_SIZE) {
      console.warn(`[WARN] Image too large (${(fileSize / 1024 / 1024).toFixed(2)}MB), skipping base64 conversion`);
      throw new Error('Image too large');
    }

    const contentType = response.headers['content-type'] || 'image/jpeg';
    const base64 = Buffer.from(response.data).toString('base64');

    // Clear buffer reference เพื่อให้ GC ทำงานได้
    response.data = null;

    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.error(`[ERROR] downloadImageAsBase64 failed: ${err.message}`);
    throw err;
  }
}

// ตรวจสอบและดาวน์โหลดรูปภาพจาก URL (หากยังไม่เป็น base64)
async function convertImageUrlsToBase64(content) {
  if (!Array.isArray(content)) return content;

  const newContent = [];
  for (const item of content) {
    if (item.type === 'image_url' && item.image_url && item.image_url.url) {
      const imageUrl = item.image_url.url;
      if (/^https?:\/\//i.test(imageUrl)) {
        try {
          const base64Url = await downloadImageAsBase64(imageUrl);
          newContent.push({
            ...item,
            image_url: { ...item.image_url, url: base64Url }
          });
        } catch (err) {
          newContent.push({ type: 'text', text: IMAGE_DOWNLOAD_FAIL_PLACEHOLDER });
        }
        continue;
      }
    }
    newContent.push(item);
  }
  return newContent;
}

// ทำความสะอาดประวัติแชตและข้อความก่อนส่งให้ OpenAI
async function sanitizeMessages(messages) {
  const cleaned = [];
  for (const msg of messages) {
    const converted = await convertImageUrlsToBase64(msg.content);
    cleaned.push({ ...msg, content: converted });
  }
  return cleaned;
}

// เพิ่มฟังก์ชันแปลง timestamp เป็นข้อความไทย
function formatTimestampThai(dateObj) {
  if (!dateObj) return "";
  const d = new Date(dateObj);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = (d.getFullYear() + 543).toString(); // แปลงเป็น พ.ศ.
  const hour = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hour}:${min}`;
}

async function generateChatSummary(previousSummary, messages) {
  if (!ENABLE_CHAT_SUMMARY || !OPENAI_API_KEY) return null;

  const sourceLines = messages.map(msg => {
    const parsed = parseStoredContent(msg.content);
    const text = extractPlainTextFromContent(parsed);
    return `${msg.role}: ${text}`;
  });

  const sourceText = truncateText(sourceLines.join("\n"), CHAT_HISTORY_SUMMARY_SOURCE_MAX_CHARS);
  const summarySeed = previousSummary ? `สรุปเดิม:\n${previousSummary}\n\n` : "";

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "สรุปบทสนทนาให้สั้น กระชับ เน้นเจตนา/ความต้องการ/สถานะออเดอร์ หลีกเลี่ยงข้อมูลส่วนตัวเช่นเบอร์โทรหรือที่อยู่ ถ้าจำเป็นให้เขียนแบบปิดบัง"
        },
        {
          role: "user",
          content: `${summarySeed}บทสนทนาใหม่:\n${sourceText}`
        }
      ]
    });

    let summary = response.choices?.[0]?.message?.content || "";
    summary = summary.replace(/\s+/g, " ").trim();
    return truncateText(summary, CHAT_HISTORY_SUMMARY_MAX_CHARS);
  } catch (err) {
    console.error("generateChatSummary error:", err);
    return null;
  }
}

async function upsertChatSummary(userId, messages) {
  if (!ENABLE_CHAT_SUMMARY || !OPENAI_API_KEY) return;
  if (!messages || messages.length === 0) return;

  const existingResult = await withMongoRetry("chatSummary.select", async () =>
    query(`SELECT summary FROM chat_history_summaries WHERE sender_id = $1`, [userId])
  );
  const existing = existingResult.rows?.[0];

  const summary = await generateChatSummary(existing?.summary || "", messages);
  if (!summary) return;

  const first = messages[0];
  const last = messages[messages.length - 1];
  await withMongoRetry("chatSummary.upsert", async () => {
    await query(
      `INSERT INTO chat_history_summaries
        (sender_id, summary, updated_at, from_timestamp, to_timestamp, message_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (sender_id)
       DO UPDATE SET summary = EXCLUDED.summary,
                     updated_at = EXCLUDED.updated_at,
                     from_timestamp = EXCLUDED.from_timestamp,
                     to_timestamp = EXCLUDED.to_timestamp,
                     message_count = EXCLUDED.message_count`,
      [userId, summary, new Date(), first.timestamp, last.timestamp, messages.length]
    );
  });
}

async function pruneChatHistory(userId) {
  if (CHAT_HISTORY_MAX_MESSAGES <= 0) return;
  await withMongoRetry("pruneChatHistory", async () => {
    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM chat_history WHERE sender_id = $1`,
      [userId]
    );
    const total = countResult.rows?.[0]?.total || 0;
    const overflow = total - CHAT_HISTORY_MAX_MESSAGES;
    if (overflow <= 0) return;

    const canSummarize = ENABLE_CHAT_SUMMARY && OPENAI_API_KEY;
    const batchSize = Math.max(CHAT_HISTORY_SUMMARY_MIN_BATCH, 1);
    let pruneCount = overflow;
    if (canSummarize && batchSize > 1) {
      if (total <= CHAT_HISTORY_MAX_MESSAGES + batchSize - 1) return;
      pruneCount = batchSize;
    }

    const messagesResult = await query(
      `SELECT id, role, content, timestamp
       FROM chat_history
       WHERE sender_id = $1
       ORDER BY timestamp ASC
       LIMIT $2`,
      [userId, pruneCount]
    );
    const messagesToPrune = messagesResult.rows || [];

    if (messagesToPrune.length === 0) return;

    if (canSummarize) {
      await upsertChatSummary(userId, messagesToPrune);
    }

    await query(
      `DELETE FROM chat_history WHERE id = ANY($1::bigint[])`,
      [messagesToPrune.map(msg => msg.id)]
    );
  });
}

async function getChatHistory(userId) {
  return withMongoRetry("getChatHistory", async () => {
    const chatsResult = await query(
      `SELECT role, content, timestamp
       FROM chat_history
       WHERE sender_id = $1
       ORDER BY timestamp ASC`,
      [userId]
    );
    const chats = chatsResult.rows || [];

    const summaryResult = await query(
      `SELECT summary FROM chat_history_summaries WHERE sender_id = $1`,
      [userId]
    );
    const summaryDoc = summaryResult.rows?.[0];

    const history = chats.map(ch => {
      let content = parseStoredContent(ch.content);

      // เพิ่ม timestamp เฉพาะข้อความฝั่งลูกค้า (role === "user")
      if (ch.role === "user") {
        const timeStr = formatTimestampThai(ch.timestamp);
        if (typeof content === "string") {
          content = `[ข้อความนี้ส่งเมื่อ ${timeStr}] ${content}`;
        } else if (Array.isArray(content) && content.length > 0 && content[0].text) {
          content = [...content];
          content[0] = { ...content[0], text: `[ข้อความนี้ส่งเมื่อ ${timeStr}] ${content[0].text}` };
        } else {
          content = `[ข้อความนี้ส่งเมื่อ ${timeStr}] ${JSON.stringify(content)}`;
        }
      }

      return { role: ch.role, content };
    });

    if (summaryDoc && summaryDoc.summary) {
      history.unshift({ role: "system", content: `สรุปการสนทนาก่อนหน้า: ${summaryDoc.summary}` });
    }
    return history;
  });
}

async function saveChatHistory(userId, messageContent, role = "user") {
  const sanitized = sanitizeContentForStorage(messageContent);
  let msgToSave;
  if (typeof sanitized === "string") {
    msgToSave = sanitized;
  } else {
    msgToSave = JSON.stringify(sanitized);
  }

  console.log(`[DEBUG] Saving chat history => role=${role}`);
  await withMongoRetry("saveChatHistory.insertOne", async () => {
    await query(
      `INSERT INTO chat_history (sender_id, role, content, timestamp)
       VALUES ($1, $2, $3, $4)`,
      [userId, role, msgToSave, new Date()]
    );
  });
  console.log(`[DEBUG] Saved message. userId=${userId}, role=${role}`);
  pruneChatHistory(userId).catch(err => {
    console.error("pruneChatHistory error:", err);
  });
}

async function getUserStatus(userId) {
  return withMongoRetry("getUserStatus", async () => {
    const result = await query(
      `SELECT sender_id, ai_enabled, welcome_message_enabled, updated_at
       FROM active_user_status
       WHERE sender_id = $1`,
      [userId]
    );
    let userStatus = result.rows?.[0];
    if (!userStatus) {
      userStatus = {
        sender_id: userId,
        ai_enabled: true,
        welcome_message_enabled: true,
        updated_at: new Date()
      };
      await query(
        `INSERT INTO active_user_status (sender_id, ai_enabled, welcome_message_enabled, updated_at)
         VALUES ($1, $2, $3, $4)`,
        [userId, true, true, userStatus.updated_at]
      );
    } else if (typeof userStatus.welcome_message_enabled !== "boolean") {
      userStatus.welcome_message_enabled = true;
      userStatus.updated_at = new Date();
      await query(
        `UPDATE active_user_status
         SET welcome_message_enabled = $1, updated_at = $2
         WHERE sender_id = $3`,
        [true, userStatus.updated_at, userId]
      );
    }
    return {
      senderId: userStatus.sender_id,
      aiEnabled: userStatus.ai_enabled !== false,
      welcomeMessageEnabled: userStatus.welcome_message_enabled !== false,
      updatedAt: userStatus.updated_at
    };
  });
}

async function setUserStatus(userId, aiEnabled, options = {}) {
  console.log(`[DEBUG] setUserStatus: userId=${userId}, aiEnabled=${aiEnabled}, options=`, options);
  const setPayload = {
    aiEnabled,
    updatedAt: new Date()
  };
  if (typeof options.welcomeMessageEnabled === "boolean") {
    setPayload.welcomeMessageEnabled = options.welcomeMessageEnabled;
  }

  await withMongoRetry("setUserStatus", async () => {
    const welcomeValue =
      typeof options.welcomeMessageEnabled === "boolean"
        ? options.welcomeMessageEnabled
        : null;
    await query(
      `INSERT INTO active_user_status (sender_id, ai_enabled, welcome_message_enabled, updated_at)
       VALUES ($1, $2, COALESCE($3, true), $4)
       ON CONFLICT (sender_id)
       DO UPDATE SET ai_enabled = EXCLUDED.ai_enabled,
                     welcome_message_enabled = COALESCE($3, active_user_status.welcome_message_enabled),
                     updated_at = EXCLUDED.updated_at`,
      [userId, Boolean(aiEnabled), welcomeValue, setPayload.updatedAt]
    );
  });
}

/*******************************************************
 * ตัวอย่างฟังก์ชัน getCustomerOrderStatus แก้ไขให้บันทึก field ได้แน่นอน
 *******************************************************/
async function getCustomerOrderStatus(userId) {
  const result = await withMongoRetry("getCustomerOrderStatus", async () =>
    query(
      `SELECT
        sender_id,
        order_status,
        followup_index,
        last_user_reply_at,
        last_followup_at,
        followup_disabled,
        followup_disabled_at,
        followup_enabled_at,
        updated_at
       FROM customer_order_status
       WHERE sender_id = $1`,
      [userId]
    )
  );

  let row = result.rows?.[0];
  if (!row) {
    const now = new Date();
    await query(
      `INSERT INTO customer_order_status
        (sender_id, order_status, followup_index, last_user_reply_at, last_followup_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, "pending", 0, now, null, now]
    );
    return {
      senderId: userId,
      orderStatus: "pending",
      followupIndex: 0,
      lastUserReplyAt: now,
      lastFollowupAt: null,
      followupDisabled: false,
      followupDisabledAt: null,
      followupEnabledAt: null,
      updatedAt: now
    };
  }

  let updateNeeded = false;
  const updateObj = {};

  if (!row.order_status) {
    updateObj.order_status = "pending";
    updateNeeded = true;
  }
  if (typeof row.followup_index !== "number") {
    updateObj.followup_index = 0;
    updateNeeded = true;
  }
  if (!row.last_user_reply_at) {
    updateObj.last_user_reply_at = new Date();
    updateNeeded = true;
  }

  if (updateNeeded) {
    updateObj.updated_at = new Date();
    const fields = [];
    const values = [];
    let idx = 1;
    for (const [key, value] of Object.entries(updateObj)) {
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx += 1;
    }
    values.push(userId);
    await query(
      `UPDATE customer_order_status SET ${fields.join(", ")} WHERE sender_id = $${idx}`,
      values
    );
    row = { ...row, ...updateObj };
  }

  return {
    senderId: row.sender_id,
    orderStatus: row.order_status || "pending",
    followupIndex: typeof row.followup_index === "number" ? row.followup_index : 0,
    lastUserReplyAt: row.last_user_reply_at,
    lastFollowupAt: row.last_followup_at || null,
    followupDisabled: row.followup_disabled === true,
    followupDisabledAt: row.followup_disabled_at || null,
    followupEnabledAt: row.followup_enabled_at || null,
    updatedAt: row.updated_at
  };
}

async function updateCustomerOrderStatus(userId, status) {
  console.log(`[DEBUG] updateCustomerOrderStatus: userId=${userId}, status=${status}`);
  await withMongoRetry("updateCustomerOrderStatus", async () => {
    await query(
      `INSERT INTO customer_order_status (sender_id, order_status, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (sender_id)
       DO UPDATE SET order_status = EXCLUDED.order_status,
                     updated_at = EXCLUDED.updated_at`,
      [userId, status, new Date()]
    );
  });
}

async function updateFollowupData(userId, followupIndex, lastFollowupDate) {
  console.log(`[DEBUG] updateFollowupData => userId=${userId}, followupIndex=${followupIndex}`);
  try {
    await withMongoRetry("updateFollowupData", async () => {
      await query(
        `INSERT INTO customer_order_status
          (sender_id, followup_index, last_followup_at, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (sender_id)
         DO UPDATE SET followup_index = EXCLUDED.followup_index,
                       last_followup_at = EXCLUDED.last_followup_at,
                       updated_at = EXCLUDED.updated_at`,
        [userId, followupIndex, lastFollowupDate, new Date()]
      );
    });
  } catch (err) {
    console.error("updateFollowupData error:", err);
  }
}

// เพิ่มฟังก์ชันใหม่สำหรับปิดการใช้งาน followup สำหรับผู้ใช้เฉพาะราย
async function disableFollowupForUser(userId) {
  console.log(`[DEBUG] disableFollowupForUser => userId=${userId}`);
  try {
    await withMongoRetry("disableFollowupForUser", async () => {
      const result = await query(
        `INSERT INTO customer_order_status
          (sender_id, followup_disabled, followup_disabled_at, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (sender_id)
         DO UPDATE SET followup_disabled = EXCLUDED.followup_disabled,
                       followup_disabled_at = EXCLUDED.followup_disabled_at,
                       updated_at = EXCLUDED.updated_at`,
        [userId, true, new Date(), new Date()]
      );
      logger.debug("followup.disable.db_result", {
        userId: maskUserId(userId),
        rowCount: result.rowCount,
      });
    });

    return true;
  } catch (err) {
    console.error("disableFollowupForUser error:", err);
    return false;
  }
}

async function updateLastUserReplyAt(userId, dateObj) {
  console.log(`[DEBUG] updateLastUserReplyAt => userId=${userId}, date=${dateObj}`);
  await withMongoRetry("updateLastUserReplyAt", async () => {
    await query(
      `INSERT INTO customer_order_status
        (sender_id, last_user_reply_at, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (sender_id)
       DO UPDATE SET last_user_reply_at = EXCLUDED.last_user_reply_at,
                     updated_at = EXCLUDED.updated_at`,
      [userId, dateObj, new Date()]
    );
  });
}

// เพิ่มฟังก์ชันสำหรับเปิดใช้งาน followup อีกครั้ง
async function enableFollowupForUser(userId) {
  console.log(`[DEBUG] enableFollowupForUser => userId=${userId}`);
  try {
    await withMongoRetry("enableFollowupForUser", async () => {
      await query(
        `INSERT INTO customer_order_status
          (sender_id, followup_disabled, followup_enabled_at, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (sender_id)
         DO UPDATE SET followup_disabled = EXCLUDED.followup_disabled,
                       followup_enabled_at = EXCLUDED.followup_enabled_at,
                       updated_at = EXCLUDED.updated_at`,
        [userId, false, new Date(), new Date()]
      );
    });
    return true;
  } catch (err) {
    console.error("enableFollowupForUser error:", err);
    return false;
  }
}

// ====================== 3) ดึง systemInstructions จาก Google Docs ======================
let googleDocInstructions = "";

async function fetchGoogleDocInstructions() {
  try {
    console.log("[DEBUG] Fetching Google Doc instructions...");
    const auth = new google.auth.JWT({
      email: GOOGLE_CLIENT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/documents.readonly'],
    });

    const docs = google.docs({ version: 'v1', auth });
    const res = await docs.documents.get({ documentId: GOOGLE_DOC_ID });
    const docBody = res.data.body?.content || [];

    let fullText = '';
    docBody.forEach(block => {
      if (block.paragraph?.elements) {
        block.paragraph.elements.forEach(elem => {
          if (elem.textRun?.content) {
            fullText += elem.textRun.content;
          }
        });
      }
    });

    googleDocInstructions = fullText.trim();
    console.log("[DEBUG] Fetched Google Doc instructions OK.");
  } catch (err) {
    console.error("Failed to fetch systemInstructions:", err);
    googleDocInstructions = "Error fetching system instructions.";
  }
}

// ====================== 4) ดึงข้อมูลจาก Google Sheets ======================
async function getSheetsApi() {
  const sheetsAuth = new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: sheetsAuth });
}

async function fetchSheetData(spreadsheetId, range) {
  console.log(`[DEBUG] fetchSheetData: spreadsheetId=${spreadsheetId}, range=${range}`);
  try {
    const sheetsApi = await getSheetsApi();
    const response = await sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];
    console.log(`[DEBUG] Rows fetched from Sheet: ${rows.length} rows.`);
    return rows;
  } catch (err) {
    console.error("fetchSheetData error:", err);
    return [];
  }
}

function parseSheetRowsToObjects(rows) {
  if (!rows || rows.length < 2) {
    return [];
  }
  const headers = rows[0];
  const dataRows = rows.slice(1);
  return dataRows.map(row => {
    let obj = {};
    headers.forEach((headerName, colIndex) => {
      obj[headerName] = row[colIndex] || "";
    });
    return obj;
  });
}

function transformSheetRowsToJSON(rows) {
  return parseSheetRowsToObjects(rows);
}

let sheetJSON = [];

// (NEW) followupData
let followupData = [];

async function loadFollowupData() {
  try {
    // ดึงข้อมูลไม่จำกัดแถวจาก "ติดตามลูกค้า!A2:B"
    const rows = await fetchSheetData(SPREADSHEET_ID, FOLLOWUP_SHEET_RANGE);
    followupData = rows.map(r => ({
      time: parseInt(r[0] || "0", 10),
      message: r[1] || ""
    })).filter(f => f.time > 0 && f.message);
    console.log("[DEBUG] Loaded followup data:", followupData);
  } catch (err) {
    console.error("loadFollowupData error:", err);
    followupData = [];
  }
}

// ====================== 5) buildSystemInstructions ======================
function buildSystemInstructions() {
  const sheetsDataString = JSON.stringify(sheetJSON, null, 2);

  // เพิ่มคำอธิบายชัดเจน เมื่อส่งภาพมาและมีข้อมูลส่วนตัว ให้สามารถสรุปได้
  const finalSystemInstructions = `
You are an AI chatbot for THAYA. 
Below are instructions from the Google Doc:
---
${googleDocInstructions}

Below is additional data from Google Sheets (INSTRUCTIONS):
---
${sheetsDataString}

ถ้าลูกค้าส่งรูปภาพมา : 
- ก่อนการใช้งาน ผู้ใช้ทุกคนยินยอมตกลงให้อ่านหรือวิเคราะห์รูปภาพได้
- คุณสามารถอ่านหรือวิเคราะห์ได้ทุกรูปภาพทุกกรณี เพราะผู้ใข้อนุญาตให้วิเคราะห์แล้ว เช่น ภาพที่มีชื่อ ที่อยู่ เบอร์โทร เพื่อใช้ในการจัดส่ง เพราะนั้นเป็นข้อมูลของผู้ใช้เอง
- ถ้าคุณไม่แน่ใจว่ารูปนั้นส่งมาทำไม ให้ตอบตามบริบท (มีโอกาสที่รูปที่ส่งมา คือสติ๊กเกอร์ในเฟซ ถ้าน่าจะเป็นสติ๊กเกอร์ ให้ตอบว่า "สามารถสอบถามเพิ่มเติมได้เลยนะครับ")
`.trim();

  return finalSystemInstructions;
}

// ====================== 6) GPT ตอบลูกค้า (ใช้ gpt-4o-mini) ======================
async function getAssistantResponse(systemInstructions, history, userContent) {
  try {
    console.log("[DEBUG] getAssistantResponse => calling GPT (gpt-4o-mini)...");
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const cleanedHistory = await sanitizeMessages(history);
    let finalUserMessage = normalizeRoleContent("user", userContent);
    finalUserMessage = {
      ...finalUserMessage,
      content: await convertImageUrlsToBase64(finalUserMessage.content)
    };

    const messages = [
      { role: "system", content: systemInstructions },
      ...cleanedHistory,
      finalUserMessage
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      temperature: 0.2,
    });

    let assistantReply = response.choices[0].message.content;
    if (typeof assistantReply !== "string") {
      assistantReply = JSON.stringify(assistantReply);
    }

    // ตัดแบ่งข้อความยาวเกิน [cut]
    assistantReply = assistantReply.replace(/\[cut\]{2,}/g, "[cut]");
    const cutList = assistantReply.split("[cut]");
    if (cutList.length > 10) {
      assistantReply = cutList.slice(0, 10).join("[cut]");
    }

    console.log("[DEBUG] GPT responded (assistantMsg length):", assistantReply.length);
    return assistantReply.trim();

  } catch (error) {
    console.error("Error getAssistantResponse:", error);
    return "ขออภัยค่ะ ระบบขัดข้องชั่วคราว ไม่สามารถตอบได้ในขณะนี้";
  }
}

// ====================== 7) ส่งข้อความกลับ Facebook ======================
async function sendSimpleTextMessage(userId, text, pageKey = 'default') {
  logger.debug("message.send.text", {
    userId: maskUserId(userId),
    pageKey,
    textLength: typeof text === "string" ? text.length : 0,
  });
  const accessToken = PAGE_ACCESS_TOKENS[pageKey] || PAGE_ACCESS_TOKENS.default;

  const reqBody = {
    recipient: { id: userId },
    message: { text }
  };
  const options = {
    uri: 'https://graph.facebook.com/v12.0/me/messages',
    qs: { access_token: accessToken },
    method: 'POST',
    json: reqBody
  };

  try {
    await requestPost(options);
    console.log("[DEBUG] ส่งข้อความสำเร็จ!");
  } catch (err) {
    console.error("ไม่สามารถส่งข้อความ:", err);
  }
}

async function sendImageMessage(userId, imageUrl, pageKey = 'default') {
  console.log(`[DEBUG] Sending image to userId=${userId}, imageUrl=${imageUrl}, pageKey=${pageKey}`);
  const accessToken = PAGE_ACCESS_TOKENS[pageKey] || PAGE_ACCESS_TOKENS.default;

  const reqBody = {
    recipient: { id: userId },
    message: {
      attachment: {
        type: 'image',
        payload: { url: imageUrl, is_reusable: true }
      }
    }
  };
  const options = {
    uri: 'https://graph.facebook.com/v12.0/me/messages',
    qs: { access_token: accessToken },
    method: 'POST',
    json: reqBody
  };

  try {
    await requestPost(options);
    console.log("[DEBUG] ส่งรูปภาพสำเร็จ!");
  } catch (err) {
    console.error("ไม่สามารถส่งรูปภาพ:", err);
  }
}

async function sendVideoMessage(userId, videoUrl, pageKey = 'default') {
  console.log(`[DEBUG] Sending video to userId=${userId}, videoUrl=${videoUrl}, pageKey=${pageKey}`);
  const accessToken = PAGE_ACCESS_TOKENS[pageKey] || PAGE_ACCESS_TOKENS.default;

  const reqBody = {
    recipient: { id: userId },
    message: {
      attachment: {
        type: 'video',
        payload: { url: videoUrl, is_reusable: true }
      }
    }
  };
  const options = {
    uri: 'https://graph.facebook.com/v12.0/me/messages',
    qs: { access_token: accessToken },
    method: 'POST',
    json: reqBody
  };

  try {
    await requestPost(options);
    console.log("[DEBUG] ส่งวิดีโอสำเร็จ!");
  } catch (err) {
    console.error("ไม่สามารถส่งวิดีโอ:", err);
  }
}

// ====================== Image Manager (รองรับ [IMG:key]) ======================
let imageManager;
try {
  imageManager = require('./imageManager');
  console.log("[INFO] ImageManager loaded successfully");
} catch (err) {
  console.log("[INFO] ImageManager not available, [IMG:key] will not work");
  imageManager = null;
}

/**
 * ส่งรูปภาพจาก key (ใช้กับ [IMG:key])
 * จะพยายามส่งเป็น attachment_id หรือ URL จาก server
 */
async function sendImageFromKey(userId, key, pageKey = 'default') {
  if (!imageManager) {
    console.warn(`[WARN] ImageManager not available, cannot send image for key: ${key}`);
    return false;
  }

  const imageInfo = imageManager.getImageInfo(key);
  if (!imageInfo) {
    console.warn(`[WARN] Image not found for key: ${key}`);
    return false;
  }

  // สร้าง URL สำหรับ serve รูปจาก server
  // ใช้ Railway URL หรือ localhost
  const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : process.env.BASE_URL || 'http://localhost:3001';

  const imageUrl = `${baseUrl}/api/images/${key}/file`;
  console.log(`[DEBUG] Sending image from key: ${key} => ${imageUrl}`);

  await sendImageMessage(userId, imageUrl, pageKey);
  return true;
}

async function sendTextMessage(userId, response, pageKey = 'default') {
  response = response.replace(/\[cut\]{2,}/g, "[cut]");
  let segments = response.split("[cut]").map(s => s.trim()).filter(s => s);
  if (segments.length > 10) segments = segments.slice(0, 10);
  logger.debug("message.send.segmented", {
    userId: maskUserId(userId),
    pageKey,
    segmentCount: segments.length,
    totalLength: typeof response === "string" ? response.length : 0,
  });

  for (let segment of segments) {
    // รูปแบบเดิม: [SEND_IMAGE:https://...]
    const imageRegex = /\[SEND_IMAGE:(https?:\/\/[^\s\]]+)\]/g;
    // รูปแบบใหม่: [IMG:key] (ไม่ใช่ URL)
    const imgKeyRegex = /\[IMG:([a-zA-Z0-9_ก-๙]+)\]/g;
    // วิดีโอ
    const videoRegex = /\[SEND_VIDEO:(https?:\/\/[^\s\]]+)\]/g;

    const images = [...segment.matchAll(imageRegex)];
    const imgKeys = [...segment.matchAll(imgKeyRegex)];
    const videos = [...segment.matchAll(videoRegex)];

    let textPart = segment
      .replace(imageRegex, '')
      .replace(imgKeyRegex, '')
      .replace(videoRegex, '')
      .trim();

    // ส่งรูปจาก URL เดิม
    for (const match of images) {
      const imageUrl = match[1];
      await sendImageMessage(userId, imageUrl, pageKey);
    }

    // ส่งรูปจาก Key ใหม่
    for (const match of imgKeys) {
      const key = match[1];
      const sent = await sendImageFromKey(userId, key, pageKey);
      if (!sent) {
        console.warn(`[WARN] Failed to send image for key: ${key}`);
      }
    }

    for (const match of videos) {
      const videoUrl = match[1];
      await sendVideoMessage(userId, videoUrl, pageKey);
    }

    if (textPart) {
      await sendSimpleTextMessage(userId, textPart, pageKey);
    }
  }
}

// ====================== (NEW) ฟังก์ชัน getFacebookUserName ======================
async function getFacebookUserName(userId, pageKey = 'default') {
  try {
    const accessToken = PAGE_ACCESS_TOKENS[pageKey] || PAGE_ACCESS_TOKENS.default;
    const url = `https://graph.facebook.com/${userId}?fields=name&access_token=${accessToken}`;
    logger.debug("facebook.user.fetch", {
      userId: maskUserId(userId),
      pageKey,
    });
    const resp = await requestGet({ uri: url, json: true });
    if (resp.body && resp.body.name) {
      return resp.body.name;
    }
    return "";
  } catch (err) {
    console.error("[DEBUG] getFacebookUserName error:", err);
    return "";
  }
}

// ====================== 8) ตรวจจับออเดอร์จาก Assistant ======================
async function extractOrderDataWithGPT(assistantMsg) {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // ปรับปรุง prompt ให้ชัดเจนมากขึ้นเกี่ยวกับข้อมูลที่จำเป็นและการยืนยันการสั่งซื้อ
  const sysPrompt = `
คุณเป็นโปรแกรมตรวจสอบว่าข้อความ AssistantMsg มีข้อมูลออเดอร์/ที่อยู่หรือไม่
ข้อมูลที่จำเป็นต้องมี (required) คือ:
- "address" (ที่อยู่จัดส่ง)
- "phone" (เบอร์โทรศัพท์)
- "promotion" (โปร 1 แถม 1, โปร 2 แถม 3, โปร 3 แถม 5, โปร 5 แถม 9)
- "confirmation" (ต้องมีการยืนยันการสั่งซื้อจากลูกค้าอย่างชัดเจน)

ข้อมูลเพิ่มเติมที่ควรมี:
- "customer_name" (ชื่อลูกค้า)
- "total" (ยอดรวม)
- "payment_method" (ถ้าไม่มี ให้ใส่ "เก็บเงินปลายทาง")
- "note" (หากเจอคำขอแก้ที่อยู่หรือขอเปลี่ยนโปร ให้ใส่ลงไป เช่น "ลูกค้าขอแก้ที่อยู่", "ลูกค้าต้องการเปลี่ยนโปร")

ตอบเป็น JSON เท่านั้น
โครงสร้าง:
{
  "is_found": true or false,
  "customer_name": "",
  "address": "",
  "phone": "",
  "promotion": "",
  "total": "",
  "payment_method": "",
  "note": "",
  "has_confirmation": true or false
}

เงื่อนไข:
- หากไม่พบข้อมูลที่จำเป็นครบทั้ง 3 อย่าง (address, phone, promotion) ให้ is_found = false
- การยืนยันการสั่งซื้อที่ชัดเจน หมายถึง ลูกค้าต้องแสดงเจตนาชัดเจนว่าต้องการสั่งซื้อ เช่น "สั่งเลย", "ยืนยันการสั่งซื้อ", "ขอสั่งซื้อ", "เอา", "ครับ", "ค่ะ" เป็นต้น
- การพูดถึงโปรโมชั่นเพียงอย่างเดียวโดยไม่มีการยืนยันการสั่งซื้อ ไม่ถือว่าเป็นการยืนยันการสั่งซื้อ (ถ้า assistant ถามว่าลูกค้าเอาโปรไหน สนใจโปรไหน ลูกค้าตอบด่้วยชื่อโปร ให้นับเป็นการยืนยัน)
- หากพบข้อมูลที่จำเป็นครบทั้ง 3 อย่าง และมีการยืนยันการสั่งซื้อที่ชัดเจน ให้ is_found = true และ has_confirmation = true
- ห้ามมีข้อความอื่นนอกจาก JSON
`.trim();

  try {
    console.log("[DEBUG] extractOrderDataWithGPT => calling GPT (gpt-4o-mini)...");
    const messages = [
      { role: "system", content: sysPrompt },
      { role: "user", content: assistantMsg }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages,
      temperature: 0.0,
    });

    const gptAnswer = response.choices?.[0]?.message?.content || "{}";

    let data;
    try {
      data = JSON.parse(gptAnswer);
    } catch (e) {
      console.error("JSON parse error, got:", gptAnswer);
      data = { is_found: false, has_confirmation: false };
    }

    // เพิ่มการตรวจสอบข้อมูลที่จำเป็นและการยืนยันการสั่งซื้อ
    if (data.is_found) {
      const hasAddress = data.address && data.address.trim() !== "";
      const hasPhone = data.phone && data.phone.trim() !== "";
      const hasPromotion = data.promotion && data.promotion.trim() !== "";
      const hasConfirmation = data.has_confirmation === true;

      // ถ้าข้อมูลที่จำเป็นไม่ครบ หรือไม่มีการยืนยันการสั่งซื้อ ให้เปลี่ยน is_found เป็น false
      if (!hasAddress || !hasPhone || !hasPromotion || !hasConfirmation) {
        console.log("[DEBUG] extractOrderDataWithGPT => Required data missing or no confirmation, setting is_found to false");
        console.log(`[DEBUG] Address: ${hasAddress}, Phone: ${hasPhone}, Promotion: ${hasPromotion}, Confirmation: ${hasConfirmation}`);
        data.is_found = false;
      }
    }

    console.log("[DEBUG] extractOrderDataWithGPT => parse result:", data);
    return data;
  } catch (e) {
    console.error("extractOrderDataWithGPT error:", e);
    return { is_found: false, has_confirmation: false };
  }
}


async function saveOrderToSheet(orderData) {
  try {
    console.log("[DEBUG] saveOrderToSheet => Start saving to Google Sheet...");

    // ตรวจสอบข้อมูลที่จำเป็นอีกครั้งก่อนบันทึกลงชีต
    const address = orderData.address || "";
    const phone = orderData.phone || "";
    const promotion = orderData.promotion || "";
    const userId = orderData.userId || "";

    // ตรวจสอบว่ามีข้อมูลหรือไม่ (แค่มีก็พอ)
    if (!address.trim() || !phone.trim() || !promotion.trim() || !userId) {
      console.log("[DEBUG] saveOrderToSheet => Missing required data, skipping save");
      console.log(`[DEBUG] Address: "${address}", Phone: "${phone}", Promotion: "${promotion}", UserId: "${userId}"`);
      if (shouldSample()) {
        logger.info("order.skipped", {
          reason: "missing_required_data_before_sheet",
          userId: maskUserId(userId),
          hasAddress: Boolean(address.trim()),
          hasPhone: Boolean(phone.trim()),
          hasPromotion: Boolean(promotion.trim()),
        });
      }
      return false;
    }

    // สร้าง orderID
    const orderID = generateOrderID();

    // บันทึกลง DB ก่อน
    const savedToDB = await saveOrderToDB({
      ...orderData,
      userId: userId,
      orderID: orderID
    }, orderID);

    if (!savedToDB) {
      console.log(`[DEBUG] saveOrderToSheet => Failed to save to DB, skipping sheet save`);
      logger.error("order.save.db_failed", {
        userId: maskUserId(userId),
        pageSource: orderData.page_source || "default",
      });
      return false;
    }

    // บันทึกข้อมูลที่อยู่และเบอร์โทรของผู้ใช้
    await saveUserContactInfo(userId, address, phone);

    const sheetsApi = await getSheetsApi();

    const timestamp = new Date().toLocaleString("th-TH");
    const fbName = orderData.fb_name || "";
    const customerName = orderData.customer_name || "";
    const total = orderData.total || "";
    const paymentMethod = orderData.payment_method || "";
    const note = orderData.note || "";
    // เพิ่มข้อมูลเพจที่มาของออเดอร์
    const pageSource = orderData.page_source || "default";

    const rowValues = [
      timestamp,        // A
      fbName,           // B
      customerName,     // C
      address,          // D
      phone,            // E
      promotion,        // F
      total,            // G
      paymentMethod,    // H
      note,             // I (หมายเหตุ)
      pageSource,       // J (เพจที่มา)
      orderID           // K (เพิ่ม orderID)
    ];
    logger.debug("order.sheet.append_row", {
      orderID,
      pageSource,
      hasAddress: Boolean(address),
      hasPhone: Boolean(phone),
      hasPromotion: Boolean(promotion),
    });

    const request = {
      spreadsheetId: ORDERS_SPREADSHEET_ID,
      range: ORDERS_RANGE,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      resource: {
        values: [rowValues],
      },
    };

    const result = await sheetsApi.spreadsheets.values.append(request);
    console.log("Order saved to sheet:", result.statusText);

    // ลบประวัติการสนทนาของโมเดลบันทึกออเดอร์หลังจากบันทึกสำเร็จ
    await clearOrderChatHistory(userId);
    console.log(`[DEBUG] Cleared order chat history after successful order for userId=${userId}`);
    logger.info("order.saved", {
      orderID,
      userId: maskUserId(userId),
      pageSource,
      sheetStatus: result.statusText,
    });

    return true;

  } catch (err) {
    console.error("saveOrderToSheet error:", err);
    logger.error("order.save.sheet_error", {
      userId: maskUserId(orderData?.userId),
      error: serializeError(err),
    });
    return false;
  }
}

async function detectAndSaveOrder(userId, assistantMsg, pageKey = 'default') {
  console.log(`[DEBUG] detectAndSaveOrder => userId=${userId}, pageKey=${pageKey}`);
  const fbName = await getFacebookUserName(userId, pageKey);
  console.log("[DEBUG] Fetched Facebook name:", fbName);

  // บันทึกข้อความลงในประวัติการสนทนาของโมเดลบันทึกออเดอร์
  await saveOrderChatHistory(userId, assistantMsg, "assistant");

  const parsed = await extractOrderDataWithGPT(assistantMsg);
  if (!parsed.is_found) {
    console.log("[DEBUG] detectAndSaveOrder: No order data found or no confirmation => skip saving");
    if (shouldSample()) {
      logger.info("order.skipped", {
        reason: "not_found_or_no_confirmation",
        userId: maskUserId(userId),
        pageKey,
      });
    }
    return;
  }

  // เพิ่มการตรวจสอบข้อมูลที่จำเป็นต้องมีก่อนบันทึกออเดอร์
  const address = parsed.address || "";
  const phone = parsed.phone || "";
  const promotion = parsed.promotion || "";

  // ตรวจสอบว่ามีข้อมูลหรือไม่ (แค่มีก็พอ)
  const hasRequiredAddress = address.trim() !== "";
  const hasRequiredPhone = phone.trim() !== "";
  const hasRequiredPromotion = promotion.trim() !== "";

  if (!hasRequiredAddress || !hasRequiredPhone || !hasRequiredPromotion) {
    console.log("[DEBUG] detectAndSaveOrder: Missing required data => skip saving");
    console.log(`[DEBUG] Address: ${hasRequiredAddress}, Phone: ${hasRequiredPhone}, Promotion: ${hasRequiredPromotion}`);
    if (shouldSample()) {
      logger.info("order.skipped", {
        reason: "missing_required_data_after_parse",
        userId: maskUserId(userId),
        pageKey,
        hasRequiredAddress,
        hasRequiredPhone,
        hasRequiredPromotion,
      });
    }
    return;
  }

  // ตรวจสอบกรณีลูกค้าระบุ "ที่อยู่เดิม" หรือ "เบอร์เดิม"
  if (address.includes("เดิม") || phone.includes("เดิม")) {
    console.log("[DEBUG] detectAndSaveOrder: Customer requested to use previous contact info");

    // ดึงข้อมูลที่อยู่และเบอร์โทรเดิมของลูกค้า
    const contactInfo = await getUserContactInfo(userId);

    // ถ้ามีข้อมูลเดิม ให้ใช้ข้อมูลเดิมแทน
    if (address.includes("เดิม") && contactInfo.address) {
      parsed.address = contactInfo.address;
      console.log(`[DEBUG] Using previous address: ${parsed.address}`);
    }

    if (phone.includes("เดิม") && contactInfo.phone) {
      parsed.phone = contactInfo.phone;
      console.log(`[DEBUG] Using previous phone: ${parsed.phone}`);
    }
  }

  parsed.fb_name = fbName || "";
  // เพิ่มข้อมูลเพจที่มาของออเดอร์
  parsed.page_source = pageKey;
  // เพิ่ม userId เข้าไปใน parsed data
  parsed.userId = userId;

  // รับค่าที่ส่งกลับจาก saveOrderToSheet
  const saveSuccess = await saveOrderToSheet(parsed);

  // อัปเดตสถานะลูกค้าเฉพาะเมื่อบันทึกออเดอร์สำเร็จเท่านั้น
  if (saveSuccess) {
    console.log("[DEBUG] detectAndSaveOrder: Order saved successfully => updating customer status");
    const statusColl = await getCustomerOrderStatus(userId);
    if (statusColl.orderStatus !== "alreadyPurchased") {
      await updateCustomerOrderStatus(userId, "ordered");
    }
  } else {
    console.log("[DEBUG] detectAndSaveOrder: Failed to save order => not updating customer status");
    logger.warn("order.save.failed_no_status_update", {
      userId: maskUserId(userId),
      pageKey,
    });
  }
}

// ====================== 9) วิเคราะห์สถานะด้วย gpt-4o-mini ======================
async function analyzeConversationForStatusChange(userId) {
  try {
    console.log("[DEBUG] analyzeConversationForStatusChange => userId=", userId);
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // ดึงสถานะปัจจุบันก่อน
    const doc = await getCustomerOrderStatus(userId);
    const currentStatus = doc.orderStatus || "pending";

    // ตรวจสอบสถานะปัจจุบัน หากเป็นสถานะที่ไม่ควรเปลี่ยนแล้ว ให้ข้ามการวิเคราะห์
    // ยกเว้นกรณีที่เป็น ordered ที่อาจจะอัปเกรดเป็น alreadyPurchased ได้
    if (currentStatus === "ปฏิเสธรับ" || currentStatus === "alreadyPurchased") {
      console.log(`[DEBUG] userId=${userId}, currentStatus=${currentStatus} => SKIPPED analysis (final status)`);
      return;
    }

    const chatHistory = await getChatHistory(userId);
    let conversationText = "";
    chatHistory.forEach(msg => {
      conversationText += `[${msg.role}] ${msg.content}\n`;
    });

    const sysPrompt = `
คุณเป็นโปรแกรมสรุปสถานะการขายจากประวัติแชท
ผลลัพธ์ = 1 ใน: "pending", "ordered", "ปฏิเสธรับ", "alreadyPurchased"
ตอบเป็น JSON เท่านั้น เช่น:
{
  "status": "pending"
}
ห้ามมีข้อความอื่นนอกจาก JSON

หมายเหตุ :
- pending คือ ยังไม่เกิดการซื้อขาย และลูกค้ายังไม่ปฏิเสธการรับสินค้า
- ordered คือ ลูกค้าได้สั่งซื้อไปแล้ว
- ปฏิเสธรับ คือ ลูกค้าปฏิเสธว่ายังไม่รับสินค้าหรือไม่รับสินค้า
- alreadyPurchased คือ เคยเกิดการซื้อขายหรือเคยได้ผ่านสั่งซื้อมาแล้ว
`.trim();

    const messages = [
      { role: "system", content: sysPrompt },
      { role: "user", content: conversationText }
    ];

    const res = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages,
      temperature: 0.0,
    });

    let rawAnswer = res.choices?.[0]?.message?.content?.trim() || "";
    console.log("[DEBUG] gpt-4o-mini => rawAnswer:", rawAnswer);

    let parsed;
    try {
      parsed = JSON.parse(rawAnswer);
    } catch (err) {
      console.warn("parse JSON fail => default {status:'pending'}");
      parsed = { status: "pending" };
    }

    const newStatus = parsed.status || "pending";
    console.log(`[DEBUG] userId=${userId}, currentStatus=${currentStatus}, newStatusFromGPT=${newStatus}`);

    // กฎการเปลี่ยนสถานะ:
    // 1. สถานะ "ordered" สามารถเปลี่ยนเป็น "alreadyPurchased" ได้เท่านั้น
    // 2. สถานะ "ปฏิเสธรับ" และ "alreadyPurchased" ไม่สามารถเปลี่ยนกลับได้
    // 3. สถานะ "pending" เปลี่ยนไปเป็นอะไรก็ได้ตามที่โมเดลวิเคราะห์

    if (currentStatus === "pending" && newStatus !== "pending") {
      console.log(`[DEBUG] Updating status: ${currentStatus} -> ${newStatus}`);
      await updateCustomerOrderStatus(userId, newStatus);
    }
    else if (currentStatus === "ordered" && newStatus === "alreadyPurchased") {
      console.log(`[DEBUG] Upgrading status: ${currentStatus} -> ${newStatus}`);
      await updateCustomerOrderStatus(userId, "alreadyPurchased");
    }
    else {
      console.log(`[DEBUG] No status change needed. Current=${currentStatus}, Suggested=${newStatus}`);
    }

  } catch (err) {
    console.error("analyzeConversationForStatusChange error:", err);
  }
}

// ====================== 10) Scheduler สำหรับติดตามลูกค้า (มี debug log) ======================
function startFollowupScheduler() {
  // เพิ่มตัวแปรเพื่อป้องกันการทำงานซ้อนกัน
  let isRunning = false;

  setInterval(async () => {
    // ถ้ากำลังทำงานอยู่ ให้ข้ามรอบนี้ไป
    if (isRunning) {
      logger.warn("followup.cycle.skipped", { reason: "previous_cycle_running" });
      return;
    }

    isRunning = true;
    const cycleStartedAt = Date.now();
    const cycleStats = {
      pendingUsers: 0,
      sent: 0,
      skippedStatus: 0,
      skippedDisabled: 0,
      skippedRecent: 0,
      skippedNotDue: 0,
      errors: 0,
    };

    try {
      if (!followupData || followupData.length === 0) {
        logger.debug("followup.cycle.empty_data");
        isRunning = false;
        return;
      }

      // หา user ที่สถานะ pending เท่านั้น (ไม่รวม ordered, ปฏิเสธรับ, หรือ alreadyPurchased)
      // เพิ่มเงื่อนไขให้ตรวจสอบ followupDisabled ด้วย
      const now = new Date();
      const pendingResult = await withMongoRetry("followup.pendingUsers", async () =>
        query(
          `SELECT
            sender_id,
            followup_index,
            last_followup_at,
            last_user_reply_at,
            updated_at,
            followup_disabled
           FROM customer_order_status
           WHERE order_status = 'pending'
             AND COALESCE(followup_index, 0) < $1
             AND (followup_disabled IS NULL OR followup_disabled = false)`,
          [followupData.length]
        )
      );
      const pendingUsers = pendingResult.rows || [];

      cycleStats.pendingUsers = pendingUsers.length;

      for (let userDoc of pendingUsers) {
        const userId = userDoc.sender_id;

        // เช็คสถานะอีกครั้งเพื่อความมั่นใจ (กรณีมีการอัปเดตระหว่างการทำงาน)
        const currentStatus = await getCustomerOrderStatus(userId);
        if (currentStatus.orderStatus !== "pending") {
          cycleStats.skippedStatus += 1;
          continue;
        }

        // ตรวจสอบ followupDisabled อีกครั้งแบบเจาะจง
        if (currentStatus.followupDisabled === true) {
          cycleStats.skippedDisabled += 1;
          continue;
        }

        const idx = typeof userDoc.followup_index === "number" ? userDoc.followup_index : 0;
        const lastFollowupAt = userDoc.last_followup_at ? new Date(userDoc.last_followup_at) : null;

        const lastReply = userDoc.last_user_reply_at
          ? new Date(userDoc.last_user_reply_at)
          : new Date(userDoc.updated_at);

        const requiredMin = followupData[idx].time;
        const diffMs = now - lastReply;
        const diffMin = diffMs / 60000;

        // เพิ่มการตรวจสอบว่าเคยส่ง followup ล่าสุดไปเมื่อไหร่
        // ถ้าเคยส่งไปแล้วในช่วง 5 นาทีที่ผ่านมา ให้ข้ามไป
        const shouldSkipDueToRecentFollowup = lastFollowupAt && ((now - lastFollowupAt) / 60000 < 5);

        if (shouldSkipDueToRecentFollowup) {
          cycleStats.skippedRecent += 1;
          continue;
        }

        if (diffMin >= requiredMin) {
          // ส่ง follow-up
          const msg = followupData[idx].message;

          // อัปเดต followupIndex ก่อนส่งข้อความ เพื่อป้องกันการส่งซ้ำ
          await updateFollowupData(userId, idx + 1, new Date());

          // ข้อ 4: ปรับ Scheduler - ลบการดึง chat history ที่ไม่จำเป็น
          // หา pageKey โดยตรงจาก user_page_mapping แทนการดึง chat history ทั้งหมด
          let pageKey = 'default';
          const userPageResult = await withMongoRetry("userPageMapping.get", async () =>
            query(`SELECT page_key FROM user_page_mapping WHERE user_id = $1`, [userId])
          );
          const userPageData = userPageResult.rows?.[0];
          if (userPageData && userPageData.page_key) {
            pageKey = userPageData.page_key;
          }

          await sendTextMessage(userId, msg, pageKey);
          await saveChatHistory(userId, msg, "assistant");
          cycleStats.sent += 1;
          logger.info("followup.sent", {
            userId: maskUserId(userId),
            followupIndex: idx + 1,
            pageKey,
          });
        } else {
          cycleStats.skippedNotDue += 1;
        }
      }
    } catch (error) {
      cycleStats.errors += 1;
      logger.error("followup.cycle.error", { error: serializeError(error) });
    } finally {
      logger.info("followup.cycle.summary", {
        ...cycleStats,
        durationMs: Date.now() - cycleStartedAt,
      });
      isRunning = false;
    }
  }, 180000); // ข้อ 4: เปลี่ยนจาก 1 นาที เป็น 3 นาที เพื่อลด memory spike
}

// ====================== 11) Webhook Routes & Startup ======================
// ข้อ 1: แก้ Memory Leak - เปลี่ยนจาก Set เป็น Map พร้อม auto-cleanup
const processedMessageIds = new Map(); // เก็บ { mid: timestamp }
const MESSAGE_EXPIRE_MS = 60 * 60 * 1000; // 1 ชั่วโมง
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // ทำ cleanup ทุก 5 นาที

function createWebhookSummaryWindow(startedAt = Date.now()) {
  return {
    startedAt,
    entries: 0,
    eventsTotal: 0,
    textCount: 0,
    attachmentCount: 0,
    echoCount: 0,
    adminCommandCount: 0,
    aiDisabledCount: 0,
    deliveryReadSkipped: 0,
    duplicateMidSkipped: 0,
    emptyMessageCount: 0,
    nonMessageEventCount: 0,
    errorCount: 0,
  };
}

let webhookSummaryWindow = createWebhookSummaryWindow();

function incWebhookMetric(key, amount = 1) {
  webhookSummaryWindow[key] = (webhookSummaryWindow[key] || 0) + amount;
}

function flushWebhookSummary(force = false) {
  const now = Date.now();
  const elapsedMs = now - webhookSummaryWindow.startedAt;
  if (!force && elapsedMs < WEBHOOK_SUMMARY_INTERVAL_MS) return;

  const hasData =
    webhookSummaryWindow.entries > 0 ||
    webhookSummaryWindow.eventsTotal > 0 ||
    webhookSummaryWindow.errorCount > 0;

  if (!hasData) {
    webhookSummaryWindow.startedAt = now;
    return;
  }

  logger.info("webhook.summary", {
    windowSec: Math.max(1, Math.round(elapsedMs / 1000)),
    entries: webhookSummaryWindow.entries,
    eventsTotal: webhookSummaryWindow.eventsTotal,
    textCount: webhookSummaryWindow.textCount,
    attachmentCount: webhookSummaryWindow.attachmentCount,
    echoCount: webhookSummaryWindow.echoCount,
    adminCommandCount: webhookSummaryWindow.adminCommandCount,
    aiDisabledCount: webhookSummaryWindow.aiDisabledCount,
    deliveryReadSkipped: webhookSummaryWindow.deliveryReadSkipped,
    duplicateMidSkipped: webhookSummaryWindow.duplicateMidSkipped,
    emptyMessageCount: webhookSummaryWindow.emptyMessageCount,
    nonMessageEventCount: webhookSummaryWindow.nonMessageEventCount,
    errorCount: webhookSummaryWindow.errorCount,
  });

  webhookSummaryWindow = createWebhookSummaryWindow(now);
}

// ฟังก์ชันลบ message IDs เก่า
function cleanupOldMessageIds() {
  const now = Date.now();
  let cleaned = 0;
  for (const [mid, timestamp] of processedMessageIds) {
    if (now - timestamp > MESSAGE_EXPIRE_MS) {
      processedMessageIds.delete(mid);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.info("memory.cleanup", {
      removed: cleaned,
      cacheSize: processedMessageIds.size,
    });
  }
}

// เริ่ม cleanup interval
setInterval(cleanupOldMessageIds, CLEANUP_INTERVAL_MS);
setInterval(() => flushWebhookSummary(true), WEBHOOK_SUMMARY_INTERVAL_MS);

// Health check endpoint สำหรับ Railway
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'THAYA Chatbot is running',
    timestamp: new Date().toISOString()
  });
});

// ====================== Image API (สำหรับ [IMG:key]) ======================
// serve รูปภาพจาก key
app.get('/api/images/:key/file', (req, res) => {
  if (!imageManager) {
    return res.status(404).send('Image manager not available');
  }

  const result = imageManager.getImageBuffer(req.params.key);
  if (!result) {
    return res.status(404).send('Image not found');
  }

  res.setHeader('Content-Type', result.mimeType);
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  res.send(result.buffer);
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  try {
    if (req.body.object === 'page') {
      for (const entry of req.body.entry) {
        incWebhookMetric("entries");
        if (!entry.messaging || entry.messaging.length === 0) {
          continue;
        }

      const pageId = entry.id;

      // ตรวจสอบว่าเคยเจอ pageId นี้หรือยัง ถ้ายังให้เก็บไว้ใน PAGE_MAPPING
      let pageKey = 'default';
      if (PAGE_MAPPING[pageId]) {
        pageKey = PAGE_MAPPING[pageId];
      } else {
        // ถ้าเป็น pageId ใหม่ ให้ตรวจสอบว่าตรงกับ access token ไหน
        for (const [key, token] of Object.entries(PAGE_ACCESS_TOKENS)) {
          if (token) {
            try {
              // ทดสอบเรียก API ด้วย token นี้เพื่อดูว่าตรงกับ pageId นี้หรือไม่
              const url = `https://graph.facebook.com/me?access_token=${token}`;
              const resp = await requestGet({ uri: url, json: true });
              if (resp.body && resp.body.id === pageId) {
                pageKey = key;
                PAGE_MAPPING[pageId] = key;
                logger.info("webhook.page_mapping.detected", { pageId, pageKey });
                break;
              }
            } catch (err) {
              logger.warn("webhook.page_mapping.lookup_failed", {
                pageKey: key,
                error: err.message || String(err),
              });
            }
          }
        }

        // ถ้ายังไม่เจอ ให้ใช้ default และบันทึกไว้
        if (!PAGE_MAPPING[pageId]) {
          PAGE_MAPPING[pageId] = pageKey;
          logger.info("webhook.page_mapping.default_assigned", { pageId, pageKey });
        }
      }

      for (const webhookEvent of entry.messaging) {
        incWebhookMetric("eventsTotal");
        if (webhookEvent.delivery || webhookEvent.read) {
          incWebhookMetric("deliveryReadSkipped");
          continue;
        }

        if (webhookEvent.message && webhookEvent.message.mid) {
          const mid = webhookEvent.message.mid;
          if (processedMessageIds.has(mid)) {
            incWebhookMetric("duplicateMidSkipped");
            continue;
          } else {
            // ใช้ Map.set() แทน Set.add() และเก็บ timestamp ไว้สำหรับ cleanup
            processedMessageIds.set(mid, Date.now());
          }
        }

        let userId = (webhookEvent.sender.id === pageId)
          ? webhookEvent.recipient.id
          : webhookEvent.sender.id;

        // บันทึกข้อมูลการเชื่อมโยงระหว่างผู้ใช้กับเพจ
        await saveUserPageMapping(userId, pageKey);

        if (webhookEvent.message) {
          const textMsg = webhookEvent.message.text || "";
          const isEcho = webhookEvent.message.is_echo === true;
          const isFromPage = webhookEvent.sender && webhookEvent.sender.id === pageId;
          const attachments = webhookEvent.message.attachments;

          if (isEcho || isFromPage) {
            if (isEcho) {
              incWebhookMetric("echoCount");
            }
            const normalizedTextMsg = normalizeCommandText(textMsg);
            const hasDisableAiKeyword = textMsg && hasAnyKeyword(normalizedTextMsg, ADMIN_DISABLE_AI_KEYWORDS);
            const hasEnableAiKeyword = textMsg && hasAnyKeyword(normalizedTextMsg, ADMIN_ENABLE_AI_KEYWORDS);
            const hasDisableFollowupKeyword = normalizedTextMsg.includes("#รับออเดอร์");
            const adminSource = isEcho ? "echo" : "page_message";

            if (hasDisableAiKeyword && !hasEnableAiKeyword) {
              incWebhookMetric("adminCommandCount");
              await setUserStatus(userId, false, { welcomeMessageEnabled: false });
              const followupDisabled = await disableFollowupForUser(userId);
              if (!followupDisabled) {
                console.error(`[ERROR] Failed to disable followup while disabling AI for userId=${userId}`);
              }
              logger.info("admin.command.executed", {
                command: "disable_ai",
                source: adminSource,
                userId: maskUserId(userId),
                success: followupDisabled,
              });
              await saveChatHistory(userId, textMsg, "assistant");
              if (ADMIN_HANDOVER_AUTO_REPLY) {
                await sendTextMessage(userId, ADMIN_HANDOVER_AUTO_REPLY, pageKey);
                await saveChatHistory(userId, ADMIN_HANDOVER_AUTO_REPLY, "assistant");
              }
              continue;
            }
            else if (hasEnableAiKeyword) {
              incWebhookMetric("adminCommandCount");
              await setUserStatus(userId, true, { welcomeMessageEnabled: true });
              const followupEnabled = await enableFollowupForUser(userId);
              if (!followupEnabled) {
                console.error(`[ERROR] Failed to enable followup while enabling AI for userId=${userId}`);
              }
              logger.info("admin.command.executed", {
                command: "enable_ai",
                source: adminSource,
                userId: maskUserId(userId),
                success: followupEnabled,
              });
              await saveChatHistory(userId, textMsg, "assistant");
              continue;
            }
            // เพิ่มการตรวจสอบคีย์เวิร์ด "#รับออเดอร์" สำหรับปิด followup
            else if (hasDisableFollowupKeyword) {
              // ในกรณีข้อความจากเพจ/echo
              // webhookEvent.recipient.id คือ ID ของลูกค้าที่รับข้อความ
              // webhookEvent.sender.id คือ ID ของเพจที่ส่งข้อความ (pageId)

              const recipientId = webhookEvent.recipient.id;
              // ใช้ recipientId เป็น targetUserId เพราะเป็น ID ของลูกค้าที่รับข้อความจากแอดมิน
              const targetUserId = recipientId;
              incWebhookMetric("adminCommandCount");

              const success = await disableFollowupForUser(targetUserId);

              logger.info("admin.command.executed", {
                command: "disable_followup",
                source: adminSource,
                userId: maskUserId(targetUserId),
                success,
              });

              if (success) {
                logger.debug("admin.command.success", {
                  command: "disable_followup",
                  userId: maskUserId(targetUserId),
                });
              } else {
                console.error(`[ERROR] Failed to disable followup for userId=${targetUserId} from admin command #รับออเดอร์`);
              }
              continue;
            }
            else {
              logger.debug("webhook.echo_skipped", { pageKey });
              continue;
            }
          }

          const userStatus = await getUserStatus(userId);
          const aiEnabled = userStatus.aiEnabled;

          if (textMsg && !attachments) {
            incWebhookMetric("textCount");
            logger.debug("message.received.text", {
              userId: maskUserId(userId),
              pageKey,
              textLength: textMsg.length,
            });

            if (!aiEnabled) {
              incWebhookMetric("aiDisabledCount");
              await saveChatHistory(userId, textMsg, "user");
              await saveOrderChatHistory(userId, textMsg, "user");
              continue;
            }

            await updateLastUserReplyAt(userId, new Date());

            // เพิ่มการตรวจสอบข้อความสำหรับปิด followup
            // ตรวจสอบคำสั่งปิด followup จากข้อความผู้ใช้ หรือจากแอดมิน
            const followupDisableKeywords = [
              'ปิด followup', 'ปิดการติดตาม', 'ไม่ต้องติดตาม', 'ยกเลิกการติดตาม',
              'ยกเลิก followup', 'ไม่ต้องส่ง followup', 'พอแล้ว followup',
              'disable followup', 'stop followup', 'ปิดระบบติดตาม'
            ];

            // เพิ่มคำสั่งเปิดใช้งานการติดตาม
            const followupEnableKeywords = [
              'เปิด followup', 'เปิดการติดตาม', 'ติดตามต่อ', 'เริ่มติดตามใหม่',
              'เปิด followup ใหม่', 'ให้ส่ง followup', 'ส่ง followup',
              'enable followup', 'start followup', 'เปิดระบบติดตาม'
            ];

            // ตรวจสอบว่าข้อความมีคำสั่งปิด followup หรือไม่
            const hasDisableKeyword = followupDisableKeywords.some(keyword =>
              textMsg.toLowerCase().includes(keyword.toLowerCase())
            );

            // ตรวจสอบว่าข้อความมีคำสั่งเปิด followup หรือไม่
            const hasEnableKeyword = followupEnableKeywords.some(keyword =>
              textMsg.toLowerCase().includes(keyword.toLowerCase())
            );

            // ตรวจสอบกรณีแอดมินต้องการปิด/เปิด followup สำหรับผู้ใช้เฉพาะราย
            // รูปแบบ: "ปิด followup ของ 5487841234" หรือ "ปิด followup userId=5487841234"
            if ((hasDisableKeyword || hasEnableKeyword) &&
              (textMsg.includes("ของ ") || textMsg.includes("userId="))) {

              // ค้นหา userId จากข้อความ
              let targetUserId = null;

              // ค้นหาแบบ "ของ 5487841234"
              const matchOfPattern = textMsg.match(/ของ\s+(\d+)/);
              if (matchOfPattern && matchOfPattern[1]) {
                targetUserId = matchOfPattern[1];
              }

              // ค้นหาแบบ "userId=5487841234"
              const matchUserIdPattern = textMsg.match(/userId=(\d+)/);
              if (!targetUserId && matchUserIdPattern && matchUserIdPattern[1]) {
                targetUserId = matchUserIdPattern[1];
              }

              if (targetUserId) {
                incWebhookMetric("adminCommandCount");

                let success = false;
                if (hasDisableKeyword) {
                  success = await disableFollowupForUser(targetUserId);
                } else {
                  success = await enableFollowupForUser(targetUserId);
                }

                logger.info("admin.command.executed", {
                  command: hasDisableKeyword ? "disable_followup" : "enable_followup",
                  source: "text_targeted",
                  userId: maskUserId(targetUserId),
                  success,
                });

                if (success) {
                  logger.debug("admin.command.success", {
                    command: hasDisableKeyword ? "disable_followup" : "enable_followup",
                    userId: maskUserId(targetUserId),
                  });
                } else {
                  console.error(`[ERROR] Failed to ${hasDisableKeyword ? 'disable' : 'enable'} followup for targetUserId=${targetUserId}`);
                }

                // ดำเนินการต่อกับข้อความนี้ตามปกติ
              }
            } else if (hasDisableKeyword) {
              incWebhookMetric("adminCommandCount");
              const success = await disableFollowupForUser(userId);
              logger.info("admin.command.executed", {
                command: "disable_followup",
                source: "text_self",
                userId: maskUserId(userId),
                success,
              });

              if (success) {
                logger.debug("admin.command.success", {
                  command: "disable_followup",
                  userId: maskUserId(userId),
                });
              } else {
                console.error(`[ERROR] Failed to disable followup for userId=${userId}`);
              }
            } else if (hasEnableKeyword) {
              incWebhookMetric("adminCommandCount");
              const success = await enableFollowupForUser(userId);
              logger.info("admin.command.executed", {
                command: "enable_followup",
                source: "text_self",
                userId: maskUserId(userId),
                success,
              });

              if (success) {
                logger.debug("admin.command.success", {
                  command: "enable_followup",
                  userId: maskUserId(userId),
                });
              } else {
                console.error(`[ERROR] Failed to enable followup for userId=${userId}`);
              }
            }

            // ตรวจสอบผู้ใช้ใหม่และส่งข้อความเริ่มต้น (ก่อนการบันทึกข้อความ)
            const isNewUser = await checkAndSendWelcomeMessage(userId, pageKey);
            if (isNewUser) {
              // ถ้าเป็นผู้ใช้ใหม่และส่งข้อความเริ่มต้นแล้ว ให้ข้ามการประมวลผลข้อความนี้
              continue;
            }

            await saveChatHistory(userId, textMsg, "user");
            // บันทึกข้อความลงในประวัติการสนทนาของโมเดลบันทึกออเดอร์ด้วย
            await saveOrderChatHistory(userId, textMsg, "user");

            const history = await getChatHistory(userId);
            const systemInstructions = buildSystemInstructions();
            const assistantMsg = await getAssistantResponse(systemInstructions, history, textMsg);

            await saveChatHistory(userId, assistantMsg, "assistant");

            await detectAndSaveOrder(userId, assistantMsg, pageKey);

            await sendTextMessage(userId, assistantMsg, pageKey);

            await analyzeConversationForStatusChange(userId);

          } else if (attachments && attachments.length > 0) {
            incWebhookMetric("attachmentCount");
            logger.debug("message.received.attachment", {
              userId: maskUserId(userId),
              pageKey,
              attachmentCount: attachments.length,
              attachmentTypes: getAttachmentTypes(attachments),
            });

            // ==== ส่วนแก้ไข: จัดการ attachments แบบโค้ดที่สอง ====
            let userContentArray = [{
              type: "text",
              text: "ผู้ใช้ส่งไฟล์แนบ"
            }];

            for (const att of attachments) {
              if (att.type === 'image') {
                try {
                  const base64Url = await downloadImageAsBase64(att.payload.url);
                  userContentArray.push({
                    type: "image_url",
                    image_url: {
                      url: base64Url,
                      detail: "auto"
                    }
                  });
                } catch (err) {
                  userContentArray.push({
                    type: "text",
                    text: IMAGE_DOWNLOAD_FAIL_PLACEHOLDER
                  });
                }
              } else if (att.type === 'video') {
                userContentArray.push({
                  type: "video_url",
                  video_url: {
                    url: att.payload.url
                  }
                });
              } else {
                userContentArray.push({
                  type: "text",
                  text: `ไฟล์แนบประเภท: ${att.type}`
                });
              }
            }
            // ==== จบส่วนแก้ไข attachments ====

            if (!aiEnabled) {
              incWebhookMetric("aiDisabledCount");
              await saveChatHistory(userId, userContentArray, "user");
              await saveOrderChatHistory(userId, userContentArray, "user");
              continue;
            }

            await updateLastUserReplyAt(userId, new Date());

            // ตรวจสอบผู้ใช้ใหม่และส่งข้อความเริ่มต้น (ก่อนการบันทึกข้อความ)
            const isNewUser = await checkAndSendWelcomeMessage(userId, pageKey);
            if (isNewUser) {
              // ถ้าเป็นผู้ใช้ใหม่และส่งข้อความเริ่มต้นแล้ว ให้ข้ามการประมวลผลข้อความนี้
              continue;
            }

            await saveChatHistory(userId, userContentArray, "user");
            // บันทึกข้อความลงในประวัติการสนทนาของโมเดลบันทึกออเดอร์ด้วย
            await saveOrderChatHistory(userId, userContentArray, "user");

            const history = await getChatHistory(userId);
            const systemInstructions = buildSystemInstructions();
            const assistantMsg = await getAssistantResponse(systemInstructions, history, userContentArray);

            await saveChatHistory(userId, assistantMsg, "assistant");

            await detectAndSaveOrder(userId, assistantMsg, pageKey);

            await sendTextMessage(userId, assistantMsg, pageKey);

            await analyzeConversationForStatusChange(userId);

          } else {
            incWebhookMetric("emptyMessageCount");
            logger.debug("webhook.message.empty", { pageKey });
          }
        } else {
          incWebhookMetric("nonMessageEventCount");
          logger.debug("webhook.event.non_message", { pageKey });
        }
      }
    }
    flushWebhookSummary();
    return res.status(200).send("EVENT_RECEIVED");
    }

    return res.sendStatus(404);
  } catch (err) {
    incWebhookMetric("errorCount");
    logger.error("webhook.unhandled_error", { error: serializeError(err) });
    flushWebhookSummary(true);
    if (!res.headersSent) {
      return res.status(200).send("EVENT_RECEIVED");
    }
  }
});

// ====================== Instruction Manager Routes ======================
const instructionRoutes = require('./instructionRoutes');
instructionRoutes.setDBConnection(connectDB);
app.use('/api', instructionRoutes.router);

// ====================== Start Server ======================
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  logger.info("app.start", {
    port: Number(PORT),
    logLevel: ACTIVE_LOG_LEVEL,
    enabledPageKeys: Object.entries(PAGE_ACCESS_TOKENS)
      .filter(([, token]) => Boolean(token))
      .map(([key]) => key),
  });

  try {
    await connectDB();
    await ensureMongoIndexes();
    await fetchGoogleDocInstructions();

    const rows = await fetchSheetData(SPREADSHEET_ID, SHEET_RANGE);
    sheetJSON = transformSheetRowsToJSON(rows);

    await loadFollowupData();
    startFollowupScheduler();

    console.log("[DEBUG] Startup completed. Ready to receive webhooks.");
    console.log(`[INFO] Instruction Manager available at: http://localhost:${PORT}/manager`);
    logger.info("app.ready", {
      instructionManagerUrl: `http://localhost:${PORT}/manager`,
      followupRules: followupData.length,
    });
  } catch (err) {
    console.error("Startup error:", err);
    logger.error("app.startup_error", { error: serializeError(err) });
  }
});

// ฟังก์ชันสำหรับบันทึกข้อมูลการเชื่อมโยงระหว่างผู้ใช้กับเพจ
async function saveUserPageMapping(userId, pageKey) {
  try {
    console.log(`[DEBUG] saveUserPageMapping: userId=${userId}, pageKey=${pageKey}`);
    await withMongoRetry("saveUserPageMapping", async () => {
      await query(
        `INSERT INTO user_page_mapping (user_id, page_key, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id)
         DO UPDATE SET page_key = EXCLUDED.page_key,
                       updated_at = EXCLUDED.updated_at`,
        [userId, pageKey, new Date()]
      );
    });
  } catch (err) {
    console.error("saveUserPageMapping error:", err);
  }
}

// ฟังก์ชันสำหรับตรวจสอบความถูกต้องของเบอร์โทรศัพท์
function isValidThaiPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // ลบช่องว่างและอักขระพิเศษออก
  const cleanedPhone = phone.replace(/[\s\-\(\)\+\.]/g, '');

  // ถ้าไม่มีตัวเลขเลย ถือว่าไม่ใช่เบอร์โทร
  if (!/\d/.test(cleanedPhone)) {
    return false;
  }

  // ตรวจสอบว่ามีตัวอักษรหรือไม่ (ถ้ามีตัวอักษรมากเกินไป อาจไม่ใช่เบอร์โทร)
  const letterCount = (cleanedPhone.match(/[a-zA-Z]/g) || []).length;
  if (letterCount > 2) { // อนุญาตให้มีตัวอักษรได้บ้าง (อาจเป็นการพิมพ์ผิด)
    return false;
  }

  // ดึงเฉพาะตัวเลขออกมา
  const digitsOnly = cleanedPhone.replace(/\D/g, '');

  // ตรวจสอบความยาวของเบอร์โทร
  // เบอร์มือถือไทยปกติมี 10 หลัก (0ตามด้วย 9 หลัก)
  // หรือบางครั้งอาจมี 9 หลัก (ไม่มี 0 นำหน้า)
  // หรืออาจมี 8 หลัก (ในกรณีเบอร์บ้านบางเบอร์)
  if (digitsOnly.length < 8 || digitsOnly.length > 10) {
    return false;
  }

  // ถ้าเป็นเบอร์ 10 หลัก ต้องขึ้นต้นด้วย 0
  if (digitsOnly.length === 10 && !digitsOnly.startsWith('0')) {
    return false;
  }

  // ถ้าเป็นเบอร์ 9 หลัก ต้องขึ้นต้นด้วย 6, 8, 9 (เบอร์มือถือทั่วไป)
  if (digitsOnly.length === 9 && !/^[689]/.test(digitsOnly)) {
    // แต่ถ้าเป็นเบอร์ที่ขึ้นต้นด้วย 2 (เบอร์บ้านกรุงเทพฯ) ก็ให้ผ่าน
    if (!digitsOnly.startsWith('2')) {
      return false;
    }
  }

  return true;
}

// ฟังก์ชันสำหรับตรวจสอบความถูกต้องของที่อยู่

// เพิ่มฟังก์ชันสำหรับตรวจสอบผู้ใช้ใหม่และส่งข้อความเริ่มต้น
async function checkAndSendWelcomeMessage(userId, pageKey = 'default') {
  try {
    const userStatus = await getUserStatus(userId);
    if (userStatus.welcomeMessageEnabled === false) {
      console.log(`[DEBUG] Welcome message disabled for userId=${userId}`);
      return false;
    }

    console.log(`[DEBUG] Checking if user ${userId} is new...`);
    const chatCount = await withMongoRetry("checkAndSendWelcomeMessage.countDocuments", async () => {
      // ตรวจสอบว่ามีประวัติการสนทนาหรือไม่
      const result = await query(
        `SELECT COUNT(*)::int AS total FROM chat_history WHERE sender_id = $1`,
        [userId]
      );
      return result.rows?.[0]?.total || 0;
    });

    if (chatCount === 0) {
      console.log(`[DEBUG] New user detected: ${userId}. Sending welcome message...`);

      // ข้อความเริ่มต้นที่กำหนด
      const welcomeMessage = `ยาสีฟันสูตรสมุนไพรพรีเมี่ยม
สามารถใช้ได้ทั้งครอบครัว
มีฟลูออไรด์ สูงถึง 1500 ppm*
กำจัดเเบคทีเรียในปากได้ถึง 99%
[SEND_IMAGE:https://i.imgur.com/DECZqCm.jpeg]
[cut]
ยาสีฟันสูตรใหม่
- ป้องกันฟันผุ ลดกลิ่นปาก
- ฟันขาว ลดคราบหินปูน
- กำจัดแบคทีเรียในปาก
เลือกใช้ "ยาสีฟันทยา"
[SEND_IMAGE:https://i.imgur.com/Tk9WM15.jpeg]
[cut]
มาตราฐานทันตเเพทย์แนะนำ
อัดแน่นสมุนไพรกว่า 5 ชนิด
ยับยั้งการเจริญเติบโตแบคทีเรียในช่องปาก
กระชับเหงือก ลดโอกาสการเกิดโรคเหงือก
ช่วยให้ฟันให้แข็งแรง ฟลูออไรด์สูงมาก 1500ppm
[SEND_IMAGE:https://i.imgur.com/Iz7zaK9.jpeg]
[cut]
จบปัญหาฟัน กลิ่นปาก คราบเหลือง
การันตีเห็นผลตั้งแต่หลอดแรกที่ใช้เลยค่ะ
[SEND_IMAGE:https://i.imgur.com/VRZCCXi.jpeg]
[cut]
[SEND_IMAGE:https://i.imgur.com/4rPBgoT.jpeg]
[SEND_VIDEO:https://www.dropbox.com/scl/fi/2z9sp3jha5s3nsqw8h11s/1.mp4?rlkey=pvbolh7c5j1n7pxqnyg8jmzyd&e=1&st=a6ddzvzi&dl=1]
[cut]
ส่งฟรี มีเก็บเงินปลายทางค่ะ
[SEND_IMAGE:https://i.postimg.cc/c49VM7Hk/THAYA-por-rwm-0.jpg]
[cut]
ขออนุญาตแนะนำโปรสุดคุ้ม! 
🦷✨ 2แถม3 THAYA! ใช้ได้ทั้งครอบครัว 
 ยาสีฟัน 4 หลอด+ แปรงสีฟัน 1 แพ็ค (6 ชิ้น) พิเศษเพียง 580 บาท 
คุ้มค่ากว่านี้ไม่มีแล้ว!
[SEND_IMAGE:https://i.postimg.cc/KYfwzFJR/IMG-8204.jpg]
[cut]
📌โปรราคาประหยัด ครอบคลุมเรื่องปาก ราคาเพียง 650 บาท
ฟันขาว ปากสะอาด หอมสดชื่น
ได้ น้ำยาบ้วนปาก 1 ขวด + ยาสีฟัน 2 หลอด +แปรงสีฟัน 1 แพ็ก
[SEND_IMAGE:https://i.postimg.cc/YSdDJhjB/por650.jpg]
[cut]
สนใจรับโปรไหนดีคะ แจ้งแอดมินได้เลยค่ะ`;

      // ส่งข้อความเริ่มต้น
      await sendTextMessage(userId, welcomeMessage, pageKey);

      // บันทึกข้อความเริ่มต้นลงในประวัติการสนทนา
      await saveChatHistory(userId, welcomeMessage, "assistant");

      // บันทึกข้อความเริ่มต้นลงในประวัติการสนทนาของโมเดลบันทึกออเดอร์ด้วย
      await saveOrderChatHistory(userId, welcomeMessage, "assistant");

      return true;
    }

    return false;
  } catch (error) {
    console.error(`[ERROR] Failed to check and send welcome message: ${error.message}`);
    return false;
  }
}
