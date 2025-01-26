/*******************************************************
 * โค้ด chatbot + Google Docs Instructions + 
 * Google Sheets (INSTRUCTIONS) + 
 * Google Sheets (ใหม่) สำหรับบันทึกออเดอร์
 * (ปรับแก้ให้สามารถปิด/เปิด AI ด้วยข้อความจากแอดมินเพจ)
 * + ปรับแก้ตามเงื่อนไขใหม่:
 *   - ใช้ GPT (“gpt-4o-mini”) วิเคราะห์สถานะจากบทสนทนาทุกครั้ง (pending / ordered / ปฏิเสธรับ / alreadyPurchased)
 *   - Scheduler นับเวลาหลังลูกค้าตอบผ่าน lastUserReplyAt 
 *******************************************************/
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const util = require('util');            
const requestPost = util.promisify(request.post);
const requestGet = util.promisify(request.get);     // <--- สำหรับ get profile
const { google } = require('googleapis');
const { MongoClient } = require('mongodb');
const { OpenAI } = require('openai');

const app = express();
app.use(bodyParser.json());

// ====================== 1) ENV Config ======================
const PORT = process.env.PORT || 3000;

// ควรเก็บไว้ใน Environment หรือไฟล์ config แยก
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN; 
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "AiDee_a4wfaw4";
const MONGO_URI = process.env.MONGO_URI;

// หากมีการเชื่อมต่อ Google Docs, Sheets
const GOOGLE_CLIENT_EMAIL = "aitar-888@eminent-wares-446512-j8.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGhyeINArKZgaV\nitEcK+o89ilPYeRNTNZgJT7VNHB5hgNLLeAcFLJ7IlCIqTLMoJEnnoDQil6aKaz8\nExVL83uSXRrzk4zQvtt3tIP31+9wOCb9D4ZGWfVP1tD0qdD4WJ1qqg1j1/8879pH\nUeQGEMuCnyVbcQ3GbYQjyYb3wEz/Qv7kMVggF+MIaGGw2NQwM0XcufSFtyxvvX2S\nb8uGc1A8R+Dn/tmcgMODhbtEgcMg6yXI5Y26MPfDjVrEbk0lfCr7IGFJX4ASYeKl\n0jhm0RGb+aya2cb55auLN3VPO5MQ+cOp8gHBf5GiC/YgF1gbRgF5b7LgmENBxSfH\nb3WVQodLAgMBAAECggEACKB14M7LdekXZHyAQrZL0EitbzQknLv33Xyw2B3rvJ7M\nr4HM/nC4eBj7y+ciUc8GZQ+CWc2GzTHTa66+mwAia1qdYbPp3LuhGM4Leq5zn/o+\nA3rJuG6PS4qyUMy89msPXW5fSj/oE535QREiFKYP2dtlia2GI4xoag+x9uZwfMUO\nWKEe7tiUoZQEiGhwtjLq9lyST4kGGmlhNee9OyhDJcw4uCt8Cepr++hMDleWUF6c\nX0nbGmoSS0sZ5Boy8ATMhw/3luaOAlTUEz/nVDvbbWlNL9etwLKiAVw+AQXsPHNW\nNWF7gyEIsEi0qSM3PtA1X7IdReRXHqmfiZs0J3qSQQKBgQD1+Yj37Yuqj8hGi5PY\n+M0ieMdGcbUOmJsM1yUmBMV4bfaTiqm504P6DIYAqfDDWeozcHwcdpG1AfFAihEi\nh6lb0qRk8YaGbzvac8mWhwo/jDA5QB97fjFa6uwtlewZ0Er/U3QmOeVVnVC1y1b0\nrbJD5yjvI3ve+gpwAz0glpIMiwKBgQDOnpD7p7ylG4NQunqmzzdozrzZP0L6EZyE\n141st/Hsp9rtO9/ADuH6WhpirQ516l5LLv7mLPA8S9CF/cSdWF/7WlxBPjM8WRs9\nACFNBJIwUfjzPnvECmtsayzRlKuyCAspnNSkzgtdtvf2xI82Z3BGov9goZfu+D4A\n36b1qXsIQQKBgQCO1CojhO0vyjPKOuxL9hTvqmBUWFyBMD4AU8F/dQ/RYVDn1YG+\npMKi5Li/E+75EHH9EpkO0g7Do3AaQNG4UjwWVJcfAlxSHa8Mp2VsIdfilJ2/8KsX\nQ2yXVYh04/Rn/No/ro7oT4AKmcGu/nbstxuncEgFrH4WOOzspATPsn72BwKBgG5N\nBAT0NKbHm0B7bIKkWGYhB3vKY8zvnejk0WDaidHWge7nabkzuLtXYoKO9AtKxG/K\ndNUX5F+r8XO2V0HQLd0XDezecaejwgC8kwp0iD43ZHkmQBgVn+dPB6wSe94coSjj\nyjj4reSnipQ3tmRKsAtldIN3gI5YA3Gf85dtlHqBAoGAD5ePt7cmu3tDZhA3A8f9\no8mNPvqz/WGs7H2Qgjyfc3jUxEGhVt1Su7J1j+TppfkKtJIDKji6rVA9oIjZtpZT\ngxnU6hcYuiwbLh3wGEFIjP1XeYYILudqfWOEbwnxD1RgMkCqfSHf/niWlfiH6p3F\ndnBsLY/qXdKfS/OXyezAm4M=\n-----END PRIVATE KEY-----\n";

