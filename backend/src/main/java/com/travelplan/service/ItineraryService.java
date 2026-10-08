package com.travelplan.service;

import com.travelplan.dto.ItineraryItemRequest;
import com.travelplan.dto.ItineraryItemResponse;
import com.travelplan.entity.ItineraryItem;
import com.travelplan.entity.Trip;
import com.travelplan.exception.BadRequestException;
import com.travelplan.exception.NotFoundException;
import com.travelplan.repository.ItineraryItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ItineraryService {

    private final ItineraryItemRepository itemRepository;
    private final TripService tripService;

    public ItineraryService(ItineraryItemRepository itemRepository, TripService tripService) {
        this.itemRepository = itemRepository;
        this.tripService = tripService;
    }

    @Transactional(readOnly = true)
    public List<ItineraryItemResponse> list(Long userId, Long tripId) {
        tripService.getOwnedTrip(userId, tripId);
        return itemRepository.findByTripIdOrderByDayDateAscStartTimeAsc(tripId).stream()
                .map(ItineraryItemResponse::from)
                .toList();
    }

    @Transactional
    public ItineraryItemResponse create(Long userId, Long tripId, ItineraryItemRequest req) {
        Trip trip = tripService.getOwnedTrip(userId, tripId);
        ItineraryItem item = new ItineraryItem();
        item.setTrip(trip);
        apply(trip, item, req);
        return ItineraryItemResponse.from(itemRepository.save(item));
    }

    @Transactional
    public ItineraryItemResponse update(Long userId, Long tripId, Long itemId, ItineraryItemRequest req) {
        Trip trip = tripService.getOwnedTrip(userId, tripId);
        ItineraryItem item = getItem(tripId, itemId);
        apply(trip, item, req);
        return ItineraryItemResponse.from(item);
    }

    @Transactional
    public void delete(Long userId, Long tripId, Long itemId) {
        tripService.getOwnedTrip(userId, tripId);
        itemRepository.delete(getItem(tripId, itemId));
    }

    private ItineraryItem getItem(Long tripId, Long itemId) {
        return itemRepository.findByIdAndTripId(itemId, tripId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hoạt động trong lịch trình"));
    }

    private static void apply(Trip trip, ItineraryItem item, ItineraryItemRequest req) {
        if (req.dayDate().isBefore(trip.getStartDate()) || req.dayDate().isAfter(trip.getEndDate())) {
            throw new BadRequestException("Ngày của hoạt động phải nằm trong thời gian chuyến đi");
        }
        if (req.startTime() != null && req.endTime() != null && !req.endTime().isAfter(req.startTime())) {
            throw new BadRequestException("Giờ kết thúc phải sau giờ bắt đầu");
        }
        item.setDayDate(req.dayDate());
        item.setStartTime(req.startTime());
        item.setEndTime(req.endTime());
        item.setActivity(req.activity().trim());
        item.setLocation(TripService.blankToNull(req.location()));
        item.setNote(TripService.blankToNull(req.note()));
    }
}
