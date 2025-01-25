/*******************************************************
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
const GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhki...\n-----END PRIVATE KEY-----\n";

// ------------------- (A) Google Docs -------------------
const GOOGLE_DOC_ID = "1IDvCXWa_5QllMTKrVSvhLRQPNNGkYgxb8byaDGGEhyU";

// ------------------- (B) Google Sheet สำหรับ "INSTRUCTIONS" -------------------
const SPREADSHEET_ID = "1esN_P6JuPzYUGesR60zVuIGeuvSnRM1hlyaxCJbhI_c";

// ------------------- (C) Google Sheet สำหรับ "บันทึกออเดอร์" (ใหม่) -------------------
const ORDERS_SPREADSHEET_ID = "1f783DDFR0ZZDM4wG555Zpwmq6tQ2e9tWT28H0qRBPhU";
const SHEET_NAME_FOR_ORDERS = "บันทึกออเดอร์";
const ORDERS_RANGE = `${SHEET_NAME_FOR_ORDERS}!A2:H`;

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

  let userMsgToSave = (typeof userMsg === "string") ? userMsg : JSON.stringify(userMsg);

  console.log("[DEBUG] Saving chat history...");
  await coll.insertOne({
    senderId: userId,
    role: "user",
    content: userMsgToSave,
    timestamp: new Date(),
  });
  console.log(`[DEBUG] Saved user message. userId=${userId}`);

  await coll.insertOne({
    senderId: userId,
    role: "assistant",
    content: assistantMsg,
    timestamp: new Date(),
  });
  console.log(`[DEBUG] Saved assistant message. userId=${userId}`);
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

/** เก็บสถานะการสั่งซื้อ (เช่น ordered, pending) ไว้ใน MongoDB */
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


// ====================== 4) ดึงข้อมูลจาก Google Sheets (INSTRUCTIONS) ทุกแท็บ ======================
async function getSheetsApi() {
  const sheetsAuth = new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: sheetsAuth });
}

/**
 * fetchAllSheetsData:
 *  - ดึงแท็บทั้งหมดจาก spreadsheetId
 *  - ลูปทุกแท็บ แล้ว get range = "!A:ZZZ"
 *  - parse โดยข้าม cell ที่ว่าง, แปลง number
 *  - คืนเป็น array [{ sheetName, data: [...] }, ...]
 */
async function fetchAllSheetsData(spreadsheetId) {
  const sheetsApi = await getSheetsApi();
  const { data } = await sheetsApi.spreadsheets.get({ spreadsheetId });

  const allSheetsData = [];
  for (const sheet of data.sheets) {
    const sheetName = sheet.properties.title;
    const range = `${sheetName}!A:ZZZ`; 
    const response = await sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      // ไม่มีข้อมูลในแท็บนี้
      continue;
    }

    const parsedData = parseSheetRowsSkipEmpty(rows);
    allSheetsData.push({
      sheetName,
      data: parsedData
    });
  }

  return allSheetsData;
}

/**
 * parseSheetRowsSkipEmpty:
 *  - แปลงแถวแรกเป็น headers
 *  - ข้ามค่าว่าง
 *  - ถ้าเป็นตัวเลข => parseFloat
 */
function parseSheetRowsSkipEmpty(rows) {
  if (!rows || rows.length < 2) return [];

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return dataRows.map((row) => {
    const obj = {};
    headers.forEach((header, colIndex) => {
      const cellValue = row[colIndex];
      if (cellValue && cellValue.trim() !== "") {
        if (!isNaN(cellValue)) {
          obj[header] = parseFloat(cellValue);
        } else {
          obj[header] = cellValue;
        }
      }
    });
    return obj;
  });
}

let sheetJSON = [];  // เก็บข้อมูลจากทุกแท็บ

/**
 * buildSystemInstructions:
 *  รวม Google Doc + sheetJSON => systemInstructions
 */
