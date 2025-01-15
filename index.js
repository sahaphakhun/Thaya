/*******************************************************
 * index.js (โค้ดเต็ม – ปรับให้ส่งรูป/วิดีโอแบบ sequential)
 * - ใช้ Express + body-parser (Webhook สำหรับ Facebook)
 * - MongoDB เก็บประวัติแชท (chat_history) และสถานะผู้ใช้ (active_user_status)
 * - ดึง systemInstructions จาก Google Docs + Google Sheets
 * - ใช้ OpenAI GPT ตอบ (model: "gpt-4o-mini" สามารถวิเคราะห์รูปได้)
 * - มีฟังก์ชันปิดระบบเอไอ ([ปิดระบบเอไอ]/[เปิดระบบเอไอ])
 * - ไม่ตอบผู้ใช้ระหว่างปิด AI (แต่ยังบันทึกประวัติ)
 * - ป้องกัน Echo message (is_echo) ไม่ให้ตอบตัวเองซ้ำ
 ********************************************************/

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const util = require('util');            // <--- เพิ่ม
const requestPost = util.promisify(request.post); // <--- เพิ่ม
const { google } = require('googleapis');
const { MongoClient } = require('mongodb');
const { OpenAI } = require('openai');

const app = express();
app.use(bodyParser.json());

// ====================== 1) ENV Config ======================
const PORT = process.env.PORT || 3000;

// ใส่ค่าสำคัญใน Environment Variables หรือแก้ตรงนี้เป็นค่าสายตรง
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN; 
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "XianTA1234";
const MONGO_URI = process.env.MONGO_URI;

// หากมีการเชื่อมต่อ Google Docs, Sheets
const GOOGLE_CLIENT_EMAIL = "aitar-888@eminent-wares-446512-j8.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGhyeINArKZgaV\nitEcK+o89ilPYeRNTNZgJT7VNHB5hgNLLeAcFLJ7IlCIqTLMoJEnnoDQil6aKaz8\nExVL83uSXRrzk4zQvtt3tIP31+9wOCb9D4ZGWfVP1tD0qdD4WJ1qqg1j1/8879pH\nUeQGEMuCnyVbcQ3GbYQjyYb3wEz/Qv7kMVggF+MIaGGw2NQwM0XcufSFtyxvvX2S\nb8uGc1A8R+Dn/tmcgMODhbtEgcMg6yXI5Y26MPfDjVrEbk0lfCr7IGFJX4ASYeKl\n0jhm0RGb+aya2cb55auLN3VPO5MQ+cOp8gHBf5GiC/YgF1gbRgF5b7LgmENBxSfH\nb3WVQodLAgMBAAECggEACKB14M7LdekXZHyAQrZL0EitbzQknLv33Xyw2B3rvJ7M\nr4HM/nC4eBj7y+ciUc8GZQ+CWc2GzTHTa66+mwAia1qdYbPp3LuhGM4Leq5zn/o+\nA3rJuG6PS4qyUMy89msPXW5fSj/oE535QREiFKYP2dtlia2GI4xoag+x9uZwfMUO\nWKEe7tiUoZQEiGhwtjLq9lyST4kGGmlhNee9OyhDJcw4uCt8Cepr++hMDleWUF6c\nX0nbGmoSS0sZ5Boy8ATMhw/3luaOAlTUEz/nVDvbbWlNL9etwLKiAVw+AQXsPHNW\nNWF7gyEIsEi0qSM3PtA1X7IdReRXHqmfiZs0J3qSQQKBgQD1+Yj37Yuqj8hGi5PY\n+M0ieMdGcbUOmJsM1yUmBMV4bfaTiqm504P6DIYAqfDDWeozcHwcdpG1AfFAihEi\nh6lb0qRk8YaGbzvac8mWhwo/jDA5QB97fjFa6uwtlewZ0Er/U3QmOeVVnVC1y1b0\nrbJD5yjvI3ve+gpwAz0glpIMiwKBgQDOnpD7p7ylG4NQunqmzzdozrzZP0L6EZyE\n141st/Hsp9rtO9/ADuH6WhpirQ516l5LLv7mLPA8S9CF/cSdWF/7WlxBPjM8WRs9\nACFNBJIwUfjzPnvECmtsayzRlKuyCAspnNSkzgtdtvf2xI82Z3BGov9goZfu+D4A\n36b1qXsIQQKBgQCO1CojhO0vyjPKOuxL9hTvqmBUWFyBMD4AU8F/dQ/RYVDn1YG+\npMKi5Li/E+75EHH9EpkO0g7Do3AaQNG4UjwWVJcfAlxSHa8Mp2VsIdfilJ2/8KsX\nQ2yXVYh04/Rn/No/ro7oT4AKmcGu/nbstxuncEgFrH4WOOzspATPsn72BwKBgG5N\nBAT0NKbHm0B7bIKkWGYhB3vKY8zvnejk0WDaidHWge7nabkzuLtXYoKO9AtKxG/K\ndNUX5F+r8XO2V0HQLd0XDezecaejwgC8kwp0iD43ZHkmQBgVn+dPB6wSe94coSjj\nyjj4reSnipQ3tmRKsAtldIN3gI5YA3Gf85dtlHqBAoGAD5ePt7cmu3tDZhA3A8f9\no8mNPvqz/WGs7H2Qgjyfc3jUxEGhVt1Su7J1j+TppfkKtJIDKji6rVA9oIjZtpZT\ngxnU6hcYuiwbLh3wGEFIjP1XeYYILudqfWOEbwnxD1RgMkCqfSHf/niWlfiH6p3F\ndnBsLY/qXdKfS/OXyezAm4M=\n-----END PRIVATE KEY-----\n";

