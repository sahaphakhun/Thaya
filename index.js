// -----------------------------------
// Original code with #DELETEMANY logic added
// -----------------------------------
const express = require('express');
const bodyParser = require('body-parser');
const util = require('util');
const { google } = require('googleapis');
const { MongoClient } = require('mongodb');
const { OpenAI } = require('openai');
const line = require('@line/bot-sdk');
const sharp = require('sharp'); // <--- เพิ่มตรงนี้ ตามต้นฉบับ

const PORT = process.env.PORT || 3000;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MONGO_URI = process.env.MONGO_URI;
const GOOGLE_CLIENT_EMAIL = "aitar-888@eminent-wares-446512-j8.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGhyeINArKZgaV\nitEcK+o89ilPYeRNTNZgJT7VNHB5hgNLLeAcFLJ7IlCIqTLMoJEnnoDQil6aKaz8\nExVL83uSXRrzk4zQvtt3tIP31+9wOCb9D4ZGWfVP1tD0qdD4WJ1qqg1j1/8879pH\nUeQGEMuCnyVbcQ3GbYQjyYb3wEz/Qv7kMVggF+MIaGGw2NQwM0XcufSFtyxvvX2S\nb8uGc1A8R+Dn/tmcgMODhbtEgcMg6yXI5Y26MPfDjVrEbk0lfCr7IGFJX4ASYeKl\n0jhm0RGb+aya2cb55auLN3VPO5MQ+cOp8gHBf5GiC/YgF1gbRgF5b7LgmENBxSfH\nb3WVQodLAgMBAAECggEACKB14M7LdekXZHyAQrZL0EitbzQknLv33Xyw2B3rvJ7M\nr4HM/nC4eBj7y+ciUc8GZQ+CWc2GzTHTa66+mwAia1qdYbPp3LuhGM4Leq5zn/o+\nA3rJuG6PS4qyUMy89msPXW5fSj/oE535QREiFKYP2dtlia2GI4xoag+x9uZwfMUO\nWKEe7tiUoZQEiGhwtjLq9lyST4kGGmlhNee9OyhDJcw4uCt8Cepr++hMDleWUF6c\nX0nbGmoSS0sZ5Boy8ATMhw/3luaOAlTUEz/nVDvbbWlNL9etwLKiAVw+AQXsPHNW\nNWF7gyEIsEi0qSM3PtA1X7IdReRXHqmfiZs0J3qSQQKBgQD1+Yj37Yuqj8hGi5PY\n+M0ieMdGcbUOmJsM1yUmBMV4bfaTiqm504P6DIYAqfDDWeozcHwcdpG1AfFAihEi\nh6lb0qRk8YaGbzvac8mWhwo/jDA5QB97fjFa6uwtlewZ0Er/U3QmOeVVnVC1y1b0\nrbJD5yjvI3ve+gpwAz0glpIMiwKBgQDOnpD7p7ylG4NQunqmzzdozrzZP0L6EZyE\n141st/Hsp9rtO9/ADuH6WhpirQ516l5LLv7mLPA8S9CF/cSdWF/7WlxBPjM8WRs9\nACFNBJIwUfjzPnvECmtsayzRlKuyCAspnNSkzgtdtvf2xI82Z3BGov9goZfu+D4A\n36b1qXsIQQKBgQCO1CojhO0vyjPKOuxL9hTvqmBUWFyBMD4AU8F/dQ/RYVDn1YG+\npMKi5Li/E+75EHH9EpkO0g7Do3AaQNG4UjwWVJcfAlxSHa8Mp2VsIdfilJ2/8KsX\nQ2yXVYh04/Rn/No/ro7oT4AKmcGu/nbstxuncEgFrH4WOOzspATPsn72BwKBgG5N\nBAT0NKbHm0B7bIKkWGYhB3vKY8zvnejk0WDaidHWge7nabkzuLtXYoKO9AtKxG/K\ndNUX5F+r8XO2V0HQLd0XDezecaejwgC8kwp0iD43ZHkmQBgVn+dPB6wSe94coSjj\nyjj4reSnipQ3tmRKsAtldIN3gI5YA3Gf85dtlHqBAoGAD5ePt7cmu3tDZhA3A8f9\no8mNPvqz/WGs7H2Qgjyfc3jUxEGhVt1Su7J1j+TppfkKtJIDKji6rVA9oIjZtpZT\ngxnU6hcYuiwbLh3wGEFIjP1XeYYILudqfWOEbwnxD1RgMkCqfSHf/niWlfiH6p3F\ndnBsLY/qXdKfS/OXyezAm4M=\n-----END PRIVATE KEY-----\n";
const GOOGLE_DOC_ID = "1U-2OPVVI_Gz0-uFonrRNrcFopDqmPGUcJ4qJ1RdAqxY";
const SPREADSHEET_ID = "15nU46XyAh0zLAyD_5DJPfZ2Gog6IOsoedSCCMpnjEJo";
const FLOW_TEXT = `{
"Main flow ขั้นตอนในการถามตอบ":[
 {
  "Flow name": "ติดต่อครั้งแรก (ไม่เคยซื้อสินค้าหรือใช้บริการมาก่อนเลย)",
  "Step": 1,
  "Process description": "ทักทาย ลูกค้า",
  "Role": "Admin",
  "Flow no.": "A01"
 },
 {
  "Flow name": "ติดต่อครั้งแรก (ไม่เคยซื้อสินค้าหรือใช้บริการมาก่อนเลย)",
  "Step": 2,
  "Process description": "สอบถามรายละเอียดงานที่ต้องการทำ เช่น งานเนมเพลทกัดกรด งานสติ๊กเกอร์",
  "Role": "Sales",
  "Flow no.": "A01"
 },
 {
  "Flow name": "ติดต่อครั้งแรก (ไม่เคยซื้อสินค้าหรือใช้บริการมาก่อนเลย)",
  "Step": 3,
  "Process description": "ขอรูปงานที่ต้องการทำจากลูกค้า",
  "Role": "Sales",
  "Flow no.": "A01"
 },
 {
  "Flow name": "ติดต่อครั้งแรก (ไม่เคยซื้อสินค้าหรือใช้บริการมาก่อนเลย)",
  "Step": 4,
  "Process description": "ขอรายละเอียดที่ใช้สำหรับประเมินราคา ดังนี้\n1. วัสดุ\n2. ขนาด\n3. จำนวน\n4. ติดตั้งหรือไม่ (บางประเภทงานไม่ต้องติดตั้ง)",
  "Role": "Sales",
  "Flow no.": "A01"
 },
 {
  "Flow name": "ติดต่อครั้งแรก (ไม่เคยซื้อสินค้าหรือใช้บริการมาก่อนเลย)",
  "Step": 5,
  "Process description": "ขอ\n1. ชื่อ \n2. เบอร์โทรศัพท์\n3. ที่อยู่ (หากลูกค้าแจ้งมา)\nสำหรับออกใบเสนอราคา",
  "Role": "Admin",
  "Flow no.": "A01"
 },
 {
  "Flow name": "ติดต่อครั้งแรก (ไม่เคยซื้อสินค้าหรือใช้บริการมาก่อนเลย)",
  "Step": 6,
  "Process description": "แจ้งหมายเลข Lead ",
  "Role": "Sales",
  "Flow no.": "A01"
 },
 {
  "Flow name": "เคยติดต่อมาแล้ว แต่ติดต่อมาอีกที",
  "Step": 1,
  "Process description": "ทักทาย ลูกค้า",
  "Role": "Admin",
  "Flow no.": "A02"
 },
 {
  "Flow name": "เคยติดต่อมาแล้ว แต่ติดต่อมาอีกที",
  "Step": 2,
  "Process description": "สอบถามรายละเอียดงานที่ต้องการทำ เช่น งานเนมเพลทกัดกรด งานสติ๊กเกอร์",
  "Role": "Sales",
  "Flow no.": "A02"
 },
 {
  "Flow name": "เคยติดต่อมาแล้ว แต่ติดต่อมาอีกที",
  "Step": 3,
  "Process description": "ขอรูปงานที่ต้องการทำจากลูกค้า",
  "Role": "Sales",
  "Flow no.": "A02"
 },
 {
  "Flow name": "เคยติดต่อมาแล้ว แต่ติดต่อมาอีกที",
  "Step": 4,
  "Process description": "ขอรายละเอียดที่ใช้สำหรับประเมินราคา ดังนี้\n1. วัสดุ\n2. ขนาด\n3. จำนวน\n4. ติดตั้งหรือไม่ (บางประเภทงานไม่ต้องติดตั้ง)",
  "Role": "Sales",
  "Flow no.": "A02"
 },
 {
  "Flow name": "เคยติดต่อมาแล้ว แต่ติดต่อมาอีกที",
  "Step": 5,
  "Process description": "สอบถามลูกค้าเพื่อทวน ว่ายังใช้ชื่อที่อยู่เดิมที่เคยให้ไวไหม หากไม่ใช่ให้ขอใหม่",
  "Role": "Admin",
  "Flow no.": "A02"
 },
 {
  "Flow name": "เคยติดต่อมาแล้ว แต่ติดต่อมาอีกที",
  "Step": 6,
  "Process description": "สอบถามว่าต้องการให้รวมใบเสนอราคาหรือไม่ สำหรับลูกค้าที่ติดต่อมาไม่เกิน 7 วัน",
  "Role": "Admin",
  "Flow no.": "A02"
 },
 {
  "Flow name": "เคยติดต่อมาแล้ว แต่ติดต่อมาอีกที",
  "Step": 7,
  "Process description": "แจ้งหมายเลข Lead ",
  "Role": "Sales",
  "Flow no.": "A02"
 },
 {
  "Flow name": "ลูกค้าแจ้งชำระเงินแล้ว",
  "Step": 1,
  "Process description": "ได้รับหลักฐานการโอนจากลูกค้า",
  "Role": "Admin",
  "Flow no.": "AC01"
 },
 {
  "Flow name": "ลูกค้าแจ้งชำระเงินแล้ว",
  "Step": 2,
  "Process description": "ทักทาย ลูกค้า",
  "Role": "Admin",
  "Flow no.": "AC01"
 },
 {
  "Flow name": "ลูกค้าแจ้งชำระเงินแล้ว",
  "Step": 3,
  "Process description": "ตรวจสอบความถูกด้องของ slip เงินโอนที่ได้รับจากลูกค้า",
  "Role": "Accountant",
  "Flow no.": "AC01"
 },
 {
  "Flow name": "ลูกค้าแจ้งชำระเงินแล้ว",
  "Step": 4,
  "Process description": "ขอรายละเอียดสำหรับออกใบเสร็จ และ ใบกำกับภาษี",
  "Role": "Accountant",
  "Flow no.": "AC01"
 },
 {
  "Flow name": "ลูกค้าแจ้งชำระเงินแล้ว",
  "Step": 5,
  "Process description": "แจ้ง Process ที่ลูกค้าต้องเจอต่อไป เช่น ภายใน 24 ชั่วโมงทางฝ่ายกราฟฟิกจะติดต่อกลับเพื่อส่งแบบ",
  "Role": "Accountant",
  "Flow no.": "AC01"
 },
 {
  "Flow name": "ลูกค้าแจ้งชำระเงินแล้ว",
  "Step": 6,
  "Process description": "เช็คไฟล์แบบที่ลูกค้าส่งมาให้ว่าพอใช้ได้ไหม",
  "Role": "Admin",
  "Flow no.": "AC01"
 },
 {
  "Flow name": "ลูกค้าติดตามแบบ",
  "Step": 1,
  "Process description": "ทักทาย ลูกค้า",
  "Role": "Admin",
  "Flow no.": "G01"
 },
 {
  "Flow name": "ลูกค้าติดตามแบบ",
  "Step": 2,
  "Process description": "แจ้ง Graphic เพื่อติดตามแบบ",
  "Role": "Admin",
  "Flow no.": "G01"
 },
 {
  "Flow name": "ลูกค้าติดตามแบบ",
  "Step": 3,
  "Process description": "แจ้งกลับลูกค้าว่ารออีกกี่วัน",
  "Role": "Graphic",
  "Flow no.": "G01"
 },
 {
  "Flow name": "ลูกค้าติดตามงาน",
  "Step": 1,
  "Process description": "ทักทาย ลูกค้า",
  "Role": "Admin",
  "Flow no.": "P001"
 },
 {
  "Flow name": "ลูกค้าติดตามงาน",
  "Step": 2,
  "Process description": "เช็ครายละเอียดจากเลข lead ลูกค้า",
  "Role": "Planning",
  "Flow no.": "P001"
 },
 {
  "Flow name": "ลูกค้าติดตามงาน",
  "Step": 3,
  "Process description": "ตอบกลับ due date ที่เราทำได้",
  "Role": "Planning",
  "Flow no.": "P001"
 },
 {
  "Flow name": "แจ้งงานเสร็จ",
  "Step": 1,
  "Process description": "ได้รับข้อมูลจาก Wrike (web project manager)",
  "Role": "Accountant",
  "Flow no.": "AC02"
 },
 {
  "Flow name": "แจ้งงานเสร็จ",
  "Step": 2,
  "Process description": "แจ้งลูกค้าว่างานแล้วเสร็จแล้ว โดยส่งรูปงานเสร็จให้ลูกค้าดู",
  "Role": "Accountant",
  "Flow no.": "AC02"
 },
 {
  "Flow name": "แจ้งงานเสร็จ",
  "Step": 3,
  "Process description": "ส่งรายละเอียดวิธีการจัดส่งที่เรามีให้ลูกค้าเลือก พร้อมแจ้งราคา",
  "Role": "Accountant",
  "Flow no.": "AC02"
 },
 {
  "Flow name": "แจ้งงานเสร็จ",
  "Step": 4,
  "Process description": "ส่งใบแจ้งหนี้ให้ลูกค้า",
  "Role": "Accountant",
  "Flow no.": "AC02"
 },
 {
  "Flow name": "ลูกค้าคุยทั่วๆไป",
  "Step": 1,
  "Process description": "ทักทาย ลูกค้า",
  "Role": "Admin",
  "Flow no.": "A03"
 },
 {
  "Flow name": "ลูกค้าคุยทั่วๆไป",
  "Step": 2,
  "Process description": "ตอบสิ่งที่ลูกค้าถาม เช่น แผนที่ หมายเลขบัญชี หมายเลขโทรศัพท์ รายละเอียดการติดต่อทั่วๆไป",
  "Role": "Admin",
  "Flow no.": "A03"
 }
],
"Product flow (ข้อมูลที่ต้องใช้ส":[
 {
  "No.": 1,
  "Product": "ป้ายตัวอักษร",
  "Material": "เหล็กซิงค์ และ สังกะสี",
  "Surface finishing": "n\/a",
  "Width": "in cm.",
  "Height": "in cm.",
  "Shape": "n\/a",
  "Thickness": "1.ถ้ามี\n2. ความหนายกขอบ",
  "Material color": "n\/a",
  "Process": "1. ตัดเลเซอร์ พร้อมยกขอบ\n2. ตัดเลเซอร์ พร้อมเชื่อมขาลอยจากผนัง\n3. ตัดเลเซอร์แผ่นแบน\n\nควรมีรูปประกอบ",
  "Painted": "พ่นสีด้วยสีพ่นรถยนต์\n",
  "ประเภทไฟ": "1. ออกหน้า\n2. ออกหลัง \n3. ออกหน้าและหลัง\n4. ไม่มีไฟ\n\nควรมีรูปประกอบ",
  "ป้ายมีกี่หน้า": "n\/a",
  "Amount": "set",
  "ต้องการให้ไปติดตั้งหรือไม่": "1. yes\n2. no",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 1,
  "Product": "ป้ายตัวอักษร",
  "Material": "สแตนเลส",
  "Surface finishing": "1. ผิว Hairline\n2. ผิว เงา\n\nควรมีรูปประกอบ",
  "Width": "in cm.",
  "Height": "in cm.",
  "Shape": "n\/a",
  "Thickness": "1.ถ้ามี\n2. ความหนายกขอบ",
  "Material color": "สีเงิน",
  "Process": "1. ตัดเลเซอร์ พร้อมยกขอบ\n2. ตัดเลเซอร์ พร้อมเชื่อมขาลอยจากผนัง\n3. ตัดเลเซอร์แผ่นแบน\n\nควรมีรูปประกอบ",
  "Painted": "1. พ่นสีด้วยสีพ่นรถยนต์\n2. ไม่พ่นสี",
  "ประเภทไฟ": "1. ออกหน้า\n2. ออกหลัง \n3. ออกหน้าและหลัง\n4. ไม่มีไฟ\n\nควรมีรูปประกอบ",
  "ป้ายมีกี่หน้า": "n\/a",
  "Amount": "set",
  "ต้องการให้ไปติดตั้งหรือไม่": "1. yes\n2. no",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 1,
  "Product": "ป้ายตัวอักษร",
  "Material": "สแตนเลสหน้าสีต่างๆ",
  "Surface finishing": "1. ผิว Hairline\n2. ผิว เงา\n\nควรมีรูปประกอบ",
  "Width": "in cm.",
  "Height": "in cm.",
  "Shape": "n\/a",
  "Thickness": "1.ถ้ามี\n2. ความหนายกขอบ",
  "Material color": "1.สีทอง\n2. สี rosegold\n3. สี pink gold\n4. สีดำ\n\nควรมีรูปประกอบ",
  "Process": "1. ตัดเลเซอร์ พร้อมยกขอบ\n2. ตัดเลเซอร์ พร้อมเชื่อมขาลอยจากผนัง\n3. ตัดเลเซอร์แผ่นแบน\n\nควรมีรูปประกอบ",
  "Painted": "ไม่พ่นสี",
  "ประเภทไฟ": "1. ออกหน้า\n2. ออกหลัง \n3. ออกหน้าและหลัง\n4. ไม่มีไฟ\n\nควรมีรูปประกอบ",
  "ป้ายมีกี่หน้า": "n\/a",
  "Amount": "set",
  "ต้องการให้ไปติดตั้งหรือไม่": "1. yes\n2. no",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 1,
  "Product": "ป้ายตัวอักษร",
  "Material": "ทองเหลือง",
  "Surface finishing": "1. ผิว Hairline\n2. ผิว เงา\n\nควรมีรูปประกอบ",
  "Width": "in mm.",
  "Height": "in mm.",
  "Shape": "n\/a",
  "Thickness": "Hairline\n1. 0.8 mm.\n2. 2 mm.\n\nเงา\n1. 0.8 mm.\n2. 2 mm.",
  "Material color": "สีทอง",
  "Process": "1. ตัดเลเซอร์ พร้อมยกขอบ\n2. ตัดเลเซอร์ พร้อมเชื่อมขาลอยจากผนัง\n3. ตัดเลเซอร์แผ่นแบน\n\nควรมีรูปประกอบ",
  "Painted": "ไม่พ่นสี",
  "ประเภทไฟ": "1. ออกหน้า\n2. ออกหลัง \n3. ออกหน้าและหลัง\n4. ไม่มีไฟ\n\nควรมีรูปประกอบ",
  "ป้ายมีกี่หน้า": "n\/a",
  "Amount": "set",
  "ต้องการให้ไปติดตั้งหรือไม่": "1. yes\n2. no",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 1,
  "Product": "ป้ายตัวอักษร",
  "Material": "อลูมิเนียม",
  "Surface finishing": "n\/a",
  "Width": "in cm.",
  "Height": "in cm.",
  "Shape": "n\/a",
  "Thickness": "1.ถ้ามี\n2. ความหนายกขอบ",
  "Material color": "สีเงิน",
  "Process": "1. ตัดเลเซอร์ พร้อมยกขอบ\n2. ตัดเลเซอร์ พร้อมเชื่อมขาลอยจากผนัง\n3. ตัดเลเซอร์แผ่นแบน\n\nควรมีรูปประกอบ",
  "Painted": "1. พ่นสีด้วยสีพ่นรถยนต์\n2. ไม่พ่นสี",
  "ประเภทไฟ": "1. ออกหน้า\n2. ออกหลัง \n3. ออกหน้าและหลัง\n4. ไม่มีไฟ\n\nควรมีรูปประกอบ",
  "ป้ายมีกี่หน้า": "n\/a",
  "Amount": "set",
  "ต้องการให้ไปติดตั้งหรือไม่": "1. yes\n2. no",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 1,
  "Product": "ป้ายตัวอักษร",
  "Material": "พลาสวู๊ด",
  "Surface finishing": "n\/a",
  "Width": "in cm.",
  "Height": "in cm.",
  "Shape": "n\/a",
  "Thickness": "1.ถ้ามี\n2. ความหนายกขอบ",
  "Material color": "สีขาว",
  "Process": "1. ตัด CNC พร้อมยกขอบ\n2. ตัด CNC พร้อมติดขาลอยจากผนัง\n3. ตัด CNC แผ่นแบน\n\nควรมีรูปประกอบ",
  "Painted": "1. พ่นสีด้วยสีพ่นรถยนต์\n2. ไม่พ่นสี",
  "ประเภทไฟ": "1. ออกหน้า\n2. ออกหลัง \n3. ออกหน้าและหลัง\n4. ไม่มีไฟ\n\nควรมีรูปประกอบ",
  "ป้ายมีกี่หน้า": "n\/a",
  "Amount": "set",
  "ต้องการให้ไปติดตั้งหรือไม่": "1. yes\n2. no",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 1,
  "Product": "ป้ายตัวอักษร",
  "Material": "อะคริลิค",
  "Surface finishing": "n\/a",
  "Width": "in cm.",
  "Height": "in cm.",
  "Shape": "n\/a",
  "Thickness": "1.ถ้ามี\n2. ความหนายกขอบ",
  "Material color": "1. สีขาว\n2. สีแดง\n3. สีดำ\n4. สีน้ำเงิน\n5. สีเขียว\n6. หรือสีมาตรฐานอื่นๆ",
  "Process": "1. ตัดเลเซอร์ พร้อมยกขอบ\n2. ตัดเลเซอร์ พร้อมเชื่อมขาลอยจากผนัง\n3. ตัดเลเซอร์แผ่นแบน\n\nควรมีรูปประกอบ",
  "Painted": "1. พ่นสีด้วยสีพ่นรถยนต์\n2. ไม่พ่นสี",
  "ประเภทไฟ": "1. ออกหน้า\n2. ไม่มีไฟ\n\nควรมีรูปประกอบ",
  "ป้ายมีกี่หน้า": "n\/a",
  "Amount": "set",
  "ต้องการให้ไปติดตั้งหรือไม่": "1. yes\n2. no",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 2,
  "Product": "ป้ายกล่อง ไฟ หรือ ไม่ไฟ",
  "Material": "เหล็กซิงค์ และ สังกะสี",
  "Surface finishing": "n\/a",
  "Width": "in cm.",
  "Height": "in cm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1.ถ้ามี\n2. ความหนายกขอบ",
  "Material color": "n\/a",
  "Process": "n\/a",
  "Painted": "พ่นสีด้วยสีพ่นรถยนต์",
  "ประเภทไฟ": "1. ออกหน้า\n2. ออกหลัง \n3. ออกหน้าและหลัง\n4. ไม่มีไฟ\n\nควรมีรูปประกอบ",
  "ป้ายมีกี่หน้า": "1. 1 หน้า\n2. 2 หน้า",
  "Amount": "set",
  "ต้องการให้ไปติดตั้งหรือไม่": "1. yes\n2. no",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 2,
  "Product": "ป้ายกล่อง ไฟ หรือ ไม่ไฟ",
  "Material": "สแตนเลส",
  "Surface finishing": "1. ผิว Hairline\n2. ผิว เงา\n\nควรมีรูปประกอบ",
  "Width": "in cm.",
  "Height": "in cm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1.ถ้ามี\n2. ความหนายกขอบ",
  "Material color": "สีเงิน",
  "Process": "n\/a",
  "Painted": "พ่นสีด้วยสีพ่นรถยนต์",
  "ประเภทไฟ": "1. ออกหน้า\n2. ออกหลัง \n3. ออกหน้าและหลัง\n4. ไม่มีไฟ\n\nควรมีรูปประกอบ",
  "ป้ายมีกี่หน้า": "1. 1 หน้า\n2. 2 หน้า",
  "Amount": "set",
  "ต้องการให้ไปติดตั้งหรือไม่": "1. yes\n2. no",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 2,
  "Product": "ป้ายกล่อง ไฟ หรือ ไม่ไฟ",
  "Material": "สแตนเลสหน้าสีต่างๆ",
  "Surface finishing": "1. ผิว Hairline\n2. ผิว เงา\n\nควรมีรูปประกอบ",
  "Width": "in cm.",
  "Height": "in cm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1.ถ้ามี\n2. ความหนายกขอบ",
  "Material color": "1.สีทอง\n2. สี rosegold\n3. สี pink gold\n4. สีดำ\n\nควรมีรูปประกอบ",
  "Process": "n\/a",
  "Painted": "ไม่พ่นสี",
  "ประเภทไฟ": "1. ออกหน้า\n2. ออกหลัง \n3. ออกหน้าและหลัง\n4. ไม่มีไฟ\n\nควรมีรูปประกอบ",
  "ป้ายมีกี่หน้า": "1. 1 หน้า\n2. 2 หน้า",
  "Amount": "set",
  "ต้องการให้ไปติดตั้งหรือไม่": "1. yes\n2. no",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 2,
  "Product": "ป้ายกล่อง ไฟ หรือ ไม่ไฟ",
  "Material": "อลูมิเนียม",
  "Surface finishing": "n\/a",
  "Width": "in cm.",
  "Height": "in cm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1.ถ้ามี\n2. ความหนายกขอบ",
  "Material color": "สีเงิน",
  "Process": "n\/a",
  "Painted": "พ่นสีด้วยสีพ่นรถยนต์",
  "ประเภทไฟ": "1. ออกหน้า\n2. ออกหลัง \n3. ออกหน้าและหลัง\n4. ไม่มีไฟ\n\nควรมีรูปประกอบ",
  "ป้ายมีกี่หน้า": "1. 1 หน้า\n2. 2 หน้า",
  "Amount": "set",
  "ต้องการให้ไปติดตั้งหรือไม่": "1. yes\n2. no",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 2,
  "Product": "ป้ายกล่อง ไฟ หรือ ไม่ไฟ",
  "Material": "พลาสวู๊ด",
  "Surface finishing": "n\/a",
  "Width": "in cm.",
  "Height": "in cm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1.ถ้ามี\n2. ความหนายกขอบ",
  "Material color": "สีขาว",
  "Process": "n\/a",
  "Painted": "พ่นสีด้วยสีพ่นรถยนต์",
  "ประเภทไฟ": "1. ออกหน้า\n2. ออกหลัง \n3. ออกหน้าและหลัง\n4. ไม่มีไฟ\n\nควรมีรูปประกอบ",
  "ป้ายมีกี่หน้า": "1. 1 หน้า\n2. 2 หน้า",
  "Amount": "set",
  "ต้องการให้ไปติดตั้งหรือไม่": "1. yes\n2. no",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 2,
  "Product": "ป้ายกล่อง ไฟ หรือ ไม่ไฟ",
  "Material": "อะคริลิค",
  "Surface finishing": "n\/a",
  "Width": "in cm.",
  "Height": "in cm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1.ถ้ามี\n2. ความหนายกขอบ",
  "Material color": "1. สีขาว\n2. สีแดง\n3. สีดำ\n4. สีน้ำเงิน\n5. สีเขียว\n6. หรือสีมาตรฐานอื่นๆ",
  "Process": "1. ตัดเลเซอร์ พร้อมยกขอบ\n2. ตัดเลเซอร์ พร้อมเชื่อมขาลอยจากผนัง\n3. ตัดเลเซอร์แผ่นแบน\n\nควรมีรูปประกอบ",
  "Painted": "1. พ่นสีด้วยสีพ่นรถยนต์\n2. ไม่พ่นสี",
  "ประเภทไฟ": "1. ออกหน้า\n2. ไม่มีไฟ\n\nควรมีรูปประกอบ",
  "ป้ายมีกี่หน้า": "1. 1 หน้า\n2. 2 หน้า",
  "Amount": "set",
  "ต้องการให้ไปติดตั้งหรือไม่": "1. yes\n2. no",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 3,
  "Product": "Name plate ติดเครื่องจักร",
  "Material": "เหล็ก เช่นเหล็กซิงค์ หรือ สังกะสี หรือ เหล็กดำ\/ขาว",
  "Surface finishing": "n\/a",
  "Width": "in mm.",
  "Height": "in mm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1. 1 mm.\n2. 2 mm.\n3. ลูกค้าระบุ",
  "Material color": "n\/a",
  "Process": "1.พิมพ์สี\n2. แปะสติ๊กเกอร์ inkjet",
  "Painted": "พ่นสีด้วยสีพ่นรถยนต์",
  "ประเภทไฟ": "n\/a",
  "ป้ายมีกี่หน้า": "1. 1 หน้า\n2. 2 หน้า",
  "Amount": "Piece",
  "ต้องการให้ไปติดตั้งหรือไม่": "n\/a",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 3,
  "Product": "Name plate ติดเครื่องจักร",
  "Material": "สแตนเลส",
  "Surface finishing": "1. ผิว Hairline\n2. ผิว เงา\n\nควรมีรูปประกอบ",
  "Width": "in mm.",
  "Height": "in mm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "Hairline\n1. 0.6 mm.\n2. 0.8 mm.\n3. 1.5 mm.\n4. 2 mm.\n5. ลูกค้าระบุ\n\nเงา\n1. 0.6 mm.\n2. 1 mm.\n3. 1.5 mm.\n4. 2 mm.\n5. ลูกค้าระบุ\n",
  "Material color": "สีเงิน",
  "Process": "1. ยิงเลเซอร์สีขาว (ขนาดไม่เกิน 30 x 30 cm.)\n2. ยิงเลเซอร์สีดำ (ขนาดไม่เกิน 30 x 30 cm.)\n3. กัดกรด\n4. พิมพ์สี",
  "Painted": "1. พ่นสีด้วยสีพ่นรถยนต์ (สำหรับงานแปะสติ๊กเกอร์ หรือ งานพิมพ์สีเท่านั้น)\n2. ไม่พ่นสี",
  "ประเภทไฟ": "n\/a",
  "ป้ายมีกี่หน้า": "1. 1 หน้า\n2. 2 หน้า",
  "Amount": "Piece",
  "ต้องการให้ไปติดตั้งหรือไม่": "n\/a",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 3,
  "Product": "Name plate ติดเครื่องจักร",
  "Material": "สแตนเลสหน้าสีต่างๆ",
  "Surface finishing": "1. ผิว Hairline\n2. ผิว เงา\n\nควรมีรูปประกอบ",
  "Width": "in mm.",
  "Height": "in mm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "Hairline\n1. 0.6 mm.\n2. 1 mm.\n\nเงา\n1. 0.6 mm.\n2. 1 mm.",
  "Material color": "1.สีทอง\n2. สี rosegold\n3. สี pink gold\n4. สีดำ\n\nควรมีรูปประกอบ",
  "Process": "1. ยิงเลเซอร์สีขาว (ขนาดไม่เกิน 30 x 30 cm.)\n2. ยิงเลเซอร์สีดำ (ขนาดไม่เกิน 30 x 30 cm.)\n3. กัดกรด\n4. พิมพ์สี",
  "Painted": "ไม่พ่นสี",
  "ประเภทไฟ": "n\/a",
  "ป้ายมีกี่หน้า": "1 หน้า ด้านหลังจะผิวสีเงิน\n\n",
  "Amount": "Piece",
  "ต้องการให้ไปติดตั้งหรือไม่": "n\/a",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 3,
  "Product": "Name plate ติดเครื่องจักร",
  "Material": "ทองเหลือง",
  "Surface finishing": "1. ผิว Hairline\n2. ผิว เงา\n\nควรมีรูปประกอบ",
  "Width": "in mm.",
  "Height": "in mm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "Hairline\n1. 0.8 mm.\n2. 2 mm.\n\nเงา\n1. 0.8 mm.\n2. 2 mm.",
  "Material color": "สีทอง",
  "Process": "1. ยิงเลเซอร์สีขาว (ขนาดไม่เกิน 30 x 30 cm.)\n2. ยิงเลเซอร์สีดำ (ขนาดไม่เกิน 30 x 30 cm.)\n3. กัดกรด\n4. พิมพ์สี",
  "Painted": "ไม่พ่นสี",
  "ประเภทไฟ": "n\/a",
  "ป้ายมีกี่หน้า": "1. 1 หน้า\n2. 2 หน้า",
  "Amount": "Piece",
  "ต้องการให้ไปติดตั้งหรือไม่": "n\/a",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 3,
  "Product": "Name plate ติดเครื่องจักร",
  "Material": "อลูมิเนียม",
  "Surface finishing": "n\/a",
  "Width": "in mm.",
  "Height": "in mm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1. 0.5 mm.\n2. 1 mm.\n3. 1.2\n4. 1.5 mm.\n5. 2 mm.\n6. 3 mm.",
  "Material color": "สีเงิน",
  "Process": "1. ยิงเลเซอร์สีขาว (ขนาดไม่เกิน 30 x 30 cm.)\n2. กัดกรด\n3. พิมพ์สี\n4. แปะสติ๊กเกอร์ inkjet\n5. ชุบสี (สูงสุดไม่เกิน 3 สี)",
  "Painted": "1. พ่นสีด้วยสีพ่นรถยนต์ (สำหรับงานแปะสติ๊กเกอร์ หรือ งานพิมพ์สีเท่านั้น)\n2. ไม่พ่นสี",
  "ประเภทไฟ": "n\/a",
  "ป้ายมีกี่หน้า": "1. 1 หน้า\n2. 2 หน้า",
  "Amount": "Piece",
  "ต้องการให้ไปติดตั้งหรือไม่": "n\/a",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 3,
  "Product": "Name plate ติดเครื่องจักร",
  "Material": "พลาสวู๊ด",
  "Surface finishing": "n\/a",
  "Width": "in mm.",
  "Height": "in mm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1. 3 mm.\n2. 5 mm.\n3. 8 mm.\n4. 10 mm.",
  "Material color": "สีขาว",
  "Process": "1.พิมพ์สี\n2. แปะสติ๊กเกอร์ inkjet",
  "Painted": "1. พ่นสีด้วยสีพ่นรถยนต์\n2. ไม่พ่นสี",
  "ประเภทไฟ": "n\/a",
  "ป้ายมีกี่หน้า": "1. 1 หน้า\n2. 2 หน้า",
  "Amount": "Piece",
  "ต้องการให้ไปติดตั้งหรือไม่": "n\/a",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 3,
  "Product": "Name plate ติดเครื่องจักร",
  "Material": "อะคริลิค",
  "Surface finishing": "n\/a",
  "Width": "in mm.",
  "Height": "in mm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1. 1 mm.\n2. 2 mm.\n3. 3 mm.\n4. 5 mm.",
  "Material color": "1. สีขาว\n2. สีแดง\n3. สีดำ\n4. สีน้ำเงิน\n5. สีเขียว\n6. ใส\n7. หรือสีมาตรฐานอื่นๆ",
  "Process": "1.พิมพ์สีด้านหน้า\n2. พิมพ์สีด้านหลัง (เฉพาะวัสดุใส)\n3. แปะสติ๊กเกอร์ inkjet\n4. ยิงเลเซอร์ฺลงสี\n5. ยิงเลเซอร์ฝ้า",
  "Painted": "1. พ่นสีด้วยสีพ่นรถยนต์ (สำหรับงานแปะสติ๊กเกอร์ หรือ งานพิมพ์สีเท่านั้น)\n2. ไม่พ่นสี",
  "ประเภทไฟ": "n\/a",
  "ป้ายมีกี่หน้า": "1. 1 หน้า (เฉพาะงานแผ่นใสจะทำได้ 1 หน้า)\n2. 2 หน้า",
  "Amount": "Piece",
  "ต้องการให้ไปติดตั้งหรือไม่": "n\/a",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 4,
  "Product": "ป้ายแบบแผ่น",
  "Material": "เหล็ก เช่นเหล็กซิงค์ หรือ สังกะสี หรือ เหล็กดำ\/ขาว",
  "Surface finishing": "n\/a",
  "Width": "in mm.",
  "Height": "in mm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1. 1 mm.\n2. 2 mm.\n3. ลูกค้าระบุ",
  "Material color": "n\/a",
  "Process": "1.พิมพ์สี\n2. แปะสติ๊กเกอร์ inkjet",
  "Painted": "พ่นสีด้วยสีพ่นรถยนต์",
  "ประเภทไฟ": "n\/a",
  "ป้ายมีกี่หน้า": "1. 1 หน้า\n2. 2 หน้า",
  "Amount": "Piece",
  "ต้องการให้ไปติดตั้งหรือไม่": "n\/a",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 4,
  "Product": "ป้ายแบบแผ่น",
  "Material": "สแตนเลส",
  "Surface finishing": "1. ผิว Hairline\n2. ผิว เงา\n\nควรมีรูปประกอบ",
  "Width": "in mm.",
  "Height": "in mm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "Hairline\n1. 0.6 mm.\n2. 2 mm.\n3. ลูกค้าระบุ\n\nเงา",
  "Material color": "สีเงิน",
  "Process": "1. ยิงเลเซอร์สีขาว (ขนาดไม่เกิน 30 x 30 cm.)\n2. ยิงเลเซอร์สีดำ (ขนาดไม่เกิน 30 x 30 cm.)\n3. กัดกรด\n4. พิมพ์สี",
  "Painted": "1. พ่นสีด้วยสีพ่นรถยนต์ (สำหรับงานแปะสติ๊กเกอร์ หรือ งานพิมพ์สีเท่านั้น)\n2. ไม่พ่นสี",
  "ประเภทไฟ": "n\/a",
  "ป้ายมีกี่หน้า": "1. 1 หน้า\n2. 2 หน้า",
  "Amount": "Piece",
  "ต้องการให้ไปติดตั้งหรือไม่": "n\/a",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 4,
  "Product": "ป้ายแบบแผ่น",
  "Material": "สแตนเลสหน้าสีต่างๆ",
  "Surface finishing": "1. ผิว Hairline\n2. ผิว เงา\n\nควรมีรูปประกอบ",
  "Width": "in mm.",
  "Height": "in mm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "Hairline\n1. 0.6 mm.\n2. 1 mm.\n\nเงา\n1. 0.6 mm.\n2. 1 mm.",
  "Material color": "1.สีทอง\n2. สี rosegold\n3. สี pink gold\n4. สีดำ\n\nควรมีรูปประกอบ",
  "Process": "1. ยิงเลเซอร์สีขาว (ขนาดไม่เกิน 30 x 30 cm.)\n2. ยิงเลเซอร์สีดำ (ขนาดไม่เกิน 30 x 30 cm.)\n3. กัดกรด\n4. พิมพ์สี",
  "Painted": "ไม่พ่นสี",
  "ประเภทไฟ": "n\/a",
  "ป้ายมีกี่หน้า": "1 หน้า ด้านหลังจะผิวสีเงิน\n\n",
  "Amount": "Piece",
  "ต้องการให้ไปติดตั้งหรือไม่": "n\/a",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 4,
  "Product": "ป้ายแบบแผ่น",
  "Material": "ทองเหลือง",
  "Surface finishing": "1. ผิว Hairline\n2. ผิว เงา\n\nควรมีรูปประกอบ",
  "Width": "in mm.",
  "Height": "in mm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "Hairline\n1. 0.8 mm.\n2. 2 mm.\n\nเงา\n1. 0.8 mm.\n2. 2 mm.",
  "Material color": "สีทอง",
  "Process": "1. ยิงเลเซอร์สีขาว (ขนาดไม่เกิน 30 x 30 cm.)\n2. ยิงเลเซอร์สีดำ (ขนาดไม่เกิน 30 x 30 cm.)\n3. กัดกรด\n4. พิมพ์สี",
  "Painted": "ไม่พ่นสี",
  "ประเภทไฟ": "n\/a",
  "ป้ายมีกี่หน้า": "1. 1 หน้า\n2. 2 หน้า",
  "Amount": "Piece",
  "ต้องการให้ไปติดตั้งหรือไม่": "n\/a",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 4,
  "Product": "ป้ายแบบแผ่น",
  "Material": "อลูมิเนียม",
  "Surface finishing": "n\/a",
  "Width": "in mm.",
  "Height": "in mm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1. 0.5 mm.\n2. 1 mm.\n3. 1.2\n4. 1.5 mm.\n5. 2 mm.\n6. 3 mm.",
  "Material color": "สีเงิน",
  "Process": "1. ยิงเลเซอร์สีขาว (ขนาดไม่เกิน 30 x 30 cm.)\n2. กัดกรด\n3. พิมพ์สี\n4. แปะสติ๊กเกอร์ inkjet\n5. ชุบสี (สูงสุดไม่เกิน 3 สี)",
  "Painted": "1. พ่นสีด้วยสีพ่นรถยนต์ (สำหรับงานแปะสติ๊กเกอร์ หรือ งานพิมพ์สีเท่านั้น)\n2. ไม่พ่นสี",
  "ประเภทไฟ": "n\/a",
  "ป้ายมีกี่หน้า": "1. 1 หน้า\n2. 2 หน้า",
  "Amount": "Piece",
  "ต้องการให้ไปติดตั้งหรือไม่": "n\/a",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 4,
  "Product": "ป้ายแบบแผ่น",
  "Material": "พลาสวู๊ด",
  "Surface finishing": "n\/a",
  "Width": "in mm.",
  "Height": "in mm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1. 3 mm.\n2. 5 mm.\n3. 8 mm.\n4. 10 mm.",
  "Material color": "สีขาว",
  "Process": "1.พิมพ์สี\n2. แปะสติ๊กเกอร์ inkjet",
  "Painted": "1. พ่นสีด้วยสีพ่นรถยนต์\n2. ไม่พ่นสี",
  "ประเภทไฟ": "n\/a",
  "ป้ายมีกี่หน้า": "1. 1 หน้า\n2. 2 หน้า",
  "Amount": "Piece",
  "ต้องการให้ไปติดตั้งหรือไม่": "n\/a",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 4,
  "Product": "ป้ายแบบแผ่น",
  "Material": "อะคริลิค",
  "Surface finishing": "n\/a",
  "Width": "in mm.",
  "Height": "in mm.",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1. 1 mm.\n2. 2 mm.\n3. 3 mm.\n4. 5 mm.",
  "Material color": "1. สีขาว\n2. สีแดง\n3. สีดำ\n4. สีน้ำเงิน\n5. สีเขียว\n6. ใส\n7. หรือสีมาตรฐานอื่นๆ",
  "Process": "1.พิมพ์สีด้านหน้า\n2. พิมพ์สีด้านหลัง (เฉพาะวัสดุใส)\n3. แปะสติ๊กเกอร์ inkjet\n4. ยิงเลเซอร์ฺลงสี\n5. ยิงเลเซอร์ฝ้า",
  "Painted": "1. พ่นสีด้วยสีพ่นรถยนต์ (สำหรับงานแปะสติ๊กเกอร์ หรือ งานพิมพ์สีเท่านั้น)\n2. ไม่พ่นสี",
  "ประเภทไฟ": "n\/a",
  "ป้ายมีกี่หน้า": "1. 1 หน้า (เฉพาะงานแผ่นใสจะทำได้ 1 หน้า)\n2. 2 หน้า",
  "Amount": "Piece",
  "ต้องการให้ไปติดตั้งหรือไม่": "n\/a",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 5,
  "Service": "ยิงเลเซอร์โลหะ",
  "Material": "1. สเตนเลส\n2. สเตนเลสหน้าทอง\n3. เหล็ก เช่นเหล็กซิงค์ หรือ สังกะสี หรือ เหล็กดำ\/ขาว\n4. ทองเหลือง\n5. อลูมิเนียม\n6. ทองแดง\n7. โลหะชนิดอื่น",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "in mm.",
  "Logo Height": "in mm.",
  "Shape": "n\/a",
  "Thickness": "n\/a",
  "Material color": "n\/a",
  "ทำกี่หน้า": "1. 1 หน้า\n2. 2 หน้า\n3. หรือตามกำหนด",
  "Amount ที่ต้องการ": "Piece",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 6,
  "Service": "ยิงเลเซอร์อโลหะ",
  "Material": "1. ไม้อัด MDF \n2. ไม้อัดยาง\n3. ไม้ธรรมชาติ (ลูกค้าต้องเตรียมมา)\n4. อะคริลิค",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "in mm.",
  "Logo Height": "in mm.",
  "Shape": "n\/a",
  "Thickness": "n\/a",
  "Material color": "n\/a",
  "ทำกี่หน้า": "1. 1 หน้า\n2. 2 หน้า\n3. หรือตามกำหนด",
  "Amount ที่ต้องการ": "Piece",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 7,
  "Service": "พิมพ์ UV",
  "Material": "1. สเตนเลส\n2. สเตนเลสหน้าทอง\n3. เหล็ก เช่นเหล็กซิงค์ หรือ สังกะสี หรือ เหล็กดำ\/ขาว \n4. ทองเหลือง\n5. อลูมิเนียม\n6. ทองแดง\n7. โลหะชนิดอื่น\n8. Plaswood\n9. ไม้อัด MDF \n10. ไม้อัดยาง\n11. ไม้ธรรมชาติ (ลูกค้าต้องเตรียมมา)\n12. อะคริลิค\n",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "in mm.",
  "Logo Height": "in mm.",
  "Shape": "n\/a",
  "Thickness": "n\/a",
  "Material color": "n\/a",
  "ทำกี่หน้า": "1. 1 หน้า\n2. 2 หน้า\n3. หรือตามกำหนด",
  "Amount ที่ต้องการ": "Piece",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 8,
  "Service": "ตัดเลเซอร์โลหะ",
  "Material": "เหล็ก เช่นเหล็กซิงค์ หรือ สังกะสี หรือ เหล็กดำ\/ขาว",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1. 0.5 mm.\n2. 1 mm.\n3. 1.5 mm.\n4. 2 mm.\n5. 3 mm.\n6. ลูกค้าระบุ",
  "Material color": "n\/a",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 9,
  "Service": "ตัดเลเซอร์โลหะ",
  "Material": "สแตนเลส",
  "Surface finishing": "1. ผิว Hairline\n2. ผิว เงา\n\nควรมีรูปประกอบ",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "Hairline\n1. 0.6 mm.\n2. 0.8 mm.\n3. 1.5 mm.\n4. 2 mm.\n5. ลูกค้าระบุ\n\nเงา\n1. 0.6 mm.\n2. 1 mm.\n3. 1.5 mm.\n4. 2 mm.\n5. ลูกค้าระบุ\n\nผิวดิบ\n1. 0.6 mm.\n2. 0.8 mm.\n3. 1.5 mm.\n4. 2 mm.\n5. 3 mm.\n6. ลูกค้าระบุ",
  "Material color": "เงิน",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 10,
  "Service": "ตัดเลเซอร์โลหะ",
  "Material": "สแตนเลสหน้าสีต่างๆ",
  "Surface finishing": "1. ผิว Hairline\n2. ผิว เงา\n\nควรมีรูปประกอบ",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "Hairline\n1. 0.6 mm.\n2. 1 mm.\n\nเงา\n1. 0.6 mm.\n2. 1 mm.",
  "Material color": "1.สีทอง\n2. สี rosegold\n3. สี pink gold\n4. สีดำ\n\nควรมีรูปประกอบ",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 11,
  "Service": "ตัดเลเซอร์อโลหะ",
  "Material": "ไม้อัด MDF ",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "3 , 4 , 6 , 9 , 12 , 15 , 19 และ 25 mm.",
  "Material color": "n\/a",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 12,
  "Service": "ตัดเลเซอร์อโลหะ",
  "Material": "ไม้อัดยาง",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": " 3 mm., 4 mm., 6 mm., 10 mm., 15 mm., 20 mm",
  "Material color": "n\/a",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 13,
  "Service": "ตัดเลเซอร์อโลหะ",
  "Material": "ไม้ธรรมชาติ (ลูกค้าต้องเตรียมมา)",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "n\/a",
  "Material color": "n\/a",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 14,
  "Service": "ตัดเลเซอร์อโลหะ",
  "Material": "อะคริลิค",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "2, 3, 5, 8, 10, 15, 20, 25 mm.",
  "Material color": "1. สีขาว\n2. สีแดง\n3. สีดำ\n4. สีน้ำเงิน\n5. สีเขียว\n6. ใส\n7. หรือสีมาตรฐานอื่นๆ",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 15,
  "Service": "ตัด CNC",
  "Material": "Plaswood",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1. 3 mm.\n2. 5 mm.\n3. 8 mm.\n4. 10 mm.\n5. 15 mm.\n6. 20 mm.\n7. 25 mm.",
  "Material color": "สีขาว",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 16,
  "Service": "ตัด CNC",
  "Material": "อะคริลิค",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1. 3 mm.\n2. 5 mm.\n3. 8 mm.\n4. 10 mm.\n5. 15 mm.\n6. 20 mm.\n7. 25 mm.\n8. 2 mm.",
  "Material color": "1. สีขาว\n2. สีแดง\n3. สีดำ\n4. สีน้ำเงิน\n5. สีเขียว\n6. ใส\n7. หรือสีมาตรฐานอื่นๆ",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 17,
  "Service": "ตัด CNC",
  "Material": "พลาสติกชนิดอื่นๆ เช่น PP PVC ABS PET PC PE",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "ลูกค้าระบุ",
  "Material color": "แล้วแต่วัสดุ",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 }
],
"Service flow (ข้อมูลที่ต้องใช้ส":[
 {
  "No.": 1,
  "Service": "ยิงเลเซอร์โลหะ",
  "Material": "1. สเตนเลส\n2. สเตนเลสหน้าทอง\n3. เหล็ก เช่นเหล็กซิงค์ หรือ สังกะสี หรือ เหล็กดำ\/ขาว\n4. ทองเหลือง\n5. อลูมิเนียม\n6. ทองแดง\n7. โลหะชนิดอื่น",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "in mm.",
  "Logo Height": "in mm.",
  "Shape": "n\/a",
  "Thickness": "n\/a",
  "Material color": "n\/a",
  "ทำกี่หน้า": "1. 1 หน้า\n2. 2 หน้า\n3. หรือตามกำหนด",
  "Amount ที่ต้องการ": "Piece",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 2,
  "Service": "ยิงเลเซอร์อโลหะ",
  "Material": "1. ไม้อัด MDF \n2. ไม้อัดยาง\n3. ไม้ธรรมชาติ (ลูกค้าต้องเตรียมมา)\n4. อะคริลิค",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "in mm.",
  "Logo Height": "in mm.",
  "Shape": "n\/a",
  "Thickness": "n\/a",
  "Material color": "n\/a",
  "ทำกี่หน้า": "1. 1 หน้า\n2. 2 หน้า\n3. หรือตามกำหนด",
  "Amount ที่ต้องการ": "Piece",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 3,
  "Service": "พิมพ์ UV",
  "Material": "1. สเตนเลส\n2. สเตนเลสหน้าทอง\n3. เหล็ก เช่นเหล็กซิงค์ หรือ สังกะสี หรือ เหล็กดำ\/ขาว \n4. ทองเหลือง\n5. อลูมิเนียม\n6. ทองแดง\n7. โลหะชนิดอื่น\n8. Plaswood\n9. ไม้อัด MDF \n10. ไม้อัดยาง\n11. ไม้ธรรมชาติ (ลูกค้าต้องเตรียมมา)\n12. อะคริลิค\n",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "in mm.",
  "Logo Height": "in mm.",
  "Shape": "n\/a",
  "Thickness": "n\/a",
  "Material color": "n\/a",
  "ทำกี่หน้า": "1. 1 หน้า\n2. 2 หน้า\n3. หรือตามกำหนด",
  "Amount ที่ต้องการ": "Piece",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 4,
  "Service": "ตัดเลเซอร์โลหะ",
  "Material": "เหล็ก เช่นเหล็กซิงค์ หรือ สังกะสี หรือ เหล็กดำ\/ขาว",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1. 0.5 mm.\n2. 1 mm.\n3. 1.5 mm.\n4. 2 mm.\n5. 3 mm.\n6. ลูกค้าระบุ",
  "Material color": "n\/a",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 5,
  "Service": "ตัดเลเซอร์โลหะ",
  "Material": "สแตนเลส",
  "Surface finishing": "1. ผิว Hairline\n2. ผิว เงา\n\nควรมีรูปประกอบ",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "Hairline\n1. 0.6 mm.\n2. 0.8 mm.\n3. 1.5 mm.\n4. 2 mm.\n5. ลูกค้าระบุ\n\nเงา\n1. 0.6 mm.\n2. 1 mm.\n3. 1.5 mm.\n4. 2 mm.\n5. ลูกค้าระบุ\n\nผิวดิบ\n1. 0.6 mm.\n2. 0.8 mm.\n3. 1.5 mm.\n4. 2 mm.\n5. 3 mm.\n6. ลูกค้าระบุ",
  "Material color": "เงิน",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 6,
  "Service": "ตัดเลเซอร์โลหะ",
  "Material": "สแตนเลสหน้าสีต่างๆ",
  "Surface finishing": "1. ผิว Hairline\n2. ผิว เงา\n\nควรมีรูปประกอบ",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "Hairline\n1. 0.6 mm.\n2. 1 mm.\n\nเงา\n1. 0.6 mm.\n2. 1 mm.",
  "Material color": "1.สีทอง\n2. สี rosegold\n3. สี pink gold\n4. สีดำ\n\nควรมีรูปประกอบ",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 7,
  "Service": "ตัดเลเซอร์โลหะ",
  "Material": "ทองเหลือง",
  "Surface finishing": "1. ผิว Hairline\n2. ผิว เงา\n\nควรมีรูปประกอบ",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "Hairline\n1. 0.8 mm.\n2. 1 mm.\n3. 2 mm.\n4. ลูกค้าระบุ\n\nเงา\n1. 0.8 mm.\n2. 1 mm.\n3. 2 mm.\n4.ลูกค้าระบุ",
  "Material color": "สีทอง",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 8,
  "Service": "ตัดเลเซอร์โลหะ",
  "Material": "อลูมิเนียม",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1. 0.5 mm.\n2. 1 mm.\n3. 1.2\n4. 1.5 mm.\n5. 2 mm.\n6. 3 mm.\n7. ลูกค้าระบุ",
  "Material color": "สีเงิน",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 9,
  "Service": "ตัดเลเซอร์โลหะ",
  "Material": "ทองแดง",
  "Surface finishing": "1. ผิว Hairline\n2. ผิว เงา\n\nควรมีรูปประกอบ",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1 mm.",
  "Material color": "สีทองแดง",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 10,
  "Service": "ตัดเลเซอร์อโลหะ",
  "Material": "ไม้อัด MDF ",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "3 , 4 , 6 , 9 , 12 , 15 , 19 และ 25 mm.",
  "Material color": "n\/a",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 11,
  "Service": "ตัดเลเซอร์อโลหะ",
  "Material": "ไม้อัดยาง",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": " 3 mm., 4 mm., 6 mm., 10 mm., 15 mm., 20 mm",
  "Material color": "n\/a",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 12,
  "Service": "ตัดเลเซอร์อโลหะ",
  "Material": "ไม้ธรรมชาติ (ลูกค้าต้องเตรียมมา)",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "n\/a",
  "Material color": "n\/a",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 13,
  "Service": "ตัดเลเซอร์อโลหะ",
  "Material": "อะคริลิค",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "2, 3, 5, 8, 10, 15, 20, 25 mm.",
  "Material color": "1. สีขาว\n2. สีแดง\n3. สีดำ\n4. สีน้ำเงิน\n5. สีเขียว\n6. ใส\n7. หรือสีมาตรฐานอื่นๆ",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 14,
  "Service": "ตัด CNC",
  "Material": "อะคริลิค",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "1. 1 mm.\n2. 2 mm.\n3. 3 mm.\n4. 5 mm.",
  "Material color": "1. สีขาว\n2. สีแดง\n3. สีดำ\n4. สีน้ำเงิน\n5. สีเขียว\n6. ใส\n7. หรือสีมาตรฐานอื่นๆ",
  "Process": "1.พิมพ์สีด้านหน้า\n2. พิมพ์สีด้านหลัง (เฉพาะวัสดุใส)\n3. แปะสติ๊กเกอร์ inkjet\n4. ยิงเลเซอร์ฺลงสี\n5. ยิงเลเซอร์ฝ้า",
  "Painted": "1. พ่นสีด้วยสีพ่นรถยนต์ (สำหรับงานแปะสติ๊กเกอร์ หรือ งานพิมพ์สีเท่านั้น)\n2. ไม่พ่นสี",
  "ประเภทไฟ": "n\/a",
  "ป้ายมีกี่หน้า": "1. 1 หน้า (เฉพาะงานแผ่นใสจะทำได้ 1 หน้า)\n2. 2 หน้า",
  "Amount": "Piece",
  "ต้องการให้ไปติดตั้งหรือไม่": "n\/a",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 },
 {
  "No.": 6,
  "Service": "ตัด CNC",
  "Material": "พลาสติกชนิดอื่นๆ เช่น PP PVC ABS PET PC PE",
  "Surface finishing": "n\/a",
  "Object width": "in mm.",
  "Object Height": "in mm.",
  "Logo Width": "n\/a",
  "Logo Height": "n\/a",
  "Shape": "1. สี่เหลี่ยม\n2. วงกลม\n3. วงรี\n4. ตามแบบ",
  "Thickness": "ลูกค้าระบุ",
  "Material color": "แล้วแต่วัสดุ",
  "ทำกี่หน้า": "n\/a",
  "Amount ที่ต้องการ": "piece\/set",
  "Artwork จากทางเราหรือของลูกค้า": "1.customer \n2. gravure tech",
  "รูปแบบที่ต้องการ": "1. มี\n2. ไม่มี (ถ้าไม่มีอย่างน้อยต้องมีตัวอักษรระบุ ชื่อที่ต้องการทำ)"
 }
]
}`;

