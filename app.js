/* ===========================
   SmartStudy MCQ - app.js (PATCHED • FULL PROJECT)
   - Keeps your full UI
   - Instant check + green/red + message + celebration
   - Works on mobile (Android + iPhone)
   - AI (image) + Bank (topic)
   =========================== */

"use strict";

const $ = (id) => document.getElementById(id);
const ABCD = ["A", "B", "C", "D"];

/* ---------- STATE ---------- */
let uploadedImageDataUrl = null;
let hasImage = false;
let selectedCategory = null;
let isGenerating = false;

let currentMCQs = [];
let selections = [];
let locked = []; // lock each question after first answer (instant mode)

// prevent pointer + click double fire on phones
let __lastTapTime = 0;

/* ---------- SAFE HTML ---------- */
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------- TOAST ---------- */
function toast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => t.classList.remove("show"), 1600);
}

/* ---------- CHIP ---------- */
function setChip(text) {
  const c = $("statusChip");
  if (c) c.textContent = text;
}

/* ---------- BANK ---------- */
const CATEGORY_BANK = window.QUESTION_BANK || {};

/* ---------- UI HELPERS ---------- */
function setEmptyState(show) {
  const empty = $("emptyState");
  const list = $("mcqList");
  if (!empty || !list) return;
  empty.style.display = show ? "block" : "none";
  list.style.display = show ? "none" : "block";
}

function computeStats() {
  const total = currentMCQs.length;
  let answered = 0;
  let correct = 0;
  for (let i = 0; i < total; i++) {
    if (selections[i] === null || selections[i] === undefined) continue;
    answered++;
    if (selections[i] === currentMCQs[i].ans) correct++;
  }
  return { total, answered, correct };
}

function updateScoreUI() {
  const { total, answered, correct } = computeStats();
  if ($("sTotal")) $("sTotal").textContent = total;
  if ($("sAnswered")) $("sAnswered").textContent = answered;
  if ($("sCorrect")) $("sCorrect").textContent = correct;
  const acc = answered ? Math.round((correct / answered) * 100) : 0;
  if ($("sAcc")) $("sAcc").textContent = acc + "%";
}

/* ---------- SHUFFLE ---------- */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function shuffleMCQ(mcq) {
  const original = mcq.options.slice();
  const correctText = original[mcq.ans];
  const shuffled = shuffle(original);
  let newAns = shuffled.findIndex((x) => x === correctText);
  if (newAns < 0) newAns = 0;
  return { q: mcq.q, options: shuffled, ans: newAns };
}

/* ---------- NORMALIZE ---------- */
function normalizeMCQs(mcqs) {
  const safe = Array.isArray(mcqs) ? mcqs : [];
  return safe
    .map((m) => ({
      q: String(m?.q || "").trim(),
      options: Array.isArray(m?.options) ? m.options.map((o) => String(o)) : [],
      ans: Number.isInteger(m?.ans) ? m.ans : 0,
    }))
    .filter((m) => m.q && m.options.length === 4 && m.ans >= 0 && m.ans <= 3);
}

/* ---------- MARK + ANIMATE ---------- */
function lockQuestion(i, lock) {
  document.querySelectorAll(`#opts-${i} .optBtn`).forEach((btn) => {
    btn.disabled = !!lock;
  });
}

function markQuestion(i) {
  const mcq = currentMCQs[i];
  const picked = selections[i];
  const correctIndex = mcq.ans;

  const resultEl = document.getElementById(`result-${i}`);
  const btns = document.querySelectorAll(`#opts-${i} .optBtn`);

  btns.forEach((b) =>
    b.classList.remove("optCorrect", "optCorrectSoft", "optWrong", "celebrate", "shakeWrong")
  );

  // show correct softly always (nice hint)
  if (btns[correctIndex]) btns[correctIndex].classList.add("optCorrectSoft");

  if (picked === null || picked === undefined) {
    if (resultEl) {
      resultEl.textContent = "";
      resultEl.classList.remove("ok", "bad");
    }
    return;
  }

  if (picked === correctIndex) {
    if (btns[correctIndex]) {
      btns[correctIndex].classList.remove("optCorrectSoft");
      btns[correctIndex].classList.add("optCorrect", "celebrate");
    }
    if (resultEl) {
      resultEl.textContent = "✅ Correct";
      resultEl.classList.add("ok");
      resultEl.classList.remove("bad");
    }
  } else {
    if (btns[picked]) btns[picked].classList.add("optWrong", "shakeWrong");
    if (resultEl) {
      resultEl.textContent = `❌ Wrong (Correct: ${ABCD[correctIndex]}. ${mcq.options[correctIndex]})`;
      resultEl.classList.add("bad");
      resultEl.classList.remove("ok");
    }
  }
}

