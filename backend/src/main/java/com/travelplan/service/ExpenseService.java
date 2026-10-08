package com.travelplan.service;

import com.travelplan.dto.ExpenseRequest;
import com.travelplan.dto.ExpenseResponse;
import com.travelplan.entity.Expense;
import com.travelplan.entity.Trip;
import com.travelplan.exception.NotFoundException;
import com.travelplan.repository.ExpenseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final TripService tripService;

    public ExpenseService(ExpenseRepository expenseRepository, TripService tripService) {
        this.expenseRepository = expenseRepository;
        this.tripService = tripService;
    }

    @Transactional(readOnly = true)
    public List<ExpenseResponse> list(Long userId, Long tripId) {
        tripService.getOwnedTrip(userId, tripId);
        return expenseRepository.findByTripIdOrderByExpenseDateAscIdAsc(tripId).stream()
                .map(ExpenseResponse::from)
                .toList();
    }

    @Transactional
    public ExpenseResponse create(Long userId, Long tripId, ExpenseRequest req) {
        Trip trip = tripService.getOwnedTrip(userId, tripId);
        Expense expense = new Expense();
        expense.setTrip(trip);
        apply(expense, req);
        return ExpenseResponse.from(expenseRepository.save(expense));
    }

    @Transactional
    public ExpenseResponse update(Long userId, Long tripId, Long expenseId, ExpenseRequest req) {
        tripService.getOwnedTrip(userId, tripId);
        Expense expense = getExpense(tripId, expenseId);
        apply(expense, req);
        return ExpenseResponse.from(expense);
    }

    @Transactional
    public void delete(Long userId, Long tripId, Long expenseId) {
        tripService.getOwnedTrip(userId, tripId);
        expenseRepository.delete(getExpense(tripId, expenseId));
    }

    private Expense getExpense(Long tripId, Long expenseId) {
        return expenseRepository.findByIdAndTripId(expenseId, tripId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy khoản chi"));
    }

    private static void apply(Expense expense, ExpenseRequest req) {
        expense.setCategory(req.category());
        expense.setDescription(req.description().trim());
        expense.setAmount(req.amount());
        expense.setExpenseDate(req.expenseDate());
    }
}
