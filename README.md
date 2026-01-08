# THAYA Chatbot for Railway

Chatbot สำหรับ Facebook Messenger ที่ใช้ AI และระบบติดตามลูกค้าอัตโนมัติ

## การติดตั้งใน Railway

### 1. Deploy to Railway
- เชื่อมต่อ GitHub repository กับ Railway
- Railway จะ build และ deploy โปรเจคอัตโนมัติ

### 2. ตั้งค่า Environment Variables
ตั้งค่า environment variables ต่อไปนี้ใน Railway:

```
PORT=3000
PAGE_ACCESS_TOKEN=your_facebook_page_access_token
PAGE_ACCESS_TOKEN_2=your_page2_token
PAGE_ACCESS_TOKEN_3=your_page3_token
# ... เพิ่มตามจำนวนเพจ
OPENAI_API_KEY=your_openai_api_key
VERIFY_TOKEN=AiDee_a4wfaw4
MONGO_URI=your_mongodb_connection_string

# Optional (แผนลดพื้นที่ MongoDB แบบ aggressive)
CHAT_HISTORY_MAX_MESSAGES=50
CHAT_HISTORY_SUMMARY_MIN_BATCH=10
CHAT_HISTORY_SUMMARY_SOURCE_MAX_CHARS=6000
CHAT_HISTORY_SUMMARY_MAX_CHARS=1200
ENABLE_CHAT_SUMMARY=true
ENABLE_ORDER_CHAT_HISTORY=false
```

### 3. ตั้งค่า Webhook URL
ตั้งค่า Facebook Webhook URL เป็น:
```
https://your-railway-app.railway.app/webhook
```

## ฟีเจอร์หลัก

- 🤖 AI Chatbot ด้วย GPT-4
- 📱 รองรับหลาย Facebook Pages
- 📊 ระบบบันทึกออเดอร์อัตโนมัติ
- 🔄 ระบบติดตามลูกค้าอัตโนมัติ
- 📈 เชื่อมต่อ Google Sheets และ Google Docs
- 💾 เก็บข้อมูลใน MongoDB

## การใช้งาน

1. **เริ่มต้น**: ระบบจะส่งข้อความต้อนรับอัตโนมัติ
2. **แชท**: ลูกค้าสามารถแชทกับ AI ได้
3. **สั่งซื้อ**: ระบบจะตรวจจับและบันทึกออเดอร์อัตโนมัติ
4. **ติดตาม**: ระบบจะส่งข้อความติดตามตามกำหนดเวลา

## การพัฒนา

```bash
# ติดตั้ง dependencies
npm install

# รันในโหมด development
npm run dev

# รันในโหมด production
npm start
```

## โครงสร้างโปรเจค

- `index.js` - ไฟล์หลักของแอปพลิเคชัน
- `config.js` - ไฟล์การตั้งค่า
- `package.json` - Dependencies และ scripts
- `railway.json` - การตั้งค่า Railway deployment
