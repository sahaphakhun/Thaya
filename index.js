/*******************************************************
 * ตัวอย่างโค้ด chatbot ที่ให้ Assistant สรุปออเดอร์
 * แล้ว GPT อีกตัวจะตรวจสอบ assistantMsg เพื่อดึงข้อมูล
 * จากนั้นบันทึกลง Google Sheet และ MongoDB
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

// (ควรเก็บค่าเหล่านี้ใน environment variables)
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN; 
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "AiDee_a4wfaw4";
const MONGO_URI = process.env.MONGO_URI;

// Google Service Account
const GOOGLE_CLIENT_EMAIL = "aitar-888@eminent-wares-446512-j8.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGhyeINArKZgaV\nitEcK+o89ilPYeRNTNZgJT7VNHB5hgNLLeAcFLJ7IlCIqTLMoJEnnoDQil6aKaz8\nExVL83uSXRrzk4zQvtt3tIP31+9wOCb9D4ZGWfVP1tD0qdD4WJ1qqg1j1/8879pH\nUeQGEMuCnyVbcQ3GbYQjyYb3wEz/Qv7kMVggF+MIaGGw2NQwM0XcufSFtyxvvX2S\nb8uGc1A8R+Dn/tmcgMODhbtEgcMg6yXI5Y26MPfDjVrEbk0lfCr7IGFJX4ASYeKl\n0jhm0RGb+aya2cb55auLN3VPO5MQ+cOp8gHBf5GiC/YgF1gbRgF5b7LgmENBxSfH\nb3WVQodLAgMBAAECggEACKB14M7LdekXZHyAQrZL0EitbzQknLv33Xyw2B3rvJ7M\nr4HM/nC4eBj7y+ciUc8GZQ+CWc2GzTHTa66+mwAia1qdYbPp3LuhGM4Leq5zn/o+\nA3rJuG6PS4qyUMy89msPXW5fSj/oE535QREiFKYP2dtlia2GI4xoag+x9uZwfMUO\nWKEe7tiUoZQEiGhwtjLq9lyST4kGGmlhNee9OyhDJcw4uCt8Cepr++hMDleWUF6c\nX0nbGmoSS0sZ5Boy8ATMhw/3luaOAlTUEz/nVDvbbWlNL9etwLKiAVw+AQXsPHNW\nNWF7gyEIsEi0qSM3PtA1X7IdReRXHqmfiZs0J3qSQQKBgQD1+Yj37Yuqj8hGi5PY\n+M0ieMdGcbUOmJsM1yUmBMV4bfaTiqm504P6DIYAqfDDWeozcHwcdpG1AfFAihEi\nh6lb0qRk8YaGbzvac8mWhwo/jDA5QB97fjFa6uwtlewZ0Er/U3QmOeVVnVC1y1b0\nrbJD5yjvI3ve+gpwAz0glpIMiwKBgQDOnpD7p7ylG4NQunqmzzdozrzZP0L6EZyE\n141st/Hsp9rtO9/ADuH6WhpirQ516l5LLv7mLPA8S9CF/cSdWF/7WlxBPjM8WRs9\nACFNBJIwUfjzPnvECmtsayzRlKuyCAspnNSkzgtdtvf2xI82Z3BGov9goZfu+D4A\n36b1qXsIQQKBgQCO1CojhO0vyjPKOuxL9hTvqmBUWFyBMD4AU8F/dQ/RYVDn1YG+\npMKi5Li/E+75EHH9EpkO0g7Do3AaQNG4UjwWVJcfAlxSHa8Mp2VsIdfilJ2/8KsX\nQ2yXVYh04/Rn/No/ro7oT4AKmcGu/nbstxuncEgFrH4WOOzspATPsn72BwKBgG5N\nBAT0NKbHm0B7bIKkWGYhB3vKY8zvnejk0WDaidHWge7nabkzuLtXYoKO9AtKxG/K\ndNUX5F+r8XO2V0HQLd0XDezecaejwgC8kwp0iD43ZHkmQBgVn+dPB6wSe94coSjj\nyjj4reSnipQ3tmRKsAtldIN3gI5YA3Gf85dtlHqBAoGAD5ePt7cmu3tDZhA3A8f9\no8mNPvqz/WGs7H2Qgjyfc3jUxEGhVt1Su7J1j+TppfkKtJIDKji6rVA9oIjZtpZT\ngxnU6hcYuiwbLh3wGEFIjP1XeYYILudqfWOEbwnxD1RgMkCqfSHf/niWlfiH6p3F\ndnBsLY/qXdKfS/OXyezAm4M=\n-----END PRIVATE KEY-----\n";


// Google Docs (สำหรับ systemInstructions ถ้ามี)
const GOOGLE_DOC_ID = "1IDvCXWa_5QllMTKrVSvhLRQPNNGkYgxb8byaDGGEhyU";

// Google Sheets (สำหรับบันทึกออเดอร์)
const SPREADSHEET_ID = "1f783DDFR0ZZDM4wG555Zpwmq6tQ2e9tWT28H0qRBPhU";
const SHEET_NAME_FOR_ORDERS = "บันทึกออเดอร์";
const ORDERS_RANGE = `${SHEET_NAME_FOR_ORDERS}!A2:G`;  // A2:G = ตัวอย่าง 7 คอลัมน์

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
 * แปลง content ให้เป็น string หรือ array ให้ถูกต้อง เพื่อป้องกัน error ตอนส่งไป GPT
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

/** ดึงประวัติแชทของ user จาก MongoDB */
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

