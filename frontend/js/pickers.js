// ===== Lịch chọn khoảng ngày (2 tháng) và chọn giờ dạng cuộn =====

/**
 * Lịch chọn ngày vẽ vào container.
 * opts: mode "range" | "single", start, end, presets (bool), onChange(start, end), onDone()
 * Ngày đã qua vẫn chọn được (hiện mờ), vì có thể muốn lưu lại chuyến đã đi.
 */
function RangeCalendar(container, opts) {
  const state = {
    start: opts.start || null,
    end: opts.mode === "single" ? null : opts.end || null
  };
  const base = parseDate(state.start || todayIso());
  let viewY = base.getFullYear();
  let viewM = base.getMonth();
  const single = opts.mode === "single";

  function pick(iso) {
    if (single) {
      state.start = iso;
    } else if (!state.start || state.end || iso < state.start) {
      state.start = iso;
      state.end = null;
    } else {
      state.end = iso;
    }
    if (opts.onChange) opts.onChange(state.start, state.end);
    render();
    const again = container.querySelector(`[data-day="${iso}"]`);
    if (again) again.focus();
  }

  function weekend() {
    const t = todayIso();
    const dow = parseDate(t).getDay();
    const sat = dow === 0 ? addDays(t, -1) : addDays(t, 6 - dow);
    return [sat < t ? t : sat, addDays(sat, 1)];
  }

  function month(y, m) {
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(y, m + 1, 0).getDate();
    const today = todayIso();
    let cells = "";
    for (let i = 0; i < offset; i++) cells += `<div class="cal-cell"></div>`;
    for (let d = 1; d <= count; d++) {
      const k = y + "-" + pad2(m + 1) + "-" + pad2(d);
      const isStart = k === state.start;
      const isEnd = k === state.end;
      const inRange = state.start && state.end && k > state.start && k < state.end;
      let cell = "cal-cell";
      if (inRange) cell += " in";
      else if (isStart && state.end && state.end !== state.start) cell += " from";
      else if (isEnd && state.start !== state.end) cell += " to";
      let cls = "cal-day";
      if (isStart || isEnd) cls += " sel";
      if (k === today) cls += " today";
      else if (k < today) cls += " past";
      const label = WD_LONG[parseDate(k).getDay()] + ", " + ddmmyyyy(k) + (isStart ? (single ? ", đã chọn" : ", ngày đi") : isEnd ? ", ngày về" : "");
      cells += `<div class="${cell}"><button type="button" class="${cls}" data-day="${k}" aria-label="${label}" aria-pressed="${isStart || isEnd}">${d}</button></div>`;
    }
    return `<div class="cal-month"><h4>Tháng ${m + 1}, ${y}</h4><div class="cal-grid">
      ${["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((w, i) => `<div class="cal-wd ${i >= 5 ? "we" : ""}">${w}</div>`).join("")}
      ${cells}</div></div>`;
  }

  function footText() {
    if (single) return state.start ? dayLong(state.start) + "/" + parseDate(state.start).getFullYear() : "Chọn một ngày";
    if (!state.start) return "Chọn ngày đi";
    if (!state.end) return "Tiếp theo: chọn ngày về";
    return lengthLong(diffDays(state.start, state.end) + 1);
  }

  function render() {
    const y2 = viewM === 11 ? viewY + 1 : viewY;
    const m2 = (viewM + 1) % 12;
    const presets = !single && opts.presets !== false;
    container.innerHTML = `
      <div class="calendar" role="group" aria-label="${single ? "Chọn ngày" : "Chọn ngày đi và ngày về"}">
        <div class="cal-top">
          <button type="button" class="icon-btn bordered" data-nav="-1" aria-label="Tháng trước">${svg('<path d="m15 18-6-6 6-6"/>', 18, 2.6)}</button>
          ${presets ? `<div class="cal-presets">
            <button type="button" class="chip sm" data-preset="weekend">Cuối tuần này</button>
            <button type="button" class="chip sm" data-preset="1" ${state.start ? "" : "disabled"}>2N1Đ</button>
            <button type="button" class="chip sm" data-preset="2" ${state.start ? "" : "disabled"}>3N2Đ</button>
            <button type="button" class="chip sm" data-preset="6" ${state.start ? "" : "disabled"}>1 tuần</button>
          </div>` : ""}
          <button type="button" class="icon-btn bordered" data-nav="1" aria-label="Tháng sau">${svg('<path d="m9 18 6-6-6-6"/>', 18, 2.6)}</button>
        </div>
        <div class="cal-months">${month(viewY, viewM)}${month(y2, m2)}</div>
        <div class="cal-foot">
          <span aria-live="polite">${footText()}</span>
          ${opts.onDone ? `<button type="button" class="btn btn-dark btn-sm" data-done ${single || state.end ? "" : "disabled"}>Xong</button>` : ""}
        </div>
      </div>`;
  }

  container.addEventListener("click", (e) => {
    const day = e.target.closest("[data-day]");
    if (day) return pick(day.dataset.day);
    const nav = e.target.closest("[data-nav]");
    if (nav) {
      viewM += Number(nav.dataset.nav);
      if (viewM < 0) { viewM = 11; viewY--; }
      if (viewM > 11) { viewM = 0; viewY++; }
      return render();
    }
    const preset = e.target.closest("[data-preset]");
    if (preset) {
      if (preset.dataset.preset === "weekend") {
        [state.start, state.end] = weekend();
        const d = parseDate(state.start);
        viewY = d.getFullYear(); viewM = d.getMonth();
      } else if (state.start) {
        state.end = addDays(state.start, Number(preset.dataset.preset));
      }
      if (opts.onChange) opts.onChange(state.start, state.end);
      return render();
    }
    if (e.target.closest("[data-done]") && opts.onDone) opts.onDone(state.start, state.end);
  });

  render();
  return {
    set(start, end) { state.start = start; state.end = end; render(); },
    get() { return { start: state.start, end: state.end }; }
  };
}

