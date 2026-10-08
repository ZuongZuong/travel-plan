package com.travelplan.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Đổi ảnh bìa: dùng link ảnh, hoặc để trống link và chọn màu. */
public record CoverRequest(
        @Size(max = 500, message = "Link ảnh tối đa 500 ký tự")
        @Pattern(regexp = "^(https?://\\S+)?$", message = "Link ảnh phải bắt đầu bằng http:// hoặc https://")
        String coverImageUrl,

        @Pattern(regexp = "^(#[0-9A-Fa-f]{6})?$", message = "Màu bìa không hợp lệ")
        String coverColor
) {
}
