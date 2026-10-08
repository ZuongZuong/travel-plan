package com.travelplan.dto;

import java.math.BigDecimal;
import java.util.Map;

public record BudgetSummaryResponse(
        BigDecimal budget,
        BigDecimal totalSpent,
        BigDecimal remaining,
        Map<String, BigDecimal> byCategory
) {
}
