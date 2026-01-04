/*******************************************************
 * Image Manager Service
 * จัดการอัปโหลดและเก็บรูปภาพพร้อม key อ้างอิง
 *******************************************************/

const fs = require('fs');
const path = require('path');

// ใช้ Railway Volume หรือ local storage
const IMAGES_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'images')
    : path.join(__dirname, 'uploads', 'images');

const METADATA_FILE = process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'image-metadata.json')
    : path.join(__dirname, 'uploads', 'image-metadata.json');

// Ensure directories exist
function ensureDirectories() {
    const uploadsDir = path.dirname(METADATA_FILE);
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
    if (!fs.existsSync(METADATA_FILE)) {
        fs.writeFileSync(METADATA_FILE, JSON.stringify({ images: {} }, null, 2));
    }
}

ensureDirectories();

/**
 * โหลด metadata ของรูปภาพทั้งหมด
 */
function loadMetadata() {
    try {
        return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    } catch (err) {
        return { images: {} };
    }
}

/**
 * บันทึก metadata
 */
function saveMetadata(metadata) {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

/**
 * สร้าง key จากชื่อ (ลบ space และ special chars)
 */
function generateKey(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9ก-๙]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 50);
}

/**
 * บันทึกรูปภาพจาก base64
 * @param {string} base64Data - Base64 encoded image (data:image/png;base64,xxxxx หรือ raw base64)
 * @param {string} key - Key สำหรับอ้างอิง
 * @param {string} name - ชื่อรูปภาพ
 * @param {string} category - หมวดหมู่ (เช่น product, promotion, qrcode)
 * @returns {object} - ข้อมูลรูปภาพที่บันทึก
 */
function saveImageFromBase64(base64Data, key, name, category = 'general') {
    ensureDirectories();

    // Parse base64 data
    let imageBuffer;
    let mimeType = 'image/jpeg';
    let extension = 'jpg';

    if (base64Data.startsWith('data:')) {
        const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
            mimeType = matches[1];
            base64Data = matches[2];
            extension = mimeType.split('/')[1] || 'jpg';
            if (extension === 'jpeg') extension = 'jpg';
        }
    }

    imageBuffer = Buffer.from(base64Data, 'base64');

    // Generate unique filename
    const filename = `${key}_${Date.now()}.${extension}`;
    const filepath = path.join(IMAGES_DIR, filename);

    // Save file
    fs.writeFileSync(filepath, imageBuffer);

    // Update metadata
    const metadata = loadMetadata();
    metadata.images[key] = {
        key,
        name,
        category,
        filename,
        filepath,
        mimeType,
        size: imageBuffer.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    saveMetadata(metadata);

    return metadata.images[key];
}

/**
 * บันทึกรูปภาพจาก URL
 * @param {string} url - URL ของรูปภาพ
 * @param {string} key - Key สำหรับอ้างอิง
 * @param {string} name - ชื่อรูปภาพ
 * @param {string} category - หมวดหมู่
 */
