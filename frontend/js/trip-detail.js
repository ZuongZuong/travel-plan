// Trang chi tiết chuyến đi: ảnh bìa, lịch trình từng ngày, quỹ chuyến đi
const tripId = new URLSearchParams(location.search).get("id");
let trip = null;
let items = [];
let expenses = [];
let selectedDay = null;     // ngày đang xem trong lịch trình, "out" = ngoài lịch
let expenseFilter = "ALL";
let coverOpen = false;

if (Auth.requireLogin()) {
  document.addEventListener("DOMContentLoaded", init);
}

async function init() {
  if (!tripId) { window.location.replace("trips.html"); return; }
  setupTabs();
  setupItemModal();
  setupExpenseModal();
  document.addEventListener("click", onAction);

  try {
    [trip, items, expenses] = await Promise.all([
      api("/trips/" + encodeURIComponent(tripId)),
      api(`/trips/${encodeURIComponent(tripId)}/itinerary`),
      api(`/trips/${encodeURIComponent(tripId)}/expenses`)
    ]);
  } catch (err) {
    if (err.handled) return;
    if (err.status === 404) {
      await Dialog.show({ kind: "error", title: "Không tìm thấy chuyến đi", message: "Chuyến đi này đã bị xóa hoặc không thuộc tài khoản của bạn.", primary: "Về danh sách", dismissable: false });
      window.location.href = "trips.html";
    } else {
      document.querySelector("#tripHero .info").innerHTML = `<h1 class="h-display">Chưa tải được chuyến đi</h1><p class="desc">${escapeHtml(err.message)}</p>`;
      reportError(err, "Chưa tải được chuyến đi");
    }
    return;
  }

  const days = tripDayList(trip);
  const today = todayIso();
  selectedDay = days.includes(today) ? today : days[0];
  document.getElementById("tripContent").classList.remove("hidden");
  renderAll();
  showTab(location.hash === "#ngan-sach" ? "budget" : "plan", false);

  const q = new URLSearchParams(location.search);
  if (q.get("new")) showToast(trip.itineraryCount ? "Đã tạo chuyến đi từ lịch trình cộng đồng" : "Đã tạo chuyến đi. Thêm hoạt động đầu tiên nào!");
  if (q.get("saved")) showToast("Đã lưu thay đổi");
  if (q.get("new") || q.get("saved")) history.replaceState(null, "", "trip.html?id=" + trip.id + location.hash);
}

function renderAll() {
  document.title = trip.name + " - travelplan";
  document.querySelectorAll(".trip-name").forEach((el) => { el.textContent = trip.name; });
  renderHero();
  renderPlan();
  renderBudget();
}

async function reloadTrip() {
  trip = await api("/trips/" + trip.id);
}

// ===== Tabs Lịch trình | Ngân sách =====
function setupTabs() {
  document.getElementById("tabPlan").addEventListener("click", () => showTab("plan"));
  document.getElementById("tabBudget").addEventListener("click", () => showTab("budget"));
  document.querySelector(".seg").addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const toBudget = document.getElementById("tabPlan").getAttribute("aria-selected") === "true";
      showTab(toBudget ? "budget" : "plan");
      document.getElementById(toBudget ? "tabBudget" : "tabPlan").focus();
    }
  });
}
function showTab(name, updateHash = true) {
  const budget = name === "budget";
  document.getElementById("tabPlan").setAttribute("aria-selected", String(!budget));
  document.getElementById("tabBudget").setAttribute("aria-selected", String(budget));
  document.getElementById("tabPlan").tabIndex = budget ? -1 : 0;
  document.getElementById("tabBudget").tabIndex = budget ? 0 : -1;
  document.getElementById("viewPlan").classList.toggle("hidden", budget);
  document.getElementById("viewBudget").classList.toggle("hidden", !budget);
  if (updateHash) history.replaceState(null, "", "trip.html?id=" + trip.id + (budget ? "#ngan-sach" : ""));
}

// ===== Một chỗ xử lý mọi nút có data-action =====
function onAction(e) {
  const el = e.target.closest("[data-action]");
  if (!el || !trip) return;
  const id = Number(el.dataset.id);
  switch (el.dataset.action) {
    case "toggle-cover":
      coverOpen = !coverOpen;
      renderHero();
      document.querySelector(coverOpen ? "#coverPop button" : '[data-action="toggle-cover"]').focus();
      break;
    case "pick-color": setCover({ coverColor: el.dataset.color, coverImageUrl: null }); break;
    case "use-url": useCoverUrl(); break;
    case "delete-trip": deleteTrip(); break;
    case "pick-day": selectedDay = el.dataset.day; renderPlan(); document.querySelector(`.day-tab[data-day="${selectedDay}"]`)?.focus(); break;
    case "add-item": openItemModal(null, selectedDay && selectedDay !== "out" ? selectedDay : null); break;
    case "edit-item": openItemModal(items.find((i) => i.id === id)); break;
    case "delete-item": deleteItem(id); break;
    case "add-expense": openExpenseModal(null); break;
    case "edit-expense": openExpenseModal(expenses.find((x) => x.id === id)); break;
    case "delete-expense": deleteExpense(id); break;
    case "go-budget": showTab("budget"); document.getElementById("tabBudget").focus(); break;
    case "filter": expenseFilter = el.dataset.cat; renderBudget(); document.querySelector(`[data-action="filter"][data-cat="${expenseFilter}"]`)?.focus(); break;
    case "edit-budget": editBudget(); break;
  }
}

