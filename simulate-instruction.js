/*******************************************************
 * simulate-instruction.js
 * สคริปต์จำลองการสร้าง instruction ก่อนส่งไป GPT
 * เพื่อวิเคราะห์ Token Usage
 *******************************************************/

const fs = require('fs');
const { google } = require('googleapis');

// ====================== Config ======================
const GOOGLE_CLIENT_EMAIL = "aitar-888@eminent-wares-446512-j8.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGhyeINArKZgaV\nitEcK+o89ilPYeRNTNZgJT7VNHB5hgNLLeAcFLJ7IlCIqTLMoJEnnoDQil6aKaz8\nExVL83uSXRrzk4zQvtt3tIP31+9wOCb9D4ZGWfVP1tD0qdD4WJ1qqg1j1/8879pH\nUeQGEMuCnyVbcQ3GbYQjyYb3wEz/Qv7kMVggF+MIaGGw2NQwM0XcufSFtyxvvX2S\nb8uGc1A8R+Dn/tmcgMODhbtEgcMg6yXI5Y26MPfDjVrEbk0lfCr7IGFJX4ASYeKl\n0jhm0RGb+aya2cb55auLN3VPO5MQ+cOp8gHBf5GiC/YgF1gbRgF5b7LgmENBxSfH\nb3WVQodLAgMBAAECggEACKB14M7LdekXZHyAQrZL0EitbzQknLv33Xyw2B3rvJ7M\nr4HM/nC4eBj7y+ciUc8GZQ+CWc2GzTHTa66+mwAia1qdYbPp3LuhGM4Leq5zn/o+\nA3rJuG6PS4qyUMy89msPXW5fSj/oE535QREiFKYP2dtlia2GI4xoag+x9uZwfMUO\nWKEe7tiUoZQEiGhwtjLq9lyST4kGGmlhNee9OyhDJcw4uCt8Cepr++hMDleWUF6c\nX0nbGmoSS0sZ5Boy8ATMhw/3luaOAlTUEz/nVDvbbWlNL9etwLKiAVw+AQXsPHNW\nNWF7gyEIsEi0qSM3PtA1X7IdReRXHqmfiZs0J3qSQQKBgQD1+Yj37Yuqj8hGi5PY\n+M0ieMdGcbUOmJsM1yUmBMV4bfaTiqm504P6DIYAqfDDWeozcHwcdpG1AfFAihEi\nh6lb0qRk8YaGbzvac8mWhwo/jDA5QB97fjFa6uwtlewZ0Er/U3QmOeVVnVC1y1b0\nrbJD5yjvI3ve+gpwAz0glpIMiwKBgQDOnpD7p7ylG4NQunqmzzdozrzZP0L6EZyE\n141st/Hsp9rtO9/ADuH6WhpirQ516l5LLv7mLPA8S9CF/cSdWF/7WlxBPjM8WRs9\nACFNBJIwUfjzPnvECmtsayzRlKuyCAspnNSkzgtdtvf2xI82Z3BGov9goZfu+D4A\n36b1qXsIQQKBgQCO1CojhO0vyjPKOuxL9hTvqmBUWFyBMD4AU8F/dQ/RYVDn1YG+\npMKi5Li/E+75EHH9EpkO0g7Do3AaQNG4UjwWVJcfAlxSHa8Mp2VsIdfilJ2/8KsX\nQ2yXVYh04/Rn/No/ro7oT4AKmcGu/nbstxuncEgFrH4WOOzspATPsn72BwKBgG5N\nBAT0NKbHm0B7bIKkWGYhB3vKY8zvnejk0WDaidHWge7nabkzuLtXYoKO9AtKxG/K\ndNUX5F+r8XO2V0HQLd0XDezecaejwgC8kwp0iD43ZHkmQBgVn+dPB6wSe94coSjj\nyjj4reSnipQ3tmRKsAtldIN3gI5YA3Gf85dtlHqBAoGAD5ePt7cmu3tDZhA3A8f9\no8mNPvqz/WGs7H2Qgjyfc3jUxEGhVt1Su7J1j+TppfkKtJIDKji6rVA9oIjZtpZT\ngxnU6hcYuiwbLh3wGEFIjP1XeYYILudqfWOEbwnxD1RgMkCqfSHf/niWlfiH6p3F\ndnBsLY/qXdKfS/OXyezAm4M=\n-----END PRIVATE KEY-----\n";

const GOOGLE_DOC_ID = "1IDvCXWa_5QllMTKrVSvhLRQPNNGkYgxb8byaDGGEhyU";
const SPREADSHEET_ID = "1esN_P6JuPzYUGesR60zVuIGeuvSnRM1hlyaxCJbhI_c";
const SHEET_RANGE = "ชีต1!A2:B28";

// ====================== Functions ======================

