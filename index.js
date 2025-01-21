/*******************************************************
 * ตัวอย่างโค้ดพร้อมใช้งาน (Express.js)
 * - ดึงชื่อ Facebook ลูกค้า
 * - ตรวจจับคีย์เวิร์ด "สรุปยอดการสั่งซื้อ" ในข้อความจากผู้ใช้
 * - ตอบด้วย GPT ตัวใหญ่
 * - ตรวจสอบข้อความ "assistant" ก่อนส่งออก ถ้ามีคำว่า "สรุปยอด" => ทำ Action เพิ่มได้
 * - บันทึกออเดอร์ลง Google Sheet + MongoDB
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

// เก็บใน Environment จริง ๆ
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN; 
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "AiDee_a4wfaw4";
const MONGO_URI = process.env.MONGO_URI;

// สำหรับ Google Docs, Sheets
const GOOGLE_CLIENT_EMAIL = "aitar-888@eminent-wares-446512-j8.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGhyeINArKZgaV\nitEcK+o89ilPYeRNTNZgJT7VNHB5hgNLLeAcFLJ7IlCIqTLMoJEnnoDQil6aKaz8\nExVL83uSXRrzk4zQvtt3tIP31+9wOCb9D4ZGWfVP1tD0qdD4WJ1qqg1j1/8879pH\nUeQGEMuCnyVbcQ3GbYQjyYb3wEz/Qv7kMVggF+MIaGGw2NQwM0XcufSFtyxvvX2S\nb8uGc1A8R+Dn/tmcgMODhbtEgcMg6yXI5Y26MPfDjVrEbk0lfCr7IGFJX4ASYeKl\n0jhm0RGb+aya2cb55auLN3VPO5MQ+cOp8gHBf5GiC/YgF1gbRgF5b7LgmENBxSfH\nb3WVQodLAgMBAAECggEACKB14M7LdekXZHyAQrZL0EitbzQknLv33Xyw2B3rvJ7M\nr4HM/nC4eBj7y+ciUc8GZQ+CWc2GzTHTa66+mwAia1qdYbPp3LuhGM4Leq5zn/o+\nA3rJuG6PS4qyUMy89msPXW5fSj/oE535QREiFKYP2dtlia2GI4xoag+x9uZwfMUO\nWKEe7tiUoZQEiGhwtjLq9lyST4kGGmlhNee9OyhDJcw4uCt8Cepr++hMDleWUF6c\nX0nbGmoSS0sZ5Boy8ATMhw/3luaOAlTUEz/nVDvbbWlNL9etwLKiAVw+AQXsPHNW\nNWF7gyEIsEi0qSM3PtA1X7IdReRXHqmfiZs0J3qSQQKBgQD1+Yj37Yuqj8hGi5PY\n+M0ieMdGcbUOmJsM1yUmBMV4bfaTiqm504P6DIYAqfDDWeozcHwcdpG1AfFAihEi\nh6lb0qRk8YaGbzvac8mWhwo/jDA5QB97fjFa6uwtlewZ0Er/U3QmOeVVnVC1y1b0\nrbJD5yjvI3ve+gpwAz0glpIMiwKBgQDOnpD7p7ylG4NQunqmzzdozrzZP0L6EZyE\n141st/Hsp9rtO9/ADuH6WhpirQ516l5LLv7mLPA8S9CF/cSdWF/7WlxBPjM8WRs9\nACFNBJIwUfjzPnvECmtsayzRlKuyCAspnNSkzgtdtvf2xI82Z3BGov9goZfu+D4A\n36b1qXsIQQKBgQCO1CojhO0vyjPKOuxL9hTvqmBUWFyBMD4AU8F/dQ/RYVDn1YG+\npMKi5Li/E+75EHH9EpkO0g7Do3AaQNG4UjwWVJcfAlxSHa8Mp2VsIdfilJ2/8KsX\nQ2yXVYh04/Rn/No/ro7oT4AKmcGu/nbstxuncEgFrH4WOOzspATPsn72BwKBgG5N\nBAT0NKbHm0B7bIKkWGYhB3vKY8zvnejk0WDaidHWge7nabkzuLtXYoKO9AtKxG/K\ndNUX5F+r8XO2V0HQLd0XDezecaejwgC8kwp0iD43ZHkmQBgVn+dPB6wSe94coSjj\nyjj4reSnipQ3tmRKsAtldIN3gI5YA3Gf85dtlHqBAoGAD5ePt7cmu3tDZhA3A8f9\no8mNPvqz/WGs7H2Qgjyfc3jUxEGhVt1Su7J1j+TppfkKtJIDKji6rVA9oIjZtpZT\ngxnU6hcYuiwbLh3wGEFIjP1XeYYILudqfWOEbwnxD1RgMkCqfSHf/niWlfiH6p3F\ndnBsLY/qXdKfS/OXyezAm4M=\n-----END PRIVATE KEY-----\n";
const GOOGLE_DOC_ID = "1IDvCXWa_5QllMTKrVSvhLRQPNNGkYgxb8byaDGGEhyU";
const SPREADSHEET_ID = "1f783DDFR0ZZDM4wG555Zpwmq6tQ2e9tWT28H0qRBPhU"; // ตัวอย่าง
const SHEET_RANGE = "ชีต1!A2:H";  // สมมติจะเขียนลงคอลัมน์ A-H

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
 * ฟังก์ชันดึงชื่อโปรไฟล์ผู้ใช้จาก Facebook Graph API
 * (ใช้ PSID -> เรียกขอ name)
 */
