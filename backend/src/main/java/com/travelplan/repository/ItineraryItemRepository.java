package com.travelplan.repository;

import com.travelplan.entity.ItineraryItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ItineraryItemRepository extends JpaRepository<ItineraryItem, Long> {

    List<ItineraryItem> findByTripIdOrderByDayDateAscStartTimeAsc(Long tripId);

    Optional<ItineraryItem> findByIdAndTripId(Long id, Long tripId);
}