/* ---------- RENDER MCQs ---------- */
function renderMCQs(mcqs, modeLabel = "Analysis") {
  const mcqList = $("mcqList");
  if (!mcqList) return;

  currentMCQs = normalizeMCQs(mcqs);
  selections = new Array(currentMCQs.length).fill(null);
  locked = new Array(currentMCQs.length).fill(false);

  mcqList.innerHTML = "";

  if (currentMCQs.length === 0) {
    setEmptyState(true);
    updateScoreUI();
    setChip(modeLabel);
    return;
  }

  setEmptyState(false);

  currentMCQs.forEach((mcq, i) => {
    const card = document.createElement("div");
    card.className = "mcqItem";

    card.innerHTML = `
      <div class="mcqQ">
        <div class="qNum">${i + 1}</div>
        <div class="qText">${esc(mcq.q)}</div>
      </div>

      <div class="opts" id="opts-${i}">
        ${mcq.options
          .map(
            (opt, j) => `
            <button type="button" class="optBtn" data-q="${i}" data-opt="${j}">
              <span class="optLetter">${ABCD[j]}.</span>
              <span class="optText">${esc(opt)}</span>
            </button>
          `
          )
          .join("")}
      </div>

      <div class="mcqFoot" id="result-${i}"></div>
    `;

    mcqList.appendChild(card);

    const wrap = card.querySelector(`#opts-${i}`);
    const btns = wrap.querySelectorAll(".optBtn");

    btns.forEach((btn) => {
      const handler = () => {
        const now = Date.now();
        // ignore duplicate click firing right after pointer event
        if (now - __lastTapTime < 250) return;
        __lastTapTime = now;

        const qIndex = Number(btn.dataset.q);
        const optIndex = Number(btn.dataset.opt);

        if (locked[qIndex]) return; // locked until reset

        selections[qIndex] = optIndex;

        btns.forEach((b) => b.classList.remove("optSelected"));
        btn.classList.add("optSelected");

        // instant check ALWAYS
        locked[qIndex] = true;
        markQuestion(qIndex);
        lockQuestion(qIndex, true);

        updateScoreUI();
      };

      // Best cross-device: click + pointerup fallback
      btn.addEventListener("click", handler);
      btn.addEventListener("pointerup", handler);
    });
  });

  updateScoreUI();
  setChip(modeLabel);
}

/* ---------- RESET ---------- */
function resetQuiz() {
  if (!currentMCQs.length) {
    toast("Nothing to reset.");
    return;
  }

  selections = new Array(currentMCQs.length).fill(null);
  locked = new Array(currentMCQs.length).fill(false);

  for (let i = 0; i < currentMCQs.length; i++) {
    const resultEl = document.getElementById(`result-${i}`);
    if (resultEl) {
      resultEl.textContent = "";
      resultEl.classList.remove("ok", "bad");
    }

    document.querySelectorAll(`#opts-${i} .optBtn`).forEach((b) => {
      b.disabled = false;
      b.classList.remove(
        "optSelected",
        "optCorrect",
        "optCorrectSoft",
        "optWrong",
        "celebrate",
        "shakeWrong"
      );
    });
  }

  updateScoreUI();
  toast("✅ Reset");
}

/* ---------- IMAGE PREP (FAST MOBILE) ---------- */
async function smartPrepareImage(file, maxWidth = 900, quality = 0.72) {
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("File read failed"));
    r.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("Image load failed"));
    im.src = dataUrl;
  });

  const scale = Math.min(maxWidth / img.width, 1);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);

  const ctx = c.getContext("2d", { alpha: false });
  ctx.drawImage(img, 0, 0, c.width, c.height);

  return c.toDataURL("image/jpeg", quality);
}

/* ---------- LOADER ---------- */
let __loaderTimer = null;
let __tipTimer = null;
let __progress = 0;