// ------------------- (A) Google Docs -------------------
const GOOGLE_DOC_ID = "1IDvCXWa_5QllMTKrVSvhLRQPNNGkYgxb8byaDGGEhyU";

// ------------------- (B) Google Sheet สำหรับ "INSTRUCTIONS" -------------------
// *** ห้ามลบหรือแก้ไขส่วนนี้ ***
const SPREADSHEET_ID = "1esN_P6JuPzYUGesR60zVuIGeuvSnRM1hlyaxCJbhI_c";
const SHEET_RANGE = "ชีต1!A2:B28";  // Range สำหรับดึงข้อมูล instructions

// ------------------- (C) Google Sheet สำหรับ "บันทึกออเดอร์" (ใหม่) -------------------
// เพิ่มคอลัมน์เป็น 8 คอลัมน์ (A2:H2) => [timestamp, facebookName, customerName, address, phone, promo, total, payment]
const ORDERS_SPREADSHEET_ID = "1f783DDFR0ZZDM4wG555Zpwmq6tQ2e9tWT28H0qRBPhU";
const SHEET_NAME_FOR_ORDERS = "บันทึกออเดอร์";
const ORDERS_RANGE = `${SHEET_NAME_FOR_ORDERS}!A2:H`; // เริ่มเก็บที่แถว 2, คอลัมน์ A-H

// (NEW) ส่วน Follow-up ในแท็บ "ติดตามลูกค้า"
const FOLLOWUP_SHEET_RANGE = "ติดตามลูกค้า!A2:B";

// ====================== 2) MongoDB ======================
let mongoClient = null;

/** ฟังก์ชันเชื่อมต่อ MongoDB (global) */
async function connectDB() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    console.log("MongoDB connected (global).");
  }
  return mongoClient;
}

/**
 * normalizeRoleContent:
 * ป้องกัน error เวลาส่งไป GPT (string/array)
 */
function normalizeRoleContent(role, content) {
  if (typeof content === "string") {
    return { role, content };
  }
  if (Array.isArray(content)) {
    return { role, content: JSON.stringify(content) };
  }
  return { role, content: JSON.stringify(content) };
}

/** ดึงประวัติแชทจาก MongoDB */
async function getChatHistory(userId) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("chat_history");
  const chats = await coll.find({ senderId: userId }).sort({ timestamp: 1 }).toArray();
  
  return chats.map(ch => {
    try {
      const parsed = JSON.parse(ch.content);
      return normalizeRoleContent(ch.role, parsed);
    } catch (err) {
      return normalizeRoleContent(ch.role, ch.content);
    }
  });
}

