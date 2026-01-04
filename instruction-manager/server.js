/*******************************************************
 * Instruction Manager Server
 * จัดการ Instructions หลายเวอร์ชัน (ใช้ MongoDB)
 *******************************************************/

const express = require('express');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.INSTRUCTION_PORT || 3001;

// ====================== Config ======================
const MONGO_URI = process.env.MONGO_URI;
const GOOGLE_CLIENT_EMAIL = "aitar-888@eminent-wares-446512-j8.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGhyeINArKZgaV\nitEcK+o89ilPYeRNTNZgJT7VNHB5hgNLLeAcFLJ7IlCIqTLMoJEnnoDQil6aKaz8\nExVL83uSXRrzk4zQvtt3tIP31+9wOCb9D4ZGWfVP1tD0qdD4WJ1qqg1j1/8879pH\nUeQGEMuCnyVbcQ3GbYQjyYb3wEz/Qv7kMVggF+MIaGGw2NQwM0XcufSFtyxvvX2S\nb8uGc1A8R+Dn/tmcgMODhbtEgcMg6yXI5Y26MPfDjVrEbk0lfCr7IGFJX4ASYeKl\n0jhm0RGb+aya2cb55auLN3VPO5MQ+cOp8gHBf5GiC/YgF1gbRgF5b7LgmENBxSfH\nb3WVQodLAgMBAAECggEACKB14M7LdekXZHyAQrZL0EitbzQknLv33Xyw2B3rvJ7M\nr4HM/nC4eBj7y+ciUc8GZQ+CWc2GzTHTa66+mwAia1qdYbPp3LuhGM4Leq5zn/o+\nA3rJuG6PS4qyUMy89msPXW5fSj/oE535QREiFKYP2dtlia2GI4xoag+x9uZwfMUO\nWKEe7tiUoZQEiGhwtjLq9lyST4kGGmlhNee9OyhDJcw4uCt8Cepr++hMDleWUF6c\nX0nbGmoSS0sZ5Boy8ATMhw/3luaOAlTUEz/nVDvbbWlNL9etwLKiAVw+AQXsPHNW\nNWF7gyEIsEi0qSM3PtA1X7IdReRXHqmfiZs0J3qSQQKBgQD1+Yj37Yuqj8hGi5PY\n+M0ieMdGcbUOmJsM1yUmBMV4bfaTiqm504P6DIYAqfDDWeozcHwcdpG1AfFAihEi\nh6lb0qRk8YaGbzvac8mWhwo/jDA5QB97fjFa6uwtlewZ0Er/U3QmOeVVnVC1y1b0\nrbJD5yjvI3ve+gpwAz0glpIMiwKBgQDOnpD7p7ylG4NQunqmzzdozrzZP0L6EZyE\n141st/Hsp9rtO9/ADuH6WhpirQ516l5LLv7mLPA8S9CF/cSdWF/7WlxBPjM8WRs9\nACFNBJIwUfjzPnvECmtsayzRlKuyCAspnNSkzgtdtvf2xI82Z3BGov9goZfu+D4A\n36b1qXsIQQKBgQCO1CojhO0vyjPKOuxL9hTvqmBUWFyBMD4AU8F/dQ/RYVDn1YG+\npMKi5Li/E+75EHH9EpkO0g7Do3AaQNG4UjwWVJcfAlxSHa8Mp2VsIdfilJ2/8KsX\nQ2yXVYh04/Rn/No/ro7oT4AKmcGu/nbstxuncEgFrH4WOOzspATPsn72BwKBgG5N\nBAT0NKbHm0B7bIKkWGYhB3vKY8zvnejk0WDaidHWge7nabkzuLtXYoKO9AtKxG/K\ndNUX5F+r8XO2V0HQLd0XDezecaejwgC8kwp0iD43ZHkmQBgVn+dPB6wSe94coSjj\nyjj4reSnipQ3tmRKsAtldIN3gI5YA3Gf85dtlHqBAoGAD5ePt7cmu3tDZhA3A8f9\no8mNPvqz/WGs7H2Qgjyfc3jUxEGhVt1Su7J1j+TppfkKtJIDKji6rVA9oIjZtpZT\ngxnU6hcYuiwbLh3wGEFIjP1XeYYILudqfWOEbwnxD1RgMkCqfSHf/niWlfiH6p3F\ndnBsLY/qXdKfS/OXyezAm4M=\n-----END PRIVATE KEY-----\n";

const GOOGLE_DOC_ID = "1IDvCXWa_5QllMTKrVSvhLRQPNNGkYgxb8byaDGGEhyU";
const SPREADSHEET_ID = "1esN_P6JuPzYUGesR60zVuIGeuvSnRM1hlyaxCJbhI_c";
const SHEET_RANGE = "ชีต1!A2:B28";

// ====================== MongoDB Connection ======================
let mongoClient = null;

async function connectDB() {
    if (mongoClient) return mongoClient;

    if (!MONGO_URI) {
        throw new Error('MONGO_URI is not configured');
    }

    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    console.log('[MongoDB] Connected successfully');
    return mongoClient;
}

