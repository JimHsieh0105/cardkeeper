/* ===================== CardKeeper app logic ===================== */

// ---------- Service worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ---------- IndexedDB ----------
const DB_NAME = "cardkeeper-db";
const STORE = "cards";
let dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE)) {
      const store = db.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("name", "name", { unique: false });
    }
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function dbGetAll() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function dbPut(card) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(card);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function dbDelete(id) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- State ----------
let allCards = [];
let activeTag = null;
let searchTerm = "";
let currentEditId = null;   // id being edited, null = new
let currentDetailId = null;
let pendingScan = { photo: null, rawText: "" };

// ---------- Navigation ----------
function showView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo(0, 0);
}
document.querySelectorAll("[data-nav]").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.nav));
});

// ---------- Rendering the list ----------
function initials(name) {
  if (!name) return "?";
  const trimmed = name.trim();
  // Chinese name: take first char. Latin name: take first letters of first two words.
  if (/[\u4e00-\u9fff]/.test(trimmed)) return trimmed.slice(0, 1);
  const parts = trimmed.split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
}

function pinyinBucket(name) {
  // very rough grouping key for the A-Z rail: first char code
  if (!name) return "#";
  const c = name.trim()[0];
  if (/[A-Za-z]/.test(c)) return c.toUpperCase();
  return "中"; // group all CJK names together, sorted below by localeCompare
}

