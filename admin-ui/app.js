const state = {
  defaultData: null,
  versions: [],
  followups: [],
  images: [],
  sheetEditors: {
    default: createSheetEditorState(),
    version: createSheetEditorState(),
  },
  drafts: {
    default: {
      dirty: false,
      timer: null,
      lastSavedAt: null,
    },
    version: {
      dirty: false,
      timer: null,
      lastSavedAt: null,
    },
  },
  cellEditor: {
    open: false,
    editorKey: null,
    rowIndex: -1,
    colIndex: -1,
  },
  isHydrating: false,
};

const views = {
  dashboard: {
    title: "Dashboard",
    subtitle: "ภาพรวมระบบหลังบ้าน",
  },
  default: {
    title: "Default Instruction",
    subtitle: "จัดการค่าเริ่มต้นจากฐานข้อมูล",
  },
  versions: {
    title: "Versions",
    subtitle: "จัดการเวอร์ชัน instruction",
  },
  build: {
    title: "Build / Preview",
    subtitle: "ตรวจผลลัพธ์สุดท้ายก่อนใช้งานจริง",
  },
  followups: {
    title: "Follow-up Rules",
    subtitle: "แก้ไขกฎติดตามลูกค้าแบบ DB-first",
  },
  images: {
    title: "Images",
    subtitle: "จัดการรูปภาพสำหรับ token [IMG:key]",
  },
};

const formScopeConfigs = {
  default: {
    dirtyChip: "defaultDirtyChip",
    storageKey: "thaya_admin_draft_default_v1",
  },
  version: {
    dirtyChip: "versionDirtyChip",
    storageKey: "thaya_admin_draft_version_v1",
  },
};

const sheetEditorConfigs = {
  default: {
    modeTableBtn: "defaultSheetModeTable",
    modeJsonBtn: "defaultSheetModeJson",
    tablePanel: "defaultSheetTablePanel",
    jsonPanel: "defaultSheetJsonPanel",
    head: "defaultSheetHead",
    body: "defaultSheetBody",
    jsonInput: "defaultSheetJson",
    addColumnBtn: "defaultSheetAddColumn",
    addRowBtn: "defaultSheetAddRow",
    pasteBtn: "defaultSheetPasteTable",
    syncToJsonBtn: "defaultSheetSyncToJson",
    syncFromJsonBtn: "defaultSheetSyncFromJson",
    exportJsonBtn: "defaultSheetExportJson",
    clearBtn: "defaultSheetClear",
    filterInput: "defaultSheetFilterInput",
    pageSizeSelect: "defaultSheetPageSize",
    prevPageBtn: "defaultSheetPrevPage",
    nextPageBtn: "defaultSheetNextPage",
    pageLabel: "defaultSheetPageLabel",
    paginationInfo: "defaultSheetPaginationInfo",
    stats: "defaultSheetStats",
    empty: "defaultSheetEmpty",
  },
  version: {
    modeTableBtn: "versionSheetModeTable",
    modeJsonBtn: "versionSheetModeJson",
    tablePanel: "versionSheetTablePanel",
    jsonPanel: "versionSheetJsonPanel",
    head: "versionSheetHead",
    body: "versionSheetBody",
    jsonInput: "versionSheetJson",
    addColumnBtn: "versionSheetAddColumn",
    addRowBtn: "versionSheetAddRow",
    pasteBtn: "versionSheetPasteTable",
    syncToJsonBtn: "versionSheetSyncToJson",
    syncFromJsonBtn: "versionSheetSyncFromJson",
    exportJsonBtn: "versionSheetExportJson",
    clearBtn: "versionSheetClear",
    filterInput: "versionSheetFilterInput",
    pageSizeSelect: "versionSheetPageSize",
    prevPageBtn: "versionSheetPrevPage",
    nextPageBtn: "versionSheetNextPage",
    pageLabel: "versionSheetPageLabel",
    paginationInfo: "versionSheetPaginationInfo",
    stats: "versionSheetStats",
    empty: "versionSheetEmpty",
  },
};

function qs(id) {
  return document.getElementById(id);
}

function createSheetEditorState() {
  return {
    columns: [],
    rows: [],
    mode: "table",
    tableFilter: "",
    page: 1,
    pageSize: 25,
    jsonSyncTimer: null,
  };
}

function withHydration(task) {
  state.isHydrating = true;
  try {
    task();
  } finally {
    state.isHydrating = false;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  qs("toastStack").appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") || "";
  let data = null;
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  if (!res.ok) {
    const msg = data && data.error ? data.error : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

function switchView(viewId) {
  document.querySelectorAll(".menu-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === viewId);
  });
  document.querySelectorAll(".view").forEach((el) => {
    el.classList.toggle("active", el.id === `${viewId}View`);
  });
  qs("viewTitle").textContent = views[viewId].title;
  qs("viewSubtitle").textContent = views[viewId].subtitle;
}

function getActiveViewId() {
  const active = document.querySelector(".view.active");
  if (!active) return "";
  return active.id.replace(/View$/, "");
}

function updateDashboard() {
  const activeVersion = state.versions.find((v) => v.isActive);
  qs("activeDefaultName").textContent = state.defaultData?.name || "default";
  qs("activeVersionName").textContent = activeVersion ? activeVersion.name : "-";
  qs("totalVersionsCount").textContent = String(state.versions.length);
  qs("followupCount").textContent = String(state.followups.length);
  qs("imageCount").textContent = String(state.images.length);
  qs("defaultSourceChip").textContent = `Source: ${state.defaultData?.source || "unknown"}`;
}

function normalizeCellValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch (err) {
    return String(value);
  }
}

function parseSheetJsonText(text) {
  let parsed = [];
  try {
    parsed = JSON.parse(text || "[]");
  } catch (err) {
    throw new Error(`JSON ไม่ถูกต้อง: ${err.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Sheet Data ต้องเป็น JSON array เท่านั้น");
  }

  for (let i = 0; i < parsed.length; i += 1) {
    const row = parsed[i];
    const validObject = row && typeof row === "object" && !Array.isArray(row);
    if (!validObject) {
      throw new Error(`ข้อมูลแถวที่ ${i + 1} ต้องเป็น object เช่น { \"key\": \"value\" }`);
    }
  }

  return parsed;
}

function makeUniqueColumnName(rawName, existingColumns, skipIndex = -1) {
  const base = String(rawName || "").trim();
  if (!base) return "";

  const used = existingColumns
    .map((name, idx) => (idx === skipIndex ? "" : String(name || "").trim()))
    .filter(Boolean);

  if (!used.includes(base)) return base;

  let suffix = 2;
  let candidate = `${base}_${suffix}`;
  while (used.includes(candidate)) {
    suffix += 1;
    candidate = `${base}_${suffix}`;
  }
  return candidate;
}

function buildTableModelFromSheetData(sheetData) {
  const rows = Array.isArray(sheetData) ? sheetData : [];
  const columns = [];

  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      if (!columns.includes(key)) {
        columns.push(key);
      }
    });
  });

  const normalizedRows = rows.map((row) => {
    const nextRow = {};
    columns.forEach((column) => {
      nextRow[column] = normalizeCellValue(row?.[column]);
    });
    return nextRow;
  });

  return { columns, rows: normalizedRows };
}

