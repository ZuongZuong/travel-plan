// Trang tạo / sửa chuyến đi (trip-form.html, sửa thì có ?id=)
const params = new URLSearchParams(location.search);
const editId = params.get("id");
let original = null;        // chuyến đi đang sửa
let place = null;           // địa điểm đã chọn từ gợi ý { name, address, lat, lng }
let dates = { start: null, end: null };
let budget = null;
let dirty = false;
let saving = false;
let calendar = null;
let search = null;

if (Auth.requireLogin()) {
  document.addEventListener("DOMContentLoaded", init);
}

async function init() {
  const form = document.getElementById("tripForm");
  search = PlaceSearch(form.destination, {
    onPick(p) {
      place = p;
      showPlace();
      updatePreview();
    }
  });
  document.getElementById("destSource").textContent = GOOGLE_MAPS_API_KEY ? "· tìm trên Google Maps" : "· tìm trên bản đồ";

  calendar = RangeCalendar(document.getElementById("calendarBox"), {
    mode: "range",
    onChange(s, e) { dates = { start: s, end: e }; paintDates(); markDirty(); },
    onDone() { toggleCalendar(false); }
  });
  document.getElementById("startBtn").addEventListener("click", () => toggleCalendar());
  document.getElementById("endBtn").addEventListener("click", () => toggleCalendar());

  bindMoneyInput(document.getElementById("fBudget"), (v) => { budget = v; paintBudgetChips(); updatePreview(); markDirty(); });
  document.getElementById("budgetChips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-budget]");
    if (!b) return;
    budget = Number(b.dataset.budget);
    document.getElementById("fBudget").value = budget.toLocaleString("vi-VN");
    paintBudgetChips(); updatePreview(); markDirty();
  });

  const desc = document.getElementById("fDesc");
  desc.addEventListener("input", () => { document.getElementById("descCount").textContent = desc.value.length + "/1000"; });
  form.addEventListener("input", () => { markDirty(); updatePreview(); });
  form.addEventListener("change", markDirty);
  form.addEventListener("submit", (e) => { e.preventDefault(); submit(); });
  guardLeaving();

  if (editId) {
    document.title = "Sửa chuyến đi - travelplan";
    document.getElementById("formEyebrow").textContent = "Sửa chuyến đi";
    document.getElementById("submitBtn").querySelector("span").textContent = "Lưu thay đổi";
    document.getElementById("cancelLink").href = "trip.html?id=" + encodeURIComponent(editId);
    const back = document.getElementById("backLink");
    back.href = "trip.html?id=" + encodeURIComponent(editId);
    try {
      original = await api("/trips/" + encodeURIComponent(editId));
    } catch (err) {
      if (err.status === 404) {
        await Dialog.show({ kind: "error", title: "Không tìm thấy chuyến đi", message: "Chuyến đi này đã bị xóa hoặc không thuộc tài khoản của bạn.", primary: "Về danh sách" });
        window.location.href = "trips.html";
      } else reportError(err);
      return;
    }
    back.querySelector("span").textContent = original.name;
    document.getElementById("formTitle").textContent = original.name;
    document.getElementById("previewNote").textContent = "Thẻ cập nhật ngay khi bạn gõ. Ảnh bìa đổi ở trang chi tiết chuyến đi.";
    form.name.value = original.name;
    form.destination.value = original.destination;
    place = { name: original.destination, address: original.destinationAddress, lat: original.latitude, lng: original.longitude };
    showPlace();
    dates = { start: original.startDate, end: original.endDate };
    calendar.set(dates.start, dates.end);
    if (original.budget != null) {
      budget = Number(original.budget);
      document.getElementById("fBudget").value = budget.toLocaleString("vi-VN");
    }
    desc.value = original.description || "";
    document.getElementById("fPublic").checked = original.isPublic;
  } else if (params.get("dest")) {
    form.destination.value = params.get("dest");
    search.search(params.get("dest"));
    form.destination.focus();
  } else {
    form.name.focus();
  }
  desc.dispatchEvent(new Event("input"));
  paintDates();
  paintBudgetChips();
  updatePreview();
  dirty = false;
}

function markDirty() { dirty = true; }

