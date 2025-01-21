/*******************************************************
 * เพิ่มโค้ดบางส่วนเข้าไปในไฟล์หลัก
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

// ควรเก็บไว้ใน Environment
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN; 
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "AiDee_a4wfaw4";
const MONGO_URI = process.env.MONGO_URI;

// หากมีการเชื่อมต่อ Google Docs, Sheets
const GOOGLE_CLIENT_EMAIL = "aitar-888@eminent-wares-446512-j8.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGhyeINArKZgaV\nitEcK+o89ilPYeRNTNZgJT7VNHB5hgNLLeAcFLJ7IlCIqTLMoJEnnoDQil6aKaz8\nExVL83uSXRrzk4zQvtt3tIP31+9wOCb9D4ZGWfVP1tD0qdD4WJ1qqg1j1/8879pH\nUeQGEMuCnyVbcQ3GbYQjyYb3wEz/Qv7kMVggF+MIaGGw2NQwM0XcufSFtyxvvX2S\nb8uGc1A8R+Dn/tmcgMODhbtEgcMg6yXI5Y26MPfDjVrEbk0lfCr7IGFJX4ASYeKl\n0jhm0RGb+aya2cb55auLN3VPO5MQ+cOp8gHBf5GiC/YgF1gbRgF5b7LgmENBxSfH\nb3WVQodLAgMBAAECggEACKB14M7LdekXZHyAQrZL0EitbzQknLv33Xyw2B3rvJ7M\nr4HM/nC4eBj7y+ciUc8GZQ+CWc2GzTHTa66+mwAia1qdYbPp3LuhGM4Leq5zn/o+\nA3rJuG6PS4qyUMy89msPXW5fSj/oE535QREiFKYP2dtlia2GI4xoag+x9uZwfMUO\nWKEe7tiUoZQEiGhwtjLq9lyST4kGGmlhNee9OyhDJcw4uCt8Cepr++hMDleWUF6c\nX0nbGmoSS0sZ5Boy8ATMhw/3luaOAlTUEz/nVDvbbWlNL9etwLKiAVw+AQXsPHNW\nNWF7gyEIsEi0qSM3PtA1X7IdReRXHqmfiZs0J3qSQQKBgQD1+Yj37Yuqj8hGi5PY\n+M0ieMdGcbUOmJsM1yUmBMV4bfaTiqm504P6DIYAqfDDWeozcHwcdpG1AfFAihEi\nh6lb0qRk8YaGbzvac8mWhwo/jDA5QB97fjFa6uwtlewZ0Er/U3QmOeVVnVC1y1b0\nrbJD5yjvI3ve+gpwAz0glpIMiwKBgQDOnpD7p7ylG4NQunqmzzdozrzZP0L6EZyE\n141st/Hsp9rtO9/ADuH6WhpirQ516l5LLv7mLPA8S9CF/cSdWF/7WlxBPjM8WRs9\nACFNBJIwUfjzPnvECmtsayzRlKuyCAspnNSkzgtdtvf2xI82Z3BGov9goZfu+D4A\n36b1qXsIQQKBgQCO1CojhO0vyjPKOuxL9hTvqmBUWFyBMD4AU8F/dQ/RYVDn1YG+\npMKi5Li/E+75EHH9EpkO0g7Do3AaQNG4UjwWVJcfAlxSHa8Mp2VsIdfilJ2/8KsX\nQ2yXVYh04/Rn/No/ro7oT4AKmcGu/nbstxuncEgFrH4WOOzspATPsn72BwKBgG5N\nBAT0NKbHm0B7bIKkWGYhB3vKY8zvnejk0WDaidHWge7nabkzuLtXYoKO9AtKxG/K\ndNUX5F+r8XO2V0HQLd0XDezecaejwgC8kwp0iD43ZHkmQBgVn+dPB6wSe94coSjj\nyjj4reSnipQ3tmRKsAtldIN3gI5YA3Gf85dtlHqBAoGAD5ePt7cmu3tDZhA3A8f9\no8mNPvqz/WGs7H2Qgjyfc3jUxEGhVt1Su7J1j+TppfkKtJIDKji6rVA9oIjZtpZT\ngxnU6hcYuiwbLh3wGEFIjP1XeYYILudqfWOEbwnxD1RgMkCqfSHf/niWlfiH6p3F\ndnBsLY/qXdKfS/OXyezAm4M=\n-----END PRIVATE KEY-----\n";

const GOOGLE_DOC_ID = "1IDvCXWa_5QllMTKrVSvhLRQPNNGkYgxb8byaDGGEhyU";

/** 
 * ชีตสำหรับบันทึกออเดอร์ 
 *  - ชื่อชีตว่าอะไรให้แก้ range ให้สอดคล้อง 
 *  - ต้องการใส่ข้อมูลกี่คอลัมน์ก็ปรับได้
 */
