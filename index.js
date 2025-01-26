/*******************************************************
 * โค้ด chatbot + Google Docs Instructions + 
 * Google Sheets (INSTRUCTIONS) + 
 * Google Sheets (บันทึกออเดอร์) +
 * Google Sheets (ติดตามลูกค้า)
 * + ระบบติดตามลูกค้า (3 ครั้ง หรือมากกว่านั้น) 
 * + ใช้ GPT 2 ส่วน:
 *    - สำหรับโต้ตอบ (gpt-4o-mini)
 *    - สำหรับวิเคราะห์สถานะ (gpt-4o-mini)
 *******************************************************/
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const util = require('util');
const requestPost = util.promisify(request.post);
const requestGet = util.promisify(request.get);
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


// ------------------- (A) Google Docs (Instructions) -------------------
const GOOGLE_DOC_ID = "1IDvCXWa_5QllMTKrVSvhLRQPNNGkYgxb8byaDGGEhyU";

// ------------------- (B) Google Sheet สำหรับ "INSTRUCTIONS" -------------------
// *** ห้ามลบหรือแก้ไขส่วนนี้ ***
const SPREADSHEET_ID = "1esN_P6JuPzYUGesR60zVuIGeuvSnRM1hlyaxCJbhI_c";
const SHEET_RANGE = "ชีต1!A2:B28";  // Range สำหรับดึงข้อมูล instructions

// ------------------- (C) Google Sheet สำหรับ "บันทึกออเดอร์" (ใหม่) -------------------
const ORDERS_SPREADSHEET_ID = "1f783DDFR0ZZDM4wG555Zpwmq6tQ2e9tWT28H0qRBPhU";
const SHEET_NAME_FOR_ORDERS = "บันทึกออเดอร์";
const ORDERS_RANGE = `${SHEET_NAME_FOR_ORDERS}!A2:H`; // เริ่มเก็บที่แถว 2, คอลัมน์ A-H

// ------------------- (D) Google Sheet สำหรับ "ติดตามลูกค้า" -------------------
const FOLLOWUP_SHEET_RANGE = "ติดตามลูกค้า!A2:B"; 
// แถวแรก (A2,B2) จะเป็นเวลาที่ต้องรอ (นาที) กับ ข้อความติดตาม

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
    // ถ้าเป็น array ก็เก็บเป็น JSON string
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

/** บันทึกบทสนทนา (user หรือ assistant) ลง DB */
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

  console.log("[DEBUG] Saving chat history => role =", role);
  await coll.insertOne({
    senderId: userId,
    role: role,
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

// (NEW) เพิ่มการเก็บสถานะ order + followup + lastUserReplyAt
// ตัวอย่าง field:
//   orderStatus: "pending" | "refused" | "ordered" | "alreadyPurchased"
//   followupIndex: 0.. (ว่าเคยส่ง followup ถึงครั้งที่เท่าไหร่)
//   lastUserReplyAt: Date (เวลาที่ user พิมพ์ครั้งสุดท้าย)
//   updatedAt: Date
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
      lastUserReplyAt: new Date(),  // เริ่มต้นให้เท่ากับตอนสร้าง
      updatedAt: new Date()
    };
    await coll.insertOne(doc);
  }
  return doc;
}

async function updateCustomerOrderStatus(userId, newStatus) {
  console.log(`[DEBUG] updateCustomerOrderStatus: userId=${userId}, newStatus=${newStatus}`);
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("customer_order_status");

  await coll.updateOne(
    { senderId: userId },
    { 
      $set: { orderStatus: newStatus, updatedAt: new Date() }
    },
    { upsert: true }
  );
}

async function updateLastUserReplyAt(userId, dateObj) {
  console.log(`[DEBUG] updateLastUserReplyAt => userId=${userId}, date=${dateObj}`);
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("customer_order_status");

  await coll.updateOne(
    { senderId: userId },
    { 
      $set: { lastUserReplyAt: dateObj, updatedAt: new Date() }
    },
    { upsert: true }
  );
}

async function updateFollowupIndex(userId, followupIndex) {
  console.log(`[DEBUG] updateFollowupIndex => userId=${userId}, followupIndex=${followupIndex}`);
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("customer_order_status");

  await coll.updateOne(
    { senderId: userId },
    { 
      $set: { followupIndex, updatedAt: new Date() }
    },
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


// ====================== 4) ดึงข้อมูลจาก Google Sheets (INSTRUCTIONS + FOLLOWUP) ======================
async function getSheetsApi() {
  const sheetsAuth = new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: sheetsAuth });
}

