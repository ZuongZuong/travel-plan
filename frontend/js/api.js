// ===== Lưu phiên đăng nhập =====
const Auth = {
  getToken() { return localStorage.getItem("tp_token"); },
  getUser() {
    try { return JSON.parse(localStorage.getItem("tp_user")); } catch { return null; }
  },
  save(data) {
    localStorage.setItem("tp_token", data.token);
    localStorage.setItem("tp_user", JSON.stringify(data.user));
  },
  clear() {
    localStorage.removeItem("tp_token");
    localStorage.removeItem("tp_user");
  },
  logout() {
    this.clear();
    window.location.href = "index.html";
  },
  isLoggedIn() { return !!this.getToken(); },
  // Link tới trang đăng nhập, sau khi đăng nhập quay lại trang hiện tại
  loginUrl(next = location.pathname.split("/").pop() + location.search + location.hash) {
    return "login.html?next=" + encodeURIComponent(next || "trips.html");
  },
  // Dùng ở các trang cần đăng nhập
  requireLogin() {
    if (!this.isLoggedIn()) {
      window.location.replace(this.loginUrl());
      return false;
    }
    return true;
  }
};

// Lỗi đã được báo bằng popup, nơi gọi không cần báo lại
class HandledError extends Error {
  constructor(message) { super(message); this.handled = true; }
}

// Lỗi từ API, giữ lại mã lỗi và lỗi theo từng ô nhập
class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

// ===== Gọi API =====
// body là FormData thì gửi dạng multipart (tải ảnh), còn lại gửi JSON.
// quiet = true: mất mạng thì chỉ báo lỗi cho nơi gọi, không hiện popup.
async function api(path, { method = "GET", body, quiet = false } = {}) {
  const headers = {};
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  const token = Auth.getToken();
  if (token) headers.Authorization = "Bearer " + token;

  let res;
  for (;;) {
    try {
      res = await fetch(API_BASE_URL + path, {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body)
      });
      break;
    } catch {
      if (quiet) throw new Error("Không kết nối được tới máy chủ");
      const retry = await Dialog.show({
        kind: "error",
        title: "Mất kết nối",
        message: "Không gọi được máy chủ. Kiểm tra mạng hoặc backend rồi thử lại nhé.",
        primary: "Thử lại",
        secondary: "Đóng"
      });
      if (!retry) throw new HandledError("Không kết nối được tới máy chủ");
    }
  }

  if (res.status === 401 && token) {
    Auth.clear();
    await Dialog.show({
      kind: "info",
      title: "Phiên đăng nhập đã hết hạn",
      message: "Để bảo mật, bạn cần đăng nhập lại. Dữ liệu đã lưu vẫn còn nguyên.",
      primary: "Đăng nhập lại",
      dismissable: false
    });
    window.location.href = Auth.loginUrl();
    throw new HandledError("Phiên đăng nhập đã hết hạn");
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError((data && data.message) || "Có lỗi xảy ra (mã " + res.status + ")", res.status, data && data.errors);
  }
  return data;
}

// Báo lỗi bằng popup (bỏ qua lỗi đã được báo)
function reportError(err, title = "Chưa làm được rồi") {
  if (err && err.handled) return Promise.resolve(false);
  return Dialog.show({ kind: "error", title, message: err.message || String(err), primary: "Đã hiểu" });
}

// ===== Popup thông báo / xác nhận =====
const DIALOG_ICONS = {
  error: '<path d="M12 8v5"/><path d="M12 16.5h.01"/><circle cx="12" cy="12" r="9"/>',
  confirm: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  warn: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  success: '<path d="m5 12 5 5 9-10"/>'
};