/** บันทึกข้อความ user และ assistant */
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
 * updateCustomerOrderStatus:
 * เก็บสถานะการสั่งซื้อ (เช่น ordered, pending, canceled) ไว้ที่ Mongo
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

// ====================== 3) ดึง systemInstructions จาก Google Docs (ถ้ามี) ======================
let googleDocInstructions = "";

/** ดึงข้อความจาก Google Docs (instruction) มาเก็บไว้ในตัวแปร global */
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

// ====================== 4) ฟังก์ชันอ่าน/เขียน Google Sheets ======================
async function getSheetsApi() {
  const sheetsAuth = new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: sheetsAuth });
}

/** ฟังก์ชัน append ข้อมูล order ลงในชีต */
async function saveOrderToSheet(orderData) {
  try {
    const sheetsApi = await getSheetsApi();

    // ตัวอย่างการเตรียมข้อมูล 7 คอลัมน์:
    // [Timestamp, ชื่อ, ที่อยู่, เบอร์, โปรโมชั่น, ราคารวม, วิธีจ่าย]
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

// ====================== 5) Build systemInstructions (ใช้ Google Docs + Rules อื่น ๆ ) ======================
function buildSystemInstructions() {
  // ใส่ rules อื่น ๆ ตามต้องการ
  const finalSystemInstructions = `
You are an AI chatbot for THAYA. 
Below are instructions from the Google Doc (if any):
---
${googleDocInstructions}

(Other rules about images, privacy, etc.)
`.trim();

  return finalSystemInstructions;
}

// ====================== 6) เรียก GPT เพื่อตอบโต้ข้อความทั่วไป ======================
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

// ====================== 7) ฟังก์ชันส่งข้อความ/รูป/วิดีโอไป Facebook ======================
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

/** ส่งข้อความ (อาจมี [SEND_IMAGE:URL], [SEND_VIDEO:URL], [cut]) */
async function sendTextMessage(userId, response) {
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

/* =========================================================
 *   ใช้ GPT ตรวจสอบ "assistantMsg" ว่ามีข้อมูลออเดอร์ไหม
 *   เช่น ที่อยู่, เบอร์, โปรโมชั่น, ยอดรวม, วิธีจ่าย ฯลฯ
 * ========================================================= */

/**
 * extractOrderDataWithGPT: 
 * - เรียก GPT เพื่อสกัดข้อมูลออเดอร์ หรือข้อมูลที่เกี่ยวกับการจัดส่ง
 * - บังคับให้ตอบเป็น JSON format เท่านั้น
 * - ถ้าไม่พบข้อมูล ก็ให้ "is_found": false
 */
async function extractOrderDataWithGPT(assistantMsg) {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // ตัวอย่าง system prompt:
  const sysPrompt = `
คุณเป็นโปรแกรมตรวจสอบว่าข้อความ (assistantMsg) มีข้อมูลที่เกี่ยวกับการจัดส่งหรือออเดอร์หรือไม่
ถ้ามี ให้ดึง: 
- ชื่อ (customer_name)
- ที่อยู่ (address)
- เบอร์โทร (phone)
- โปรโมชั่น (promotion) ถ้ามี
- ยอดรวม (total) ถ้ามี
- วิธีชำระเงิน (payment_method) ถ้ามี

ตอบเป็น JSON เท่านั้น มีโครงสร้างดังนี้:
{
  "is_found": true/false,
  "customer_name": "",
  "address": "",
  "phone": "",
  "promotion": "",
  "total": "",
  "payment_method": ""
}

- หากไม่พบ ให้ "is_found": false และเว้นคีย์อื่นเป็นค่าว่าง
- หากพบบางส่วน เช่น address แต่ไม่พบ total, ก็กรอกเฉพาะที่พบ ที่เหลือให้เว้นว่าง (string ว่าง)
ห้ามมีข้อความอื่นนอกจาก JSON
`.trim();

  try {
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
      console.warn("JSON parse error, GPT answer:", gptAnswer);
      data = { is_found: false };
    }
    return data;
  } catch (e) {
    console.error("extractOrderDataWithGPT error:", e);
    return { is_found: false };
  }
}

/**
 * detectAndSaveOrder:
 * - เรียก extractOrderDataWithGPT(assistantMsg) 
 * - ถ้า is_found = true, บันทึกลง Google Sheet และ Mongo
 */
async function detectAndSaveOrder(userId, assistantMsg) {
  const parsed = await extractOrderDataWithGPT(assistantMsg);
  if (!parsed.is_found) {
    console.log(">>> detectAndSaveOrder: No order data found.");
    return;
  }

  // มีข้อมูลออเดอร์บางส่วน => บันทึกลงชีต
  await saveOrderToSheet(parsed);

  // ปรับสถานะเป็น "ordered" หรือจะตั้งเป็นอย่างอื่นก็ได้
  await updateCustomerOrderStatus(userId, "ordered");
}

// ====================== 8) Webhook Routes & Startup ======================
const processedMessageIds = new Set();

// ยืนยัน webhook กับ Facebook
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
      if (!entry.messaging || entry.messaging.length === 0) continue;

      for (const webhookEvent of entry.messaging) {
        // ข้าม event ที่ไม่จำเป็น
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

        // === กรณีเป็นข้อความ Text จากผู้ใช้ ===
        if (webhookEvent.message && webhookEvent.message.text) {
          const userMsg = webhookEvent.message.text;

          // ตัวอย่างปุ่มสั่งปิด/เปิด AI
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

          // ถ้า AI ปิด => ไม่ตอบ
          if (!aiEnabled) {
            await saveChatHistory(userId, userMsg, "");
            continue;
          }

          // (1) เรียก GPT ให้ตอบ (assistantMsg)
          const history = await getChatHistory(userId);
          const systemInstructions = buildSystemInstructions();
          const assistantMsg = await getAssistantResponse(systemInstructions, history, userMsg);

          // (2) บันทึกแชท
          await saveChatHistory(userId, userMsg, assistantMsg);

          // (3) ให้ GPT อีกตัวตรวจ assistantMsg หา "ข้อมูลออเดอร์" (ที่อยู่, เบอร์, โปรโมชั่น, ฯลฯ)
          await detectAndSaveOrder(userId, assistantMsg);

          // (4) ส่งข้อความจาก assistant กลับ
          await sendTextMessage(userId, assistantMsg);

        // === กรณีเป็น attachments (รูป, วิดีโอ, ฯลฯ) ===
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

          // (1) GPT ตอบ attachments
          const history = await getChatHistory(userId);
          const systemInstructions = buildSystemInstructions();
          const assistantMsg = await getAssistantResponse(systemInstructions, history, userContentArray);

          // (2) บันทึกแชท
          await saveChatHistory(userId, userContentArray, assistantMsg);

          // (3) ตรวจ assistantMsg ว่ามีข้อมูลออเดอร์ไหม
          await detectAndSaveOrder(userId, assistantMsg);

          // (4) ส่งข้อความ
          await sendTextMessage(userId, assistantMsg);

        } else {
          console.log(">> [Webhook] Received event but not text/attachment:", webhookEvent);
        }
      }
    }

    // ตอบกลับ Facebook ว่าได้รับ event
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// ====================== Start Server ======================
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);

  try {
    // 1) เชื่อมต่อ MongoDB
    await connectDB();

    // 2) ดึง instructions จาก Google Docs (ถ้ามี)
    await fetchGoogleDocInstructions();

    // 3) (ถ้าต้องการ) ดึงข้อมูลจาก Sheet หรือเตรียมอะไรก่อนเริ่ม
    // ...

    console.log("Startup completed. Ready to receive webhooks.");
  } catch (err) {
    console.error("Startup error:", err);
  }
});
