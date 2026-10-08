// Trang chủ: điểm đến đang hot cuối tuần này và lịch trình cộng đồng chia sẻ
const TILE_LOOKS = [
  { bg: "#5B3DF0", fg: "#FFFFFF", tag: "tag-lime" },
  { bg: "#CFF54A", fg: "#16131F", tag: "tag-ink" },
  { bg: "#16131F", fg: "#FFFFFF", tag: "tag-lime" },
  { bg: "#FFFFFF", fg: "#16131F", tag: "" }
];
const TILE_TILTS = [-1.5, 1, -0.5, 1.5, -1, 0.5];
let publicTrips = [];

document.addEventListener("DOMContentLoaded", () => {
  if (Auth.isLoggedIn()) {
    const cta = document.getElementById("heroCta");
    cta.href = "trip-form.html";
    cta.querySelector("span").textContent = "Tạo chuyến mới";
    document.getElementById("ctaText").textContent = "Lên kèo chuyến mới hoặc xem lại các chuyến của bạn.";
    const btn = document.getElementById("ctaBtn");
    btn.href = "trips.html";
    btn.textContent = "Chuyến đi của tôi";
  }
  loadTrending();
  loadCommunity();
  document.getElementById("communityGrid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-reuse]");
    if (b) reuse(Number(b.dataset.reuse));
  });
});

// Link tạo chuyến với điểm đến điền sẵn (chưa đăng nhập thì đăng nhập trước)
function newTripLink(dest) {
  const target = "trip-form.html?dest=" + encodeURIComponent(dest);
  return Auth.isLoggedIn() ? target : Auth.loginUrl(target);
}

async function loadTrending() {
  const grid = document.getElementById("destGrid");
  const note = document.getElementById("trendNote");
  try {
    const data = await api("/public/trending-destinations", { quiet: true });
    const weekend = data.basis === "weekend";
    note.textContent = weekend
      ? `Những nơi cộng đồng travelplan đang lên kèo nhiều nhất cho cuối tuần này (${ddmm(data.from)} – ${ddmm(data.to)}).`
      : "Cuối tuần này chưa ai lên kèo, đây là những nơi được chọn nhiều nhất trong 30 ngày tới.";
    if (!data.items.length) {
      grid.innerHTML = `<div class="empty-box" style="grid-column:1/-1">
        <p style="margin:0 0 12px;font-weight:700">Chưa có ai lên kèo sắp tới. Bạn mở hàng nhé?</p>
        <a class="btn btn-primary" href="${Auth.isLoggedIn() ? "trip-form.html" : Auth.loginUrl("trip-form.html")}">Lên kèo chuyến mới</a></div>`;
      return;
    }
    grid.innerHTML = data.items.map((p, i) => {
      const look = TILE_LOOKS[i % TILE_LOOKS.length];
      return `
        <a class="dest-tile" href="${escapeHtml(newTripLink(p.destination))}"
           style="background:${look.bg};color:${look.fg};transform:rotate(${TILE_TILTS[i % TILE_TILTS.length]}deg)"
           aria-label="Lên kèo đi ${escapeHtml(p.destination)}, hạng ${i + 1}, ${p.tripCount} chuyến đi">
          <div class="row-between">
            <span class="tag ${look.tag}" style="${look.tag ? "" : "background:#5B3DF0;color:#fff"}">#${i + 1}</span>
            <span class="arrow">${svg(ICON.arrowUpRight, 18, 2.4)}</span>
          </div>
          <div>
            <div class="count">${p.tripCount} chuyến đi ${weekend ? "cuối tuần này" : "sắp tới"}</div>
            <div class="name">${escapeHtml(p.destination)}</div>
          </div>
        </a>`;
    }).join("");
  } catch (err) {
    note.textContent = "Chưa tải được dữ liệu cộng đồng.";
    grid.innerHTML = `<div class="empty-box" style="grid-column:1/-1">${escapeHtml(err.message)}. Kiểm tra backend đã chạy chưa nhé.</div>`;
  } finally {
    grid.removeAttribute("aria-busy");
  }
}

function whenLabel(t) {
  const today = todayIso();
  if (t.startDate > today) return "Sắp đi";
  if (t.endDate >= today) return "Đang đi";
  const d = diffDays(t.endDate, today);
  if (d <= 7) return "Vừa đi tuần này";
  if (d <= 35) return "Đi " + Math.round(d / 7) + " tuần trước";
  return "Đi tháng " + (parseDate(t.endDate).getMonth() + 1) + "/" + parseDate(t.endDate).getFullYear();
}

