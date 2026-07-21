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
const scanAdjust = document.getElementById("scan-adjust");

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

document.getElementById("btn-rotate-left").addEventListener("click", () => rotateScan(-90));
document.getElementById("btn-rotate-right").addEventListener("click", () => rotateScan(90));
document.getElementById("btn-rerun-ocr").addEventListener("click", () => runOcr(pendingScan.photo));

function resetScanView() {
  pendingScan = { photo: null, rawText: "" };
  scanPreview.classList.add("hidden");
  scanPlaceholder.classList.remove("hidden");
  btnUseScan.classList.add("hidden");
  ocrStatus.classList.add("hidden");
  scanAdjust.classList.add("hidden");
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
    scanAdjust.classList.remove("hidden");
    await runOcr(pendingScan.photo);
  };
  reader.readAsDataURL(file);
}

// Rotate the working photo 90° at a time — mis-oriented photos are one of the
// biggest causes of bad OCR results, so let the user fix it before re-scanning.
function rotateScan(deg) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const swap = Math.abs(deg) === 90;
    canvas.width = swap ? img.height : img.width;
    canvas.height = swap ? img.width : img.height;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    pendingScan.photo = canvas.toDataURL("image/jpeg", 0.92);
    scanPreview.src = pendingScan.photo;
  };
  img.src = pendingScan.photo;
}

// Upscale small photos and boost contrast so faint / low-res text on business
// cards becomes easier for Tesseract to separate from the background.
function preprocessForOcr(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const TARGET_LONG_EDGE = 1800;
      const longEdge = Math.max(img.width, img.height);
      const scale = longEdge < TARGET_LONG_EDGE ? TARGET_LONG_EDGE / longEdge : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);

      try {
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Grayscale + gather histogram
        const gray = new Uint8ClampedArray(w * h);
        let min = 255, max = 0;
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          gray[p] = g;
          if (g < min) min = g;
          if (g > max) max = g;
        }
        // Percentile clip so a few outlier pixels don't ruin the stretch
        const range = Math.max(max - min, 1);

        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          let v = ((gray[p] - min) / range) * 255;
          // mild extra contrast boost around midtones
          v = (v - 128) * 1.15 + 128;
          v = Math.max(0, Math.min(255, v));
          data[i] = data[i + 1] = data[i + 2] = v;
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (e) {
        // getImageData can fail on some older iOS Safari versions for large
        // canvases — fall back to the plain upscaled (non-contrast) image.
        console.warn("OCR preprocessing skipped:", e);
      }

      resolve(canvas.toDataURL("image/jpeg", 0.95));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function runOcr(dataUrl) {
  if (typeof Tesseract === "undefined") {
    // OCR library failed to load (e.g. offline) — skip straight to manual entry
    btnUseScan.classList.remove("hidden");
    return;
  }
  ocrStatus.classList.remove("hidden");
  btnUseScan.classList.add("hidden");
  ocrStatusText.textContent = "處理影像中…";
  const ocrInput = await preprocessForOcr(dataUrl);

  ocrStatusText.textContent = "辨識文字中… (首次使用需要下載語言包,請保持連線)";
  try {
    const result = await Tesseract.recognize(ocrInput, "chi_tra+eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          ocrStatusText.textContent = `辨識文字中… ${Math.round(m.progress * 100)}%`;
        }
      },
      tessedit_pageseg_mode: "11", // sparse text — name cards have scattered blocks, not one paragraph
      preserve_interword_spaces: "1",
    });
    pendingScan.rawText = result.data.text.trim();
  } catch (err) {
    console.error(err);
    pendingScan.rawText = "";
  }
  ocrStatus.classList.add("hidden");
  btnUseScan.classList.remove("hidden");
}

