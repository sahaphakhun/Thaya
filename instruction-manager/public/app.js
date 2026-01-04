/*******************************************************
 * THAYA Instruction Manager - Frontend JavaScript
 *******************************************************/

// ====================== State ======================
const state = {
    defaultData: null,
    versions: [],
    currentVersion: null,
    isTableView: true
};

// ====================== DOM Elements ======================
const elements = {
    // Navigation
    navItems: document.querySelectorAll('.nav-item'),
    views: document.querySelectorAll('.view'),

    // Dashboard
    defaultTokens: document.getElementById('defaultTokens'),
    defaultCost: document.getElementById('defaultCost'),
    activeVersionBadge: document.getElementById('activeVersionBadge'),
    activeTokens: document.getElementById('activeTokens'),
    activeSavings: document.getElementById('activeSavings'),
    totalVersions: document.getElementById('totalVersions'),
    lastUpdated: document.getElementById('lastUpdated'),

    // Version List
    versionsList: document.getElementById('versionsList'),
    searchVersions: document.getElementById('searchVersions'),

    // Editor
    versionSelect: document.getElementById('versionSelect'),
    versionName: document.getElementById('versionName'),
    versionDesc: document.getElementById('versionDesc'),
    googleDocContent: document.getElementById('googleDocContent'),
    sheetTableBody: document.getElementById('sheetTableBody'),
    sheetDataJSON: document.getElementById('sheetDataJSON'),
    staticContent: document.getElementById('staticContent'),

    // Token counts
    googleDocTokens: document.getElementById('googleDocTokens'),
    sheetDataTokens: document.getElementById('sheetDataTokens'),
    staticTokens: document.getElementById('staticTokens'),

    // Preview
    previewVersionSelect: document.getElementById('previewVersionSelect'),
    formatSelect: document.getElementById('formatSelect'),
    outputPreview: document.getElementById('outputPreview'),
    previewTotalTokens: document.getElementById('previewTotalTokens'),
    previewGoogleDocTokens: document.getElementById('previewGoogleDocTokens'),
    previewSheetTokens: document.getElementById('previewSheetTokens'),
    previewCost: document.getElementById('previewCost'),

    // Modal
    modalOverlay: document.getElementById('modalOverlay'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    modalClose: document.getElementById('modalClose'),
    modalCancel: document.getElementById('modalCancel'),
    modalConfirm: document.getElementById('modalConfirm'),

    // Toast
    toastContainer: document.getElementById('toastContainer')
};

// ====================== Utility Functions ======================
function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 2.5);
}