// ===== Phần đầu trang + ảnh bìa =====
function renderHero() {
  const hero = document.getElementById("tripHero");
  const look = coverLook(trip);
  hero.setAttribute("style", look.style);
  const st = tripStatus(trip);
  const swatches = COVER_COLORS.map((c) => {
    const on = !isSafeImageUrl(trip.coverImageUrl) && String(trip.coverColor || "").toLowerCase() === c.value.toLowerCase();
    return `<button type="button" class="swatch" style="background:${c.value}" data-action="pick-color" data-color="${c.value}" aria-label="Màu ${c.label}" aria-pressed="${on}"></button>`;
  }).join("");
  hero.innerHTML = `
    <div class="info">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="tag ${st.key === "past" ? "tag-grey" : look.chip}">${escapeHtml(st.key === "upcoming" ? "Sắp đi · " + st.label.toLowerCase() : st.label)}</span>
        <span class="tag tag-outline">${lengthLong(trip.days)}</span>
        ${trip.isPublic ? `<span class="tag tag-outline">Đang chia sẻ công khai</span>` : ""}
      </div>
      <h1 class="h-display">${escapeHtml(trip.name)}</h1>
      <div class="facts">
        <span>${svg(ICON.pin, 18)} ${escapeHtml(trip.destination)}</span>
        <span>${svg(ICON.calendar, 18)} ${trip.days > 1 ? dayLong(trip.startDate) + " – " + dayLong(trip.endDate) : dayLong(trip.startDate)}</span>
      </div>
      ${trip.description ? `<p class="desc">${escapeHtml(trip.description)}</p>` : ""}
    </div>
    <div class="actions">
      <button type="button" class="btn btn-lime" data-action="toggle-cover" aria-expanded="${coverOpen}" aria-controls="coverPop">${svg(ICON.image, 18)} Ảnh bìa</button>
      <a class="btn" href="trip-form.html?id=${trip.id}">Sửa chuyến đi</a>
      <button type="button" class="del" data-action="delete-trip" aria-label="Xóa chuyến đi" title="Xóa chuyến đi">${svg(ICON.trash, 18)}</button>
    </div>
    ${coverOpen ? `
    <div class="popover" id="coverPop" role="dialog" aria-label="Ảnh bìa">
      <div class="row-between">
        <h3>Ảnh bìa</h3>
        <button type="button" class="icon-btn bordered" data-action="toggle-cover" aria-label="Đóng">${svg(ICON.close, 16, 2.4)}</button>
      </div>
      <label class="dropzone" id="dropzone">
        ${svg(ICON.upload, 28)}
        <span style="font-weight:700">Kéo thả ảnh vào đây</span>
        <span style="font-size:14px">hoặc <span style="text-decoration:underline;font-weight:700;color:var(--violet)">chọn từ máy</span></span>
        <span class="muted" style="font-size:12px">JPG, PNG, WEBP · tối đa 5MB</span>
        <input id="coverFile" type="file" accept="image/jpeg,image/png,image/webp">
      </label>
      <div class="field" style="gap:6px">
        <label for="coverUrl" style="font-size:13px;color:var(--muted)">Hoặc dán link ảnh</label>
        <div style="display:flex;gap:8px">
          <input class="input" id="coverUrl" type="url" placeholder="https://..." maxlength="500" style="min-height:44px;border-radius:14px;padding:10px 14px"
                 value="${isSafeImageUrl(trip.coverImageUrl) && !trip.coverImageUrl.includes("/api/public/uploads/") ? escapeHtml(trip.coverImageUrl) : ""}">
          <button type="button" class="btn btn-dark btn-sm" style="border-radius:14px;min-height:44px" data-action="use-url">Dùng</button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <span style="font-size:13px;font-weight:700;color:var(--muted)">Hoặc dùng màu</span>
        <div class="swatches">${swatches}</div>
      </div>
    </div>` : ""}`;
  if (coverOpen) bindCoverUpload();
}

function bindCoverUpload() {
  const zone = document.getElementById("dropzone");
  const file = document.getElementById("coverFile");
  const pop = document.getElementById("coverPop");
  file.addEventListener("change", () => { if (file.files[0]) uploadCover(file.files[0]); });
  ["dragenter", "dragover"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("drag"); }));
  zone.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) uploadCover(f); });
  pop.addEventListener("keydown", (e) => { if (e.key === "Escape") { coverOpen = false; renderHero(); document.querySelector('[data-action="toggle-cover"]').focus(); } });
}

async function uploadCover(f) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
    return Dialog.show({ kind: "error", title: "File này không phải ảnh", message: "Chọn ảnh định dạng JPG, PNG hoặc WEBP nhé.", primary: "Chọn ảnh khác" });
  }
  if (f.size > 5 * 1024 * 1024) {
    return Dialog.show({ kind: "error", title: "Ảnh quá nặng", message: `Ảnh bạn chọn nặng ${(f.size / 1024 / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}MB. Chọn ảnh dưới 5MB, định dạng JPG hoặc PNG.`, primary: "Chọn ảnh khác" });
  }
  const zone = document.getElementById("dropzone");
  if (zone) zone.querySelector("span").textContent = "Đang tải ảnh lên...";
  const fd = new FormData();
  fd.append("file", f);
  try {
    trip = await api(`/trips/${trip.id}/cover/upload`, { method: "POST", body: fd });
    coverOpen = false;
    renderHero();
    showToast("Đã đổi ảnh bìa");
  } catch (err) {
    renderHero();
    reportError(err, "Chưa đổi được ảnh bìa");
  }
}

async function useCoverUrl() {
  const input = document.getElementById("coverUrl");
  const url = input.value.trim();
  if (!isSafeImageUrl(url) || url.length > 500) {
    return FieldError.fail(input, "Link ảnh không dùng được", "Link phải bắt đầu bằng http:// hoặc https:// và không quá 500 ký tự.", "Sửa link");
  }
  // Thử tải ảnh trước để báo sớm nếu link hỏng
  const ok = await new Promise((resolve) => {
    const img = new Image();
    const t = setTimeout(() => resolve(false), 8000);
    img.onload = () => { clearTimeout(t); resolve(true); };
    img.onerror = () => { clearTimeout(t); resolve(false); };
    img.src = url;
  });
  if (!ok) {
    const go = await Dialog.show({ kind: "warn", title: "Không xem được ảnh từ link này", message: "Link có thể sai, đã hết hạn hoặc trang đó chặn nhúng ảnh. Bìa sẽ chỉ hiện màu nền.", primary: "Vẫn dùng", secondary: "Đổi link" });
    if (!go) { input.focus(); return; }
  }
  setCover({ coverImageUrl: url, coverColor: trip.coverColor || null });
}

async function setCover(body) {
  try {
    trip = await api(`/trips/${trip.id}/cover`, { method: "PUT", body });
    coverOpen = false;
    renderHero();
    showToast("Đã đổi ảnh bìa");
  } catch (err) {
    reportError(err, "Chưa đổi được ảnh bìa");
  }
}

