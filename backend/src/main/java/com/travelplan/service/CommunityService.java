package com.travelplan.service;

import com.travelplan.dto.PublicTripResponse;
import com.travelplan.dto.TrendingDestinationResponse;
import com.travelplan.entity.ItineraryItem;
import com.travelplan.entity.Trip;
import com.travelplan.repository.TripRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

/** Dữ liệu cộng đồng cho trang chủ (không cần đăng nhập). */
@Service
public class CommunityService {

    private static final int MAX_DESTINATIONS = 6;

    private final TripRepository tripRepository;

    public CommunityService(TripRepository tripRepository) {
        this.tripRepository = tripRepository;
    }

    /**
     * Đếm số chuyến đi theo điểm đến cho cuối tuần tới (T7 + CN).
     * Nếu cuối tuần chưa có ai đi thì đếm các chuyến trong 30 ngày tới.
     */
    @Transactional(readOnly = true)
    public TrendingDestinationResponse trending(LocalDate today) {
        LocalDate saturday = today.getDayOfWeek() == DayOfWeek.SUNDAY
                ? today.minusDays(1)
                : today.plusDays(DayOfWeek.SATURDAY.getValue() - today.getDayOfWeek().getValue());
        LocalDate sunday = saturday.plusDays(1);
        List<TrendingDestinationResponse.Item> items = rank(tripRepository.findOverlapping(saturday, sunday));
        if (!items.isEmpty()) {
            return new TrendingDestinationResponse(saturday, sunday, "weekend", items);
        }
        LocalDate to = today.plusDays(30);
        return new TrendingDestinationResponse(today, to, "upcoming", rank(tripRepository.findOverlapping(today, to)));
    }

    /** Lịch trình công khai mới nhất, kèm số người đã "Dùng lại". */
    @Transactional(readOnly = true)
    public List<PublicTripResponse> publicItineraries(int limit) {
        List<Trip> trips = tripRepository.findPublicWithItinerary(PageRequest.of(0, Math.max(1, Math.min(limit, 12))));
        Map<Long, Long> reuse = new HashMap<>();
        if (!trips.isEmpty()) {
            for (Object[] row : tripRepository.countClones(trips.stream().map(Trip::getId).toList())) {
                reuse.put((Long) row[0], (Long) row[1]);
            }
        }
        return trips.stream().map(t -> new PublicTripResponse(
                t.getId(),
                t.getName(),
                t.getDestination(),
                shortName(t.getUser().getFullName()),
                t.getStartDate(),
                t.getEndDate(),
                ChronoUnit.DAYS.between(t.getStartDate(), t.getEndDate()) + 1,
                t.getBudget(),
                t.getItineraryItems().size(),
                reuse.getOrDefault(t.getId(), 0L),
                highlights(t)
        )).toList();
    }

    private static List<TrendingDestinationResponse.Item> rank(List<Trip> trips) {
        // Gom theo tên điểm đến, không phân biệt hoa thường và khoảng trắng thừa
        Map<String, List<Trip>> groups = trips.stream().collect(Collectors.groupingBy(
                t -> t.getDestination().trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT),
                LinkedHashMap::new, Collectors.toList()));
        return groups.values().stream()
                .map(list -> {
                    String name = mostCommon(list.stream().map(t -> t.getDestination().trim()).toList());
                    String address = list.stream().map(Trip::getDestinationAddress)
                            .filter(a -> a != null && !a.isBlank()).findFirst().orElse(null);
                    return new TrendingDestinationResponse.Item(name, address, list.size());
                })
                .sorted(Comparator.comparingLong(TrendingDestinationResponse.Item::tripCount).reversed()
                        .thenComparing(TrendingDestinationResponse.Item::destination))
                .limit(MAX_DESTINATIONS)
                .toList();
    }

    private static String mostCommon(List<String> names) {
        return names.stream().collect(Collectors.groupingBy(n -> n, Collectors.counting()))
                .entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse(names.get(0));
    }

    /** Tối đa 3 ngày đầu, mỗi ngày ghép tên 2 hoạt động đầu tiên. */
    private static List<PublicTripResponse.DayHighlight> highlights(Trip t) {
        TreeMap<LocalDate, List<ItineraryItem>> byDay = t.getItineraryItems().stream()
                .filter(i -> !i.getDayDate().isBefore(t.getStartDate()) && !i.getDayDate().isAfter(t.getEndDate()))
                .collect(Collectors.groupingBy(ItineraryItem::getDayDate, TreeMap::new, Collectors.toList()));
        List<PublicTripResponse.DayHighlight> out = new ArrayList<>();
        for (var e : byDay.entrySet()) {
            if (out.size() == 3) {
                break;
            }
            String text = e.getValue().stream()
                    .sorted(Comparator.comparing(ItineraryItem::getStartTime, Comparator.nullsLast(Comparator.naturalOrder())))
                    .limit(2).map(ItineraryItem::getActivity).collect(Collectors.joining(", "));
            int day = (int) ChronoUnit.DAYS.between(t.getStartDate(), e.getKey()) + 1;
            out.add(new PublicTripResponse.DayHighlight(day, text));
        }
        return out;
    }

    /** Chỉ hiện tên gọi (2 chữ cuối), ví dụ "Nguyễn Minh Anh" thành "Minh Anh". */
    private static String shortName(String fullName) {
        String[] parts = fullName.trim().split("\\s+");
        return parts.length <= 2 ? fullName.trim() : parts[parts.length - 2] + " " + parts[parts.length - 1];
    }
}
