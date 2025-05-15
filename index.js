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

// เปลี่ยนจาก PAGE_ACCESS_TOKEN เป็น PAGE_ACCESS_TOKENS (รองรับหลายเพจ)
const PAGE_ACCESS_TOKENS = {
  default: process.env.PAGE_ACCESS_TOKEN, // เพจหลักเดิม
  page2: process.env.PAGE_ACCESS_TOKEN_2, // เพจที่ 2
  page3: process.env.PAGE_ACCESS_TOKEN_3, // เพจที่ 3
  page4: process.env.PAGE_ACCESS_TOKEN_4,  // เพจที่ 4
  page5: process.env.PAGE_ACCESS_TOKEN_5,  // เพจที่ 5
  page6: process.env.PAGE_ACCESS_TOKEN_6,  // เพจที่ 6
  page7: process.env.PAGE_ACCESS_TOKEN_7,  // เพจที่ 7
  page8: process.env.PAGE_ACCESS_TOKEN_8,  // เพจที่ 8
  page9: process.env.PAGE_ACCESS_TOKEN_9,  // เพจที่ 9
  page10: process.env.PAGE_ACCESS_TOKEN_10, // เพจที่ 10
  page11: process.env.PAGE_ACCESS_TOKEN_11  // เพจที่ 11
};
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "AiDee_a4wfaw4";
const MONGO_URI = process.env.MONGO_URI;

// เพิ่มการเก็บข้อมูลเพจ (pageId -> pageName)
const PAGE_MAPPING = {
  // ตัวอย่าง: 'page_id_1': 'default', 'page_id_2': 'page2', ...
  // จะถูกเติมข้อมูลอัตโนมัติเมื่อมีการรับ webhook
};

// หากมีการเชื่อมต่อ Google Docs, Sheets
const GOOGLE_CLIENT_EMAIL = "aitar-888@eminent-wares-446512-j8.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGhyeINArKZgaV\nitEcK+o89ilPYeRNTNZgJT7VNHB5hgNLLeAcFLJ7IlCIqTLMoJEnnoDQil6aKaz8\nExVL83uSXRrzk4zQvtt3tIP31+9wOCb9D4ZGWfVP1tD0qdD4WJ1qqg1j1/8879pH\nUeQGEMuCnyVbcQ3GbYQjyYb3wEz/Qv7kMVggF+MIaGGw2NQwM0XcufSFtyxvvX2S\nb8uGc1A8R+Dn/tmcgMODhbtEgcMg6yXI5Y26MPfDjVrEbk0lfCr7IGFJX4ASYeKl\n0jhm0RGb+aya2cb55auLN3VPO5MQ+cOp8gHBf5GiC/YgF1gbRgF5b7LgmENBxSfH\nb3WVQodLAgMBAAECggEACKB14M7LdekXZHyAQrZL0EitbzQknLv33Xyw2B3rvJ7M\nr4HM/nC4eBj7y+ciUc8GZQ+CWc2GzTHTa66+mwAia1qdYbPp3LuhGM4Leq5zn/o+\nA3rJuG6PS4qyUMy89msPXW5fSj/oE535QREiFKYP2dtlia2GI4xoag+x9uZwfMUO\nWKEe7tiUoZQEiGhwtjLq9lyST4kGGmlhNee9OyhDJcw4uCt8Cepr++hMDleWUF6c\nX0nbGmoSS0sZ5Boy8ATMhw/3luaOAlTUEz/nVDvbbWlNL9etwLKiAVw+AQXsPHNW\nNWF7gyEIsEi0qSM3PtA1X7IdReRXHqmfiZs0J3qSQQKBgQD1+Yj37Yuqj8hGi5PY\n+M0ieMdGcbUOmJsM1yUmBMV4bfaTiqm504P6DIYAqfDDWeozcHwcdpG1AfFAihEi\nh6lb0qRk8YaGbzvac8mWhwo/jDA5QB97fjFa6uwtlewZ0Er/U3QmOeVVnVC1y1b0\nrbJD5yjvI3ve+gpwAz0glpIMiwKBgQDOnpD7p7ylG4NQunqmzzdozrzZP0L6EZyE\n141st/Hsp9rtO9/ADuH6WhpirQ516l5LLv7mLPA8S9CF/cSdWF/7WlxBPjM8WRs9\nACFNBJIwUfjzPnvECmtsayzRlKuyCAspnNSkzgtdtvf2xI82Z3BGov9goZfu+D4A\n36b1qXsIQQKBgQCO1CojhO0vyjPKOuxL9hTvqmBUWFyBMD4AU8F/dQ/RYVDn1YG+\npMKi5Li/E+75EHH9EpkO0g7Do3AaQNG4UjwWVJcfAlxSHa8Mp2VsIdfilJ2/8KsX\nQ2yXVYh04/Rn/No/ro7oT4AKmcGu/nbstxuncEgFrH4WOOzspATPsn72BwKBgG5N\nBAT0NKbHm0B7bIKkWGYhB3vKY8zvnejk0WDaidHWge7nabkzuLtXYoKO9AtKxG/K\ndNUX5F+r8XO2V0HQLd0XDezecaejwgC8kwp0iD43ZHkmQBgVn+dPB6wSe94coSjj\nyjj4reSnipQ3tmRKsAtldIN3gI5YA3Gf85dtlHqBAoGAD5ePt7cmu3tDZhA3A8f9\no8mNPvqz/WGs7H2Qgjyfc3jUxEGhVt1Su7J1j+TppfkKtJIDKji6rVA9oIjZtpZT\ngxnU6hcYuiwbLh3wGEFIjP1XeYYILudqfWOEbwnxD1RgMkCqfSHf/niWlfiH6p3F\ndnBsLY/qXdKfS/OXyezAm4M=\n-----END PRIVATE KEY-----\n";

// ------------------- (A) Google Docs -------------------
const GOOGLE_DOC_ID = "1IDvCXWa_5QllMTKrVSvhLRQPNNGkYgxb8byaDGGEhyU";

// ------------------- (B) Google Sheet สำหรับ "INSTRUCTIONS" -------------------
const SPREADSHEET_ID = "1esN_P6JuPzYUGesR60zVuIGeuvSnRM1hlyaxCJbhI_c";
const SHEET_RANGE = "ชีต1!A2:B28";  // (ยังคงเดิม ไม่แก้ส่วนนี้)

// ------------------- (C) Google Sheet สำหรับ "บันทึกออเดอร์" (ใหม่) -------------------
const ORDERS_SPREADSHEET_ID = "1f783DDFR0ZZDM4wG555Zpwmq6tQ2e9tWT28H0qRBPhU";
const SHEET_NAME_FOR_ORDERS = "บันทึกออเดอร์";
const ORDERS_RANGE = `${SHEET_NAME_FOR_ORDERS}!A2:K`; 

// (NEW) สำหรับ Follow-up - แก้เป็น "A2:B" เพื่อไม่จำกัดจำนวนแถว
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

