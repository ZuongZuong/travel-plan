package com.travelplan.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Dữ liệu tạo/sửa chuyến đi. Ảnh bìa được đổi riêng qua CoverRequest. */
public record TripRequest(
        @NotBlank(message = "Vui lòng nhập tên chuyến đi")
        @Size(max = 150, message = "Tên chuyến đi tối đa 150 ký tự")
        String name,

        @NotBlank(message = "Vui lòng nhập điểm đến")
        @Size(max = 150, message = "Điểm đến tối đa 150 ký tự")
        String destination,

        @Size(max = 255, message = "Địa chỉ điểm đến tối đa 255 ký tự")
        String destinationAddress,

        @DecimalMin(value = "-90", message = "Vĩ độ không hợp lệ")
        @DecimalMax(value = "90", message = "Vĩ độ không hợp lệ")
        Double latitude,

        @DecimalMin(value = "-180", message = "Kinh độ không hợp lệ")
        @DecimalMax(value = "180", message = "Kinh độ không hợp lệ")
        Double longitude,

        @NotNull(message = "Vui lòng chọn ngày đi")
        LocalDate startDate,

        @NotNull(message = "Vui lòng chọn ngày về")
        LocalDate endDate,

        @PositiveOrZero(message = "Ngân sách không được âm")
        BigDecimal budget,

        @Size(max = 1000, message = "Mô tả tối đa 1000 ký tự")
        String description,

        Boolean isPublic
) {
}