async function getFacebookUserName(userId) {
  try {
    const url = `https://graph.facebook.com/${userId}?fields=name&access_token=${PAGE_ACCESS_TOKEN}`;
    const res = await requestGet({ uri: url, json: true });
    if (res && res.body && res.body.name) {
      return res.body.name;
    }
    return "";
  } catch (err) {
    console.error("Failed to get FB user name:", err);
    return "";
  }
}

/**
 * normalizeRoleContent: บังคับ content ให้เป็น string หรือ array
 * ป้องกัน error เวลาส่งไป GPT
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

/** บันทึกข้อความ user และข้อความตอบ (assistant) ลง DB */
async function saveChatHistory(userId, userMsg, assistantMsg) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("chat_history");

  let userMsgToSave;
  if (typeof userMsg === "string") {
    userMsgToSave = userMsg;
  } else {
    userMsgToSave = JSON.stringify(userMsg);
  }

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

/** เก็บสถานะ aiEnabled ของแต่ละ userId (PSID) + ชื่อเฟซ */
async function getUserStatus(userId) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("active_user_status");

  let userStatus = await coll.findOne({ senderId: userId });
  if (!userStatus) {
    // ดึงชื่อจาก Facebook
    const fbName = await getFacebookUserName(userId);

    userStatus = { 
      senderId: userId, 
      name: fbName || "",
      aiEnabled: true, 
      updatedAt: new Date()
    };
    await coll.insertOne(userStatus);
  } else {
    // ถ้ายังไม่มี name ใน DB ลองดึงใหม่
    if (!userStatus.name) {
      const fbName = await getFacebookUserName(userId);
      if (fbName) {
        await coll.updateOne(
          { senderId: userId },
          { $set: { name: fbName } }
        );
        userStatus.name = fbName;
      }
    }
  }
  return userStatus;
}

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

// ====================== 3) ดึง systemInstructions จาก Google Docs ======================
let googleDocInstructions = "";

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

// ====================== 4) ดึงข้อมูลจาก Google Sheets + แปลงเป็น JSON ======================
async function getSheetsApi() {
  const sheetsAuth = new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: sheetsAuth });
}

async function fetchSheetData(spreadsheetId, range) {
  try {
    const sheetsApi = await getSheetsApi();
    const response = await sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];
    return rows;
  } catch {
    return [];
  }
}

function parseSheetRowsToObjects(rows) {
  if (!rows || rows.length < 2) return [];
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

// ====================== 5) สร้าง systemInstructions (ผสาน Docs + Sheets) ======================
function buildSystemInstructions() {
  const sheetsDataString = JSON.stringify(sheetJSON, null, 2);

  const finalSystemInstructions = `
You are an AI chatbot for THAYA. 
Below are instructions from the Google Doc:
---
${googleDocInstructions}

Below is additional data from Google Sheets:
---
${sheetsDataString}

(Privacy & data usage policy here...)

Rules:
- Use the data above as reference for answering user questions.
- If not related, answer as usual.
`.trim();

  return finalSystemInstructions;
}

// ====================== 6) เรียก GPT (รองรับทั้งข้อความและรูป) ======================
async function getAssistantResponse(systemInstructions, history, userContent) {
  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const messages = [
      { role: "system", content: systemInstructions },
      ...history
    ];
    messages.push(normalizeRoleContent("user", userContent));

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.1,
    });

    let assistantReply = response.choices[0].message.content;
    if (typeof assistantReply !== "string") {
      assistantReply = JSON.stringify(assistantReply);
    }

    // ป้องกันวนลูป [cut]
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

// ====================== ฟังก์ชันส่งข้อความกลับ Facebook ======================
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
 * sendTextMessage: ส่งข้อความ (assistant) กลับหา user
 * พร้อมตรวจว่ามีคำว่า "สรุปยอด" ในข้อความบอทหรือไม่
 */
