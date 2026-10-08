package com.travelplan.dto;

import com.travelplan.entity.User;

public record UserResponse(Long id, String fullName, String email) {

    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getFullName(), user.getEmail());
    }
}
