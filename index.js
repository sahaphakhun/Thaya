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
const SPREADSHEET_ID = "1esN_P6JuPzYUGesR60zVuIGeuvSnRM1hlyaxCJbhI_c";
const SHEET_RANGE = "ชีต1!A2:B28";  

// ------------------- (C) Google Sheet สำหรับ "บันทึกออเดอร์" (ใหม่) -------------------
const ORDERS_SPREADSHEET_ID = "1f783DDFR0ZZDM4wG555Zpwmq6tQ2e9tWT28H0qRBPhU";
const SHEET_NAME_FOR_ORDERS = "บันทึกออเดอร์";
const ORDERS_RANGE = `${SHEET_NAME_FOR_ORDERS}!A2:H`; 

// (NEW) สำหรับ Follow-up
const FOLLOWUP_SHEET_RANGE = "ติดตามลูกค้า!A2:B";

// ====================== 2) MongoDB ======================
let mongoClient = null;

async function connectDB() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    console.log("MongoDB connected (global).");
  }
  return mongoClient;
}

function normalizeRoleContent(role, content) {
  if (typeof content === "string") {
    return { role, content };
  }
  if (Array.isArray(content)) {
    return { role, content: JSON.stringify(content) };
  }
  return { role, content: JSON.stringify(content) };
}

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

/*******************************************************
 * ตัวอย่างฟังก์ชัน getCustomerOrderStatus แก้ไขให้บันทึก field ได้แน่นอน
 *******************************************************/
async function getCustomerOrderStatus(userId) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("customer_order_status");

  let doc = await coll.findOne({ senderId: userId });
  if (!doc) {
    // *ไม่เคยมี doc นี้ => สร้างใหม่*
    doc = {
      senderId: userId,
      orderStatus: "pending",       // <--- กำหนดค่าเริ่มต้น
      followupIndex: 0,            // <--- กำหนดค่าเริ่มต้น
      lastUserReplyAt: new Date(), // <--- กำหนดค่าเริ่มต้น
      lastFollowupAt: null,
      updatedAt: new Date()
    };
    await coll.insertOne(doc);
    return doc;
  } else {
    // *มี doc แล้ว แต่บางทีขาด field ที่เราต้องการ => อัปเดตใส่ให้*
    let updateNeeded = false;
    let updateObj = {};

    // ถ้า doc ไม่มี field orderStatus เลย หรือเป็น undefined => เซ็ตเป็น 'pending'
    if (!('orderStatus' in doc)) {
      updateObj.orderStatus = 'pending';
      updateNeeded = true;
    }

    // ถ้า doc ไม่มี followupIndex หรือไม่ใช่ number => เซ็ตเป็น 0
    if (typeof doc.followupIndex !== 'number') {
      updateObj.followupIndex = 0;
      updateNeeded = true;
    }

    // ถ้า doc ไม่มี lastUserReplyAt => เซ็ตเป็นตอนนี้
    if (!doc.lastUserReplyAt) {
      updateObj.lastUserReplyAt = new Date();
      updateNeeded = true;
    }

    // ถ้า doc ไม่มี lastFollowupAt (หรือฟิลด์หายไป) => เซ็ตเป็น null
    if (!('lastFollowupAt' in doc)) {
      updateObj.lastFollowupAt = null;
      updateNeeded = true;
    }

    if (updateNeeded) {
      updateObj.updatedAt = new Date();
      // ทำการ updateOne
      await coll.updateOne(
        { senderId: userId },
        { $set: updateObj }
      );
      // รวมค่าที่อัปเดตเข้ากับตัวแปร doc
      Object.assign(doc, updateObj);
    }

    return doc;
  }
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

// ====================== 6) GPT ตอบลูกค้า (ใช้ gpt-4o-mini) ======================
async function getAssistantResponse(systemInstructions, history, userContent) {
  try {
    console.log("[DEBUG] getAssistantResponse => calling GPT (gpt-4o-mini)...");
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const messages = [
      { role: "system", content: systemInstructions },
      ...history
    ];

    let finalUserMessage = normalizeRoleContent("user", userContent);
    messages.push(finalUserMessage);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2,
    });

    let assistantReply = response.choices[0].message.content;
    if (typeof assistantReply !== "string") {
      assistantReply = JSON.stringify(assistantReply);
    }

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

