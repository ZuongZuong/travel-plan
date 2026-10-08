package com.travelplan.controller;

import com.travelplan.dto.ExpenseRequest;
import com.travelplan.dto.ExpenseResponse;
import com.travelplan.security.AuthUser;
import com.travelplan.service.ExpenseService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/trips/{tripId}/expenses")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    @GetMapping
    public List<ExpenseResponse> list(@AuthenticationPrincipal AuthUser user, @PathVariable Long tripId) {
        return expenseService.list(user.id(), tripId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExpenseResponse create(@AuthenticationPrincipal AuthUser user, @PathVariable Long tripId,
                                  @Valid @RequestBody ExpenseRequest req) {
        return expenseService.create(user.id(), tripId, req);
    }

    @PutMapping("/{expenseId}")
    public ExpenseResponse update(@AuthenticationPrincipal AuthUser user, @PathVariable Long tripId,
                                  @PathVariable Long expenseId, @Valid @RequestBody ExpenseRequest req) {
        return expenseService.update(user.id(), tripId, expenseId, req);
    }

    @DeleteMapping("/{expenseId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser user, @PathVariable Long tripId, @PathVariable Long expenseId) {
        expenseService.delete(user.id(), tripId, expenseId);
    }
}
