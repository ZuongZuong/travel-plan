package com.travelplan.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "trips")
public class Trip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 150)
    private String destination;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    /** Ngân sách dự kiến (VND) */
    @Column(precision = 15, scale = 0)
    private BigDecimal budget;

    @Column(length = 1000)
    private String description;

    @Column(name = "cover_image_url", length = 500)
    private String coverImageUrl;

    /** Màu nền thẻ chuyến đi khi không có ảnh bìa, dạng #RRGGBB */
    @Column(name = "cover_color", length = 7)
    private String coverColor;

    /** Địa chỉ đầy đủ của điểm đến (lấy từ gợi ý bản đồ) */
    @Column(name = "destination_address", length = 255)
    private String destinationAddress;

    private Double latitude;

    private Double longitude;

    /** Bật thì lịch trình hiện ở mục cộng đồng trên trang chủ */
    @Column(name = "is_public")
    private Boolean publicTrip;

    /** Chuyến đi gốc nếu chuyến này được tạo bằng "Dùng lại" */
    @Column(name = "cloned_from_id")
    private Long clonedFromId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "trip", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ItineraryItem> itineraryItems = new ArrayList<>();

    @OneToMany(mappedBy = "trip", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Expense> expenses = new ArrayList<>();

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public BigDecimal getBudget() { return budget; }
    public void setBudget(BigDecimal budget) { this.budget = budget; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCoverImageUrl() { return coverImageUrl; }
    public void setCoverImageUrl(String coverImageUrl) { this.coverImageUrl = coverImageUrl; }
    public String getCoverColor() { return coverColor; }
    public void setCoverColor(String coverColor) { this.coverColor = coverColor; }
    public String getDestinationAddress() { return destinationAddress; }
    public void setDestinationAddress(String destinationAddress) { this.destinationAddress = destinationAddress; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public boolean isPublicTrip() { return Boolean.TRUE.equals(publicTrip); }
    public void setPublicTrip(boolean publicTrip) { this.publicTrip = publicTrip; }
    public Long getClonedFromId() { return clonedFromId; }
    public void setClonedFromId(Long clonedFromId) { this.clonedFromId = clonedFromId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public List<ItineraryItem> getItineraryItems() { return itineraryItems; }
    public List<Expense> getExpenses() { return expenses; }
}