/** ดึงข้อมูลจาก Sheet (INSTRUCTIONS) */
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
 * (สำหรับ INSTRUCTIONS)
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

function transformSheetRowsToJSON(rows) {
  return parseSheetRowsToObjects(rows);
}

// จะถูกใช้งานใน buildSystemInstructions
let sheetJSON = [];

// (NEW) เพิ่มส่วน followupData เพื่อเก็บข้อมูลการติดตาม
let followupData = [];

/**
 * (NEW) loadFollowupData:
 * ดึงข้อมูลแท็บ "ติดตามลูกค้า" (A=เวลา(นาที), B=ข้อความ)
 * แล้วจัดเก็บในรูป array of { time: number, message: string }
 */
async function loadFollowupData() {
  try {
    const rows = await fetchSheetData(SPREADSHEET_ID, FOLLOWUP_SHEET_RANGE);
    followupData = rows.map(row => {
      return {
        time: parseInt(row[0] || "0", 10),
        message: row[1] || ""
      };
    }).filter(f => f.time > 0 && f.message);

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


// ====================== 6) เรียก GPT (สำหรับ “ตอบลูกค้า”) ======================
async function getAssistantResponse(systemInstructions, history, userContent) {
  try {
    console.log("[DEBUG] getAssistantResponse => calling GPT (model: gpt-4o-mini)...");
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // สร้าง messages เริ่มจาก system + ประวัติ
    const messages = [
      { role: "system", content: systemInstructions },
      ...history
    ];

    // ใส่ userContent
    let finalUserMessage = normalizeRoleContent("user", userContent);
    messages.push(finalUserMessage);

    // เรียกโมเดล (เช่น gpt-4o-mini)
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
    // ------------------------
    // ดัก [SEND_IMAGE:URL] และ [SEND_VIDEO:URL]
    // ------------------------
    const imageRegex = /\[SEND_IMAGE:(https?:\/\/[^\s]+)\]/g;
    const videoRegex = /\[SEND_VIDEO:(https?:\/\/[^\s]+)\]/g;

    const images = [...segment.matchAll(imageRegex)];
    const videos = [...segment.matchAll(videoRegex)];

    let textPart = segment
      .replace(imageRegex, '')
      .replace(videoRegex, '')
      .trim();

    // ส่งรูป (ถ้ามี)
    for (const match of images) {
      const imageUrl = match[1];
      await sendImageMessage(userId, imageUrl);
    }

    // ส่งวิดีโอ (ถ้ามี)
    for (const match of videos) {
      const videoUrl = match[1];
      await sendVideoMessage(userId, videoUrl);
    }

    // ส่ง text ส่วนที่เหลือ (ถ้ามี)
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
    if (resp.body && resp.body.name) {
      return resp.body.name;
    }
    return "";
  } catch (err) {
    console.error("[DEBUG] getFacebookUserName error:", err);
    return "";
  }
}


// ====================== 8) สกัดข้อมูลออเดอร์จากข้อความ Assistant แล้วบันทึกใน Google Sheet ======================
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

    // จะใช้โมเดลอะไรปรับเปลี่ยนได้
    const openaiRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.0,
    });

    const gptAnswer = openaiRes.choices[0].message.content || "{}";

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

/**
 * detectAndSaveOrder:
 * ถ้า Assistant มีข้อความสรุปที่เป็นออเดอร์ => บันทึกลง Google Sheet
 * และเปลี่ยนสถานะเป็น ordered (หากยังไม่เคยเป็น alreadyPurchased)
 */
async function detectAndSaveOrder(userId, assistantMsg) {
  console.log(`[DEBUG] detectAndSaveOrder => userId=${userId}`);

  // 1) ดึงชื่อเฟซ
  const fbName = await getFacebookUserName(userId);

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

  // 5) อัปเดตสถานะเป็น "ordered" (ถ้าเดิมไม่ใช่ "alreadyPurchased")
  const statusDoc = await getCustomerOrderStatus(userId);
  if (statusDoc.orderStatus !== "alreadyPurchased") {
    // ถ้ายังไม่เคยเป็น "alreadyPurchased" ก็เปลี่ยนเป็น "ordered"
    await updateCustomerOrderStatus(userId, "ordered");
  }
}