/** บันทึกบทสนทนา ลง DB (เจาะจง role='user' หรือ role='assistant') */
async function saveChatHistory(userId, messageContent, role = "user") {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("chat_history");

  let msgToSave;
  if (typeof messageContent === "string") {
    msgToSave = messageContent;
  } else {
    msgToSave = JSON.stringify(messageContent);
  }

  console.log(`[DEBUG] Saving chat history => role=${role}`);
  await coll.insertOne({
    senderId: userId,
    role,
    content: msgToSave,
    timestamp: new Date(),
  });
  console.log(`[DEBUG] Saved message. userId=${userId}, role=${role}`);
}

/** เก็บสถานะ aiEnabled ของแต่ละ userId (PSID) */
async function getUserStatus(userId) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("active_user_status");

  let userStatus = await coll.findOne({ senderId: userId });
  if (!userStatus) {
    userStatus = { senderId: userId, aiEnabled: true, updatedAt: new Date() };
    await coll.insertOne(userStatus);
  }
  return userStatus;
}

async function setUserStatus(userId, aiEnabled) {
  console.log(`[DEBUG] setUserStatus: userId=${userId}, aiEnabled=${aiEnabled}`);
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("active_user_status");

  await coll.updateOne(
    { senderId: userId },
    { $set: { aiEnabled, updatedAt: new Date() } },
    { upsert: true }
  );
}

/** เก็บสถานะการสั่งซื้อ (เช่น ordered, pending, ปฏิเสธรับ, alreadyPurchased ฯลฯ) ไว้ใน MongoDB */
async function getCustomerOrderStatus(userId) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("customer_order_status");

  let doc = await coll.findOne({ senderId: userId });
  if (!doc) {
    doc = {
      senderId: userId,
      orderStatus: "pending",
      followupIndex: 0,
      // (NEW) เก็บเวลา user ตอบล่าสุด: เริ่มต้นเป็น new Date() (หรือ null ก็ได้)
      lastUserReplyAt: new Date(),
      // ด้านล่างยังคงเก็บ lastFollowupAt ตามโค้ดเดิม
      lastFollowupAt: null,
      updatedAt: new Date()
    };
    await coll.insertOne(doc);
  }
  return doc;
}

async function updateCustomerOrderStatus(userId, status) {
  console.log(`[DEBUG] updateCustomerOrderStatus: userId=${userId}, status=${status}`);
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("customer_order_status");

  await coll.updateOne(
    { senderId: userId },
    { $set: { orderStatus: status, updatedAt: new Date() } },
    { upsert: true }
  );
}

// (เดิม) อัปเดต lastFollowupAt + followupIndex
async function updateFollowupData(userId, followupIndex, lastFollowupDate) {
  console.log(`[DEBUG] updateFollowupData => userId=${userId}, followupIndex=${followupIndex}`);
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("customer_order_status");

  await coll.updateOne(
    { senderId: userId },
    { 
      $set: { 
        followupIndex, 
        lastFollowupAt: lastFollowupDate, 
        updatedAt: new Date()
      } 
    },
    { upsert: true }
  );
}

// (NEW) อัปเดต lastUserReplyAt ทุกครั้งที่ลูกค้าส่งข้อความ
async function updateLastUserReplyAt(userId, dateObj) {
  console.log(`[DEBUG] updateLastUserReplyAt => userId=${userId}, date=${dateObj}`);
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("customer_order_status");

  await coll.updateOne(
    { senderId: userId },
    { $set: { lastUserReplyAt: dateObj, updatedAt: new Date() } },
    { upsert: true }
  );
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


// ====================== 4) ดึงข้อมูลจาก Google Sheets (INSTRUCTIONS) ======================
async function getSheetsApi() {
  const sheetsAuth = new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: sheetsAuth });
}

/**
 * fetchSheetData: ดึงข้อมูลจาก Sheet (INSTRUCTIONS) หรือ Follow-up
 * *** ห้ามลบหรือแก้ไขส่วนนี้ ***
 */
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

/**
 * parseSheetRowsToObjects:
 * แปลงข้อมูลจาก Google Sheets เป็น Array ของ Object
 * *** ห้ามลบหรือแก้ไขส่วนนี้ ***
 */
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

/** transformSheetRowsToJSON: เรียก parseSheetRowsToObjects */
function transformSheetRowsToJSON(rows) {
  return parseSheetRowsToObjects(rows);
}