function getAllTags() {
  const set = new Set();
  allCards.forEach((c) => (c.tags || []).forEach((t) => set.add(t)));
  return [...set].sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

function filteredCards() {
  const term = searchTerm.trim().toLowerCase();
  return allCards
    .filter((c) => {
      if (activeTag && !(c.tags || []).includes(activeTag)) return false;
      if (!term) return true;
      const hay = [c.name, c.company, c.title, c.email, c.phone, ...(c.tags || [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "zh-Hant"));
}

function renderTagChips() {
  const wrap = document.getElementById("tag-chips");
  const tags = getAllTags();
  if (tags.length === 0) {
    wrap.innerHTML = "";
    return;
  }
  wrap.innerHTML =
    `<button class="chip ${activeTag === null ? "active" : ""}" data-tag="">全部</button>` +
    tags
      .map((t) => `<button class="chip ${activeTag === t ? "active" : ""}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
      .join("");
  wrap.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeTag = chip.dataset.tag || null;
      renderAll();
    });
  });
}

function renderAzRail(cards) {
  const rail = document.getElementById("az-rail");
  const present = new Set(cards.map((c) => pinyinBucket(c.name)));
  const letters = ["中", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];
  rail.innerHTML = letters
    .map((L) => `<span class="${present.has(L) ? "" : "dim"}" data-letter="${L}">${L}</span>`)
    .join("");
  rail.querySelectorAll("span").forEach((el) => {
    el.addEventListener("click", () => {
      const target = document.querySelector(`[data-bucket="${el.dataset.letter}"]`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function renderCardList() {
  const list = document.getElementById("card-list");
  const cards = filteredCards();
  document.getElementById("empty-state").classList.toggle("hidden", allCards.length !== 0);
  list.classList.toggle("hidden", allCards.length === 0);

  if (cards.length === 0 && allCards.length > 0) {
    list.innerHTML = `<p style="text-align:center;color:var(--slate);padding-top:40px;">找不到符合的聯絡人</p>`;
    document.getElementById("az-rail").innerHTML = "";
    return;
  }

  let html = "";
  let lastBucket = null;
  cards.forEach((c) => {
    const bucket = pinyinBucket(c.name);
    if (bucket !== lastBucket) {
      html += `<div class="section-label" data-bucket="${bucket}">${bucket === "中" ? "中文姓名" : bucket}</div>`;
      lastBucket = bucket;
    }
    const meta = [c.company, c.title].filter(Boolean).join(" · ");
    html += `
      <div class="card-item" data-id="${c.id}">
        <div class="card-thumb">${c.photo ? `<img src="${c.photo}" alt="">` : escapeHtml(initials(c.name))}</div>
        <div class="card-info">
          <div class="card-name">${escapeHtml(c.name || "未命名聯絡人")}</div>
          <div class="card-meta">${escapeHtml(meta || c.phone || c.email || "")}</div>
        </div>
        <div class="card-chevron">›</div>
      </div>`;
  });
  list.innerHTML = html;
  list.querySelectorAll(".card-item").forEach((el) => {
    el.addEventListener("click", () => openDetail(el.dataset.id));
  });
  renderAzRail(cards);
}

function renderAll() {
  renderTagChips();
  renderCardList();
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

// ---------- Search ----------
document.getElementById("search").addEventListener("input", (e) => {
  searchTerm = e.target.value;
  renderCardList();
});

// ---------- Load ----------
async function loadCards() {
  allCards = await dbGetAll();
  renderAll();
}
loadCards();

/* ===================== Scan / OCR flow ===================== */
const scanPreview = document.getElementById("scan-preview");
const scanPlaceholder = document.getElementById("scan-placeholder");
const btnUseScan = document.getElementById("btn-use-scan");
const ocrStatus = document.getElementById("ocr-status");
const ocrStatusText = document.getElementById("ocr-status-text");

document.getElementById("btn-scan").addEventListener("click", () => {
  resetScanView();
  showView("view-scan");
});
document.getElementById("btn-add-manual").addEventListener("click", () => openEdit(null));

document.getElementById("btn-take-photo").addEventListener("click", () => {
  document.getElementById("file-camera").click();
});
document.getElementById("btn-pick-photo").addEventListener("click", () => {
  document.getElementById("file-lib").click();
});
document.getElementById("file-camera").addEventListener("change", (e) => handleScanFile(e.target.files[0]));
document.getElementById("file-lib").addEventListener("change", (e) => handleScanFile(e.target.files[0]));

function resetScanView() {
  pendingScan = { photo: null, rawText: "" };
  scanPreview.classList.add("hidden");
  scanPlaceholder.classList.remove("hidden");
  btnUseScan.classList.add("hidden");
  ocrStatus.classList.add("hidden");
  document.getElementById("file-camera").value = "";
  document.getElementById("file-lib").value = "";
}

function handleScanFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    pendingScan.photo = reader.result;
    scanPreview.src = pendingScan.photo;
    scanPreview.classList.remove("hidden");
    scanPlaceholder.classList.add("hidden");
    btnUseScan.classList.add("hidden");
    await runOcr(pendingScan.photo);
  };
  reader.readAsDataURL(file);
}

async function runOcr(dataUrl) {
  if (typeof Tesseract === "undefined") {
    // OCR library failed to load (e.g. offline) — skip straight to manual entry
    btnUseScan.classList.remove("hidden");
    return;
  }
  ocrStatus.classList.remove("hidden");
  ocrStatusText.textContent = "辨識文字中… (首次使用需要下載語言包,請保持連線)";
  try {
    const result = await Tesseract.recognize(dataUrl, "eng+chi_tra", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          ocrStatusText.textContent = `辨識文字中… ${Math.round(m.progress * 100)}%`;
        }
      },
    });
    pendingScan.rawText = result.data.text.trim();
  } catch (err) {
    console.error(err);
    pendingScan.rawText = "";
  }
  ocrStatus.classList.add("hidden");
  btnUseScan.classList.remove("hidden");
}

function parseRawText(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(\+?\d[\d\-\s()]{7,}\d)/);
  // guess name = first line that isn't the email/phone and has reasonable length
  let nameGuess = "";
  for (const l of lines) {
    if (emailMatch && l.includes(emailMatch[0])) continue;
    if (phoneMatch && l.includes(phoneMatch[0])) continue;
    if (l.length >= 2 && l.length <= 20) {
      nameGuess = l;
      break;
    }
  }
  return {
    name: nameGuess,
    email: emailMatch ? emailMatch[0] : "",
    phone: phoneMatch ? phoneMatch[0].trim() : "",
  };
}

btnUseScan.addEventListener("click", () => {
  const guess = parseRawText(pendingScan.rawText || "");
  openEdit(null, {
    photo: pendingScan.photo,
    name: guess.name,
    email: guess.email,
    phone: guess.phone,
    raw: pendingScan.rawText,
  });
});

/* ===================== Add / Edit form ===================== */
const f = {
  name: document.getElementById("f-name"),
  company: document.getElementById("f-company"),
  title: document.getElementById("f-title"),
  phone: document.getElementById("f-phone"),
  email: document.getElementById("f-email"),
  address: document.getElementById("f-address"),
  tags: document.getElementById("f-tags"),
  notes: document.getElementById("f-notes"),
  raw: document.getElementById("f-raw"),
};
const editPhoto = document.getElementById("edit-photo");
const editPhotoPlaceholder = document.getElementById("edit-photo-placeholder");
let editPhotoData = null;

function openEdit(id, prefill) {
  currentEditId = id;
  document.getElementById("edit-title").textContent = id ? "編輯聯絡人" : "新增聯絡人";
  document.getElementById("btn-delete").classList.toggle("hidden", !id);

  const card = id ? allCards.find((c) => c.id === id) : null;
  const data = card || prefill || {};

  f.name.value = data.name || "";
  f.company.value = data.company || "";
  f.title.value = data.title || "";
  f.phone.value = data.phone || "";
  f.email.value = data.email || "";
  f.address.value = data.address || "";
  f.tags.value = (data.tags || []).join(", ");
  f.notes.value = data.notes || "";
  f.raw.value = data.raw || data.rawText || "";

  editPhotoData = data.photo || null;
  if (editPhotoData) {
    editPhoto.src = editPhotoData;
    editPhoto.classList.remove("hidden");
    editPhotoPlaceholder.classList.add("hidden");
  } else {
    editPhoto.classList.add("hidden");
    editPhotoPlaceholder.classList.remove("hidden");
  }

  showView("view-edit");
  setTimeout(() => f.name.focus(), 150);
}

document.getElementById("btn-save").addEventListener("click", async () => {
  const name = f.name.value.trim();
  if (!name) {
    f.name.focus();
    return;
  }
  const id = currentEditId || `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const card = {
    id,
    name,
    company: f.company.value.trim(),
    title: f.title.value.trim(),
    phone: f.phone.value.trim(),
    email: f.email.value.trim(),
    address: f.address.value.trim(),
    tags: f.tags.value.split(",").map((t) => t.trim()).filter(Boolean),
    notes: f.notes.value.trim(),
    raw: f.raw.value.trim(),
    photo: editPhotoData,
    createdAt: currentEditId ? (allCards.find((c) => c.id === id) || {}).createdAt || Date.now() : Date.now(),
  };
  await dbPut(card);
  await loadCards();
  if (currentEditId) {
    openDetail(id);
  } else {
    showView("view-list");
  }
});

document.getElementById("btn-delete").addEventListener("click", async () => {
  if (!currentEditId) return;
  if (!confirm("確定要刪除這張名片嗎?此動作無法復原。")) return;
  await dbDelete(currentEditId);
  await loadCards();
  showView("view-list");
});

/* ===================== Detail view ===================== */
function openDetail(id) {
  const c = allCards.find((x) => x.id === id);
  if (!c) return;
  currentDetailId = id;

  document.getElementById("d-name").textContent = c.name || "未命名聯絡人";
  document.getElementById("d-title-company").textContent = [c.title, c.company].filter(Boolean).join(" · ") || "—";

  const photoWrap = document.getElementById("detail-photo");
  photoWrap.innerHTML = c.photo ? `<img src="${c.photo}" alt="">` : escapeHtml(initials(c.name));

  const callEl = document.getElementById("d-call");
  const mailEl = document.getElementById("d-mail");
  callEl.href = c.phone ? `tel:${c.phone.replace(/[^\d+]/g, "")}` : "#";
  callEl.style.opacity = c.phone ? "1" : ".4";
  callEl.style.pointerEvents = c.phone ? "auto" : "none";
  mailEl.href = c.email ? `mailto:${c.email}` : "#";
  mailEl.style.opacity = c.email ? "1" : ".4";
  mailEl.style.pointerEvents = c.email ? "auto" : "none";

  setRow("row-address", "d-address", c.address);
  setRow("row-notes", "d-notes", c.notes);
  setRow("row-tags", "d-tags", (c.tags || []).join("、"));
  document.getElementById("d-created").textContent = c.createdAt
    ? new Date(c.createdAt).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" })
    : "";

  showView("view-detail");
}
function setRow(rowId, valId, value) {
  document.getElementById(rowId).classList.toggle("hidden", !value);
  document.getElementById(valId).textContent = value || "";
}

document.getElementById("btn-edit").addEventListener("click", () => {
  if (currentDetailId) openEdit(currentDetailId);
});

document.getElementById("d-share").addEventListener("click", async () => {
  const c = allCards.find((x) => x.id === currentDetailId);
  if (!c) return;
  const vcf = buildVCard(c);
  const file = new File([vcf], `${c.name || "contact"}.vcf`, { type: "text/vcard" });
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: c.name });
      return;
    } catch (e) {
      /* user cancelled or share failed — fall back to download */
    }
  }
  // fallback: trigger download, user can then "Add to Contacts" via Files app
  const url = URL.createObjectURL(new Blob([vcf], { type: "text/vcard" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${c.name || "contact"}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
});

function buildVCard(c) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${c.name || ""}`,
    c.company ? `ORG:${c.company}` : "",
    c.title ? `TITLE:${c.title}` : "",
    c.phone ? `TEL;TYPE=CELL:${c.phone}` : "",
    c.email ? `EMAIL:${c.email}` : "",
    c.address ? `ADR;TYPE=WORK:;;${c.address};;;;` : "",
    c.notes ? `NOTE:${c.notes.replace(/\n/g, "\\n")}` : "",
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\n");
}
