/*******************************************************
 * Instruction Manager Server
 * จัดการ Instructions หลายเวอร์ชัน (ใช้ PostgreSQL)
 *******************************************************/

const express = require('express');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { randomUUID } = require('crypto');
const { connectDb, initSchema, query } = require('../db/postgres');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.INSTRUCTION_PORT || 3001;

// ====================== Config ======================
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_CONNECTION_STRING;
const GOOGLE_CLIENT_EMAIL = "aitar-888@eminent-wares-446512-j8.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGhyeINArKZgaV\nitEcK+o89ilPYeRNTNZgJT7VNHB5hgNLLeAcFLJ7IlCIqTLMoJEnnoDQil6aKaz8\nExVL83uSXRrzk4zQvtt3tIP31+9wOCb9D4ZGWfVP1tD0qdD4WJ1qqg1j1/8879pH\nUeQGEMuCnyVbcQ3GbYQjyYb3wEz/Qv7kMVggF+MIaGGw2NQwM0XcufSFtyxvvX2S\nb8uGc1A8R+Dn/tmcgMODhbtEgcMg6yXI5Y26MPfDjVrEbk0lfCr7IGFJX4ASYeKl\n0jhm0RGb+aya2cb55auLN3VPO5MQ+cOp8gHBf5GiC/YgF1gbRgF5b7LgmENBxSfH\nb3WVQodLAgMBAAECggEACKB14M7LdekXZHyAQrZL0EitbzQknLv33Xyw2B3rvJ7M\nr4HM/nC4eBj7y+ciUc8GZQ+CWc2GzTHTa66+mwAia1qdYbPp3LuhGM4Leq5zn/o+\nA3rJuG6PS4qyUMy89msPXW5fSj/oE535QREiFKYP2dtlia2GI4xoag+x9uZwfMUO\nWKEe7tiUoZQEiGhwtjLq9lyST4kGGmlhNee9OyhDJcw4uCt8Cepr++hMDleWUF6c\nX0nbGmoSS0sZ5Boy8ATMhw/3luaOAlTUEz/nVDvbbWlNL9etwLKiAVw+AQXsPHNW\nNWF7gyEIsEi0qSM3PtA1X7IdReRXHqmfiZs0J3qSQQKBgQD1+Yj37Yuqj8hGi5PY\n+M0ieMdGcbUOmJsM1yUmBMV4bfaTiqm504P6DIYAqfDDWeozcHwcdpG1AfFAihEi\nh6lb0qRk8YaGbzvac8mWhwo/jDA5QB97fjFa6uwtlewZ0Er/U3QmOeVVnVC1y1b0\nrbJD5yjvI3ve+gpwAz0glpIMiwKBgQDOnpD7p7ylG4NQunqmzzdozrzZP0L6EZyE\n141st/Hsp9rtO9/ADuH6WhpirQ516l5LLv7mLPA8S9CF/cSdWF/7WlxBPjM8WRs9\nACFNBJIwUfjzPnvECmtsayzRlKuyCAspnNSkzgtdtvf2xI82Z3BGov9goZfu+D4A\n36b1qXsIQQKBgQCO1CojhO0vyjPKOuxL9hTvqmBUWFyBMD4AU8F/dQ/RYVDn1YG+\npMKi5Li/E+75EHH9EpkO0g7Do3AaQNG4UjwWVJcfAlxSHa8Mp2VsIdfilJ2/8KsX\nQ2yXVYh04/Rn/No/ro7oT4AKmcGu/nbstxuncEgFrH4WOOzspATPsn72BwKBgG5N\nBAT0NKbHm0B7bIKkWGYhB3vKY8zvnejk0WDaidHWge7nabkzuLtXYoKO9AtKxG/K\ndNUX5F+r8XO2V0HQLd0XDezecaejwgC8kwp0iD43ZHkmQBgVn+dPB6wSe94coSjj\nyjj4reSnipQ3tmRKsAtldIN3gI5YA3Gf85dtlHqBAoGAD5ePt7cmu3tDZhA3A8f9\no8mNPvqz/WGs7H2Qgjyfc3jUxEGhVt1Su7J1j+TppfkKtJIDKji6rVA9oIjZtpZT\ngxnU6hcYuiwbLh3wGEFIjP1XeYYILudqfWOEbwnxD1RgMkCqfSHf/niWlfiH6p3F\ndnBsLY/qXdKfS/OXyezAm4M=\n-----END PRIVATE KEY-----\n";

const GOOGLE_DOC_ID = "1IDvCXWa_5QllMTKrVSvhLRQPNNGkYgxb8byaDGGEhyU";
const SPREADSHEET_ID = "1esN_P6JuPzYUGesR60zVuIGeuvSnRM1hlyaxCJbhI_c";
const SHEET_RANGE = "ชีต1!A2:B28";

// ====================== PostgreSQL Connection ======================
async function ensureDbReady() {
    if (!DATABASE_URL) {
        throw new Error('DATABASE_URL is not configured');
    }
    await connectDb();
    await initSchema();
}

