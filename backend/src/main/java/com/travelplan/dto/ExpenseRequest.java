package com.travelplan.dto;

import com.travelplan.entity.ExpenseCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseRequest(
        @NotNull(message = "Vui lòng chọn loại chi phí")
        ExpenseCategory category,

        @NotBlank(message = "Vui lòng nhập nội dung chi phí")
        @Size(max = 200, message = "Nội dung tối đa 200 ký tự")
        String description,

        @NotNull(message = "Vui lòng nhập số tiền")
        @Positive(message = "Số tiền phải lớn hơn 0")
        BigDecimal amount,

        LocalDate expenseDate
) {
}
