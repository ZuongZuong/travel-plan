package com.travelplan.repository;

import com.travelplan.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    List<Expense> findByTripIdOrderByExpenseDateAscIdAsc(Long tripId);

    Optional<Expense> findByIdAndTripId(Long id, Long tripId);

    @Query("select coalesce(sum(e.amount), 0) from Expense e where e.trip.id = :tripId")
    BigDecimal sumAmountByTripId(@Param("tripId") Long tripId);
}
