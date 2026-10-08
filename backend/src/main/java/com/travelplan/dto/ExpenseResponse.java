package com.travelplan.dto;

import com.travelplan.entity.Expense;
import com.travelplan.entity.ExpenseCategory;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseResponse(
        Long id,
        ExpenseCategory category,
        String description,
        BigDecimal amount,
        LocalDate expenseDate
) {

    public static ExpenseResponse from(Expense expense) {
        return new ExpenseResponse(
                expense.getId(),
                expense.getCategory(),
                expense.getDescription(),
                expense.getAmount(),
                expense.getExpenseDate()
        );
    }
}