// ====================== 9) (NEW) วิเคราะห์สถานะ (gpt-4o-mini) จากประวัติแชท ======================
/**
 * analyzeConversationForStatusChange:
 * - ดึงประวัติแชททั้งหมด (user / assistant)
 * - ให้ gpt-4o-mini อ่านแล้วสรุปสถานะเป็น 1 ใน: "pending", "ordered", "refused", "alreadyPurchased"
 * - ตอบออกมาเป็น JSON { "status": "<...>" }
 * - ถ้าต้องการคำอธิบายเพิ่ม ให้ GPT ใส่ในฟิลด์ "reason" ได้ (แต่ก็ไม่บังคับ)
 * - จากนั้นเทียบกับสถานะเดิมใน DB ถ้า DB เป็น "alreadyPurchased" จะไม่เปลี่ยน
 * - ถ้า DB ยังเป็น "pending" (หรือ "ordered"/"refused") แล้ว GPT สรุปเป็นอย่างอื่น => อัปเดต DB
 *   (เช่น "pending" -> "refused", หรือ "pending" -> "ordered")
 *   (ถ้า GPT สรุปเป็น "alreadyPurchased" แล้ว DB ยังเป็น "pending" => อัปเดตเป็น "alreadyPurchased" ทันที)
 */
async function analyzeConversationForStatusChange(userId) {
  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const chatHistory = await getChatHistory(userId);
    // เตรียมข้อความเป็นรูปแบบที่จะส่งให้ GPT
    // จะส่งเป็น System Prompt สั้น ๆ ว่าให้อ่านประวัติทั้งหมดและสรุป
    // จากนั้นส่ง user = chatHistory ที่ joined กัน
    let conversationText = "";
    chatHistory.forEach(ch => {
      conversationText += `[${ch.role}] ${ch.content}\n`;
    });

    // สร้าง prompts
    const sysPrompt = `
You are a classification model. Read the entire conversation in Thai below and decide the status:
- "pending": user ยังไม่ได้ซื้อ ยังไม่ได้ปฏิเสธ
- "ordered": user ตกลงซื้อเรียบร้อย
- "refused": user ปฏิเสธ ไม่เอา
- "alreadyPurchased": ลูกค้าเคยซื้อไปแล้ว (หรือชัดเจนว่าเป็นลูกค้าเก่า)

ตอบเป็น JSON เท่านั้น เช่น:
{
  "status": "pending"
}

ห้ามให้คำตอบอื่นนอกจาก JSON ที่มีฟิลด์ "status"
`.trim();

    const messages = [
      { role: "system", content: sysPrompt },
      { role: "user", content: conversationText }
    ];

    // เรียก gpt-4o-mini
    console.log("[DEBUG] Calling gpt-4o-mini for conversation status analysis...");
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // <--- สมมุติว่าชื่อโมเดลเป็น gpt-4o-mini
      messages,
      temperature: 0.0,
    });

    let rawAnswer = response.choices[0].message.content || "";
    rawAnswer = rawAnswer.trim();
    console.log(">>> gpt-4o-mini rawAnswer:", rawAnswer);

    let parsed = {};
    try {
      parsed = JSON.parse(rawAnswer);
    } catch (err) {
      console.warn("JSON parse fail => default to { status: 'pending' }");
      parsed.status = "pending";
    }

    const newStatus = parsed.status || "pending";
    console.log(`[DEBUG] analyzeConversationForStatusChange => newStatus="${newStatus}"`);

    // อัปเดต DB ถ้าเหมาะสม
    const statusDoc = await getCustomerOrderStatus(userId);
    const oldStatus = statusDoc.orderStatus;

    // ถ้าเดิมเป็น alreadyPurchased => ไม่เปลี่ยน
    if (oldStatus === "alreadyPurchased") {
      console.log("[DEBUG] Already purchased => do not update status.");
      return;
    }

    // ถ้าเดิมเป็น ordered => จะไม่ถอยกลับ
    if (oldStatus === "ordered" && newStatus !== "alreadyPurchased") {
      // ถ้า GPT บอก "alreadyPurchased" จะอัปเดตเป็น alreadyPurchased ก็ได้
      // แต่ถ้า GPT บอกอย่างอื่น (เช่น refused/pending) ก็ไม่เปลี่ยน
      if (newStatus === "alreadyPurchased") {
        await updateCustomerOrderStatus(userId, "alreadyPurchased");
      }
      return;
    }

    // ถ้าเดิมเป็น refused => จะไม่ถอยกลับ
    // แต่ถ้า GPT บอก "alreadyPurchased" ก็อัปเดตได้เหมือนกัน
    if (oldStatus === "refused" && newStatus !== "alreadyPurchased") {
      if (newStatus === "alreadyPurchased") {
        await updateCustomerOrderStatus(userId, "alreadyPurchased");
      }
      return;
    }

    // ถ้าเดิม pending => สามารถเปลี่ยนเป็นอะไรก็ได้
    // หรือถ้าเดิม refused แต่อยู่ในเคส GPT ว่า "alreadyPurchased" => ก็เปลี่ยน
    if (oldStatus === "pending") {
      if (newStatus !== oldStatus) {
        await updateCustomerOrderStatus(userId, newStatus);
      }
    }
  } catch (err) {
    console.error("analyzeConversationForStatusChange error:", err);
  }
}


