package com.travelplan.controller;

import com.travelplan.dto.BudgetSummaryResponse;
import com.travelplan.dto.CloneRequest;
import com.travelplan.dto.CoverRequest;
import com.travelplan.dto.TripRequest;
import com.travelplan.dto.TripResponse;
import com.travelplan.security.AuthUser;
import com.travelplan.service.TripService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;

@RestController
@RequestMapping("/api/trips")
public class TripController {

    private final TripService tripService;

    public TripController(TripService tripService) {
        this.tripService = tripService;
    }

    @GetMapping
    public List<TripResponse> list(@AuthenticationPrincipal AuthUser user) {
        return tripService.list(user.id());
    }

    @GetMapping("/{tripId}")
    public TripResponse get(@AuthenticationPrincipal AuthUser user, @PathVariable Long tripId) {
        return tripService.get(user.id(), tripId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TripResponse create(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody TripRequest req) {
        return tripService.create(user.id(), req);
    }

    @PutMapping("/{tripId}")
    public TripResponse update(@AuthenticationPrincipal AuthUser user, @PathVariable Long tripId,
                               @Valid @RequestBody TripRequest req) {
        return tripService.update(user.id(), tripId, req);
    }

    @DeleteMapping("/{tripId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser user, @PathVariable Long tripId) {
        tripService.delete(user.id(), tripId);
    }

    @PutMapping("/{tripId}/cover")
    public TripResponse updateCover(@AuthenticationPrincipal AuthUser user, @PathVariable Long tripId,
                                    @Valid @RequestBody CoverRequest req) {
        return tripService.updateCover(user.id(), tripId, req);
    }

    @PostMapping(value = "/{tripId}/cover/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TripResponse uploadCover(@AuthenticationPrincipal AuthUser user, @PathVariable Long tripId,
                                    @RequestParam("file") MultipartFile file) {
        String baseUrl = ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
        return tripService.uploadCover(user.id(), tripId, file, baseUrl);
    }

    @PostMapping("/{tripId}/clone")
    @ResponseStatus(HttpStatus.CREATED)
    public TripResponse cloneTrip(@AuthenticationPrincipal AuthUser user, @PathVariable Long tripId,
                                  @Valid @RequestBody CloneRequest req) {
        return tripService.cloneTrip(user.id(), tripId, req);
    }

    @GetMapping("/{tripId}/budget")
    public BudgetSummaryResponse budget(@AuthenticationPrincipal AuthUser user, @PathVariable Long tripId) {
        return tripService.budgetSummary(user.id(), tripId);
    }
}