const GOOGLE_DOC_ID = "1IDvCXWa_5QllMTKrVSvhLRQPNNGkYgxb8byaDGGEhyU"
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

/** ดึงประวัติแชทของ userId นั้น (PSID) */
async function getChatHistory(userId) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("chat_history");
  const chats = await coll.find({ senderId: userId }).sort({ timestamp: 1 }).toArray();
  return chats.map(ch => ({
    role: ch.role,
    content: ch.content,
  }));
}

/** บันทึกข้อความ user และข้อความตอบ (assistant) ลง DB */
async function saveChatHistory(userId, userMsg, assistantMsg) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("chat_history");

  // ถ้า userMsg เป็น object/array => แปลงเป็น string
  let userMsgToSave = typeof userMsg === "object" ? JSON.stringify(userMsg) : userMsg;

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
      range,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log("No data found in sheet.");
      return [];
    }
    return rows;
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    return [];
  }
}

function transformSheetRowsToJSON(rows) {
  return rows.map(row => {
    return {
      title: row[0] || "",
      content: row[1] || ""
    };
  });
}

// ตัวแปรเพื่อเก็บข้อมูลที่ดึงมา
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
      // หาก content ใน DB เป็น string ให้ใช้ตรง ๆ / ถ้าเป็น JSON string อาจต้อง parse ก่อน
      ...history.map(h => {
        try {
          const parsed = JSON.parse(h.content);
          return { role: h.role, content: parsed };
        } catch(e) {
          return { role: h.role, content: h.content };
        }
      })
    ];

    // push user message
    if (typeof userContent === "string") {
      messages.push({ role: "user", content: userContent });
    } else {
      messages.push({ role: "user", content: userContent });
    }

    // เรียกโมเดล
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2,
    });

    // ดึงข้อความของ assistant
    const assistantReply = response.choices[0].message.content;
    return (typeof assistantReply === "string") 
      ? assistantReply.trim()
      : JSON.stringify(assistantReply);

  } catch (error) {
    console.error("Error getAssistantResponse:", error);
    return "ขออภัยค่ะ ระบบขัดข้องชั่วคราว ไม่สามารถตอบได้ในขณะนี้";
  }
}


