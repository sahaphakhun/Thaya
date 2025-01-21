/*******************************************************
 * ตัวอย่างโค้ด Node.js + Express เชื่อม FB Messenger, 
 * GPT, MongoDB และ 2 Google Sheets คนละไฟล์
 *******************************************************/

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const util = require('util');
const requestPost = util.promisify(request.post);
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

// สำหรับ GPT Parser Model (แยกเป็น gpt-4o-mini หรือ gpt-3.5 ก็ได้)
const GPT_PARSER_MODEL = "gpt-4o-mini";  // เปลี่ยนชื่อโมเดลได้ตามต้องการ

// ───────────────────────────────────────────────────────────
// หากมีการเชื่อมต่อ Google Docs (เพื่ออ่าน systemInstructions)
const GOOGLE_CLIENT_EMAIL = "aitar-888@eminent-wares-446512-j8.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGhyeINArKZgaV\nitEcK+o89ilPYeRNTNZgJT7VNHB5hgNLLeAcFLJ7IlCIqTLMoJEnnoDQil6aKaz8\nExVL83uSXRrzk4zQvtt3tIP31+9wOCb9D4ZGWfVP1tD0qdD4WJ1qqg1j1/8879pH\nUeQGEMuCnyVbcQ3GbYQjyYb3wEz/Qv7kMVggF+MIaGGw2NQwM0XcufSFtyxvvX2S\nb8uGc1A8R+Dn/tmcgMODhbtEgcMg6yXI5Y26MPfDjVrEbk0lfCr7IGFJX4ASYeKl\n0jhm0RGb+aya2cb55auLN3VPO5MQ+cOp8gHBf5GiC/YgF1gbRgF5b7LgmENBxSfH\nb3WVQodLAgMBAAECggEACKB14M7LdekXZHyAQrZL0EitbzQknLv33Xyw2B3rvJ7M\nr4HM/nC4eBj7y+ciUc8GZQ+CWc2GzTHTa66+mwAia1qdYbPp3LuhGM4Leq5zn/o+\nA3rJuG6PS4qyUMy89msPXW5fSj/oE535QREiFKYP2dtlia2GI4xoag+x9uZwfMUO\nWKEe7tiUoZQEiGhwtjLq9lyST4kGGmlhNee9OyhDJcw4uCt8Cepr++hMDleWUF6c\nX0nbGmoSS0sZ5Boy8ATMhw/3luaOAlTUEz/nVDvbbWlNL9etwLKiAVw+AQXsPHNW\nNWF7gyEIsEi0qSM3PtA1X7IdReRXHqmfiZs0J3qSQQKBgQD1+Yj37Yuqj8hGi5PY\n+M0ieMdGcbUOmJsM1yUmBMV4bfaTiqm504P6DIYAqfDDWeozcHwcdpG1AfFAihEi\nh6lb0qRk8YaGbzvac8mWhwo/jDA5QB97fjFa6uwtlewZ0Er/U3QmOeVVnVC1y1b0\nrbJD5yjvI3ve+gpwAz0glpIMiwKBgQDOnpD7p7ylG4NQunqmzzdozrzZP0L6EZyE\n141st/Hsp9rtO9/ADuH6WhpirQ516l5LLv7mLPA8S9CF/cSdWF/7WlxBPjM8WRs9\nACFNBJIwUfjzPnvECmtsayzRlKuyCAspnNSkzgtdtvf2xI82Z3BGov9goZfu+D4A\n36b1qXsIQQKBgQCO1CojhO0vyjPKOuxL9hTvqmBUWFyBMD4AU8F/dQ/RYVDn1YG+\npMKi5Li/E+75EHH9EpkO0g7Do3AaQNG4UjwWVJcfAlxSHa8Mp2VsIdfilJ2/8KsX\nQ2yXVYh04/Rn/No/ro7oT4AKmcGu/nbstxuncEgFrH4WOOzspATPsn72BwKBgG5N\nBAT0NKbHm0B7bIKkWGYhB3vKY8zvnejk0WDaidHWge7nabkzuLtXYoKO9AtKxG/K\ndNUX5F+r8XO2V0HQLd0XDezecaejwgC8kwp0iD43ZHkmQBgVn+dPB6wSe94coSjj\nyjj4reSnipQ3tmRKsAtldIN3gI5YA3Gf85dtlHqBAoGAD5ePt7cmu3tDZhA3A8f9\no8mNPvqz/WGs7H2Qgjyfc3jUxEGhVt1Su7J1j+TppfkKtJIDKji6rVA9oIjZtpZT\ngxnU6hcYuiwbLh3wGEFIjP1XeYYILudqfWOEbwnxD1RgMkCqfSHf/niWlfiH6p3F\ndnBsLY/qXdKfS/OXyezAm4M=\n-----END PRIVATE KEY-----\n";

