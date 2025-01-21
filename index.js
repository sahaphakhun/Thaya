/*******************************************************
 * Example: เพิ่มฟังก์ชัน parse/bind ลง Google Sheet
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

// (ถ้าอยากเรียกใช้ GPT อีกตัวสำหรับ parser อาจประกาศ KEY แยกได้ เช่น PARSER_API_KEY เป็นต้น)
// ในตัวอย่างจะสมมติใช้ key เดียวกันก่อน
const GPT_PARSER_MODEL = "gpt-4o-mini"; // ระบุชื่อโมเดลแยกจาก gpt ตัวหลักได้

// หากมีการเชื่อมต่อ Google Docs, Sheets
const GOOGLE_CLIENT_EMAIL = "aitar-888@eminent-wares-446512-j8.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhki...
-----END PRIVATE KEY-----`;
const GOOGLE_DOC_ID = "1IDvCXWa_5QllMTKrVSvhLRQPNNGkYgxb8byaDGGEhyU";
const SPREADSHEET_ID = "1f783DDFR0ZZDM4wG555Zpwmq6tQ2e9tWT28H0qRBPhU";

// ตัวอย่าง: ชีตบันทึกออเดอร์ชื่อ "OrderSheet" (หรือ "ชีต1") เริ่มใส่ตั้งแต่ A2 เป็นต้นไป
const SHEET_ORDER_NAME = "OrderSheet"; // เปลี่ยนตามต้องการ
const SHEET_ORDER_RANGE = `${SHEET_ORDER_NAME}!A2`; 

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

async function getChatHistory(userId) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("chat_history");
  const chats = await coll.find({ senderId: userId }).sort({ timestamp: 1 }).toArray();
  
  return chats.map(ch => {
    // ลอง parse เพื่อดูว่าเป็น array หรือ string
    try {
      const parsed = JSON.parse(ch.content);
      return normalizeRoleContent(ch.role, parsed);
    } catch (err) {
      // ถ้า parse ไม่ได้ แสดงว่าเป็น string ปกติ
      return normalizeRoleContent(ch.role, ch.content);
    }
  });
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

// เก็บว่า aiEnabled หรือไม่
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
 * เก็บ "สถานะการสั่งซื้อ" (ในอนาคตจะได้ตามฟีเจอร์ที่ต้องการ เช่น "ordered", "followup", "cancelled" ...)
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


// ====================== 4) ดึงข้อมูลจาก Google Sheets (หากต้องการเป็น reference) ======================

async function getSheetsApi() {
  const sheetsAuth = new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: sheetsAuth });
}

/** 
 * ฟังก์ชัน append แถวใหม่ในชีต (เช่น การบันทึกออเดอร์)
 * @param {Array} rowData - เช่น `["FB_123456", "2025-01-01 10:00", "ชื่อลูกค้า", "ที่อยู่", "...", ""]`
 */
async function appendToOrderSheet(rowData) {
  try {
    const sheetsApi = await getSheetsApi();
    await sheetsApi.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_ORDER_RANGE,       // ตัวอย่าง "OrderSheet!A2"
      valueInputOption: 'RAW',        // หรือ "USER_ENTERED"
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [rowData]  // ต้องเป็น array of array
      }
    });
    console.log("Append order row to Google Sheet success:", rowData);
  } catch (err) {
    console.error("Failed to append data to sheet:", err);
  }
}


// ====================== 5) systemInstructions รวม Docs + (ถ้ามี) ข้อมูลจาก Sheet ======================
let sheetJSON = []; // ถ้าต้องการดึงข้อมูลจาก Sheet มาสร้าง Knowledge Base ก็ประยุกต์ได้

function buildSystemInstructions() {
  // แปลง Sheet JSON เป็น string
  const sheetsDataString = JSON.stringify(sheetJSON, null, 2);
  const finalSystemInstructions = `
You are an AI chatbot for THAYA. 
Below are instructions from the Google Doc:
---
${googleDocInstructions}

Below is additional data from Google Sheets:
---
${sheetsDataString}

(คำสั่งเกี่ยวกับรูปและความเป็นส่วนตัว ... )
  `.trim();

  return finalSystemInstructions;
}


// ====================== 6) เรียก GPT หลัก (ตอบแชทปกติ) ======================
async function getAssistantResponse(systemInstructions, history, userContent) {
  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const messages = [
      { role: "system", content: systemInstructions },
      ...history
    ];
    messages.push(normalizeRoleContent("user", userContent));

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // หรือโมเดลหลัก
      messages,
      temperature: 0.1,
    });

    let assistantReply = response.choices[0].message.content;
    if (typeof assistantReply !== "string") {
      assistantReply = JSON.stringify(assistantReply);
    }

    // ป้องกัน [cut] วนลูป ฯลฯ
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