async function saveImageFromURL(url, key, name, category = 'general') {
    const https = require('https');
    const http = require('http');

    ensureDirectories();

    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        protocol.get(url, (response) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
                return saveImageFromURL(response.headers.location, key, name, category)
                    .then(resolve)
                    .catch(reject);
            }

            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download: ${response.statusCode}`));
            }

            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => {
                const buffer = Buffer.concat(chunks);

                // Detect mime type
                const contentType = response.headers['content-type'] || 'image/jpeg';
                let extension = 'jpg';
                if (contentType.includes('png')) extension = 'png';
                else if (contentType.includes('gif')) extension = 'gif';
                else if (contentType.includes('webp')) extension = 'webp';

                // Save file
                const filename = `${key}_${Date.now()}.${extension}`;
                const filepath = path.join(IMAGES_DIR, filename);
                fs.writeFileSync(filepath, buffer);

                // Update metadata
                const metadata = loadMetadata();
                metadata.images[key] = {
                    key,
                    name,
                    category,
                    filename,
                    filepath,
                    mimeType: contentType,
                    originalUrl: url,
                    size: buffer.length,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                saveMetadata(metadata);

                resolve(metadata.images[key]);
            });
            response.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * อ่านรูปภาพเป็น base64 จาก key
 * @param {string} key - Key ของรูปภาพ
 * @returns {object|null} - { base64, mimeType, dataUrl } หรือ null ถ้าไม่พบ
 */
function getImageAsBase64(key) {
    const metadata = loadMetadata();
    const imageInfo = metadata.images[key];

    if (!imageInfo) {
        console.warn(`[ImageManager] Image not found for key: ${key}`);
        return null;
    }

    try {
        const buffer = fs.readFileSync(imageInfo.filepath);
        const base64 = buffer.toString('base64');
        const mimeType = imageInfo.mimeType || 'image/jpeg';

        return {
            base64,
            mimeType,
            dataUrl: `data:${mimeType};base64,${base64}`,
            info: imageInfo
        };
    } catch (err) {
        console.error(`[ImageManager] Error reading image ${key}:`, err);
        return null;
    }
}

/**
 * ดึงข้อมูลรูปภาพทั้งหมด
 */
function getAllImages() {
    return loadMetadata().images;
}

/**
 * ดึงข้อมูลรูปภาพตาม key
 */
function getImageInfo(key) {
    return loadMetadata().images[key] || null;
}

/**
 * ลบรูปภาพ
 */
function deleteImage(key) {
    const metadata = loadMetadata();
    const imageInfo = metadata.images[key];

    if (imageInfo) {
        // Delete file
        try {
            if (fs.existsSync(imageInfo.filepath)) {
                fs.unlinkSync(imageInfo.filepath);
            }
        } catch (err) {
            console.error(`[ImageManager] Error deleting file:`, err);
        }

        // Remove from metadata
        delete metadata.images[key];
        saveMetadata(metadata);
        return true;
    }

    return false;
}

/**
 * อัปเดตข้อมูลรูปภาพ
 */
function updateImageInfo(key, updates) {
    const metadata = loadMetadata();
    if (metadata.images[key]) {
        metadata.images[key] = {
            ...metadata.images[key],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        saveMetadata(metadata);
        return metadata.images[key];
    }
    return null;
}

/**
 * แปลง [SEND_IMAGE:key] เป็น URL หรือ base64
 * @param {string} text - ข้อความที่มี [SEND_IMAGE:key]
 * @param {string} baseUrl - Base URL สำหรับสร้าง URL ของรูป
 * @returns {string} - ข้อความที่แปลงแล้ว
 */
function replaceImageKeysWithURLs(text, baseUrl = '') {
    const keyRegex = /\[SEND_IMAGE:([a-zA-Z0-9_ก-๙]+)\]/g;

    return text.replace(keyRegex, (match, key) => {
        // ถ้าเป็น URL อยู่แล้ว ให้ส่งกลับไปเลย
        if (key.startsWith('http://') || key.startsWith('https://')) {
            return match;
        }

        const imageInfo = getImageInfo(key);
        if (imageInfo) {
            // Return URL to serve the image
            return `[SEND_IMAGE:${baseUrl}/api/images/${key}/file]`;
        }

        console.warn(`[ImageManager] Unknown image key: ${key}`);
        return match; // Keep original if not found
    });
}

/**
 * ดึง Buffer ของรูปภาพสำหรับส่ง
 */
function getImageBuffer(key) {
    const metadata = loadMetadata();
    const imageInfo = metadata.images[key];

    if (!imageInfo) return null;

    try {
        return {
            buffer: fs.readFileSync(imageInfo.filepath),
            mimeType: imageInfo.mimeType || 'image/jpeg'
        };
    } catch (err) {
        console.error(`[ImageManager] Error reading image ${key}:`, err);
        return null;
    }
}

/**
 * นำเข้ารูปภาพจาก URLs ที่มีอยู่
 */
async function importFromURLs(urlMappings) {
    const results = [];
    for (const mapping of urlMappings) {
        try {
            const result = await saveImageFromURL(
                mapping.url,
                mapping.key,
                mapping.name || mapping.key,
                mapping.category || 'imported'
            );
            results.push({ success: true, key: mapping.key, result });
        } catch (err) {
            results.push({ success: false, key: mapping.key, error: err.message });
        }
    }
    return results;
}

module.exports = {
    saveImageFromBase64,
    saveImageFromURL,
    getImageAsBase64,
    getAllImages,
    getImageInfo,
    deleteImage,
    updateImageInfo,
    replaceImageKeysWithURLs,
    getImageBuffer,
    importFromURLs,
    generateKey,
    IMAGES_DIR,
    METADATA_FILE
};