async function loadCommunity() {
  const grid = document.getElementById("communityGrid");
  try {
    publicTrips = await api("/public/itineraries?limit=6", { quiet: true });
    if (!publicTrips.length) {
      grid.innerHTML = `<div class="empty-box" style="grid-column:1/-1">Chưa có lịch trình nào được chia sẻ. Bật "Chia sẻ công khai" khi tạo chuyến để lên đây nhé.</div>`;
      return;
    }
    const avatarLooks = [["#5B3DF0", "#FFFFFF"], ["#CFF54A", "#16131F"], ["#16131F", "#FFFFFF"]];
    grid.innerHTML = publicTrips.map((t, i) => {
      const [bg, fg] = avatarLooks[i % avatarLooks.length];
      return `
        <article class="card community-card">
          <div style="display:flex;align-items:center;gap:10px">
            <span class="avatar lg" style="background:${bg};color:${fg}">${escapeHtml(t.authorName.trim().split(/\s+/).pop().charAt(0).toUpperCase())}</span>
            <div style="min-width:0"><div style="font-weight:700">${escapeHtml(t.authorName)}</div>
              <div class="muted" style="font-size:13px">${whenLabel(t)}</div></div>
          </div>
          <div>
            <div class="muted" style="font-size:14px;font-weight:600">${escapeHtml(t.destination)} · ${lengthShort(t.days)}</div>
            <h4>${escapeHtml(t.name)}</h4>
          </div>
          <ul class="highlights">
            ${t.highlights.map((h) => `<li><strong>Ngày ${h.day}</strong><span>${escapeHtml(h.text)}</span></li>`).join("")}
          </ul>
          <div class="row-between" style="margin-top:auto">
            <span style="font-size:13px;font-weight:600">${t.reuseCount} người đã dùng lại · ${t.itineraryCount} hoạt động${Number(t.budget) > 0 ? " · " + shortMoney(t.budget) : ""}</span>
            <button type="button" class="btn btn-lime btn-sm" data-reuse="${t.id}" aria-label="Dùng lại lịch trình ${escapeHtml(t.name)}">Dùng lại</button>
          </div>
        </article>`;
    }).join("");

    // Quay lại sau khi đăng nhập để dùng lại một lịch trình
    const pending = Number(new URLSearchParams(location.search).get("reuse"));
    if (pending && Auth.isLoggedIn()) {
      history.replaceState(null, "", "index.html#cong-dong");
      reuse(pending);
    }
  } catch (err) {
    grid.innerHTML = `<div class="empty-box" style="grid-column:1/-1">Chưa tải được lịch trình cộng đồng. ${escapeHtml(err.message)}.</div>`;
  } finally {
    grid.removeAttribute("aria-busy");
  }
}

// "Dùng lại": chọn ngày bắt đầu, backend chép lịch trình sang chuyến mới của mình
async function reuse(id) {
  const t = publicTrips.find((x) => x.id === id);
  if (!t) return;
  if (!Auth.isLoggedIn()) {
    window.location.href = Auth.loginUrl("index.html?reuse=" + id);
    return;
  }
  let start = null;
  const body = document.createElement("div");
  const cal = document.createElement("div");
  body.appendChild(cal);
  RangeCalendar(cal, { mode: "single", start: null, onChange: (s) => { start = s; } });
  await Dialog.show({
    kind: "info",
    title: `Dùng lại "${t.name}"`,
    message: `Chọn ngày bắt đầu, mình sẽ chép ${t.itineraryCount} hoạt động trong ${t.days} ngày sang chuyến mới của bạn. Khoản chi không được chép.`,
    body,
    primary: "Chép lịch trình",
    secondary: "Hủy",
    onPrimary: async () => {
      if (!start) {
        await Dialog.show({ kind: "error", title: "Chưa chọn ngày đi", message: "Bấm vào một ngày trên lịch để chọn ngày bắt đầu nhé.", primary: "Chọn ngày" });
        return false;
      }
      try {
        const trip = await api(`/trips/${id}/clone`, { method: "POST", body: { startDate: start } });
        window.location.href = "trip.html?id=" + trip.id + "&new=1";
        return true;
      } catch (err) {
        await reportError(err, "Chưa chép được lịch trình");
        return false;
      }
    }
  });
}
