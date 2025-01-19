/*******************************************************
 ********************************************************/

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const util = require('util');            // <--- สำหรับ promisify
const requestPost = util.promisify(request.post); // <--- ใช้ await requestPost
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
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "XianTA1234";
const MONGO_URI = process.env.MONGO_URI;

// หากมีการเชื่อมต่อ Google Docs, Sheets
const GOOGLE_CLIENT_EMAIL = "aitar-888@eminent-wares-446512-j8.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGhyeINArKZgaV\nitEcK+o89ilPYeRNTNZgJT7VNHB5hgNLLeAcFLJ7IlCIqTLMoJEnnoDQil6aKaz8\nExVL83uSXRrzk4zQvtt3tIP31+9wOCb9D4ZGWfVP1tD0qdD4WJ1qqg1j1/8879pH\nUeQGEMuCnyVbcQ3GbYQjyYb3wEz/Qv7kMVggF+MIaGGw2NQwM0XcufSFtyxvvX2S\nb8uGc1A8R+Dn/tmcgMODhbtEgcMg6yXI5Y26MPfDjVrEbk0lfCr7IGFJX4ASYeKl\n0jhm0RGb+aya2cb55auLN3VPO5MQ+cOp8gHBf5GiC/YgF1gbRgF5b7LgmENBxSfH\nb3WVQodLAgMBAAECggEACKB14M7LdekXZHyAQrZL0EitbzQknLv33Xyw2B3rvJ7M\nr4HM/nC4eBj7y+ciUc8GZQ+CWc2GzTHTa66+mwAia1qdYbPp3LuhGM4Leq5zn/o+\nA3rJuG6PS4qyUMy89msPXW5fSj/oE535QREiFKYP2dtlia2GI4xoag+x9uZwfMUO\nWKEe7tiUoZQEiGhwtjLq9lyST4kGGmlhNee9OyhDJcw4uCt8Cepr++hMDleWUF6c\nX0nbGmoSS0sZ5Boy8ATMhw/3luaOAlTUEz/nVDvbbWlNL9etwLKiAVw+AQXsPHNW\nNWF7gyEIsEi0qSM3PtA1X7IdReRXHqmfiZs0J3qSQQKBgQD1+Yj37Yuqj8hGi5PY\n+M0ieMdGcbUOmJsM1yUmBMV4bfaTiqm504P6DIYAqfDDWeozcHwcdpG1AfFAihEi\nh6lb0qRk8YaGbzvac8mWhwo/jDA5QB97fjFa6uwtlewZ0Er/U3QmOeVVnVC1y1b0\nrbJD5yjvI3ve+gpwAz0glpIMiwKBgQDOnpD7p7ylG4NQunqmzzdozrzZP0L6EZyE\n141st/Hsp9rtO9/ADuH6WhpirQ516l5LLv7mLPA8S9CF/cSdWF/7WlxBPjM8WRs9\nACFNBJIwUfjzPnvECmtsayzRlKuyCAspnNSkzgtdtvf2xI82Z3BGov9goZfu+D4A\n36b1qXsIQQKBgQCO1CojhO0vyjPKOuxL9hTvqmBUWFyBMD4AU8F/dQ/RYVDn1YG+\npMKi5Li/E+75EHH9EpkO0g7Do3AaQNG4UjwWVJcfAlxSHa8Mp2VsIdfilJ2/8KsX\nQ2yXVYh04/Rn/No/ro7oT4AKmcGu/nbstxuncEgFrH4WOOzspATPsn72BwKBgG5N\nBAT0NKbHm0B7bIKkWGYhB3vKY8zvnejk0WDaidHWge7nabkzuLtXYoKO9AtKxG/K\ndNUX5F+r8XO2V0HQLd0XDezecaejwgC8kwp0iD43ZHkmQBgVn+dPB6wSe94coSjj\nyjj4reSnipQ3tmRKsAtldIN3gI5YA3Gf85dtlHqBAoGAD5ePt7cmu3tDZhA3A8f9\no8mNPvqz/WGs7H2Qgjyfc3jUxEGhVt1Su7J1j+TppfkKtJIDKji6rVA9oIjZtpZT\ngxnU6hcYuiwbLh3wGEFIjP1XeYYILudqfWOEbwnxD1RgMkCqfSHf/niWlfiH6p3F\ndnBsLY/qXdKfS/OXyezAm4M=\n-----END PRIVATE KEY-----\n";
const GOOGLE_DOC_ID = "1IDvCXWa_5QllMTKrVSvhLRQPNNGkYgxb8byaDGGEhyU";
const SPREADSHEET_ID = "1esN_P6JuPzYUGesR60zVuIGeuvSnRM1hlyaxCJbhI_c";
const SHEET_RANGE = "ชีต1!A2:B28"; 

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
 * normalizeRoleContent: บังคับ content ให้เป็น string หรือ array
 * ป้องกัน error เวลาส่งไป GPT
 */