async function deleteTrip() {
  const ok = await Dialog.show({
    kind: "confirm",
    title: `Xóa chuyến "${trip.name}"?`,
    message: "Bạn có thực sự muốn xóa chuyến đi này? Những thứ sau cũng sẽ bị xóa theo và không thể khôi phục:",
    facts: [
      [`Lịch trình ${trip.days} ngày`, `${items.length} hoạt động`],
      ["Khoản chi", `${expenses.length} khoản · ${vnd(totalSpent())}`]
    ],
    primary: "Xóa chuyến đi",
    secondary: "Giữ lại",
    onPrimary: async () => {
      try {
        await api("/trips/" + trip.id, { method: "DELETE" });
        return true;
      } catch (err) {
        await reportError(err, "Chưa xóa được chuyến đi");
        return false;
      }
    }
  });
  if (ok) window.location.href = "trips.html";
}

// ===== Lịch trình =====
function timeRange(i) {
  if (!i.startTime) return "Cả ngày";
  return i.endTime ? i.startTime + " – " + i.endTime : "Từ " + i.startTime;
}
function sortItems(list) {
  return list.slice().sort((a, b) => (a.startTime || "99").localeCompare(b.startTime || "99") || a.id - b.id);
}

function renderPlan() {
  const days = tripDayList(trip);
  const outside = items.filter((i) => !days.includes(i.dayDate));
  if (selectedDay === "out" && !outside.length) selectedDay = days[0];
  document.getElementById("dayTabs").innerHTML = days.map((d, idx) => {
    const n = items.filter((i) => i.dayDate === d).length;
    return `<button type="button" class="day-tab" role="tab" data-action="pick-day" data-day="${d}" aria-selected="${d === selectedDay}"
      aria-label="Ngày ${idx + 1}, ${dayLong(d)}, ${n} hoạt động" tabindex="${d === selectedDay ? 0 : -1}">
      <b>Ngày ${idx + 1}</b><span>${dayShort(d)}${n ? " · " + n : ""}</span></button>`;
  }).join("") + (outside.length ? `<button type="button" class="day-tab out" role="tab" data-action="pick-day" data-day="out" aria-selected="${selectedDay === "out"}">
      <b>Ngoài lịch</b><span>${outside.length} hoạt động</span></button>` : "");

  renderPlanSide();
  const tl = document.getElementById("timeline");
  if (selectedDay === "out") {
    tl.innerHTML = `<p class="muted" style="margin:0">Các hoạt động này thuộc những ngày không còn nằm trong chuyến đi. Sửa để chọn ngày mới, hoặc xóa đi.</p>` +
      sortItems(outside).map((i) => itemRow(i, ddmm(i.dayDate))).join("");
    return;
  }
  const list = sortItems(items.filter((i) => i.dayDate === selectedDay));
  tl.innerHTML = list.length ? list.map((i) => itemRow(i)).join("") : `
    <div class="empty-box">
      <p style="margin:0 0 12px;font-weight:700">${dayLong(selectedDay)} còn trống trơn.</p>
      <button type="button" class="btn btn-lime" data-action="add-item">${svg(ICON.plus, 18, 2.6)} Thêm hoạt động cho ngày này</button>
    </div>`;
}

function itemRow(i, badge) {
  return `
    <div class="tl-row">
      <div class="tl-rail">
        <span class="tl-time ${i.startTime && !badge ? "" : "none"}">${badge || i.startTime || "Cả ngày"}</span>
        <span class="tl-line"></span>
      </div>
      <article class="card tl-card">
        <div style="min-width:0;display:flex;flex-direction:column;gap:6px">
          <div class="range">${timeRange(i)}</div>
          <h3>${escapeHtml(i.activity)}</h3>
          ${i.location ? `<div class="loc">${svg(ICON.pin, 16)} ${escapeHtml(i.location)}</div>` : ""}
          ${i.note ? `<p class="note">${escapeHtml(i.note)}</p>` : ""}
        </div>
        <div class="acts">
          <button type="button" class="icon-btn" data-action="edit-item" data-id="${i.id}" aria-label="Sửa ${escapeHtml(i.activity)}">${svg(ICON.edit, 18)}</button>
          <button type="button" class="icon-btn" data-action="delete-item" data-id="${i.id}" aria-label="Xóa ${escapeHtml(i.activity)}">${svg(ICON.trash, 18)}</button>
        </div>
      </article>
    </div>`;
}

async function deleteItem(id) {
  const it = items.find((i) => i.id === id);
  if (!it) return;
  const days = tripDayList(trip);
  const idx = days.indexOf(it.dayDate);
  const ok = await Dialog.show({
    kind: "confirm", title: "Xóa hoạt động này?",
    message: `"${it.activity}" sẽ bị xóa khỏi ${idx >= 0 ? "Ngày " + (idx + 1) : "lịch trình"}.`,
    primary: "Xóa", secondary: "Hủy"
  });
  if (!ok) return;
  try {
    await api(`/trips/${trip.id}/itinerary/${id}`, { method: "DELETE" });
    items = items.filter((i) => i.id !== id);
    trip.itineraryCount = items.length;
    renderPlan();
    showToast("Đã xóa hoạt động");
  } catch (err) {
    reportError(err, "Chưa xóa được hoạt động");
  }
}

// ===== Cột quỹ bên cạnh lịch trình =====
function totalSpent() { return expenses.reduce((a, x) => a + Number(x.amount), 0); }

function byCategory() {
  const map = {};
  expenses.forEach((x) => { map[x.category] = (map[x.category] || 0) + Number(x.amount); });
  return map;
}

