package com.travelplan.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.travelplan.entity.ItineraryItem;

import java.time.LocalDate;
import java.time.LocalTime;

public record ItineraryItemResponse(
        Long id,
        LocalDate dayDate,
        @JsonFormat(pattern = "HH:mm") LocalTime startTime,
        @JsonFormat(pattern = "HH:mm") LocalTime endTime,
        String activity,
        String location,
        String note
) {

    public static ItineraryItemResponse from(ItineraryItem item) {
        return new ItineraryItemResponse(
                item.getId(),
                item.getDayDate(),
                item.getStartTime(),
                item.getEndTime(),
                item.getActivity(),
                item.getLocation(),
                item.getNote()
        );
    }
}
