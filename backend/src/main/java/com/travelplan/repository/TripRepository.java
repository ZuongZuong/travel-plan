package com.travelplan.repository;

import com.travelplan.entity.Trip;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TripRepository extends JpaRepository<Trip, Long> {

    List<Trip> findByUserIdOrderByStartDateDesc(Long userId);

    Optional<Trip> findByIdAndUserId(Long id, Long userId);

    /** Các chuyến đi (của mọi người) có ít nhất một ngày nằm trong khoảng [from, to]. */
    @Query("select t from Trip t where t.startDate <= :to and t.endDate >= :from")
    List<Trip> findOverlapping(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("select t from Trip t join fetch t.user where t.publicTrip = true and size(t.itineraryItems) > 0 order by t.createdAt desc")
    List<Trip> findPublicWithItinerary(Pageable pageable);

    @Query("select t.clonedFromId, count(t) from Trip t where t.clonedFromId in :ids group by t.clonedFromId")
    List<Object[]> countClones(@Param("ids") Collection<Long> ids);
}
