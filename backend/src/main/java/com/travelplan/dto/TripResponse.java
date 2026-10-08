package com.travelplan.dto;

import com.travelplan.entity.Expense;
import com.travelplan.entity.Trip;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public record TripResponse(
        Long id,
        String name,
        String destination,
        String destinationAddress,
        Double latitude,
        Double longitude,
        LocalDate startDate,
        LocalDate endDate,
        long days,
        BigDecimal budget,
        BigDecimal totalSpent,
        int itineraryCount,
        int expenseCount,
        String description,
        String coverImageUrl,
        String coverColor,
        boolean isPublic
) {

    public static TripResponse from(Trip trip) {
        BigDecimal spent = trip.getExpenses().stream()
                .map(Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long days = ChronoUnit.DAYS.between(trip.getStartDate(), trip.getEndDate()) + 1;
        return new TripResponse(
                trip.getId(),
                trip.getName(),
                trip.getDestination(),
                trip.getDestinationAddress(),
                trip.getLatitude(),
                trip.getLongitude(),
                trip.getStartDate(),
                trip.getEndDate(),
                days,
                trip.getBudget(),
                spent,
                trip.getItineraryItems().size(),
                trip.getExpenses().size(),
                trip.getDescription(),
                trip.getCoverImageUrl(),
                trip.getCoverColor(),
                trip.isPublicTrip()
        );
    }
}