function sheetEditorToArray(editorKey) {
  const editor = state.sheetEditors[editorKey];
  return editor.rows.map((row) => {
    const obj = {};
    editor.columns.forEach((column) => {
      obj[column] = normalizeCellValue(row?.[column]);
    });
    return obj;
  });
}

function getCellText(editorKey, rowIndex, colIndex) {
  const editor = state.sheetEditors[editorKey];
  const row = editor.rows[rowIndex];
  const column = editor.columns[colIndex];
  if (!row || !column) return "";
  return normalizeCellValue(row[column]);
}

function setCellText(editorKey, rowIndex, colIndex, value) {
  const editor = state.sheetEditors[editorKey];
  const row = editor.rows[rowIndex];
  const column = editor.columns[colIndex];
  if (!row || !column) return;
  row[column] = normalizeCellValue(value);
}

function getFilteredRowIndexes(editorKey) {
  const editor = state.sheetEditors[editorKey];
  const query = String(editor.tableFilter || "").trim().toLowerCase();

  if (!query) {
    return editor.rows.map((_, index) => index);
  }

  const indexes = [];
  editor.rows.forEach((row, rowIndex) => {
    const matched = editor.columns.some((column) => {
      return normalizeCellValue(row[column]).toLowerCase().includes(query);
    });
    if (matched) {
      indexes.push(rowIndex);
    }
  });
  return indexes;
}

function ensureValidSheetPage(editorKey, filteredCount) {
  const editor = state.sheetEditors[editorKey];
  const safePageSize = Math.max(1, Number(editor.pageSize || 25));
  const totalPages = Math.max(1, Math.ceil(filteredCount / safePageSize));
  editor.page = Math.min(Math.max(1, editor.page), totalPages);
  return totalPages;
}

function getVisibleRowIndexes(editorKey) {
  const editor = state.sheetEditors[editorKey];
  const filteredIndexes = getFilteredRowIndexes(editorKey);
  const totalPages = ensureValidSheetPage(editorKey, filteredIndexes.length);
  const safePageSize = Math.max(1, Number(editor.pageSize || 25));
  const start = (editor.page - 1) * safePageSize;
  const end = start + safePageSize;

  return {
    filteredIndexes,
    visibleIndexes: filteredIndexes.slice(start, end),
    totalPages,
  };
}

function updateSheetPaginationControls(editorKey, context) {
  const config = sheetEditorConfigs[editorKey];
  const editor = state.sheetEditors[editorKey];
  const totalRows = editor.rows.length;
  const filteredRows = context.filteredIndexes.length;
  const safePageSize = Math.max(1, Number(editor.pageSize || 25));
  const start = filteredRows === 0 ? 0 : (editor.page - 1) * safePageSize + 1;
  const end = Math.min(filteredRows, editor.page * safePageSize);

  qs(config.paginationInfo).textContent = `${start}-${end} / ${filteredRows} (ทั้งหมด ${totalRows})`;
  qs(config.pageLabel).textContent = `หน้า ${editor.page} / ${context.totalPages}`;
  qs(config.prevPageBtn).disabled = editor.page <= 1;
  qs(config.nextPageBtn).disabled = editor.page >= context.totalPages;
  qs(config.pageSizeSelect).value = String(safePageSize);
}

function flushJsonSync(editorKey) {
  const editor = state.sheetEditors[editorKey];
  if (editor.jsonSyncTimer) {
    clearTimeout(editor.jsonSyncTimer);
    editor.jsonSyncTimer = null;
  }
  syncTableToJson(editorKey);
}

function setSheetFilter(editorKey, value) {
  const editor = state.sheetEditors[editorKey];
  editor.tableFilter = String(value || "").trim();
  editor.page = 1;
  renderSheetEditor(editorKey);
}

function setSheetPageSize(editorKey, value) {
  const editor = state.sheetEditors[editorKey];
  const parsed = Number.parseInt(value, 10);
  editor.pageSize = Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
  editor.page = 1;
  renderSheetEditor(editorKey);
}

function changeSheetPage(editorKey, delta) {
  const editor = state.sheetEditors[editorKey];
  editor.page = Math.max(1, editor.page + delta);
  renderSheetEditor(editorKey);
}

function touchScope(scope) {
  if (state.isHydrating) return;
  markScopeDirty(scope, true);
  scheduleDraftSave(scope);
}

function updateDirtyChip(scope) {
  const config = formScopeConfigs[scope];
  const chip = qs(config.dirtyChip);
  if (!chip) return;

  if (state.drafts[scope].dirty) {
    chip.textContent = "ยังไม่บันทึก";
    chip.classList.remove("ok");
    chip.classList.add("warn");
  } else {
    chip.textContent = "บันทึกแล้ว";
    chip.classList.remove("warn");
    chip.classList.add("ok");
  }

  if (state.drafts[scope].lastSavedAt) {
    chip.title = `Draft ล่าสุด ${formatDate(state.drafts[scope].lastSavedAt)}`;
  } else {
    chip.removeAttribute("title");
  }
}

function markScopeDirty(scope, dirty) {
  state.drafts[scope].dirty = Boolean(dirty);
  if (!dirty && state.drafts[scope].timer) {
    clearTimeout(state.drafts[scope].timer);
    state.drafts[scope].timer = null;
  }
  updateDirtyChip(scope);
}

function captureEditorSnapshot(editorKey) {
  const config = sheetEditorConfigs[editorKey];
  const editor = state.sheetEditors[editorKey];
  return {
    mode: editor.mode,
    tableFilter: editor.tableFilter,
    page: editor.page,
    pageSize: editor.pageSize,
    tableData: sheetEditorToArray(editorKey),
    jsonText: qs(config.jsonInput).value,
  };
}

