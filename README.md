# Travel Plan - Website lên kế hoạch du lịch

- **Frontend**: HTML, CSS, JavaScript thuần (thư mục `frontend/`)
- **Backend**: Java 21, Spring Boot 3.5, Maven, Spring Security + JWT (thư mục `backend/`)
- **Database**: SQL Server 2022 chạy bằng Docker Compose

## Chức năng
- Đăng ký, đăng nhập (JWT). Mỗi người chỉ thấy chuyến đi của mình.
- Tạo, sửa, xóa chuyến đi: tên, điểm đến (tìm trên bản đồ), ngày đi/về (lịch chọn khoảng ngày), ngân sách, mô tả.
- Ảnh bìa đổi ở trang chi tiết: tải ảnh lên (JPG/PNG/WEBP, tối đa 5MB), dán link hoặc chọn màu.
- Lịch trình theo từng ngày: hoạt động, giờ bắt đầu/kết thúc (chọn giờ dạng cuộn), địa điểm, ghi chú; cảnh báo trùng giờ.
- Quỹ chuyến đi: chi phí theo loại, chi theo ngày, mỗi ngày còn tiêu được bao nhiêu, cảnh báo vượt ngân sách.
- Cộng đồng: trang chủ hiện điểm đến được lên kèo nhiều nhất cuối tuần này (đếm ẩn danh) và các lịch trình được chia sẻ công khai; bấm "Dùng lại" để chép lịch trình sang chuyến của mình.
- Mọi ràng buộc dữ liệu đều báo bằng popup (lỗi, cảnh báo, xác nhận xóa, rời trang khi chưa lưu, hết phiên đăng nhập, mất kết nối).

## Cấu trúc thư mục
```
travel-plan/
├── docker-compose.yml        # SQL Server + tự tạo database travel_plan
├── backend/                  # Spring Boot (cổng 8080)
│   ├── pom.xml
│   └── src/main/
│       ├── java/com/travelplan/
│       │   ├── config/       # SecurityConfig (JWT, CORS)
│       │   ├── controller/   # REST API
│       │   ├── dto/          # Dữ liệu vào/ra API
│       │   ├── entity/       # User, Trip, ItineraryItem, Expense
│       │   ├── exception/    # Xử lý lỗi trả về JSON
│       │   ├── repository/   # Spring Data JPA
│       │   ├── security/     # JwtService, JwtAuthFilter
│       │   └── service/      # Nghiệp vụ
│       └── resources/application.properties
└── frontend/                 # Web tĩnh (cổng 5500)
    ├── index.html            # Trang chủ
    ├── login.html, register.html
    ├── trips.html            # Danh sách chuyến đi
    ├── trip-form.html        # Tạo / sửa chuyến đi (?id= khi sửa)
    ├── trip.html             # Chi tiết: lịch trình + ngân sách
    ├── css/style.css
    └── js/
        ├── config.js         # Địa chỉ API, khóa Google Maps (không bắt buộc)
        ├── api.js            # Gọi API, popup, tiện ích dùng chung
        ├── pickers.js        # Lịch chọn ngày, chọn giờ dạng cuộn
        ├── place-search.js   # Tìm địa điểm (Google Places hoặc OpenStreetMap)
        └── home.js, auth.js, trips.js, trip-form.js, trip-detail.js
```

## Đưa lên mạng
Xem [DEPLOY.md](DEPLOY.md): frontend trên InfinityFree, backend trên Render, database PostgreSQL trên Neon.

## Cách chạy

Cần cài: Docker Desktop, JDK 21, Maven (hoặc mở bằng IntelliJ).

### 1. Chạy SQL Server
```bash
cd travel-plan
docker compose up -d
```
- SQL Server ở `localhost:1434` (tránh đụng SQL Server khác đang dùng cổng 1433), tài khoản `sa` / `TravelPlan@123`.
- Service `sqlserver-init` tự tạo database `travel_plan` rồi tự tắt (trạng thái `Exited (0)` là bình thường).
- Máy Mac chip Apple (M1/M2/M3...): image SQL Server chỉ có bản amd64, hãy bật
  *Docker Desktop > Settings > General > "Use Rosetta for x86_64/amd64 emulation"*.

### 2. Chạy backend
```bash
cd backend
mvn spring-boot:run
```
Backend chạy ở `http://localhost:8080`. Các bảng được Hibernate tự tạo khi khởi động.

### 3. Chạy frontend
Mở thư mục `frontend/` bằng một web server tĩnh ở cổng **5500**, ví dụ:
- VS Code: cài extension **Live Server**, chuột phải `index.html` > *Open with Live Server*, hoặc
- `cd frontend && python3 -m http.server 5500`

Rồi mở `http://localhost:5500` (hoặc `http://127.0.0.1:5500`).

### 4. (Không bắt buộc) Google Maps
Mặc định ô "Điểm đến" tìm địa điểm bằng OpenStreetMap, không cần khóa. Muốn dùng gợi ý của Google:
bật **Maps JavaScript API** và **Places API (New)** trong Google Cloud, tạo API key (nên giới hạn theo
địa chỉ web `http://localhost:5500/*`), rồi điền vào `GOOGLE_MAPS_API_KEY` trong `frontend/js/config.js`.
Bản đồ xem trước dùng link nhúng của Google Maps nên không cần khóa.

> Không mở file bằng `file://` vì trình duyệt sẽ chặn gọi API.
> Nếu dùng cổng khác, thêm địa chỉ đó vào `app.cors.allowed-origins` trong `application.properties`.

## API
Tất cả API (trừ đăng ký/đăng nhập và `/api/public/**`) cần header `Authorization: Bearer <token>`.

| Method | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/api/auth/register` | Đăng ký |
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/auth/me` | Thông tin người dùng hiện tại |
| GET/POST | `/api/trips` | Danh sách / tạo chuyến đi |
| GET/PUT/DELETE | `/api/trips/{id}` | Xem / sửa / xóa chuyến đi |
| GET | `/api/trips/{id}/budget` | Tổng hợp ngân sách |
| PUT | `/api/trips/{id}/cover` | Đổi ảnh bìa bằng link hoặc màu |
| POST | `/api/trips/{id}/cover/upload` | Tải ảnh bìa lên (multipart, trường `file`) |
| POST | `/api/trips/{id}/clone` | Dùng lại lịch trình công khai, body `{"startDate":"2026-10-17"}` |
| GET | `/api/public/trending-destinations` | Điểm đến hot cuối tuần này (không cần đăng nhập) |
| GET | `/api/public/itineraries` | Lịch trình được chia sẻ công khai (không cần đăng nhập) |
| GET/POST | `/api/trips/{id}/itinerary` | Lịch trình |
| PUT/DELETE | `/api/trips/{id}/itinerary/{itemId}` | Sửa / xóa hoạt động |
| GET/POST | `/api/trips/{id}/expenses` | Chi phí |
| PUT/DELETE | `/api/trips/{id}/expenses/{expenseId}` | Sửa / xóa khoản chi |

## Lưu ý
- Mật khẩu SQL Server và `app.jwt.secret` trong `application.properties` chỉ dùng để chạy thử trên máy, nên đổi nếu triển khai thật.
- Ảnh bìa tải lên được lưu ở thư mục `backend/uploads/` (đổi bằng `app.upload-dir`).
- Bảng `trips` có thêm các cột `cover_color`, `destination_address`, `latitude`, `longitude`, `is_public`, `cloned_from_id`; Hibernate tự thêm khi khởi động, dữ liệu cũ giữ nguyên.
- Chạy test backend: `cd backend && mvn test` (dùng H2 trong bộ nhớ, không cần SQL Server).
