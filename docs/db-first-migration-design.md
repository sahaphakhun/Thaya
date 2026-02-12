# DB-First Migration Design (Instruction + Follow-up)

## Goal
เปลี่ยนส่วนที่พึ่งพา Google/Hardcode ให้ใช้ PostgreSQL เป็นแหล่งข้อมูลหลัก โดยไม่ทำให้ฟังก์ชันเดิมหาย:

- ระบบตอบแชทยังทำงานเหมือนเดิม
- ระบบ Instruction Manager ยังใช้งานได้
- ระบบ Follow-up ยังส่งข้อความได้ตามกฎเดิม

## Current Problems
จุดที่ยังพึ่งพาภายนอก/Hardcode:

1. `index.js` ดึง system instruction จาก Google Doc + Google Sheet
2. `index.js` ดึงกฎ follow-up จาก Google Sheet (`ติดตามลูกค้า!A2:B`)
3. `/api/default` ใน `instructionRoutes.js` คืนค่า default จาก Google โดยตรง
4. มีค่า ID/range แบบ hardcoded ในโค้ดหลายจุด

ผลกระทบ:

- เปลี่ยน/ทดสอบยาก
- เสี่ยงล่มเมื่อ Google API มีปัญหา
- ไม่มี single source of truth ในฐานข้อมูล

## Target Architecture (DB-First)
ให้ PostgreSQL เป็น source หลักดังนี้:

1. `instruction_defaults` เก็บ default instruction ที่ runtime ใช้จริง
2. `followup_rules` เก็บกฎติดตามลูกค้าแบบเรียงลำดับ
3. `instruction_versions` (เดิม) ใช้สำหรับจัดการเวอร์ชันใน UI ต่อไป

แนวทาง runtime:

- อ่านจาก DB ก่อนเสมอ
- ถ้ายังไม่มีข้อมูลใน DB ให้ fallback (Google/ค่าเดิม) ได้ชั่วคราว
- หลัง migration เสร็จ ค่อยปิด fallback

## Data Model
### 1) instruction_defaults
เก็บ baseline instruction ที่ `/api/default` และ runtime ควรอ่าน:

- `id` TEXT PK (ใช้ค่า singleton เช่น `default`)
- `name` TEXT
- `description` TEXT
- `google_doc` TEXT
- `sheet_data` JSONB
- `static_instructions` TEXT
- `source` TEXT (`google` | `code` | `manual`)
- `is_active` BOOLEAN
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

### 2) followup_rules
เก็บ rule ส่งติดตาม:

- `id` BIGSERIAL PK
- `step_index` INTEGER UNIQUE (0,1,2,...)
- `delay_minutes` INTEGER
- `message` TEXT
- `is_active` BOOLEAN
- `source` TEXT (`google` | `code` | `manual`)
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

## Migration Strategy
### Phase 1: Add schema + import script
- เพิ่มตารางใหม่
- สร้างสคริปต์ import:
  - Source `google`: ดึง Google Doc + Google Sheets แล้ว upsert ลง DB
  - Source `code`: ใช้ค่าจากโค้ด/ค่า fallback แล้ว upsert ลง DB

### Phase 2: Switch API default endpoint to DB-first
- `/api/default` อ่านจาก `instruction_defaults` ก่อน
- ถ้าไม่มีข้อมูลค่อย fallback ไป Google (ชั่วคราว)

### Phase 3: Switch runtime in `index.js` to DB-first
- โหลด instruction จาก `instruction_defaults`
- โหลด follow-up จาก `followup_rules`
- ถ้าไม่พบข้อมูล ค่อย fallback ไป Google

### Phase 4: Disable external dependency
- ลบ fallback Google เมื่อมั่นใจว่า DB seed ครบแล้ว

## Script Requirements
สคริปต์ต้องทำได้:

1. เลือก source ได้ (`google` หรือ `code`)
2. มีโหมด `--dry-run` สำหรับตรวจข้อมูลก่อนเขียนจริง
3. เป็น idempotent (รันซ้ำได้ ไม่สร้างข้อมูลซ้ำ)
4. upsert ทั้ง `instruction_defaults` และ `followup_rules`
5. log ผลลัพธ์ชัดเจน (จำนวน row ที่นำเข้า)

## Compatibility Rules
เพื่อไม่กระทบของเดิม:

1. ไม่ลบ endpoint เดิม
2. ไม่เปลี่ยน payload structure ของ `/api/default`, `/api/build`, `/api/versions*`
3. fallback ต้องยังอยู่ช่วงเปลี่ยนผ่าน

## Rollout Checklist
1. รัน script import จาก `google`
2. ตรวจค่าใน DB
3. เปิด DB-first read ใน API (`/api/default`)
4. เปิด DB-first read ใน runtime
5. monitor 24-48 ชั่วโมง
6. ค่อยปิด fallback Google