function getScopeSnapshot(scope) {
  if (scope === "default") {
    return {
      name: qs("defaultName").value,
      description: qs("defaultDesc").value,
      source: qs("defaultSource").value,
      googleDoc: qs("defaultGoogleDoc").value,
      staticInstructions: qs("defaultStatic").value,
      editor: captureEditorSnapshot("default"),
    };
  }

  return {
    id: qs("versionId").value,
    name: qs("versionName").value,
    description: qs("versionDesc").value,
    googleDoc: qs("versionGoogleDoc").value,
    staticInstructions: qs("versionStatic").value,
    editor: captureEditorSnapshot("version"),
  };
}

function applyEditorSnapshot(editorKey, snapshot) {
  const config = sheetEditorConfigs[editorKey];
  const editor = state.sheetEditors[editorKey];
  const tableData = Array.isArray(snapshot?.tableData) ? snapshot.tableData : [];
  const parsedPage = Number.parseInt(snapshot?.page, 10);
  const parsedPageSize = Number.parseInt(snapshot?.pageSize, 10);
  setSheetEditorData(editorKey, tableData);
  editor.tableFilter = typeof snapshot?.tableFilter === "string" ? snapshot.tableFilter : "";
  editor.page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
  editor.pageSize = Number.isFinite(parsedPageSize) ? Math.max(1, parsedPageSize) : 25;

  if (snapshot?.mode === "json") {
    editor.mode = "json";
    renderSheetEditor(editorKey);
    if (typeof snapshot.jsonText === "string") {
      qs(config.jsonInput).value = snapshot.jsonText;
    }
  } else {
    renderSheetEditor(editorKey);
  }
}

function applyScopeSnapshot(scope, snapshot) {
  withHydration(() => {
    if (scope === "default") {
      qs("defaultName").value = snapshot?.name || "Default Instruction";
      qs("defaultDesc").value = snapshot?.description || "";
      qs("defaultSource").value = snapshot?.source || "manual";
      qs("defaultGoogleDoc").value = snapshot?.googleDoc || "";
      qs("defaultStatic").value = snapshot?.staticInstructions || "";
      applyEditorSnapshot("default", snapshot?.editor || {});
      return;
    }

    qs("versionId").value = snapshot?.id || "";
    qs("versionName").value = snapshot?.name || "";
    qs("versionDesc").value = snapshot?.description || "";
    qs("versionGoogleDoc").value = snapshot?.googleDoc || "";
    qs("versionStatic").value = snapshot?.staticInstructions || "";
    applyEditorSnapshot("version", snapshot?.editor || {});
  });
}

function scheduleDraftSave(scope) {
  const draft = state.drafts[scope];
  if (draft.timer) {
    clearTimeout(draft.timer);
  }

  draft.timer = setTimeout(() => {
    saveDraft(scope);
  }, 650);
}

function saveDraft(scope) {
  try {
    const config = formScopeConfigs[scope];
    const payload = {
      updatedAt: new Date().toISOString(),
      data: getScopeSnapshot(scope),
    };

    window.localStorage.setItem(config.storageKey, JSON.stringify(payload));
    state.drafts[scope].lastSavedAt = payload.updatedAt;
    updateDirtyChip(scope);
  } catch (err) {
    console.warn(`saveDraft(${scope}) failed`, err);
  }
}

function clearDraft(scope) {
  try {
    const config = formScopeConfigs[scope];
    window.localStorage.removeItem(config.storageKey);
  } catch (err) {
    console.warn(`clearDraft(${scope}) failed`, err);
  }
  state.drafts[scope].lastSavedAt = null;
  markScopeDirty(scope, false);
}

function hasDirtyForms() {
  return state.drafts.default.dirty || state.drafts.version.dirty;
}

function confirmDiscard(scope, actionLabel) {
  if (!state.drafts[scope].dirty) return true;
  return window.confirm(`มีข้อมูล ${scope === "default" ? "Default" : "Version"} ที่ยังไม่บันทึก ต้องการ${actionLabel}หรือไม่?`);
}

function tryRestoreDraft(scope) {
  try {
    const config = formScopeConfigs[scope];
    const raw = window.localStorage.getItem(config.storageKey);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data) return;

    const updatedAtText = formatDate(parsed.updatedAt);
    const confirmed = window.confirm(
      `พบ Draft ของ${scope === "default" ? " Default" : " Version"} (ล่าสุด ${updatedAtText})\nต้องการกู้คืนหรือไม่?`
    );

    if (!confirmed) return;

    applyScopeSnapshot(scope, parsed.data);
    state.drafts[scope].lastSavedAt = parsed.updatedAt || null;
    markScopeDirty(scope, true);
    showToast(`กู้คืน Draft ${scope === "default" ? "Default" : "Version"} แล้ว`, "ok");
  } catch (err) {
    console.warn(`tryRestoreDraft(${scope}) failed`, err);
  }
}

