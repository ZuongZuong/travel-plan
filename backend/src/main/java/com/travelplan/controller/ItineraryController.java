package com.travelplan.controller;

import com.travelplan.dto.ItineraryItemRequest;
import com.travelplan.dto.ItineraryItemResponse;
import com.travelplan.security.AuthUser;
import com.travelplan.service.ItineraryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/trips/{tripId}/itinerary")
public class ItineraryController {

    private final ItineraryService itineraryService;

    public ItineraryController(ItineraryService itineraryService) {
        this.itineraryService = itineraryService;
    }

    @GetMapping
    public List<ItineraryItemResponse> list(@AuthenticationPrincipal AuthUser user, @PathVariable Long tripId) {
        return itineraryService.list(user.id(), tripId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ItineraryItemResponse create(@AuthenticationPrincipal AuthUser user, @PathVariable Long tripId,
                                        @Valid @RequestBody ItineraryItemRequest req) {
        return itineraryService.create(user.id(), tripId, req);
    }

    @PutMapping("/{itemId}")
    public ItineraryItemResponse update(@AuthenticationPrincipal AuthUser user, @PathVariable Long tripId,
                                        @PathVariable Long itemId, @Valid @RequestBody ItineraryItemRequest req) {
        return itineraryService.update(user.id(), tripId, itemId, req);
    }

    @DeleteMapping("/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser user, @PathVariable Long tripId, @PathVariable Long itemId) {
        itineraryService.delete(user.id(), tripId, itemId);
    }
}