const SPREADSHEET_ID = "1f783DDFR0ZZDM4wG555Zpwmq6tQ2e9tWT28H0qRBPhU";
const SHEET_NAME_FOR_ORDERS = "ชีต1";
const ORDERS_RANGE = `${SHEET_NAME_FOR_ORDERS}!A2:G`;  // เริ่มที่แถว 2, คอลัมน์ A-G (ตัวอย่าง)

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
 * เก็บสถานะการสั่งซื้อ (เช่น "ordered", "pending", "canceled") 
 * หรือจะใช้ collection เดียวกับ active_user_status ก็ได้
 */
async function updateCustomerOrderStatus(userId, status) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("customer_order_status");

  await coll.updateOne(
    { senderId: userId },
    { $set: { orderStatus: status, updatedAt: new Date() } },
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

// ====================== 4) หากต้องการดึงข้อมูลจาก Google Sheet เดิม เพื่อนำมาใช้อ้างอิง ======================
async function getSheetsApi() {
  const sheetsAuth = new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: sheetsAuth });
}

/** ถ้าต้องการอ่านข้อมูลอื่น ๆ จาก Sheet (นอกจากบันทึกออเดอร์) ก็ใส่โค้ดได้ที่นี่ */
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

// ====================== 5) สร้าง systemInstructions ======================
function buildSystemInstructions() {
  // รวม instructions จาก Google Docs + Policy อื่น ๆ ตามต้องการ
  const finalSystemInstructions = `
You are an AI chatbot for THAYA. 
Below are instructions from the Google Doc:
---
${googleDocInstructions}

Rules about images, privacy, etc...
(ย่อเนื้อหาความยาวได้ตามสะดวก)
`.trim();

  return finalSystemInstructions;
}

// ====================== 6) เรียก GPT เพื่อโต้ตอบทั่วไป ======================
async function getAssistantResponse(systemInstructions, history, userContent) {
  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const messages = [
      { role: "system", content: systemInstructions },
      ...history
    ];
    let finalUserMessage = normalizeRoleContent("user", userContent);
    messages.push(finalUserMessage);

    // เรียกโมเดล
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.1,
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

    return assistantReply.trim();

  } catch (error) {
    console.error("Error getAssistantResponse:", error);
    return "ขออภัยค่ะ ระบบขัดข้องชั่วคราว ไม่สามารถตอบได้ในขณะนี้";
  }
}

// ====================== 7) ฟังก์ชันส่งข้อความ/รูป/วิดีโอกลับทาง Messenger ======================
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

/** ส่งข้อความที่อาจมี [SEND_IMAGE:URL] หรือ [SEND_VIDEO:URL] และ [cut] */
async function sendTextMessage(userId, response) {
  response = response.replace(/\[cut\]{2,}/g, "[cut]");
  let segments = response.split("[cut]").map(s => s.trim()).filter(s => s);
  if (segments.length > 10) segments = segments.slice(0, 10);

  for (let segment of segments) {
    const imageRegex = /\[SEND_IMAGE:(https?:\/\/[^\s]+)\]/g;
    const videoRegex = /\[SEND_VIDEO:(https?:\/\/[^\s]+)\]/g;

    // ดึง url ทั้งหมด
    const images = [...segment.matchAll(imageRegex)];
    const videos = [...segment.matchAll(videoRegex)];

    // ตัดคำสั่งออกให้เหลือแค่ text
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
    // ส่งข้อความ
    if (textPart) {
      await sendSimpleTextMessage(userId, textPart);
    }
  }
}

/* =========================================================
 *          โค้ดส่วนเพิ่มเติมสำหรับ "สรุปยอดการสั่งซื้อ"
 * ========================================================= */

/**
 * checkOrderSummary: เช็กว่า ข้อความนั้นน่าจะเป็น "สรุปยอดการสั่งซื้อ" หรือไม่
 * อาจใช้ regex ง่าย ๆ หรือเช็กคีย์เวิร์ด "สรุปยอดการสั่งซื้อ", "โปรโมชั่น", "ราคารวม" ฯลฯ
 */
function checkOrderSummary(text) {
  // ตัวอย่างเช็กง่าย ๆ ว่ามีคำว่า "สรุปยอดการสั่งซื้อ" ไหม
  // (ในงานจริงอาจต้องการเงื่อนไขยืดหยุ่นกว่านี้ เช่น มีคำว่า "โปรโมชั่น" และ "ราคารวม" ด้วย)
  if (!text) return false;
  const pattern = /สรุปยอดการสั่งซื้อ/i;
  return pattern.test(text);
}

/**
 * extractOrderDataWithGPT:
 *  - เรียก GPT "gpt-4o-mini" อีกครั้ง เพื่อวิเคราะห์โครงสร้างของข้อความสรุปยอด
 *  - หยิบข้อมูลที่ต้องการ เช่น ชื่อ, ที่อยู่, เบอร์โทร, โปรโมชั่น, ราคารวม, วิธีชำระเงิน
 *  - return ในรูป JSON
 */