function renderPlanSide() {
  const spent = totalSpent();
  const budget = Number(trip.budget || 0);
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const cats = Object.entries(byCategory()).sort((a, b) => b[1] - a[1]);
  const max = cats.length ? cats[0][1] : 0;
  const recent = expenses.slice().sort((a, b) => b.id - a.id).slice(0, 4);
  document.getElementById("planSide").innerHTML = `
    <h2 class="h-display section-title">Quỹ chuyến đi</h2>
    <div class="fund-card">
      <div style="font-weight:600;font-size:14px;opacity:.85">Đã chi</div>
      <div class="big">${vnd(spent)}</div>
      ${budget > 0 ? `
        <div style="font-size:14px">trên ngân sách ${vnd(budget)}</div>
        <div class="fund-track ${spent > budget ? "over" : ""}" role="img" aria-label="Đã chi ${pct}% ngân sách"><div style="width:${pct}%"></div></div>
        <div class="row-between" style="font-weight:700;font-size:15px"><span>${spent > budget ? "Vượt ngân sách" : "Còn lại"}</span><span>${vnd(Math.abs(budget - spent))}</span></div>`
      : `<div style="font-size:14px">Chưa đặt ngân sách cho chuyến này.</div>`}
      <button type="button" class="btn btn-outline-light btn-sm" style="align-self:flex-start;color:#fff" data-action="go-budget">Xem quỹ chi tiết</button>
    </div>
    ${cats.length ? `
    <div class="card card-pad" style="display:flex;flex-direction:column;gap:14px">
      <h3 style="margin:0;font-size:18px">Tiền đi đâu?</h3>
      ${cats.map(([k, v]) => `
        <div style="display:flex;flex-direction:column;gap:6px">
          <div class="row-between" style="font-size:14px;font-weight:600"><span>${CATEGORIES[k].label}</span><span>${vnd(v)}</span></div>
          <div class="bar-soft"><div style="width:${Math.max(3, Math.round((v / max) * 100))}%"></div></div>
        </div>`).join("")}
    </div>` : ""}
    <div class="card card-pad" style="display:flex;flex-direction:column;gap:4px">
      <div class="row-between">
        <h3 style="margin:0;font-size:18px">Khoản chi gần đây</h3>
        <button type="button" class="btn btn-lime btn-sm" data-action="add-expense">+ Thêm</button>
      </div>
      ${recent.length ? recent.map((x) => `
        <div class="list-row">
          <div class="grow"><div class="t" style="font-weight:600">${escapeHtml(x.description)}</div>
            <div class="s">${CATEGORIES[x.category].label}${x.expenseDate ? " · " + ddmm(x.expenseDate) : ""}</div></div>
          <div class="amt">${vnd(x.amount)}</div>
        </div>`).join("") : `<p class="muted" style="margin:8px 0 0">Chưa có khoản chi nào.</p>`}
    </div>`;
}

// ===== Tab Ngân sách =====
function expenseGroupKey(x) {
  if (!x.expenseDate) return { key: "zz", title: "Chưa ghi ngày" };
  if (x.expenseDate < trip.startDate) return { key: "0", title: "Trước chuyến đi" };
  if (x.expenseDate > trip.endDate) return { key: "z", title: "Sau chuyến đi" };
  const n = diffDays(trip.startDate, x.expenseDate) + 1;
  return { key: "1" + x.expenseDate, title: `Ngày ${n} · ${WD_LONG[parseDate(x.expenseDate).getDay()]}, ${ddmm(x.expenseDate)}` };
}