// ดึง Google Doc Instructions
async function fetchGoogleDocInstructions() {
    try {
        console.log("[INFO] Fetching Google Doc instructions...");
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

        console.log("[INFO] Fetched Google Doc instructions OK.");
        return fullText.trim();
    } catch (err) {
        console.error("Failed to fetch systemInstructions:", err.message);
        return "Error fetching system instructions.";
    }
}

// ดึงข้อมูลจาก Google Sheets
async function fetchSheetData(spreadsheetId, range) {
    try {
        console.log(`[INFO] Fetching Sheet data: ${range}...`);
        const sheetsAuth = new google.auth.JWT({
            email: GOOGLE_CLIENT_EMAIL,
            key: GOOGLE_PRIVATE_KEY,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheetsApi = google.sheets({ version: 'v4', auth: sheetsAuth });

        const response = await sheetsApi.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        const rows = response.data.values;
        if (!rows || rows.length === 0) return [];
        console.log(`[INFO] Rows fetched from Sheet: ${rows.length} rows.`);
        return rows;
    } catch (err) {
        console.error("fetchSheetData error:", err.message);
        return [];
    }
}

// แปลง Rows เป็น JSON
function transformSheetRowsToJSON(rows) {
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

// สร้าง System Instructions (เหมือนใน index.js)
function buildSystemInstructions(googleDocInstructions, sheetJSON) {
    const sheetsDataString = JSON.stringify(sheetJSON, null, 2);

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

// จำลอง Chat History (ตัวอย่าง 30 ข้อความ)
function generateSampleChatHistory() {
    const sampleMessages = [];

    // จำลองประวัติการสนทนา
    const conversations = [
        { role: "user", content: "สวัสดีครับ" },
        { role: "assistant", content: "สวัสดีค่ะ ยินดีให้บริการค่ะ สนใจยาสีฟันทยาไหมคะ?" },
        { role: "user", content: "ขายอะไรครับ" },
        { role: "assistant", content: "ทยาเป็นยาสีฟันสูตรสมุนไพร ช่วยลดกลิ่นปาก ฟันขาว กำจัดแบคทีเรียได้ 99% ค่ะ" },
        { role: "user", content: "ราคาเท่าไหร่ครับ" },
        { role: "assistant", content: "โปรโมชั่นของเรามีดังนี้ค่ะ:\n- โปร 1 แถม 1 ราคา 290 บาท\n- โปร 2 แถม 3 ราคา 580 บาท (ยอดนิยม)\n- โปร 3 แถม 5 ราคา 870 บาท\n- โปร 5 แถม 9 ราคา 1,450 บาท\nสนใจโปรไหนดีคะ?" },
        { role: "user", content: "โปร 2 แถม 3 ดีไหมครับ" },
        { role: "assistant", content: "โปร 2 แถม 3 คุ้มค่ามากค่ะ ได้ยาสีฟัน 5 หลอด + แปรงสีฟัน 1 แพ็ก ใช้ได้ 5-6 เดือนเลยค่ะ" },
        { role: "user", content: "เอาโปร 2 แถม 3 1 ชุดครับ" },
        { role: "assistant", content: "ยินดีค่ะ รบกวนขอชื่อ-ที่อยู่ และเบอร์โทรสำหรับจัดส่งด้วยนะคะ" },
        { role: "user", content: "ชื่อ นายสมชาย ใจดี" },
        { role: "assistant", content: "รับทราบค่ะ คุณสมชาย รบกวนขอที่อยู่สำหรับจัดส่งด้วยนะคะ" },
        { role: "user", content: "123/45 หมู่ 6 ตำบลในเมือง อำเภอเมือง จังหวัดขอนแก่น 40000" },
        { role: "assistant", content: "รับทราบค่ะ รบกวนขอเบอร์โทรติดต่อด้วยนะคะ" },
        { role: "user", content: "0812345678" },
        { role: "assistant", content: "สรุปออเดอร์ค่ะ:\n- โปร 2 แถม 3 ราคา 580 บาท\n- ชื่อ: นายสมชาย ใจดี\n- ที่อยู่: 123/45 หมู่ 6 ตำบลในเมือง อำเภอเมือง จังหวัดขอนแก่น 40000\n- เบอร์โทร: 0812345678\n- ชำระเงินปลายทาง\nยืนยันการสั่งซื้อไหมคะ?" },
        { role: "user", content: "ยืนยันครับ" },
        { role: "assistant", content: "ขอบคุณค่ะ ออเดอร์ได้รับการบันทึกแล้วค่ะ จะจัดส่งภายใน 2-3 วันทำการค่ะ" },
        { role: "user", content: "ขอบคุณครับ" },
        { role: "assistant", content: "ยินดีค่ะ หากมีข้อสงสัยเพิ่มเติมสอบถามได้เลยนะคะ" },
    ];

    // เพิ่ม timestamp เหมือนในโค้ดจริง
    const formatTimestampThai = (date) => {
        const d = new Date(date);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = (d.getFullYear() + 543).toString();
        const hour = d.getHours().toString().padStart(2, '0');
        const min = d.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hour}:${min}`;
    };

    let baseTime = Date.now() - (conversations.length * 60000); // เริ่มจากหลายนาทีก่อน

    for (const msg of conversations) {
        const timestamp = new Date(baseTime);
        const timeStr = formatTimestampThai(timestamp);
        sampleMessages.push({
            role: msg.role,
            content: `[ข้อความนี้ส่งเมื่อ ${timeStr}] ${msg.content}`
        });
        baseTime += 60000; // เพิ่มทีละ 1 นาที
    }

    return sampleMessages;
}

// ฟังก์ชันนับ Token โดยประมาณ (1 token ≈ 4 characters สำหรับภาษาอังกฤษ, 1-2 characters สำหรับภาษาไทย)
function estimateTokens(text) {
    // สำหรับภาษาไทยผสมอังกฤษ ใช้ค่าประมาณ 1 token ≈ 2.5 characters
    return Math.ceil(text.length / 2.5);
}

// ====================== Main ======================
async function main() {
    console.log("=".repeat(60));
    console.log("🔍 THAYA Chatbot - Instruction Simulation");
    console.log("=".repeat(60));
    console.log("");

    // 1. ดึงข้อมูลจาก Google Doc
    const googleDocInstructions = await fetchGoogleDocInstructions();

    // 2. ดึงข้อมูลจาก Google Sheets
    const sheetRows = await fetchSheetData(SPREADSHEET_ID, SHEET_RANGE);
    const sheetJSON = transformSheetRowsToJSON(sheetRows);

    // 3. สร้าง System Instructions
    const systemInstructions = buildSystemInstructions(googleDocInstructions, sheetJSON);

    // 4. สร้าง Sample Chat History
    const chatHistory = generateSampleChatHistory();

    // 5. จำลองข้อความใหม่จากผู้ใช้
    const newUserMessage = "สอบถามหน่อยครับ ถ้าจะสั่งโปรใหม่อีก 1 ชุด ใช้ที่อยู่เดิมได้ไหมครับ";

    // 6. สร้าง Full Messages Array (เหมือนที่ส่งไป GPT)
    const fullMessages = [
        { role: "system", content: systemInstructions },
        ...chatHistory,
        { role: "user", content: newUserMessage }
    ];

    // 7. คำนวณสถิติ
    const stats = {
        systemInstructionsLength: systemInstructions.length,
        systemInstructionsTokens: estimateTokens(systemInstructions),
        googleDocLength: googleDocInstructions.length,
        googleDocTokens: estimateTokens(googleDocInstructions),
        sheetDataLength: JSON.stringify(sheetJSON, null, 2).length,
        sheetDataTokens: estimateTokens(JSON.stringify(sheetJSON, null, 2)),
        chatHistoryLength: JSON.stringify(chatHistory).length,
        chatHistoryTokens: estimateTokens(JSON.stringify(chatHistory)),
        chatHistoryMessages: chatHistory.length,
        newMessageLength: newUserMessage.length,
        newMessageTokens: estimateTokens(newUserMessage),
        totalLength: JSON.stringify(fullMessages).length,
        totalTokens: 0
    };

    stats.totalTokens = stats.systemInstructionsTokens + stats.chatHistoryTokens + stats.newMessageTokens;

    // 8. สร้าง Output
    const output = [];
    const separator = "=".repeat(80);

    output.push(separator);
    output.push("📊 THAYA CHATBOT - INSTRUCTION SIMULATION REPORT");
    output.push(`📅 Generated at: ${new Date().toLocaleString('th-TH')}`);
    output.push(separator);
    output.push("");

    output.push("╔══════════════════════════════════════════════════════════════════════════════╗");
    output.push("║                           📈 TOKEN USAGE SUMMARY                             ║");
    output.push("╠══════════════════════════════════════════════════════════════════════════════╣");
    output.push(`║ 1. System Instructions:     ${stats.systemInstructionsTokens.toString().padStart(6)} tokens  (${stats.systemInstructionsLength.toString().padStart(6)} chars)        ║`);
    output.push(`║    ├─ Google Doc:           ${stats.googleDocTokens.toString().padStart(6)} tokens  (${stats.googleDocLength.toString().padStart(6)} chars)        ║`);
    output.push(`║    └─ Sheet Data:           ${stats.sheetDataTokens.toString().padStart(6)} tokens  (${stats.sheetDataLength.toString().padStart(6)} chars)        ║`);
    output.push(`║ 2. Chat History:            ${stats.chatHistoryTokens.toString().padStart(6)} tokens  (${stats.chatHistoryMessages.toString().padStart(6)} messages)       ║`);
    output.push(`║ 3. New User Message:        ${stats.newMessageTokens.toString().padStart(6)} tokens  (${stats.newMessageLength.toString().padStart(6)} chars)        ║`);
    output.push("╠══════════════════════════════════════════════════════════════════════════════╣");
    output.push(`║ 🔴 TOTAL ESTIMATED:         ${stats.totalTokens.toString().padStart(6)} tokens (input only)                 ║`);
    output.push("╚══════════════════════════════════════════════════════════════════════════════╝");
    output.push("");

    // ประมาณค่าใช้จ่าย
    const costPer1kTokens_gpt4mini = 0.00015; // GPT-4.1-mini input price
    const estimatedCost = (stats.totalTokens / 1000) * costPer1kTokens_gpt4mini;

    output.push("╔══════════════════════════════════════════════════════════════════════════════╗");
    output.push("║                           💰 COST ESTIMATION                                 ║");
    output.push("╠══════════════════════════════════════════════════════════════════════════════╣");
    output.push(`║ Cost per request (input):   $${estimatedCost.toFixed(6).padStart(10)}                               ║`);
    output.push(`║ Cost per 100 requests:      $${(estimatedCost * 100).toFixed(4).padStart(10)}                               ║`);
    output.push(`║ Cost per 1,000 requests:    $${(estimatedCost * 1000).toFixed(3).padStart(10)}                               ║`);
    output.push(`║ Cost per 10,000 requests:   $${(estimatedCost * 10000).toFixed(2).padStart(10)}                               ║`);
    output.push("╚══════════════════════════════════════════════════════════════════════════════╝");
    output.push("");

    output.push(separator);
    output.push("SECTION 1: SYSTEM INSTRUCTIONS (ส่งไป GPT ทุกครั้ง)");
    output.push(separator);
    output.push("");
    output.push(systemInstructions);
    output.push("");

    output.push(separator);
    output.push("SECTION 2: CHAT HISTORY (ประวัติการสนทนา)");
    output.push(separator);
    output.push("");
    for (const msg of chatHistory) {
        output.push(`[${msg.role.toUpperCase()}]:`);
        output.push(msg.content);
        output.push("");
    }

    output.push(separator);
    output.push("SECTION 3: NEW USER MESSAGE (ข้อความใหม่จากผู้ใช้)");
    output.push(separator);
    output.push("");
    output.push(newUserMessage);
    output.push("");

    output.push(separator);
    output.push("SECTION 4: FULL REQUEST TO GPT (JSON Format)");
    output.push(separator);
    output.push("");
    output.push(JSON.stringify(fullMessages, null, 2));
    output.push("");

    output.push(separator);
    output.push("📌 RECOMMENDATIONS TO REDUCE TOKENS:");
    output.push(separator);
    output.push("");
    output.push("1. ❌ Timestamp ในทุกข้อความ: เพิ่ม ~40 tokens/ข้อความ");
    output.push("   ✅ แนะนำ: ลบ timestamp ออก หรือเก็บเฉพาะ 3 ข้อความล่าสุด");
    output.push("");
    output.push("2. ❌ Chat History ไม่จำกัด: ยิ่งคุยนาน ยิ่งใช้ token มาก");
    output.push("   ✅ แนะนำ: จำกัดให้เหลือ 10-20 ข้อความล่าสุด");
    output.push("");
    output.push("3. ❌ Sheet Data ใช้ Pretty-print JSON");
    output.push("   ✅ แนะนำ: ใช้ JSON.stringify(data) แบบไม่มี whitespace");
    output.push("");
    output.push("4. ❌ ส่ง Full System Instructions ทุกครั้ง");
    output.push("   ✅ แนะนำ: ย่อ/สรุป instructions ให้กระชับ");
    output.push("");

    // 9. บันทึกลงไฟล์
    const outputText = output.join("\n");
    const outputPath = '/Users/mac/pp/Thaya-2/instruction-simulation-output.txt';

    fs.writeFileSync(outputPath, outputText, 'utf8');

    console.log("");
    console.log("✅ Simulation completed!");
    console.log(`📄 Output saved to: ${outputPath}`);
    console.log("");
    console.log("📊 Quick Summary:");
    console.log(`   - Total estimated tokens: ${stats.totalTokens}`);
    console.log(`   - System Instructions: ${stats.systemInstructionsTokens} tokens`);
    console.log(`   - Chat History (${stats.chatHistoryMessages} msgs): ${stats.chatHistoryTokens} tokens`);
    console.log(`   - Estimated cost per request: $${estimatedCost.toFixed(6)}`);
    console.log("");
}

main().catch(err => {
    console.error("Error running simulation:", err);
    process.exit(1);
});