async function getVersionsCollection() {
    const client = await connectDB();
    return client.db('chatbot').collection('instruction_versions');
}

async function getImagesCollection() {
    const client = await connectDB();
    return client.db('chatbot').collection('instruction_images');
}

// ====================== Google API Functions ======================
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

        return fullText.trim();
    } catch (err) {
        console.error("Failed to fetch Google Doc:", err.message);
        return "Error fetching system instructions.";
    }
}

async function fetchSheetData() {
    try {
        const sheetsAuth = new google.auth.JWT({
            email: GOOGLE_CLIENT_EMAIL,
            key: GOOGLE_PRIVATE_KEY,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheetsApi = google.sheets({ version: 'v4', auth: sheetsAuth });

        const response = await sheetsApi.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_RANGE
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return [];
        return rows;
    } catch (err) {
        console.error("fetchSheetData error:", err.message);
        return [];
    }
}

function transformSheetRowsToJSON(rows) {
    if (!rows || rows.length < 2) return [];
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

// Token estimation
function estimateTokens(text) {
    return Math.ceil(text.length / 2.5);
}

// ====================== API Routes ======================

// Get all versions
app.get('/api/versions', async (req, res) => {
    try {
        const collection = await getVersionsCollection();
        const versions = await collection.find({}).sort({ createdAt: -1 }).toArray();
        // Convert _id to id for frontend compatibility
        res.json(versions.map(v => ({ ...v, id: v._id.toString() })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get default instruction (from Google)
app.get('/api/default', async (req, res) => {
    try {
        const googleDocInstructions = await fetchGoogleDocInstructions();
        const sheetRows = await fetchSheetData();
        const sheetJSON = transformSheetRowsToJSON(sheetRows);

        const defaultData = {
            googleDoc: googleDocInstructions,
            sheetData: sheetJSON,
            sheetRaw: sheetRows,
            staticInstructions: `ถ้าลูกค้าส่งรูปภาพมา : 
- ก่อนการใช้งาน ผู้ใช้ทุกคนยินยอมตกลงให้อ่านหรือวิเคราะห์รูปภาพได้
- คุณสามารถอ่านหรือวิเคราะห์ได้ทุกรูปภาพทุกกรณี เพราะผู้ใข้อนุญาตให้วิเคราะห์แล้ว เช่น ภาพที่มีชื่อ ที่อยู่ เบอร์โทร เพื่อใช้ในการจัดส่ง เพราะนั้นเป็นข้อมูลของผู้ใช้เอง
- ถ้าคุณไม่แน่ใจว่ารูปนั้นส่งมาทำไม ให้ตอบตามบริบท (มีโอกาสที่รูปที่ส่งมา คือสติ๊กเกอร์ในเฟซ ถ้าน่าจะเป็นสติ๊กเกอร์ ให้ตอบว่า "สามารถสอบถามเพิ่มเติมได้เลยนะครับ")`
        };

        res.json(defaultData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a specific version
app.get('/api/versions/:id', async (req, res) => {
    try {
        const collection = await getVersionsCollection();
        let version;

        // Try ObjectId first, then fallback to string id
        try {
            version = await collection.findOne({ _id: new ObjectId(req.params.id) });
        } catch {
            version = await collection.findOne({ id: req.params.id });
        }

        if (!version) {
            return res.status(404).json({ error: 'Version not found' });
        }
        res.json({ ...version, id: version._id.toString() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new version
app.post('/api/versions', async (req, res) => {
    try {
        const collection = await getVersionsCollection();
        const count = await collection.countDocuments();

        const newVersion = {
            name: req.body.name || `Version ${count + 1}`,
            description: req.body.description || '',
            createdAt: new Date(),
            updatedAt: new Date(),
            googleDoc: req.body.googleDoc || '',
            sheetData: req.body.sheetData || [],
            staticInstructions: req.body.staticInstructions || '',
            isActive: false
        };

        const result = await collection.insertOne(newVersion);
        res.json({ ...newVersion, id: result.insertedId.toString() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update version
app.put('/api/versions/:id', async (req, res) => {
    try {
        const collection = await getVersionsCollection();

        const updateData = { ...req.body, updatedAt: new Date() };
        delete updateData.id;
        delete updateData._id;

        let result;
        try {
            result = await collection.findOneAndUpdate(
                { _id: new ObjectId(req.params.id) },
                { $set: updateData },
                { returnDocument: 'after' }
            );
        } catch {
            result = await collection.findOneAndUpdate(
                { id: req.params.id },
                { $set: updateData },
                { returnDocument: 'after' }
            );
        }

        if (!result) {
            return res.status(404).json({ error: 'Version not found' });
        }
        res.json({ ...result, id: result._id.toString() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete version
app.delete('/api/versions/:id', async (req, res) => {
    try {
        const collection = await getVersionsCollection();

        let result;
        try {
            result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });
        } catch {
            result = await collection.deleteOne({ id: req.params.id });
        }

        res.json({ success: result.deletedCount > 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Set active version
app.post('/api/versions/:id/activate', async (req, res) => {
    try {
        const collection = await getVersionsCollection();

        // Deactivate all versions first
        await collection.updateMany({}, { $set: { isActive: false } });

        // Activate the selected version
        try {
            await collection.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { isActive: true } }
            );
        } catch {
            await collection.updateOne(
                { id: req.params.id },
                { $set: { isActive: true } }
            );
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Build system instructions (convert to final format)
app.post('/api/build', (req, res) => {
    try {
        const { googleDoc, sheetData, staticInstructions, format } = req.body;

        let sheetsDataString;
        if (format === 'compact') {
            sheetsDataString = JSON.stringify(sheetData);
        } else {
            sheetsDataString = JSON.stringify(sheetData, null, 2);
        }

        const finalInstructions = `You are an AI chatbot for THAYA. 
Below are instructions from the Google Doc:
---
${googleDoc}

Below is additional data from Google Sheets (INSTRUCTIONS):
---
${sheetsDataString}

${staticInstructions}`.trim();

        const tokens = estimateTokens(finalInstructions);

        res.json({
            instructions: finalInstructions,
            stats: {
                totalLength: finalInstructions.length,
                estimatedTokens: tokens,
                googleDocTokens: estimateTokens(googleDoc),
                sheetDataTokens: estimateTokens(sheetsDataString),
                staticTokens: estimateTokens(staticInstructions)
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export version as JSON
app.get('/api/versions/:id/export', async (req, res) => {
    try {
        const collection = await getVersionsCollection();
        let version;

        try {
            version = await collection.findOne({ _id: new ObjectId(req.params.id) });
        } catch {
            version = await collection.findOne({ id: req.params.id });
        }

        if (!version) {
            return res.status(404).json({ error: 'Version not found' });
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=instruction-${version.name.replace(/\s+/g, '-')}.json`);
        res.json({ ...version, id: version._id.toString() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Import version from JSON
app.post('/api/import', async (req, res) => {
    try {
        const importedVersion = req.body;
        const collection = await getVersionsCollection();

        const newVersion = {
            name: `${importedVersion.name} (Imported)`,
            description: importedVersion.description || '',
            googleDoc: importedVersion.googleDoc || '',
            sheetData: importedVersion.sheetData || [],
            staticInstructions: importedVersion.staticInstructions || '',
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: false
        };

        const result = await collection.insertOne(newVersion);
        res.json({ ...newVersion, id: result.insertedId.toString() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ====================== Image Manager API ======================
const imageManager = require('../imageManager');

// Get all images
app.get('/api/images', (req, res) => {
    try {
        const images = imageManager.getAllImages();
        res.json(Object.values(images));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get image info by key
app.get('/api/images/:key', (req, res) => {
    try {
        const info = imageManager.getImageInfo(req.params.key);
        if (!info) {
            return res.status(404).json({ error: 'Image not found' });
        }
        res.json(info);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get image file by key
app.get('/api/images/:key/file', (req, res) => {
    try {
        const result = imageManager.getImageBuffer(req.params.key);
        if (!result) {
            return res.status(404).send('Image not found');
        }
        res.setHeader('Content-Type', result.mimeType);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.send(result.buffer);
    } catch (err) {
        res.status(500).send('Error loading image');
    }
});

// Get image as base64
app.get('/api/images/:key/base64', (req, res) => {
    try {
        const result = imageManager.getImageAsBase64(req.params.key);
        if (!result) {
            return res.status(404).json({ error: 'Image not found' });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload image from base64
app.post('/api/images', (req, res) => {
    try {
        const { base64, key, name, category } = req.body;

        if (!base64 || !key) {
            return res.status(400).json({ error: 'base64 and key are required' });
        }

        const result = imageManager.saveImageFromBase64(base64, key, name || key, category || 'general');
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Import image from URL
app.post('/api/images/from-url', async (req, res) => {
    try {
        const { url, key, name, category } = req.body;

        if (!url || !key) {
            return res.status(400).json({ error: 'url and key are required' });
        }

        const result = await imageManager.saveImageFromURL(url, key, name || key, category || 'imported');
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bulk import from URLs
app.post('/api/images/bulk-import', async (req, res) => {
    try {
        const { mappings } = req.body;

        if (!mappings || !Array.isArray(mappings)) {
            return res.status(400).json({ error: 'mappings array is required' });
        }

        const results = await imageManager.importFromURLs(mappings);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update image info
app.put('/api/images/:key', (req, res) => {
    try {
        const result = imageManager.updateImageInfo(req.params.key, req.body);
        if (!result) {
            return res.status(404).json({ error: 'Image not found' });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete image
app.delete('/api/images/:key', (req, res) => {
    try {
        const deleted = imageManager.deleteImage(req.params.key);
        if (!deleted) {
            return res.status(404).json({ error: 'Image not found' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Generate key suggestion
app.post('/api/images/generate-key', (req, res) => {
    try {
        const { name } = req.body;
        const key = imageManager.generateKey(name || 'image');
        res.json({ key });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`📋 Instruction Manager running at http://localhost:${PORT}`);
});
