// Địa chỉ backend Spring Boot.
// Mở trang trên máy (localhost/127.0.0.1) thì gọi backend trên máy,
// mở trên InfinityFree thì gọi backend trên Render.
// >>> Sau khi deploy backend, thay link dưới đây bằng link Render của bạn (giữ đuôi /api) <<<
const PRODUCTION_API_URL = "https://travel-plan-api.onrender.com/api";

const API_BASE_URL = ["localhost", "127.0.0.1", ""].includes(location.hostname)
  ? "http://localhost:8080/api"
  : PRODUCTION_API_URL;

// Khóa Google Maps (Maps JavaScript API + Places API (New)).
// Để trống thì ô "Điểm đến" tìm địa điểm bằng OpenStreetMap (Photon, Nominatim), không cần khóa.
const GOOGLE_MAPS_API_KEY = "";
