package com.travelplan.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Điểm đến được lên kèo nhiều nhất. Chỉ trả về số lượng, không lộ chuyến đi của ai.
 * basis = "weekend" nếu đếm theo cuối tuần tới, "upcoming" nếu cuối tuần chưa có ai đi
 * và phải đếm các chuyến trong 30 ngày tới.
 */
public record TrendingDestinationResponse(
        LocalDate from,
        LocalDate to,
        String basis,
        List<Item> items
) {
    public record Item(String destination, String address, long tripCount) {
    }
}