function normalizeRoleContent(role, content) {
  // ถ้าเป็น string อยู่แล้ว => ใช้ได้
  if (typeof content === "string") {
    return { role, content };
  }
  // ถ้าเป็นอาเรย์ => ใช้ได้ (เช่น กรณีรูป)
  if (Array.isArray(content)) {
    return { role, content };
  }
  // กรณีอื่น => แปลงเป็น string ไว้ก่อน
  return { role, content: JSON.stringify(content) };
}

async function getChatHistory(userId) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("chat_history");
  const chats = await coll.find({ senderId: userId }).sort({ timestamp: 1 }).toArray();
  
  return chats.map(ch => {
    // ลอง parse เพื่อดูว่าเป็น array หรือเปล่า
    try {
      const parsed = JSON.parse(ch.content);
      return normalizeRoleContent(ch.role, parsed);
    } catch (err) {
      // ถ้า parse ไม่ได้ แสดงว่าเป็น string ปกติ
      return normalizeRoleContent(ch.role, ch.content);
    }
  });
}


/** บันทึกข้อความ user และข้อความตอบ (assistant) ลง DB */
async function saveChatHistory(userId, userMsg, assistantMsg) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("chat_history");

  // userMsg อาจเป็น string หรือ array => แปลงเป็น string หากไม่ใช่
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

/**
 * parseSheetRowsToObjects:
 * แปลงข้อมูลจาก Google Sheets ที่มาเป็นรูปแบบ [ [header...], [data...], [data...] ]
 * ให้กลายเป็น array ของ object โดยเอา row แรกเป็นชื่อคอลัมน์
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

/**
 * transformSheetRowsToJSON (จะเรียก parseSheetRowsToObjects แทนการ .map แบบเดิม)
 */
function transformSheetRowsToJSON(rows) {
  // เรียก parseSheetRowsToObjects เพื่อให้ได้ JSON รูปแบบ header => value
  return parseSheetRowsToObjects(rows);
}

let sheetJSON = [];