function detectDelimiter(line) {
  const tabCount = (line.match(/\t/g) || []).length;
  if (tabCount > 0) return "\t";

  const semicolonCount = (line.match(/;/g) || []).length;
  const commaCount = (line.match(/,/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseDelimitedLine(line, delimiter) {
  if (delimiter === "\t") {
    return String(line || "").split("\t").map((value) => value.trim());
  }

  const values = [];
  let current = "";
  let inQuotes = false;

  const raw = String(line || "");
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];

    if (char === '"') {
      const next = raw[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseTabularText(text) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("ไม่พบข้อมูลในคลิปบอร์ด");
  }

  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = parseDelimitedLine(lines[0], delimiter);

  if (rawHeaders.length === 0) {
    throw new Error("ไม่พบหัวตาราง");
  }

  const headers = [];
  rawHeaders.forEach((header, index) => {
    const fallback = `column_${index + 1}`;
    const normalized = makeUniqueColumnName(header || fallback, headers);
    headers.push(normalized || fallback);
  });

  const result = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseDelimitedLine(lines[i], delimiter);
    const nonEmpty = values.some((value) => String(value || "").trim() !== "");
    if (!nonEmpty) continue;

    const row = {};
    headers.forEach((header, colIndex) => {
      row[header] = normalizeCellValue(values[colIndex] ?? "");
    });

    result.push(row);
  }

  return result;
}

function downloadJSONFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderSheetEditor(editorKey) {
  const config = sheetEditorConfigs[editorKey];
  const editor = state.sheetEditors[editorKey];

  qs(config.modeTableBtn).classList.toggle("active", editor.mode === "table");
  qs(config.modeJsonBtn).classList.toggle("active", editor.mode === "json");
  qs(config.tablePanel).classList.toggle("active", editor.mode === "table");
  qs(config.jsonPanel).classList.toggle("active", editor.mode === "json");

  qs(config.stats).textContent = `${editor.columns.length} คอลัมน์ • ${editor.rows.length} แถว`;
  qs(config.filterInput).value = editor.tableFilter;

  const emptyEl = qs(config.empty);
  if (editor.columns.length === 0) {
    emptyEl.classList.remove("hidden");
    qs(config.head).innerHTML = "";
    qs(config.body).innerHTML = "";
    updateSheetPaginationControls(editorKey, {
      filteredIndexes: [],
      totalPages: 1,
    });
    return;
  }

  emptyEl.classList.add("hidden");

  const headerCells = editor.columns
    .map((column, colIndex) => {
      return `
        <th>
          <div class="sheet-col-head">
            <input
              class="sheet-col-name"
              data-role="column-name"
              data-col-index="${colIndex}"
              value="${escapeHtml(column)}"
            >
            <button class="sheet-action-btn danger" data-role="remove-column" data-col-index="${colIndex}" type="button">ลบ</button>
          </div>
        </th>
      `;
    })
    .join("");

  qs(config.head).innerHTML = `
    <tr>
      <th class="row-index-head">#</th>
      ${headerCells}
      <th>จัดการ</th>
    </tr>
  `;

  const viewport = getVisibleRowIndexes(editorKey);
  updateSheetPaginationControls(editorKey, viewport);

  if (editor.rows.length === 0) {
    qs(config.body).innerHTML = `<tr><td colspan="${editor.columns.length + 2}">ยังไม่มีข้อมูล กด \"+ แถว\" เพื่อเพิ่มข้อมูล</td></tr>`;
    return;
  }

  if (viewport.visibleIndexes.length === 0) {
    qs(config.body).innerHTML = `<tr><td colspan="${editor.columns.length + 2}">ไม่พบข้อมูลตามคำค้นหา</td></tr>`;
    return;
  }

  const bodyRows = viewport.visibleIndexes
    .map((rowIndex) => {
      const row = editor.rows[rowIndex];
      const cells = editor.columns
        .map((column, colIndex) => {
          const value = normalizeCellValue(row[column]);
          const hasText = value.trim().length > 0;
          return `
            <td>
              <button
                class="sheet-cell-preview"
                data-role="open-cell-editor"
                data-row-index="${rowIndex}"
                data-col-index="${colIndex}"
                type="button"
                title="คลิกเพื่อแก้ไขแบบหลายบรรทัด"
              >
                <div class="sheet-cell-lines ${hasText ? "" : "empty"}">${hasText ? escapeHtml(value) : "(ว่าง)"}</div>
              </button>
            </td>
          `;
        })
        .join("");

      return `
        <tr data-row-index="${rowIndex}">
          <td class="sheet-row-index">${rowIndex + 1}</td>
          ${cells}
          <td>
            <div class="sheet-row-actions">
              <button class="sheet-action-btn" data-role="duplicate-row" data-row-index="${rowIndex}" type="button">ซ้ำ</button>
              <button class="sheet-action-btn danger" data-role="remove-row" data-row-index="${rowIndex}" type="button">ลบ</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  qs(config.body).innerHTML = bodyRows;
}

function setSheetEditorMode(editorKey, mode) {
  const editor = state.sheetEditors[editorKey];
  if (mode !== "table" && mode !== "json") return;

  editor.mode = mode;
  if (mode === "json") {
    flushJsonSync(editorKey);
  }
  renderSheetEditor(editorKey);
}

function syncTableToJson(editorKey, showSuccess = false) {
  const config = sheetEditorConfigs[editorKey];
  const data = sheetEditorToArray(editorKey);
  qs(config.jsonInput).value = JSON.stringify(data, null, 2);
  if (showSuccess) {
    showToast("อัปเดต JSON จากตารางแล้ว", "ok");
  }
}

function setSheetEditorData(editorKey, sheetData, preserveMode = false) {
  const editor = state.sheetEditors[editorKey];
  const mode = preserveMode ? editor.mode : "table";

  const model = buildTableModelFromSheetData(sheetData);
  editor.columns = model.columns;
  editor.rows = model.rows;
  editor.mode = mode;
  if (!preserveMode) {
    editor.tableFilter = "";
    editor.page = 1;
  } else {
    ensureValidSheetPage(editorKey, getFilteredRowIndexes(editorKey).length);
  }

  flushJsonSync(editorKey);
  renderSheetEditor(editorKey);
}

function applyJsonToEditor(editorKey, showSuccess = false) {
  const config = sheetEditorConfigs[editorKey];
  const parsed = parseSheetJsonText(qs(config.jsonInput).value);
  setSheetEditorData(editorKey, parsed, true);
  touchScope(editorKey);

  if (showSuccess) {
    showToast("นำ JSON เข้า Table สำเร็จ", "ok");
  }
}

function addSheetColumn(editorKey) {
  const editor = state.sheetEditors[editorKey];
  const defaultName = `column_${editor.columns.length + 1}`;
  const rawName = window.prompt("ชื่อคอลัมน์ใหม่", defaultName);
  if (rawName === null) return;

  const normalized = makeUniqueColumnName(rawName, editor.columns);
  if (!normalized) {
    showToast("ชื่อคอลัมน์ห้ามว่าง", "err");
    return;
  }

  editor.columns.push(normalized);
  editor.rows.forEach((row) => {
    row[normalized] = "";
  });

  flushJsonSync(editorKey);
  renderSheetEditor(editorKey);
  touchScope(editorKey);
}

function addSheetRow(editorKey) {
  const editor = state.sheetEditors[editorKey];
  if (editor.columns.length === 0) {
    showToast("เพิ่มคอลัมน์ก่อนเพิ่มแถว", "err");
    return;
  }

  const row = {};
  editor.columns.forEach((column) => {
    row[column] = "";
  });
  editor.rows.push(row);
  editor.page = Math.max(1, Math.ceil(editor.rows.length / Math.max(1, editor.pageSize)));

  flushJsonSync(editorKey);
  renderSheetEditor(editorKey);
  touchScope(editorKey);

  if (editor.tableFilter) {
    showToast("มีตัวกรองอยู่ แถวใหม่อาจไม่แสดงจนกว่าจะล้างคำค้นหา", "info");
  }
}

function duplicateSheetRow(editorKey, rowIndex) {
  const editor = state.sheetEditors[editorKey];
  const row = editor.rows[rowIndex];
  if (!row) return;

  const clone = {};
  editor.columns.forEach((column) => {
    clone[column] = normalizeCellValue(row[column]);
  });

  editor.rows.splice(rowIndex + 1, 0, clone);

  flushJsonSync(editorKey);
  renderSheetEditor(editorKey);
  touchScope(editorKey);
}

function removeSheetRow(editorKey, rowIndex) {
  const editor = state.sheetEditors[editorKey];
  editor.rows = editor.rows.filter((_, idx) => idx !== rowIndex);

  flushJsonSync(editorKey);
  renderSheetEditor(editorKey);
  touchScope(editorKey);
}

function removeSheetColumn(editorKey, colIndex) {
  const editor = state.sheetEditors[editorKey];
  const removed = editor.columns[colIndex];
  if (!removed) return;

  const confirmDelete = window.confirm(`ต้องการลบคอลัมน์ ${removed} หรือไม่?`);
  if (!confirmDelete) return;

  editor.columns = editor.columns.filter((_, idx) => idx !== colIndex);
  editor.rows.forEach((row) => {
    delete row[removed];
  });

  flushJsonSync(editorKey);
  renderSheetEditor(editorKey);
  touchScope(editorKey);
}

function renameSheetColumn(editorKey, colIndex, rawName) {
  const editor = state.sheetEditors[editorKey];
  const oldName = editor.columns[colIndex];
  if (!oldName) return;

  const normalized = makeUniqueColumnName(rawName, editor.columns, colIndex);
  if (!normalized) {
    showToast("ชื่อคอลัมน์ห้ามว่าง", "err");
    renderSheetEditor(editorKey);
    return;
  }

  if (normalized === oldName) {
    renderSheetEditor(editorKey);
    return;
  }

  editor.columns[colIndex] = normalized;
  editor.rows.forEach((row) => {
    row[normalized] = row[oldName] ?? "";
    delete row[oldName];
  });

  flushJsonSync(editorKey);
  renderSheetEditor(editorKey);
  touchScope(editorKey);
}

function updateSheetCell(editorKey, rowIndex, colIndex, value) {
  setCellText(editorKey, rowIndex, colIndex, value);
  flushJsonSync(editorKey);
  touchScope(editorKey);
}

function updateCellEditorMeta() {
  const text = qs("cellEditorTextarea").value || "";
  const lines = text.length === 0 ? 1 : text.split("\n").length;
  qs("cellEditorMeta").textContent = `ความยาว ${text.length} ตัวอักษร • ${lines} บรรทัด • ใช้ Ctrl/Cmd + Enter เพื่อบันทึก`;
}

function openCellEditor(editorKey, rowIndex, colIndex) {
  const editor = state.sheetEditors[editorKey];
  const column = editor.columns[colIndex];
  if (!column) return;

  state.cellEditor.open = true;
  state.cellEditor.editorKey = editorKey;
  state.cellEditor.rowIndex = rowIndex;
  state.cellEditor.colIndex = colIndex;

  qs("cellEditorTitle").textContent = `${editorKey === "default" ? "Default" : "Version"} • แถว ${rowIndex + 1} • คอลัมน์ ${column}`;
  qs("cellEditorTextarea").value = getCellText(editorKey, rowIndex, colIndex);
  updateCellEditorMeta();
  qs("cellEditorModal").hidden = false;
  qs("cellEditorTextarea").focus();
}

function closeCellEditor() {
  state.cellEditor.open = false;
  state.cellEditor.editorKey = null;
  state.cellEditor.rowIndex = -1;
  state.cellEditor.colIndex = -1;
  qs("cellEditorModal").hidden = true;
}

function saveCellEditor() {
  if (!state.cellEditor.open) return;

  const { editorKey, rowIndex, colIndex } = state.cellEditor;
  updateSheetCell(editorKey, rowIndex, colIndex, qs("cellEditorTextarea").value);
  renderSheetEditor(editorKey);
  closeCellEditor();
}

async function pasteSheetFromClipboard(editorKey) {
  let rawText = "";

  try {
    rawText = await navigator.clipboard.readText();
  } catch (err) {
    rawText = window.prompt("วางข้อมูลตาราง (CSV/TSV) โดยแถวแรกเป็นหัวคอลัมน์", "") || "";
  }

  if (!rawText.trim()) {
    showToast("ไม่พบข้อมูลในคลิปบอร์ด", "err");
    return;
  }

  try {
    const sheetData = parseTabularText(rawText);
    setSheetEditorData(editorKey, sheetData);
    touchScope(editorKey);
    showToast(`นำเข้าจากคลิปบอร์ดแล้ว ${sheetData.length} แถว`, "ok");
  } catch (err) {
    showToast(err.message, "err");
  }
}

function clearSheetData(editorKey) {
  const confirmed = window.confirm("ต้องการล้างตารางทั้งหมดหรือไม่?");
  if (!confirmed) return;

  if (state.cellEditor.open && state.cellEditor.editorKey === editorKey) {
    closeCellEditor();
  }

  setSheetEditorData(editorKey, []);
  touchScope(editorKey);
}

function exportSheetData(editorKey) {
  flushJsonSync(editorKey);
  const data = sheetEditorToArray(editorKey);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  downloadJSONFile(`${editorKey}-sheet-data-${stamp}.json`, data);
  showToast("Export JSON สำเร็จ", "ok");
}

function collectSheetDataForSave(editorKey) {
  const editor = state.sheetEditors[editorKey];
  if (editor.mode === "json") {
    const config = sheetEditorConfigs[editorKey];
    const parsed = parseSheetJsonText(qs(config.jsonInput).value);
    setSheetEditorData(editorKey, parsed, true);
    return parsed;
  }

  const data = sheetEditorToArray(editorKey);
  flushJsonSync(editorKey);
  return data;
}

function loadDefaultToForm() {
  const d = state.defaultData || {};

  withHydration(() => {
    qs("defaultName").value = d.name || "Default Instruction";
    qs("defaultDesc").value = d.description || "";
    qs("defaultSource").value = d.source || "manual";
    qs("defaultGoogleDoc").value = d.googleDoc || "";
    qs("defaultStatic").value = d.staticInstructions || "";
    setSheetEditorData("default", d.sheetData || []);
  });

  markScopeDirty("default", false);
}

function populateVersionFromDefault() {
  if (!state.defaultData) {
    showToast("ยังไม่มี Default ให้คัดลอก", "err");
    return;
  }

  withHydration(() => {
    qs("versionId").value = "";
    qs("versionName").value = `${state.defaultData.name || "Default"} - copy`;
    qs("versionDesc").value = state.defaultData.description || "";
    qs("versionGoogleDoc").value = state.defaultData.googleDoc || "";
    qs("versionStatic").value = state.defaultData.staticInstructions || "";
    setSheetEditorData("version", state.defaultData.sheetData || []);
  });

  touchScope("version");
  showToast("คัดลอกข้อมูลจาก Default มาให้แล้ว", "ok");
}

function getVersionById(id) {
  return state.versions.find((v) => v.id === id) || null;
}

function renderVersions() {
  const search = qs("versionsSearch").value.trim().toLowerCase();
  const list = state.versions.filter((v) => {
    if (!search) return true;
    return (
      String(v.name || "").toLowerCase().includes(search) ||
      String(v.description || "").toLowerCase().includes(search)
    );
  });

  const rows = list
    .map((v) => {
      return `
        <tr>
          <td>${escapeHtml(v.name)}</td>
          <td>${v.isActive ? "Active" : "-"}</td>
          <td>${formatDate(v.updatedAt)}</td>
          <td>
            <div class="tiny-actions">
              <button data-act="edit" data-id="${v.id}" type="button">Edit</button>
              <button data-act="duplicate" data-id="${v.id}" type="button">Duplicate</button>
              <button data-act="activate" data-id="${v.id}" ${v.isActive ? "disabled" : ""} type="button">Activate</button>
              <button data-act="export" data-id="${v.id}" type="button">Export</button>
              <button data-act="delete" data-id="${v.id}" type="button">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  qs("versionsTableBody").innerHTML =
    rows || `<tr><td colspan="4">ไม่พบข้อมูลเวอร์ชัน</td></tr>`;

  const buildSource = qs("buildSource");
  const options = [
    `<option value="default">Default (DB)</option>`,
    ...state.versions.map((v) => `<option value="${v.id}">${escapeHtml(v.name)}</option>`),
  ];
  buildSource.innerHTML = options.join("");
}

function resetVersionForm() {
  withHydration(() => {
    qs("versionId").value = "";
    qs("versionName").value = "";
    qs("versionDesc").value = "";
    qs("versionGoogleDoc").value = "";
    qs("versionStatic").value = "";
    setSheetEditorData("version", []);
  });

  markScopeDirty("version", false);
}

function fillVersionForm(version) {
  withHydration(() => {
    qs("versionId").value = version.id || "";
    qs("versionName").value = version.name || "";
    qs("versionDesc").value = version.description || "";
    qs("versionGoogleDoc").value = version.googleDoc || "";
    qs("versionStatic").value = version.staticInstructions || "";
    setSheetEditorData("version", version.sheetData || []);
  });

  markScopeDirty("version", false);
}

function renderFollowups() {
  const rows = state.followups
    .sort((a, b) => a.stepIndex - b.stepIndex)
    .map((r) => {
      return `
        <tr>
          <td><input type="number" data-role="step" value="${r.stepIndex}"></td>
          <td><input type="number" data-role="delay" value="${r.delayMinutes}"></td>
          <td><textarea data-role="message" rows="2">${escapeHtml(r.message)}</textarea></td>
          <td><input type="checkbox" data-role="active" ${r.isActive ? "checked" : ""}></td>
          <td><button data-role="remove" type="button">ลบ</button></td>
        </tr>
      `;
    })
    .join("");
  qs("followupTableBody").innerHTML = rows || "";
}

function addFollowupRow() {
  const nextStep =
    state.followups.length === 0
      ? 0
      : Math.max(...state.followups.map((r) => Number(r.stepIndex || 0))) + 1;
  state.followups.push({
    id: `new-${Date.now()}`,
    stepIndex: nextStep,
    delayMinutes: 5,
    message: "",
    isActive: true,
  });
  renderFollowups();
}

function collectFollowupRowsFromDom() {
  const rows = [...qs("followupTableBody").querySelectorAll("tr")];
  return rows.map((row) => ({
    stepIndex: Number.parseInt(row.querySelector('[data-role="step"]').value, 10),
    delayMinutes: Number.parseInt(row.querySelector('[data-role="delay"]').value, 10),
    message: row.querySelector('[data-role="message"]').value.trim(),
    isActive: row.querySelector('[data-role="active"]').checked,
  }));
}

function renderImages() {
  const html = state.images
    .map((img) => {
      return `
        <article class="image-card">
          <img src="/api/images/${encodeURIComponent(img.key)}/file" alt="${escapeHtml(img.name || img.key)}">
          <div class="meta">
            <strong>${escapeHtml(img.name || img.key)}</strong>
            <code>[IMG:${escapeHtml(img.key)}]</code>
            <div class="tiny-actions">
              <button data-img-act="copy" data-key="${img.key}" type="button">Copy Token</button>
              <button data-img-act="delete" data-key="${img.key}" type="button">Delete</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  qs("imageGrid").innerHTML = html || `<p>ยังไม่มีรูปภาพ</p>`;
}

async function refreshAll() {
  if (state.cellEditor.open) {
    closeCellEditor();
  }

  const [defaultData, versions, followups, images] = await Promise.all([
    fetchJSON("/api/default"),
    fetchJSON("/api/versions"),
    fetchJSON("/api/followups").catch(() => []),
    fetchJSON("/api/images").catch(() => []),
  ]);

  state.defaultData = defaultData;
  state.versions = Array.isArray(versions) ? versions : [];
  state.followups = Array.isArray(followups) ? followups : [];
  state.images = Array.isArray(images) ? images : [];

  loadDefaultToForm();
  renderVersions();
  renderFollowups();
  renderImages();
  updateDashboard();
}

async function saveDefault() {
  let sheetData = [];
  try {
    sheetData = collectSheetDataForSave("default");
  } catch (err) {
    showToast(err.message, "err");
    return;
  }

  const payload = {
    name: qs("defaultName").value.trim(),
    description: qs("defaultDesc").value.trim(),
    source: qs("defaultSource").value.trim(),
    googleDoc: qs("defaultGoogleDoc").value,
    sheetData,
    staticInstructions: qs("defaultStatic").value,
    isActive: true,
  };

  await fetchJSON("/api/default", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  clearDraft("default");
  showToast("บันทึก Default สำเร็จ", "ok");
  await refreshAll();
}

async function saveVersion() {
  const id = qs("versionId").value.trim();
  const name = qs("versionName").value.trim();
  if (!name) {
    showToast("กรุณาระบุชื่อเวอร์ชัน", "err");
    return;
  }

  let sheetData = [];
  try {
    sheetData = collectSheetDataForSave("version");
  } catch (err) {
    showToast(err.message, "err");
    return;
  }

  const payload = {
    name,
    description: qs("versionDesc").value.trim(),
    googleDoc: qs("versionGoogleDoc").value,
    sheetData,
    staticInstructions: qs("versionStatic").value,
  };

  if (id) {
    await fetchJSON(`/api/versions/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } else {
    const created = await fetchJSON("/api/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    qs("versionId").value = created.id || "";
  }

  clearDraft("version");
  showToast("บันทึกเวอร์ชันสำเร็จ", "ok");
  await refreshAll();
}

async function importVersion() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const text = await file.text();
    await fetchJSON("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: text,
    });
    showToast("Import version สำเร็จ", "ok");
    await refreshAll();
  };
  input.click();
}

async function buildPreview() {
  const source = qs("buildSource").value;
  const format = qs("buildFormat").value;
  const version = source === "default" ? state.defaultData : getVersionById(source);

  if (!version) {
    showToast("ไม่พบ source ที่เลือก", "err");
    return;
  }

  const built = await fetchJSON("/api/build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      googleDoc: version.googleDoc || "",
      sheetData: version.sheetData || [],
      staticInstructions: version.staticInstructions || "",
      format,
    }),
  });

  qs("buildTokens").textContent = String(built?.stats?.estimatedTokens || "-");
  qs("buildCost").textContent = `$${(((built?.stats?.estimatedTokens || 0) / 1000) * 0.00015).toFixed(6)}`;
  qs("buildOutput").textContent = built?.instructions || "";
}