// ---------------------- (ใหม่) ฟังก์ชันเรียก GPT/Regex เพื่อ parse "สรุปยอดการสั่งซื้อ" ----------------------
async function parseOrderSummaryWithGPT(text) {
  // เราจะลองตรวจจับด้วย GPT หรือถ้าอยากเขียน Regex เองก็ได้
  // ตัวอย่าง prompt สำหรับ GPT Parser:
  const parserOpenAI = new OpenAI({ apiKey: OPENAI_API_KEY }); // หรือใช้ key คนละตัวได้
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

    - If any field is missing or the text does not appear to be an order summary, return an empty JSON.
    - Output a JSON object with keys:
      {
        "promotion": string,
        "customerName": string,
        "address": string,
        "phone": string,
        "totalPrice": string,
        "paymentMethod": string
      }
    - Fields can be empty if not found
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
    // ลอง parse JSON
    const parsed = JSON.parse(rawJson);
    // ถ้าสำเร็จ return
    return parsed;
  } catch (e) {
    console.error("parseOrderSummaryWithGPT error:", e);
    return {};
  }
}

/**
 * checkAndSaveOrderSummary:
 *  - ตรวจว่ามี "สรุปยอดการสั่งซื้อ" หรือไม่
 *  - ถ้ามี เรียก GPT parser ดึงข้อมูล -> append Google Sheet -> set user purchase status
 */
async function checkAndSaveOrderSummary(assistantMsg, userId) {
  // แบบง่าย: เช็กด้วย regex หรือคำว่า "สรุปยอดการสั่งซื้อ"
  if (!assistantMsg.includes("สรุปยอดการสั่งซื้อ")) {
    return; // ไม่พบ keyword ก็ข้าม
  }

  // เรียก parser
  const orderData = await parseOrderSummaryWithGPT(assistantMsg);

  // ถ้าสรุปมาไม่สมบูรณ์ (อาจเป็น {} เปล่า) ก็ข้าม
  if (
    !orderData.customerName &&
    !orderData.address &&
    !orderData.totalPrice
  ) {
    return;
  }

  // สร้าง rowData เพื่อบันทึกลงชีต
  // ตัวอย่างคอลัมน์: [FacebookId, Timestamp, Promotion, CustomerName, Address, Phone, TotalPrice, PaymentMethod]
  const fbNameOrId = userId; // หรือหากมีฟังก์ชันดึง FB Profile -> ชื่อจริง
  const now = new Date().toISOString(); // หรือฟอร์แมตเป็น locale

  // รายละเอียดออเดอร์ถ้าต้องการ (บางที assistant อาจเขียนใน text ให้, หรือแก้ใน future)
  // สมมติเรายังเก็บเป็นข้อความว่า "N/A" หรือ orderDetail (ถ้าอยาก parse เพิ่มเติม)
  const orderDetail = "N/A";

  const rowData = [
    fbNameOrId,
    now,
    orderData.promotion || "",
    orderData.customerName || "",
    orderDetail,
    orderData.address || "",
    orderData.phone || "",
    orderData.totalPrice || "",
    orderData.paymentMethod || ""
  ];

  // Append
  await appendToOrderSheet(rowData);

  // อัปเดตสถานะใน MongoDB
  await setUserPurchaseStatus(userId, "ordered");
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
 * ตัดข้อความตาม [cut], แยก [SEND_IMAGE], [SEND_VIDEO] แล้วส่งทีละ segment
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


// ====================== 8) Webhook Routes & Startup ======================
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

        // เช็กปุ่มเปิด/ปิด AI ง่าย ๆ
        if (webhookEvent.message?.text) {
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
            // AI ปิด
            await saveChatHistory(userId, userMsg, "");
            continue;
          }

          // AI เปิด => เรียก GPT
          const history = await getChatHistory(userId);
          const systemInstructions = buildSystemInstructions();
          const assistantMsg = await getAssistantResponse(systemInstructions, history, userMsg);

          // บันทึก
          await saveChatHistory(userId, userMsg, assistantMsg);

          // *** เรียกฟังก์ชันเช็กสรุปออเดอร์ -> ถ้ามี -> บันทึกลง Sheet ***
          await checkAndSaveOrderSummary(assistantMsg, userId);

          // ส่งข้อความออก
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
                image_url: { url: att.payload.url, detail: "auto" }
              });
            } else {
              userContentArray.push({
                type: "text",
                text: `ไฟล์แนบประเภท: ${att.type} (ยังไม่รองรับส่งต่อเป็นไฟล์)`,
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

          // *** เรียกฟังก์ชันเช็กสรุปออเดอร์ -> ถ้ามี -> บันทึกลง Sheet ***
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

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    await connectDB();
    await fetchGoogleDocInstructions();
    // ดึงข้อมูลจาก Sheet (กรณีอยากเก็บค่าอ้างอิงไว้ใน sheetJSON)
    // ตัวอย่างข้ามไปก่อน
    // sheetJSON = await fetchSheetAndTransform();

    console.log("Startup completed. Ready to receive webhooks.");
  } catch (err) {
    console.error("Startup error:", err);
  }
});