function showLoader(text = "Generating MCQs…") {
  const overlay = $("loaderOverlay");
  const t = $("loaderText");
  const fill = $("loaderBarFill");
  const tipEl = $("loaderTip");

  if (t) t.textContent = text;
  if (overlay) overlay.classList.add("show");

  __progress = 0;
  if (fill) fill.style.width = "0%";

  clearInterval(__loaderTimer);
  __loaderTimer = setInterval(() => {
    __progress = Math.min(92, __progress + Math.random() * 7 + 2);
    if (fill) fill.style.width = `${Math.floor(__progress)}%`;
  }, 240);

  const tips = ["Reading your notes…", "Building options…", "Checking answers…", "Final polish… ✨"];
  let idx = 0;
  if (tipEl) tipEl.textContent = tips[0];

  clearInterval(__tipTimer);
  __tipTimer = setInterval(() => {
    idx = (idx + 1) % tips.length;
    if (tipEl) tipEl.textContent = tips[idx];
  }, 850);
}

function hideLoader() {
  const overlay = $("loaderOverlay");
  const fill = $("loaderBarFill");

  clearInterval(__loaderTimer);
  clearInterval(__tipTimer);

  if (fill) fill.style.width = "100%";

  setTimeout(() => {
    if (overlay) overlay.classList.remove("show");
    if (fill) fill.style.width = "0%";
  }, 260);
}

/* ---------- UPLOAD WIRING ---------- */
function wireUpload() {
  const box = $("uploadBox");
  const input = $("fileInput");
  const img = $("imgPreview");
  const hint = $("uploadHint");
  const note = $("imgNote");
  const removeBtn = $("btnRemoveImage");

  if (!box || !input || !img || !hint) {
    console.error("Upload elements missing. Check IDs in index.html");
    return;
  }

  async function setImage(file) {
    if (!file) return;

    // preview
    const url = URL.createObjectURL(file);
    img.src = url;
    img.style.display = "block";
    hint.style.display = "none";
    if (note) note.textContent = file.name;

    hasImage = true;
    selectedCategory = null;
    document.querySelectorAll(".catBtn").forEach((b) => b.classList.remove("active"));

    uploadedImageDataUrl = null;

    showLoader("Preparing image… 📸");
    try {
      uploadedImageDataUrl = await smartPrepareImage(file, 900, 0.72);
      toast("✅ Image ready. Press Generate");
    } catch (e) {
      console.error(e);
      toast("⚠️ Image failed. Try again");
    } finally {
      hideLoader();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
  }

  // iPhone safe: click must be inside user gesture
  const openPicker = () => input.click();
  box.addEventListener("click", openPicker);
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  });

  // drag-drop desktop
  box.addEventListener("dragover", (e) => {
    e.preventDefault();
    box.classList.add("drag");
  });
  box.addEventListener("dragleave", () => box.classList.remove("drag"));
  box.addEventListener("drop", async (e) => {
    e.preventDefault();
    box.classList.remove("drag");
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) await setImage(f);
  });

  input.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) await setImage(f);
    input.value = "";
  });

  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      uploadedImageDataUrl = null;
      hasImage = false;
      img.src = "";
      img.style.display = "none";
      hint.style.display = "block";
      if (note) note.textContent = "No image selected";
      toast("🧹 Image removed");
    });
  }
}

/* ---------- CATEGORIES (TOP 6 HOME) ---------- */
function renderCategories() {
  const grid = $("catGrid");
  if (!grid) return;

  const all = Object.keys(CATEGORY_BANK);
  const featured = all.slice(0, 6);

  grid.innerHTML = "";

  if (all.length === 0) {
    grid.innerHTML = `<div style="opacity:.8;">⚠️ bank.js not loaded. Check: bank.js must load BEFORE app.js</div>`;
    return;
  }

  featured.forEach((name) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "catBtn";
    b.textContent = name;

    b.addEventListener("click", () => {
      selectedCategory = name;
      hasImage = false;
      uploadedImageDataUrl = null;

      document.querySelectorAll(".catBtn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");

      if ($("mcqSub")) $("mcqSub").textContent = `Selected: ${name} • Press Generate`;
      setChip("Analysis");
      toast("✅ Topic selected");
    });

    grid.appendChild(b);
  });
}

function autoPickTopicFromStorage() {
  const saved = localStorage.getItem("smartstudy_selected_topic");
  if (!saved) return;
  if (CATEGORY_BANK[saved]) {
    selectedCategory = saved;
    hasImage = false;
    uploadedImageDataUrl = null;

    document.querySelectorAll(".catBtn").forEach((btn) => {
      if (btn.textContent.trim() === saved) btn.classList.add("active");
      else btn.classList.remove("active");
    });

    if ($("mcqSub")) $("mcqSub").textContent = `Selected: ${saved} • Press Generate`;
    setChip("Analysis");
    toast(`✅ Loaded: ${saved}`);
  }
}