const COMPANY_RE = /(股份有限公司|有限公司|企業社|工作室|事務所|集團|公司|Inc\.?|Co\.,?\s?Ltd\.?|Corporation|Corp\.?|LLC|GmbH)/i;
const TITLE_RE = /(董事長|執行長|總經理|副總經理|總監|經理|副理|主任|組長|工程師|設計師|業務代表|業務員|業務|創辦人|共同創辦人|負責人|顧問|專員|助理|秘書|主管|協理|副總|技術長|營運長|財務長|CEO|CTO|COO|CFO|Founder|President|Director|Manager|Engineer|Designer|Consultant|Specialist|Sales|VP)/i;
const ADDRESS_RE = /(路|街|巷|弄|號|樓|區|市|縣|Road|Rd\.|St\.|Street|Ave\.|Avenue|Floor|F\.)/;
const PHONE_RE = /(\+?886[-\s]?\d{1,2}[-\s]?\d{3,4}[-\s]?\d{3,4}|09\d{2}[-\s]?\d{3}[-\s]?\d{3}|0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{3,4})/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function isNoiseLine(l) {
  // drop lines that are just punctuation/symbol noise from OCR misreads
  return l.replace(/[\s\-–—|_.,:：、。]/g, "").length < 1;
}

function parseRawText(text) {
  const rawLines = text.split("\n").map((l) => l.trim()).filter((l) => l && !isNoiseLine(l));
  const emailMatch = text.match(EMAIL_RE);
  const phoneMatches = text.match(PHONE_RE) || [];
  // prefer a mobile-looking number (09xx) if present, otherwise the first match
  const mobile = phoneMatches.find((p) => /^09/.test(p.replace(/[-\s]/g, "")));
  const phoneGuess = mobile || phoneMatches[0] || "";

  const used = new Set();
  const isUsed = (l) =>
    (emailMatch && l.includes(emailMatch[0])) ||
    phoneMatches.some((p) => l.includes(p));

  let companyLine = rawLines.find((l) => !isUsed(l) && COMPANY_RE.test(l)) || "";
  let titleLine = rawLines.find((l) => !isUsed(l) && l !== companyLine && TITLE_RE.test(l)) || "";
  let addressLine = rawLines.find((l) => !isUsed(l) && l !== companyLine && l !== titleLine && ADDRESS_RE.test(l) && l.length > 5) || "";

  [companyLine, titleLine, addressLine].forEach((l) => l && used.add(l));

  const remaining = rawLines.filter((l) => !isUsed(l) && !used.has(l));

  // Name heuristic: look for a short line right next to the title line first
  // (business cards almost always place the name beside/above the job title),
  // then fall back to the first short "name-shaped" line, then any line.
  let nameGuess = "";
  if (titleLine) {
    const idx = rawLines.indexOf(titleLine);
    const neighbors = [rawLines[idx - 1], rawLines[idx + 1]].filter(Boolean);
    nameGuess = neighbors.find((l) => remaining.includes(l) && looksLikeName(l)) || "";
  }
  if (!nameGuess) nameGuess = remaining.find((l) => looksLikeName(l)) || "";
  if (!nameGuess) nameGuess = remaining[0] || "";

  return {
    name: nameGuess,
    company: companyLine,
    title: titleLine,
    address: addressLine,
    email: emailMatch ? emailMatch[0] : "",
    phone: phoneGuess.trim(),
  };
}

function looksLikeName(l) {
  const cjk = l.match(/[\u4e00-\u9fff]/g);
  if (cjk && cjk.length >= 2 && cjk.length <= 4 && l.length <= 6) return true; // 中文全名
  if (/^[A-Za-z][a-z]+\s+[A-Za-z][a-z]+$/.test(l)) return true; // "Firstname Lastname"
  return false;
}

btnUseScan.addEventListener("click", () => {
  const guess = parseRawText(pendingScan.rawText || "");
  openEdit(null, {
    photo: pendingScan.photo,
    name: guess.name,
    company: guess.company,
    title: guess.title,
    address: guess.address,
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
