/**
 * Schaats Klassement Tool (static, no backend)
 * - 10 rijders met 2 tijden
 * - Beste tijd (min) telt; 2e omloop telt alleen als ingevuld én geldig
 */

const DEFAULT_NAMES = [
  "Rijder 1","Rijder 2","Rijder 3","Rijder 4","Rijder 5",
  "Rijder 6","Rijder 7","Rijder 8","Rijder 9","Rijder 10"
];

const elInputTbody = document.getElementById("inputTbody");
const elRankTbody = document.getElementById("rankTbody");
const elTopList = document.getElementById("topList");
const elYear = document.getElementById("year");
const btnReset = document.getElementById("btnReset");
const btnExport = document.getElementById("btnExport");

elYear.textContent = new Date().getFullYear();

const state = DEFAULT_NAMES.map((name, idx) => ({
  id: idx + 1,
  name,
  t1: "",
  t2: ""
}));

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/**
 * Parse times:
 * - "SS,mmm" (e.g. 40,123)
 * - "M:SS,mmm" (e.g. 1:12,345)
 * Also accept dot as decimal separator.
 * Returns integer milliseconds or null.
 */
function parseTimeToMs(raw){
  if(!raw) return null;
  const s = raw.trim();
  if(!s) return null;

  // normalize: allow '.' as decimal separator
  const norm = s.replace(".", ",");

  // M:SS,mmm
  if(norm.includes(":")){
    const [mPart, rest] = norm.split(":");
    const minutes = Number(mPart);
    if(!Number.isInteger(minutes) || minutes < 0) return null;

    const restMatch = rest.match(/^\d{1,2},\d{3}$/);
    if(!restMatch) return null;

    const [secStr, msStr] = rest.split(",");
    const seconds = Number(secStr);
    const millis = Number(msStr);

    if(!Number.isInteger(seconds) || seconds < 0 || seconds > 59) return null;
    if(!Number.isInteger(millis) || millis < 0 || millis > 999) return null;

    return minutes * 60000 + seconds * 1000 + millis;
  }

  // SS,mmm (allow 1-3 digit seconds)
  const match = norm.match(/^\d{1,3},\d{3}$/);
  if(!match) return null;

  const [secStr, msStr] = norm.split(",");
  const seconds = Number(secStr);
  const millis = Number(msStr);

  if(!Number.isInteger(seconds) || seconds < 0) return null;
  if(!Number.isInteger(millis) || millis < 0 || millis > 999) return null;

  return seconds * 1000 + millis;
}

function formatMs(ms){
  if(ms == null) return "—";
  const minutes = Math.floor(ms / 60000);
  const rem = ms % 60000;
  const seconds = Math.floor(rem / 1000);
  const millis = rem % 1000;

  const msStr = String(millis).padStart(3, "0");
  if(minutes > 0){
    return `${minutes}:${String(seconds).padStart(2,"0")},${msStr}`;
  }
  // seconds can be >= 100 for some formats; pad to 2 when < 100
  const secStr = seconds < 100 ? String(seconds).padStart(2,"0") : String(seconds);
  return `${secStr},${msStr}`;
}

function getBestTimeMs(r){
  const t1ms = parseTimeToMs(r.t1);
  const t2ms = parseTimeToMs(r.t2); // counts only if field is not empty and valid
  const candidates = [];
  if(t1ms != null) candidates.push(t1ms);
  if(r.t2.trim() !== "" && t2ms != null) candidates.push(t2ms);
  if(candidates.length === 0) return null;
  return Math.min(...candidates);
}

function getRowStatus(r){
  const t1ms = parseTimeToMs(r.t1);
  const t2ms = parseTimeToMs(r.t2);
  const t1Filled = r.t1.trim() !== "";
  const t2Filled = r.t2.trim() !== "";
  const t1Valid = t1ms != null;
  const t2Valid = t2ms != null;

  // Second lap rule: only matters when filled; when filled but invalid -> warn.
  if(t2Filled && !t2Valid) return { klass: "warn", label: "Ongeldige 2e omloop" };
  if(t1Filled && !t1Valid) return { klass: "warn", label: "Ongeldige 1e omloop" };
  if(getBestTimeMs(r) != null) return { klass: "ok", label: "In klassement" };
  return { klass: "na", label: "Wacht op tijd" };
}