const lineConfig = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET
};
const lineClient = new line.Client(lineConfig);
const app = express();
app.use(bodyParser.json());

let mongoClient = null;
async function connectDB() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
  }
  return mongoClient;
}

/**
 * แก้ไขให้ content เป็น string เสมอ
 */
function normalizeRoleContent(role, content) {
  if (typeof content === 'string') {
    return { role, content };
  } else {
    // ถ้าไม่ใช่ string => stringify
    return { role, content: JSON.stringify(content) };
  }
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
    } catch {
      return normalizeRoleContent(ch.role, ch.content);
    }
  });
}

async function saveChatHistory(userId, userMsg, assistantMsg) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("chat_history");
  let userMsgToSave = typeof userMsg === "string" ? userMsg : JSON.stringify(userMsg);
  await coll.insertOne({ senderId: userId, role: "user", content: userMsgToSave, timestamp: new Date() });
  await coll.insertOne({ senderId: userId, role: "assistant", content: assistantMsg, timestamp: new Date() });
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
 * ฟังก์ชันสำหรับลบประวัติการสนทนาทั้งหมดของ user
 */
async function clearUserChatHistory(userId) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("chat_history");
  await coll.deleteMany({ senderId: userId });
}

// ตัวแปรเก็บ instructions จาก Google Doc
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
  } catch {
    googleDocInstructions = "Error fetching system instructions.";
  }
}

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
 * ข้ามแถวที่ทุก cell ว่าง
 */