// ====================== 10) ฟังก์ชัน Scheduler สำหรับ Follow-up ======================
/**
 * แนวทาง: เราจะใช้ setInterval ทุก 1 นาที (60000 ms)
 * - หา user ที่ status = pending (ไม่ใช่ refused/ordered/alreadyPurchased)
 * - ดู followupIndex (ว่าถึงครั้งที่เท่าไร)
 * - ถ้ายังไม่เกิน followupData.length => เช็คเวลาว่า นับจาก lastUserReplyAt เกิน followupData[index].time หรือยัง
 * - ถ้าเกิน => ส่งข้อความ follow up, saveChatHistory, followupIndex++ (update DB)
 * - ถ้า user ตอบกลับ => เราจะอัปเดต lastUserReplyAt => ดังนั้นเวลาจะรีเซตใหม่
 */
function startFollowupScheduler() {
  setInterval(async () => {
    if (!followupData || followupData.length === 0) {
      return; // ไม่มีข้อมูลติดตาม
    }

    const client = await connectDB();
    const db = client.db("chatbot");
    const coll = db.collection("customer_order_status");

    // หา user ที่ orderStatus = pending
    // และ followupIndex < followupData.length
    const now = new Date();
    const pendingUsers = await coll.find({
      orderStatus: "pending",
      followupIndex: { $lt: followupData.length }
    }).toArray();

    for (let userDoc of pendingUsers) {
      const userId = userDoc.senderId;
      const idx = userDoc.followupIndex || 0;
      const lastReply = userDoc.lastUserReplyAt ? new Date(userDoc.lastUserReplyAt) : new Date(userDoc.updatedAt);

      // นาทีที่ต้องรอ => followupData[idx].time
      const requiredMin = followupData[idx].time;
      const diffMs = now - lastReply;
      const diffMin = diffMs / 60000;

      if (diffMin >= requiredMin) {
        // ถึงเวลาส่ง followup ครั้งที่ idx
        const msg = followupData[idx].message;
        console.log(`[FOLLOWUP] Sending #${idx+1} to userId=${userId}`);

        // ส่งข้อความ
        await sendTextMessage(userId, msg);

        // บันทึกใน chat_history เป็น role=assistant
        await saveChatHistory(userId, msg, "assistant");

        // เพิ่ม followupIndex
        await updateFollowupIndex(userId, idx + 1);

        // หลังส่งแล้ว เราสามารถเรียก analyzeConversationForStatusChange เพื่อประเมินว่าผู้ใช้ถูกเปลี่ยนสถานะอัตโนมัติไหม
        // แต่โดยปกติจะประเมินหลังผู้ใช้ตอบกลับก็พอ
      }
    }

  }, 60000); // 1 นาทีต่อครั้ง
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

      // เก็บ pageId ไว้ (sender ของบาง event)
      const pageId = entry.id; 

      for (const webhookEvent of entry.messaging) {
        // --------------------------------------------------------
        // ข้ามบาง event เช่น delivery / read
        // --------------------------------------------------------
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

        // ---------------------------
        // ระบุ userId
        // ---------------------------
        let userId = (webhookEvent.sender.id === pageId)
          ? webhookEvent.recipient.id
          : webhookEvent.sender.id;

        // ---------------------------
        // ถ้ามี message => user หรือ echo
        // ---------------------------
        if (webhookEvent.message) {
          const textMsg = webhookEvent.message.text || "";
          const isEcho = webhookEvent.message.is_echo === true;
          const attachments = webhookEvent.message.attachments;

          // (A) ถ้าเป็น Echo จากแอดมิน => เช็คข้อความเปิด/ปิด AI
          if (isEcho) {
            if (textMsg === "แอดมิน THAYA รอให้คำปรึกษาค่ะ") {
              await setUserStatus(userId, false);
              await saveChatHistory(userId, textMsg, "assistant");
              await sendSimpleTextMessage(userId, "ลูกค้าสนใจอยากปรึกษาด้านไหนดีคะ");
              continue;
            } 
            else if (textMsg === "แอดมิน THAYA ยินดีดูแลลูกค้าค่ะ") {
              await setUserStatus(userId, true);
              await saveChatHistory(userId, textMsg, "assistant");
              await sendSimpleTextMessage(userId, "ขอบพระคุณที่ให้ THAYA ดูแลค่ะ");
              continue;
            } 
            else {
              // echo อื่น => ไม่ทำอะไร
              console.log("Skipping other echo");
              continue;
            }
          }

          // (B) ถ้าไม่ใช่ Echo => เป็นข้อความจาก “ลูกค้า”
          const userStatus = await getUserStatus(userId);
          const aiEnabled = userStatus.aiEnabled;

          // อัปเดต lastUserReplyAt
          await updateLastUserReplyAt(userId, new Date());

          if (textMsg && !attachments) {
            // ข้อความ Text
            console.log(`[DEBUG] Received text from userId=${userId}:`, textMsg);

            // บันทึกลง history (role=user)
            await saveChatHistory(userId, textMsg, "user");

            if (!aiEnabled) {
              // ถ้า AI ปิด => ไม่เรียก GPT ตอบ
              // แต่เรายังเรียกวิเคราะห์สถานะด้วย gpt-4o-mini ได้ (ถ้าต้องการ) 
              await analyzeConversationForStatusChange(userId);
              continue;
            }

            // AI เปิด => สร้างคำตอบ
            const history = await getChatHistory(userId);
            const systemInstructions = buildSystemInstructions();
            const assistantMsg = await getAssistantResponse(systemInstructions, history, textMsg);

            // บันทึกบทสนทนา assistant
            await saveChatHistory(userId, assistantMsg, "assistant");

            // ตรวจว่ามีข้อมูลออเดอร์หรือไม่
            await detectAndSaveOrder(userId, assistantMsg);

            // ส่งข้อความกลับ
            await sendTextMessage(userId, assistantMsg);

            // วิเคราะห์สถานะด้วย gpt-4o-mini
            await analyzeConversationForStatusChange(userId);

          } else if (attachments && attachments.length > 0) {
            // ข้อความแนบไฟล์ (image, video, etc.)
            console.log("[DEBUG] Received attachments from user:", attachments);

            // สร้าง userContentArray
            let userContentArray = [];
            for (const att of attachments) {
              if (att.type === 'image') {
                userContentArray.push({
                  type: "image_url",
                  url: att.payload.url
                });
              } else if (att.type === 'video') {
                userContentArray.push({
                  type: "video_url",
                  url: att.payload.url
                });
              } else {
                userContentArray.push({
                  type: att.type,
                  url: att.payload.url
                });
              }
            }

            // บันทึกลง history (role=user)
            await saveChatHistory(userId, userContentArray, "user");

            if (!aiEnabled) {
              // ไม่เรียก GPT
              await analyzeConversationForStatusChange(userId);
              continue;
            }

            // AI เปิด => เรียก GPT สร้างคำตอบ
            const history = await getChatHistory(userId);
            const systemInstructions = buildSystemInstructions();
            const assistantMsg = await getAssistantResponse(systemInstructions, history, userContentArray);

            // บันทึก assistant
            await saveChatHistory(userId, assistantMsg, "assistant");

            // ตรวจ order
            await detectAndSaveOrder(userId, assistantMsg);

            // ส่งข้อความ
            await sendTextMessage(userId, assistantMsg);

            // วิเคราะห์สถานะ
            await analyzeConversationForStatusChange(userId);

          } else {
            // ไม่มี text / ไม่มีไฟล์แนบ
            console.log(">> [Webhook] Received empty message:", webhookEvent);
          }
        } else {
          console.log(">> [Webhook] Received event but not text/attachment:", webhookEvent);
        }

      } // end for (entry.messaging)
    } // end for (req.body.entry)

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

    // (NEW) เริ่มฟังก์ชัน Scheduler เพื่อติดตามลูกค้าทุก 1 นาที
    startFollowupScheduler();

    console.log("[DEBUG] Startup completed. Ready to receive webhooks.");
  } catch (err) {
    console.error("Startup error:", err);
  }
});
