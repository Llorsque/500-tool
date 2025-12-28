/**
 * Schaats Klassement Tool (static, no backend)
 *
 * - Linker invoertabel heeft vaste volgorde (snelste -> langzaamste op basis van omloop 1)
 * - Per rijder 2 omlopen
 * - Beste tijd = snelste geldige tijd
 * - 2e omloop telt pas mee zodra die is ingevuld én geldig (leeg = negeren)
 *
 * LIVE (2e omloop):
 * - Pollt een openbare bronpagina en vult automatisch de 2e omloop tijd per naam.
 * - We gebruiken Jina Reader (r.jina.ai) als "reader/proxy" zodat dit ook vanaf een statische pagina werkt.
 *   Zie: https://r.jina.ai/https://<url>  (Reader is bedoeld om webpagina’s te lezen/omzetten)
 */

const LIVE_RESULTS_URL = "https://liveresults.schaatsen.nl/events/2026_NED_0002/competition/8/results";
const LIVE_POLL_MS = 15000; // 15s (sluit aan op caching; vaker heeft weinig zin)

const DEFAULT_RIDERS = [
  { name: "Femke Kok",          t1: "36,873", t2: "" },
  { name: "Jutta Leerdam",      t1: "37,242", t2: "" },
  { name: "Isabel Grevelt",     t1: "37,460", t2: "" },
  { name: "Marrit Fledderus",   t1: "37,566", t2: "" },
  { name: "Suzanne Schulting",  t1: "37,626", t2: "" },
  { name: "Michelle de Jong",   t1: "37,686", t2: "" },
  { name: "Naomi Verkerk",      t1: "37,727", t2: "" },
  { name: "Angel Daleman",      t1: "37,791", t2: "" },
  { name: "Chloé Hoogendoorn",  t1: "37,892", t2: "" },
  { name: "Pien Hersman",       t1: "38,041", t2: "" },
  { name: "Dione Voskamp",      t1: "38,070", t2: "" },
  { name: "Pien Smit",          t1: "38,267", t2: "" },
  { name: "Jildou Hoekstra",    t1: "38,528", t2: "" },
  { name: "Selma Poutsma",      t1: "38,614", t2: "" },
  { name: "Amber Duizendstraal",t1: "38,661", t2: "" },
  { name: "Helga Drost",        t1: "38,663", t2: "" },
  { name: "Meike Veen",         t1: "38,667", t2: "" },
  { name: "Sylke Kas",          t1: "38,799", t2: "" },
  { name: "Henny de Vries",     t1: "39,348", t2: "" },
  { name: "Lotte Groenen",      t1: "39,646", t2: "" },
  { name: "Naomi Kammeraat",    t1: "39,975", t2: "" },
  { name: "Anna Boersma",       t1: "42,671", t2: "" },
];

const elInputTbody = document.getElementById("inputTbody");
const elRankTbody = document.getElementById("rankTbody");
const elTopList = document.getElementById("topList");
const elYear = document.getElementById("year");
const btnReset = document.getElementById("btnReset");
const btnExport = document.getElementById("btnExport");

// Live UI
const elLiveSource = document.getElementById("liveSource");
const elLiveStatus = document.getElementById("liveStatus");
const elLiveLast = document.getElementById("liveLast");
const elLiveCount = document.getElementById("liveCount");
const btnLiveToggle = document.getElementById("btnLiveToggle");

elYear.textContent = new Date().getFullYear();
if(elLiveSource) elLiveSource.textContent = LIVE_RESULTS_URL;

const state = DEFAULT_RIDERS.map((r, idx) => ({
  id: idx + 1,
  name: r.name,
  t1: r.t1,
  t2: r.t2,
  t2Source: "", // where t2 came from (optional)
}));