function parseSheetRowsToObjects(rows) {
  if (!rows || rows.length < 2) {
    return [];
  }
  const headers = rows[0];
  const dataRows = rows.slice(1);
  return dataRows.reduce((acc, row) => {
    const hasContent = row.some(cell => cell && cell.trim() !== "");
    if (!hasContent) {
      return acc;
    }
    let obj = {};
    headers.forEach((headerName, colIndex) => {
      obj[headerName] = row[colIndex] || "";
    });
    acc.push(obj);
    return acc;
  }, []);
}

function transformSheetRowsToJSON(rows) {
  return parseSheetRowsToObjects(rows);
}

// ตรงนี้จะเก็บข้อมูล 4 แท็บหลังดึงจาก Google Sheets
let sheetJSON = { qnaSteps: [], companyDetails: [], products: [], services: [] };

// รวม 4 แท็บ ถ้าจะเรียกหลายครั้ง
async function fetchAllSheetsData(spreadsheetId) {
  const [
    rowsQnASteps,      // "ลักษณะ/ขั้นตอน การถามตอบ"
    rowsMainFlow,       // "Main flow"
    rowsProductFlow,    // "Product flow"
    rowsServiceFlow,    // "Service flow"
    rowsCompany,        // "Company details"
    rowsProducts,       // "Products"
    rowsServices        // "Services"
  ] = await Promise.all([
    fetchSheetData(spreadsheetId, "ลักษณะ/ขั้นตอน การถามตอบ!A1:D100"),
    fetchSheetData(spreadsheetId, "Main flow!A1:D100"),
    fetchSheetData(spreadsheetId, "Product flow!A1:D100"),
    fetchSheetData(spreadsheetId, "Service flow!A1:D100"),
    fetchSheetData(spreadsheetId, "Company details!A1:D30"),
    fetchSheetData(spreadsheetId, "Products!A1:Q40"),
    fetchSheetData(spreadsheetId, "Services!A1:O40")
  ]);

  return {
    // รวมข้อมูลจาก "ลักษณะ/ขั้นตอน การถามตอบ" + main/product/service flow
    qnaSteps: transformSheetRowsToJSON(rowsQnASteps)
                .concat(
                  transformSheetRowsToJSON(rowsMainFlow),
                  transformSheetRowsToJSON(rowsProductFlow),
                  transformSheetRowsToJSON(rowsServiceFlow)
                ),
    companyDetails: transformSheetRowsToJSON(rowsCompany),
    products: transformSheetRowsToJSON(rowsProducts),
    services: transformSheetRowsToJSON(rowsServices)
  };
}

