// ===== Tìm địa điểm cho ô "Điểm đến" =====
// Có GOOGLE_MAPS_API_KEY thì dùng Google Places (API mới), không có thì dùng OpenStreetMap (Photon, rồi Nominatim).

const PlaceProviders = {
  google: {
    credit: "Gợi ý từ Google",
    loading: null,
    async ready() {
      if (window.google && google.maps && google.maps.importLibrary) return;
      if (!this.loading) {
        this.loading = new Promise((resolve, reject) => {
          window.__tpMapsReady = resolve;
          const s = document.createElement("script");
          s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(GOOGLE_MAPS_API_KEY) +
            "&v=weekly&loading=async&language=vi&region=VN&callback=__tpMapsReady";
          s.async = true;
          s.onerror = () => { this.loading = null; reject(new Error("Không tải được Google Maps")); };
          document.head.appendChild(s);
        });
      }
      await this.loading;
    },
    token: null,
    async search(text) {
      await this.ready();
      const { AutocompleteSuggestion, AutocompleteSessionToken } = await google.maps.importLibrary("places");
      if (!this.token) this.token = new AutocompleteSessionToken();
      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: text, sessionToken: this.token, language: "vi", region: "vn"
      });
      return suggestions.map((s) => s.placePrediction).filter(Boolean).slice(0, 6).map((p) => ({
        name: p.mainText ? p.mainText.text : p.text.text,
        address: p.secondaryText ? p.secondaryText.text : "",
        prediction: p
      }));
    },
    async resolve(item) {
      const place = item.prediction.toPlace();
      await place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
      this.token = null; // hết một phiên tìm kiếm
      return {
        name: item.name,
        address: place.formattedAddress || item.address,
        lat: place.location ? place.location.lat() : null,
        lng: place.location ? place.location.lng() : null
      };
    }
  },

  osm: {
    credit: "Gợi ý từ © OpenStreetMap",
    controller: null,
    // Photon gợi ý nhanh theo từng chữ gõ; không có kết quả thì thử Nominatim
    async search(text) {
      if (this.controller) this.controller.abort();
      const controller = this.controller = new AbortController();
      let found = [];
      try {
        found = await this.photon(text, controller.signal);
      } catch (err) {
        if (controller.signal.aborted) throw err; // đã có lượt tìm mới hơn
      }
      if (found.length) return found;
      return this.nominatim(text, controller.signal);
    },
    async photon(text, signal) {
      const url = "https://photon.komoot.io/api/?limit=6&q=" + encodeURIComponent(text);
      const data = await fetchJson(url, signal, 6000);
      return (data.features || []).map((f) => {
        const p = f.properties || {};
        const name = p.name || p.city || p.state || p.country || text;
        const address = [p.street, p.district, p.city, p.county, p.state, p.country]
          .filter((x, i, a) => x && x !== name && a.indexOf(x) === i).join(", ");
        const [lng, lat] = (f.geometry && f.geometry.coordinates) || [null, null];
        return { name, address, lat, lng };
      });
    },
    async nominatim(text, signal) {
      const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=vi&q=" + encodeURIComponent(text);
      const rows = await fetchJson(url, signal, 8000);
      return rows.map((r) => {
        const parts = String(r.display_name || "").split(",").map((s) => s.trim());
        const name = r.name || parts[0];
        return {
          name,
          address: parts.filter((p, i) => !(i === 0 && p === name)).join(", "),
          lat: Number(r.lat), lng: Number(r.lon)
        };
      });
    },
    async resolve(item) {
      return { name: item.name, address: item.address, lat: item.lat, lng: item.lng };
    }
  }
};

// Gọi một dịch vụ bản đồ, quá ms mili giây thì bỏ (tránh treo ở "Đang tìm").
// signal: hủy khi người dùng gõ tiếp (lượt tìm mới).
async function fetchJson(url, signal, ms) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener("abort", stop);
  const t = setTimeout(stop, ms);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("Không tìm được địa điểm");
    return await res.json();
  } finally {
    clearTimeout(t);
    signal.removeEventListener("abort", stop);
  }
}

/**
 * Gắn gợi ý địa điểm vào một ô nhập.
 * opts.onPick(place | null): place = { name, address, lat, lng }, null khi người dùng gõ lại chữ khác.
 * Trả về { available } để biết dịch vụ tìm kiếm có dùng được không (mất mạng thì cho nhập tay).
 */