function renderInput(){
  elInputTbody.innerHTML = state.map(r => {
    const best = getBestTimeMs(r);
    const status = getRowStatus(r);

    return `
      <tr data-id="${r.id}">
        <td class="small">${r.id}</td>
        <td>
          <input class="inputName" type="text" value="${escapeHtml(r.name)}" data-field="name" aria-label="Naam rijder ${r.id}">
          <div style="margin-top:6px">
            <span class="badge ${status.klass}">${escapeHtml(status.label)}</span>
          </div>
        </td>
        <td>
          <input class="inputTime" inputmode="numeric" placeholder="00,000" value="${escapeHtml(r.t1)}" data-field="t1" aria-label="1e omloop rijder ${r.id}">
        </td>
        <td>
          <input class="inputTime" inputmode="numeric" placeholder="00,000" value="${escapeHtml(r.t2)}" data-field="t2" aria-label="2e omloop rijder ${r.id}">
        </td>
        <td><strong>${escapeHtml(formatMs(best))}</strong></td>
      </tr>
    `;
  }).join("");

  // Apply invalid highlighting after DOM update
  for(const tr of elInputTbody.querySelectorAll("tr")){
    const id = Number(tr.getAttribute("data-id"));
    const rider = state.find(x => x.id === id);
    if(!rider) continue;

    const t1 = tr.querySelector('input[data-field="t1"]');
    const t2 = tr.querySelector('input[data-field="t2"]');

    t1.classList.toggle("invalid", rider.t1.trim() !== "" && parseTimeToMs(rider.t1) == null);
    t2.classList.toggle("invalid", rider.t2.trim() !== "" && parseTimeToMs(rider.t2) == null);
  }
}

function renderRanking(){
  const rows = state
    .map(r => {
      const best = getBestTimeMs(r);
      const t1ms = parseTimeToMs(r.t1);
      const t2ms = (r.t2.trim() !== "" ? parseTimeToMs(r.t2) : null);
      return { ...r, best, t1ms, t2ms };
    })
    .filter(r => r.best != null)
    .sort((a,b) => a.best - b.best);

  elRankTbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td class="small"><strong>${i+1}</strong></td>
      <td>${escapeHtml(r.name || `Rijder ${r.id}`)}</td>
      <td><strong>${escapeHtml(formatMs(r.best))}</strong></td>
      <td>${escapeHtml(formatMs(r.t1ms))}</td>
      <td>${escapeHtml(formatMs(r.t2ms))}</td>
    </tr>
  `).join("");

  if(rows.length === 0){
    elRankTbody.innerHTML = `
      <tr>
        <td colspan="5" class="muted" style="padding:14px">
          Nog geen geldige tijden. Vul minimaal een 1e omloop tijd in.
        </td>
      </tr>
    `;
  }

  // Top 10 list
  const top = rows.slice(0, 10);
  elTopList.innerHTML = top.map((r, i) => `
    <li>
      <strong>#${i+1} ${escapeHtml(r.name || `Rijder ${r.id}`)}</strong>
      <span class="meta">${escapeHtml(formatMs(r.best))}</span>
    </li>
  `).join("");

  if(top.length === 0){
    elTopList.innerHTML = `<li class="muted">Nog geen tijden.</li>`;
  }
}

function rerender(){
  renderInput();
  renderRanking();
}

elInputTbody.addEventListener("input", (e) => {
  const target = e.target;
  if(!(target instanceof HTMLInputElement)) return;
  const tr = target.closest("tr");
  if(!tr) return;

  const id = Number(tr.getAttribute("data-id"));
  const rider = state.find(x => x.id === id);
  if(!rider) return;

  const field = target.getAttribute("data-field");
  if(!field) return;

  // Save
  rider[field] = target.value;

  // Re-render just status highlights + ranking.
  rerender();
});

btnReset.addEventListener("click", () => {
  for(const r of state){
    r.t1 = "";
    r.t2 = "";
  }
  rerender();
});

btnExport.addEventListener("click", () => {
  // CSV columns: pos,name,best,t1,t2
  const rows = state
    .map(r => {
      const best = getBestTimeMs(r);
      const t1ms = parseTimeToMs(r.t1);
      const t2ms = (r.t2.trim() !== "" ? parseTimeToMs(r.t2) : null);
      return { ...r, best, t1ms, t2ms };
    })
    .filter(r => r.best != null)
    .sort((a,b) => a.best - b.best)
    .map((r, i) => ({
      pos: i+1,
      name: r.name || `Rijder ${r.id}`,
      best: formatMs(r.best),
      t1: formatMs(r.t1ms),
      t2: formatMs(r.t2ms),
    }));

  const header = ["pos","naam","beste_tijd","omloop1","omloop2"];
  const csv = [
    header.join(";"),
    ...rows.map(r => [r.pos, r.name, r.best, r.t1, r.t2].map(x => `"${String(x).replaceAll('"','""')}"`).join(";"))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "klassement.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// Initial render
rerender();
