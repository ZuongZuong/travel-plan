package com.travelplan.service;

import com.travelplan.exception.BadRequestException;
import com.travelplan.exception.NotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.regex.Pattern;

/** Lưu ảnh bìa người dùng tải lên vào thư mục trên ổ đĩa. */
@Component
public class CoverStorage {

    public static final String PUBLIC_PATH = "/api/public/uploads/covers/";
    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final Pattern FILE_NAME = Pattern.compile("^[0-9a-f\\-]{36}\\.(jpg|png|webp)$");

    private final Path dir;

    public CoverStorage(@Value("${app.upload-dir:uploads}") String uploadDir) {
        this.dir = Path.of(uploadDir, "covers").toAbsolutePath().normalize();
    }

    /** Lưu file và trả về link đầy đủ để gán vào coverImageUrl. */
    public String store(MultipartFile file, String baseUrl) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Bạn chưa chọn ảnh");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new BadRequestException("Ảnh quá nặng. Chọn ảnh dưới 5MB nhé.");
        }
        String ext = detectExtension(file);
        if (ext == null) {
            throw new BadRequestException("Chỉ nhận ảnh JPG, PNG hoặc WEBP");
        }
        String name = UUID.randomUUID() + "." + ext;
        try {
            Files.createDirectories(dir);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, dir.resolve(name));
            }
        } catch (IOException e) {
            throw new IllegalStateException("Không lưu được ảnh", e);
        }
        return baseUrl + PUBLIC_PATH + name;
    }

    public Path resolve(String name) {
        if (!FILE_NAME.matcher(name).matches()) {
            throw new NotFoundException("Không tìm thấy ảnh");
        }
        Path p = dir.resolve(name);
        if (!Files.isRegularFile(p)) {
            throw new NotFoundException("Không tìm thấy ảnh");
        }
        return p;
    }

    /** Xóa file cũ nếu link trỏ tới ảnh do chính máy chủ này lưu. */
    public void deleteIfOwned(String url) {
        int i = url.indexOf(PUBLIC_PATH);
        if (i < 0) {
            return;
        }
        String name = url.substring(i + PUBLIC_PATH.length());
        if (FILE_NAME.matcher(name).matches()) {
            try {
                Files.deleteIfExists(dir.resolve(name));
            } catch (IOException ignored) {
                // Ảnh cũ không xóa được thì bỏ qua, không ảnh hưởng dữ liệu
            }
        }
    }

    /** Nhận dạng ảnh theo vài byte đầu file thay vì tin vào tên file. */
    private static String detectExtension(MultipartFile file) {
        byte[] h = new byte[12];
        int n;
        try (InputStream in = file.getInputStream()) {
            n = in.readNBytes(h, 0, h.length);
        } catch (IOException e) {
            return null;
        }
        if (n >= 3 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF) {
            return "jpg";
        }
        if (n >= 8 && (h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G') {
            return "png";
        }
        if (n >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') {
            return "webp";
        }
        return null;
    }
}