// === (1) ฟังก์ชันโมเดลเล็ก: เลือก tab + row
async function classifyConversationUsingAnotherModel(history) {
  // เอา user + assistant => เผื่อ assistant อธิบายภาพ
  const messagesForSmallModel = history
    .filter(h => (h.role === "user" || h.role === "assistant"))
    .map(h => `${h.role.toUpperCase()}: ${h.content}`);

  const conversationText = messagesForSmallModel.join("\n");

  const promptText = `
คุณคือโมเดลสำหรับวิเคราะห์บทสนทนาทั้งหมด (รวมทั้งข้อความจาก User และ Assistant) เพื่อตัดสินใจว่า:
1) บทสนทนาเกี่ยวข้องกับ "Services" (แถว 1–8) หมายเลขใด
2) หรือเกี่ยวข้องกับ "Products" (แถว 1–13) หมายเลขใด
3) หรือไม่เกี่ยวข้องกับทั้งสองเลย (None, row=0)

ด้านล่างคือรายการ "Services" ทั้ง 8 แถว (พร้อมรายละเอียดเต็ม) และ "Products" ทั้ง 13 แถว (พร้อมรายละเอียดเต็ม):
========================================
[Services]
1 => ตัดเลเซอร์โลหะ  
   รายละเอียด: บริการตัดโลหะด้วยเลเซอร์ไฟเบอร์ที่แม่นยำ ใช้ได้กับเหล็ก สแตนเลส อลูมิเนียม ทองเหลือง ฯลฯ รองรับขนาดสูงสุด 1.50 ม. x 3 ม. เหมาะสำหรับงานอุตสาหกรรม ชิ้นส่วนเครื่องจักร ป้าย

2 => ตัดเลเซอร์อโลหะ  
   รายละเอียด: บริการตัดอะคริลิกหรือวัสดุอโลหะด้วยเลเซอร์ CO2 ขอบเรียบ แม่นยำ

3 => ยิงเลเซอร์โลหะ  
   รายละเอียด: สร้างลวดลายหรือมาร์กโลโก้บนโลหะ (สแตนเลส อะลูมิเนียม ฯลฯ) เพื่อสร้างความแตกต่างหรือสีที่ไม่เหมือนผิวเดิม

4 => ยิงเลเซอร์อโลหะ  
   รายละเอียด: ยิงสลักลวดลายบนอะคริลิก ไม้ หนัง ฯลฯ ด้วยเลเซอร์

5 => พิมพ์สีลงบนวัสดุ (Digital UV Printing)  
   รายละเอียด: พิมพ์สีดิจิทัลลงบนโลหะ ไม้ พลาสติก หรือวัสดุเรียบหลากชนิด โดยไม่ต้องใช้บล็อก พิมพ์หลายสีได้ทันที

6 => แกะสลักด้วย CNC  
   รายละเอียด: ใช้เครื่อง CNC ในการแกะหรือตัดวัสดุต่าง ๆ (โลหะอ่อน ไม้ พลาสติก) ได้ทั้ง 2D และ 3D

7 => ตัดด้วย CNC  
   รายละเอียด: ตัด/กัดวัสดุด้วยดอกกัดที่ควบคุมด้วยคอมพิวเตอร์ แม่นยำ มีรูปทรงซับซ้อน

8 => ตัด พับ เชื่อมโลหะ  
   รายละเอียด: บริการตัด พับ และเชื่อมโลหะแผ่นหรือท่อ (เหล็ก สแตนเลส ฯลฯ) เพื่อขึ้นรูปตามแบบ เช่น โครงสร้าง ป้าย

========================================
[Products]
1 => ป้ายกัดกรด  
   รายละเอียด: ป้ายโลหะที่กัดลวดลายหรือข้อความลงบนผิว เพื่อให้คมชัด ดูเป็นมืออาชีพ

2 => สติ๊กเกอร์พิมพ์ Inkjet หรือ Diecut  
   รายละเอียด: สติ๊กเกอร์พิมพ์อิงค์เจ็ทหรือสติ๊กเกอร์ไดคัทสำหรับงานป้าย ตกแต่ง

3 => ป้ายแปะด้านหน้าด้วย Sticker  
   รายละเอียด: ติดสติ๊กเกอร์ (พิมพ์หรือไดคัท) ลงบนแผ่นวัสดุด้านหน้า

4 => ป้ายตัวอักษรโลหะ  
   รายละเอียด: ตัวอักษรขึ้นรูปจากโลหะ (สแตนเลส อะลูมิเนียม ฯลฯ) แข็งแรง ทนทาน

5 => ป้ายตัวอักษรอโลหะ  
   รายละเอียด: ตัวอักษรทำจากอะคริลิก พลาสวูด หรือ MDF ตัดเป็นชื่อ โลโก้

6 => ป้ายตัวอักษรโลหะแบบมีไฟ  
   รายละเอียด: ตัวอักษรโลหะติด LED ภายใน ส่องไฟออกด้านหน้า/หลัง

7 => ป้ายตัวอักษรอโลหะแบบมีไฟ  
   รายละเอียด: ตัวอักษรอโลหะติด LED ส่องสว่าง สร้างความโดดเด่น

8 => ป้ายกล่องไฟ  
   รายละเอียด: กล่องป้ายภายในติดหลอดไฟ/LED หน้าด้วยอะคริลิกหรือไวนิลโปร่งแสง

9 => ป้ายจราจร  
   รายละเอียด: ป้ายโลหะติดสติ๊กเกอร์สะท้อนแสง ใช้ควบคุมการจราจร

10 => Nameplate ยิงเลเซอร์  
   รายละเอียด: แผ่นป้ายโลหะ/อะคริลิก ยิงเลเซอร์เป็นข้อความ/ลวดลาย

11 => ป้ายพิมพ์สี  
   รายละเอียด: พิมพ์สีลงบนแผ่นโลหะหรือพลาสติก เหมาะกับงานหลายสี

12 => ฉลากทำสติ๊กเกอร์  
   รายละเอียด: สติ๊กเกอร์พิมพ์ข้อมูล โลโก้ หรือข้อความ สำหรับติดผลิตภัณฑ์

13 => ป้ายแปะด้านหลังด้วย Sticker  
   รายละเอียด: แผ่นอะคริลิกใสติดสติ๊กเกอร์พิมพ์สีด้านหลัง เพื่อป้องกันสีหลุด
========================================
คำแนะนำสำคัญ:
- **ให้ยึดข้อความล่าสุดจากผู้ใช้เป็นหลักในการตัดสินใจ**
- ถ้าข้อความล่าสุดชัดเจนว่าพูดถึงสินค้า/บริการใหม่ ให้เปลี่ยนไปใช้สินค้า/บริการใหม่นั้นทันที
- อย่ายึดติดกับสินค้า/บริการที่เคยพูดถึงก่อนหน้านี้ หากข้อความล่าสุดเปลี่ยนไปพูดถึงสินค้า/บริการอื่นแล้ว
- ถ้ามีรูปตัวอย่างชิ้นงาน ให้เทียบดูว่าใกล้ service หรือ product ข้างบนไหม
- ถ้าไม่เจอหรือไม่เกี่ยว ให้ "tab":"None","row":0

นี่คือข้อความ (user+assistant):
--------------------
${conversationText}
--------------------

ตอบเป็น JSON, ตัวอย่าง:
{
  "tab":"Services",
  "row":3
}
หรือ:
{
  "tab":"Products",
  "row":10
}
หรือ:
{
  "tab":"None",
  "row":0
}
`.trim();

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: promptText }],
      temperature: 0.1
    });

    let raw = (response.choices[0].message.content || "").trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("[DEBUG] JSON parse error from small model:", err);
      parsed = { tab: "None", row: 0 };
    }

    if (!["Services","Products","None"].includes(parsed.tab)) {
      parsed.tab = "None";
    }
    if (typeof parsed.row !== "number") {
      parsed.row = 0;
    }
    
    console.log(`[DEBUG] classify => tab=${parsed.tab}, row=${parsed.row}`);
    return parsed;
  } catch (err) {
    console.error("Classification error:", err);
    return { tab: "None", row: 0 };
  }
}