// ====================== 7) ฟังก์ชันส่งข้อความกลับ Facebook (เวอร์ชัน async/await) ======================

/**
 * ส่งข้อความตัวอักษรธรรมดา (async)
 */
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

/**
 * ส่งรูปภาพ (async)
 */
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

/**
 * ส่งวิดีโอ (async)
 */
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
 * ฟังก์ชันหลักในการสั่งส่งข้อความ (ตรวจจับ [cut], [SEND_IMAGE], [SEND_VIDEO]) แบบรอเรียงลำดับ
 */
async function sendTextMessage(userId, response) {
  // 1) สปลิตข้อความตาม "[cut]"
  const segments = response.split("[cut]").map(s => s.trim()).filter(Boolean);

  // 2) วนลูปตามเซกเมนต์
  for (const segment of segments) {

    // ตรวจจับลิงก์รูป
    const imageRegex = /\[SEND_IMAGE:(https?:\/\/[^\s]+)\]/g;
    const images = [...segment.matchAll(imageRegex)];

    // ตรวจจับลิงก์วิดีโอ
    const videoRegex = /\[SEND_VIDEO:(https?:\/\/[^\s]+)\]/g;
    const videos = [...segment.matchAll(videoRegex)];

    // ตัดคำสั่งรูป/วิดีโอ ออก
    let textPart = segment
      .replace(imageRegex, '')
      .replace(videoRegex, '')
      .trim();

    // 2.1) ส่งข้อความตัวอักษร (ถ้ามี)
    if (textPart) {
      await sendSimpleTextMessage(userId, textPart);
    }

    // 2.2) ส่งรูปทีละรูป
    for (const match of images) {
      const imageUrl = match[1];
      await sendImageMessage(userId, imageUrl);
    }

    // 2.3) ส่งวิดีโอทีละอัน
    for (const match of videos) {
      const videoUrl = match[1];
      await sendVideoMessage(userId, videoUrl);
    }

    // (ถ้าต้องการเว้นจังหวะเล็กน้อยระหว่างเซกเมนต์ ก็ใส่ setTimeout หรือ await sleep(...) ที่นี่)
  }
}