let liveEnabled = true;
let liveTimer = null;

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/** Normalize names for matching (lowercase, remove accents, collapse spaces) */
function normName(name){
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

/**
 * Time format: SS,mmm (e.g. 37,242)
 * Also accept dot: SS.mmm
 * Returns integer milliseconds or null.
 */
function parseTimeToMs(raw){
  if(!raw) return null;
  const s = raw.trim();
  if(!s) return null;

  const norm = s.replace(".", ",");
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
  const seconds = Math.floor(ms / 1000);
  const millis = ms % 1000;

  const msStr = String(millis).padStart(3, "0");
  const secStr = seconds < 100 ? String(seconds).padStart(2,"0") : String(seconds);
  return `${secStr},${msStr}`;
}

function getBestTimeMs(r){
  const t1ms = parseTimeToMs(r.t1);
  const t2ms = (r.t2.trim() !== "" ? parseTimeToMs(r.t2) : null);

  const candidates = [];
  if(t1ms != null) candidates.push(t1ms);
  if(t2ms != null) candidates.push(t2ms);

  if(candidates.length === 0) return null;
  return Math.min(...candidates);
}

function getRowStatus(r){
  const t1Filled = r.t1.trim() !== "";
  const t2Filled = r.t2.trim() !== "";

  const t1Valid = parseTimeToMs(r.t1) != null;
  const t2Valid = (t2Filled ? parseTimeToMs(r.t2) != null : true);

  if(t2Filled && !t2Valid) return { klass: "warn", label: "Ongeldige 2e omloop" };
  if(t1Filled && !t1Valid) return { klass: "warn", label: "Ongeldige 1e omloop" };
  if(getBestTimeMs(r) != null) return { klass: "ok", label: "In klassement" };
  return { klass: "na", label: "Wacht op tijd" };
}

function buildInputTable(){
  elInputTbody.innerHTML = state.map(r => {
    const best = getBestTimeMs(r);
    const status = getRowStatus(r);

    return `
      <tr data-id="${r.id}">
        <td class="small">${r.id}</td>
        <td>
          <input class="inputName" type="text" value="${escapeHtml(r.name)}" data-field="name" aria-label="Naam rijder ${r.id}">
          <div style="margin-top:6px">
            <span class="badge ${status.klass}" data-role="badge">${escapeHtml(status.label)}</span>
          </div>
        </td>
        <td>
          <input class="inputTime" inputmode="numeric" placeholder="00,000" value="${escapeHtml(r.t1)}" data-field="t1" aria-label="1e omloop rijder ${r.id}">
        </td>
        <td>
          <input class="inputTime" inputmode="numeric" placeholder="00,000" value="${escapeHtml(r.t2)}" data-field="t2" aria-label="2e omloop rijder ${r.id}" ${liveEnabled ? "readonly" : ""}>
          <div class="muted small" data-role="t2hint" style="margin-top:6px">${liveEnabled ? "Live ingevuld" : ""}</div>
        </td>
        <td data-role="best"><strong>${escapeHtml(formatMs(best))}</strong></td>
      </tr>
    `;
  }).join("");

  // initial invalid highlighting
  for(const tr of elInputTbody.querySelectorAll("tr")){
    const id = Number(tr.getAttribute("data-id"));
    const rider = state.find(x => x.id === id);
    if(!rider) continue;

    const t1 = tr.querySelector('input[data-field="t1"]');
    const t2 = tr.querySelector('input[data-field="t2"]');

    if(t1) t1.classList.toggle("invalid", rider.t1.trim() !== "" && parseTimeToMs(rider.t1) == null);
    if(t2) t2.classList.toggle("invalid", rider.t2.trim() !== "" && parseTimeToMs(rider.t2) == null);
  }
}

function updateRowUI(tr, rider){
  const t1 = tr.querySelector('input[data-field="t1"]');
  const t2 = tr.querySelector('input[data-field="t2"]');
  const badge = tr.querySelector('[data-role="badge"]');
  const bestCell = tr.querySelector('[data-role="best"]');
  const t2hint = tr.querySelector('[data-role="t2hint"]');

  if(t1) t1.classList.toggle("invalid", rider.t1.trim() !== "" && parseTimeToMs(rider.t1) == null);
  if(t2) t2.classList.toggle("invalid", rider.t2.trim() !== "" && parseTimeToMs(rider.t2) == null);

  const status = getRowStatus(rider);
  if(badge){
    badge.className = `badge ${status.klass}`;
    badge.textContent = status.label;
  }

  const best = getBestTimeMs(rider);
  if(bestCell){
    bestCell.innerHTML = `<strong>${escapeHtml(formatMs(best))}</strong>`;
  }

  if(t2 && liveEnabled){
    t2.readOnly = true;
    if(t2hint) t2hint.textContent = "Live ingevuld";
  }else{
    if(t2) t2.readOnly = false;
    if(t2hint) t2hint.textContent = "";
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

  const top = rows.slice(0, 10);
  elTopList.innerHTML = top.length
    ? top.map((r, i) => `
        <li>
          <strong>#${i+1} ${escapeHtml(r.name || `Rijder ${r.id}`)}</strong>
          <span class="meta">${escapeHtml(formatMs(r.best))}</span>
        </li>
      `).join("")
    : `<li class="muted">Nog geen tijden.</li>`;
}

/** --- Live sync --- **/

function setLivePill(kind, text){
  if(!elLiveStatus) return;
  elLiveStatus.className = `pill ${kind}`;
  elLiveStatus.textContent = text;
}

function setLastUpdate(date){
  if(!elLiveLast) return;
  if(!date){
    elLiveLast.textContent = "—";
    return;
  }
  const hh = String(date.getHours()).padStart(2,"0");
  const mm = String(date.getMinutes()).padStart(2,"0");
  const ss = String(date.getSeconds()).padStart(2,"0");
  elLiveLast.textContent = `${hh}:${mm}:${ss}`;
}

/**
 * Fetch the live results page through Jina Reader and extract (name -> time) pairs.
 * We parse very defensively: we look for occurrences of a rider name near a time pattern.
 *
 * Time patterns accepted: 00,000 or 00.000
 */
async function fetchLiveT2Map(){
  const url = `https://r.jina.ai/${LIVE_RESULTS_URL}`;
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();

  // Build a map for only the names we care about (fast + avoids false positives)
  const want = state.map(r => ({ raw: r.name, key: normName(r.name) }));

  // Pattern for time in seconds with thousandths
  const timeRe = /\b(\d{1,2})[\.,](\d{3})\b/g;

  // We'll scan line-by-line, looking for a rider name in the line,
  // and then the first time after it (or in next ~2 lines).
  const lines = text.split(/\r?\n/);

  const result = new Map(); // normName -> "SS,mmm"

  function findTimeInWindow(startIdx){
    for(let j=startIdx; j<Math.min(lines.length, startIdx+3); j++){
      const m = lines[j].match(timeRe);
      if(m && m.length){
        // pick the first time-looking match
        const t = m[0].replace(".", ",");
        if(parseTimeToMs(t) != null) return t;
      }
    }
    return null;
  }

  for(let i=0;i<lines.length;i++){
    const lineNorm = normName(lines[i]);
    if(!lineNorm) continue;

    for(const w of want){
      if(result.has(w.key)) continue;

      // Contains the name?
      if(lineNorm.includes(w.key)){
        const t = findTimeInWindow(i);
        if(t){
          result.set(w.key, t);
        }
      }
    }
  }

  return result;
}

async function runLiveOnce(){
  if(!liveEnabled) return;

  setLivePill("warn","Ophalen…");
  try{
    const map = await fetchLiveT2Map();

    let updates = 0;
    // Apply updates
    for(const r of state){
      const key = normName(r.name);
      const t2 = map.get(key);
      if(t2 && t2 !== r.t2){
        r.t2 = t2;
        r.t2Source = "live";
        updates++;
      }
    }

    // Update UI rows where changed
    if(updates > 0){
      for(const tr of elInputTbody.querySelectorAll("tr")){
        const id = Number(tr.getAttribute("data-id"));
        const rider = state.find(x => x.id === id);
        if(!rider) continue;
        const t2 = tr.querySelector('input[data-field="t2"]');
        if(t2 && t2.value !== rider.t2){
          t2.value = rider.t2; // safe: doesn't destroy focus because readonly & direct set
        }
        updateRowUI(tr, rider);
      }
    }

    renderRanking();
    setLivePill("ok", map.size ? "Live actief" : "Live actief (nog geen tijden)");
    setLastUpdate(new Date());

    if(elLiveCount){
      const prev = Number(elLiveCount.textContent || "0");
      elLiveCount.textContent = String(prev + updates);
    }
  }catch(err){
    console.error(err);
    setLivePill("bad","Fout bij ophalen");
  }
}

function startLive(){
  stopLive();
  liveEnabled = true;
  if(btnLiveToggle){
    btnLiveToggle.textContent = "Live: aan";
    btnLiveToggle.setAttribute("aria-pressed", "true");
  }
  // Make existing inputs readonly
  for(const tr of elInputTbody.querySelectorAll("tr")){
    const id = Number(tr.getAttribute("data-id"));
    const rider = state.find(x => x.id === id);
    if(rider) updateRowUI(tr, rider);
  }
  runLiveOnce();
  liveTimer = setInterval(runLiveOnce, LIVE_POLL_MS);
}

function stopLive(){
  if(liveTimer){
    clearInterval(liveTimer);
    liveTimer = null;
  }
  liveEnabled = false;
  if(btnLiveToggle){
    btnLiveToggle.textContent = "Live: uit";
    btnLiveToggle.setAttribute("aria-pressed", "false");
  }
  setLivePill("warn", "Uitgeschakeld");
  // Make inputs editable
  for(const tr of elInputTbody.querySelectorAll("tr")){
    const id = Number(tr.getAttribute("data-id"));
    const rider = state.find(x => x.id === id);
    if(!rider) continue;
    updateRowUI(tr, rider);
  }
}

if(btnLiveToggle){
  btnLiveToggle.addEventListener("click", () => {
    if(liveEnabled) stopLive();
    else startLive();
  });
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

  // If live is enabled, ignore manual edits to t2 (readonly should prevent it anyway)
  if(liveEnabled && field === "t2") return;

  rider[field] = target.value;

  updateRowUI(tr, rider);
  renderRanking();
});

btnReset.addEventListener("click", () => {
  // Reset only 2e omloop (1e omloop blijft staan)
  for(const r of state){
    r.t2 = "";
    r.t2Source = "";
  }

  for(const tr of elInputTbody.querySelectorAll("tr")){
    const id = Number(tr.getAttribute("data-id"));
    const rider = state.find(x => x.id === id);
    if(!rider) continue;

    const t2 = tr.querySelector('input[data-field="t2"]');
    if(t2) t2.value = "";

    updateRowUI(tr, rider);
  }

  if(elLiveCount) elLiveCount.textContent = "0";
  renderRanking();
});

btnExport.addEventListener("click", () => {
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
    ...rows.map(r => [r.pos, r.name, r.best, r.t1, r.t2]
      .map(x => `"${String(x).replaceAll('"','""')}"`)
      .join(";"))
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

// Init
buildInputTable();
renderRanking();

// Start live by default
if(elLiveStatus) setLivePill("warn","Verbinden…");
startLive();