async function extractOrderDataWithGPT(orderText) {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // system prompt: อธิบายให้ GPT ช่วยสกัดข้อมูล
  const sysPrompt = `
คุณเป็นโปรแกรมที่ช่วยสกัดข้อมูลออเดอร์จากข้อความสรุปยอด
Input ด้านล่างคือข้อความสรุปยอดที่เขียนโดยผู้ใช้:
ต้องการให้คุณตอบเป็น JSON format เท่านั้น (ห้ามมีข้อความอื่นนอกจาก JSON)

Data ที่ต้องการ:
{
  "promotion": (string) รายละเอียดโปรโมชั่น ถ้ามี,
  "customer_name": (string) ชื่อ,
  "address": (string) ที่อยู่,
  "phone": (string) เบอร์โทร,
  "total": (string or number) ยอดรวม,
  "payment_method": (string) วิธีการชำระเงิน (ถ้าเจอในข้อความ ถ้าไม่เจอให้ใส่ empty string)
}
ถ้าหาไม่เจอให้ใส่ค่าว่าง ("") 
เข้าใจหรือไม่
  `.trim();

  try {
    const messages = [
      { role: "system", content: sysPrompt },
      { role: "user", content: orderText }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.0,
    });

    let gptAnswer = response.choices[0].message.content || "{}";
    // พยายาม parse JSON
    let data;
    try {
      data = JSON.parse(gptAnswer);
    } catch (e) {
      data = {};
    }
    return data;

  } catch (e) {
    console.error("extractOrderDataWithGPT error:", e);
    return {};
  }
}

/**
 * saveOrderToSheet:
 *  บันทึกข้อมูล order ลง Google Sheet (บรรทัดถัดไป)
 *  ตัวอย่างใช้ method "append" เพื่อเพิ่มข้อมูลท้ายตาราง
 */
async function saveOrderToSheet(orderData) {
  try {
    const sheetsApi = await getSheetsApi();

    // เตรียม values ตามลำดับคอลัมน์ เช่น [วันที่, ชื่อ, ที่อยู่, เบอร์, โปรโมชั่น, ราคารวม, วิธีจ่าย]
    // ในตัวอย่างนี้: A=Timestamp, B=Name, C=Address, D=Phone, E=Promotion, F=Total, G=Payment
    const timestamp = new Date().toLocaleString("th-TH");
    const rowValues = [
      timestamp,
      orderData.customer_name || "",
      orderData.address || "",
      orderData.phone || "",
      orderData.promotion || "",
      orderData.total || "",
      orderData.payment_method || "",
    ];

    const request = {
      spreadsheetId: SPREADSHEET_ID,
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
 * handleOrderSummary: 
 *  รวมกระบวนการ: 
 *   1) ตรวจว่าข้อความเป็นสรุปยอดไหม 
 *   2) ถ้าใช่ -> เรียก GPT เพื่อดึงข้อมูล 
 *   3) เซฟลง Sheets 
 *   4) อัปเดตสถานะลูกค้าใน Mongo
 */
async function handleOrderSummary(userId, textMessage) {
  // 1) เช็กว่าเป็นข้อความสรุปยอดไหม
  const isSummary = checkOrderSummary(textMessage);
  if (!isSummary) {
    return; // ไม่ใช่ ก็ไม่ทำอะไร
  }

  // 2) ใช้ GPT สกัดข้อมูล
  const orderData = await extractOrderDataWithGPT(textMessage);

  // 3) บันทึกลงชีต
  await saveOrderToSheet(orderData);

  // 4) เปลี่ยนสถานะลูกค้าใน Mongo ว่า "ordered"
  await updateCustomerOrderStatus(userId, "ordered");
}

//
// ====================== 8) Webhook Routes & Startup ======================
//
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
      if (!entry.messaging || entry.messaging.length === 0) continue;

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

        const pageId = entry.id; 
        let userId = (webhookEvent.sender.id === pageId)
          ? webhookEvent.recipient.id
          : webhookEvent.sender.id;

        const userStatus = await getUserStatus(userId);
        const aiEnabled = userStatus.aiEnabled;

        // --- Handle text ---
        if (webhookEvent.message && webhookEvent.message.text) {
          const userMsg = webhookEvent.message.text;

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

          if (!aiEnabled) {
            await saveChatHistory(userId, userMsg, "");
            continue;
          }

          // ========== จุดสำคัญ: เรียก handleOrderSummary =============
          // ให้มันเช็กว่าข้อความเป็น "สรุปยอด" รึเปล่า ถ้าใช่ ก็ parse + บันทึก
          await handleOrderSummary(userId, userMsg);
          // ============================================================

          // AI ตอบ
          const history = await getChatHistory(userId);
          const systemInstructions = buildSystemInstructions();
          const assistantMsg = await getAssistantResponse(systemInstructions, history, userMsg);

          await saveChatHistory(userId, userMsg, assistantMsg);
          await sendTextMessage(userId, assistantMsg);

        // --- Handle attachments (images, etc.) ---
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
    await connectDB();
    await fetchGoogleDocInstructions();
    // ถ้ามีการโหลด Sheet เดิมมาใช้อ้างอิง ก็ทำได้:
    // const rows = await fetchSheetData(SPREADSHEET_ID, "INSTRUCTIONS!A1:B10");
    // console.log("Sheet data:", rows);

    console.log("Startup completed. Ready to receive webhooks.");
  } catch (err) {
    console.error("Startup error:", err);
  }
});