async function saveFollowups() {
  const rows = collectFollowupRowsFromDom();
  if (rows.length === 0) {
    showToast("ไม่มี follow-up rule ให้บันทึก", "err");
    return;
  }

  await fetchJSON("/api/followups", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules: rows }),
  });

  showToast("บันทึก Follow-up สำเร็จ", "ok");
  await refreshAll();
}

async function uploadImage() {
  const fileInput = qs("imageFile");
  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    showToast("กรุณาเลือกไฟล์รูป", "err");
    return;
  }

  const key = qs("imageKey").value.trim();
  if (!key) {
    showToast("กรุณาระบุ key รูป", "err");
    return;
  }

  const name = qs("imageName").value.trim() || key;
  const category = qs("imageCategory").value.trim() || "general";

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Read file failed"));
    reader.readAsDataURL(file);
  });

  await fetchJSON("/api/images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, key, name, category }),
  });

  fileInput.value = "";
  qs("imageName").value = "";
  showToast("อัปโหลดรูปสำเร็จ", "ok");

  state.images = await fetchJSON("/api/images");
  renderImages();
  updateDashboard();
}

function bindScopeDirtyTracking() {
  ["defaultName", "defaultDesc", "defaultGoogleDoc", "defaultStatic"].forEach((id) => {
    qs(id).addEventListener("input", () => touchScope("default"));
  });
  qs("defaultSource").addEventListener("change", () => touchScope("default"));

  ["versionName", "versionDesc", "versionGoogleDoc", "versionStatic"].forEach((id) => {
    qs(id).addEventListener("input", () => touchScope("version"));
  });
}

