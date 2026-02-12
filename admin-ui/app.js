const state = {
  defaultData: null,
  versions: [],
  followups: [],
  images: [],
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

function qs(id) {
  return document.getElementById(id);
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

function updateDashboard() {
  const activeVersion = state.versions.find((v) => v.isActive);
  qs("activeDefaultName").textContent = state.defaultData?.name || "default";
  qs("activeVersionName").textContent = activeVersion ? activeVersion.name : "-";
  qs("totalVersionsCount").textContent = String(state.versions.length);
  qs("followupCount").textContent = String(state.followups.length);
  qs("imageCount").textContent = String(state.images.length);
  qs("defaultSourceChip").textContent = `Source: ${state.defaultData?.source || "unknown"}`;
}

function loadDefaultToForm() {
  const d = state.defaultData || {};
  qs("defaultName").value = d.name || "Default Instruction";
  qs("defaultDesc").value = d.description || "";
  qs("defaultSource").value = d.source || "manual";
  qs("defaultGoogleDoc").value = d.googleDoc || "";
  qs("defaultSheetJson").value = JSON.stringify(d.sheetData || [], null, 2);
  qs("defaultStatic").value = d.staticInstructions || "";
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
              <button data-act="edit" data-id="${v.id}">Edit</button>
              <button data-act="duplicate" data-id="${v.id}">Duplicate</button>
              <button data-act="activate" data-id="${v.id}" ${v.isActive ? "disabled" : ""}>Activate</button>
              <button data-act="export" data-id="${v.id}">Export</button>
              <button data-act="delete" data-id="${v.id}">Delete</button>
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
  qs("versionId").value = "";
  qs("versionName").value = "";
  qs("versionDesc").value = "";
  qs("versionGoogleDoc").value = "";
  qs("versionSheetJson").value = "[]";
  qs("versionStatic").value = "";
}

function fillVersionForm(version) {
  qs("versionId").value = version.id || "";
  qs("versionName").value = version.name || "";
  qs("versionDesc").value = version.description || "";
  qs("versionGoogleDoc").value = version.googleDoc || "";
  qs("versionSheetJson").value = JSON.stringify(version.sheetData || [], null, 2);
  qs("versionStatic").value = version.staticInstructions || "";
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
          <td><button data-role="remove">ลบ</button></td>
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
              <button data-img-act="copy" data-key="${img.key}">Copy Token</button>
              <button data-img-act="delete" data-key="${img.key}">Delete</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  qs("imageGrid").innerHTML = html || `<p>ยังไม่มีรูปภาพ</p>`;
}

async function refreshAll() {
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
    sheetData = JSON.parse(qs("defaultSheetJson").value);
    if (!Array.isArray(sheetData)) throw new Error("sheetData must be array");
  } catch (err) {
    showToast("Sheet Data JSON ไม่ถูกต้อง", "err");
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
    sheetData = JSON.parse(qs("versionSheetJson").value);
    if (!Array.isArray(sheetData)) throw new Error("sheetData must be array");
  } catch (err) {
    showToast("Sheet Data JSON ของเวอร์ชันไม่ถูกต้อง", "err");
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
  const version =
    source === "default" ? state.defaultData : getVersionById(source);

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

function bindEvents() {
  document.querySelectorAll(".menu-item").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  qs("refreshAllBtn").addEventListener("click", async () => {
    await refreshAll();
    showToast("รีเฟรชข้อมูลแล้ว", "ok");
  });

  qs("saveDefaultBtn").addEventListener("click", () =>
    saveDefault().catch((err) => showToast(err.message, "err"))
  );
  qs("reloadDefaultBtn").addEventListener("click", () => loadDefaultToForm());

  qs("versionsSearch").addEventListener("input", renderVersions);
  qs("newVersionBtn").addEventListener("click", resetVersionForm);
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
      const version = getVersionById(id);
      if (version) fillVersionForm(version);
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
  await refreshAll();
}

window.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message, "err"));
});