// (ตัวอย่าง) Google Doc ID สำหรับดึง System Instructions
const GOOGLE_DOC_ID = "1IDvCXWa_5QllMTKrVSvhLRQPNNGkYgxb8byaDGGEhyU"; 
// ───────────────────────────────────────────────────────────

// *** ข้อความบอกว่ามี 2 ไฟล์ Google Sheets คนละไฟล์ ***

// 1) ไฟล์แรก: สำหรับ INSTRUCTIONS (ห้ามลบออกหรือแก้ไข)
const INSTRUCTIONS_SPREADSHEET_ID = "1esN_P6JuPzYUGesR60zVuIGeuvSnRM1hlyaxCJbhI_c";  

// 2) ไฟล์ที่สอง: สำหรับบันทึก “ออเดอร์” (ID ตามที่ให้มา)
const ORDERS_SPREADSHEET_ID = "1f783DDFR0ZZDM4wG555Zpwmq6tQ2e9tWT28H0qRBPhU";
// ในไฟล์นี้มีแท็บชื่อว่า “ชีต1” และจะเริ่มเขียนข้อมูลตั้งแต่แถว A2
const ORDER_SHEET_NAME = "ชีต1";
const ORDER_START_RANGE = "A2"; // เริ่มบันทึกที่ A2

// ====================== 2) MongoDB ======================
let mongoClient = null;

/**
 * connectDB: เชื่อมต่อ MongoDB แบบ global
 */
async function connectDB() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    console.log("MongoDB connected (global).");
  }
  return mongoClient;
}

/**
 * getChatHistory: ดึงประวัติแชทของ userId จาก collection "chat_history"
 */
async function getChatHistory(userId) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("chat_history");
  const chats = await coll.find({ senderId: userId }).sort({ timestamp: 1 }).toArray();
  
  // map ข้อความให้อยู่ในรูป { role, content } ที่เหมาะสมกับ GPT
  return chats.map(ch => {
    try {
      const parsed = JSON.parse(ch.content);
      return normalizeRoleContent(ch.role, parsed);
    } catch (err) {
      return normalizeRoleContent(ch.role, ch.content);
    }
  });
}

/**
 * normalizeRoleContent: บังคับ content ให้เป็น string หรือ array สำหรับ GPT
 */
function normalizeRoleContent(role, content) {
  if (typeof content === "string") {
    return { role, content };
  }
  if (Array.isArray(content)) {
    return { role, content };
  }
  return { role, content: JSON.stringify(content) };
}

/**
 * saveChatHistory: บันทึก userMsg และ assistantMsg ลง MongoDB
 */
async function saveChatHistory(userId, userMsg, assistantMsg) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("chat_history");

  let userMsgToSave = typeof userMsg === "string" ? userMsg : JSON.stringify(userMsg);

  await coll.insertOne({
    senderId: userId,
    role: "user",
    content: userMsgToSave,
    timestamp: new Date(),
  });

  await coll.insertOne({
    senderId: userId,
    role: "assistant",
    content: assistantMsg,
    timestamp: new Date(),
  });
}

/**
 * getUserStatus: เก็บสถานะ aiEnabled ของ user
 */
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

/**
 * setUserStatus: เปิด/ปิด AI สำหรับ userId
 */
async function setUserStatus(userId, aiEnabled) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("active_user_status");

  await coll.updateOne(
    { senderId: userId },
    { $set: { aiEnabled, updatedAt: new Date() } },
    { upsert: true }
  );
}

/**
 * setUserPurchaseStatus: บันทึก/อัปเดตสถานะการสั่งซื้อ เช่น "ordered", "pending", "cancelled"
 */
async function setUserPurchaseStatus(userId, purchaseStatus) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("active_user_status");

  await coll.updateOne(
    { senderId: userId },
    { $set: { purchaseStatus, purchaseStatusUpdatedAt: new Date() } },
    { upsert: true }
  );
}


// ====================== 3) ดึง systemInstructions จาก Google Docs ======================
let googleDocInstructions = "";

/**
 * fetchGoogleDocInstructions: ดึงข้อความทั้งหมดจาก Google Doc (GOOGLE_DOC_ID)
 */