// เพิ่มฟังก์ชันสำหรับบันทึกประวัติการสนทนาสำหรับโมเดลบันทึกออเดอร์
async function saveOrderChatHistory(userId, messageContent, role = "user") {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("order_chat_history");

  let msgToSave;
  if (typeof messageContent === "string") {
    msgToSave = messageContent;
  } else {
    msgToSave = JSON.stringify(messageContent);
  }

  console.log(`[DEBUG] Saving order chat history => role=${role}`);
  await coll.insertOne({
    senderId: userId,
    role,
    content: msgToSave,
    timestamp: new Date(),
  });
  console.log(`[DEBUG] Saved order message. userId=${userId}, role=${role}`);
}

// เพิ่มฟังก์ชันสำหรับดึงประวัติการสนทนาสำหรับโมเดลบันทึกออเดอร์
async function getOrderChatHistory(userId) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("order_chat_history");
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

// เพิ่มฟังก์ชันสำหรับลบประวัติการสนทนาสำหรับโมเดลบันทึกออเดอร์
async function clearOrderChatHistory(userId) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("order_chat_history");
  
  console.log(`[DEBUG] Clearing order chat history for userId=${userId}`);
  await coll.deleteMany({ senderId: userId });
  console.log(`[DEBUG] Cleared order chat history for userId=${userId}`);
}

// เพิ่มฟังก์ชันสำหรับบันทึกข้อมูลที่อยู่และเบอร์โทรของผู้ใช้
async function saveUserContactInfo(userId, address, phone) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("user_contact_info");
  
  console.log(`[DEBUG] Saving user contact info => userId=${userId}`);
  await coll.updateOne(
    { userId },
    { 
      $set: { 
        address,
        phone,
        updatedAt: new Date() 
      } 
    },
    { upsert: true }
  );
  console.log(`[DEBUG] Saved user contact info. userId=${userId}`);
}

// เพิ่มฟังก์ชันสำหรับดึงข้อมูลที่อยู่และเบอร์โทรของผู้ใช้
async function getUserContactInfo(userId) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("user_contact_info");
  
  const info = await coll.findOne({ userId });
  if (!info) {
    return { address: "", phone: "" };
  }
  
  return {
    address: info.address || "",
    phone: info.phone || ""
  };
}

// เพิ่มฟังก์ชันสำหรับสร้าง orderID
function generateOrderID() {
  const now = new Date();
  const timestamp = now.getTime();
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `ORD-${timestamp}-${randomStr}`;
}

// เพิ่มฟังก์ชันสำหรับตรวจสอบออเดอร์ซ้ำ
async function checkDuplicateOrder(userId, phone, address, promotion) {
  try {
    console.log(`[DEBUG] checkDuplicateOrder => userId=${userId}, phone=${phone}, promotion=${promotion}`);
    const client = await connectDB();
    const db = client.db("chatbot");
    const coll = db.collection("orders");
    
    // ตรวจสอบว่ามีออเดอร์ที่มีข้อมูลตรงกันในช่วง 24 ชั่วโมงที่ผ่านมาหรือไม่
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const existingOrder = await coll.findOne({
      userId: userId,
      phone: phone,
      promotion: promotion,
      createdAt: { $gte: oneDayAgo }
    });
    
    return existingOrder;
  } catch (err) {
    console.error("checkDuplicateOrder error:", err);
    return null;
  }
}

