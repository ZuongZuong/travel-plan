# Đưa Travel Plan lên mạng (miễn phí)

InfinityFree chỉ chạy PHP + MySQL, **không chạy được Java (Spring Boot)** và MySQL của nó không cho kết nối từ ngoài vào. Vì vậy web được tách làm 3 chỗ, đều miễn phí:

| Phần | Đặt ở đâu | Link sau khi xong |
|---|---|---|
| Frontend (HTML/CSS/JS) | **InfinityFree** | `https://ten-ban.infinityfreeapp.com` |
| Backend (Spring Boot) | **Render** (chạy Docker) | `https://travel-plan-api.onrender.com` |
| Database | **Neon** (PostgreSQL) | chuỗi kết nối `jdbc:postgresql://...` |

Trên máy bạn vẫn chạy y như cũ với SQL Server (docker compose). Backend tự đổi sang PostgreSQL khi có biến môi trường `DB_URL`, không cần sửa code.

Làm theo thứ tự: **Neon → GitHub → Render → InfinityFree → quay lại Render sửa CORS**.

---

## Bước 1. Tạo database trên Neon

1. Vào https://neon.tech, đăng nhập bằng Google hoặc GitHub (không cần thẻ).
2. **Create project**: đặt tên `travel-plan`, Postgres 16 hoặc 17, region **AWS Asia Pacific (Singapore)** cho gần Việt Nam.
3. Trong trang project bấm **Connect**. Chọn database `neondb`, rồi ở ô chọn kiểu kết nối chọn **Java** (hoặc JDBC). Bạn sẽ thấy dạng:
   ```
   jdbc:postgresql://ep-xxxx-xxxx.ap-southeast-1.aws.neon.tech/neondb?user=neondb_owner&password=npg_xxxx&sslmode=require
   ```
4. Ghi lại 3 giá trị (dùng ở bước 3):
   - `DB_URL` = `jdbc:postgresql://ep-xxxx-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
   - `DB_USERNAME` = `neondb_owner`
   - `DB_PASSWORD` = `npg_xxxx`

Bảng sẽ được Hibernate tự tạo khi backend chạy lần đầu, bạn không cần tạo tay.

## Bước 2. Đưa code lên GitHub

Render lấy code từ GitHub để build.

1. Vào https://github.com/new, đặt tên repo `travel-plan`, chọn **Private** cũng được, bấm **Create repository**.
2. Ở trang repo trống, bấm link **uploading an existing file**.
3. Giải nén file zip này, mở thư mục `travel-plan`, chọn **tất cả** bên trong (`backend`, `frontend`, `README.md`, `DEPLOY.md`, `docker-compose.yml`, `.gitignore`) kéo thả vào trang GitHub, rồi bấm **Commit changes**.
   - Không kéo thư mục `backend/target` nếu có (file .jar rất nặng).
   - Hoặc dùng git trên máy: `git init && git add . && git commit -m "deploy" && git remote add origin https://github.com/ZuongZuong/travel-plan.git && git push -u origin main`.
4. Kiểm tra trên GitHub thấy file `backend/Dockerfile` là được.

## Bước 3. Chạy backend trên Render

1. Vào https://render.com, đăng nhập bằng GitHub.
2. **New + → Web Service**, chọn repo `travel-plan` (lần đầu bấm *Configure GitHub* để cho Render đọc repo).
3. Điền:
   - **Name**: `travel-plan-api` (tên này thành link `https://travel-plan-api.onrender.com`; nếu bị trùng, Render thêm đuôi, ghi lại link thật)
   - **Region**: Singapore
   - **Root Directory**: `backend`
   - **Language / Runtime**: **Docker**
   - **Instance Type**: **Free**
4. Mục **Environment Variables**, thêm:

   | Key | Value |
   |---|---|
   | `DB_URL` | giá trị `DB_URL` ở bước 1 |
   | `DB_USERNAME` | giá trị ở bước 1 |
   | `DB_PASSWORD` | giá trị ở bước 1 |
   | `JWT_SECRET` | một chuỗi ngẫu nhiên dài ≥ 32 ký tự (trên Mac chạy `openssl rand -base64 48` rồi dán kết quả) |
   | `CORS_ORIGINS` | tạm để `https://*.infinityfreeapp.com,http://*.infinityfreeapp.com`, bước 5 sẽ đổi thành đúng tên miền của bạn |

5. Bấm **Deploy Web Service**. Lần đầu build mất vài phút. Xong khi log có dòng `Started TravelPlanApplication`.
6. Kiểm tra: mở `https://travel-plan-api.onrender.com/api/public/itineraries` trên trình duyệt, thấy `[]` là backend đã chạy và kết nối được database.

