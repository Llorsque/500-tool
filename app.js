/**
 * Schaats Klassement Tool (static, no backend)
 *
 * - Linker invoertabel heeft vaste volgorde (snelste -> langzaamste op basis van omloop 1)
 * - Per rijder 2 omlopen
 * - Beste tijd = snelste geldige tijd
 * - 2e omloop telt pas mee zodra die is ingevuld én geldig (leeg = negeren)
 *
 * Belangrijk: de invoertabel wordt NIET opnieuw gerenderd bij elke toetsaanslag.
 * Daardoor kun je tijden in 1x door typen zonder dat de focus verdwijnt.
 */

const DEFAULT_RIDERS = [
  { name: "Sebas Diniz",        t1: "34,142", t2: "" },
  { name: "Jenning de Boo",     t1: "34,361", t2: "" },
  { name: "Merijn Scheperkamp", t1: "34,649", t2: "" },
  { name: "Joep Wennemars",     t1: "34,671", t2: "" },
  { name: "Tim Prins",          t1: "34,820", t2: "" },
  { name: "Kayo Vos",           t1: "34,833", t2: "" },
  { name: "Janno Botman",       t1: "34,986", t2: "" },
  { name: "Tijmen Snel",        t1: "35,038", t2: "" },
  { name: "Mats van den Bos",   t1: "35,188", t2: "" },
  { name: "Stefan Westenbroek", t1: "39,556", t2: "" },
];

const elInputTbody = document.getElementById("inputTbody");
const elRankTbody = document.getElementById("rankTbody");
const elTopList = document.getElementById("topList");
const elYear = document.getElementById("year");
const btnReset = document.getElementById("btnReset");
const btnExport = document.getElementById("btnExport");

elYear.textContent = new Date().getFullYear();

const state = DEFAULT_RIDERS.map((r, idx) => ({
  id: idx + 1,
  name: r.name,
  t1: r.t1,
  t2: r.t2,
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
 * Time format: SS,mmm (e.g. 34,142)
 * Also accept dot: SS.mmm
 * Returns integer milliseconds or null.
 */
function parseTimeToMs(raw){
  if(!raw) return null;
  const s = raw.trim();
  if(!s) return null;

  // allow '.' as decimal separator
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

  // 2e omloop telt alleen als veld gevuld is én geldig
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
          <input class="inputTime" inputmode="numeric" placeholder="00,000" value="${escapeHtml(r.t2)}" data-field="t2" aria-label="2e omloop rijder ${r.id}">
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

  if(t1) t1.classList.toggle("invalid", rider.t1.trim() !== "" && parseTimeToMs(rider.t1) == null);
  if(t2) t2.classList.toggle("invalid", rider.t2.trim() !== "" && parseTimeToMs(rider.t2) == null);

  const status = getRowStatus(rider);
  if(badge){
    badge.className = `badge ${status.klass}`;
    badge.textContent = status.label;
  }

  const best = getBestTimeMs(rider);
  if(bestCell){
    // Update ONLY this cell (inputs stay untouched -> focus stays)
    bestCell.innerHTML = `<strong>${escapeHtml(formatMs(best))}</strong>`;
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

  rider[field] = target.value;

  // Update only this row + ranking (no rebuild => focus stays)
  updateRowUI(tr, rider);
  renderRanking();
});

btnReset.addEventListener("click", () => {
  for(const r of state){
    r.t2 = ""; // reset only 2e omloop (1e omloop blijft staan)
  }

  for(const tr of elInputTbody.querySelectorAll("tr")){
    const id = Number(tr.getAttribute("data-id"));
    const rider = state.find(x => x.id === id);
    if(!rider) continue;

    const t2 = tr.querySelector('input[data-field="t2"]');
    if(t2) t2.value = "";

    updateRowUI(tr, rider);
  }

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