async function fetchGoogleDocInstructions() {
  try {
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
    console.log("Fetched Google Doc instructions OK.");
  } catch (err) {
    console.error("Failed to fetch systemInstructions:", err);
    googleDocInstructions = "Error fetching system instructions.";
  }
}


// ====================== 4) Google Sheets: 2 ไฟล์ (Instructions, Orders) ======================
/**
 * getSheetsApi: คืนค่า client สำหรับ Google Sheets API
 */
async function getSheetsApi() {
  const auth = new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

/**
 * appendToOrderSheet: เพิ่มข้อมูลลงไฟล์ที่สอง (ORDERS_SPREADSHEET_ID), ในแท็บ "ชีต1"
 */
async function appendToOrderSheet(rowData) {
  try {
    const sheets = await getSheetsApi();
    const range = `${ORDER_SHEET_NAME}!${ORDER_START_RANGE}`; 
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: ORDERS_SPREADSHEET_ID,
      range: range, 
      valueInputOption: 'USER_ENTERED',  // หรือ 'RAW'
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [ rowData ]
      }
    });
    console.log("Append order row to Google Sheet success:", rowData);
    return res.data;
  } catch (err) {
    console.error("Failed to append data to Order Sheet:", err);
  }
}

/**
 * ถ้าต้องการอ่านค่า instructions จากไฟล์แรก (INSTRUCTIONS_SPREADSHEET_ID)
 * ตัวอย่างการ read: readInstructionsFromSheet1()
 * สมมติในไฟล์แรกเรามีแท็บชื่อ "INSTRUCTIONS" และ range "A1:B10"
 */
async function readInstructionsFromSheet1() {
  try {
    const sheets = await getSheetsApi();
    const range = `INSTRUCTIONS!A1:B10`;
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: INSTRUCTIONS_SPREADSHEET_ID,
      range
    });
    const rows = resp.data.values;
    if (!rows || rows.length === 0) {
      console.log("No instruction data found in sheet1.");
      return [];
    }
    return rows;
  } catch (err) {
    console.error("Failed to read instructions sheet (sheet1):", err);
    return [];
  }
}


// ====================== 5) สร้าง systemInstructions ผสาน Docs + (option) ข้อมูลจากชีต ======================
let sheetJSON = []; // ถ้าต้องการเอาข้อมูลจาก sheet แรกมาประมวลผล

function buildSystemInstructions() {
  // ตัวอย่าง: แปลง sheetJSON เป็น string
  const sheetsDataString = JSON.stringify(sheetJSON, null, 2);

  const finalSystemInstructions = `
คุณคือ THAYA Chatbot
Below is instructions from the Google Doc:
---
${googleDocInstructions}

Below is additional data from (some) Google Sheet:
---
${sheetsDataString}

Rules:
- (ระบุเงื่อนไขเกี่ยวกับรูป, privacy, ฯลฯ)
  `.trim();

  return finalSystemInstructions;
}


// ====================== 6) เรียก GPT หลัก (ตอบแชทปกติ) ======================
async function getAssistantResponse(systemInstructions, history, userContent) {
  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // รวม system, history, userContent
    const messages = [
      { role: "system", content: systemInstructions },
      ...history
    ];
    messages.push(normalizeRoleContent("user", userContent));

    // เรียก GPT
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // หรือโมเดลอื่น เช่น "gpt-3.5-turbo"
      messages,
      temperature: 0.1,
    });

    let assistantReply = response.choices[0].message.content;
    if (typeof assistantReply !== "string") {
      assistantReply = JSON.stringify(assistantReply);
    }

    // ป้องกัน [cut] ซ้ำซ้อน
    assistantReply = assistantReply.replace(/\[cut\]{2,}/g, "[cut]");
    const cutList = assistantReply.split("[cut]");
    if (cutList.length > 10) {
      assistantReply = cutList.slice(0, 10).join("[cut]");
    }

    return assistantReply.trim();
  } catch (error) {
    console.error("Error getAssistantResponse:", error);
    return "ขออภัยค่ะ ระบบขัดข้องชั่วคราว ไม่สามารถตอบได้ในขณะนี้";
  }
}


