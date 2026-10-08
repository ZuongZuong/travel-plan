package com.travelplan.controller;

import com.travelplan.dto.PublicTripResponse;
import com.travelplan.dto.TrendingDestinationResponse;
import com.travelplan.service.CommunityService;
import com.travelplan.service.CoverStorage;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.TimeUnit;

/** API không cần đăng nhập: dữ liệu cộng đồng cho trang chủ và ảnh bìa. */
@RestController
@RequestMapping("/api/public")
public class PublicController {

    private final CommunityService communityService;
    private final CoverStorage coverStorage;

    public PublicController(CommunityService communityService, CoverStorage coverStorage) {
        this.communityService = communityService;
        this.coverStorage = coverStorage;
    }

    @GetMapping("/trending-destinations")
    public TrendingDestinationResponse trending() {
        return communityService.trending(LocalDate.now());
    }

    @GetMapping("/itineraries")
    public List<PublicTripResponse> itineraries(@RequestParam(defaultValue = "6") int limit) {
        return communityService.publicItineraries(limit);
    }

    @GetMapping("/uploads/covers/{name}")
    public ResponseEntity<Resource> cover(@PathVariable String name) {
        Path file = coverStorage.resolve(name);
        MediaType type = name.endsWith(".png") ? MediaType.IMAGE_PNG
                : name.endsWith(".webp") ? MediaType.parseMediaType("image/webp") : MediaType.IMAGE_JPEG;
        return ResponseEntity.ok()
                .contentType(type)
                .cacheControl(CacheControl.maxAge(30, TimeUnit.DAYS))
                .body(new FileSystemResource(file));
    }
}