function mapVersionRow(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        description: row.description || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        googleDoc: row.google_doc || '',
        sheetData: row.sheet_data || [],
        staticInstructions: row.static_instructions || '',
        isActive: row.is_active === true
    };
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
        const result = await query(
            `SELECT * FROM instruction_versions ORDER BY created_at DESC`
        );
        res.json((result.rows || []).map(mapVersionRow));
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
        const result = await query(
            `SELECT * FROM instruction_versions WHERE id = $1`,
            [req.params.id]
        );
        const version = result.rows?.[0];

        if (!version) {
            return res.status(404).json({ error: 'Version not found' });
        }
        res.json(mapVersionRow(version));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new version
app.post('/api/versions', async (req, res) => {
    try {
        const countResult = await query(`SELECT COUNT(*)::int AS total FROM instruction_versions`);
        const count = countResult.rows?.[0]?.total || 0;
        const now = new Date();

        const newVersion = {
            id: randomUUID(),
            name: req.body.name || `Version ${count + 1}`,
            description: req.body.description || '',
            createdAt: now,
            updatedAt: now,
            googleDoc: req.body.googleDoc || '',
            sheetData: req.body.sheetData || [],
            staticInstructions: req.body.staticInstructions || '',
            isActive: false
        };

        await query(
            `INSERT INTO instruction_versions
              (id, name, description, created_at, updated_at, google_doc, sheet_data, static_instructions, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                newVersion.id,
                newVersion.name,
                newVersion.description,
                newVersion.createdAt,
                newVersion.updatedAt,
                newVersion.googleDoc,
                newVersion.sheetData,
                newVersion.staticInstructions,
                newVersion.isActive
            ]
        );
        res.json(newVersion);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update version
app.put('/api/versions/:id', async (req, res) => {
    try {
        const updateData = { ...req.body, updatedAt: new Date() };
        delete updateData.id;
        delete updateData._id;

        const fields = [];
        const values = [];
        let idx = 1;

        if ('name' in updateData) {
            fields.push(`name = $${idx++}`);
            values.push(updateData.name);
        }
        if ('description' in updateData) {
            fields.push(`description = $${idx++}`);
            values.push(updateData.description);
        }
        if ('googleDoc' in updateData) {
            fields.push(`google_doc = $${idx++}`);
            values.push(updateData.googleDoc);
        }
        if ('sheetData' in updateData) {
            fields.push(`sheet_data = $${idx++}`);
            values.push(updateData.sheetData);
        }
        if ('staticInstructions' in updateData) {
            fields.push(`static_instructions = $${idx++}`);
            values.push(updateData.staticInstructions);
        }
        if ('isActive' in updateData) {
            fields.push(`is_active = $${idx++}`);
            values.push(Boolean(updateData.isActive));
        }

        fields.push(`updated_at = $${idx++}`);
        values.push(updateData.updatedAt);
        values.push(req.params.id);

        const result = await query(
            `UPDATE instruction_versions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );

        if (!result.rows?.[0]) {
            return res.status(404).json({ error: 'Version not found' });
        }
        res.json(mapVersionRow(result.rows[0]));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete version
app.delete('/api/versions/:id', async (req, res) => {
    try {
        const result = await query(
            `DELETE FROM instruction_versions WHERE id = $1`,
            [req.params.id]
        );
        res.json({ success: result.rowCount > 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Set active version
app.post('/api/versions/:id/activate', async (req, res) => {
    try {
        await query(`UPDATE instruction_versions SET is_active = false`);
        await query(`UPDATE instruction_versions SET is_active = true WHERE id = $1`, [req.params.id]);

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
        const result = await query(
            `SELECT * FROM instruction_versions WHERE id = $1`,
            [req.params.id]
        );
        const version = result.rows?.[0];

        if (!version) {
            return res.status(404).json({ error: 'Version not found' });
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=instruction-${version.name.replace(/\s+/g, '-')}.json`);
        res.json(mapVersionRow(version));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Import version from JSON
app.post('/api/import', async (req, res) => {
    try {
        const importedVersion = req.body;
        const now = new Date();
        const newVersion = {
            id: randomUUID(),
            name: `${importedVersion.name} (Imported)`,
            description: importedVersion.description || '',
            googleDoc: importedVersion.googleDoc || '',
            sheetData: importedVersion.sheetData || [],
            staticInstructions: importedVersion.staticInstructions || '',
            createdAt: now,
            updatedAt: now,
            isActive: false
        };

        await query(
            `INSERT INTO instruction_versions
              (id, name, description, created_at, updated_at, google_doc, sheet_data, static_instructions, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                newVersion.id,
                newVersion.name,
                newVersion.description,
                newVersion.createdAt,
                newVersion.updatedAt,
                newVersion.googleDoc,
                newVersion.sheetData,
                newVersion.staticInstructions,
                newVersion.isActive
            ]
        );
        res.json(newVersion);
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
app.listen(PORT, async () => {
    try {
        await ensureDbReady();
        console.log(`📋 Instruction Manager running at http://localhost:${PORT}`);
    } catch (err) {
        console.error("Instruction Manager startup error:", err);
    }
});