// === ฟังก์ชันโมเดลเล็ก: วิเคราะห์ Flow และข้อมูลที่ขาด (ฟังก์ชันใหม่ไม่มีการประกาศ openai ซ้ำซ้อน)
async function analyzeFlowGPT4oMini(history, classification = null, userId = null) {
  // เอา user + assistant สำหรับการวิเคราะห์
  const messagesForSmallModel = history
    .filter(h => (h.role === "user" || h.role === "assistant"))
    .map(h => `${h.role.toUpperCase()}: ${h.content}`);

  const conversationText = messagesForSmallModel.join("\n");
  
  // ดึงประวัติ Flow ของผู้ใช้ (ถ้ามี userId)
  let userFlowHistory = null;
  if (userId) {
    userFlowHistory = await getUserFlowHistory(userId);
  }
  
  // สร้าง JSON ของประวัติ Flow สำหรับใส่ใน prompt
  let flowHistoryText = "";
  if (userFlowHistory && userFlowHistory.existing_info) {
    flowHistoryText = `
ประวัติ Flow ของผู้ใช้:
Flow ปัจจุบัน: ${userFlowHistory.flow || "ยังไม่ได้กำหนด"}
ประเภทสินค้า/บริการ: ${userFlowHistory.product_service_type || "ยังไม่ได้กำหนด"}
ข้อมูลที่มีแล้ว:
${Object.entries(userFlowHistory.existing_info).map(([key, value]) => `- ${key}: ${value}`).join('\n')}
`;
  }
  
  // เพิ่มข้อมูลว่าปัจจุบันกำลังพูดถึงสินค้า/บริการอะไร (ถ้ามี)
  let currentProductServiceInfo = "";
  if (classification && classification.tab && classification.tab !== "None" && classification.row > 0) {
    currentProductServiceInfo = `
ปัจจุบันผู้ใช้กำลังพูดถึง: ${classification.tab} ลำดับที่ ${classification.row}
`;
  }

  const promptText = `
คุณคือโมเดลสำหรับวิเคราะห์บทสนทนาทั้งหมด (รวมทั้งข้อความจาก User และ Assistant) เพื่อระบุว่าปัจจุบันอยู่ใน Flow การสนทนาอะไร และขาดข้อมูลอะไรบ้าง

ด้านล่างคือรายการ "Main flow ขั้นตอนในการถามตอบ", "Product flow", และ "Service flow":

========================================

${FLOW_TEXT}

ตัวอย่างข้อมูลสำคัญที่ต้องการจากลูกค้า:
- วัสดุที่ใช้
- ขนาด (กว้าง x สูง)
- รูปทรง
- ความหนา
- สีวัสดุ
- กระบวนการผลิต
- การตกแต่งผิว
- ประเภทไฟ (ถ้ามี)
- จำนวนด้าน/หน้า
- จำนวนที่ต้องการ
- ต้องการติดตั้งหรือไม่
- Artwork จากทางเราหรือลูกค้า
- มีรูปแบบที่ต้องการหรือไม่
- ชื่อและที่อยู่สำหรับออกใบเสนอราคา

${flowHistoryText}
currentProductServiceInfo:
${currentProductServiceInfo}

นี่คือข้อความสนทนา:
--------------------
${conversationText}
--------------------

โปรดวิเคราะห์บทสนทนาและตอบเป็น JSON:
{
  "flow": "ระบุ Flow ปัจจุบัน (A01, A02, AC01, G01, P001, AC02, A03, Product No.2, Service No.1)",
  "product_service_type": "ระบุประเภทสินค้าหรือบริการ (ถ้ามี และอ้างอิงชื่อจาก currentProductServiceInfo)",
  "existing_info": ["ข้อมูลที่มีแล้ว 1 (เช่น วัสดุ: สแตนเลส)", "ข้อมูลที่มีแล้ว 2", "..."],
  "missing_info": ["ข้อมูลที่ยังขาด 1", "ข้อมูลที่ยังขาด 2", "..."],
  "available_options": {
    "วัสดุ": ["สแตนเลส", "อะคริลิค", "เหล็กซิงค์"], (ถ้าไม่แน่ใจ product_service_type ให้ว่างไว้)
    "รูปทรง": ["สี่เหลี่ยม", "วงกลม", "ตามแบบ"] (ถ้าไม่แน่ใจ product_service_type ให้ว่างไว้)
  },
  "next_steps": "ขั้นตอนถัดไปที่ควรทำ อาจจะเป็นไปได้ทั้งการถามข้อมูลที่ลูกค้าถาม หรือตอบคำถามที่ลูกค้าถามมา"
}

คำแนะนำเพิ่มเติม:
1. ในฟิลด์ available_options ให้ระบุตัวเลือกที่ลูกค้าสามารถเลือกได้ตามชนิดของสินค้าหรือบริการที่กำลังพูดถึง
2. ให้จัดกลุ่มตัวเลือกตามหมวดหมู่ เช่น วัสดุ, รูปทรง, ขนาด, สี เป็นต้น
3. ให้รวมข้อมูลจากประวัติ Flow ที่มีอยู่แล้วเข้ากับการวิเคราะห์ครั้งนี้ด้วย
4. สำคัญมาก: ตัวเลือกใน available_options ต้องมาจากข้อมูลใน FLOW_TEXT เท่านั้น และต้องสอดคล้องกับประเภทสินค้าหรือบริการที่กำลังพูดถึง
5. ถ้าสามารถระบุได้ว่ากำลังพูดถึงสินค้าหรือบริการประเภทใดใน FLOW_TEXT ให้ดึงตัวเลือกจากรายการนั้นโดยเฉพาะ
6. ตัวอย่างการดึงตัวเลือก:
   - ถ้าพูดถึง "ป้ายตัวอักษร" ที่ทำจาก "สแตนเลส" ให้ดึงตัวเลือกจาก Product flow ที่มี Product="ป้ายตัวอักษร" และ Material="สแตนเลส"
   - ถ้าพูดถึง "ตัดเลเซอร์โลหะ" ที่ใช้ "สแตนเลส" ให้ดึงตัวเลือกจาก Service flow ที่มี Service="ตัดเลเซอร์โลหะ" และ Material="สแตนเลส"
7. ตัวเลือกควรแสดงเฉพาะหมวดหมู่ที่เกี่ยวข้องกับสินค้าหรือบริการนั้นๆ เท่านั้น
8. ถ้ามีข้อมูลที่ลูกค้าให้มาแล้ว ไม่ต้องแสดงตัวเลือกในหมวดหมู่นั้นอีก

`.trim();

  // เพิ่มการประกาศ openai ในฟังก์ชันนี้
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: promptText }],
      temperature: 0.1
    });

    const result = (response.choices[0].message.content || "").trim();
    console.log(`[DEBUG] flow analysis => ${result}`);
    return result;
  } catch (err) {
    console.error("Flow analysis error:", err);
    return JSON.stringify({
      "flow": "ไม่สามารถวิเคราะห์ Flow ได้",
      "product_service_type": "ไม่สามารถระบุได้",
      "existing_info": [],
      "missing_info": [],
      "available_options": {},
      "next_steps": "ติดต่อพนักงานเพื่อสอบถามข้อมูลเพิ่มเติม"
    });
  }
}