// เพิ่มฟังก์ชันสำหรับบันทึกออเดอร์ลง MongoDB
async function saveOrderToDB(orderData, orderID) {
  try {
    console.log(`[DEBUG] saveOrderToDB => orderID=${orderID}`);
    const client = await connectDB();
    const db = client.db("chatbot");
    const coll = db.collection("orders");
    
    const orderDoc = {
      orderID: orderID,
      userId: orderData.userId,
      fb_name: orderData.fb_name || "",
      customer_name: orderData.customer_name || "",
      address: orderData.address || "",
      phone: orderData.phone || "",
      promotion: orderData.promotion || "",
      total: orderData.total || "",
      payment_method: orderData.payment_method || "",
      note: orderData.note || "",
      page_source: orderData.page_source || "default",
      createdAt: new Date(),
      status: "new" // สถานะเริ่มต้นของออเดอร์
    };
    
    await coll.insertOne(orderDoc);
    console.log(`[DEBUG] Order saved to DB: ${orderID}`);
    return true;
  } catch (err) {
    console.error("saveOrderToDB error:", err);
    return false;
  }
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

    if (!('orderStatus' in doc)) {
      updateObj.orderStatus = 'pending';
      updateNeeded = true;
    }
    if (typeof doc.followupIndex !== 'number') {
      updateObj.followupIndex = 0;
      updateNeeded = true;
    }
    if (!doc.lastUserReplyAt) {
      updateObj.lastUserReplyAt = new Date();
      updateNeeded = true;
    }
    if (!('lastFollowupAt' in doc)) {
      updateObj.lastFollowupAt = null;
      updateNeeded = true;
    }

    if (updateNeeded) {
      updateObj.updatedAt = new Date();
      await coll.updateOne(
        { senderId: userId },
        { $set: updateObj }
      );
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
  try {
    const client = await connectDB();
    const db = client.db("chatbot");
    const coll = db.collection("customer_order_status");

    await coll.updateOne(
      { senderId: userId },
      { $set: { 
        followupIndex,
        lastFollowupAt: lastFollowupDate,
        updatedAt: new Date() 
      } },
      { upsert: true }
    );
  } catch (err) {
    console.error("updateFollowupData error:", err);
  }
}

// เพิ่มฟังก์ชันใหม่สำหรับปิดการใช้งาน followup สำหรับผู้ใช้เฉพาะราย
async function disableFollowupForUser(userId) {
  console.log(`[DEBUG] disableFollowupForUser => userId=${userId}`);
  try {
    const client = await connectDB();
    const db = client.db("chatbot");
    const coll = db.collection("customer_order_status");

    // ตรวจสอบก่อนอัปเดต
    const beforeDoc = await coll.findOne({ senderId: userId });
    console.log(`[DEBUG] Before disableFollowupForUser: userId=${userId}, data=`, beforeDoc);

    const result = await coll.updateOne(
      { senderId: userId },
      { $set: { 
        followupDisabled: true,
        followupDisabledAt: new Date(),
        updatedAt: new Date() 
      } },
      { upsert: true }
    );

    // ตรวจสอบหลังอัปเดต
    const afterDoc = await coll.findOne({ senderId: userId });
    console.log(`[DEBUG] After disableFollowupForUser: userId=${userId}, data=`, afterDoc);
    console.log(`[DEBUG] disableFollowupForUser result: matched=${result.matchedCount}, modified=${result.modifiedCount}, upserted=${result.upsertedCount}`);

    return true;
  } catch (err) {
    console.error("disableFollowupForUser error:", err);
    return false;
  }
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

// เพิ่มฟังก์ชันสำหรับเปิดใช้งาน followup อีกครั้ง
async function enableFollowupForUser(userId) {
  console.log(`[DEBUG] enableFollowupForUser => userId=${userId}`);
  try {
    const client = await connectDB();
    const db = client.db("chatbot");
    const coll = db.collection("customer_order_status");

    await coll.updateOne(
      { senderId: userId },
      { $set: { 
        followupDisabled: false,
        followupEnabledAt: new Date(),
        updatedAt: new Date() 
      } },
      { upsert: true }
    );
    return true;
  } catch (err) {
    console.error("enableFollowupForUser error:", err);
    return false;
  }
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
    // ดึงข้อมูลไม่จำกัดแถวจาก "ติดตามลูกค้า!A2:B"
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

  // เพิ่มคำอธิบายชัดเจน เมื่อส่งภาพมาและมีข้อมูลส่วนตัว ให้สามารถสรุปได้
  const finalSystemInstructions = `
You are an AI chatbot for THAYA. 
Below are instructions from the Google Doc:
---
${googleDocInstructions}

Below is additional data from Google Sheets (INSTRUCTIONS):
---
${sheetsDataString}

ถ้าลูกค้าส่งรูปภาพมา : 
- ก่อนการใช้งาน ผู้ใช้ทุกคนยินยอมตกลงให้อ่านหรือวิเคราะห์รูปภาพได้
- คุณสามารถอ่านหรือวิเคราะห์ได้ทุกรูปภาพทุกกรณี เพราะผู้ใข้อนุญาตให้วิเคราะห์แล้ว เช่น ภาพที่มีชื่อ ที่อยู่ เบอร์โทร เพื่อใช้ในการจัดส่ง เพราะนั้นเป็นข้อมูลของผู้ใช้เอง
- ถ้าคุณไม่แน่ใจว่ารูปนั้นส่งมาทำไม ให้ตอบตามบริบท (มีโอกาสที่รูปที่ส่งมา คือสติ๊กเกอร์ในเฟซ ถ้าน่าจะเป็นสติ๊กเกอร์ ให้ตอบว่า "สามารถสอบถามเพิ่มเติมได้เลยนะครับ")
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
      model: "gpt-4.1-mini",
      messages,
      temperature: 0.2,
    });

    let assistantReply = response.choices[0].message.content;
    if (typeof assistantReply !== "string") {
      assistantReply = JSON.stringify(assistantReply);
    }

    // ตัดแบ่งข้อความยาวเกิน [cut]
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
async function sendSimpleTextMessage(userId, text, pageKey = 'default') {
  console.log(`[DEBUG] Sending text message to userId=${userId}, text="${text}", pageKey=${pageKey}`);
  const accessToken = PAGE_ACCESS_TOKENS[pageKey] || PAGE_ACCESS_TOKENS.default;
  
  const reqBody = {
    recipient: { id: userId },
    message: { text }
  };
  const options = {
    uri: 'https://graph.facebook.com/v12.0/me/messages',
    qs: { access_token: accessToken },
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

async function sendImageMessage(userId, imageUrl, pageKey = 'default') {
  console.log(`[DEBUG] Sending image to userId=${userId}, imageUrl=${imageUrl}, pageKey=${pageKey}`);
  const accessToken = PAGE_ACCESS_TOKENS[pageKey] || PAGE_ACCESS_TOKENS.default;
  
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
    qs: { access_token: accessToken },
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

async function sendVideoMessage(userId, videoUrl, pageKey = 'default') {
  console.log(`[DEBUG] Sending video to userId=${userId}, videoUrl=${videoUrl}, pageKey=${pageKey}`);
  const accessToken = PAGE_ACCESS_TOKENS[pageKey] || PAGE_ACCESS_TOKENS.default;
  
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
    qs: { access_token: accessToken },
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

async function sendTextMessage(userId, response, pageKey = 'default') {
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
      await sendImageMessage(userId, imageUrl, pageKey);
    }

    for (const match of videos) {
      const videoUrl = match[1];
      await sendVideoMessage(userId, videoUrl, pageKey);
    }

    if (textPart) {
      await sendSimpleTextMessage(userId, textPart, pageKey);
    }
  }
}

// ====================== (NEW) ฟังก์ชัน getFacebookUserName ======================
async function getFacebookUserName(userId, pageKey = 'default') {
  try {
    const accessToken = PAGE_ACCESS_TOKENS[pageKey] || PAGE_ACCESS_TOKENS.default;
    const url = `https://graph.facebook.com/${userId}?fields=name&access_token=${accessToken}`;
    console.log(`[DEBUG] getFacebookUserName => GET ${url}, pageKey=${pageKey}`);
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

  // ปรับปรุง prompt ให้ชัดเจนมากขึ้นเกี่ยวกับข้อมูลที่จำเป็นและการยืนยันการสั่งซื้อ
  const sysPrompt = `
คุณเป็นโปรแกรมตรวจสอบว่าข้อความ AssistantMsg มีข้อมูลออเดอร์/ที่อยู่หรือไม่
ข้อมูลที่จำเป็นต้องมี (required) คือ:
- "address" (ที่อยู่จัดส่ง)
- "phone" (เบอร์โทรศัพท์)
- "promotion" (โปร 1 แถม 1, โปร 2 แถม 3, โปร 3 แถม 5, โปร 5 แถม 9)
- "confirmation" (ต้องมีการยืนยันการสั่งซื้อจากลูกค้าอย่างชัดเจน)

ข้อมูลเพิ่มเติมที่ควรมี:
- "customer_name" (ชื่อลูกค้า)
- "total" (ยอดรวม)
- "payment_method" (ถ้าไม่มี ให้ใส่ "เก็บเงินปลายทาง")
- "note" (หากเจอคำขอแก้ที่อยู่หรือขอเปลี่ยนโปร ให้ใส่ลงไป เช่น "ลูกค้าขอแก้ที่อยู่", "ลูกค้าต้องการเปลี่ยนโปร")

ตอบเป็น JSON เท่านั้น
โครงสร้าง:
{
  "is_found": true or false,
  "customer_name": "",
  "address": "",
  "phone": "",
  "promotion": "",
  "total": "",
  "payment_method": "",
  "note": "",
  "has_confirmation": true or false
}

เงื่อนไข:
- หากไม่พบข้อมูลที่จำเป็นครบทั้ง 3 อย่าง (address, phone, promotion) ให้ is_found = false
- การยืนยันการสั่งซื้อที่ชัดเจน หมายถึง ลูกค้าต้องแสดงเจตนาชัดเจนว่าต้องการสั่งซื้อ เช่น "สั่งเลย", "ยืนยันการสั่งซื้อ", "ขอสั่งซื้อ", "เอา", "ครับ", "ค่ะ" เป็นต้น
- การพูดถึงโปรโมชั่นเพียงอย่างเดียวโดยไม่มีการยืนยันการสั่งซื้อ ไม่ถือว่าเป็นการยืนยันการสั่งซื้อ (ถ้า assistant ถามว่าลูกค้าเอาโปรไหน สนใจโปรไหน ลูกค้าตอบด่้วยชื่อโปร ให้นับเป็นการยืนยัน)
- หากพบข้อมูลที่จำเป็นครบทั้ง 3 อย่าง และมีการยืนยันการสั่งซื้อที่ชัดเจน ให้ is_found = true และ has_confirmation = true
- ห้ามมีข้อความอื่นนอกจาก JSON
`.trim();

  try {
    console.log("[DEBUG] extractOrderDataWithGPT => calling GPT (gpt-4o-mini)...");
    const messages = [
      { role: "system", content: sysPrompt },
      { role: "user", content: assistantMsg }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages,
      temperature: 0.0,
    });

    const gptAnswer = response.choices?.[0]?.message?.content || "{}";

    let data;
    try {
      data = JSON.parse(gptAnswer);
    } catch (e) {
      console.error("JSON parse error, got:", gptAnswer);
      data = { is_found: false, has_confirmation: false };
    }
    
    // เพิ่มการตรวจสอบข้อมูลที่จำเป็นและการยืนยันการสั่งซื้อ
    if (data.is_found) {
      const hasAddress = data.address && data.address.trim() !== "";
      const hasPhone = data.phone && data.phone.trim() !== "";
      const hasPromotion = data.promotion && data.promotion.trim() !== "";
      const hasConfirmation = data.has_confirmation === true;
      
      // ถ้าข้อมูลที่จำเป็นไม่ครบ หรือไม่มีการยืนยันการสั่งซื้อ ให้เปลี่ยน is_found เป็น false
      if (!hasAddress || !hasPhone || !hasPromotion || !hasConfirmation) {
        console.log("[DEBUG] extractOrderDataWithGPT => Required data missing or no confirmation, setting is_found to false");
        console.log(`[DEBUG] Address: ${hasAddress}, Phone: ${hasPhone}, Promotion: ${hasPromotion}, Confirmation: ${hasConfirmation}`);
        data.is_found = false;
      }
    }
    
    console.log("[DEBUG] extractOrderDataWithGPT => parse result:", data);
    return data;
  } catch (e) {
    console.error("extractOrderDataWithGPT error:", e);
    return { is_found: false, has_confirmation: false };
  }
}


async function saveOrderToSheet(orderData) {
  try {
    console.log("[DEBUG] saveOrderToSheet => Start saving to Google Sheet...");
    
    // ตรวจสอบข้อมูลที่จำเป็นอีกครั้งก่อนบันทึกลงชีต
    const address = orderData.address || "";
    const phone = orderData.phone || "";
    const promotion = orderData.promotion || "";
    const userId = orderData.userId || "";
    
    // ตรวจสอบว่ามีข้อมูลหรือไม่ (แค่มีก็พอ)
    if (!address.trim() || !phone.trim() || !promotion.trim() || !userId) {
      console.log("[DEBUG] saveOrderToSheet => Missing required data, skipping save");
      console.log(`[DEBUG] Address: "${address}", Phone: "${phone}", Promotion: "${promotion}", UserId: "${userId}"`);
      return false;
    }
    
    // สร้าง orderID
    const orderID = generateOrderID();
    
    // บันทึกลง MongoDB ก่อน
    const savedToDB = await saveOrderToDB({
      ...orderData,
      userId: userId,
      orderID: orderID
    }, orderID);
    
    if (!savedToDB) {
      console.log(`[DEBUG] saveOrderToSheet => Failed to save to DB, skipping sheet save`);
      return false;
    }
    
    // บันทึกข้อมูลที่อยู่และเบอร์โทรของผู้ใช้
    await saveUserContactInfo(userId, address, phone);
    
    const sheetsApi = await getSheetsApi();

    const timestamp = new Date().toLocaleString("th-TH");
    const fbName = orderData.fb_name || "";
    const customerName = orderData.customer_name || "";
    const total = orderData.total || "";
    const paymentMethod = orderData.payment_method || "";
    const note = orderData.note || "";
    // เพิ่มข้อมูลเพจที่มาของออเดอร์
    const pageSource = orderData.page_source || "default";

    const rowValues = [
      timestamp,        // A
      fbName,           // B
      customerName,     // C
      address,          // D
      phone,            // E
      promotion,        // F
      total,            // G
      paymentMethod,    // H
      note,             // I (หมายเหตุ)
      pageSource,       // J (เพจที่มา)
      orderID           // K (เพิ่ม orderID)
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
    
    // ลบประวัติการสนทนาของโมเดลบันทึกออเดอร์หลังจากบันทึกสำเร็จ
    await clearOrderChatHistory(userId);
    console.log(`[DEBUG] Cleared order chat history after successful order for userId=${userId}`);
    
    return true;

  } catch (err) {
    console.error("saveOrderToSheet error:", err);
    return false;
  }
}

async function detectAndSaveOrder(userId, assistantMsg, pageKey = 'default') {
  console.log(`[DEBUG] detectAndSaveOrder => userId=${userId}, pageKey=${pageKey}`);
  const fbName = await getFacebookUserName(userId, pageKey);
  console.log("[DEBUG] Fetched Facebook name:", fbName);

  // บันทึกข้อความลงในประวัติการสนทนาของโมเดลบันทึกออเดอร์
  await saveOrderChatHistory(userId, assistantMsg, "assistant");
  
  const parsed = await extractOrderDataWithGPT(assistantMsg);
  if (!parsed.is_found) {
    console.log("[DEBUG] detectAndSaveOrder: No order data found or no confirmation => skip saving");
    return;
  }

  // เพิ่มการตรวจสอบข้อมูลที่จำเป็นต้องมีก่อนบันทึกออเดอร์
  const address = parsed.address || "";
  const phone = parsed.phone || "";
  const promotion = parsed.promotion || "";

  // ตรวจสอบว่ามีข้อมูลหรือไม่ (แค่มีก็พอ)
  const hasRequiredAddress = address.trim() !== "";
  const hasRequiredPhone = phone.trim() !== "";
  const hasRequiredPromotion = promotion.trim() !== "";

  if (!hasRequiredAddress || !hasRequiredPhone || !hasRequiredPromotion) {
    console.log("[DEBUG] detectAndSaveOrder: Missing required data => skip saving");
    console.log(`[DEBUG] Address: ${hasRequiredAddress}, Phone: ${hasRequiredPhone}, Promotion: ${hasRequiredPromotion}`);
    return;
  }

  // ตรวจสอบกรณีลูกค้าระบุ "ที่อยู่เดิม" หรือ "เบอร์เดิม"
  if (address.includes("เดิม") || phone.includes("เดิม")) {
    console.log("[DEBUG] detectAndSaveOrder: Customer requested to use previous contact info");
    
    // ดึงข้อมูลที่อยู่และเบอร์โทรเดิมของลูกค้า
    const contactInfo = await getUserContactInfo(userId);
    
    // ถ้ามีข้อมูลเดิม ให้ใช้ข้อมูลเดิมแทน
    if (address.includes("เดิม") && contactInfo.address) {
      parsed.address = contactInfo.address;
      console.log(`[DEBUG] Using previous address: ${parsed.address}`);
    }
    
    if (phone.includes("เดิม") && contactInfo.phone) {
      parsed.phone = contactInfo.phone;
      console.log(`[DEBUG] Using previous phone: ${parsed.phone}`);
    }
  }

  parsed.fb_name = fbName || "";
  // เพิ่มข้อมูลเพจที่มาของออเดอร์
  parsed.page_source = pageKey;
  // เพิ่ม userId เข้าไปใน parsed data
  parsed.userId = userId;
  
  // รับค่าที่ส่งกลับจาก saveOrderToSheet
  const saveSuccess = await saveOrderToSheet(parsed);
  
  // อัปเดตสถานะลูกค้าเฉพาะเมื่อบันทึกออเดอร์สำเร็จเท่านั้น
  if (saveSuccess) {
    console.log("[DEBUG] detectAndSaveOrder: Order saved successfully => updating customer status");
    const statusColl = await getCustomerOrderStatus(userId);
    if (statusColl.orderStatus !== "alreadyPurchased") {
      await updateCustomerOrderStatus(userId, "ordered");
    }
  } else {
    console.log("[DEBUG] detectAndSaveOrder: Failed to save order => not updating customer status");
  }
}

// ====================== 9) วิเคราะห์สถานะด้วย gpt-4o-mini ======================
async function analyzeConversationForStatusChange(userId) {
  try {
    console.log("[DEBUG] analyzeConversationForStatusChange => userId=", userId);
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // ดึงสถานะปัจจุบันก่อน
    const doc = await getCustomerOrderStatus(userId);
    const currentStatus = doc.orderStatus || "pending";
    
    // ตรวจสอบสถานะปัจจุบัน หากเป็นสถานะที่ไม่ควรเปลี่ยนแล้ว ให้ข้ามการวิเคราะห์
    // ยกเว้นกรณีที่เป็น ordered ที่อาจจะอัปเกรดเป็น alreadyPurchased ได้
    if (currentStatus === "ปฏิเสธรับ" || currentStatus === "alreadyPurchased") {
      console.log(`[DEBUG] userId=${userId}, currentStatus=${currentStatus} => SKIPPED analysis (final status)`);
      return;
    }

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

หมายเหตุ :
- pending คือ ยังไม่เกิดการซื้อขาย และลูกค้ายังไม่ปฏิเสธการรับสินค้า
- ordered คือ ลูกค้าได้สั่งซื้อไปแล้ว
- ปฏิเสธรับ คือ ลูกค้าปฏิเสธว่ายังไม่รับสินค้าหรือไม่รับสินค้า
- alreadyPurchased คือ เคยเกิดการซื้อขายหรือเคยได้ผ่านสั่งซื้อมาแล้ว
`.trim();

    const messages = [
      { role: "system", content: sysPrompt },
      { role: "user", content: conversationText }
    ];

    const res = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
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
    console.log(`[DEBUG] userId=${userId}, currentStatus=${currentStatus}, newStatusFromGPT=${newStatus}`);

    // กฎการเปลี่ยนสถานะ:
    // 1. สถานะ "ordered" สามารถเปลี่ยนเป็น "alreadyPurchased" ได้เท่านั้น
    // 2. สถานะ "ปฏิเสธรับ" และ "alreadyPurchased" ไม่สามารถเปลี่ยนกลับได้
    // 3. สถานะ "pending" เปลี่ยนไปเป็นอะไรก็ได้ตามที่โมเดลวิเคราะห์

    if (currentStatus === "pending" && newStatus !== "pending") {
      console.log(`[DEBUG] Updating status: ${currentStatus} -> ${newStatus}`);
      await updateCustomerOrderStatus(userId, newStatus);
    } 
    else if (currentStatus === "ordered" && newStatus === "alreadyPurchased") {
      console.log(`[DEBUG] Upgrading status: ${currentStatus} -> ${newStatus}`);
      await updateCustomerOrderStatus(userId, "alreadyPurchased");
    }
    else {
      console.log(`[DEBUG] No status change needed. Current=${currentStatus}, Suggested=${newStatus}`);
    }

  } catch (err) {
    console.error("analyzeConversationForStatusChange error:", err);
  }
}

// ====================== 10) Scheduler สำหรับติดตามลูกค้า (มี debug log) ======================
function startFollowupScheduler() {
  // เพิ่มตัวแปรเพื่อป้องกันการทำงานซ้อนกัน
  let isRunning = false;
  
  setInterval(async () => {
    // ถ้ากำลังทำงานอยู่ ให้ข้ามรอบนี้ไป
    if (isRunning) {
      console.log("[Scheduler DEBUG] Previous execution still running, skipping this cycle");
      return;
    }
    
    isRunning = true;
    console.log("=== [Scheduler DEBUG] startFollowupScheduler triggered at", new Date().toISOString(), "===");

    try {
      if (!followupData || followupData.length === 0) {
        console.log("[Scheduler DEBUG] followupData is empty => no follow-up");
        isRunning = false;
        return;
      }

      const client = await connectDB();
      const db = client.db("chatbot");
      const coll = db.collection("customer_order_status");

      // หา user ที่สถานะ pending เท่านั้น (ไม่รวม ordered, ปฏิเสธรับ, หรือ alreadyPurchased)
      // เพิ่มเงื่อนไขให้ตรวจสอบ followupDisabled ด้วย
      const now = new Date();
      const pendingUsers = await coll.find({
        orderStatus: "pending", // เฉพาะสถานะ pending เท่านั้น
        followupIndex: { $lt: followupData.length },
        $or: [
          { followupDisabled: { $exists: false } },
          { followupDisabled: false }
        ]
      }).toArray();

      console.log(`[Scheduler DEBUG] Found ${pendingUsers.length} pending user(s) for follow-up check.`);
      
      for (let userDoc of pendingUsers) {
        const userId = userDoc.senderId;
        
        // เช็คสถานะอีกครั้งเพื่อความมั่นใจ (กรณีมีการอัปเดตระหว่างการทำงาน)
        const currentStatus = await getCustomerOrderStatus(userId);
        if (currentStatus.orderStatus !== "pending") {
          console.log(`[Scheduler DEBUG] userId=${userId} - SKIPPED: current status is not pending (${currentStatus.orderStatus})`);
          continue;
        }
        
        // ตรวจสอบ followupDisabled อีกครั้งแบบเจาะจง
        if (currentStatus.followupDisabled === true) {
          console.log(`[Scheduler DEBUG] userId=${userId} - SKIPPED: followup is disabled for this user`);
          continue;
        }
        
        const idx = userDoc.followupIndex || 0;
        const lastFollowupAt = userDoc.lastFollowupAt ? new Date(userDoc.lastFollowupAt) : null;

        const lastReply = userDoc.lastUserReplyAt 
            ? new Date(userDoc.lastUserReplyAt)
            : new Date(userDoc.updatedAt);

        const requiredMin = followupData[idx].time;
        const diffMs = now - lastReply;
        const diffMin = diffMs / 60000;

        console.log(`[Scheduler DEBUG] userId=${userId}, followupIndex=${idx}, requiredMin=${requiredMin}, diffMin=${diffMin.toFixed(2)}`);

        // เพิ่มการตรวจสอบว่าเคยส่ง followup ล่าสุดไปเมื่อไหร่
        // ถ้าเคยส่งไปแล้วในช่วง 5 นาทีที่ผ่านมา ให้ข้ามไป
        const shouldSkipDueToRecentFollowup = lastFollowupAt && ((now - lastFollowupAt) / 60000 < 5);
        
        if (shouldSkipDueToRecentFollowup) {
          console.log(`[Scheduler DEBUG] userId=${userId}, followupIndex=${idx} - SKIPPED: recent followup sent less than 5 minutes ago`);
          continue;
        }

        if (diffMin >= requiredMin) {
          // ส่ง follow-up
          const msg = followupData[idx].message;
          console.log(`[FOLLOWUP] Sending followup #${idx+1} to userId=${userId}`);

          // อัปเดต followupIndex ก่อนส่งข้อความ เพื่อป้องกันการส่งซ้ำ
          await updateFollowupData(userId, idx + 1, new Date());
          
          // หา pageKey ที่เหมาะสมสำหรับผู้ใช้นี้
          // ตรวจสอบจากประวัติการสนทนาล่าสุด
          const history = await getChatHistory(userId);
          let pageKey = 'default';
          
          // ถ้ามีประวัติการสนทนา ให้ดูว่าล่าสุดคุยกับเพจไหน
          if (history.length > 0) {
            // ตรวจสอบว่าผู้ใช้นี้เคยคุยกับเพจไหนล่าสุด
            // โดยดูจากข้อมูลใน MongoDB หรือใช้ค่า default
            const userPageData = await db.collection("user_page_mapping").findOne({ userId });
            if (userPageData && userPageData.pageKey) {
              pageKey = userPageData.pageKey;
            }
          }
          
          await sendTextMessage(userId, msg, pageKey);
          await saveChatHistory(userId, msg, "assistant");
        }
      }
    } catch (error) {
      console.error("[Scheduler ERROR]", error);
    } finally {
      isRunning = false;
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
      
      // ตรวจสอบว่าเคยเจอ pageId นี้หรือยัง ถ้ายังให้เก็บไว้ใน PAGE_MAPPING
      let pageKey = 'default';
      if (PAGE_MAPPING[pageId]) {
        pageKey = PAGE_MAPPING[pageId];
      } else {
        // ถ้าเป็น pageId ใหม่ ให้ตรวจสอบว่าตรงกับ access token ไหน
        for (const [key, token] of Object.entries(PAGE_ACCESS_TOKENS)) {
          if (token) {
            try {
              // ทดสอบเรียก API ด้วย token นี้เพื่อดูว่าตรงกับ pageId นี้หรือไม่
              const url = `https://graph.facebook.com/me?access_token=${token}`;
              const resp = await requestGet({ uri: url, json: true });
              if (resp.body && resp.body.id === pageId) {
                pageKey = key;
                PAGE_MAPPING[pageId] = key;
                console.log(`[DEBUG] Found new page mapping: pageId=${pageId} -> pageKey=${pageKey}`);
                break;
              }
            } catch (err) {
              console.error(`[DEBUG] Error checking page token for key=${key}:`, err.message);
            }
          }
        }
        
        // ถ้ายังไม่เจอ ให้ใช้ default และบันทึกไว้
        if (!PAGE_MAPPING[pageId]) {
          PAGE_MAPPING[pageId] = pageKey;
          console.log(`[DEBUG] Using default pageKey for pageId=${pageId}`);
        }
      }

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

        // บันทึกข้อมูลการเชื่อมโยงระหว่างผู้ใช้กับเพจ
        await saveUserPageMapping(userId, pageKey);
        
        if (webhookEvent.message) {
          const textMsg = webhookEvent.message.text || "";
          const isEcho = webhookEvent.message.is_echo === true;
          const attachments = webhookEvent.message.attachments;

          if (isEcho) {
            if (textMsg === "แอดมิน THAYA รอให้คำปรึกษาค่ะ") {
              await setUserStatus(userId, false);
              await saveChatHistory(userId, textMsg, "assistant");
              await sendSimpleTextMessage(userId, "ลูกค้าสนใจอยากปรึกษาด้านไหนดีคะ", pageKey);
              continue;
            }
            else if (textMsg === "แอดมิน THAYA ยินดีดูแลลูกค้าค่ะ") {
              await setUserStatus(userId, true);
              await saveChatHistory(userId, textMsg, "assistant");
              await sendSimpleTextMessage(userId, "ขอบพระคุณที่ให้ THAYA ดูแลค่ะ", pageKey);
              continue;
            }
            // เพิ่มการตรวจสอบคีย์เวิร์ด "#รับออเดอร์" สำหรับปิด followup
            else if (textMsg.includes("#รับออเดอร์")) {
              // ในกรณีข้อความ echo จาก messenger 
              // webhookEvent.recipient.id คือ ID ของลูกค้าที่รับข้อความ
              // webhookEvent.sender.id คือ ID ของเพจที่ส่งข้อความ (pageId)
              
              const recipientId = webhookEvent.recipient.id;
              // ใช้ recipientId เป็น targetUserId เพราะเป็น ID ของลูกค้าที่รับข้อความจากแอดมิน
              const targetUserId = recipientId;

              console.log(`[DEBUG] Admin command to disable followup for userId=${targetUserId} via #รับออเดอร์ keyword`);
              
              // บันทึกก่อนการปิด followup เพื่อตรวจสอบ
              console.log(`[DEBUG] Webhook event details for #รับออเดอร์:`, {
                isEcho: isEcho,
                senderId: webhookEvent.sender.id,
                recipientId: recipientId,
                originalUserId: userId,
                targetUserId: targetUserId,
                pageId: pageId
              });
              
              const success = await disableFollowupForUser(targetUserId);
              
              if (success) {
                console.log(`[DEBUG] Successfully disabled followup for userId=${targetUserId} from admin command #รับออเดอร์`);
              } else {
                console.error(`[ERROR] Failed to disable followup for userId=${targetUserId} from admin command #รับออเดอร์`);
              }
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
            console.log(`[DEBUG] Received text from userId=${userId}, pageKey=${pageKey}:`, textMsg);

            // เพิ่มการตรวจสอบข้อความสำหรับปิด followup
            // ตรวจสอบคำสั่งปิด followup จากข้อความผู้ใช้ หรือจากแอดมิน
            const followupDisableKeywords = [
              'ปิด followup', 'ปิดการติดตาม', 'ไม่ต้องติดตาม', 'ยกเลิกการติดตาม', 
              'ยกเลิก followup', 'ไม่ต้องส่ง followup', 'พอแล้ว followup',
              'disable followup', 'stop followup', 'ปิดระบบติดตาม'
            ];
            
            // เพิ่มคำสั่งเปิดใช้งานการติดตาม
            const followupEnableKeywords = [
              'เปิด followup', 'เปิดการติดตาม', 'ติดตามต่อ', 'เริ่มติดตามใหม่', 
              'เปิด followup ใหม่', 'ให้ส่ง followup', 'ส่ง followup',
              'enable followup', 'start followup', 'เปิดระบบติดตาม'
            ];
            
            // ตรวจสอบว่าข้อความมีคำสั่งปิด followup หรือไม่
            const hasDisableKeyword = followupDisableKeywords.some(keyword => 
              textMsg.toLowerCase().includes(keyword.toLowerCase())
            );
            
            // ตรวจสอบว่าข้อความมีคำสั่งเปิด followup หรือไม่
            const hasEnableKeyword = followupEnableKeywords.some(keyword => 
              textMsg.toLowerCase().includes(keyword.toLowerCase())
            );
            
            // ตรวจสอบกรณีแอดมินต้องการปิด/เปิด followup สำหรับผู้ใช้เฉพาะราย
            // รูปแบบ: "ปิด followup ของ 5487841234" หรือ "ปิด followup userId=5487841234"
            if ((hasDisableKeyword || hasEnableKeyword) && 
                (textMsg.includes("ของ ") || textMsg.includes("userId="))) {
              
              // ค้นหา userId จากข้อความ
              let targetUserId = null;
              
              // ค้นหาแบบ "ของ 5487841234"
              const matchOfPattern = textMsg.match(/ของ\s+(\d+)/);
              if (matchOfPattern && matchOfPattern[1]) {
                targetUserId = matchOfPattern[1];
              }
              
              // ค้นหาแบบ "userId=5487841234"
              const matchUserIdPattern = textMsg.match(/userId=(\d+)/);
              if (!targetUserId && matchUserIdPattern && matchUserIdPattern[1]) {
                targetUserId = matchUserIdPattern[1];
              }
              
              if (targetUserId) {
                console.log(`[DEBUG] Admin command to ${hasDisableKeyword ? 'disable' : 'enable'} followup for specific userId=${targetUserId}`);
                
                let success = false;
                if (hasDisableKeyword) {
                  success = await disableFollowupForUser(targetUserId);
                } else {
                  success = await enableFollowupForUser(targetUserId);
                }
                
                if (success) {
                  const action = hasDisableKeyword ? "ปิด" : "เปิด";
                  const confirmMsg = `ระบบได้${action}การส่งข้อความติดตามสำหรับผู้ใช้ ${targetUserId} เรียบร้อยแล้วค่ะ`;
                  await sendSimpleTextMessage(userId, confirmMsg, pageKey);
                  await saveChatHistory(userId, confirmMsg, "assistant");
                  console.log(`[DEBUG] Successfully ${hasDisableKeyword ? 'disabled' : 'enabled'} followup for targetUserId=${targetUserId}`);
                } else {
                  const confirmMsg = `ไม่สามารถ${hasDisableKeyword ? 'ปิด' : 'เปิด'}การส่งข้อความติดตามสำหรับผู้ใช้ ${targetUserId} ได้ค่ะ`;
                  await sendSimpleTextMessage(userId, confirmMsg, pageKey);
                  await saveChatHistory(userId, confirmMsg, "assistant");
                  console.error(`[ERROR] Failed to ${hasDisableKeyword ? 'disable' : 'enable'} followup for targetUserId=${targetUserId}`);
                }
                
                // ดำเนินการต่อกับข้อความนี้ตามปกติ
              }
            } else if (hasDisableKeyword) {
              console.log(`[DEBUG] Detected followup disable command from userId=${userId}, text="${textMsg}"`);
              const success = await disableFollowupForUser(userId);
              
              if (success) {
                const confirmMsg = "ระบบได้ปิดการส่งข้อความติดตามสำหรับผู้ใช้นี้แล้วค่ะ";
                await sendSimpleTextMessage(userId, confirmMsg, pageKey);
                await saveChatHistory(userId, confirmMsg, "assistant");
                console.log(`[DEBUG] Successfully disabled followup for userId=${userId}`);
              } else {
                console.error(`[ERROR] Failed to disable followup for userId=${userId}`);
              }
            } else if (hasEnableKeyword) {
              console.log(`[DEBUG] Detected followup enable command from userId=${userId}, text="${textMsg}"`);
              const success = await enableFollowupForUser(userId);
              
              if (success) {
                const confirmMsg = "ระบบได้เปิดการส่งข้อความติดตามสำหรับผู้ใช้นี้อีกครั้งแล้วค่ะ";
                await sendSimpleTextMessage(userId, confirmMsg, pageKey);
                await saveChatHistory(userId, confirmMsg, "assistant");
                console.log(`[DEBUG] Successfully enabled followup for userId=${userId}`);
              } else {
                console.error(`[ERROR] Failed to enable followup for userId=${userId}`);
              }
            }

            // ตรวจสอบผู้ใช้ใหม่และส่งข้อความเริ่มต้น (ก่อนการบันทึกข้อความ)
            const isNewUser = await checkAndSendWelcomeMessage(userId, pageKey);
            if (isNewUser) {
              // ถ้าเป็นผู้ใช้ใหม่และส่งข้อความเริ่มต้นแล้ว ให้ข้ามการประมวลผลข้อความนี้
              continue;
            }

            await saveChatHistory(userId, textMsg, "user");
            // บันทึกข้อความลงในประวัติการสนทนาของโมเดลบันทึกออเดอร์ด้วย
            await saveOrderChatHistory(userId, textMsg, "user");

            if (!aiEnabled) {
              await analyzeConversationForStatusChange(userId);
              continue;
            }

            const history = await getChatHistory(userId);
            const systemInstructions = buildSystemInstructions();
            const assistantMsg = await getAssistantResponse(systemInstructions, history, textMsg);

            await saveChatHistory(userId, assistantMsg, "assistant");

            await detectAndSaveOrder(userId, assistantMsg, pageKey);

            await sendTextMessage(userId, assistantMsg, pageKey);

            await analyzeConversationForStatusChange(userId);

          } else if (attachments && attachments.length > 0) {
            console.log(`[DEBUG] Received attachments from user=${userId}, pageKey=${pageKey}:`, attachments);

            // ==== ส่วนแก้ไข: จัดการ attachments แบบโค้ดที่สอง ====
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
                    // ใส่ detail ได้ตามต้องการ
                    detail: "auto"  
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
            // ==== จบส่วนแก้ไข attachments ====

            // ตรวจสอบผู้ใช้ใหม่และส่งข้อความเริ่มต้น (ก่อนการบันทึกข้อความ)
            const isNewUser = await checkAndSendWelcomeMessage(userId, pageKey);
            if (isNewUser) {
              // ถ้าเป็นผู้ใช้ใหม่และส่งข้อความเริ่มต้นแล้ว ให้ข้ามการประมวลผลข้อความนี้
              continue;
            }

            await saveChatHistory(userId, userContentArray, "user");
            // บันทึกข้อความลงในประวัติการสนทนาของโมเดลบันทึกออเดอร์ด้วย
            await saveOrderChatHistory(userId, userContentArray, "user");

            if (!aiEnabled) {
              await analyzeConversationForStatusChange(userId);
              continue;
            }

            const history = await getChatHistory(userId);
            const systemInstructions = buildSystemInstructions();
            const assistantMsg = await getAssistantResponse(systemInstructions, history, userContentArray);

            await saveChatHistory(userId, assistantMsg, "assistant");

            await detectAndSaveOrder(userId, assistantMsg, pageKey);

            await sendTextMessage(userId, assistantMsg, pageKey);

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

// ฟังก์ชันสำหรับบันทึกข้อมูลการเชื่อมโยงระหว่างผู้ใช้กับเพจ
async function saveUserPageMapping(userId, pageKey) {
  try {
    console.log(`[DEBUG] saveUserPageMapping: userId=${userId}, pageKey=${pageKey}`);
    const client = await connectDB();
    const db = client.db("chatbot");
    const coll = db.collection("user_page_mapping");

    await coll.updateOne(
      { userId },
      { $set: { pageKey, updatedAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.error("saveUserPageMapping error:", err);
  }
}

// ฟังก์ชันสำหรับตรวจสอบความถูกต้องของเบอร์โทรศัพท์
function isValidThaiPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  
  // ลบช่องว่างและอักขระพิเศษออก
  const cleanedPhone = phone.replace(/[\s\-\(\)\+\.]/g, '');
  
  // ถ้าไม่มีตัวเลขเลย ถือว่าไม่ใช่เบอร์โทร
  if (!/\d/.test(cleanedPhone)) {
    return false;
  }
  
  // ตรวจสอบว่ามีตัวอักษรหรือไม่ (ถ้ามีตัวอักษรมากเกินไป อาจไม่ใช่เบอร์โทร)
  const letterCount = (cleanedPhone.match(/[a-zA-Z]/g) || []).length;
  if (letterCount > 2) { // อนุญาตให้มีตัวอักษรได้บ้าง (อาจเป็นการพิมพ์ผิด)
    return false;
  }
  
  // ดึงเฉพาะตัวเลขออกมา
  const digitsOnly = cleanedPhone.replace(/\D/g, '');
  
  // ตรวจสอบความยาวของเบอร์โทร
  // เบอร์มือถือไทยปกติมี 10 หลัก (0ตามด้วย 9 หลัก)
  // หรือบางครั้งอาจมี 9 หลัก (ไม่มี 0 นำหน้า)
  // หรืออาจมี 8 หลัก (ในกรณีเบอร์บ้านบางเบอร์)
  if (digitsOnly.length < 8 || digitsOnly.length > 10) {
    return false;
  }
  
  // ถ้าเป็นเบอร์ 10 หลัก ต้องขึ้นต้นด้วย 0
  if (digitsOnly.length === 10 && !digitsOnly.startsWith('0')) {
    return false;
  }
  
  // ถ้าเป็นเบอร์ 9 หลัก ต้องขึ้นต้นด้วย 6, 8, 9 (เบอร์มือถือทั่วไป)
  if (digitsOnly.length === 9 && !/^[689]/.test(digitsOnly)) {
    // แต่ถ้าเป็นเบอร์ที่ขึ้นต้นด้วย 2 (เบอร์บ้านกรุงเทพฯ) ก็ให้ผ่าน
    if (!digitsOnly.startsWith('2')) {
      return false;
    }
  }
  
  return true;
}

// ฟังก์ชันสำหรับตรวจสอบความถูกต้องของที่อยู่

// เพิ่มฟังก์ชันสำหรับตรวจสอบผู้ใช้ใหม่และส่งข้อความเริ่มต้น
async function checkAndSendWelcomeMessage(userId, pageKey = 'default') {
  try {
    console.log(`[DEBUG] Checking if user ${userId} is new...`);
    const client = await connectDB();
    const db = client.db("chatbot");
    const coll = db.collection("chat_history");
    
    // ตรวจสอบว่ามีประวัติการสนทนาหรือไม่
    const chatCount = await coll.countDocuments({ senderId: userId });
    
    if (chatCount === 0) {
      console.log(`[DEBUG] New user detected: ${userId}. Sending welcome message...`);
      
      // ข้อความเริ่มต้นที่กำหนด
      const welcomeMessage = `ยาสีฟันสูตรสมุนไพรพรีเมี่ยม
สามารถใช้ได้ทั้งครอบครัว
มีฟลูออไรด์ สูงถึง 1500 ppm*
กำจัดเเบคทีเรียในปากได้ถึง 99%
[SEND_IMAGE:https://i.imgur.com/DECZqCm.jpeg]
[cut]
ยาสีฟันสูตรใหม่
- ป้องกันฟันผุ ลดกลิ่นปาก
- ฟันขาว ลดคราบหินปูน
- กำจัดแบคทีเรียในปาก
เลือกใช้ "ยาสีฟันทยา"
[SEND_IMAGE:https://i.imgur.com/Tk9WM15.jpeg]
[cut]
มาตราฐานทันตเเพทย์แนะนำ
อัดแน่นสมุนไพรกว่า 5 ชนิด
ยับยั้งการเจริญเติบโตแบคทีเรียในช่องปาก
กระชับเหงือก ลดโอกาสการเกิดโรคเหงือก
ช่วยให้ฟันให้แข็งแรง ฟลูออไรด์สูงมาก 1500ppm
[SEND_IMAGE:https://i.imgur.com/Iz7zaK9.jpeg]
[cut]
จบปัญหาฟัน กลิ่นปาก คราบเหลือง
การันตีเห็นผลตั้งแต่หลอดแรกที่ใช้เลยค่ะ
[SEND_IMAGE:https://i.imgur.com/VRZCCXi.jpeg]
[cut]
[SEND_IMAGE:https://i.imgur.com/4rPBgoT.jpeg]
[SEND_VIDEO:https://www.dropbox.com/scl/fi/2z9sp3jha5s3nsqw8h11s/1.mp4?rlkey=pvbolh7c5j1n7pxqnyg8jmzyd&e=1&st=a6ddzvzi&dl=1]
[cut]
ส่งฟรี มีเก็บเงินปลายทางค่ะ
[SEND_IMAGE:https://i.imgur.com/mD7HVO5.jpeg]
[cut]
แนะนำโปรขายดี 2แถม3 ค่ะ
โปรนี้คุ้มมาก ใช้ได้ยาวนาน 5-6 เดือน
สามารถใช้ต่อเนื่องได้ยาวๆเลย เพื่อผลลัพธ์ที่ดีขึ้นค่ะ
แถมแปรงสีฟันพรี่เมี่ยม 1เซ็ต ถึง 6 ด้าม
[SEND_IMAGE:https://i.imgur.com/PznHSak.jpeg]
[cut]
สนใจรับโปรไหนดีคะ แจ้งแอดมินได้เลยค่ะ`;
      
      // ส่งข้อความเริ่มต้น
      await sendTextMessage(userId, welcomeMessage, pageKey);
      
      // บันทึกข้อความเริ่มต้นลงในประวัติการสนทนา
      await saveChatHistory(userId, welcomeMessage, "assistant");
      
      // บันทึกข้อความเริ่มต้นลงในประวัติการสนทนาของโมเดลบันทึกออเดอร์ด้วย
      await saveOrderChatHistory(userId, welcomeMessage, "assistant");
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`[ERROR] Failed to check and send welcome message: ${error.message}`);
    return false;
  }
}