function PlaceSearch(input, opts) {
  // Có khóa Google thì dùng Google; Google lỗi (sai khóa, chưa bật API) thì tự chuyển sang OpenStreetMap
  let provider = GOOGLE_MAPS_API_KEY ? PlaceProviders.google : PlaceProviders.osm;
  const list = document.createElement("ul");
  list.className = "suggest-list hidden";
  list.id = input.id + "-list";
  list.setAttribute("role", "listbox");
  input.closest(".combo").appendChild(list);
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-expanded", "false");

  let items = [];
  let active = -1;
  let timer = null;
  let seq = 0;
  const state = { available: true };

  function show(html) {
    list.innerHTML = html;
    list.classList.remove("hidden");
    input.setAttribute("aria-expanded", "true");
  }
  function hide() {
    list.classList.add("hidden");
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  }
  function paint() {
    if (!items.length) {
      show(`<li class="state">Không thấy địa điểm nào khớp. Thử gõ tên tỉnh/thành phố nhé.</li>`);
      return;
    }
    show(items.map((it, i) => `
      <li role="option" id="${list.id}-${i}" aria-selected="${i === active}">
        <button type="button" data-i="${i}" tabindex="-1">
          <span class="pin">${svg(ICON.pin, 18)}</span>
          <span style="min-width:0"><b>${escapeHtml(it.name)}</b><span class="sub">${escapeHtml(it.address)}</span></span>
        </button>
      </li>`).join("") + `<li class="credit" aria-hidden="true">${provider.credit}</li>`);
    if (active >= 0) input.setAttribute("aria-activedescendant", `${list.id}-${active}`);
  }

  async function run(text) {
    const my = ++seq;
    show(`<li class="state">Đang tìm "${escapeHtml(text)}"...</li>`);
    try {
      let found;
      try {
        found = await provider.search(text);
      } catch (err) {
        if (provider !== PlaceProviders.google || my !== seq) throw err;
        provider = PlaceProviders.osm;
        found = await provider.search(text);
      }
      if (my !== seq) return;
      state.available = true;
      items = found;
      active = items.length ? 0 : -1;
      paint();
    } catch (err) {
      if (my !== seq) return;
      state.available = false;
      items = [];
      show(`<li class="state">Không kết nối được dịch vụ bản đồ. Bạn cứ gõ tên điểm đến, mình sẽ lưu đúng chữ bạn gõ.</li>`);
    }
  }

  async function choose(i) {
    const it = items[i];
    if (!it) return;
    hide();
    input.value = it.name;
    try {
      const place = await provider.resolve(it);
      opts.onPick(place);
    } catch {
      opts.onPick({ name: it.name, address: it.address, lat: null, lng: null });
    }
  }

  input.addEventListener("input", () => {
    opts.onPick(null);
    clearTimeout(timer);
    const text = input.value.trim();
    if (text.length < 2) { seq++; hide(); return; }
    // OpenStreetMap chỉ cho 1 lượt tìm mỗi giây, nên chờ người dùng gõ xong
    timer = setTimeout(() => run(text), GOOGLE_MAPS_API_KEY ? 250 : 650);
  });
  input.addEventListener("keydown", (e) => {
    const openNow = !list.classList.contains("hidden") && items.length;
    if (e.key === "ArrowDown" && openNow) { e.preventDefault(); active = (active + 1) % items.length; paint(); }
    else if (e.key === "ArrowUp" && openNow) { e.preventDefault(); active = (active - 1 + items.length) % items.length; paint(); }
    else if (e.key === "Enter" && openNow && active >= 0) { e.preventDefault(); choose(active); }
    else if (e.key === "Escape" && !list.classList.contains("hidden")) { e.stopPropagation(); hide(); }
  });
  list.addEventListener("mousedown", (e) => e.preventDefault()); // giữ con trỏ trong ô nhập
  list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (b) choose(Number(b.dataset.i));
  });
  input.addEventListener("blur", () => setTimeout(hide, 120));

  return {
    get available() { return state.available; },
    search(text) { input.value = text; if (text.trim().length >= 2) run(text.trim()); }
  };
}

// Bản đồ xem trước (nhúng Google Maps, không cần khóa)
function mapEmbedUrl(place) {
  const q = place.lat != null ? place.lat + "," + place.lng : place.name + (place.address ? ", " + place.address : "");
  return "https://maps.google.com/maps?q=" + encodeURIComponent(q) + "&z=12&hl=vi&output=embed";
}
function mapLinkUrl(place) {
  const q = place.lat != null ? place.lat + "," + place.lng : place.name + (place.address ? ", " + place.address : "");
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
}