function renderBudget() {
  const box = document.getElementById("viewBudget");
  const spent = totalSpent();
  const budget = Number(trip.budget || 0);
  const hasBudget = budget > 0;
  const remaining = budget - spent;
  const pct = hasBudget ? Math.round((spent / budget) * 100) : 0;
  const today = todayIso();
  const ended = trip.endDate < today;

  // Thẻ nhỏ: mỗi ngày còn tiêu được / trung bình mỗi ngày
  let perDay;
  if (hasBudget && !ended && remaining > 0) {
    const from = today > trip.startDate ? today : trip.startDate;
    const left = diffDays(from, trip.endDate) + 1;
    perDay = { k: "Mỗi ngày còn tiêu được", v: vnd(remaining / left), s: `${vnd(remaining)} chia cho ${left} ngày${today > trip.startDate ? " còn lại" : ""}` };
  } else {
    perDay = { k: "Trung bình mỗi ngày", v: vnd(spent / trip.days), s: `${vnd(spent)} chia cho ${trip.days} ngày` };
  }
  const biggest = expenses.slice().sort((a, b) => b.amount - a.amount)[0];

  let status;
  if (!hasBudget) status = { text: "Chưa đặt ngân sách", cls: "tag-grey" };
  else if (remaining < 0) status = { text: "Vượt ngân sách", cls: "" , style: "background:#FF4D2E;color:#fff" };
  else if (pct >= 90) status = { text: "Sắp hết quỹ", cls: "", style: "background:#FFE58A;color:#16131F" };
  else status = { text: "Đang trong ngân sách", cls: "tag-lime" };

  // Chi theo ngày
  const cols = [];
  const pre = expenses.filter((x) => x.expenseDate && x.expenseDate < trip.startDate);
  if (pre.length) cols.push({ label: "Trước chuyến", v: sum(pre) });
  const days = tripDayList(trip);
  days.forEach((d) => cols.push({ label: days.length <= 5 ? WD_SHORT[parseDate(d).getDay()] + " " + ddmm(d) : ddmm(d), v: sum(expenses.filter((x) => x.expenseDate === d)), day: true }));
  const post = expenses.filter((x) => x.expenseDate && x.expenseDate > trip.endDate);
  if (post.length) cols.push({ label: "Sau chuyến", v: sum(post) });
  const undated = expenses.filter((x) => !x.expenseDate);
  if (undated.length) cols.push({ label: "Chưa ghi ngày", v: sum(undated) });
  const daily = hasBudget ? budget / trip.days : 0;
  const scale = Math.max(daily, ...cols.map((c) => c.v), 1) * 1.15;
  const H = 170;

  // Danh sách khoản chi
  const shown = expenses.filter((x) => expenseFilter === "ALL" || x.category === expenseFilter);
  const groups = {};
  shown.forEach((x) => {
    const g = expenseGroupKey(x);
    (groups[g.key] = groups[g.key] || { title: g.title, list: [] }).list.push(x);
  });
  const groupHtml = Object.keys(groups).sort().map((k) => {
    const g = groups[k];
    return `<div style="display:flex;flex-direction:column">
      <div class="group-head"><span>${g.title}</span><span>${vnd(sum(g.list))}</span></div>
      ${g.list.sort((a, b) => a.id - b.id).map((x) => `
        <div class="list-row">
          <span class="cat-icon">${svg(CATEGORIES[x.category].icon, 20)}</span>
          <div class="grow"><div class="t">${escapeHtml(x.description)}</div>
            <div class="s">${CATEGORIES[x.category].label}${x.expenseDate && (x.expenseDate < trip.startDate || x.expenseDate > trip.endDate) ? " · " + ddmmyyyy(x.expenseDate) : ""}</div></div>
          <span class="amt">${vnd(x.amount)}</span>
          <button type="button" class="icon-btn" data-action="edit-expense" data-id="${x.id}" aria-label="Sửa ${escapeHtml(x.description)}">${svg(ICON.edit, 18)}</button>
          <button type="button" class="icon-btn" data-action="delete-expense" data-id="${x.id}" aria-label="Xóa ${escapeHtml(x.description)}">${svg(ICON.trash, 18)}</button>
        </div>`).join("")}
    </div>`;
  }).join("");

  const cats = byCategory();
  const catMax = Math.max(0, ...Object.values(cats));

  box.innerHTML = `
    <div class="budget-top">
      <div class="fund-card budget-hero">
        <div class="row-between">
          <span style="font-weight:600;opacity:.85">${!hasBudget ? "Đã chi" : remaining < 0 ? "Đã vượt ngân sách" : "Còn lại để tiêu"}</span>
          <span class="tag ${status.cls}" style="${status.style || ""}">${status.text}</span>
        </div>
        <div class="big">${vnd(hasBudget ? Math.abs(remaining) : spent)}</div>
        ${hasBudget ? `
          <div style="display:flex;flex-direction:column;gap:8px">
            <div class="fund-track ${remaining < 0 ? "over" : ""}" style="height:16px" role="img" aria-label="Đã chi ${pct}% ngân sách"><div style="width:${Math.min(100, pct)}%"></div></div>
            <div class="row-between" style="font-size:14px;font-weight:600"><span>Đã chi ${vnd(spent)} · ${pct}%</span><span>Ngân sách ${vnd(budget)}</span></div>
          </div>` : `<div style="font-size:14px">Đặt ngân sách để biết mỗi ngày còn tiêu được bao nhiêu.</div>`}
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" class="btn btn-lime" data-action="add-expense">${svg(ICON.plus, 18, 2.6)} Thêm khoản chi</button>
          <button type="button" class="btn btn-outline-light" style="color:#fff" data-action="edit-budget">${hasBudget ? "Sửa ngân sách" : "Đặt ngân sách"}</button>
        </div>
      </div>
      <div class="stat-col">
        <div class="card stat"><span class="k">${perDay.k}</span><span class="v">${perDay.v}</span><span class="s">${perDay.s}</span></div>
        <div class="card stat"><span class="k">Khoản chi lớn nhất</span>
          ${biggest ? `<span class="v">${vnd(biggest.amount)}</span><span class="s">${escapeHtml(biggest.description)} · ${CATEGORIES[biggest.category].label}</span>`
                    : `<span class="v">0đ</span><span class="s">Chưa có khoản chi nào</span>`}</div>
      </div>
    </div>

    <div class="budget-grid">
      <section class="card card-pad" style="padding:24px;display:flex;flex-direction:column;gap:16px">
        <h2 class="panel-title">Tiền đi đâu?</h2>
        ${Object.keys(CATEGORIES).map((k) => ({ k, v: cats[k] || 0 })).sort((a, b) => b.v - a.v).map(({ k, v }) => `
          <div style="display:flex;gap:12px;align-items:center">
            <span class="cat-icon soft">${svg(CATEGORIES[k].icon, 18)}</span>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
              <div class="row-between" style="font-size:14px;gap:8px">
                <span style="font-weight:700">${CATEGORIES[k].label}</span>
                <span><strong>${vnd(v)}</strong> <span class="muted">· ${spent ? Math.round((v / spent) * 100) : 0}%</span></span>
              </div>
              <div class="bar-soft"><div style="width:${v ? Math.max(3, Math.round((v / catMax) * 100)) : 0}%"></div></div>
            </div>
          </div>`).join("")}
      </section>

      <section class="card card-pad" style="padding:24px;display:flex;flex-direction:column;gap:16px">
        <div class="row-between" style="align-items:baseline">
          <h2 class="panel-title">Chi theo ngày</h2>
          ${hasBudget ? `<span class="muted" style="display:inline-flex;align-items:center;gap:6px;font-size:13px"><span style="width:18px;border-top:2px dashed var(--ink)"></span>Mức ${shortMoney(daily)}/ngày</span>` : ""}
        </div>
        <div class="chart" role="img" aria-label="Biểu đồ chi theo ngày: ${cols.map((c) => c.label + " " + vnd(c.v)).join(", ")}">
          ${hasBudget ? `<div class="line" style="bottom:${Math.round((daily / scale) * H)}px"></div>` : ""}
          ${cols.map((c) => `
            <div class="col" title="${escapeHtml(c.label)}: ${vnd(c.v)}">
              <span class="val">${c.v ? shortMoney(c.v) : "–"}</span>
              <div class="b ${hasBudget && c.day && c.v > daily ? "over" : ""}" style="height:${Math.round((c.v / scale) * H)}px;${c.v ? "" : "background:transparent"}"></div>
            </div>`).join("")}
        </div>
        <div class="chart-labels">${cols.map((c) => `<span>${c.label}</span>`).join("")}</div>
        ${pre.length ? `<p class="muted" style="margin:0;font-size:13px">"Trước chuyến" gồm các khoản trả trước như đặt phòng, vé xe.</p>` : ""}
      </section>
    </div>

    <section class="card card-pad" style="padding:24px;display:flex;flex-direction:column;gap:16px">
      <div class="row-between">
        <h2 class="panel-title">Các khoản chi <span class="muted" style="font-size:18px">· ${shown.length}</span></h2>
        <button type="button" class="btn btn-dark btn-sm" data-action="add-expense">+ Thêm khoản chi</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap" role="group" aria-label="Lọc theo loại">
        ${[["ALL", "Tất cả"]].concat(Object.entries(CATEGORIES).map(([k, c]) => [k, c.label])).map(([k, l]) =>
          `<button type="button" class="chip" data-action="filter" data-cat="${k}" aria-pressed="${expenseFilter === k}">${l}</button>`).join("")}
      </div>
      ${shown.length ? groupHtml : `<p class="muted" style="margin:0">${expenses.length ? "Không có khoản chi nào thuộc loại này." : "Chưa có khoản chi nào. Bấm \"Thêm khoản chi\" để bắt đầu canh quỹ."}</p>`}
    </section>`;
}

function sum(list) { return list.reduce((a, x) => a + Number(x.amount), 0); }

function tripBody(overrides) {
  return Object.assign({
    name: trip.name, destination: trip.destination, destinationAddress: trip.destinationAddress,
    latitude: trip.latitude, longitude: trip.longitude, startDate: trip.startDate, endDate: trip.endDate,
    budget: trip.budget, description: trip.description, isPublic: trip.isPublic
  }, overrides);
}