async function sendTextMessage(userId, response) {
  console.log(">>> sendTextMessage() raw response:", JSON.stringify(response));

  // (A) ตรงนี้เพิ่มการตรวจสอบ "สรุปยอด" ในข้อความที่บอทจะส่งออก
  if (response.includes("สรุปยอด")) {
    console.log(">>> [BOT MESSAGE CHECK] assistant's response includes 'สรุปยอด'.");

    // ตัวอย่าง: คุณอาจทำ Action เพิ่มเติม เช่น
    // await someFunctionToHandleBotSummary(userId, response);
    // หรือบันทึกลง DB, trigger อีเมล ฯลฯ
  }

  // (B) ส่วนแยก segment [cut] เหมือนเดิม
  response = response.replace(/\[cut\]{2,}/g, "[cut]");
  let segments = response.split("[cut]").map(s => s.trim());
  segments = segments.filter(seg => seg.length > 0);
  if (segments.length > 10) {
    segments = segments.slice(0, 10);
  }

  console.log(">>> segments:", segments.length, segments);

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    console.log(`>>> [Segment ${i+1}]`, JSON.stringify(segment));

    const imageRegex = /\[SEND_IMAGE:(https?:\/\/[^\s]+)\]/g;
    const videoRegex = /\[SEND_VIDEO:(https?:\/\/[^\s]+)\]/g;

    // จับลิงก์รูป/วิดีโอออกจากข้อความ
    const images = [...segment.matchAll(imageRegex)];
    const videos = [...segment.matchAll(videoRegex)];

    let textPart = segment
      .replace(imageRegex, '')
      .replace(videoRegex, '')
      .trim();

    // (1) ส่งรูป
    for (const match of images) {
      const imageUrl = match[1];
      await sendImageMessage(userId, imageUrl);
    }
    // (2) ส่งวิดีโอ
    for (const match of videos) {
      const videoUrl = match[1];
      await sendVideoMessage(userId, videoUrl);
    }
    // (3) ส่งข้อความตัวอักษร
    if (textPart) {
      await sendSimpleTextMessage(userId, textPart);
    }
  }
}

// ====================== 7) ฟังก์ชันช่วยสกัดข้อมูลออเดอร์ (GPT ตัวเล็ก) ======================
async function extractOrderSummaryWithGPT(messageText) {
  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const systemMessage = `
You are a data extraction agent. 
The user might provide a summary of their order in Thai.
Please extract the following fields (if present) and output only valid JSON in the schema below:
{
  "promotion": "",
  "name": "",
  "address": "",
  "phone": "",
  "totalPrice": "",
  "paymentMethod": ""
}
If a field is missing, just output "" for that field.
Output ONLY JSON, nothing else.
    `.trim();

    const userMessage = `ข้อความสรุป: """${messageText}"""`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
      ],
      temperature: 0.0
    });

    const assistantReply = response.choices?.[0]?.message?.content?.trim() || "";
    const parsed = JSON.parse(assistantReply);

    // ตรวจสอบโครงสร้าง
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.hasOwnProperty("promotion") &&
      parsed.hasOwnProperty("name") &&
      parsed.hasOwnProperty("address") &&
      parsed.hasOwnProperty("phone") &&
      parsed.hasOwnProperty("totalPrice") &&
      parsed.hasOwnProperty("paymentMethod")
    ) {
      return parsed;
    }
    return null;

  } catch (err) {
    console.error("extractOrderSummaryWithGPT error:", err);
    return null;
  }
}

/**
 * appendOrderToSheet: บันทึกข้อมูลออเดอร์ใหม่ลง Google Sheet
 * สมมติหัวคอลัมน์คือ:
 * [Timestamp, FBName, Promotion, Name, Address, Phone, TotalPrice, PaymentMethod]
 */
async function appendOrderToSheet(fbName, orderObj) {
  try {
    const sheetsApi = await getSheetsApi();

    const now = new Date().toISOString();
    const rowData = [
      now,
      fbName || "",                // ชื่อ Facebook ของลูกค้า
      orderObj.promotion || "",
      orderObj.name || "",
      orderObj.address || "",
      orderObj.phone || "",
      orderObj.totalPrice || "",
      orderObj.paymentMethod || "",
    ];

    await sheetsApi.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_RANGE, 
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      resource: {
        values: [ rowData ]
      }
    });
    console.log(">>> Order data appended to Google Sheet successfully.");
  } catch (err) {
    console.error("appendOrderToSheet error:", err);
  }
}

/**
 * setCustomerStatusInDB: อัปเดตสถานะลูกค้าใน MongoDB
 */
async function setCustomerStatusInDB(userId, newStatus) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("customers");

  await coll.updateOne(
    { senderId: userId },
    { $set: { status: newStatus, updatedAt: new Date() } },
    { upsert: true }
  );
  console.log(`>>> setCustomerStatus to ${newStatus} for userId = ${userId}`);
}