function toggleCalendar(force) {
  const box = document.getElementById("calendarBox");
  const open = force === undefined ? box.classList.contains("hidden") : force;
  box.classList.toggle("hidden", !open);
  document.getElementById("startBtn").setAttribute("aria-expanded", String(open));
  document.getElementById("endBtn").setAttribute("aria-expanded", String(open));
  paintDates();
  if (open) box.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function paintDates() {
  const open = !document.getElementById("calendarBox").classList.contains("hidden");
  const s = document.getElementById("startBtn");
  const e = document.getElementById("endBtn");
  s.querySelector(".val").textContent = dates.start ? WD_SHORT[parseDate(dates.start).getDay()] + ", " + ddmmyyyy(dates.start) : "Chọn ngày";
  e.querySelector(".val").textContent = dates.end ? WD_SHORT[parseDate(dates.end).getDay()] + ", " + ddmmyyyy(dates.end) : "Chọn ngày";
  s.classList.toggle("active", open && !dates.start);
  e.classList.toggle("active", open && !!dates.start && !dates.end);
  const pill = document.getElementById("nightsPill");
  if (dates.start && dates.end) {
    const n = diffDays(dates.start, dates.end) + 1;
    pill.innerHTML = svg(ICON.calendar, 16) + " " + lengthLong(n) + " · lịch trình sẽ có sẵn " + n + " ngày";
    pill.classList.remove("hidden");
  } else pill.classList.add("hidden");
  updatePreview();
}

function paintBudgetChips() {
  document.querySelectorAll("#budgetChips [data-budget]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.budget) === budget)));
}

function showPlace() {
  const card = document.getElementById("mapCard");
  if (!place || !place.name) { card.classList.add("hidden"); return; }
  card.classList.remove("hidden");
  const src = mapEmbedUrl(place);
  const frame = document.getElementById("mapFrame");
  if (frame.getAttribute("src") !== src) frame.src = src;
  document.getElementById("placeName").textContent = place.name;
  const coord = place.lat != null ? Number(place.lat).toFixed(4) + ", " + Number(place.lng).toFixed(4) : "";
  document.getElementById("placeAddr").textContent = [place.address, coord].filter(Boolean).join(" · ");
  document.getElementById("placeLink").href = mapLinkUrl(place);
}

function updatePreview() {
  const form = document.getElementById("tripForm");
  const days = dates.start && dates.end ? diffDays(dates.start, dates.end) + 1 : 0;
  document.getElementById("previewCard").innerHTML = tripCardHtml({
    id: original ? original.id : 0,
    name: form.name.value.trim(),
    destination: form.destination.value.trim(),
    startDate: dates.start && dates.end ? dates.start : null,
    endDate: dates.end,
    days,
    budget,
    totalSpent: original ? original.totalSpent : 0,
    coverImageUrl: original ? original.coverImageUrl : null,
    coverColor: original ? original.coverColor : "#5B3DF0"
  }, { preview: true });
}

// Cảnh báo khi rời trang mà chưa lưu
function guardLeaving() {
  window.addEventListener("beforeunload", (e) => {
    if (dirty && !saving) { e.preventDefault(); e.returnValue = ""; }
  });
  document.addEventListener("click", async (e) => {
    const a = e.target.closest("a[href]");
    if (!a || !dirty || saving || a.target === "_blank" || a.getAttribute("href").startsWith("#")) return;
    e.preventDefault();
    const leave = await Dialog.show({
      kind: "warn", title: "Bỏ các thay đổi?",
      message: "Bạn có thay đổi chưa lưu. Nếu rời đi bây giờ thì sẽ mất hết.",
      primary: "Bỏ thay đổi", secondary: "Ở lại"
    });
    if (leave) { dirty = false; window.location.href = a.href; }
  });
}

async function submit() {
  const form = document.getElementById("tripForm");
  FieldError.clearAll(form);
  const name = form.name.value.trim();
  const destination = form.destination.value.trim();

  if (!name) return FieldError.fail(form.name, "Chuyến đi chưa có tên", "Đặt cho chuyến đi một cái tên, tối đa 150 ký tự.");
  if (!destination) return FieldError.fail(form.destination, "Chưa chọn điểm đến", "Gõ tên nơi bạn muốn đến rồi chọn một địa điểm trong danh sách gợi ý.", "Chọn điểm đến");
  const pickedSame = place && place.name === destination;
  if (!pickedSame && search.available) {
    return FieldError.fail(form.destination, "Chưa chọn điểm đến", "Chọn một địa điểm trong danh sách gợi ý để mình ghim đúng chỗ trên bản đồ.", "Chọn điểm đến");
  }
  if (!dates.start || !dates.end) {
    toggleCalendar(true);
    return FieldError.fail(dates.start ? document.getElementById("endBtn") : document.getElementById("startBtn"),
      "Thiếu ngày đi hoặc ngày về", "Chọn đủ ngày đi và ngày về để mình chia lịch trình theo từng ngày.", "Chọn ngày");
  }
  if (dates.end < dates.start) {
    return FieldError.fail(document.getElementById("endBtn"), "Ngày về đang trước ngày đi", "Ngày về phải bằng hoặc sau ngày đi. Bạn chọn lại giúp mình nhé.", "Chọn lại ngày");
  }

  const today = todayIso();
  const startChanged = !original || original.startDate !== dates.start;
  if (startChanged && dates.start < today) {
    const go = await Dialog.show({
      kind: "warn", title: "Ngày đi đã qua rồi",
      message: `Bạn đang ${original ? "đặt" : "tạo"} chuyến đi bắt đầu ${ddmmyyyy(dates.start)}, trước hôm nay. Nếu chỉ muốn lưu lại kỷ niệm thì vẫn lưu được.`,
      primary: original ? "Vẫn lưu" : "Vẫn tạo", secondary: "Đổi ngày"
    });
    if (!go) { toggleCalendar(true); return; }
  }

  // Đổi ngày làm một số hoạt động nằm ngoài chuyến đi
  if (original && (dates.start > original.startDate || dates.end < original.endDate) && original.itineraryCount > 0) {
    let items = [];
    try { items = await api(`/trips/${original.id}/itinerary`); } catch (err) { return reportError(err); }
    const outside = items.filter((i) => i.dayDate < dates.start || i.dayDate > dates.end);
    if (outside.length) {
      const days = [...new Set(outside.map((i) => i.dayDate))].sort();
      const go = await Dialog.show({
        kind: "warn",
        title: `Có ${outside.length} hoạt động nằm ngoài ngày mới`,
        message: `${days.map(dayLong).join(", ")} không còn trong chuyến đi. Các hoạt động đó sẽ chuyển vào mục "Ngoài lịch" để bạn đổi ngày hoặc xóa sau.`,
        primary: "Vẫn lưu", secondary: "Giữ ngày cũ"
      });
      if (!go) {
        dates = { start: original.startDate, end: original.endDate };
        calendar.set(dates.start, dates.end);
        paintDates();
        return;
      }
    }
  }

  const body = {
    name,
    destination,
    destinationAddress: pickedSame ? place.address || null : null,
    latitude: pickedSame && place.lat != null ? place.lat : null,
    longitude: pickedSame && place.lng != null ? place.lng : null,
    startDate: dates.start,
    endDate: dates.end,
    budget,
    description: form.description.value.trim() || null,
    isPublic: document.getElementById("fPublic").checked
  };
  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  saving = true;
  try {
    const saved = original
      ? await api("/trips/" + original.id, { method: "PUT", body })
      : await api("/trips", { method: "POST", body });
    dirty = false;
    window.location.href = "trip.html?id=" + saved.id + (original ? "&saved=1" : "&new=1");
  } catch (err) {
    saving = false;
    const key = Object.keys(err.fields || {})[0];
    const target = key === "startDate" ? document.getElementById("startBtn")
      : key === "endDate" ? document.getElementById("endBtn")
      : key === "budget" ? document.getElementById("fBudget")
      : key ? form[key === "description" ? "description" : key] : null;
    if (err.handled) return;
    FieldError.fail(target, original ? "Chưa lưu được chuyến đi" : "Chưa tạo được chuyến đi", err.message);
  } finally {
    btn.disabled = false;
  }
}