async function sendTextMessage(userId, response) {
  console.log("[DEBUG] sendTextMessage => raw response:", response);

  response = response.replace(/\[cut\]{2,}/g, "[cut]");
  let segments = response.split("[cut]").map(s => s.trim()).filter(s => s);
  if (segments.length > 10) segments = segments.slice(0, 10);

  for (let segment of segments) {
    const imageRegex = /\[SEND_IMAGE:(https?:\/\/[^\s]+)\]/g;
    const videoRegex = /\[SEND_VIDEO:(https?:\/\/[^\s]+)\]/g;

    const images = [...segment.matchAll(imageRegex)];
    const videos = [...segment.matchAll(videoRegex)];

    let textPart = segment
      .replace(imageRegex, '')
      .replace(videoRegex, '')
      .trim();

    for (const match of images) {
      const imageUrl = match[1];
      await sendImageMessage(userId, imageUrl);
    }

    for (const match of videos) {
      const videoUrl = match[1];
      await sendVideoMessage(userId, videoUrl);
    }

    if (textPart) {
      await sendSimpleTextMessage(userId, textPart);
    }
  }
}

// ====================== (NEW) ฟังก์ชัน getFacebookUserName ======================
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

// ====================== 8) ตรวจจับออเดอร์จาก Assistant ======================
async function extractOrderDataWithGPT(assistantMsg) {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const sysPrompt = `
คุณเป็นโปรแกรมตรวจสอบว่าข้อความ AssistantMsg มีข้อมูลออเดอร์/ที่อยู่หรือไม่
ถ้ามี ให้ดึง:
- "customer_name"
- "address"
- "phone"
- "promotion"
- "total"
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
หากพบแค่บางส่วนให้กรอกเฉพาะที่เจอ ที่เหลือ "" 
ห้ามมีข้อความอื่นนอกจาก JSON
`.trim();

  try {
    console.log("[DEBUG] extractOrderDataWithGPT => calling GPT (gpt-4o-mini)...");
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
  const fbName = await getFacebookUserName(userId);
  console.log("[DEBUG] Fetched Facebook name:", fbName);

  const parsed = await extractOrderDataWithGPT(assistantMsg);
  if (!parsed.is_found) {
    console.log("[DEBUG] detectAndSaveOrder: No order data found => skip saving");
    return;
  }

  parsed.fb_name = fbName || "";
  await saveOrderToSheet(parsed);

  const statusColl = await getCustomerOrderStatus(userId);
  if (statusColl.orderStatus !== "alreadyPurchased") {
    await updateCustomerOrderStatus(userId, "ordered");
  }
}

// ====================== 9) วิเคราะห์สถานะด้วย gpt-4o-mini ======================
async function analyzeConversationForStatusChange(userId) {
  try {
    console.log("[DEBUG] analyzeConversationForStatusChange => userId=", userId);
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

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
`.trim();

    const messages = [
      { role: "system", content: sysPrompt },
      { role: "user", content: conversationText }
    ];

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

    const doc = await getCustomerOrderStatus(userId);
    const oldStatus = doc.orderStatus || "pending";

    if (oldStatus === "alreadyPurchased") {
      console.log("[DEBUG] oldStatus=alreadyPurchased => do not revert");
      return;
    }
    if (oldStatus === "ordered" && newStatus !== "alreadyPurchased") {
      if (newStatus === "alreadyPurchased") {
        await updateCustomerOrderStatus(userId, "alreadyPurchased");
      }
      return;
    }
    if (oldStatus === "ปฏิเสธรับ" && newStatus !== "alreadyPurchased") {
      return;
    }

    if (oldStatus === "pending" && newStatus !== oldStatus) {
      await updateCustomerOrderStatus(userId, newStatus);
    }
    if (newStatus === "alreadyPurchased" && oldStatus !== "alreadyPurchased") {
      await updateCustomerOrderStatus(userId, "alreadyPurchased");
    }

  } catch (err) {
    console.error("analyzeConversationForStatusChange error:", err);
  }
}

// ====================== 10) Scheduler สำหรับติดตามลูกค้า (มี debug log) ======================
function startFollowupScheduler() {
  setInterval(async () => {
    console.log("=== [Scheduler DEBUG] startFollowupScheduler triggered at", new Date().toISOString(), "===");

    if (!followupData || followupData.length === 0) {
      console.log("[Scheduler DEBUG] followupData is empty => no follow-up");
      return;
    }

    const client = await connectDB();
    const db = client.db("chatbot");
    const coll = db.collection("customer_order_status");

    // หา user ที่สถานะ pending
    const now = new Date();
    const pendingUsers = await coll.find({
      orderStatus: "pending",
      followupIndex: { $lt: followupData.length }
    }).toArray();

    console.log(`[Scheduler DEBUG] Found ${pendingUsers.length} pending user(s) for follow-up check.`);
    
    for (let userDoc of pendingUsers) {
      const userId = userDoc.senderId;
      const idx = userDoc.followupIndex || 0;

      const lastReply = userDoc.lastUserReplyAt 
          ? new Date(userDoc.lastUserReplyAt)
          : new Date(userDoc.updatedAt);

      const requiredMin = followupData[idx].time;
      const diffMs = now - lastReply;
      const diffMin = diffMs / 60000;

      console.log(`[Scheduler DEBUG] userId=${userId}, followupIndex=${idx}, requiredMin=${requiredMin}, diffMin=${diffMin.toFixed(2)}`);

      if (diffMin >= requiredMin) {
        // ส่ง follow-up
        const msg = followupData[idx].message;
        console.log(`[FOLLOWUP] Sending followup #${idx+1} to userId=${userId}`);

        await sendTextMessage(userId, msg);
        await saveChatHistory(userId, msg, "assistant");

        await updateFollowupData(userId, idx + 1, new Date());
      }
    }

  }, 60000); // 1 นาที
}