function bindSheetEditorEvents(editorKey) {
  const config = sheetEditorConfigs[editorKey];

  qs(config.modeTableBtn).addEventListener("click", () => setSheetEditorMode(editorKey, "table"));
  qs(config.modeJsonBtn).addEventListener("click", () => setSheetEditorMode(editorKey, "json"));

  qs(config.addColumnBtn).addEventListener("click", () => addSheetColumn(editorKey));
  qs(config.addRowBtn).addEventListener("click", () => addSheetRow(editorKey));
  qs(config.pasteBtn).addEventListener("click", () => pasteSheetFromClipboard(editorKey));

  qs(config.syncToJsonBtn).addEventListener("click", () => {
    syncTableToJson(editorKey, true);
    setSheetEditorMode(editorKey, "json");
  });

  qs(config.syncFromJsonBtn).addEventListener("click", () => {
    try {
      applyJsonToEditor(editorKey, true);
    } catch (err) {
      showToast(err.message, "err");
    }
  });

  qs(config.exportJsonBtn).addEventListener("click", () => exportSheetData(editorKey));
  qs(config.clearBtn).addEventListener("click", () => clearSheetData(editorKey));
  qs(config.filterInput).addEventListener("input", (event) => setSheetFilter(editorKey, event.target.value));
  qs(config.pageSizeSelect).addEventListener("change", (event) => setSheetPageSize(editorKey, event.target.value));
  qs(config.prevPageBtn).addEventListener("click", () => changeSheetPage(editorKey, -1));
  qs(config.nextPageBtn).addEventListener("click", () => changeSheetPage(editorKey, 1));

  qs(config.jsonInput).addEventListener("input", () => touchScope(editorKey));

  qs(config.head).addEventListener("change", (event) => {
    const target = event.target.closest('[data-role="column-name"]');
    if (!target) return;
    const colIndex = Number.parseInt(target.dataset.colIndex, 10);
    renameSheetColumn(editorKey, colIndex, target.value);
  });

  qs(config.head).addEventListener("click", (event) => {
    const target = event.target.closest('button[data-role="remove-column"]');
    if (!target) return;
    const colIndex = Number.parseInt(target.dataset.colIndex, 10);
    removeSheetColumn(editorKey, colIndex);
  });

  qs(config.body).addEventListener("click", (event) => {
    const openCellBtn = event.target.closest('button[data-role="open-cell-editor"]');
    if (openCellBtn) {
      const rowIndex = Number.parseInt(openCellBtn.dataset.rowIndex, 10);
      const colIndex = Number.parseInt(openCellBtn.dataset.colIndex, 10);
      openCellEditor(editorKey, rowIndex, colIndex);
      return;
    }

    const duplicateBtn = event.target.closest('button[data-role="duplicate-row"]');
    if (duplicateBtn) {
      const rowIndex = Number.parseInt(duplicateBtn.dataset.rowIndex, 10);
      duplicateSheetRow(editorKey, rowIndex);
      return;
    }

    const removeBtn = event.target.closest('button[data-role="remove-row"]');
    if (!removeBtn) return;
    const rowIndex = Number.parseInt(removeBtn.dataset.rowIndex, 10);
    removeSheetRow(editorKey, rowIndex);
  });
}

