package com.travelplan;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

// Đăng nhập bằng JWT tự viết nên tắt user mặc định của Spring Security
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class TravelPlanApplication {

    public static void main(String[] args) {
        SpringApplication.run(TravelPlanApplication.class, args);
    }
}