## Bước 4. Đưa frontend lên InfinityFree

1. Sửa file `frontend/js/config.js` trên máy: thay link ở dòng
   ```js
   const PRODUCTION_API_URL = "https://travel-plan-api.onrender.com/api";
   ```
   bằng link Render thật của bạn (giữ đuôi `/api`). Nếu Render cho đúng tên `travel-plan-api` thì không cần sửa.
2. Vào https://dash.infinityfree.com/accounts → **Create Account**:
   - Chọn tên miền con miễn phí, ví dụ `travelplan-duong.infinityfreeapp.com`.
   - Đợi tài khoản chuyển sang *Active* (thường vài phút).
3. Trong tài khoản vừa tạo, bấm **File Manager**, mở thư mục **`htdocs`**.
   - Xóa file mặc định `index2.html` (nếu có).
   - Tải **nội dung bên trong** thư mục `frontend` lên `htdocs` (tức là `htdocs/index.html`, `htdocs/css/`, `htdocs/js/`..., **không** phải `htdocs/frontend/index.html`).
   - File Manager tải từng thư mục hơi chậm; cách nhanh hơn là nén nội dung `frontend` thành zip, tải zip lên `htdocs` rồi chuột phải chọn **Extract**. Hoặc dùng FileZilla với thông tin ở mục **FTP Details** trong dashboard.
4. Mở `http://ten-ban.infinityfreeapp.com`. Tên miền mới có thể mất tới vài giờ mới truy cập được.
5. HTTPS: vào mục **SSL Certificates** của tài khoản InfinityFree để xin chứng chỉ miễn phí cho tên miền (nếu `https://` chưa mở được).

## Bước 5. Cho phép tên miền của bạn gọi backend (CORS)

Trên Render → service `travel-plan-api` → **Environment**, sửa `CORS_ORIGINS` thành đúng tên miền của bạn, cả http và https:
```
https://travelplan-duong.infinityfreeapp.com,http://travelplan-duong.infinityfreeapp.com
```
Lưu lại, Render tự khởi động lại. Xong, vào web đăng ký tài khoản và dùng thử.

---

## Những điều cần biết

- **Lần mở đầu tiên sau một lúc không ai dùng sẽ chậm khoảng 1 phút.** Gói Free của Render tắt backend sau 15 phút không có request và bật lại khi có người vào. Nếu hiện popup "Mất kết nối", đợi chút rồi bấm **Thử lại**. Trước khi demo cho thầy/cô, mở link `/api/public/itineraries` ở bước 3 trước 1 phút cho backend thức dậy.
- **Ảnh bìa tải lên từ máy sẽ mất khi Render khởi động lại** (ổ đĩa gói Free không lưu lâu). Dữ liệu chuyến đi, lịch trình, chi phí nằm trong Neon nên không mất. Muốn ảnh bìa bền, dùng cách "dán link ảnh" hoặc "chọn màu".
- Sửa code backend: đẩy lên GitHub, Render tự build lại. Sửa frontend: tải lại file đã sửa lên `htdocs`.
- Trình duyệt có thể giữ bản JS cũ, nhấn **Cmd+Shift+R** để tải lại hẳn.
- Nếu muốn giữ đúng SQL Server như lúc làm đồ án: dùng **Azure SQL Database** (gói miễn phí, sinh viên đăng ký Azure for Students bằng email trường không cần thẻ). Khi đó đặt `DB_URL=jdbc:sqlserver://ten-server.database.windows.net:1433;databaseName=travel_plan;encrypt=true` cùng `DB_USERNAME`/`DB_PASSWORD` của Azure, các bước khác giữ nguyên.

## Sửa gì so với bản chạy trên máy

- `backend/pom.xml`: thêm driver PostgreSQL (driver SQL Server vẫn giữ).
- `backend/src/main/resources/application.properties`: các giá trị database, JWT, CORS, cổng đọc từ biến môi trường; không có biến thì dùng giá trị cũ để chạy trên máy.
- `backend/.../config/SecurityConfig.java`: CORS cho phép dấu `*` (mọi cổng localhost, tên miền con).
- `backend/Dockerfile`: để Render build và chạy backend.
- `frontend/js/config.js`: tự gọi `localhost:8080` khi mở trên máy, gọi Render khi mở trên InfinityFree.
- `frontend/js/place-search.js`: tìm địa điểm qua Photon rồi Nominatim, mỗi lượt chờ tối đa 6–8 giây; Google lỗi thì tự chuyển sang OpenStreetMap.