function buildSystemInstructions() {
  const sheetsDataString = JSON.stringify(sheetJSON, null, 2);
  const finalSystemInstructions = `
You are an AI chatbot for THAYA. 
Below are instructions from the Google Doc:
---
${googleDocInstructions}

Below is additional data from Google Sheets (INSTRUCTIONS) - all tabs:
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

    // เรียกโมเดลหลัก
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
const ORDER_PARSER_ENABLED = false;  // ปิดโมเดลเล็กสำหรับสกัดข้อมูลออเดอร์
const ORDER_PARSER_MODEL = "gpt-4o-mini";

async function extractOrderDataWithGPT(assistantMsg) {
  if (!ORDER_PARSER_ENABLED) {
    console.log("[DEBUG] ORDER_PARSER_ENABLED = false => skip calling GPT for order extraction");
    return { is_found: false };
  }

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
    console.log("[DEBUG] extractOrderDataWithGPT => calling GPT for order parsing...");
    const messages = [
      { role: "system", content: sysPrompt },
      { role: "user", content: assistantMsg }
    ];

    const response = await openai.chat.completions.create({
      model: ORDER_PARSER_MODEL,
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

  // 2) สกัดข้อมูลออเดอร์ (จะข้ามถ้า ORDER_PARSER_ENABLED = false)
  const parsed = await extractOrderDataWithGPT(assistantMsg);
  if (!parsed.is_found) {
    console.log("[DEBUG] detectAndSaveOrder: No order data found => skip saving");
    return;
  }

  // 3) ใส่ fb_name ก่อนบันทึก
  parsed.fb_name = fbName || "";

  // 4) บันทึกลงชีต
  await saveOrderToSheet(parsed);

  // 5) อัปเดตสถานะใน Mongo
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

      // เก็บ pageId ไว้ (sender ของบาง event)
      const pageId = entry.id; 

      for (const webhookEvent of entry.messaging) {
        // ข้าม delivery/read event
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
        // 1) ระบุ userId จาก event
        // ---------------------------
        let userId = (webhookEvent.sender.id === pageId)
          ? webhookEvent.recipient.id
          : webhookEvent.sender.id;

        // ---------------------------
        // 2) เช็คว่ามี message => text หรือ attachments
        // ---------------------------
        if (webhookEvent.message) {
          const textMsg = webhookEvent.message.text || "";
          const isEcho = webhookEvent.message.is_echo === true;
          const attachments = webhookEvent.message.attachments;

          // (A) Echo จากแอดมินเพจ => เช็คเปิด/ปิด AI
          if (isEcho) {
            if (textMsg === "แอดมิน THAYA รอให้คำปรึกษาค่ะ") {
              console.log(`[DEBUG] is_echo event from admin => toggle AI off, userId=${userId}`);
              await setUserStatus(userId, false);
              await saveChatHistory(userId, textMsg, "(Admin toggled off AI)");
              continue;
            } else if (textMsg === "แอดมิน THAYA ยินดีดูแลลูกค้าค่ะ") {
              console.log(`[DEBUG] is_echo event from admin => toggle AI on, userId=${userId}`);
              await setUserStatus(userId, true);
              await saveChatHistory(userId, textMsg, "(Admin toggled on AI)");
              continue;
            } else {
              console.log("Skipping other echo");
              continue;
            }
          }

          // (B) ข้อความจากลูกค้าจริง ๆ
          const userStatus = await getUserStatus(userId);
          const aiEnabled = userStatus.aiEnabled;

          if (textMsg && !attachments) {
            // มีข้อความ text ธรรมดา
            console.log(`[DEBUG] Received text from userId=${userId}:`, textMsg);

            if (!aiEnabled) {
              // AI ปิด => บันทึกอย่างเดียว
              await saveChatHistory(userId, textMsg, "");
              continue;
            }

            // AI เปิด => เรียก GPT
            const history = await getChatHistory(userId);
            const systemInstructions = buildSystemInstructions();
            const assistantMsg = await getAssistantResponse(systemInstructions, history, textMsg);

            // บันทึกลง DB
            await saveChatHistory(userId, textMsg, assistantMsg);

            // ตรวจว่า assistantMsg มีออเดอร์ไหม
            await detectAndSaveOrder(userId, assistantMsg);

            // ส่งข้อความกลับ
            await sendTextMessage(userId, assistantMsg);

          } else if (attachments && attachments.length > 0) {
            // มีไฟล์แนบ (image, video, etc.)
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
              // AI ปิด => บันทึกเฉย ๆ
              await saveChatHistory(userId, userContentArray, "");
              continue;
            }

            // AI เปิด => เรียก GPT
            const history = await getChatHistory(userId);
            const systemInstructions = buildSystemInstructions();
            const assistantMsg = await getAssistantResponse(systemInstructions, history, userContentArray);

            // บันทึก
            await saveChatHistory(userId, userContentArray, assistantMsg);

            // ตรวจออเดอร์
            await detectAndSaveOrder(userId, assistantMsg);

            // ส่งข้อความ
            await sendTextMessage(userId, assistantMsg);

          } else {
            // ไม่มี text, ไม่มีไฟล์แนบ
            console.log(">> [Webhook] Received empty message:", webhookEvent);
          }
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

// ====================== 10) ตั้งให้อัพเดท sheetJSON ใหม่ทุก 1 ชั่วโมง (เมื่อเวลาลงท้ายด้วย XX:00) ======================
let lastUpdatedHour = -1;  // เก็บชั่วโมงล่าสุดที่อัปเดต

function scheduleHourlyRefresh() {
  setInterval(async () => {
    const now = new Date(); 
    const currentMinute = now.getMinutes(); 
    const currentHour = now.getHours();

    // เช็คถ้า minute == 0 (ต้นชั่วโมง) และยังไม่อัปเดตในชั่วโมงนี้
    if (currentMinute === 0 && lastUpdatedHour !== currentHour) {
      console.log("[DEBUG] It's a new hour => refreshing sheet data...");
      try {
        sheetJSON = await fetchAllSheetsData(SPREADSHEET_ID);
        lastUpdatedHour = currentHour;
        console.log(`[DEBUG] sheetJSON updated at hour=${currentHour}`);
      } catch (err) {
        console.error("Hourly sheet update error:", err);
      }
    }
  }, 60 * 1000);  // เช็คทุก 1 นาที
}

// ====================== Start Server ======================
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);

  try {
    // 1) เชื่อมต่อ DB
    await connectDB();

    // 2) ดึง instructions จาก Google Docs
    await fetchGoogleDocInstructions();

    // 3) โหลดข้อมูลจาก Google Sheet (INSTRUCTIONS) ทุกแท็บ (ครั้งแรก)
    sheetJSON = await fetchAllSheetsData(SPREADSHEET_ID);

    // 4) เรียกใช้งาน scheduleHourlyRefresh
    scheduleHourlyRefresh();

    console.log("[DEBUG] Startup completed. Ready to receive webhooks.");
  } catch (err) {
    console.error("Startup error:", err);
  }
});
