// Trang danh sách chuyến đi
let allTrips = [];
let filter = "all";
let query = "";

const FILTERS = [
  { key: "all", label: "Tất cả" },
  { key: "upcoming", label: "Sắp đi" },
  { key: "ongoing", label: "Đang đi" },
  { key: "past", label: "Đã đi" }
];

if (Auth.requireLogin()) {
  // Link cũ trang chủ dạng trips.html?new=Điểm đến
  const legacy = new URLSearchParams(location.search).get("new");
  if (legacy) window.location.replace("trip-form.html?dest=" + encodeURIComponent(legacy));
  document.addEventListener("DOMContentLoaded", () => {
    const user = Auth.getUser();
    if (user) document.getElementById("greeting").textContent = "Chào " + user.fullName.trim().split(/\s+/).pop() + ", đi đâu tiếp đây?";
    document.getElementById("filters").addEventListener("click", (e) => {
      const b = e.target.closest("[data-filter]");
      if (!b) return;
      filter = b.dataset.filter;
      render();
    });
    document.getElementById("filters").addEventListener("input", (e) => {
      if (e.target.id !== "tripSearch") return;
      query = e.target.value.trim().toLowerCase();
      renderList();
    });
    loadTrips();
  });
}

async function loadTrips() {
  try {
    allTrips = await api("/trips");
    render();
  } catch (err) {
    document.getElementById("tripList").innerHTML =
      `<div class="empty-box"><p style="margin:0 0 12px;font-weight:700">Không tải được chuyến đi</p>
       <button type="button" class="btn" onclick="loadTrips()">Thử lại</button></div>`;
    reportError(err, "Không tải được chuyến đi");
  }
}

function render() {
  const counts = { all: allTrips.length, upcoming: 0, ongoing: 0, past: 0 };
  allTrips.forEach((t) => counts[tripStatus(t).key]++);
  const box = document.getElementById("filters");
  const search = document.getElementById("tripSearch");
  const keepFocus = search && document.activeElement === search;
  box.innerHTML = FILTERS.map((f) =>
    `<button type="button" class="chip" data-filter="${f.key}" aria-pressed="${filter === f.key}">${f.label} · ${counts[f.key]}</button>`).join("") + `
    <label class="search">
      ${svg(ICON.search, 18, 2.4)}
      <span class="sr-only">Tìm chuyến đi</span>
      <input type="search" id="tripSearch" placeholder="Tìm chuyến đi..." value="${escapeHtml(query)}">
    </label>`;
  if (keepFocus) document.getElementById("tripSearch").focus();
  renderList();
}

function renderList() {
  const box = document.getElementById("tripList");
  const newCard = `
    <a href="trip-form.html" class="new-card">
      <span class="plus">${svg(ICON.plus, 28, 2.6)}</span>
      <span style="font-weight:800;font-size:18px">Lên kèo chuyến mới</span>
      <span class="muted" style="font-size:14px">Tên, điểm đến, ngày đi là đủ</span>
    </a>`;
  if (!allTrips.length) {
    box.innerHTML = `<div class="trip-grid">${newCard}</div>`;
    return;
  }
  // Sắp đi gần nhất lên đầu, rồi đang đi, cuối cùng là đã đi (mới nhất trước)
  const order = { ongoing: 0, upcoming: 1, past: 2 };
  const shown = allTrips
    .filter((t) => filter === "all" || tripStatus(t).key === filter)
    .filter((t) => !query || (t.name + " " + t.destination).toLowerCase().includes(query))
    .sort((a, b) => {
      const sa = tripStatus(a).key, sb = tripStatus(b).key;
      if (sa !== sb) return order[sa] - order[sb];
      return sa === "past" ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate);
    });
  if (!shown.length) {
    box.innerHTML = `<div class="empty-box">Không có chuyến nào khớp${query ? ` với "${escapeHtml(query)}"` : ""}.</div>`;
    return;
  }
  box.innerHTML = `<div class="trip-grid">${shown.map((t) => tripCardHtml(t, { href: "trip.html?id=" + t.id })).join("")}${filter === "all" && !query ? newCard : ""}</div>`;
}