// === (2) buildSystemInstructions: ดึงเฉพาะ "1 แถว"
async function buildSystemInstructions(history) {
  // เรียกโมเดลเล็ก
  const classification = await classifyConversationUsingAnotherModel(history);

  // สร้างโครง
  let relevantData = {
    qnaSteps: sheetJSON.qnaSteps || [],
    companyDetails: sheetJSON.companyDetails || []
  };

  if (classification.tab === "Services") {
    const idx = classification.row - 1;
    if (idx >= 0 && idx < (sheetJSON.services || []).length) {
      relevantData.services = [ sheetJSON.services[idx] ];
    } else {
      relevantData.services = [];
    }
  } else if (classification.tab === "Products") {
    const idx = classification.row - 1;
    if (idx >= 0 && idx < (sheetJSON.products || []).length) {
      relevantData.products = [ sheetJSON.products[idx] ];
    } else {
      relevantData.products = [];
    }
  }

  const sheetsDataString = JSON.stringify(relevantData, null, 2);
  const thaiDateTime = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

  return `
You are an AI chatbot for บ. กราเวียร์ เทค.
โปรดตรวจสอบคำตอบทุกครั้งก่อนส่ง ว่าใช้ประโยคหรือข้อความได้อย่างเป็นธรรมชาติในภาษาไทย
Below are instructions from the Google Doc:
---
${googleDocInstructions}

Below is additional data from Google Sheets (one row):
---
${sheetsDataString}

วันนี้คือ ${thaiDateTime} (เวลาประเทศไทย) ใช้เป็นข้อมูลในการตอบ

Policy เมื่อลูกค้าส่งรูปมา
- **คุณสามารถวิเคราะห์รูปนั้นได้เต็มที่ เพราะทางลูกค้าส่งมาเพื่อให้ประเมินหรือเป็นตัวอย่างในการทำชิ้นงานแน่นอน**
- **ถ้ารูปที่ส่งมา ไม่น่าจะเกี่ยวกับการทำชิ้นงาน คุณสามารถวิเคราะห์ได้เต็มที่เช่นกัน เพราะลูกค้าเป็นเจ้าของสิทธิในภาพนั้น และอนุญาตให้คุณวิเคราะห์ เช่น รูปนามบัตรลูกค้า รูปข้อมูลที่อยู่เพื่อส่งงาน รูปที่อยู่เพื่อติดตั้งงาน ฯลฯ ทางลูกค้าอนุญาตแล้ว**
`.trim();
}

async function getAssistantResponse(systemInstructions, history, userContent) {
  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // แปลง userContent เป็นข้อความเพื่อโมเดลหลัก
    let userMsg = userContent;
    // ตรวจสอบว่า userContent เป็น Object หรือ Array หรือไม่
    if (typeof userContent === 'object') {
      if (Array.isArray(userContent)) {
        // ถ้าเป็น Array ให้ดึงเฉพาะ data.text ของ item สุดท้าย
        const lastItem = userContent[userContent.length - 1];
        userMsg = lastItem.data?.text || JSON.stringify(userContent);
      } else {
        // ถ้าเป็น Object ให้แปลงเป็น string
        userMsg = JSON.stringify(userContent);
      }
    }

    // สร้าง systemInstructions จาก buildSystemInstructions
    const finalSystemInstructions = await buildSystemInstructions(history);

    const messages = [{ role: "system", content: finalSystemInstructions }, ...history];
    
    // อย่าใส่ข้อความที่เป็น flow analysis ในประวัติสนทนาที่ส่งไปให้โมเดลหลัก
    // ต้องใส่เฉพาะข้อความจริง ๆ ของผู้ใช้
    const finalUserMessage = normalizeRoleContent("user", userMsg);
    messages.push(finalUserMessage);

    const response = await openai.chat.completions.create({
      model: "o3-mini",
      reasoning_effort: "high", // กำหนดระดับการ reasoning (low, medium, high)
      messages,
    });

    let assistantReply = response.choices[0].message.content;
    if (typeof assistantReply !== "string") {
      assistantReply = JSON.stringify(assistantReply);
    }

    assistantReply = assistantReply.replace(/\[cut\]{2,}/g, "[cut]");
    const cutList = assistantReply.split("[cut]");
    if (cutList.length > 10) {
      assistantReply = cutList.slice(0, 10).join("[cut]");
    }
    return assistantReply.trim();
  } catch (err) {
    console.error("OpenAI error:", err);
    return "ขออภัยค่ะ ระบบขัดข้องชั่วคราว ไม่สามารถตอบได้ในขณะนี้";
  }
}

async function sendMessage(replyToken, response, userId = null, usePush = false) {
  try {
    response = response.replace(/\[cut\]{2,}/g, "[cut]");
    let segments = response.split("[cut]").map(s => s.trim());
    segments = segments.filter(seg => seg.length > 0);
    if (segments.length > 10) {
      segments = segments.slice(0, 10);
    }

    const messageArray = [];
    for (let i = 0; i < segments.length; i++) {
      let segment = segments[i];
      const imageRegex = /\[SEND_IMAGE:(https?:\/\/[^\s]+)\]/g;
      const videoRegex = /\[SEND_VIDEO:(https?:\/\/[^\s]+)\]/g;
      const images = [...segment.matchAll(imageRegex)];
      const videos = [...segment.matchAll(videoRegex)];
      let textPart = segment.replace(imageRegex, '').replace(videoRegex, '').trim();

      for (const match of images) {
        const imageUrl = match[1];
        messageArray.push({
          type: 'image',
          originalContentUrl: imageUrl,
          previewImageUrl: imageUrl
        });
      }
      for (const match of videos) {
        const videoUrl = match[1];
        messageArray.push({
          type: 'video',
          originalContentUrl: videoUrl,
          previewImageUrl: 'https://via.placeholder.com/240.png/09f/fff'
        });
      }
      if (textPart) {
        messageArray.push({ type: 'text', text: textPart });
      }
    }
    if (messageArray.length === 0) return;
    
    if (usePush && userId) {
      // ใช้ pushMessage ถ้า usePush เป็น true และมี userId
      await lineClient.pushMessage(userId, messageArray);
    } else {
      // ใช้ replyMessage ถ้า usePush เป็น false หรือไม่มี userId
      await lineClient.replyMessage(replyToken, messageArray);
    }
  } catch (err) {
    console.error("sendMessage error:", err);
  }
}

// คงฟังก์ชัน replyTextMessage ไว้เพื่อความเข้ากันได้กับโค้ดเดิม
async function replyTextMessage(replyToken, response) {
  return sendMessage(replyToken, response);
}