// ===== Chọn giờ dạng bánh xe cuộn (kiểu iOS) =====
const WHEEL_ITEM = 48;

function toMinutes(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fromMinutes(v) { v = Math.max(0, Math.min(v, 23 * 60 + 59)); return pad2(Math.floor(v / 60)) + ":" + pad2(v % 60); }

/**
 * Ô chọn giờ: một nút hiện giờ đã chọn, bấm vào mở bánh xe cuộn bên dưới.
 * opts: label, placeholder, fallback() -> giờ mặc định khi mở lần đầu,
 *       presets [[nhãn, "HH:MM"]], durations() -> [[nhãn, "HH:MM"]], onChange(value)
 */
function TimeField(fieldEl, opts) {
  let value = null;
  let open = false;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "time-field";
  btn.setAttribute("aria-expanded", "false");
  const pop = document.createElement("div");
  pop.className = "wheel-pop hidden";
  fieldEl.appendChild(btn);
  fieldEl.appendChild(pop);
  if (opts.id) btn.id = opts.id;

  function paintButton() {
    btn.classList.toggle("empty", !value);
    btn.classList.toggle("active", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.innerHTML = `<span>${value || opts.placeholder || "Chưa chọn giờ"}</span>${svg(ICON.clock, 18)}`;
  }

  function itemsHtml(count, cur) {
    let s = "";
    for (let i = 0; i < count; i++) {
      const dist = Math.abs(i - cur);
      s += `<button type="button" class="wheel-item ${dist === 0 ? "on" : dist === 1 ? "near" : ""}" data-i="${i}" tabindex="-1" aria-hidden="${dist !== 0}">${pad2(i)}</button>`;
    }
    return s;
  }

  function buildPop() {
    const [h, m] = (value || "08:00").split(":").map(Number);
    const durations = opts.durations ? opts.durations() : [];
    pop.innerHTML = `
      <div class="wheel-head"><span>${escapeHtml(opts.label)}</span>
        </div>
      <div class="wheel">
        <div class="wheel-col" data-col="h" tabindex="0" role="spinbutton" aria-label="Giờ" aria-valuemin="0" aria-valuemax="23" aria-valuenow="${h}">${itemsHtml(24, h)}</div>
        <span class="wheel-sep" aria-hidden="true">:</span>
        <div class="wheel-col" data-col="m" tabindex="0" role="spinbutton" aria-label="Phút" aria-valuemin="0" aria-valuemax="59" aria-valuenow="${m}">${itemsHtml(60, m)}</div>
      </div>
      ${opts.presets ? `<div class="wheel-chips">${opts.presets.map(([l, t]) => `<button type="button" class="chip sm" data-set="${t}">${l} ${t}</button>`).join("")}</div>` : ""}
      ${durations.length ? `<div class="wheel-chips">${durations.map(([l, t]) => `<button type="button" class="chip sm" data-set="${t}">${l}</button>`).join("")}</div>` : ""}
      <div class="row-between">
        <button type="button" class="btn btn-ghost btn-sm" data-clear>Bỏ giờ</button>
        <button type="button" class="btn btn-dark btn-sm" data-wheel-done>Xong</button>
      </div>`;
    const hc = pop.querySelector('[data-col="h"]');
    const mc = pop.querySelector('[data-col="m"]');
    hc.scrollTop = h * WHEEL_ITEM;
    mc.scrollTop = m * WHEEL_ITEM;
    [hc, mc].forEach((col) => {
      let t;
      col.addEventListener("scroll", () => {
        clearTimeout(t);
        t = setTimeout(() => readColumns(), 80);
      });
      col.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const max = col.dataset.col === "h" ? 23 : 59;
        const cur = Math.round(col.scrollTop / WHEEL_ITEM);
        const next = Math.max(0, Math.min(max, cur + (e.key === "ArrowDown" ? 1 : -1)));
        col.scrollTop = next * WHEEL_ITEM;
        readColumns();
      });
    });
  }

  function paintColumn(col, cur) {
    col.setAttribute("aria-valuenow", cur);
    col.setAttribute("aria-valuetext", pad2(cur));
    col.querySelectorAll(".wheel-item").forEach((b) => {
      const dist = Math.abs(Number(b.dataset.i) - cur);
      b.className = "wheel-item " + (dist === 0 ? "on" : dist === 1 ? "near" : "");
      b.setAttribute("aria-hidden", String(dist !== 0));
    });
  }

  function readColumns() {
    const hc = pop.querySelector('[data-col="h"]');
    const mc = pop.querySelector('[data-col="m"]');
    if (!hc) return;
    const h = Math.max(0, Math.min(23, Math.round(hc.scrollTop / WHEEL_ITEM)));
    const m = Math.max(0, Math.min(59, Math.round(mc.scrollTop / WHEEL_ITEM)));
    paintColumn(hc, h);
    paintColumn(mc, m);
    setValue(pad2(h) + ":" + pad2(m), false);
  }

  function scrollTo(t, smooth) {
    const [h, m] = t.split(":").map(Number);
    const b = smooth ? "smooth" : "auto";
    const hc = pop.querySelector('[data-col="h"]');
    const mc = pop.querySelector('[data-col="m"]');
    if (hc) { hc.scrollTo({ top: h * WHEEL_ITEM, behavior: b }); mc.scrollTo({ top: m * WHEEL_ITEM, behavior: b }); }
  }

  function setValue(v, rebuild = true) {
    const changed = v !== value;
    value = v;
    paintButton();
    if (rebuild && open) scrollTo(v, true);
    if (changed && opts.onChange) opts.onChange(value);
  }

  function setOpen(o) {
    if (o === open) return;
    open = o;
    if (open) {
      document.dispatchEvent(new CustomEvent("timefield:open", { detail: api }));
      if (!value) setValue(opts.fallback ? opts.fallback() : "08:00", false);
      buildPop();
      pop.classList.remove("hidden");
      pop.querySelector('[data-col="h"]').focus({ preventScroll: true });
      pop.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      pop.classList.add("hidden");
      pop.innerHTML = "";
    }
    paintButton();
  }

  btn.addEventListener("click", () => setOpen(!open));
  pop.addEventListener("click", (e) => {
    const item = e.target.closest(".wheel-item");
    if (item) {
      const col = item.closest(".wheel-col");
      col.scrollTo({ top: Number(item.dataset.i) * WHEEL_ITEM, behavior: "smooth" });
      return;
    }
    const set = e.target.closest("[data-set]");
    if (set) return setValue(set.dataset.set);
    if (e.target.closest("[data-clear]")) { setOpen(false); setValue(null); btn.focus(); }
    if (e.target.closest("[data-wheel-done]")) { setOpen(false); btn.focus(); }
  });
  pop.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); btn.focus(); } });

  const api = {
    button: btn,
    get value() { return value; },
    set(v) { value = v || null; paintButton(); if (open) scrollTo(value || "08:00", false); },
    close() { setOpen(false); }
  };
  document.addEventListener("timefield:open", (e) => { if (e.detail !== api) setOpen(false); });
  paintButton();
  return api;
}