// ====================== 7) ฟังก์ชัน GPT/Regex เพื่อ parse สรุปออเดอร์ ======================
async function parseOrderSummaryWithGPT(text) {
  // ตัวอย่าง prompt สำหรับ GPT ย่อย
  const parserOpenAI = new OpenAI({ apiKey: OPENAI_API_KEY });
  const systemPrompt = `
    You are a parser for THAYA's order summary in Thai.
    The text may look like:
    "สรุปยอดการสั่งซื้อ
     - โปรโมชั่น: ...
     - ชื่อ: ...
     - ที่อยู่: ...
     - เบอร์โทร: ...
     💰 ราคารวม: ... บาท
     วิธีชำระ: ..."
    If any field is missing or the text is not an order summary, return an empty JSON.
    Output a JSON object with keys:
      {
        "promotion": string,
        "customerName": string,
        "address": string,
        "phone": string,
        "totalPrice": string,
        "paymentMethod": string
      }
  `;

  const userPrompt = `
    ข้อความสรุป:
    ${text}

    ให้ตอบเป็น JSON ตรงตามโครงสร้างที่กำหนดเท่านั้น เช่น:
    {
      "promotion": "xxxxx",
      "customerName": "xxxxx",
      "address": "xxxxx",
      "phone": "xxxxx",
      "totalPrice": "xxx",
      "paymentMethod": "xxxxx"
    }
  `;

  try {
    const resp = await parserOpenAI.chat.completions.create({
      model: GPT_PARSER_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
    });

    const rawJson = resp.choices[0].message.content;
    console.log("parseOrderSummaryWithGPT rawJson:", rawJson);

    const parsed = JSON.parse(rawJson);
    return parsed;
  } catch (e) {
    console.error("parseOrderSummaryWithGPT error:", e);
    return {};
  }
}

/**
 * checkAndSaveOrderSummary:
 * - ตรวจว่า assistantMsg มี "สรุปยอดการสั่งซื้อ" หรือไม่
 * - ถ้ามี => parse => บันทึกลงชีต => อัปเดต purchaseStatus ใน MongoDB
 */
async function checkAndSaveOrderSummary(assistantMsg, userId) {
  if (!assistantMsg.includes("สรุปยอดการสั่งซื้อ")) {
    return; // ไม่เจอ keyword ก็ข้าม
  }

  // เรียก GPT Parser
  const orderData = await parseOrderSummaryWithGPT(assistantMsg);

  // ถ้าไม่เจออะไรเลย (เคสโมเดลไม่ส่งคีย์ที่เราต้องการ)
  if (
    !orderData.customerName &&
    !orderData.address &&
    !orderData.totalPrice
  ) {
    return;
  }

  // สร้าง rowData
  // ตัวอย่างคอลัมน์: [userId, timestamp, promotion, customerName, address, phone, totalPrice, paymentMethod]
  const now = new Date().toLocaleString();
  const rowData = [
    userId,
    now,
    orderData.promotion || "",
    orderData.customerName || "",
    orderData.address || "",
    orderData.phone || "",
    orderData.totalPrice || "",
    orderData.paymentMethod || ""
  ];

  // Append ลงไฟล์สำหรับบันทึกออเดอร์
  await appendToOrderSheet(rowData);

  // set สถานะ user ว่า "ordered"
  await setUserPurchaseStatus(userId, "ordered");
}


// ====================== 8) ฟังก์ชันส่งข้อความกลับ Facebook ======================
async function sendSimpleTextMessage(userId, text) {
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
    console.log("ส่งข้อความสำเร็จ!", text);
  } catch (err) {
    console.error("ไม่สามารถส่งข้อความ:", err);
  }
}

async function sendImageMessage(userId, imageUrl) {
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
    console.log("ส่งรูปภาพสำเร็จ!", imageUrl);
  } catch (err) {
    console.error("ไม่สามารถส่งรูปภาพ:", err);
  }
}

async function sendVideoMessage(userId, videoUrl) {
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
    console.log("ส่งวิดีโอสำเร็จ!", videoUrl);
  } catch (err) {
    console.error("ไม่สามารถส่งวิดีโอ:", err);
  }
}

/**
 * sendTextMessage: ตัดเป็น segment ตาม [cut], ส่งรูป/วิดีโอ, แล้วส่ง text 
 */