async function editBudget() {
  const body = document.createElement("div");
  body.className = "field";
  body.innerHTML = `
    <label for="budgetInput">Ngân sách cho cả chuyến</label>
    <div class="input-group"><input id="budgetInput" inputmode="numeric" placeholder="Ví dụ 6.000.000"><span class="addon">VND</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${[2, 5, 10, 20].map((m) => `<button type="button" class="chip sm" data-m="${m * 1e6}">${m} triệu</button>`).join("")}
    </div>`;
  const input = body.querySelector("input");
  let value = trip.budget != null ? Number(trip.budget) : null;
  if (value != null) input.value = value.toLocaleString("vi-VN");
  bindMoneyInput(input, (v) => { value = v; });
  body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-m]");
    if (b) { value = Number(b.dataset.m); input.value = value.toLocaleString("vi-VN"); }
  });
  await Dialog.show({
    kind: "info", title: "Ngân sách chuyến đi",
    message: `Đã chi ${vnd(totalSpent())}. Để trống nếu không muốn đặt ngân sách.`,
    body, primary: "Lưu ngân sách", secondary: "Hủy",
    onPrimary: async () => {
      try {
        trip = await api("/trips/" + trip.id, { method: "PUT", body: tripBody({ budget: value }) });
        renderAll();
        showToast("Đã lưu ngân sách");
        return true;
      } catch (err) {
        await reportError(err, "Chưa lưu được ngân sách");
        return false;
      }
    }
  });
}

// ===== Modal chung: đóng bằng nút, bấm nền, phím Esc; hỏi lại nếu đang nhập dở =====
function bindModal(modalId, isDirty) {
  const modal = document.getElementById(modalId);
  const tryClose = async () => {
    if (isDirty()) {
      const leave = await Dialog.show({ kind: "warn", title: "Bỏ các thay đổi?", message: "Bạn có thay đổi chưa lưu. Nếu đóng bây giờ thì sẽ mất hết.", primary: "Bỏ thay đổi", secondary: "Ở lại" });
      if (!leave) return;
    }
    closeModal(modalId);
  };
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest("[data-close]")) tryClose();
  });
  modal.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); tryClose(); } });
}
let lastOpener = null;
function openModal(id) {
  lastOpener = document.activeElement;
  const m = document.getElementById(id);
  m.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  m.scrollTop = 0;
}
function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
  document.body.style.overflow = "";
  if (lastOpener && lastOpener.isConnected) lastOpener.focus();
}

// ===== Modal hoạt động =====
let itemEditing = null;
let itemDay = null;
let itemSnapshot = "";
let startPicker, endPicker;

function setupItemModal() {
  startPicker = TimeField(document.getElementById("iStartField"), {
    id: "iStartBtn", label: "Giờ bắt đầu", placeholder: "Chưa chọn giờ",
    presets: [["Sáng sớm", "05:00"], ["Sáng", "08:00"], ["Trưa", "12:00"], ["Chiều", "14:00"], ["Tối", "19:00"]],
    onChange: () => { if (endPicker.value && startPicker.value && endPicker.value <= startPicker.value) { /* báo khi lưu */ } }
  });
  endPicker = TimeField(document.getElementById("iEndField"), {
    id: "iEndBtn", label: "Giờ kết thúc", placeholder: "Chưa chọn giờ",
    fallback: () => startPicker.value ? fromMinutes(toMinutes(startPicker.value) + 60) : "10:00",
    durations: () => startPicker.value ? [["+30 phút", 30], ["+1 giờ", 60], ["+2 giờ", 120], ["+3 giờ", 180]]
      .map(([l, v]) => [l, fromMinutes(toMinutes(startPicker.value) + v)]) : []
  });
  startPicker.button.setAttribute("aria-labelledby", "iStartLbl iStartBtn");
  endPicker.button.setAttribute("aria-labelledby", "iEndLbl iEndBtn");

  document.getElementById("itemDays").addEventListener("click", (e) => {
    const b = e.target.closest("[data-day]");
    if (!b) return;
    itemDay = b.dataset.day;
    FieldError.clear(document.getElementById("itemDays"));
    paintItemDays();
  });
  const form = document.getElementById("itemForm");
  form.addEventListener("submit", (e) => { e.preventDefault(); saveItem(false); });
  document.getElementById("itemSaveMore").addEventListener("click", () => saveItem(true));
  bindModal("itemModal", () => itemSnapshot !== itemState());
}

function itemState() {
  const f = document.getElementById("itemForm");
  return JSON.stringify([itemDay, f.activity.value.trim(), startPicker.value, endPicker.value, f.location.value.trim(), f.note.value.trim()]);
}

function paintItemDays() {
  const days = tripDayList(trip);
  document.getElementById("itemDays").innerHTML = days.map((d, i) =>
    `<button type="button" data-day="${d}" aria-pressed="${d === itemDay}"><b>Ngày ${i + 1}</b><span>${dayShort(d)}</span></button>`).join("");
}

function openItemModal(item, day) {
  const form = document.getElementById("itemForm");
  FieldError.clearAll(form);
  itemEditing = item || null;
  const days = tripDayList(trip);
  itemDay = item ? (days.includes(item.dayDate) ? item.dayDate : null) : (day || days[0]);
  document.getElementById("itemTitle").textContent = item ? "Sửa hoạt động" : "Thêm hoạt động";
  document.getElementById("itemSaveMore").classList.toggle("hidden", !!item);
  form.activity.value = item ? item.activity : "";
  form.location.value = item ? item.location || "" : "";
  form.note.value = item ? item.note || "" : "";
  startPicker.close(); endPicker.close();
  startPicker.set(item ? item.startTime : null);
  endPicker.set(item ? item.endTime : null);
  paintItemDays();
  itemSnapshot = itemState();
  openModal("itemModal");
  form.activity.focus();
  if (item && !itemDay) {
    Dialog.show({ kind: "info", title: "Chọn ngày mới cho hoạt động", message: `Ngày cũ (${ddmmyyyy(item.dayDate)}) không còn nằm trong chuyến đi. Chọn một ngày từ ${ddmm(trip.startDate)} đến ${ddmm(trip.endDate)} nhé.`, primary: "Chọn ngày" });
  }
}

