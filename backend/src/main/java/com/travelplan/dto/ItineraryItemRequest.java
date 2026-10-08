package com.travelplan.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;

public record ItineraryItemRequest(
        @NotNull(message = "Vui lòng chọn ngày")
        LocalDate dayDate,

        LocalTime startTime,

        LocalTime endTime,

        @NotBlank(message = "Vui lòng nhập hoạt động")
        @Size(max = 200, message = "Hoạt động tối đa 200 ký tự")
        String activity,

        @Size(max = 200, message = "Địa điểm tối đa 200 ký tự")
        String location,

        @Size(max = 1000, message = "Ghi chú tối đa 1000 ký tự")
        String note
) {
}