async function sendTextMessage(userId, response) {
  response = response.replace(/\[cut\]{2,}/g, "[cut]");
  let segments = response.split("[cut]").map(s => s.trim());
  segments = segments.filter(seg => seg.length > 0);
  if (segments.length > 10) {
    segments = segments.slice(0, 10);
  }

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
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


// ====================== 9) Webhook Routes & Startup ======================

// กัน mid ซ้ำ
const processedMessageIds = new Set();

// Verify webhook
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Webhook (POST)
app.post('/webhook', async (req, res) => {
  if (req.body.object === 'page') {
    for (const entry of req.body.entry) {
      if (!entry.messaging || entry.messaging.length === 0) {
        continue;
      }

      for (const webhookEvent of entry.messaging) {
        // skip echo/delivery/read
        if (
          webhookEvent.message?.is_echo ||
          webhookEvent.delivery ||
          webhookEvent.read ||
          webhookEvent.message?.app_id
        ) {
          console.log("Skipping echo/delivery/read/app_id event");
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

        // หา userId
        const pageId = entry.id;
        let userId = (webhookEvent.sender.id === pageId)
          ? webhookEvent.recipient.id
          : webhookEvent.sender.id;

        // เช็คสถานะ aiEnabled
        const userStatus = await getUserStatus(userId);
        const aiEnabled = userStatus.aiEnabled;

        // ประมวลผลข้อความ
        if (webhookEvent.message?.text) {
          const userMsg = webhookEvent.message.text;

          // ตัวอย่างปุ่มเปิด/ปิด AI
          if (userMsg === "แอดมิน THAYA รอให้คำปรึกษาค่ะ") {
            await setUserStatus(userId, false);
            await sendSimpleTextMessage(userId, "ลูกค้าสนใจอยากปรึกษาด้านไหนดีคะ");
            await saveChatHistory(userId, userMsg, "ลูกค้าสนใจอยากปรึกษาด้านไหนดีคะ");
            continue;
          } else if (userMsg === "แอดมิน THAYA ยินดีดูแลลูกค้าค่ะ") {
            await setUserStatus(userId, true);
            await sendSimpleTextMessage(userId, "ขอบพระคุณที่ให้ THAYA ดูแลค่ะ");
            await saveChatHistory(userId, userMsg, "ขอบพระคุณที่ให้ THAYA ดูแลค่ะ");
            continue;
          }

          // ถ้า AI ปิด
          if (!aiEnabled) {
            await saveChatHistory(userId, userMsg, "");
            continue;
          }

          // AI เปิด => เรียก GPT
          const history = await getChatHistory(userId);
          const systemInstructions = buildSystemInstructions();
          const assistantMsg = await getAssistantResponse(systemInstructions, history, userMsg);

          // บันทึก
          await saveChatHistory(userId, userMsg, assistantMsg);

          // เช็กสรุปยอด -> ถ้ามี -> บันทึกชีต
          await checkAndSaveOrderSummary(assistantMsg, userId);

          // ส่งข้อความ
          await sendTextMessage(userId, assistantMsg);

        } else if (webhookEvent.message?.attachments) {
          // เคสไฟล์แนบ (รูป, วิดีโอ, ฯลฯ)
          const attachments = webhookEvent.message.attachments;
          let userContentArray = [{
            type: "text",
            text: "ผู้ใช้ส่งไฟล์แนบ"
          }];

          for (const att of attachments) {
            if (att.type === 'image') {
              userContentArray.push({
                type: "image_url",
                image_url: { url: att.payload.url, detail: "auto" }
              });
            } else if (att.type === 'video') {
              userContentArray.push({
                type: "video_url",
                video_url: { url: att.payload.url, detail: "auto" }
              });
            } else {
              userContentArray.push({
                type: "text",
                text: `ไฟล์แนบประเภท: ${att.type} (ยังไม่รองรับ)`,
              });
            }
          }

          // ถ้า AI ปิด
          if (!aiEnabled) {
            await saveChatHistory(userId, userContentArray, "");
            continue;
          }

          const history = await getChatHistory(userId);
          const systemInstructions = buildSystemInstructions();
          const assistantMsg = await getAssistantResponse(systemInstructions, history, userContentArray);

          await saveChatHistory(userId, userContentArray, assistantMsg);

          // เช็กสรุปยอด -> บันทึกชีต
          await checkAndSaveOrderSummary(assistantMsg, userId);

          await sendTextMessage(userId, assistantMsg);
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
    // เชื่อมต่อ DB
    await connectDB();
    // ดึง instructions จาก Google Doc
    await fetchGoogleDocInstructions();
    // ตัวอย่าง: ถ้าจะอ่านชีต instruction ไฟล์แรก แล้วเก็บไว้ใน sheetJSON
    // const rows = await readInstructionsFromSheet1();
    // console.log("Rows from instructions sheet:", rows);
    // sheetJSON = someTransformFunction(rows) // (ถ้าต้องการ)

    console.log("Startup completed. Ready to receive webhooks.");
  } catch (err) {
    console.error("Startup error:", err);
  }
});