async function saveItem(more) {
  const form = document.getElementById("itemForm");
  FieldError.clearAll(form);
  const activity = form.activity.value.trim();
  const s = startPicker.value, e = endPicker.value;
  if (!itemDay) return FieldError.fail(document.getElementById("itemDays"), "Ngày này không thuộc chuyến đi", `Chuyến đi từ ${ddmm(trip.startDate)} đến ${ddmm(trip.endDate)}. Chọn một ngày trong khoảng đó nhé.`, "Chọn lại ngày");
  if (!activity) return FieldError.fail(form.activity, "Chưa nhập hoạt động", "Cho biết bạn sẽ làm gì, ví dụ \"Săn mây Cầu Đất\".");
  if (e && !s) return FieldError.fail(startPicker.button, "Thiếu giờ bắt đầu", "Có giờ kết thúc thì cần cả giờ bắt đầu nhé. Hoặc bấm \"Bỏ giờ\" ở giờ kết thúc.", "Chọn giờ");
  if (s && e && e <= s) return FieldError.fail(endPicker.button, "Giờ kết thúc chưa đúng", `Hoạt động bắt đầu lúc ${s} nên phải kết thúc sau ${s}.`, "Chọn lại giờ");

  // Cảnh báo trùng giờ với hoạt động khác cùng ngày
  if (s) {
    const a1 = toMinutes(s), a2 = e ? toMinutes(e) : a1 + 1;
    const clash = items.find((o) => o.dayDate === itemDay && o.startTime && (!itemEditing || o.id !== itemEditing.id) &&
      a1 < (o.endTime ? toMinutes(o.endTime) : toMinutes(o.startTime) + 1) && toMinutes(o.startTime) < a2);
    if (clash) {
      const go = await Dialog.show({
        kind: "warn", title: "Bị trùng giờ",
        message: `${s}${e ? " – " + e : ""} trùng với "${clash.activity}" (${timeRange(clash)}). Vẫn ${itemEditing ? "lưu" : "thêm"} chứ?`,
        primary: itemEditing ? "Vẫn lưu" : "Vẫn thêm", secondary: "Đổi giờ"
      });
      if (!go) { startPicker.button.focus(); return; }
    }
  }

  const body = { dayDate: itemDay, startTime: s, endTime: e, activity, location: form.location.value.trim() || null, note: form.note.value.trim() || null };
  const btns = form.querySelectorAll(".form-actions button");
  btns.forEach((b) => { b.disabled = true; });
  try {
    const base = `/trips/${trip.id}/itinerary`;
    const saved = itemEditing
      ? await api(`${base}/${itemEditing.id}`, { method: "PUT", body })
      : await api(base, { method: "POST", body });
    items = items.filter((i) => i.id !== saved.id).concat(saved);
    trip.itineraryCount = items.length;
    selectedDay = saved.dayDate;
    renderPlan();
    showToast(itemEditing ? "Đã lưu hoạt động" : "Đã thêm vào " + dayShort(saved.dayDate));
    if (more) {
      // Giữ ngày, chuyển giờ bắt đầu sang giờ kết thúc vừa rồi cho nhanh
      const next = saved.endTime;
      openItemModal(null, saved.dayDate);
      if (next) startPicker.set(next);
      itemSnapshot = itemState();
    } else {
      closeModal("itemModal");
    }
  } catch (err) {
    if (err.handled) return;
    const key = Object.keys(err.fields || {})[0];
    const target = key === "dayDate" ? document.getElementById("itemDays") : key === "endTime" ? endPicker.button : key ? form[key] : null;
    FieldError.fail(target, "Chưa lưu được hoạt động", err.message);
  } finally {
    btns.forEach((b) => { b.disabled = false; });
  }
}

// ===== Modal khoản chi =====
let expEditing = null;
let expAmount = null;
let expCat = "FOOD";
let expDate = null;
let expSnapshot = "";
let expCalendar = null;

function setupExpenseModal() {
  const form = document.getElementById("expenseForm");
  document.getElementById("catPick").innerHTML = Object.entries(CATEGORIES).map(([k, c]) =>
    `<button type="button" data-cat="${k}" aria-pressed="false">${svg(c.icon, 24)}<span>${c.label}</span></button>`).join("");
  document.getElementById("catPick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (b) { expCat = b.dataset.cat; paintExpense(); }
  });
  const amount = document.getElementById("eAmount");
  bindMoneyInput(amount, (v) => { expAmount = v; paintImpact(); });
  document.getElementById("amountChips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    if (!b) return;
    const add = Number(b.dataset.add);
    expAmount = add ? Math.min((expAmount || 0) + add, 999999999999) : null;
    amount.value = expAmount ? expAmount.toLocaleString("vi-VN") : "";
    FieldError.clear(amount);
    paintImpact();
  });
  document.getElementById("expDates").addEventListener("click", (e) => {
    const b = e.target.closest("[data-date]");
    if (!b) return;
    const v = b.dataset.date;
    const cal = document.getElementById("expCalendar");
    if (v === "other") {
      cal.classList.toggle("hidden");
      if (!cal.classList.contains("hidden")) {
        expCalendar = RangeCalendar(cal, { mode: "single", start: expDate, onChange: (s) => { expDate = s; paintExpense(); } });
      }
      return;
    }
    cal.classList.add("hidden");
    expDate = v === "none" ? null : v;
    paintExpense();
  });
  form.addEventListener("submit", (e) => { e.preventDefault(); saveExpense(false); });
  document.getElementById("expSaveMore").addEventListener("click", () => saveExpense(true));
  bindModal("expenseModal", () => expSnapshot !== expState());
}

function expState() {
  return JSON.stringify([expAmount, expCat, expDate, document.getElementById("eDesc").value.trim()]);
}

function expenseDateOptions() {
  const today = todayIso();
  const days = tripDayList(trip);
  const opts = [];
  if (!days.includes(today) && today < trip.startDate) opts.push([today, "Hôm nay · trước chuyến"]);
  days.forEach((d) => opts.push([d, WD_SHORT[parseDate(d).getDay()] + " " + ddmm(d)]));
  return opts;
}