function bindGlobalShortcuts() {
  document.addEventListener("keydown", (event) => {
    if (state.cellEditor.open) return;
    const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
    if (!isSaveShortcut) return;

    const activeView = getActiveViewId();
    if (activeView !== "default" && activeView !== "versions") {
      return;
    }

    event.preventDefault();

    if (activeView === "default") {
      saveDefault().catch((err) => showToast(err.message, "err"));
      return;
    }

    saveVersion().catch((err) => showToast(err.message, "err"));
  });

  window.addEventListener("beforeunload", (event) => {
    if (!hasDirtyForms()) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

function bindCellEditorEvents() {
  qs("cellEditorCloseBtn").addEventListener("click", closeCellEditor);
  qs("cellEditorCancelBtn").addEventListener("click", closeCellEditor);
  qs("cellEditorSaveBtn").addEventListener("click", saveCellEditor);

  qs("cellEditorTextarea").addEventListener("input", updateCellEditorMeta);
  qs("cellEditorTextarea").addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      saveCellEditor();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeCellEditor();
    }
  });

  qs("cellEditorModal").addEventListener("click", (event) => {
    if (event.target === qs("cellEditorModal")) {
      closeCellEditor();
    }
  });
}

function bindEvents() {
  document.querySelectorAll(".menu-item").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  bindScopeDirtyTracking();
  bindSheetEditorEvents("default");
  bindSheetEditorEvents("version");
  bindCellEditorEvents();
  bindGlobalShortcuts();

  qs("refreshAllBtn").addEventListener("click", async () => {
    if (!confirmDiscard("default", "รีเฟรชข้อมูล") || !confirmDiscard("version", "รีเฟรชข้อมูล")) {
      return;
    }
    await refreshAll();
    showToast("รีเฟรชข้อมูลแล้ว", "ok");
  });

  qs("saveDefaultBtn").addEventListener("click", () =>
    saveDefault().catch((err) => showToast(err.message, "err"))
  );

  qs("reloadDefaultBtn").addEventListener("click", () => {
    if (!confirmDiscard("default", "โหลดข้อมูลใหม่")) return;
    loadDefaultToForm();
  });

  qs("versionsSearch").addEventListener("input", renderVersions);

  qs("newVersionBtn").addEventListener("click", () => {
    if (!confirmDiscard("version", "ล้างฟอร์มเวอร์ชัน")) return;
    resetVersionForm();
  });

  qs("createFromDefaultBtn").addEventListener("click", () => {
    if (!confirmDiscard("version", "แทนที่ฟอร์มด้วย Default")) return;
    populateVersionFromDefault();
  });

  qs("saveVersionBtn").addEventListener("click", () =>
    saveVersion().catch((err) => showToast(err.message, "err"))
  );

  qs("importVersionBtn").addEventListener("click", () =>
    importVersion().catch((err) => showToast(err.message, "err"))
  );

  qs("versionsTableBody").addEventListener("click", async (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    const id = target.dataset.id;
    const act = target.dataset.act;
    if (!id || !act) return;

    if (act === "edit") {
      if (!confirmDiscard("version", "เปิดเวอร์ชันอื่น")) return;
      const version = getVersionById(id);
      if (version) {
        fillVersionForm(version);
      }
      return;
    }

    if (act === "duplicate") {
      const v = getVersionById(id);
      if (!v) return;
      await fetchJSON("/api/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${v.name} (สำเนา)`,
          description: v.description || "",
          googleDoc: v.googleDoc || "",
          sheetData: v.sheetData || [],
          staticInstructions: v.staticInstructions || "",
        }),
      });
      await refreshAll();
      showToast("ทำสำเนาเวอร์ชันแล้ว", "ok");
      return;
    }

    if (act === "activate") {
      await fetchJSON(`/api/versions/${encodeURIComponent(id)}/activate`, {
        method: "POST",
      });
      await refreshAll();
      showToast("เปิดใช้งานเวอร์ชันแล้ว", "ok");
      return;
    }

    if (act === "delete") {
      const confirmDelete = window.confirm("ต้องการลบเวอร์ชันนี้หรือไม่?");
      if (!confirmDelete) return;
      await fetchJSON(`/api/versions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await refreshAll();
      showToast("ลบเวอร์ชันแล้ว", "ok");
      return;
    }

    if (act === "export") {
      window.open(`/api/versions/${encodeURIComponent(id)}/export`, "_blank");
    }
  });

  qs("buildBtn").addEventListener("click", () =>
    buildPreview().catch((err) => showToast(err.message, "err"))
  );

  qs("addFollowupBtn").addEventListener("click", addFollowupRow);
  qs("saveFollowupsBtn").addEventListener("click", () =>
    saveFollowups().catch((err) => showToast(err.message, "err"))
  );

  qs("followupTableBody").addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target || target.dataset.role !== "remove") return;
    target.closest("tr")?.remove();
  });

  qs("uploadImageBtn").addEventListener("click", () =>
    uploadImage().catch((err) => showToast(err.message, "err"))
  );

  qs("reloadImagesBtn").addEventListener("click", async () => {
    state.images = await fetchJSON("/api/images");
    renderImages();
    updateDashboard();
    showToast("โหลดรูปใหม่แล้ว", "ok");
  });

  qs("imageGrid").addEventListener("click", async (event) => {
    const target = event.target.closest("button");
    if (!target) return;

    const key = target.dataset.key;
    const act = target.dataset.imgAct;
    if (!key || !act) return;

    if (act === "copy") {
      await navigator.clipboard.writeText(`[IMG:${key}]`);
      showToast("คัดลอก token แล้ว", "ok");
      return;
    }

    if (act === "delete") {
      const confirmDelete = window.confirm(`ต้องการลบรูป ${key} หรือไม่?`);
      if (!confirmDelete) return;
      await fetchJSON(`/api/images/${encodeURIComponent(key)}`, { method: "DELETE" });
      state.images = await fetchJSON("/api/images");
      renderImages();
      updateDashboard();
      showToast("ลบรูปแล้ว", "ok");
    }
  });
}

async function init() {
  bindEvents();
  updateDirtyChip("default");
  updateDirtyChip("version");

  await refreshAll();

  tryRestoreDraft("default");
  tryRestoreDraft("version");
}

window.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message, "err"));
});