// จะถูกใช้งานใน buildSystemInstructions
let sheetJSON = [];

// (NEW) ส่วนติดตาม followupData
let followupData = [];

/**
 * (NEW) loadFollowupData:
 *  ดึงข้อมูลในแท็บ "ติดตามลูกค้า!A2:B"
 *  แถวแรกเป็น (A2=เวลา(นาที), B2=ข้อความ)
 */
async function loadFollowupData() {
  try {
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


// ====================== 5) สร้าง systemInstructions (ผสาน Docs + Sheets) ======================
function buildSystemInstructions() {
  const sheetsDataString = JSON.stringify(sheetJSON, null, 2);

  const finalSystemInstructions = `
You are an AI chatbot for THAYA. 
Below are instructions from the Google Doc:
---
${googleDocInstructions}

Below is additional data from Google Sheets (INSTRUCTIONS):
---
${sheetsDataString}

Rules about images, privacy, etc...
(ใช้ตาม policy ที่ต้องการ)
`.trim();

  return finalSystemInstructions;
}


// ====================== 6) เรียก GPT (รองรับทั้งข้อความและรูป) ======================
async function getAssistantResponse(systemInstructions, history, userContent) {
  try {
    console.log("[DEBUG] getAssistantResponse => calling GPT...");
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // สร้าง messages เริ่มจาก system + ประวัติ
    const messages = [
      { role: "system", content: systemInstructions },
      ...history
    ];

    // ใส่ userContent
    let finalUserMessage = normalizeRoleContent("user", userContent);
    messages.push(finalUserMessage);

    // เรียกโมเดล
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2,
    });

    let assistantReply = response.choices[0].message.content;
    if (typeof assistantReply !== "string") {
      assistantReply = JSON.stringify(assistantReply);
    }

    // Cleanup กันวนลูป
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


// ====================== 7) ฟังก์ชันส่งข้อความกลับ Facebook ======================
async function sendSimpleTextMessage(userId, text) {
  console.log(`[DEBUG] Sending text message to userId=${userId}, text="${text}"`);
  const reqBody = {
    recipient: { id: userId },
    message: { text }
  };
  const options = {
    uri: 'https://graph.facebook.com/v12.0/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
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

async function sendImageMessage(userId, imageUrl) {
  console.log(`[DEBUG] Sending image to userId=${userId}, imageUrl=${imageUrl}`);
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
    qs: { access_token: PAGE_ACCESS_TOKEN },
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

async function sendVideoMessage(userId, videoUrl) {
  console.log(`[DEBUG] Sending video to userId=${userId}, videoUrl=${videoUrl}`);
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
    qs: { access_token: PAGE_ACCESS_TOKEN },
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

/**
 * sendTextMessage:
 * - สแกน [SEND_IMAGE:...], [SEND_VIDEO:...]
 * - ส่งทีละ segment (split [cut])
 */
async function sendTextMessage(userId, response) {
  console.log("[DEBUG] sendTextMessage => raw response:", response);

  response = response.replace(/\[cut\]{2,}/g, "[cut]");
  let segments = response.split("[cut]").map(s => s.trim()).filter(s => s);
  if (segments.length > 10) segments = segments.slice(0, 10);

  for (let segment of segments) {
    // ดัก [SEND_IMAGE:URL], [SEND_VIDEO:URL]
    const imageRegex = /\[SEND_IMAGE:(https?:\/\/[^\s]+)\]/g;
    const videoRegex = /\[SEND_VIDEO:(https?:\/\/[^\s]+)\]/g;

    const images = [...segment.matchAll(imageRegex)];
    const videos = [...segment.matchAll(videoRegex)];

    let textPart = segment
      .replace(imageRegex, '')
      .replace(videoRegex, '')
      .trim();

    // ส่งรูป
    for (const match of images) {
      const imageUrl = match[1];
      await sendImageMessage(userId, imageUrl);
    }

    // ส่งวิดีโอ
    for (const match of videos) {
      const videoUrl = match[1];
      await sendVideoMessage(userId, videoUrl);
    }

    // ส่ง text
    if (textPart) {
      await sendSimpleTextMessage(userId, textPart);
    }
  }
}


// ====================== (NEW) ฟังก์ชันไปดึงชื่อเฟซจาก Graph API ======================
async function getFacebookUserName(userId) {
  try {
    const url = `https://graph.facebook.com/${userId}?fields=name&access_token=${PAGE_ACCESS_TOKEN}`;
    console.log(`[DEBUG] getFacebookUserName => GET ${url}`);
    const resp = await requestGet({ uri: url, json: true });
    // resp.body => { name: "...", id: "..." }
    if (resp.body && resp.body.name) {
      return resp.body.name;
    }
    return "";
  } catch (err) {
    console.error("[DEBUG] getFacebookUserName error:", err);
    return "";
  }
}


// ====================== 8) ฟังก์ชันตรวจจับและบันทึกออเดอร์จาก Assistant ======================
async function extractOrderDataWithGPT(assistantMsg) {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const sysPrompt = `
คุณเป็นโปรแกรมตรวจสอบว่าข้อความ AssistantMsg มีข้อมูลออเดอร์/ที่อยู่หรือไม่
ถ้ามี ให้ดึง:
- "customer_name"
- "address"
- "phone"
- "promotion"
- "total" (ยอดรวม ถ้ามี)
- "payment_method" (ถ้ามี)

ตอบเป็น JSON เท่านั้น
โครงสร้าง:
{
  "is_found": true or false,
  "customer_name": "",
  "address": "",
  "phone": "",
  "promotion": "",
  "total": "",
  "payment_method": ""
}

หากไม่พบให้ is_found = false
หากพบแค่บางส่วนให้กรอกเฉพาะที่เจอ ที่เหลือ "" (string ว่าง)
ห้ามมีข้อความอื่นนอกจาก JSON
`.trim();

  try {
    console.log("[DEBUG] extractOrderDataWithGPT => calling GPT to parse order data...");
    const messages = [
      { role: "system", content: sysPrompt },
      { role: "user", content: assistantMsg }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.0,
    });

    const gptAnswer = response.choices[0].message.content || "{}";

    let data;
    try {
      data = JSON.parse(gptAnswer);
    } catch (e) {
      console.error("JSON parse error, got:", gptAnswer);
      data = { is_found: false };
    }
    console.log("[DEBUG] extractOrderDataWithGPT => parse result:", data);
    return data;
  } catch (e) {
    console.error("extractOrderDataWithGPT error:", e);
    return { is_found: false };
  }
}

async function saveOrderToSheet(orderData) {
  try {
    console.log("[DEBUG] saveOrderToSheet => Start saving to Google Sheet...");
    const sheetsApi = await getSheetsApi();

    const timestamp = new Date().toLocaleString("th-TH");
    const rowValues = [
      timestamp,
      orderData.fb_name || "",        
      orderData.customer_name || "",  
      orderData.address || "",        
      orderData.phone || "",
      orderData.promotion || "",
      orderData.total || "",
      orderData.payment_method || "",
    ];

    console.log("[DEBUG] rowValues =", rowValues);

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

  } catch (err) {
    console.error("saveOrderToSheet error:", err);
  }
}

async function detectAndSaveOrder(userId, assistantMsg) {
  console.log(`[DEBUG] detectAndSaveOrder => userId=${userId}`);

  // 1) ดึงชื่อเฟซ
  const fbName = await getFacebookUserName(userId);
  console.log("[DEBUG] Fetched Facebook name:", fbName);

  // 2) สกัดข้อมูลออเดอร์ด้วย GPT
  const parsed = await extractOrderDataWithGPT(assistantMsg);
  if (!parsed.is_found) {
    console.log("[DEBUG] detectAndSaveOrder: No order data found => skip saving");
    return;
  }

  // 3) ใส่ fb_name ก่อนบันทึก
  parsed.fb_name = fbName || "";

  // 4) บันทึกลงชีต
  await saveOrderToSheet(parsed);

  // 5) อัปเดตสถานะใน Mongo (ถ้าเดิมไม่ใช่ alreadyPurchased)
  const statusColl = await getCustomerOrderStatus(userId);
  if (statusColl.orderStatus !== "alreadyPurchased") {
    await updateCustomerOrderStatus(userId, "ordered");
  }
}


// ====================== (NEW) 9) ฟังก์ชันวิเคราะห์สถานะด้วย gpt-4o-mini ======================
/**
 * analyzeConversationForStatusChange:
 * - ดึงประวัติการสนทนา (user + assistant)
 * - ให้โมเดล gpt-4o-mini วิเคราะห์ แล้วสรุปว่าเป็น 1 ใน:
 *   "pending", "ordered", "ปฏิเสธรับ", "alreadyPurchased"
 * - หากสถานะเดิมเป็น "alreadyPurchased" จะไม่ revert
 * - หากสถานะเดิมเป็น "ordered" หรือ "ปฏิเสธรับ" ก็ไม่ revert เว้นแต่ว่าโมเดลบอก "alreadyPurchased" (อัปเดตได้)
 * - หากสถานะเดิมเป็น "pending" สามารถเปลี่ยนเป็นอะไรก็ได้ตามที่โมเดลระบุ
 */
async function analyzeConversationForStatusChange(userId) {
  try {
    console.log("[DEBUG] analyzeConversationForStatusChange => userId=", userId);
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // 1) รวบรวมบทสนทนาทั้งหมดเป็น text ให้โมเดลอ่าน
    const chatHistory = await getChatHistory(userId);
    let conversationText = "";
    chatHistory.forEach(msg => {
      conversationText += `[${msg.role}] ${msg.content}\n`;
    });

    // 2) สร้าง system prompt
    const sysPrompt = `
คุณเป็นโปรแกรมสรุปสถานะการขายจากประวัติแชทในภาษาไทย
ผลลัพธ์ = 1 ใน: "pending", "ordered", "ปฏิเสธรับ", "alreadyPurchased"
ตอบเป็น JSON เท่านั้น เช่น:
{
  "status": "pending"
}
ห้ามมีข้อความอื่นนอกจาก JSON
`.trim();

    const messages = [
      { role: "system", content: sysPrompt },
      { role: "user", content: conversationText }
    ];

    // 3) เรียก gpt-4o-mini
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
    console.log("[DEBUG] newStatus from gpt-4o-mini =", newStatus);

    // 4) เทียบกับสถานะใน DB
    const doc = await getCustomerOrderStatus(userId);
    const oldStatus = doc.orderStatus || "pending";

    if (oldStatus === "alreadyPurchased") {
      // ไม่เปลี่ยน
      console.log("[DEBUG] oldStatus=alreadyPurchased => do not revert");
      return;
    }
    if (oldStatus === "ordered" && newStatus !== "alreadyPurchased") {
      // ถ้า GPT บอก alreadyPurchased ก็อัปเดตเป็น alreadyPurchased ได้
      // นอกนั้นไม่ revert
      if (newStatus === "alreadyPurchased") {
        await updateCustomerOrderStatus(userId, "alreadyPurchased");
      }
      return;
    }
    if (oldStatus === "ปฏิเสธรับ" && newStatus !== "alreadyPurchased") {
      // เช่นเดียวกัน ถ้า GPT บอก alreadyPurchased ก็เปลี่ยน
      return;
    }

    // ถ้าเก่าเป็น pending => เปลี่ยนได้
    if (oldStatus === "pending" && newStatus !== oldStatus) {
      await updateCustomerOrderStatus(userId, newStatus);
    }
    // ถ้า GPT บอก "alreadyPurchased" ก็เปลี่ยน
    if (newStatus === "alreadyPurchased" && oldStatus !== "alreadyPurchased") {
      await updateCustomerOrderStatus(userId, "alreadyPurchased");
    }

  } catch (err) {
    console.error("analyzeConversationForStatusChange error:", err);
  }
}


// ====================== 10) Scheduler สำหรับติดตามลูกค้า ======================
/**
 * startFollowupScheduler():
 * - ทำงานทุก 1 นาที
 * - หา user ที่ orderStatus = "pending" และ followupIndex < followupData.length
 * - ใช้ lastUserReplyAt เป็นตัวอ้างอิงเวลาที่ user ตอบล่าสุด
 * - ถ้า diffMin >= followupData[idx].time => ส่งข้อความติดตามครั้งที่ idx
 *   แล้ว update followupIndex + 1, update lastFollowupAt (โค้ดเดิม)
 * - ถ้าลูกค้าตอบกลับ => updateLastUserReplyAt => เวลาจะรีเซตไป
 */
function startFollowupScheduler() {
  setInterval(async () => {
    if (!followupData || followupData.length === 0) {
      return;
    }

    const client = await connectDB();
    const db = client.db("chatbot");
    const coll = db.collection("customer_order_status");

    // หาเฉพาะผู้ใช้ที่สถานะ = "pending" และ followupIndex ยังไม่ถึง limit
    const cursor = coll.find({
      orderStatus: "pending",
      followupIndex: { $lt: followupData.length }
    });

    const now = new Date();
    const allUsers = await cursor.toArray();

    for (let userDoc of allUsers) {
      const userId = userDoc.senderId;
      const idx = userDoc.followupIndex || 0;

      // เดิมใช้ lastFollowupAt นับ => เปลี่ยนมาใช้ lastUserReplyAt
      const lastReply = userDoc.lastUserReplyAt 
          ? new Date(userDoc.lastUserReplyAt)
          : new Date(userDoc.updatedAt);

      const requiredMin = followupData[idx].time;
      const diffMs = now - lastReply;
      const diffMin = diffMs / 60000;

      if (diffMin >= requiredMin) {
        // ถึงเวลาส่ง followup
        const msg = followupData[idx].message;
        console.log(`[FOLLOWUP] Sending followup #${idx+1} to userId=${userId}`);

        // ส่งข้อความ
        await sendTextMessage(userId, msg);

        // บันทึกลงประวัติ (assistant)
        await saveChatHistory(userId, msg, "assistant");

        // อัปเดต followupIndex+1 และ lastFollowupAt
        await updateFollowupData(userId, idx + 1, new Date());

        // (เพิ่มเติม) อาจเรียก analyzeConversationForStatusChange ก็ได้ 
        // แต่ปกติจะรอให้ user ตอบกลับแล้วค่อยวิเคราะห์
      }
    }
  }, 60000); // 1 นาที
}


// ====================== 11) Webhook Routes & Startup ======================
const processedMessageIds = new Set();

// ยืนยัน webhook
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// รับ event จาก Messenger
app.post('/webhook', async (req, res) => {
  if (req.body.object === 'page') {
    for (const entry of req.body.entry) {
      if (!entry.messaging || entry.messaging.length === 0) {
        continue;
      }

      const pageId = entry.id; // อ้างอิง Page

      for (const webhookEvent of entry.messaging) {
        // ข้าม event จำพวก delivery/read
        if (webhookEvent.delivery || webhookEvent.read) {
          console.log("Skipping delivery/read event");
          continue;
        }

        // กัน mid ซ้ำ
        if (webhookEvent.message && webhookEvent.message.mid) {
          const mid = webhookEvent.message.mid;
          if (processedMessageIds.has(mid)) {
            console.log("Skipping repeated mid:", mid);
            continue;
          } else {
            processedMessageIds.add(mid);
          }
        }

        // ระบุ userId
        let userId = (webhookEvent.sender.id === pageId)
          ? webhookEvent.recipient.id
          : webhookEvent.sender.id;

        // เช็คถ้ามี message
        if (webhookEvent.message) {
          const textMsg = webhookEvent.message.text || "";
          const isEcho = webhookEvent.message.is_echo === true;
          const attachments = webhookEvent.message.attachments;

          // (A) Echo Message (จากแอดมินเพจ)
          if (isEcho) {
            if (textMsg === "แอดมิน THAYA รอให้คำปรึกษาค่ะ") {
              // ปิด AI
              await setUserStatus(userId, false);
              await saveChatHistory(userId, textMsg, "assistant");
              await sendSimpleTextMessage(userId, "ลูกค้าสนใจอยากปรึกษาด้านไหนดีคะ");
              continue;
            }
            else if (textMsg === "แอดมิน THAYA ยินดีดูแลลูกค้าค่ะ") {
              // เปิด AI
              await setUserStatus(userId, true);
              await saveChatHistory(userId, textMsg, "assistant");
              await sendSimpleTextMessage(userId, "ขอบพระคุณที่ให้ THAYA ดูแลค่ะ");
              continue;
            }
            else {
              // echo อื่น ๆ => ไม่ทำอะไร
              console.log("Skipping other echo");
              continue;
            }
          }

          // (B) ข้อความจาก "ลูกค้า"
          const userStatus = await getUserStatus(userId);
          const aiEnabled = userStatus.aiEnabled;

          // อัปเดต lastUserReplyAt => เพื่อรีเซตการนับ
          await updateLastUserReplyAt(userId, new Date());

          if (textMsg && !attachments) {
            // เป็น text
            console.log(`[DEBUG] Received text from userId=${userId}:`, textMsg);

            // บันทึกลง DB (user)
            await saveChatHistory(userId, textMsg, "user");

            if (!aiEnabled) {
              // AI ปิด => ไม่เรียก GPT ตอบ
              // แต่วิเคราะห์สถานะด้วย gpt-4o-mini ได้
              await analyzeConversationForStatusChange(userId);
              continue;
            }

            // AI เปิด => เรียก GPT
            const history = await getChatHistory(userId);
            const systemInstructions = buildSystemInstructions();
            const assistantMsg = await getAssistantResponse(systemInstructions, history, textMsg);

            // บันทึก assistant
            await saveChatHistory(userId, assistantMsg, "assistant");

            // ตรวจว่ามีออเดอร์มั้ย
            await detectAndSaveOrder(userId, assistantMsg);

            // ส่งข้อความ
            await sendTextMessage(userId, assistantMsg);

            // วิเคราะห์สถานะ
            await analyzeConversationForStatusChange(userId);

          } else if (attachments && attachments.length > 0) {
            // มีไฟล์แนบ
            console.log("[DEBUG] Received attachments from user:", attachments);

            let userContentArray = [{
              type: "text",
              text: "ผู้ใช้ส่งไฟล์แนบ"
            }];

            for (const att of attachments) {
              if (att.type === 'image') {
                userContentArray.push({
                  type: "image_url",
                  image_url: {
                    url: att.payload.url
                  }
                });
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

            // บันทึก user
            await saveChatHistory(userId, userContentArray, "user");

            if (!aiEnabled) {
              // ไม่เรียก GPT
              await analyzeConversationForStatusChange(userId);
              continue;
            }

            // AI เปิด => GPT
            const history = await getChatHistory(userId);
            const systemInstructions = buildSystemInstructions();
            const assistantMsg = await getAssistantResponse(systemInstructions, history, userContentArray);

            // บันทึก assistant
            await saveChatHistory(userId, assistantMsg, "assistant");

            // ตรวจออเดอร์
            await detectAndSaveOrder(userId, assistantMsg);

            // ส่งข้อความ
            await sendTextMessage(userId, assistantMsg);

            // วิเคราะห์สถานะ
            await analyzeConversationForStatusChange(userId);

          } else {
            // ไม่มี text และไม่มีไฟล์แนบ
            console.log(">> [Webhook] Received empty message:", webhookEvent);
          }
        } else {
          console.log(">> [Webhook] Received event but not text/attachment:", webhookEvent);
        }
      }
    }
    // ตอบ FB ว่า EVENT_RECEIVED
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// ====================== Start Server ======================
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);

  try {
    // 1) เชื่อมต่อ DB
    await connectDB();

    // 2) ดึง instructions จาก Google Docs
    await fetchGoogleDocInstructions();

    // 3) โหลดข้อมูลจาก Google Sheet (INSTRUCTIONS) แล้วแปลงเป็น JSON
    const rows = await fetchSheetData(SPREADSHEET_ID, SHEET_RANGE);
    sheetJSON = transformSheetRowsToJSON(rows);

    // (NEW) โหลดข้อมูลติดตามลูกค้า
    await loadFollowupData();

    // (NEW) เริ่มฟังก์ชัน Scheduler
    startFollowupScheduler();

    console.log("[DEBUG] Startup completed. Ready to receive webhooks.");
  } catch (err) {
    console.error("Startup error:", err);
  }
});