// ------------------------
// (เพิ่ม) ฟังก์ชันวิเคราะห์รูป โดยให้ "system" เป็น prompt ไทยเต็ม และ "user" ใส่รูป
// ------------------------
async function analyzeImageWithAnotherModel(base64Data, conversationHistory) {
  // ไม่ต้องประกาศ openai ใหม่เพราะมีอยู่แล้วในระดับบนสุด
  
  // สร้างข้อความสำหรับ system (Prompt ไทยเต็ม)
  // รวมทั้ง conversationHistory (เปลี่ยนเป็น string) และ services/products
  // เพื่อใส่ใน system
  // ส่วน user message จะใส่เฉพาะภาพ
  const conversationString = conversationHistory
    .map(h => `${h.role.toUpperCase()}: ${h.content}`)
    .join("\n");

  const servicesList = `
========================================
[Services]
1 => ตัดเลเซอร์โลหะ  
   รายละเอียด: บริการตัดโลหะด้วยเลเซอร์ไฟเบอร์ที่แม่นยำ ใช้ได้กับเหล็ก สแตนเลส อลูมิเนียม ทองเหลือง ฯลฯ รองรับขนาดสูงสุด 1.50 ม. x 3 ม. เหมาะสำหรับงานอุตสาหกรรม ชิ้นส่วนเครื่องจักร ป้าย

2 => ตัดเลเซอร์อโลหะ  
   รายละเอียด: บริการตัดอะคริลิกหรือวัสดุอโลหะด้วยเลเซอร์ CO2 ขอบเรียบ แม่นยำ

3 => ยิงเลเซอร์โลหะ  
   รายละเอียด: สร้างลวดลายหรือมาร์กโลโก้บนโลหะ (สแตนเลส อะลูมิเนียม ฯลฯ) เพื่อสร้างความแตกต่างหรือสีที่ไม่เหมือนผิวเดิม

4 => ยิงเลเซอร์อโลหะ  
   รายละเอียด: ยิงสลักลวดลายบนอะคริลิก ไม้ หนัง ฯลฯ ด้วยเลเซอร์

5 => พิมพ์สีลงบนวัสดุ (Digital UV Printing)  
   รายละเอียด: พิมพ์สีดิจิทัลลงบนโลหะ ไม้ พลาสติก หรือวัสดุเรียบหลากชนิด โดยไม่ต้องใช้บล็อก พิมพ์หลายสีได้ทันที

6 => แกะสลักด้วย CNC  
   รายละเอียด: ใช้เครื่อง CNC ในการแกะหรือตัดวัสดุต่าง ๆ (โลหะอ่อน ไม้ พลาสติก) ได้ทั้ง 2D และ 3D

7 => ตัดด้วย CNC  
   รายละเอียด: ตัด/กัดวัสดุด้วยดอกกัดที่ควบคุมด้วยคอมพิวเตอร์ แม่นยำ มีรูปทรงซับซ้อน

8 => ตัด พับ เชื่อมโลหะ  
   รายละเอียด: บริการตัด พับ และเชื่อมโลหะแผ่นหรือท่อ (เหล็ก สแตนเลส ฯลฯ) เพื่อขึ้นรูปตามแบบ เช่น โครงสร้าง ป้าย

========================================
[Products]
1 => ป้ายกัดกรด  
   รายละเอียด: ป้ายโลหะที่กัดลวดลายหรือข้อความลงบนผิว เพื่อให้คมชัด ดูเป็นมืออาชีพ

2 => สติ๊กเกอร์พิมพ์ Inkjet หรือ Diecut  
   รายละเอียด: สติ๊กเกอร์พิมพ์อิงค์เจ็ทหรือสติ๊กเกอร์ไดคัทสำหรับงานป้าย ตกแต่ง

3 => ป้ายแปะด้านหน้าด้วย Sticker  
   รายละเอียด: ติดสติ๊กเกอร์ (พิมพ์หรือไดคัท) ลงบนแผ่นวัสดุด้านหน้า

4 => ป้ายตัวอักษรโลหะ  
   รายละเอียด: ตัวอักษรขึ้นรูปจากโลหะ (สแตนเลส อะลูมิเนียม ฯลฯ) แข็งแรง ทนทาน

5 => ป้ายตัวอักษรอโลหะ  
   รายละเอียด: ตัวอักษรทำจากอะคริลิก พลาสวูด หรือ MDF ตัดเป็นชื่อ โลโก้

6 => ป้ายตัวอักษรโลหะแบบมีไฟ  
   รายละเอียด: ตัวอักษรโลหะติด LED ภายใน ส่องไฟออกด้านหน้า/หลัง

7 => ป้ายตัวอักษรอโลหะแบบมีไฟ  
   รายละเอียด: ตัวอักษรอโลหะติด LED ส่องสว่าง สร้างความโดดเด่น

8 => ป้ายกล่องไฟ  
   รายละเอียด: กล่องป้ายภายในติดหลอดไฟ/LED หน้าด้วยอะคริลิกหรือไวนิลโปร่งแสง

9 => ป้ายจราจร  
   รายละเอียด: ป้ายโลหะติดสติ๊กเกอร์สะท้อนแสง ใช้ควบคุมการจราจร

10 => Nameplate ยิงเลเซอร์  
   รายละเอียด: แผ่นป้ายโลหะ/อะคริลิก ยิงเลเซอร์เป็นข้อความ/ลวดลาย

11 => ป้ายพิมพ์สี  
   รายละเอียด: พิมพ์สีลงบนแผ่นโลหะหรือพลาสติก เหมาะกับงานหลายสี

12 => ฉลากทำสติ๊กเกอร์  
   รายละเอียด: สติ๊กเกอร์พิมพ์ข้อมูล โลโก้ หรือข้อความ สำหรับติดผลิตภัณฑ์

13 => ป้ายแปะด้านหลังด้วย Sticker  
   รายละเอียด: แผ่นอะคริลิกใสติดสติ๊กเกอร์พิมพ์สีด้านหลัง เพื่อป้องกันสีหลุด
========================================

- ถ้ามีรูปตัวอย่างชิ้นงาน ให้เทียบดูว่าใกล้ service หรือ product ข้างบนไหม
- ถ้าไม่เจอหรือไม่เกี่ยว ให้ "tab":"None","row":0
- ถ้ามีหลายชิ้นงาน ให้ตอบโดยอิงชิ้นงานที่สนทนาล่าสุด

นี่คือข้อความ (user+assistant):
--------------------
${conversationText}
--------------------

ตอบเป็น JSON, ตัวอย่าง:
{
  "tab":"Services",
  "row":3
}
หรือ:
{
  "tab":"Products",
  "row":10
}
หรือ:
{
  "tab":"None",
  "row":0
}
`.trim();

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // สมมติว่าใช้โมเดล vision
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.3
    });

    const resultText = response.choices[0].message.content.trim();
    console.log("[DEBUG] Image analysis result (system prompt + user image):", resultText);
    return resultText;
  } catch (error) {
    console.error("Image analysis error:", error);
    return "ไม่สามารถวิเคราะห์รูปได้";
  }
}

// ------------------------
// ระบบคิว (ดีเลย์ 15 วินาที)
// ------------------------
const processedIds = new Set();
const userQueues = {};  // { userId: { messages: [], timer: null } }

function addToQueue(userId, incomingItem) {
  if (!userQueues[userId]) {
    userQueues[userId] = {
      messages: [],
      timer: null
    };
  }
  userQueues[userId].messages.push(incomingItem);

  if (userQueues[userId].timer) {
    clearTimeout(userQueues[userId].timer);
  }
  userQueues[userId].timer = setTimeout(() => {
    flushQueue(userId);
  }, 15_000);
}

async function flushQueue(userId) {
  if (!userQueues[userId] || userQueues[userId].messages.length === 0) {
    return;
  }
  const allItems = userQueues[userId].messages;
  userQueues[userId].messages = [];
  userQueues[userId].timer = null;

  await processFlushedMessages(userId, allItems);
}

async function processFlushedMessages(userId, mergedContent) {
  const userStatus = await getUserStatus(userId);
  const aiEnabled = userStatus.aiEnabled;

  const history = await getChatHistory(userId);

  if (!aiEnabled) {
    // ถ้า AI ปิดอยู่
    await saveChatHistory(userId, mergedContent, "");
    return;
  }

  // เรียกใช้ classification เพื่อดูว่าปัจจุบันกำลังพูดถึงสินค้า/บริการอะไร
  const classification = await classifyConversationUsingAnotherModel(history);
  
  // วิเคราะห์ Flow ของการสนทนาด้วย gpt-4o-mini ผ่านฟังก์ชันใหม่ พร้อมส่ง classification และ userId
  const flowAnalysis = await analyzeFlowGPT4oMini(history, classification, userId);
  
  // บันทึกผลการวิเคราะห์ Flow ลงในประวัติของผู้ใช้
  await saveUserFlowHistory(userId, flowAnalysis);
  
  // ส่งผลการวิเคราะห์ Flow ให้ผู้ใช้ก่อน (สำหรับ debug ในทีมงาน)
  const lastItem = mergedContent[mergedContent.length - 1];
  if (lastItem && lastItem.replyToken) {
    // ใช้ push เสมอโดยกำหนด usePush เป็น true
    await sendMessage(lastItem.replyToken, `[DEBUG] Flow Analysis:\n${flowAnalysis}`, userId, true);
  }

  // ปรับปรุงข้อความของผู้ใช้โดยเพิ่ม Flow Analysis ไว้ด้านหน้า
  // แต่แยกให้ชัดเจนว่าไม่ใช่ข้อความของผู้ใช้
  let userTextForModel = "";
  try {
    // พยายามแปลง flowAnalysis เป็น Object เพื่อจัดรูปแบบให้อ่านง่าย
    const flowData = JSON.parse(flowAnalysis);
    userTextForModel = `
===== [SYSTEM NOTE - THIS IS NOT USER MESSAGE - START] =====
Flow Analysis:
- Flow: ${flowData.flow || "ไม่ระบุ"}
- ประเภทสินค้า/บริการ: ${flowData.product_service_type || "ไม่ระบุ"}
- ข้อมูลที่มีแล้ว: ${JSON.stringify(flowData.existing_info || [])}
- ข้อมูลที่ยังขาด: ${JSON.stringify(flowData.missing_info || [])}
- ตัวเลือกที่มี: ${JSON.stringify(flowData.available_options || {})}
- ขั้นตอนถัดไป: ${flowData.next_steps || "ไม่ระบุ"}
===== [SYSTEM NOTE - THIS IS NOT USER MESSAGE - END] =====

ข้อความจากผู้ใช้:
`;
  } catch (e) {
    // ถ้าแปลง JSON ไม่ได้ ให้ใช้ตามเดิม
    userTextForModel = `
===== [SYSTEM NOTE - THIS IS NOT USER MESSAGE - START] =====
Flow Analysis:
${flowAnalysis}
===== [SYSTEM NOTE - THIS IS NOT USER MESSAGE - END] =====

ข้อความจากผู้ใช้:
`;
  }
  
  // สำหรับข้อความผู้ใช้จริงๆ ให้ดึงจาก mergedContent
  if (lastItem && lastItem.data && lastItem.data.text) {
    userTextForModel += lastItem.data.text;
  } else if (typeof mergedContent === 'string') {
    userTextForModel += mergedContent;
  } else {
    // กรณีอื่นๆ
    userTextForModel += JSON.stringify(mergedContent);
  }

  // ถ้า AI เปิด => เรียก getAssistantResponse ด้วยข้อความที่ปรับแล้ว
  // ถ้า AI เปิด => เรียก getAssistantResponse
  let assistantMsg = await getAssistantResponse("", history, userTextForModel);
  
  // บันทึกประวัติการสนทนาโดยใช้ข้อความผู้ใช้จริงๆ ไม่ใช่ข้อความที่เพิ่ม Flow Analysis
  await saveChatHistory(userId, mergedContent, assistantMsg);

  if (lastItem && lastItem.replyToken) {
    // ใช้ push เสมอโดยกำหนด usePush เป็น true
    await sendMessage(lastItem.replyToken, assistantMsg, userId, true);
  }
}

// ------------------------
// webhook
// ------------------------
app.post('/webhook', (req, res) => {
  const signature = req.get('x-line-signature');
  if (!line.validateSignature(JSON.stringify(req.body), lineConfig.channelSecret, signature)) {
    return res.status(403).send('Invalid signature.');
  }
  const events = req.body.events;
  Promise.all(events.map(handleLineEvent))
    .then(() => res.status(200).end())
    .catch(() => res.status(500).end());
});

async function handleLineEvent(event) {
  let uniqueId = event.eventId || "";
  if (event.message && event.message.id) {
    uniqueId += "_" + event.message.id;
  }
  if (processedIds.has(uniqueId)) return;
  processedIds.add(uniqueId);

  const userId = event.source.userId || "unknownUser";

  // กรณีตรวจจับคีย์เวิร์ด #DELETEMANY (ลบประวัติทั้งหมดทันที)
  if (event.type === 'message' && event.message.type === 'text') {
    const userMsg = event.message.text;
    if (userMsg.includes("#DELETEMANY")) {
      // เรียกฟังก์ชันล้างประวัติ
      await clearUserChatHistory(userId);
      // แจ้งผู้ใช้ว่าเราลบประวัติเรียบร้อยแล้ว
      await sendMessage(event.replyToken, "ลบประวัติสนทนาเรียบร้อยแล้ว!", userId, true);
      // ไม่ต้องบันทึกข้อความใหม่ หรือเข้าคิวใด ๆ ทั้งสิ้น -> return ออกได้เลย
      return;
    }

    // toggle แอดมิน (ตอบทันที)
    if (userMsg === "สวัสดีค่า แอดมิน Venus นะคะ จะมาดำเนินเรื่องต่อ") {
      await setUserStatus(userId, false);
      await sendMessage(event.replyToken, "แอดมิน Venus สวัสดีค่ะ", userId, true);
      await saveChatHistory(userId, userMsg, "แอดมิน Venus สวัสดีค่ะ");
      return;
    } else if (userMsg === "ขอนุญาตส่งต่อให้ทางแอดมินประจำสนทนาต่อนะคะ") {
      await setUserStatus(userId, true);
      await sendMessage(event.replyToken, "แอดมิน Venus ขอตัวก่อนนะคะ", userId, true);
      await saveChatHistory(userId, userMsg, "แอดมิน Venus ขอตัวก่อนนะคะ");
      return;
    }
  }

  // กรณีอื่น -> ใส่คิว
  if (event.type === 'message') {
    const message = event.message;
    let itemToQueue = { replyToken: event.replyToken };

    if (message.type === 'text') {
      itemToQueue.data = { type: "text", text: message.text };
      addToQueue(userId, itemToQueue);

    } else if (message.type === 'image') {
      // ดึง stream ของภาพจาก LINE
      const stream = await lineClient.getMessageContent(message.id);
      const buffers = [];
      for await (const chunk of stream) {
        buffers.push(chunk);
      }
      // รวม Buffer ต้นฉบับ
      const originalBuffer = Buffer.concat(buffers);

      let resizedBuffer;
      try {
        resizedBuffer = await sharp(originalBuffer)
          .resize({ width: 800, fit: 'inside' })
          .jpeg({ quality: 80 })
          .toBuffer();
      } catch (err) {
        console.error("sharp resize error:", err);
        resizedBuffer = originalBuffer;
      }

      // เปลี่ยนเป็น base64
      const base64Data = resizedBuffer.toString('base64');

      // เรียกฟังก์ชัน analyzeImageWithAnotherModel โดยส่งประวัติการสนทนา
      const history = await getChatHistory(userId);
      const analysisText = await analyzeImageWithAnotherModel(base64Data, history);

      console.log("[DEBUG] imageAnalysisText:", analysisText);

      // บันทึกเป็นข้อความเพื่อส่งต่อเข้าคิว
      itemToQueue.data = {
        type: "text",
        text: analysisText
      };
      addToQueue(userId, itemToQueue);

    } else if (message.type === 'video') {
      itemToQueue.data = {
        type: "text",
        text: "ผู้ใช้ส่งไฟล์แนบประเภท: video"
      };
      addToQueue(userId, itemToQueue);
    }
  }
}