const Dialog = {
  /**
   * Hiện popup, trả về Promise<boolean>: true khi bấm nút chính.
   * opts: kind (error|confirm|warn|info|success), title, message, facts [[trái, phải]],
   *       body (phần tử HTML tự thêm), primary, secondary,
   *       onPrimary (async, trả false để giữ popup mở), dismissable (mặc định true)
   */
  show(opts) {
    const { kind = "info", title, message, facts, body, primary = "Đã hiểu", secondary, onPrimary, dismissable = true } = opts;
    return new Promise((resolve) => {
      const lastFocus = document.activeElement;
      const back = document.createElement("div");
      back.className = "dialog-backdrop";
      const id = "dlg" + Math.random().toString(36).slice(2, 8);
      back.innerHTML = `
        <div class="dialog ${kind}" role="${kind === "confirm" || kind === "warn" ? "alertdialog" : "dialog"}"
             aria-modal="true" aria-labelledby="${id}-t" ${message ? `aria-describedby="${id}-m"` : ""}>
          <span class="ico">${svg(DIALOG_ICONS[kind] || DIALOG_ICONS.info, 28, 2.4)}</span>
          <h2 class="h-display" id="${id}-t">${escapeHtml(title)}</h2>
          ${message ? `<p id="${id}-m">${escapeHtml(message)}</p>` : ""}
          ${facts && facts.length ? `<ul class="facts">${facts.map(([a, b]) =>
            `<li><span>${escapeHtml(a)}</span><span>${escapeHtml(b)}</span></li>`).join("")}</ul>` : ""}
          <div class="slot"></div>
          <div class="btns">
            ${secondary ? `<button type="button" class="btn no">${escapeHtml(secondary)}</button>` : ""}
            <button type="button" class="btn go">${escapeHtml(primary)}</button>
          </div>
        </div>`;
      if (body) back.querySelector(".slot").appendChild(body);
      else back.querySelector(".slot").remove();
      document.body.appendChild(back);
      document.body.style.overflow = "hidden";

      const goBtn = back.querySelector(".go");
      const noBtn = back.querySelector(".no");
      const close = (result) => {
        back.remove();
        if (!document.querySelector(".dialog-backdrop, .modal-backdrop:not(.hidden)")) document.body.style.overflow = "";
        document.removeEventListener("keydown", onKey, true);
        if (lastFocus && lastFocus.focus) lastFocus.focus();
        resolve(result);
      };
      const onKey = (e) => {
        if (e.key === "Escape" && dismissable) { e.stopPropagation(); close(false); }
        if (e.key === "Tab") {
          const els = [...back.querySelectorAll("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter((x) => !x.disabled);
          const first = els[0], last = els[els.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      document.addEventListener("keydown", onKey, true);
      back.addEventListener("click", (e) => { if (e.target === back && dismissable) close(false); });
      if (noBtn) noBtn.addEventListener("click", () => close(false));
      goBtn.addEventListener("click", async () => {
        if (onPrimary) {
          goBtn.disabled = true;
          let ok = false;
          try { ok = (await onPrimary()) !== false; } finally { goBtn.disabled = false; }
          if (!ok) return;
        }
        close(true);
      });
      // Popup xóa thì để sẵn con trỏ ở nút an toàn
      const autoFocus = body && body.querySelector("input, button");
      (autoFocus || (kind === "confirm" && noBtn) || goBtn).focus();
    });
  }
};

function showToast(message) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// ===== Lỗi trong form: viền đỏ + dòng chữ đỏ dưới ô =====
const FieldError = {
  set(target, message) {
    const box = target.closest(".input-group, .input-icon, .amount-box") || target;
    box.classList.add("is-invalid");
    target.setAttribute("aria-invalid", "true");
    const field = target.closest(".field") || box.parentElement;
    let msg = field.querySelector(":scope > .field-error");
    if (!msg) {
      msg = document.createElement("p");
      msg.className = "field-error";
      msg.id = (target.id || "f" + Math.random().toString(36).slice(2, 7)) + "-err";
      field.appendChild(msg);
    }
    msg.innerHTML = svg(DIALOG_ICONS.error, 16, 2.4) + `<span>${escapeHtml(message)}</span>`;
    target.setAttribute("aria-describedby", msg.id);
    const clear = () => { this.clear(target); target.removeEventListener("input", clear); target.removeEventListener("click", clear); };
    target.addEventListener("input", clear);
    if (target.tagName === "BUTTON") target.addEventListener("click", clear);
  },
  clear(target) {
    const box = target.closest(".input-group, .input-icon, .amount-box") || target;
    box.classList.remove("is-invalid");
    target.removeAttribute("aria-invalid");
    const field = target.closest(".field") || box.parentElement;
    const msg = field && field.querySelector(":scope > .field-error");
    if (msg) msg.remove();
  },
  clearAll(root) {
    root.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
    root.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    root.querySelectorAll(".field-error").forEach((el) => el.remove());
  },
  // Vi phạm ràng buộc: hiện popup, đóng popup thì đánh dấu ô và đưa con trỏ về đó
  async fail(target, title, message, primary = "Sửa lại") {
    await Dialog.show({ kind: "error", title, message, primary });
    if (target) {
      this.set(target, message);
      target.focus();
    }
    return false;
  }
};

// ===== Biểu tượng =====
function svg(paths, size = 20, stroke = 2.2) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
const ICON = {
  plane: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  arrowRight: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
  arrowUpRight: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>'
};

// ===== Loại chi phí =====
const CATEGORIES = {
  TRANSPORT: { label: "Di chuyển", icon: '<path d="M5 16V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10"/><path d="M5 11h14"/><path d="M7 16v3"/><path d="M17 16v3"/><path d="M4 16h16"/>' },
  ACCOMMODATION: { label: "Lưu trú", icon: '<path d="M3 18V7"/><path d="M3 13h18v5"/><path d="M21 13a3 3 0 0 0-3-3h-7v3"/><path d="M7 11.5h.01"/>' },
  FOOD: { label: "Ăn uống", icon: '<path d="M7 3v18"/><path d="M5 3v5a2 2 0 0 0 4 0V3"/><path d="M17 21V3c-2 1-3 4-3 7h3"/>' },
  SIGHTSEEING: { label: "Tham quan", icon: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M14 7v10"/>' },
  SHOPPING: { label: "Mua sắm", icon: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>' },
  OTHER: { label: "Khác", icon: '<path d="M5 12h.01"/><path d="M12 12h.01"/><path d="M19 12h.01"/>' }
};

// ===== Tiện ích chuỗi & số =====
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// 3450000 -> "3.450.000đ"
function vnd(value) {
  return Math.round(Number(value || 0)).toLocaleString("vi-VN") + "đ";
}

// 3450000 -> "3,45tr", 500000 -> "500k"
function shortMoney(value) {
  const n = Math.round(Number(value || 0));
  if (Math.abs(n) >= 1e6) return (n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + "tr";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "k";
  return vnd(n);
}

// "6.000.000" -> 6000000, chuỗi rỗng -> null
function parseMoney(text) {
  const digits = String(text || "").replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

// Gõ số tiền tới đâu thêm dấu chấm tới đó, giữ đúng vị trí con trỏ
function bindMoneyInput(input, onChange) {
  input.addEventListener("input", () => {
    const pos = input.selectionStart;
    const digitsBefore = input.value.slice(0, pos).replace(/\D/g, "").length;
    const n = parseMoney(input.value);
    const capped = n === null ? null : Math.min(n, 999999999999);
    input.value = capped === null ? "" : capped.toLocaleString("vi-VN");
    let i = 0, seen = 0;
    while (i < input.value.length && seen < digitsBefore) { if (/\d/.test(input.value[i])) seen++; i++; }
    input.setSelectionRange(i, i);
    if (onChange) onChange(capped);
  });
}

// ===== Ngày tháng (theo giờ máy người dùng) =====
const WD_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const WD_LONG = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const pad2 = (n) => String(n).padStart(2, "0");

function parseDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toIsoDate(date) {
  return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
}
function todayIso() { return toIsoDate(new Date()); }
function addDays(iso, n) { const d = parseDate(iso); d.setDate(d.getDate() + n); return toIsoDate(d); }
function diffDays(fromIso, toIso) { return Math.round((parseDate(toIso) - parseDate(fromIso)) / 86400000); }
function ddmm(iso) { const d = parseDate(iso); return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1); }
function ddmmyyyy(iso) { return ddmm(iso) + "/" + parseDate(iso).getFullYear(); }
// "T7, 17/10"
function dayShort(iso) { return WD_SHORT[parseDate(iso).getDay()] + ", " + ddmm(iso); }
// "Thứ Bảy 17/10"
function dayLong(iso) { return WD_LONG[parseDate(iso).getDay()] + " " + ddmm(iso); }
function rangeText(a, b) {
  const sameYear = a.slice(0, 4) === b.slice(0, 4) && a.slice(0, 4) === todayIso().slice(0, 4);
  return sameYear ? ddmm(a) + " – " + ddmm(b) : ddmmyyyy(a) + " – " + ddmmyyyy(b);
}
function tripDayList(trip) {
  const out = [];
  for (let d = trip.startDate; d <= trip.endDate; d = addDays(d, 1)) out.push(d);
  return out;
}
// 3 ngày -> "3N2Đ", 1 ngày -> "Trong ngày"
function lengthShort(days) { return days <= 1 ? "Trong ngày" : days + "N" + (days - 1) + "Đ"; }
function lengthLong(days) { return days <= 1 ? "Đi trong ngày" : days + " ngày " + (days - 1) + " đêm"; }

function tripStatus(trip) {
  const today = todayIso();
  if (trip.endDate < today) return { key: "past", label: "Đã đi" };
  if (trip.startDate > today) {
    const n = diffDays(today, trip.startDate);
    return { key: "upcoming", label: n === 1 ? "Mai đi rồi" : "Còn " + n + " ngày", days: n };
  }
  const total = diffDays(trip.startDate, trip.endDate) + 1;
  const nth = diffDays(trip.startDate, today) + 1;
  return { key: "ongoing", label: total > 1 ? "Đang đi · ngày " + nth + "/" + total : "Đang đi" };
}

// ===== Màu & ảnh bìa =====
const COVER_COLORS = [
  { value: "#5B3DF0", label: "Tím", fg: "#FFFFFF" },
  { value: "#CFF54A", label: "Xanh chanh", fg: "#16131F" },
  { value: "#16131F", label: "Đen", fg: "#FFFFFF" },
  { value: "#FFFFFF", label: "Trắng", fg: "#16131F" }
];

function isSafeImageUrl(url) { return !!url && /^https?:\/\/\S+$/i.test(url); }

// Trả về { style, fg, chip } để tô bìa thẻ chuyến đi
function coverLook(trip) {
  if (isSafeImageUrl(trip.coverImageUrl)) {
    const url = trip.coverImageUrl.replace(/["\\()]/g, encodeURIComponent);
    return {
      style: `background-color:#16131F;background-image:linear-gradient(180deg,rgba(22,19,31,.15),rgba(22,19,31,.7)),url("${url}");color:#FFFFFF`,
      fg: "#FFFFFF", chip: "tag-lime"
    };
  }
  const known = COVER_COLORS.find((c) => c.value.toLowerCase() === String(trip.coverColor || "").toLowerCase());
  const c = known || (trip.coverColor ? { value: trip.coverColor, fg: "#FFFFFF" } : COVER_COLORS[(trip.id || 0) % COVER_COLORS.length]);
  const chip = c.value === "#CFF54A" ? "tag-ink" : c.value === "#FFFFFF" ? "tag-grey" : "tag-lime";
  return { style: `background:${c.value};color:${c.fg}`, fg: c.fg, chip };
}

// Thẻ chuyến đi dùng ở danh sách và phần xem trước của form
function tripCardHtml(trip, { href, preview = false } = {}) {
  const look = coverLook(trip);
  const st = trip.startDate ? tripStatus(trip) : null;
  const budget = Number(trip.budget || 0);
  const spent = Number(trip.totalSpent || 0);
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const tag = preview ? "div" : "a";
  return `
    <${tag} class="trip-card" ${href ? `href="${href}"` : ""}>
      <div class="cover" style="${escapeHtml(look.style)}">
        <div class="row">
          ${st ? `<span class="tag ${st.key === "past" ? "tag-grey" : look.chip}">${escapeHtml(st.label)}</span>` : "<span></span>"}
          <span style="font-weight:700;font-size:14px">${trip.days ? lengthShort(trip.days) : ""}</span>
        </div>
        <div>
          <div class="dest">${escapeHtml(trip.destination || "Điểm đến")}</div>
          <div class="title">${escapeHtml(trip.name || "Tên chuyến đi")}</div>
        </div>
      </div>
      <div class="body">
        <div class="meta">
          <span>${trip.startDate && trip.endDate ? rangeText(trip.startDate, trip.endDate) : "Chưa chọn ngày"}</span>
          ${preview ? "" : `<span class="muted">${trip.itineraryCount || 0} hoạt động</span>`}
        </div>
        <div class="bar ${pct > 90 ? "hot" : ""}" role="img" aria-label="Đã chi ${pct}% ngân sách"><div style="width:${pct}%"></div></div>
        <div class="meta" style="font-weight:400">
          <span>Đã chi <strong>${shortMoney(spent)}</strong></span>
          <span class="muted">${budget > 0 ? "/ " + shortMoney(budget) : "Chưa đặt ngân sách"}</span>
        </div>
      </div>
    </${tag}>`;
}

// ===== Header =====
function renderHeader() {
  const el = document.getElementById("siteHeader");
  if (!el) return;
  const page = document.body.dataset.page;
  const user = Auth.getUser();
  const logged = Auth.isLoggedIn() && user;
  const link = (href, label, key) =>
    `<a href="${href}" class="nav-link ${page === key ? "active" : ""}" ${page === key ? 'aria-current="page"' : ""}>${label}</a>`;
  const initial = logged ? (user.fullName || "?").trim().split(/\s+/).pop().charAt(0).toUpperCase() : "";
  const firstName = logged ? (user.fullName || "").trim().split(/\s+/).pop() : "";
  el.innerHTML = `
    <div class="wrap header-inner">
      <a href="index.html" class="logo" aria-label="travelplan, về trang chủ">
        <span class="logo-mark">${svg(ICON.plane, 20, 2.4)}</span>
        <span class="logo-text">travelplan</span>
      </a>
      <nav class="nav" aria-label="Điều hướng chính">
        ${logged ? `<span class="hide-sm">${link("index.html#diem-den", "Khám phá", "home")}</span>` : link("index.html#diem-den", "Khám phá", "home")}
        ${logged ? link("trips.html", "Chuyến đi của tôi", "trips") : ""}
        ${logged
          ? `<span class="user-pill"><span class="avatar">${escapeHtml(initial)}</span><span class="hide-sm">${escapeHtml(firstName)}</span></span>
             <button type="button" class="icon-btn" id="logoutBtn" aria-label="Đăng xuất" title="Đăng xuất">${svg(ICON.logout)}</button>`
          : `<a href="login.html" class="btn btn-dark btn-sm">Đăng nhập</a>`}
      </nav>
    </div>`;
  const out = document.getElementById("logoutBtn");
  if (out) {
    out.addEventListener("click", async () => {
      const ok = await Dialog.show({ kind: "info", title: "Đăng xuất?", message: "Bạn sẽ cần đăng nhập lại để xem chuyến đi của mình.", primary: "Đăng xuất", secondary: "Ở lại" });
      if (ok) Auth.logout();
    });
  }
}

document.addEventListener("DOMContentLoaded", renderHeader);