// ====================== 8) Webhook Routes & Startup ======================

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
  // 1) ตรวจสอบ object
  if (req.body.object === 'page') {
    // 2) วนซ้ำ entry ต่าง ๆ 
    for (const entry of req.body.entry) {
      // ตรวจสอบว่ามี messaging
      if (!entry.messaging || entry.messaging.length === 0) {
        continue;
      }

      // เอา event ตัวแรกออกมา
      const webhookEvent = entry.messaging[0];
      if (!webhookEvent) continue;

      // -----------------------------
      // A) ถ้าเป็น echo จากเพจเอง?
      // -----------------------------
      if (webhookEvent.message && webhookEvent.message.is_echo) {
        const userMsg = webhookEvent.message.text || "";
        
        // ตรวจสอบคำสั่ง ปิด/เปิด ai
        if (userMsg === "สวัสดีค่า แอดมิน Venus นะคะ จะมาดำเนินเรื่องต่อ") {
          const pageId = entry.id; 
          let userId = (webhookEvent.sender.id === pageId) 
            ? webhookEvent.recipient.id 
            : webhookEvent.sender.id;
          await setUserStatus(userId, false);
          await sendSimpleTextMessage(userId, "แอดมิน Venus สวัสดีค่ะ");
          await saveChatHistory(userId, userMsg, "แอดมิน Venus สวัสดีค่ะ");
          continue;
        } else if (userMsg === "ขอนุญาตส่งต่อให้ทางแอดมินประจำสนทนาต่อนะคะ") {
          const pageId = entry.id; 
          let userId = (webhookEvent.sender.id === pageId) 
            ? webhookEvent.recipient.id 
            : webhookEvent.sender.id;
          await setUserStatus(userId, true);
          await sendSimpleTextMessage(userId, "แอดมิน Venus ขอตัวก่อนนะคะ");
          await saveChatHistory(userId, userMsg, "แอดมิน Venus ขอตัวก่อนนะคะ");
          continue;
        }

        console.log(">> [Webhook] Skip echo message from page (not an AI command).");
        continue;
      }

      // -----------------------------
      // B) หา userId สำหรับกรณีทั่วไป
      // -----------------------------
      const pageId = entry.id; 
      let userId = (webhookEvent.sender.id === pageId)
        ? webhookEvent.recipient.id
        : webhookEvent.sender.id;

      // ดึงสถานะ aiEnabled
      const userStatus = await getUserStatus(userId);
      const aiEnabled = userStatus.aiEnabled;

      // -----------------------------
      // C) ถ้าเป็นข้อความ text
      // -----------------------------
      if (webhookEvent.message && webhookEvent.message.text) {
        const userMsg = webhookEvent.message.text;

        // เช็กคำสั่ง ปิด/เปิด ai
        if (userMsg === "สวัสดีค่า แอดมิน Venus นะคะ จะมาดำเนินเรื่องต่อ") {
          await setUserStatus(userId, false);
          await sendSimpleTextMessage(userId, "แอดมิน Venus สวัสดีค่ะ");
          await saveChatHistory(userId, userMsg, "แอดมิน Venus สวัสดีค่ะ");
          continue;
        } else if (userMsg === "ขอนุญาตส่งต่อให้ทางแอดมินประจำสนทนาต่อนะคะ") {
          await setUserStatus(userId, true);
          await sendSimpleTextMessage(userId, "แอดมิน Venus ขอตัวก่อนนะคะ");
          await saveChatHistory(userId, userMsg, "แอดมิน Venus ขอตัวก่อนนะคะ");
          continue;
        }

        // ถ้า ai ถูกปิด
        if (!aiEnabled) {
          await saveChatHistory(userId, userMsg, "");
          continue;
        }

        // aiEnabled = true => เรียก GPT
        const history = await getChatHistory(userId);
        const systemInstructions = buildSystemInstructions();
        const assistantMsg = await getAssistantResponse(systemInstructions, history, userMsg);

        await saveChatHistory(userId, userMsg, assistantMsg);
        await sendTextMessage(userId, assistantMsg);

      // -----------------------------
      // D) ถ้าเป็นไฟล์แนบ (image, ฯลฯ)
      // -----------------------------
      } else if (webhookEvent.message && webhookEvent.message.attachments) {
        const attachments = webhookEvent.message.attachments;

        // สร้าง content array สำหรับผู้ใช้
        let userContentArray = [{
          type: "text",
          text: "ผู้ใช้ส่งไฟล์แนบ",
        }];

        // วนลูป attachments
        for (const att of attachments) {
          if (att.type === 'image') {
            // ดึง URL ของรูปจาก att.payload.url
            userContentArray.push({
              type: "image_url",
              image_url: {
                url: att.payload.url,
                detail: "auto"
              }
            });
          } else {
            // ถ้าเป็นไฟล์อื่น (audio, video, location)
            userContentArray.push({
              type: "text",
              text: `ไฟล์แนบประเภท: ${att.type} (ยังไม่รองรับส่งต่อเป็นรูป)`
            });
          }
        }

        if (!aiEnabled) {
          // บันทึกอย่างเดียว
          await saveChatHistory(userId, userContentArray, "");
          continue;
        }

        // aiEnabled = true => เรียก GPT
        const history = await getChatHistory(userId);
        const systemInstructions = buildSystemInstructions();
        const assistantMsg = await getAssistantResponse(systemInstructions, history, userContentArray);

        await saveChatHistory(userId, userContentArray, assistantMsg);
        await sendTextMessage(userId, assistantMsg);

      } else {
        console.log(">> [Webhook] Received event but not text/attachment:", webhookEvent);
      }
    }
    // ตอบกลับ Facebook ว่าได้รับ event แล้ว
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