// ------------------------
// 15-min refresh schedule
// ------------------------
let lastUpdatedQuarter = "";
function schedule15MinRefresh() {
  setInterval(async () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const quarter = Math.floor(currentMinute / 15);
    const currentQuarterLabel = `${currentHour}-${quarter}`;

    if ((currentMinute % 15 === 0) && (lastUpdatedQuarter !== currentQuarterLabel)) {
      console.log("[DEBUG] It's a new 15-minute interval => refreshing sheet data & doc instructions...");

      try {
        await fetchGoogleDocInstructions();
        sheetJSON = await fetchAllSheetsData(SPREADSHEET_ID);

        lastUpdatedQuarter = currentQuarterLabel;
        console.log(`[DEBUG] sheetJSON & googleDocInstructions updated at ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`);
      } catch (err) {
        console.error("15-minute sheet update error:", err);
      }
    }
  }, 60 * 1000);
}

// ------------------------
// Start server
// ------------------------
app.listen(PORT, async () => {
  try {
    await connectDB();
    await fetchGoogleDocInstructions();

    // โหลดข้อมูลจาก 7 แท็บ
    const [
      rowsQnASteps,      // "ลักษณะ/ขั้นตอน การถามตอบ"
      rowsMainFlow,       // "Main flow"
      rowsProductFlow,    // "Product flow"
      rowsServiceFlow,    // "Service flow"
      rowsCompany,        // "Company details"
      rowsProducts,       // "Products"
      rowsServices        // "Services"
    ] = await Promise.all([
      fetchSheetData(SPREADSHEET_ID, "ลักษณะ/ขั้นตอน การถามตอบ!A1:D100"),
      fetchSheetData(SPREADSHEET_ID, "Main flow!A1:D100"),
      fetchSheetData(SPREADSHEET_ID, "Product flow!A1:D100"),
      fetchSheetData(SPREADSHEET_ID, "Service flow!A1:D100"),
      fetchSheetData(SPREADSHEET_ID, "Company details!A1:D30"),
      fetchSheetData(SPREADSHEET_ID, "Products!A1:Q40"),
      fetchSheetData(SPREADSHEET_ID, "Services!A1:O40")
    ]);

    sheetJSON = {
      qnaSteps: transformSheetRowsToJSON(rowsQnASteps)
                  .concat(
                    transformSheetRowsToJSON(rowsMainFlow),
                    transformSheetRowsToJSON(rowsProductFlow),
                    transformSheetRowsToJSON(rowsServiceFlow)
                  ),
      companyDetails: transformSheetRowsToJSON(rowsCompany),
      products: transformSheetRowsToJSON(rowsProducts),
      services: transformSheetRowsToJSON(rowsServices)
    };

    schedule15MinRefresh();

    console.log("Server is running on port:", PORT);
  } catch (err) {
    console.error("Error during app initialization:", err);
  }
});

// เพิ่มฟังก์ชันเพื่อเก็บและดึงประวัติการวิเคราะห์ Flow ของผู้ใช้
async function getUserFlowHistory(userId) {
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("user_flow_history");
  const flowHistory = await coll.findOne({ senderId: userId });
  if (!flowHistory) {
    return { 
      senderId: userId, 
      flow: null, 
      product_service_type: null,
      existing_info: {},
      last_analyzed: null 
    };
  }
  return flowHistory;
}

async function saveUserFlowHistory(userId, flowAnalysis) {
  try {
    // ทำความสะอาด flowAnalysis โดยตัด markdown code block ออก (ถ้ามี)
    let cleanedFlowAnalysis = flowAnalysis;
    
    // ตรวจสอบว่ามีการเริ่มต้นด้วย ```json หรือ ``` หรือไม่
    if (cleanedFlowAnalysis.trim().startsWith("```")) {
      // ตัด ``` ออกจากตอนเริ่มต้น
      cleanedFlowAnalysis = cleanedFlowAnalysis.replace(/^```(?:json)?\s*\n/, "");
      // ตัด ``` ออกจากตอนจบ
      cleanedFlowAnalysis = cleanedFlowAnalysis.replace(/\n\s*```\s*$/, "");
    }
    
    // แปลง flowAnalysis ที่เป็น string json เป็น object
    let flowData;
    try {
      flowData = JSON.parse(cleanedFlowAnalysis);
    } catch (e) {
      console.error("Error parsing flow analysis:", e);
      console.log("Cleaned flow analysis:", cleanedFlowAnalysis);
      return;
    }
    
    // ดึงข้อมูล Flow เดิมของผู้ใช้ (ถ้ามี)
    const oldFlowHistory = await getUserFlowHistory(userId);
    
    // เตรียมข้อมูล existing_info โดยรวมจากข้อมูลเดิมและข้อมูลใหม่
    const existingInfo = oldFlowHistory.existing_info || {};
    
    // อัพเดตข้อมูลจากการวิเคราะห์ใหม่
    if (flowData.existing_info && Array.isArray(flowData.existing_info)) {
      flowData.existing_info.forEach(info => {
        // แยกข้อมูลในรูปแบบ "key: value" หรือแบบที่มีเฉพาะข้อมูล
        const match = info.match(/^([^:]+):\s*(.+)$/);
        if (match) {
          const [_, key, value] = match;
          existingInfo[key.trim()] = value.trim();
        } else {
          // กรณีมีแค่ข้อมูลโดยไม่ระบุประเภท ใช้ข้อมูลเป็น key
          existingInfo[info.trim()] = true;
        }
      });
    }
    
    const newFlowHistory = {
      senderId: userId,
      flow: flowData.flow || null,
      product_service_type: flowData.product_service_type || null,
      existing_info: existingInfo,
      missing_info: flowData.missing_info || [],
      next_steps: flowData.next_steps || null,
      last_analyzed: new Date()
    };
    
    const client = await connectDB();
    const db = client.db("chatbot");
    const coll = db.collection("user_flow_history");
    
    // ถ้ามีข้อมูลเดิมให้อัพเดต ถ้าไม่มีให้เพิ่มใหม่
    if (oldFlowHistory && oldFlowHistory.senderId) {
      await coll.updateOne(
        { senderId: userId },
        { $set: newFlowHistory }
      );
    } else {
      await coll.insertOne(newFlowHistory);
    }
  } catch (err) {
    console.error("Error saving flow history:", err);
  }
}

// === ฟังก์ชันโมเดลเล็ก: วิเคราะห์ Flow และข้อมูลที่ขาด (ฟังก์ชันใหม่ไม่มีการประกาศ openai ซ้ำซ้อน)
async function analyzeFlowGPT4oMini(history, classification = null, userId = null) {
  // เอา user + assistant สำหรับการวิเคราะห์
  const messagesForSmallModel = history
    .filter(h => (h.role === "user" || h.role === "assistant"))
    .map(h => `${h.role.toUpperCase()}: ${h.content}`);

  const conversationText = messagesForSmallModel.join("\n");
  
  // ดึงประวัติ Flow ของผู้ใช้ (ถ้ามี userId)
  let userFlowHistory = null;
  if (userId) {
    userFlowHistory = await getUserFlowHistory(userId);
  }
  
  // สร้าง JSON ของประวัติ Flow สำหรับใส่ใน prompt
  let flowHistoryText = "";
  if (userFlowHistory && userFlowHistory.existing_info) {
    flowHistoryText = `
ประวัติ Flow ของผู้ใช้:
Flow ปัจจุบัน: ${userFlowHistory.flow || "ยังไม่ได้กำหนด"}
ประเภทสินค้า/บริการ: ${userFlowHistory.product_service_type || "ยังไม่ได้กำหนด"}
ข้อมูลที่มีแล้ว:
${Object.entries(userFlowHistory.existing_info).map(([key, value]) => `- ${key}: ${value}`).join('\n')}
`;
  }
  
  // เพิ่มข้อมูลว่าปัจจุบันกำลังพูดถึงสินค้า/บริการอะไร (ถ้ามี)
  let currentProductServiceInfo = "";
  if (classification && classification.tab && classification.tab !== "None" && classification.row > 0) {
    currentProductServiceInfo = `
ปัจจุบันผู้ใช้กำลังพูดถึง: ${classification.tab} ลำดับที่ ${classification.row}
`;
  }

  const promptText = `
คุณคือโมเดลสำหรับวิเคราะห์บทสนทนาทั้งหมด (รวมทั้งข้อความจาก User และ Assistant) เพื่อระบุว่าปัจจุบันอยู่ใน Flow การสนทนาอะไร และขาดข้อมูลอะไรบ้าง

ด้านล่างคือรายการ "Main flow ขั้นตอนในการถามตอบ", "Product flow", และ "Service flow":

========================================
FLOW_TEXT:
${FLOW_TEXT}

ตัวอย่างข้อมูลสำคัญที่ต้องการจากลูกค้า:
- วัสดุที่ใช้
- ขนาด (กว้าง x สูง)
- รูปทรง
- ความหนา
- สีวัสดุ
- กระบวนการผลิต
- การตกแต่งผิว
- ประเภทไฟ (ถ้ามี)
- จำนวนด้าน/หน้า
- จำนวนที่ต้องการ
- ต้องการติดตั้งหรือไม่
- Artwork จากทางเราหรือลูกค้า
- มีรูปแบบที่ต้องการหรือไม่
- ชื่อและที่อยู่สำหรับออกใบเสนอราคา

${flowHistoryText}
${currentProductServiceInfo}

นี่คือข้อความสนทนา:
--------------------
${conversationText}
--------------------

โปรดวิเคราะห์บทสนทนาและตอบเป็น JSON:
{
  "flow": "ระบุ Flow ปัจจุบัน (A01, A02, AC01, G01, P001, AC02, A03, Product No.2, Service No.1)",
  "product_service_type": "ระบุประเภทสินค้าหรือบริการ (ถ้ามี และอ้างอิงชื่อจาก )",
  "existing_info": ["ข้อมูลที่มีแล้ว 1 (เช่น วัสดุ: สแตนเลส)", "ข้อมูลที่มีแล้ว 2", "..."],
  "missing_info": ["ข้อมูลที่ยังขาด 1", "ข้อมูลที่ยังขาด 2", "..."],
  "available_options": { (ถ้าไม่มี product_service_type ให้ว่างไว้)
    "Material": ["สแตนเลส", "อะคริลิค", "เหล็กซิงค์"], 
    "Shape": ["สี่เหลี่ยม", "วงกลม", "ตามแบบ"]
    (และอื่น ๆ ตาม FLOW_TEXT)
  },
  "next_steps": "ขั้นตอนถัดไปที่ควรทำ อาจจะเป็นไปได้ทั้งการถามข้อมูลส่วนที่ขาด หรือการตอบคำถามของลูกค้าที่ถามมา"
}

คำแนะนำเพิ่มเติม:
1. ในฟิลด์ available_options ให้ระบุตัวเลือกที่ลูกค้าสามารถเลือกได้ตามชนิดของสินค้าหรือบริการที่กำลังพูดถึง
2. ให้จัดกลุ่มตัวเลือกตามหมวดหมู่ เช่น วัสดุ, รูปทรง, ขนาด, สี เป็นต้น
3. ให้รวมข้อมูลจากประวัติ Flow ที่มีอยู่แล้วเข้ากับการวิเคราะห์ครั้งนี้ด้วย
4. สำคัญมาก: ตัวเลือกใน available_options ต้องมาจากข้อมูลใน FLOW_TEXT เท่านั้น และต้องสอดคล้องกับประเภทสินค้าหรือบริการที่กำลังพูดถึง
5. ถ้าสามารถระบุได้ว่ากำลังพูดถึงสินค้าหรือบริการประเภทใดใน FLOW_TEXT ให้ดึงตัวเลือกจากรายการนั้นโดยเฉพาะ
6. ตัวอย่างการดึงตัวเลือก:
   - ถ้าพูดถึง "ป้ายตัวอักษร" ที่ทำจาก "สแตนเลส" ให้ดึงตัวเลือกจาก Product flow ที่มี Product="ป้ายตัวอักษร" และ Material="สแตนเลส"
   - ถ้าพูดถึง "ตัดเลเซอร์โลหะ" ที่ใช้ "สแตนเลส" ให้ดึงตัวเลือกจาก Service flow ที่มี Service="ตัดเลเซอร์โลหะ" และ Material="สแตนเลส"
7. ตัวเลือกควรแสดงเฉพาะหมวดหมู่ที่เกี่ยวข้องกับสินค้าหรือบริการนั้นๆ เท่านั้น
8. ถ้ามีข้อมูลที่ลูกค้าให้มาแล้ว ไม่ต้องแสดงตัวเลือกในหมวดหมู่นั้นอีก

`.trim();

  // เพิ่มการประกาศ openai ในฟังก์ชันนี้
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: promptText }],
      temperature: 0.2
    });

    const result = (response.choices[0].message.content || "").trim();
    console.log(`[DEBUG] flow analysis => ${result}`);
    return result;
  } catch (err) {
    console.error("Flow analysis error:", err);
    return JSON.stringify({
      "flow": "ไม่สามารถวิเคราะห์ Flow ได้",
      "product_service_type": "ไม่สามารถระบุได้",
      "existing_info": [],
      "missing_info": [],
      "available_options": {},
      "next_steps": "ติดต่อพนักงานเพื่อสอบถามข้อมูลเพิ่มเติม"
    });
  }
}