// ====================== 5) สร้าง systemInstructions (ผสาน Docs + Sheets) ======================
function buildSystemInstructions() {
  // แปลง Sheet JSON เป็น string
  const sheetsDataString = JSON.stringify(sheetJSON, null, 2);

  // ผสานกับข้อความจาก Google Docs
  const finalSystemInstructions = `
You are an AI chatbot for THAYA. 
Below are instructions from the Google Doc:
---
${googleDocInstructions}

Below is additional data from Google Sheets:
---
${sheetsDataString}

หากผู้ใช้ส่งรูปภาพ (If the user sends an image):

1) ถ้าเป็นรูปสลิปโอนเงิน (Money Transfer Slip):
   - ให้คุณอ่านข้อความบนสลิปเฉพาะ “ยอดเงินที่โอน” และ “ชื่อผู้รับโอน” เท่านั้น
   - โดย “ผู้รับโอน” ในบริบทนี้ คือผู้ขายหรือนักพัฒนาที่สร้างคุณขึ้นมา เพื่ออำนวยความสะดวกในการซื้อขาย
   - ห้ามเปิดเผยหรือวิเคราะห์ข้อมูลส่วนตัวหรือข้อมูลบัญชีธนาคารอื่น ๆ

2) ถ้าเป็นรูปประเภทอื่น (เช่น รูปสินค้า):
   - คุณอาจบรรยาย/ตอบตามคำถามของผู้ใช้ (เช่น ราคาสินค้า, คุณสมบัติ, วิธีใช้)
   - แต่ห้ามคาดเดาหรือเปิดเผยข้อมูลส่วนบุคคลจากภาพ (หากปรากฏ)

3) ถ้าเป็นรูปที่อยู่สำหรับการจัดส่ง (ซึ่งอาจมี ชื่อ และ เบอร์โทร ของผู้รับ):
   - ให้คุณใช้ข้อมูลดังกล่าวเฉพาะเพื่อการจัดส่งเท่านั้น (เช่น จัดทำใบที่อยู่/ฉลากพัสดุ/สรุปยอด/ยืนยันคำสั่งซื้อ)
   - ห้ามวิเคราะห์ หรือนำข้อมูลส่วนตัวไปใช้ในจุดประสงค์อื่น นอกเหนือจากการส่งสินค้า
   - ไม่ควรเปิดเผยรายละเอียดชื่อ-เบอร์โทรเพิ่มเติม ยกเว้นเท่าที่ผู้ใช้ต้องการ เพื่อยืนยันขั้นตอนจัดส่ง

4) ในทุกกรณี ห้ามให้ข้อมูลหรือวิเคราะห์ส่วนที่เป็นข้อมูลส่วนบุคคล นอกเหนือจากความจำเป็นในการตอบคำถามหรือการสั่งซื้อของผู้ใช้

5) ใช้ข้อมูลส่วนตัวเฉพาะเพื่อการจัดส่งและการดำเนินธุรกรรมที่ผู้ใช้ยินยอมไว้เท่านั้น

6) หากไม่แน่ใจว่ามีการละเมิดความเป็นส่วนตัวหรือไม่ ให้หลีกเลี่ยงการเปิดเผยรายละเอียดเชิงลึก และแจ้งเตือนผู้ใช้ตามสมควร


Rules:
- Please use the data above as reference for answering user questions.
- If not related, you may answer as usual.
`.trim();

  return finalSystemInstructions;
}


// ====================== 6) เรียก GPT (รองรับทั้งข้อความและรูป) ======================
async function getAssistantResponse(systemInstructions, history, userContent) {
  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // สร้าง messages เริ่มจาก system + ประวัติ
    const messages = [
      { role: "system", content: systemInstructions },
      // ประวัติ (map ให้เป็นรูปแบบ { role, content })
      ...history
    ];

    // ใส่ userContent (string / array) => normalize
    let finalUserMessage = normalizeRoleContent("user", userContent);
    messages.push(finalUserMessage);

    // เรียกโมเดล
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2,
    });

    // ดึงข้อความของ assistant
    let assistantReply = response.choices[0].message.content;
    if (typeof assistantReply !== "string") {
      assistantReply = JSON.stringify(assistantReply);
    }

    // ====== (A) ป้องกันวนลูป [cut] ซ้ำ ======
    // 1) รวม [cut][cut][cut] ติดกันให้เหลือ [cut] เดียว
    assistantReply = assistantReply.replace(/\[cut\]{2,}/g, "[cut]");
    // 2) จำกัดจำนวน [cut] ทั้งหมดในข้อความ (ถ้าเกิน 10 ก็เอาแค่ 10 segment)
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


// ====================== 7) ฟังก์ชันส่งข้อความกลับ Facebook (async/await) ======================

/** ส่งข้อความตัวอักษร (await) */
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

/** ส่งรูปภาพ (await) */
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

/** ส่งวิดีโอ (await) */
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
 * ฟังก์ชันหลักในการสั่งส่งข้อความ
 * - จะสแกน [SEND_IMAGE], [SEND_VIDEO]
 * - ส่งรูป/วิดีโอก่อน แล้วค่อยส่งข้อความ
 * - แยก segment ด้วย [cut] ทีละชุด
 */