function formatNumber(num) {
    return new Intl.NumberFormat('th-TH').format(num);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
    <span>${message}</span>
  `;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showModal(title, content, onConfirm, confirmText = 'ยืนยัน') {
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = content;
    elements.modalConfirm.textContent = confirmText;
    elements.modalOverlay.classList.add('active');

    elements.modalConfirm.onclick = () => {
        onConfirm();
        hideModal();
    };
}

function hideModal() {
    elements.modalOverlay.classList.remove('active');
}

// ====================== API Functions ======================
async function fetchDefault() {
    try {
        const res = await fetch('/api/default');
        const data = await res.json();
        state.defaultData = data;
        return data;
    } catch (err) {
        console.error('Error fetching default:', err);
        showToast('ไม่สามารถโหลดข้อมูลเริ่มต้นได้', 'error');
        return null;
    }
}

async function fetchVersions() {
    try {
        const res = await fetch('/api/versions');
        const data = await res.json();
        state.versions = data;
        return data;
    } catch (err) {
        console.error('Error fetching versions:', err);
        showToast('ไม่สามารถโหลดเวอร์ชันได้', 'error');
        return [];
    }
}

async function saveVersion(versionData) {
    try {
        const isNew = !versionData.id;
        const url = isNew ? '/api/versions' : `/api/versions/${versionData.id}`;
        const method = isNew ? 'POST' : 'PUT';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(versionData)
        });

        const data = await res.json();
        showToast('บันทึกเวอร์ชันสำเร็จ', 'success');
        return data;
    } catch (err) {
        console.error('Error saving version:', err);
        showToast('ไม่สามารถบันทึกเวอร์ชันได้', 'error');
        return null;
    }
}

async function deleteVersion(id) {
    try {
        await fetch(`/api/versions/${id}`, { method: 'DELETE' });
        showToast('ลบเวอร์ชันสำเร็จ', 'success');
        return true;
    } catch (err) {
        console.error('Error deleting version:', err);
        showToast('ไม่สามารถลบเวอร์ชันได้', 'error');
        return false;
    }
}

async function activateVersion(id) {
    try {
        await fetch(`/api/versions/${id}/activate`, { method: 'POST' });
        showToast('เปิดใช้งานเวอร์ชันสำเร็จ', 'success');
        return true;
    } catch (err) {
        console.error('Error activating version:', err);
        showToast('ไม่สามารถเปิดใช้งานเวอร์ชันได้', 'error');
        return false;
    }
}

async function buildInstructions(versionData, format) {
    try {
        const res = await fetch('/api/build', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                googleDoc: versionData.googleDoc,
                sheetData: versionData.sheetData,
                staticInstructions: versionData.staticInstructions,
                format
            })
        });
        return await res.json();
    } catch (err) {
        console.error('Error building instructions:', err);
        showToast('ไม่สามารถสร้าง Instructions ได้', 'error');
        return null;
    }
}

// ====================== UI Update Functions ======================
function updateDashboard() {
    // Calculate default tokens
    if (state.defaultData) {
        const googleDocTokens = estimateTokens(state.defaultData.googleDoc);
        const sheetDataTokens = estimateTokens(JSON.stringify(state.defaultData.sheetData, null, 2));
        const staticTokens = estimateTokens(state.defaultData.staticInstructions);
        const totalTokens = googleDocTokens + sheetDataTokens + staticTokens;

        elements.defaultTokens.textContent = formatNumber(totalTokens);
        elements.defaultCost.textContent = `$${(totalTokens / 1000 * 0.00015).toFixed(6)}`;
    }

    // Update active version info
    const activeVersion = state.versions.find(v => v.isActive);
    if (activeVersion) {
        elements.activeVersionBadge.textContent = activeVersion.name;
        elements.activeVersionBadge.className = 'badge badge-success';

        const activeTokens = estimateTokens(activeVersion.googleDoc) +
            estimateTokens(JSON.stringify(activeVersion.sheetData)) +
            estimateTokens(activeVersion.staticInstructions);
        elements.activeTokens.textContent = formatNumber(activeTokens);

        if (state.defaultData) {
            const defaultTokens = estimateTokens(state.defaultData.googleDoc) +
                estimateTokens(JSON.stringify(state.defaultData.sheetData, null, 2)) +
                estimateTokens(state.defaultData.staticInstructions);
            const savings = defaultTokens - activeTokens;
            const savingsPercent = ((savings / defaultTokens) * 100).toFixed(1);
            elements.activeSavings.textContent = savings > 0 ? `${savingsPercent}%` : '0%';
        }
    } else {
        elements.activeVersionBadge.textContent = 'ไม่มี';
        elements.activeVersionBadge.className = 'badge badge-warning';
        elements.activeTokens.textContent = '-';
        elements.activeSavings.textContent = '-';
    }

    // Update stats
    elements.totalVersions.textContent = state.versions.length;
    const latestVersion = state.versions.sort((a, b) =>
        new Date(b.updatedAt) - new Date(a.updatedAt)
    )[0];
    elements.lastUpdated.textContent = latestVersion ? formatDate(latestVersion.updatedAt) : '-';
}

function renderVersionsList() {
    const searchTerm = elements.searchVersions.value.toLowerCase();
    const filteredVersions = state.versions.filter(v =>
        v.name.toLowerCase().includes(searchTerm) ||
        (v.description && v.description.toLowerCase().includes(searchTerm))
    );

    if (filteredVersions.length === 0) {
        elements.versionsList.innerHTML = `
      <div class="card">
        <div class="card-body" style="text-align: center; color: var(--text-muted);">
          <p>ยังไม่มีเวอร์ชัน ${searchTerm ? `ที่ตรงกับ "${searchTerm}"` : ''}</p>
          <button class="btn btn-primary" style="margin-top: 12px;" onclick="createNewVersion()">
            + สร้างเวอร์ชันใหม่
          </button>
        </div>
      </div>
    `;
        return;
    }

    elements.versionsList.innerHTML = filteredVersions.map(v => `
    <div class="version-item ${v.isActive ? 'active' : ''}" data-id="${v.id}">
      <div class="version-info">
        <div class="version-name">
          ${v.isActive ? '✅' : '📄'} ${v.name}
          ${v.isActive ? '<span class="badge badge-success">Active</span>' : ''}
        </div>
        <div class="version-meta">
          ${v.description || 'ไม่มีคำอธิบาย'} • อัปเดต: ${formatDate(v.updatedAt)}
        </div>
      </div>
      <div class="version-actions">
        <button class="btn btn-sm btn-outline" onclick="editVersion('${v.id}')">✏️ แก้ไข</button>
        <button class="btn btn-sm btn-outline" onclick="duplicateVersion('${v.id}')">📋 ทำสำเนา</button>
        ${!v.isActive ? `<button class="btn btn-sm btn-success" onclick="handleActivate('${v.id}')">🔌 เปิดใช้</button>` : ''}
        <button class="btn btn-sm btn-outline" onclick="exportVersion('${v.id}')">📤 Export</button>
        <button class="btn btn-sm btn-danger" onclick="handleDelete('${v.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

function updateVersionSelects() {
    const options = state.versions.map(v =>
        `<option value="${v.id}">${v.name}${v.isActive ? ' ✅' : ''}</option>`
    ).join('');

    elements.versionSelect.innerHTML = '<option value="">-- สร้างเวอร์ชันใหม่ --</option>' + options;
    elements.previewVersionSelect.innerHTML = '<option value="default">📌 ค่าเริ่มต้น (Google)</option>' + options;
}

function renderSheetTable(data) {
    if (!data || data.length === 0) {
        elements.sheetTableBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; color: var(--text-muted);">
          ไม่มีข้อมูล
        </td>
      </tr>
    `;
        return;
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);

    elements.sheetTableBody.innerHTML = data.map((row, index) => `
    <tr data-index="${index}">
      <td>
        <textarea class="table-cell" data-field="${headers[0]}" rows="3">${row[headers[0]] || ''}</textarea>
      </td>
      <td>
        <textarea class="table-cell" data-field="${headers[1]}" rows="3">${row[headers[1]] || ''}</textarea>
      </td>
      <td class="action-cell">
        <button class="btn btn-sm btn-danger" onclick="removeTableRow(${index})">🗑️</button>
      </td>
    </tr>
  `).join('');

    // Add event listeners for cell changes
    document.querySelectorAll('.table-cell').forEach(cell => {
        cell.addEventListener('input', updateSheetDataFromTable);
    });
}

function updateSheetDataFromTable() {
    const rows = document.querySelectorAll('#sheetTableBody tr');
    const data = [];

    rows.forEach(row => {
        const cells = row.querySelectorAll('.table-cell');
        if (cells.length >= 2) {
            const obj = {};
            cells.forEach(cell => {
                const field = cell.getAttribute('data-field');
                obj[field] = cell.value;
            });
            data.push(obj);
        }
    });

    elements.sheetDataJSON.value = JSON.stringify(data, null, 2);
    updateTokenCounts();
}

function updateTokenCounts() {
    const googleDocTokens = estimateTokens(elements.googleDocContent.value);
    const sheetDataTokens = estimateTokens(elements.sheetDataJSON.value);
    const staticTokens = estimateTokens(elements.staticContent.value);

    elements.googleDocTokens.textContent = `${formatNumber(googleDocTokens)} tokens`;
    elements.sheetDataTokens.textContent = `${formatNumber(sheetDataTokens)} tokens`;
    elements.staticTokens.textContent = `${formatNumber(staticTokens)} tokens`;
}

// ====================== Action Handlers ======================
function switchView(viewId) {
    elements.views.forEach(v => v.classList.remove('active'));
    elements.navItems.forEach(n => n.classList.remove('active'));

    document.getElementById(`${viewId}View`).classList.add('active');
    document.querySelector(`[data-view="${viewId}"]`).classList.add('active');
}

async function createNewVersion(fromDefault = false) {
    let initialData = {
        googleDoc: '',
        sheetData: [],
        staticInstructions: ''
    };

    if (fromDefault && state.defaultData) {
        initialData = {
            googleDoc: state.defaultData.googleDoc,
            sheetData: state.defaultData.sheetData,
            staticInstructions: state.defaultData.staticInstructions
        };
    }

    state.currentVersion = null;
    elements.versionSelect.value = '';
    elements.versionName.value = fromDefault ? 'Version from Default' : '';
    elements.versionDesc.value = '';
    elements.googleDocContent.value = initialData.googleDoc;
    elements.sheetDataJSON.value = JSON.stringify(initialData.sheetData, null, 2);
    elements.staticContent.value = initialData.staticInstructions;

    renderSheetTable(initialData.sheetData);
    updateTokenCounts();
    switchView('editor');

    showToast(fromDefault ? 'สร้างจากค่าเริ่มต้นแล้ว กรุณาแก้ไขและบันทึก' : 'พร้อมสร้างเวอร์ชันใหม่', 'info');
}

async function editVersion(id) {
    const version = state.versions.find(v => v.id === id);
    if (!version) {
        showToast('ไม่พบเวอร์ชันที่เลือก', 'error');
        return;
    }

    state.currentVersion = version;
    elements.versionSelect.value = id;
    elements.versionName.value = version.name;
    elements.versionDesc.value = version.description || '';
    elements.googleDocContent.value = version.googleDoc || '';
    elements.sheetDataJSON.value = JSON.stringify(version.sheetData || [], null, 2);
    elements.staticContent.value = version.staticInstructions || '';

    renderSheetTable(version.sheetData || []);
    updateTokenCounts();
    switchView('editor');
}

async function duplicateVersion(id) {
    const version = state.versions.find(v => v.id === id);
    if (!version) return;

    const newVersion = {
        name: `${version.name} (สำเนา)`,
        description: version.description,
        googleDoc: version.googleDoc,
        sheetData: version.sheetData,
        staticInstructions: version.staticInstructions
    };

    const saved = await saveVersion(newVersion);
    if (saved) {
        await fetchVersions();
        renderVersionsList();
        updateDashboard();
        updateVersionSelects();
    }
}

async function handleSave() {
    const name = elements.versionName.value.trim();
    if (!name) {
        showToast('กรุณาระบุชื่อเวอร์ชัน', 'warning');
        return;
    }

    let sheetData;
    try {
        sheetData = JSON.parse(elements.sheetDataJSON.value);
    } catch (err) {
        showToast('รูปแบบ JSON ไม่ถูกต้อง', 'error');
        return;
    }

    const versionData = {
        id: state.currentVersion?.id,
        name,
        description: elements.versionDesc.value.trim(),
        googleDoc: elements.googleDocContent.value,
        sheetData,
        staticInstructions: elements.staticContent.value
    };

    const saved = await saveVersion(versionData);
    if (saved) {
        state.currentVersion = saved;
        elements.versionSelect.value = saved.id;
        await fetchVersions();
        renderVersionsList();
        updateDashboard();
        updateVersionSelects();
    }
}

async function handleDelete(id) {
    const version = state.versions.find(v => v.id === id);
    if (!version) return;

    showModal(
        'ยืนยันการลบ',
        `<p>คุณต้องการลบเวอร์ชัน "<strong>${version.name}</strong>" หรือไม่?</p>
     <p style="color: var(--danger); margin-top: 8px;">การกระทำนี้ไม่สามารถย้อนกลับได้</p>`,
        async () => {
            const deleted = await deleteVersion(id);
            if (deleted) {
                await fetchVersions();
                renderVersionsList();
                updateDashboard();
                updateVersionSelects();
            }
        },
        'ลบเวอร์ชัน'
    );
}

async function handleActivate(id) {
    const activated = await activateVersion(id);
    if (activated) {
        await fetchVersions();
        renderVersionsList();
        updateDashboard();
        updateVersionSelects();
    }
}

async function handleBuild() {
    const selectedId = elements.previewVersionSelect.value;
    const format = elements.formatSelect.value;

    let versionData;
    if (selectedId === 'default') {
        versionData = {
            googleDoc: state.defaultData.googleDoc,
            sheetData: state.defaultData.sheetData,
            staticInstructions: state.defaultData.staticInstructions
        };
    } else {
        const version = state.versions.find(v => v.id === selectedId);
        if (!version) {
            showToast('ไม่พบเวอร์ชันที่เลือก', 'error');
            return;
        }
        versionData = version;
    }

    const result = await buildInstructions(versionData, format);
    if (result) {
        elements.outputPreview.textContent = result.instructions;
        elements.previewTotalTokens.textContent = formatNumber(result.stats.estimatedTokens);
        elements.previewGoogleDocTokens.textContent = formatNumber(result.stats.googleDocTokens);
        elements.previewSheetTokens.textContent = formatNumber(result.stats.sheetDataTokens);
        elements.previewCost.textContent = `$${(result.stats.estimatedTokens / 1000 * 0.00015).toFixed(6)}`;
    }
}

function exportVersion(id) {
    window.open(`/api/versions/${id}/export`, '_blank');
}

function toggleTableJsonView() {
    state.isTableView = !state.isTableView;

    document.getElementById('tableViewContainer').classList.toggle('active', state.isTableView);
    document.getElementById('jsonViewContainer').classList.toggle('active', !state.isTableView);

    if (state.isTableView) {
        try {
            const data = JSON.parse(elements.sheetDataJSON.value);
            renderSheetTable(data);
        } catch (err) {
            showToast('รูปแบบ JSON ไม่ถูกต้อง', 'error');
        }
    }
}

function addTableRow() {
    try {
        const data = JSON.parse(elements.sheetDataJSON.value);
        const headers = data.length > 0 ? Object.keys(data[0]) : ['ขั้นตอนการพูดคุย/กฏการพูดคุย', 'รายละเอียด'];

        const newRow = {};
        headers.forEach(h => newRow[h] = '');
        data.push(newRow);

        elements.sheetDataJSON.value = JSON.stringify(data, null, 2);
        renderSheetTable(data);
        updateTokenCounts();
    } catch (err) {
        showToast('ไม่สามารถเพิ่มแถวได้', 'error');
    }
}

function removeTableRow(index) {
    try {
        const data = JSON.parse(elements.sheetDataJSON.value);
        data.splice(index, 1);
        elements.sheetDataJSON.value = JSON.stringify(data, null, 2);
        renderSheetTable(data);
        updateTokenCounts();
    } catch (err) {
        showToast('ไม่สามารถลบแถวได้', 'error');
    }
}

function copyOutput() {
    navigator.clipboard.writeText(elements.outputPreview.textContent)
        .then(() => showToast('คัดลอกแล้ว', 'success'))
        .catch(() => showToast('ไม่สามารถคัดลอกได้', 'error'));
}

function downloadOutput() {
    const blob = new Blob([elements.outputPreview.textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'instruction-output.txt';
    a.click();
    URL.revokeObjectURL(url);
}

async function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            const res = await fetch('/api/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: text
            });

            if (res.ok) {
                showToast('นำเข้าเวอร์ชันสำเร็จ', 'success');
                await fetchVersions();
                renderVersionsList();
                updateDashboard();
                updateVersionSelects();
            }
        } catch (err) {
            showToast('ไม่สามารถนำเข้าไฟล์ได้', 'error');
        }
    };
    input.click();
}

// Make functions global
window.editVersion = editVersion;
window.duplicateVersion = duplicateVersion;
window.handleActivate = handleActivate;
window.handleDelete = handleDelete;
window.exportVersion = exportVersion;
window.removeTableRow = removeTableRow;
window.createNewVersion = createNewVersion;

// ====================== Event Listeners ======================
document.addEventListener('DOMContentLoaded', async () => {
    // Initial data load
    await Promise.all([fetchDefault(), fetchVersions()]);
    updateDashboard();
    renderVersionsList();
    updateVersionSelects();

    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view));
    });

    // Dashboard buttons
    document.getElementById('viewDefaultBtn').addEventListener('click', async () => {
        if (!state.defaultData) await fetchDefault();
        showModal(
            '📌 ค่าเริ่มต้น (จาก Google)',
            `<div style="max-height: 400px; overflow: auto;">
        <h4 style="margin-bottom: 8px;">Google Doc:</h4>
        <pre style="background: var(--bg-darker); padding: 12px; border-radius: 8px; font-size: 12px; white-space: pre-wrap;">${state.defaultData?.googleDoc || 'ไม่มีข้อมูล'}</pre>
        <h4 style="margin: 16px 0 8px;">Sheet Data (${state.defaultData?.sheetData?.length || 0} rows):</h4>
        <pre style="background: var(--bg-darker); padding: 12px; border-radius: 8px; font-size: 12px; max-height: 200px; overflow: auto;">${JSON.stringify(state.defaultData?.sheetData, null, 2) || '[]'}</pre>
      </div>`,
            () => { },
            'ปิด'
        );
    });

    document.getElementById('duplicateDefaultBtn').addEventListener('click', () => createNewVersion(true));
    document.getElementById('refreshDefaultBtn').addEventListener('click', async () => {
        showToast('กำลังรีเฟรชจาก Google...', 'info');
        await fetchDefault();
        updateDashboard();
        showToast('รีเฟรชสำเร็จ', 'success');
    });

    document.getElementById('newVersionBtn').addEventListener('click', () => createNewVersion(false));
    document.getElementById('importBtn').addEventListener('click', handleImport);

    // Search versions
    elements.searchVersions.addEventListener('input', renderVersionsList);

    // Editor
    elements.versionSelect.addEventListener('change', (e) => {
        if (e.target.value) {
            editVersion(e.target.value);
        } else {
            createNewVersion(false);
        }
    });

    document.getElementById('saveVersionBtn').addEventListener('click', handleSave);
    document.getElementById('toggleTableView').addEventListener('click', toggleTableJsonView);
    document.getElementById('addRowBtn').addEventListener('click', addTableRow);

    // Token count updates
    elements.googleDocContent.addEventListener('input', updateTokenCounts);
    elements.sheetDataJSON.addEventListener('input', updateTokenCounts);
    elements.staticContent.addEventListener('input', updateTokenCounts);

    // Preview
    document.getElementById('buildBtn').addEventListener('click', handleBuild);
    document.getElementById('copyOutputBtn').addEventListener('click', copyOutput);
    document.getElementById('downloadOutputBtn').addEventListener('click', downloadOutput);

    // Modal
    elements.modalClose.addEventListener('click', hideModal);
    elements.modalCancel.addEventListener('click', hideModal);
    elements.modalOverlay.addEventListener('click', (e) => {
        if (e.target === elements.modalOverlay) hideModal();
    });

    // Collapsible headers
    document.querySelectorAll('.collapsible').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.dataset.target;
            const target = document.getElementById(targetId);
            target.style.display = target.style.display === 'none' ? 'block' : 'none';
        });
    });
});
