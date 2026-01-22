"use strict";

const $ = (id) => document.getElementById(id);

function toast(msg){
  const t = $("toast");
  if(!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(()=>t.classList.remove("show"), 1200);
}

function getTopicCount(name){
  const bank = window.QUESTION_BANK || {};
  const arr = bank[name];
  return Array.isArray(arr) ? arr.length : 0;
}

function renderTopics(filterText = ""){
  const grid = $("topicsGrid");
  const warn = $("warnBox");
  if(!grid) return;

  const bank = window.QUESTION_BANK || {};
  const all = Object.keys(bank);

  if(warn){
    warn.style.display = all.length ? "none" : "block";
  }

  const q = String(filterText || "").trim().toLowerCase();

  // Sort A-Z
  const filtered = all
    .filter(name => name.toLowerCase().includes(q))
    .sort((a,b) => a.localeCompare(b));

  grid.innerHTML = "";

  if(filtered.length === 0){
    grid.innerHTML = `<div style="opacity:.85; font-weight:900; color: var(--muted);">
      No topics found.
    </div>`;
    return;
  }

  filtered.forEach((name) => {
    const count = getTopicCount(name);

    const card = document.createElement("div");
    card.className = "topicCard";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.innerHTML = `
      <div class="topicLeft">
        <div class="topicName">${name}</div>
        <div class="topicMeta">${count} questions</div>
      </div>
      <button class="topicGo" type="button">Select</button>
    `;

    function selectTopic(){
      localStorage.setItem("smartstudy_selected_topic", name);
      toast(`✅ Selected: ${name}`);

      // Go back to home
      setTimeout(() => {
        window.location.href = "index.html";
      }, 120);
    }

    // Tap anywhere on card
    card.addEventListener("click", (e) => {
      // prevent double actions if button clicked
      e.preventDefault();
      selectTopic();
    });

    // Keyboard support
    card.addEventListener("keydown", (e) => {
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        selectTopic();
      }
    });

    grid.appendChild(card);
  });
}

function init(){
  // Back button
  const back = $("btnBack");
  if(back){
    back.addEventListener("click", () => window.location.href = "index.html");
  }

  // Search
  const search = $("topicSearch");
  if(search){
    search.addEventListener("input", () => renderTopics(search.value));
  }

  renderTopics("");
}

init();