/**
 * checkAndSaveOrderSummary:
 * - ตรวจจับคำว่า "สรุปยอดการสั่งซื้อ" ในข้อความผู้ใช้
 * - ถ้าพบ => เรียก GPT ตัวเล็ก parse
 * - ถ้า parse ได้ => บันทึกลง Sheet + อัปเดตสถานะ + เก็บลง collection orders
 */
async function checkAndSaveOrderSummary(userId, userMsg) {
  if (!userMsg.includes("สรุปยอดการสั่งซื้อ")) {
    return;
  }
  const orderData = await extractOrderSummaryWithGPT(userMsg);
  if (!orderData) {
    console.log(">>> Order summary parse failed or incomplete.");
    return;
  }
  console.log(">>> Extracted order summary from GPT:", orderData);

  // เอา fbName จาก active_user_status
  const statusObj = await getUserStatus(userId);
  const fbName = statusObj?.name || "";

  // 1) บันทึกลง Google Sheet
  await appendOrderToSheet(fbName, orderData);

  // 2) อัปเดตสถานะลูกค้า
  await setCustomerStatusInDB(userId, "ORDERED");

  // 3) เก็บลง collection orders (ประวัติ)
  const client = await connectDB();
  const db = client.db("chatbot");
  const ordersColl = db.collection("orders");
  await ordersColl.insertOne({
    senderId: userId,
    fbName,
    orderData,
    status: "ORDERED",
    createdAt: new Date()
  });
  console.log(">>> Saved order to DB orders collection.");
}

// ====================== 8) Webhook Routes & Startup ======================
const processedMessageIds = new Set();

// Verify Webhook
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

      for (const webhookEvent of entry.messaging) {
        if (
          webhookEvent.message?.is_echo ||
          webhookEvent.delivery ||
          webhookEvent.read ||
          webhookEvent.message?.app_id
        ) {
          console.log("Skipping echo/delivery/read/app_id event");
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

        // Find userId
        const pageId = entry.id; 
        let userId = (webhookEvent.sender.id === pageId)
          ? webhookEvent.recipient.id
          : webhookEvent.sender.id;

        // ensure we have userStatus
        const userStatus = await getUserStatus(userId);
        const aiEnabled = userStatus.aiEnabled;

        if (webhookEvent.message && webhookEvent.message.text) {
          const userMsg = webhookEvent.message.text;

          // ตัวอย่างสวิตช์เปิด/ปิด AI ด้วยคีย์เวิร์ด
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

          // (1) ตรวจจับสรุปยอดจาก "ข้อความผู้ใช้"
          await checkAndSaveOrderSummary(userId, userMsg);

          // (2) ถ้า AI ปิด => บอทไม่ตอบ
          if (!aiEnabled) {
            await saveChatHistory(userId, userMsg, "");
            continue;
          }

          // (3) ถ้า AI เปิด => call GPT
          const history = await getChatHistory(userId);
          const systemInstructions = buildSystemInstructions();
          const assistantMsg = await getAssistantResponse(systemInstructions, history, userMsg);

          await saveChatHistory(userId, userMsg, assistantMsg);
          // (4) ส่งข้อความบอทออกไป (จะตรวจ “สรุปยอด” ในassistantMsg ที่นี่ด้วย)
          await sendTextMessage(userId, assistantMsg);

        } else if (webhookEvent.message && webhookEvent.message.attachments) {
          const attachments = webhookEvent.message.attachments;

          let userContentArray = [{
            type: "text",
            text: "ผู้ใช้ส่งไฟล์แนบ"
          }];

          for (const att of attachments) {
            if (att.type === 'image') {
              userContentArray.push({
                type: "image_url",
                image_url: {
                  url: att.payload.url,
                  detail: "auto"
                }
              });
            } else {
              userContentArray.push({
                type: "text",
                text: `ไฟล์แนบประเภท: ${att.type}`
              });
            }
          }

          if (!aiEnabled) {
            await saveChatHistory(userId, userContentArray, "");
            continue;
          }

          const history = await getChatHistory(userId);
          const systemInstructions = buildSystemInstructions();
          const assistantMsg = await getAssistantResponse(systemInstructions, history, userContentArray);

          await saveChatHistory(userId, userContentArray, assistantMsg);
          // ส่งข้อความออกไป (ตรวจ “สรุปยอด” ถ้ามี)
          await sendTextMessage(userId, assistantMsg);

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

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);

  try {
    // 1) เชื่อมต่อ DB
    await connectDB();

    // 2) ดึง instructions จาก Google Docs
    await fetchGoogleDocInstructions();

    // 3) ดึงข้อมูลจาก Sheets
    const rows = await fetchSheetData(SPREADSHEET_ID, SHEET_RANGE);
    sheetJSON = transformSheetRowsToJSON(rows);

    console.log("Startup completed. Ready to receive webhooks.");
  } catch (err) {
    console.error("Startup error:", err);
  }
});