function paintExpense() {
  document.querySelectorAll("#catPick [data-cat]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === expCat)));
  const opts = expenseDateOptions();
  const known = opts.some(([v]) => v === expDate);
  const calOpen = !document.getElementById("expCalendar").classList.contains("hidden");
  document.getElementById("expDates").innerHTML =
    opts.map(([v, l]) => `<button type="button" class="chip" data-date="${v}" aria-pressed="${v === expDate}">${l}</button>`).join("") +
    `<button type="button" class="chip" data-date="other" aria-pressed="${!!expDate && !known}" aria-expanded="${calOpen}">${expDate && !known ? ddmmyyyy(expDate) : "Ngày khác..."}</button>` +
    `<button type="button" class="chip" data-date="none" aria-pressed="${!expDate}">Không ghi ngày</button>`;
  paintImpact();
}

function paintImpact() {
  const box = document.getElementById("impact");
  const budget = Number(trip.budget || 0);
  const base = totalSpent() - (expEditing ? Number(expEditing.amount) : 0);
  const amt = expAmount || 0;
  if (budget <= 0) {
    box.className = "impact";
    box.innerHTML = `<div class="row-between" style="font-weight:700"><span>Tổng chi sau khoản này</span><span>${vnd(base + amt)}</span></div>
      <span style="font-size:13px">Chuyến này chưa đặt ngân sách, nên mình chưa canh vượt quỹ được.</span>`;
    return;
  }
  const after = budget - base - amt;
  const over = after < 0;
  const pct = (v) => Math.max(0, Math.min(100, (v / budget) * 100)).toFixed(1) + "%";
  box.className = "impact" + (over ? " over" : "");
  box.innerHTML = `
    <div class="row-between" style="font-weight:700"><span>${over ? "Khoản này làm vượt ngân sách" : "Sau khoản này, quỹ còn"}</span><span>${over ? "vượt " + vnd(-after) : vnd(after)}</span></div>
    <div class="track"><div class="old" style="width:${pct(base)}"></div><div class="new" style="width:${over ? (Math.max(0, 100 - (base / budget) * 100)).toFixed(1) + "%" : pct(amt)}"></div></div>
    <span style="font-size:13px">${over ? "Vẫn lưu được, nhưng mình sẽ hỏi lại bạn một lần cho chắc." : `Đã chi ${vnd(base)} + khoản này ${vnd(amt)} trên ngân sách ${vnd(budget)}.`}</span>`;
}

function openExpenseModal(x) {
  const form = document.getElementById("expenseForm");
  FieldError.clearAll(form);
  expEditing = x || null;
  const today = todayIso();
  expAmount = x ? Number(x.amount) : null;
  expCat = x ? x.category : "FOOD";
  expDate = x ? x.expenseDate : (today <= trip.endDate ? today : null);
  document.getElementById("eAmount").value = expAmount ? expAmount.toLocaleString("vi-VN") : "";
  document.getElementById("eDesc").value = x ? x.description : "";
  document.getElementById("expTitle").textContent = x ? "Sửa khoản chi" : "Thêm khoản chi";
  document.getElementById("expSaveMore").classList.toggle("hidden", !!x);
  document.getElementById("expCalendar").classList.add("hidden");
  paintExpense();
  expSnapshot = expState();
  openModal("expenseModal");
  document.getElementById("eAmount").focus();
}

async function saveExpense(more) {
  const form = document.getElementById("expenseForm");
  FieldError.clearAll(form);
  const description = document.getElementById("eDesc").value.trim();
  if (!expAmount || expAmount <= 0) return FieldError.fail(document.getElementById("eAmount"), "Số tiền không hợp lệ", "Số tiền phải lớn hơn 0đ.");
  if (!description) return FieldError.fail(document.getElementById("eDesc"), "Thiếu thông tin khoản chi", "Ghi nội dung khoản chi, ví dụ \"Vé xe khứ hồi\". Tối đa 200 ký tự.");

  if (expDate && expDate > trip.endDate) {
    const go = await Dialog.show({
      kind: "warn", title: "Ngày chi sau khi chuyến đi kết thúc",
      message: `Chuyến đi kết thúc ${ddmm(trip.endDate)} nhưng khoản chi ghi ngày ${ddmm(expDate)}. Bạn có nhập nhầm không?`,
      primary: "Vẫn lưu", secondary: "Sửa ngày"
    });
    if (!go) return;
  }
  const budget = Number(trip.budget || 0);
  const base = totalSpent() - (expEditing ? Number(expEditing.amount) : 0);
  const after = base + expAmount;
  const increases = !expEditing || expAmount > Number(expEditing.amount);
  if (budget > 0 && after > budget && increases) {
    const go = await Dialog.show({
      kind: "warn", title: "Sắp vỡ quỹ rồi!",
      message: `${expEditing ? "Lưu" : "Thêm"} khoản này thì tổng chi là ${vnd(after)}, vượt ngân sách ${vnd(after - budget)}.`,
      primary: expEditing ? "Vẫn lưu" : "Vẫn thêm", secondary: "Xem lại"
    });
    if (!go) return;
  }

  const body = { category: expCat, description, amount: expAmount, expenseDate: expDate };
  const btns = form.querySelectorAll(".form-actions button");
  btns.forEach((b) => { b.disabled = true; });
  try {
    const base2 = `/trips/${trip.id}/expenses`;
    const saved = expEditing
      ? await api(`${base2}/${expEditing.id}`, { method: "PUT", body })
      : await api(base2, { method: "POST", body });
    expenses = expenses.filter((x) => x.id !== saved.id).concat(saved);
    trip.totalSpent = totalSpent();
    renderPlan();
    renderBudget();
    showToast(expEditing ? "Đã lưu khoản chi" : "Đã thêm " + vnd(saved.amount));
    if (more) {
      const keepDate = saved.expenseDate;
      openExpenseModal(null);
      expDate = keepDate;
      expCat = saved.category;
      paintExpense();
      expSnapshot = expState();
    } else {
      closeModal("expenseModal");
    }
  } catch (err) {
    if (err.handled) return;
    const key = Object.keys(err.fields || {})[0];
    const target = key === "amount" ? document.getElementById("eAmount") : key === "description" ? document.getElementById("eDesc") : null;
    FieldError.fail(target, "Chưa lưu được khoản chi", err.message);
  } finally {
    btns.forEach((b) => { b.disabled = false; });
  }
}

async function deleteExpense(id) {
  const x = expenses.find((e) => e.id === id);
  if (!x) return;
  const ok = await Dialog.show({
    kind: "confirm", title: "Xóa khoản chi này?",
    message: `"${x.description}" (${vnd(x.amount)}) sẽ bị xóa khỏi quỹ chuyến đi.`,
    primary: "Xóa", secondary: "Hủy"
  });
  if (!ok) return;
  try {
    await api(`/trips/${trip.id}/expenses/${id}`, { method: "DELETE" });
    expenses = expenses.filter((e) => e.id !== id);
    trip.totalSpent = totalSpent();
    renderPlan();
    renderBudget();
    showToast("Đã xóa khoản chi");
  } catch (err) {
    reportError(err, "Chưa xóa được khoản chi");
  }
}