// ====================== 11) Webhook Routes & Startup ======================
const processedMessageIds = new Set();

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
  if (req.body.object === 'page') {
    for (const entry of req.body.entry) {
      if (!entry.messaging || entry.messaging.length === 0) {
        continue;
      }

      const pageId = entry.id;

      for (const webhookEvent of entry.messaging) {
        if (webhookEvent.delivery || webhookEvent.read) {
          console.log("Skipping delivery/read event");
          continue;
        }

        if (webhookEvent.message && webhookEvent.message.mid) {
          const mid = webhookEvent.message.mid;
          if (processedMessageIds.has(mid)) {
            console.log("Skipping repeated mid:", mid);
            continue;
          } else {
            processedMessageIds.add(mid);
          }
        }

        let userId = (webhookEvent.sender.id === pageId)
          ? webhookEvent.recipient.id
          : webhookEvent.sender.id;

        if (webhookEvent.message) {
          const textMsg = webhookEvent.message.text || "";
          const isEcho = webhookEvent.message.is_echo === true;
          const attachments = webhookEvent.message.attachments;

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
              console.log("Skipping other echo");
              continue;
            }
          }

          const userStatus = await getUserStatus(userId);
          const aiEnabled = userStatus.aiEnabled;

          await updateLastUserReplyAt(userId, new Date());

          if (textMsg && !attachments) {
            console.log(`[DEBUG] Received text from userId=${userId}:`, textMsg);

            await saveChatHistory(userId, textMsg, "user");

            if (!aiEnabled) {
              await analyzeConversationForStatusChange(userId);
              continue;
            }

            const history = await getChatHistory(userId);
            const systemInstructions = buildSystemInstructions();
            const assistantMsg = await getAssistantResponse(systemInstructions, history, textMsg);

            await saveChatHistory(userId, assistantMsg, "assistant");

            await detectAndSaveOrder(userId, assistantMsg);

            await sendTextMessage(userId, assistantMsg);

            await analyzeConversationForStatusChange(userId);

          } else if (attachments && attachments.length > 0) {
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

            await saveChatHistory(userId, userContentArray, "user");

            if (!aiEnabled) {
              await analyzeConversationForStatusChange(userId);
              continue;
            }

            const history = await getChatHistory(userId);
            const systemInstructions = buildSystemInstructions();
            const assistantMsg = await getAssistantResponse(systemInstructions, history, userContentArray);

            await saveChatHistory(userId, assistantMsg, "assistant");

            await detectAndSaveOrder(userId, assistantMsg);

            await sendTextMessage(userId, assistantMsg);

            await analyzeConversationForStatusChange(userId);

          } else {
            console.log(">> [Webhook] Received empty message:", webhookEvent);
          }
        } else {
          console.log(">> [Webhook] Received event but not text/attachment:", webhookEvent);
        }
      }
    }
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// ====================== Start Server ======================
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);

  try {
    await connectDB();
    await fetchGoogleDocInstructions();

    const rows = await fetchSheetData(SPREADSHEET_ID, SHEET_RANGE);
    sheetJSON = transformSheetRowsToJSON(rows);

    await loadFollowupData();

    startFollowupScheduler();

    console.log("[DEBUG] Startup completed. Ready to receive webhooks.");
  } catch (err) {
    console.error("Startup error:", err);
  }
});