async function sendTextMessage(userId, response) {
  // Debug: ดูข้อความดิบ
  console.log(">>> sendTextMessage() raw response:", JSON.stringify(response));

  // 1) รวม [cut][cut][cut] ติดกันให้เหลือครั้งเดียว
  response = response.replace(/\[cut\]{2,}/g, "[cut]");

  // 2) split ตาม [cut]
  let segments = response.split("[cut]").map(s => s.trim());

  // 3) filter empty
  segments = segments.filter(seg => seg.length > 0);

  // 4) limit ไม่เกิน 10 segment
  if (segments.length > 10) {
    segments = segments.slice(0, 10);
  }

  console.log(">>> segments:", segments.length, segments);

  // 5) วนลูปทีละ segment
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    console.log(`>>> [Segment ${i+1}]`, JSON.stringify(segment));

    // --- ตรวจจับลิงก์รูป ---
    const imageRegex = /\[SEND_IMAGE:(https?:\/\/[^\s]+)\]/g;
    // --- ตรวจจับลิงก์วิดีโอ ---
    const videoRegex = /\[SEND_VIDEO:(https?:\/\/[^\s]+)\]/g;

    // หาให้หมดใน segment
    const images = [...segment.matchAll(imageRegex)];
    const videos = [...segment.matchAll(videoRegex)];

    // ตัดคำสั่งออกจากข้อความ
    let textPart = segment
      .replace(imageRegex, '')
      .replace(videoRegex, '')
      .trim();

    // (1) ส่งรูปก่อน
    for (const match of images) {
      const imageUrl = match[1];
      await sendImageMessage(userId, imageUrl);
    }

    // (2) ส่งวิดีโอก่อน
    for (const match of videos) {
      const videoUrl = match[1];
      await sendVideoMessage(userId, videoUrl);
    }

    // (3) ส่งข้อความ (ถ้ามี)
    if (textPart) {
      await sendSimpleTextMessage(userId, textPart);
    }
  }
}


// ====================== 8) Webhook Routes & Startup ======================

// ---- เพิ่มตัวแปร global สำหรับกัน mid ซ้ำ (กันลูป) ----
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
      if (!entry.messaging || entry.messaging.length === 0) {
        continue;
      }

      for (const webhookEvent of entry.messaging) {
        // A) ตรวจจับ event ที่ไม่ใช่ข้อความ user หรือเป็น echo/delivery/read/app_id
        if (
          webhookEvent.message?.is_echo ||
          webhookEvent.delivery ||
          webhookEvent.read ||
          webhookEvent.message?.app_id
        ) {
          console.log("Skipping echo/delivery/read/app_id event");
          continue;
        }

        // B) ป้องกัน message.mid ซ้ำ
        if (webhookEvent.message && webhookEvent.message.mid) {
          const mid = webhookEvent.message.mid;
          if (processedMessageIds.has(mid)) {
            console.log("Skipping repeated mid:", mid);
            continue;
          } else {
            processedMessageIds.add(mid);
          }
        }

        // C) หา userId
        const pageId = entry.id; 
        let userId = (webhookEvent.sender.id === pageId)
          ? webhookEvent.recipient.id
          : webhookEvent.sender.id;

        // D) เช็คสถานะ aiEnabled
        const userStatus = await getUserStatus(userId);
        const aiEnabled = userStatus.aiEnabled;

        // E) ประมวลผลกรณีเป็น text หรือ attachment
        if (webhookEvent.message && webhookEvent.message.text) {
          // เคสข้อความ (Text)
          const userMsg = webhookEvent.message.text;

          // เช็กคำสั่งปิด/เปิด AI (หากต้องการ)
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

          // ถ้า AI ปิด ไม่ตอบ
          if (!aiEnabled) {
            await saveChatHistory(userId, userMsg, "");
            continue;
          }

          // AI เปิด => เรียก GPT
          const history = await getChatHistory(userId);
          const systemInstructions = buildSystemInstructions();
          const assistantMsg = await getAssistantResponse(systemInstructions, history, userMsg);

          // บันทึกและส่ง
          await saveChatHistory(userId, userMsg, assistantMsg);
          await sendTextMessage(userId, assistantMsg);

        } else if (webhookEvent.message && webhookEvent.message.attachments) {
          // เคสไฟล์แนบ (image, video, ฯลฯ)
          const attachments = webhookEvent.message.attachments;

          // สร้าง content array สำหรับผู้ใช้
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
              // เป็นไฟล์อื่น ๆ (audio, video, location, etc.)
              // ตัวอย่าง: ถ้ายังไม่รองรับ ก็ใส่เป็น text ธรรมดา
              userContentArray.push({
                type: "text",
                text: `ไฟล์แนบประเภท: ${att.type} (ยังไม่รองรับส่งต่อเป็นรูป/วิดีโอ)`,
              });
            }
          }

          // ถ้า AI ปิด ไม่ตอบ
          if (!aiEnabled) {
            await saveChatHistory(userId, userContentArray, "");
            continue;
          }

          // AI เปิด => เรียก GPT
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