function buildMCQsFromCategory(category, count) {
  const bank = CATEGORY_BANK[category] || [];
  if (!bank.length) return [];
  const c = Math.max(1, Math.min(count, bank.length));
  const picked = shuffle(bank).slice(0, c);
  return shuffle(picked.map(shuffleMCQ));
}

/* ---------- FETCH RETRY ---------- */
async function fetchWithRetry(url, options, tries = 2, baseDelay = 900) {
  let lastErr = null;
  for (let attempt = 0; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;

      if (res.status === 429 || res.status === 503 || res.status === 500) {
        lastErr = new Error(`Server busy (${res.status})`);
        if (attempt < tries) {
          await new Promise((r) => setTimeout(r, baseDelay * (attempt + 1)));
          continue;
        }
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < tries) {
        await new Promise((r) => setTimeout(r, baseDelay * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastErr || new Error("Request failed");
}

/* ---------- GENERATE ---------- */
async function generate() {
  if (isGenerating) return toast("⏳ Wait… generating");

  if (!selectedCategory && !hasImage) {
    toast("Choose a topic OR upload an image 📸");
    return;
  }

  isGenerating = true;
  const genBtn = $("btnGenerate");
  if (genBtn) genBtn.disabled = true;

  try {
    // TOPIC (BANK)
    if (selectedCategory && !hasImage) {
      const count = Math.max(5, Math.min(30, Number($("qCount")?.value || 30)));
      const list = buildMCQsFromCategory(selectedCategory, count);

      if ($("mcqSub")) $("mcqSub").textContent = `Topic: ${selectedCategory} • ${count} questions`;
      renderMCQs(list, "Analysis");
      toast("✅ Generated");
      return;
    }

    // IMAGE (AI)
    if (hasImage) {
      if (!uploadedImageDataUrl) {
        toast("📸 Image not ready. Re-upload");
        return;
      }

      showLoader("AI is creating your MCQs… 🤖");

      const res = await fetchWithRetry(
        "/api/generate-mcqs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl: uploadedImageDataUrl, count: 10 }),
        },
        2,
        900
      );

      if (!res.ok) {
  const errText = await res.text().catch(() => "");
  console.log("AI ERROR RESPONSE:", res.status, errText);
  toast("🚨 AI server error. Please try again.");
  return;
}

      const data = await res.json();
      const fixed = normalizeMCQs(data?.mcqs || data?.questions || []).map(shuffleMCQ);

      if (fixed.length === 0) {
        toast("⚠️ AI returned invalid format");
        return;
      }

      if ($("mcqSub")) $("mcqSub").textContent = "From image • Tap an option to check instantly";
      renderMCQs(fixed, "Instant");
      toast("✅ AI MCQs ready");
      return;
    }
  } catch (err) {
    console.error(err);
    toast("⚠️ Network/AI failed");
  } finally {
    hideLoader();
    isGenerating = false;
    if (genBtn) genBtn.disabled = false;
  }
}

/* ---------- CLEAR ---------- */
function clearAll() {
  selectedCategory = null;
  document.querySelectorAll(".catBtn").forEach((b) => b.classList.remove("active"));

  uploadedImageDataUrl = null;
  hasImage = false;

  const img = $("imgPreview");
  if (img) {
    img.src = "";
    img.style.display = "none";
  }
  if ($("uploadHint")) $("uploadHint").style.display = "block";
  if ($("imgNote")) $("imgNote").textContent = "No image selected";

  if ($("mcqSub")) $("mcqSub").textContent = "Pick a topic or upload an image, then generate";
  setChip("Analysis");

  renderMCQs([], "Analysis");
  toast("✅ Cleared");
}

/* ---------- INIT ---------- */
function init() {
  renderCategories();
  autoPickTopicFromStorage();
  wireUpload();

  const genBtn = $("btnGenerate");
  const clrBtn = $("btnClear");
  const resBtn = $("resetBtn");

  if (genBtn) genBtn.addEventListener("click", generate);
  if (clrBtn) clrBtn.addEventListener("click", clearAll);
  if (resBtn) resBtn.addEventListener("click", resetQuiz);

  // If submit exists, hide it (your request)
  const submitBtn = $("submitBtn");
  if (submitBtn) submitBtn.style.display = "none";

  renderMCQs([], "Analysis");
  updateScoreUI();
  setChip("Analysis");
}

init();




