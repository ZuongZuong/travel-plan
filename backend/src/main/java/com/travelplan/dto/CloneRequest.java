package com.travelplan.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/** "Dùng lại" lịch trình của người khác: chỉ cần chọn ngày bắt đầu. */
public record CloneRequest(
        @NotNull(message = "Vui lòng chọn ngày đi")
        LocalDate startDate
) {
}
