package com.travelplan.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Lịch trình được chủ nhân chia sẻ công khai, hiển thị ở trang chủ. */
public record PublicTripResponse(
        Long id,
        String name,
        String destination,
        String authorName,
        LocalDate startDate,
        LocalDate endDate,
        long days,
        BigDecimal budget,
        int itineraryCount,
        long reuseCount,
        List<DayHighlight> highlights
) {
    public record DayHighlight(int day, String text) {
    }
}
