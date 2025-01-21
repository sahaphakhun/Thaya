/*******************************************************
 * ตัวอย่างโค้ด chatbot + Google Docs Instructions + 
 * Google Sheets (เดิม) สำหรับ INSTRUCTIONS + 
 * Google Sheets (ใหม่) สำหรับบันทึกออเดอร์
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

// ควรเก็บไว้ใน Environment หรือไฟล์ config แยก
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN; 
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "AiDee_a4wfaw4";
const MONGO_URI = process.env.MONGO_URI;

// หากมีการเชื่อมต่อ Google Docs, Sheets
const GOOGLE_CLIENT_EMAIL = "aitar-888@eminent-wares-446512-j8.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
YOUR_PRIVATE_KEY_HERE
-----END PRIVATE KEY-----
`;

// ------------------- (A) Google Docs -------------------
const GOOGLE_DOC_ID = "1IDvCXWa_5QllMTKrVSvhLRQPNNGkYgxb8byaDGGEhyU";

// ------------------- (B) Google Sheet สำหรับ "INSTRUCTIONS" -------------------
// *** ห้ามลบหรือแก้ไขส่วนนี้ ***
const SPREADSHEET_ID = "1esN_P6JuPzYUGesR60zVuIGeuvSnRM1hlyaxCJbhI_c";
const SHEET_RANGE = "ชีต1!A2:B28";  // Range สำหรับดึงข้อมูล instructions

// ------------------- (C) Google Sheet สำหรับ "บันทึกออเดอร์" (ใหม่) -------------------
const ORDERS_SPREADSHEET_ID = "1f783DDFR0ZZDM4wG555Zpwmq6tQ2e9tWT28H0qRBPhU";
// สมมติว่าเราบันทึกในชีตชื่อ "บันทึกออเดอร์" (หรือชื่ออื่นที่คุณใช้)
const SHEET_NAME_FOR_ORDERS = "บันทึกออเดอร์";
const ORDERS_RANGE = `${SHEET_NAME_FOR_ORDERS}!A2:G`; // เริ่มเก็บที่แถว 2, คอลัมน์ A-G (ตัวอย่าง)

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
    return { role, content };
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

/** บันทึกบทสนทนา (user, assistant) ลง DB */
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

/** เก็บสถานะการสั่งซื้อ (เช่น ordered, pending) ไว้ใน MongoDB */
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
 * fetchSheetData: ดึงข้อมูลจาก Sheet (ในที่นี้คือ INSTRUCTIONS)
 * *** ห้ามลบหรือแก้ไขส่วนนี้ ***
 */
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


// ====================== 7) ฟังก์ชันส่งข้อความกลับ Facebook ======================
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
 * sendTextMessage:
 * - สแกน [SEND_IMAGE:...], [SEND_VIDEO:...] 
 * - ส่งทีละ segment (split [cut])
 */
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


// ====================== 8) ฟังก์ชันตรวจจับและบันทึกออเดอร์จาก Assistant ======================

/**
 * extractOrderDataWithGPT:
 * ใช้ GPT ช่วยสแกน assistantMsg เพื่อดึงข้อมูล (ชื่อ, ที่อยู่, เบอร์, โปร, total, paymentMethod ฯลฯ)
 * อาจไม่ต้องมีคำว่า "สรุปยอด" ก็ได้
 */
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
    return data;
  } catch (e) {
    console.error("extractOrderDataWithGPT error:", e);
    return { is_found: false };
  }
}

/**
 * saveOrderToSheet:
 *  บันทึกข้อมูล order ลงชีต (ORDERS_SPREADSHEET_ID) แถวถัดไป
 */
async function saveOrderToSheet(orderData) {
  try {
    const sheetsApi = await getSheetsApi();

    // [Timestamp, ชื่อ, ที่อยู่, เบอร์, โปร, total, paymentMethod]
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
      spreadsheetId: ORDERS_SPREADSHEET_ID,  // <-- ใช้ชีตอีกอันหนึ่ง (สำหรับบันทึกออเดอร์)
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
 * - เรียก extractOrderDataWithGPT เพื่อตรวจ assistantMsg
 * - ถ้า is_found = true => บันทึกลงชีต + อัปเดตสถานะ
 */
async function detectAndSaveOrder(userId, assistantMsg) {
  const parsed = await extractOrderDataWithGPT(assistantMsg);
  if (!parsed.is_found) {
    console.log("detectAndSaveOrder: No order data found");
    return;
  }

  // บันทึกลงชีต
  await saveOrderToSheet(parsed);
  // อัปเดตสถานะใน Mongo
  await updateCustomerOrderStatus(userId, "ordered");
}


// ====================== 9) Webhook Routes & Startup ======================
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

      for (const webhookEvent of entry.messaging) {
        // ข้าม event ที่ไม่ใช่ข้อความปกติ
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

        if (webhookEvent.message && webhookEvent.message.text) {
          // 1) ข้อความ Text
          const userMsg = webhookEvent.message.text;

          // ตัวอย่างคำสั่งปิด/เปิด AI
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

          // เรียก GPT สร้าง assistantMsg
          const history = await getChatHistory(userId);
          const systemInstructions = buildSystemInstructions();
          const assistantMsg = await getAssistantResponse(systemInstructions, history, userMsg);

          // บันทึกลง DB
          await saveChatHistory(userId, userMsg, assistantMsg);

          // ตรวจ assistantMsg มีข้อมูลออเดอร์หรือไม่
          await detectAndSaveOrder(userId, assistantMsg);

          // ส่งข้อความกลับ
          await sendTextMessage(userId, assistantMsg);

        } else if (webhookEvent.message && webhookEvent.message.attachments) {
          // 2) ข้อความแนบไฟล์ (image, video, ฯลฯ)
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

          // ถ้า AI ปิด => ไม่ตอบ
          if (!aiEnabled) {
            await saveChatHistory(userId, userContentArray, "");
            continue;
          }

          // AI ตอบ
          const history = await getChatHistory(userId);
          const systemInstructions = buildSystemInstructions();
          const assistantMsg = await getAssistantResponse(systemInstructions, history, userContentArray);

          // บันทึก
          await saveChatHistory(userId, userContentArray, assistantMsg);

          // ตรวจ assistantMsg ว่ามีข้อมูลออเดอร์ไหม
          await detectAndSaveOrder(userId, assistantMsg);

          // ส่งข้อความ
          await sendTextMessage(userId, assistantMsg);

        } else {
          console.log(">> [Webhook] Received event but not text/attachment:", webhookEvent);
        }
      }
    }
    // ตอบกลับ FB ว่า EVENT_RECEIVED
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

    console.log("Startup completed. Ready to receive webhooks.");
  } catch (err) {
    console.error("Startup error:", err);
  }
});
