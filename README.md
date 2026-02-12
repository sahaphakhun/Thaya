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
DATABASE_URL=your_postgresql_connection_string

# Optional (แผนลดพื้นที่ DB แบบ aggressive)
CHAT_HISTORY_MAX_MESSAGES=50
CHAT_HISTORY_SUMMARY_MIN_BATCH=10
CHAT_HISTORY_SUMMARY_SOURCE_MAX_CHARS=6000
CHAT_HISTORY_SUMMARY_MAX_CHARS=1200
ENABLE_CHAT_SUMMARY=true
ENABLE_ORDER_CHAT_HISTORY=false
MONGO_CONNECT_RETRY_COUNT=2
MONGO_OPERATION_RETRY_COUNT=1
MONGO_RETRY_DELAY_MS=500
INSTRUCTION_CACHE_TTL_MS=0
OPENAI_RESPONSE_NONCE_ENABLED=true

# Logging (ลด log ปริมาณสูงจาก webhook)
LOG_LEVEL=info
LOG_SUPPRESS_LEGACY_DEBUG=true
WEBHOOK_SUMMARY_INTERVAL_MS=60000
ORDER_SKIP_LOG_SAMPLE_RATE=0.1

# Auto import instruction/followup to Postgres at deploy/startup
AUTO_IMPORT_INSTRUCTION_DB=true
IMPORT_INSTRUCTION_SOURCE=code
# IMPORT_INSTRUCTION_ALLOW_FAILURE=true
# IMPORT_INSTRUCTION_FOLLOWUP_JSON=./followup-rules.json
# IMPORT_INSTRUCTION_SIMULATION_FILE=./instruction-simulation-output.txt
```

`INSTRUCTION_CACHE_TTL_MS`:
- `0` = แคช instruction ตลอดอายุโปรเซส (โหลดตอน startup และไม่รีเฟรชทุกข้อความ)
- `>0` = แคชตามจำนวนมิลลิวินาทีที่กำหนด และรีเฟรชเมื่อหมดอายุ

`OPENAI_RESPONSE_NONCE_ENABLED`:
- `true` = ใส่ nonce ไม่ซ้ำทุกครั้งก่อนเรียก OpenAI เพื่อลดโอกาสได้คำตอบแบบ cache-like
- `false` = ปิด nonce

`AUTO_IMPORT_INSTRUCTION_DB`:
- `true` = รันสคริปต์ import ลง Postgres อัตโนมัติตอน `npm start` (เหมาะกับ deploy)
- `false` = ไม่รัน auto import

`IMPORT_INSTRUCTION_SOURCE`:
- `code` = import จากข้อมูล local/snapshot (ค่าเริ่มต้น, ไม่พึ่ง Google)
- `google` = import จาก Google Doc + Google Sheets โดยตรง

`IMPORT_INSTRUCTION_ALLOW_FAILURE`:
- `true` = ถ้า import พลาด จะ log เตือนแล้วให้แอปเริ่มต่อ
- `false` = ถ้า import พลาด จะหยุด start (ค่าเริ่มต้น)

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
- 💾 เก็บข้อมูลใน PostgreSQL

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

## DB-First Migration (Instruction/Follow-up)

มีสคริปต์สำหรับย้ายข้อมูลจาก Google หรือจากข้อมูลในโค้ด/local snapshot ลง PostgreSQL:

```bash
# Dry-run (ไม่เขียน DB)
npm run import:instruction-db -- --source=google --dry-run

# ย้ายจาก Google เข้า Postgres
npm run import:instruction-db:google

# ย้ายจากโค้ด/local snapshot เข้า Postgres
npm run import:instruction-db:code

# กรณีมีไฟล์กฎ followup เอง (JSON array)
npm run import:instruction-db -- --source=code --followup-json=./followup-rules.json
```

หมายเหตุ:
- `/api/default` จะอ่านจาก Postgres (`instruction_defaults`) ก่อน และ fallback ไป Google ถ้ายังไม่มีข้อมูลใน DB
- สำหรับ `--source=code` สคริปต์จะพยายามอ่านจาก `instruction-simulation-output.txt` เป็นหลัก
- โครงร่างการย้ายระบบดูได้ที่ `docs/db-first-migration-design.md`
- ตอน deploy จริง (`npm start`) ระบบจะรัน `scripts/deploy-bootstrap.js` เพื่อ import ให้อัตโนมัติตาม env ด้านบน

## โครงสร้างโปรเจค

- `index.js` - ไฟล์หลักของแอปพลิเคชัน
- `config.js` - ไฟล์การตั้งค่า
- `package.json` - Dependencies และ scripts
- `railway.json` - การตั้งค่า Railway deployment
