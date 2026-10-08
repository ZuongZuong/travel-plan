package com.travelplan.security;

/** Thông tin người dùng đang đăng nhập, lấy từ JWT. */
public record AuthUser(Long id, String email) {
}
