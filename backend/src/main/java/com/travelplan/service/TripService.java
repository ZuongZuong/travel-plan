package com.travelplan.service;

import com.travelplan.dto.BudgetSummaryResponse;
import com.travelplan.dto.CloneRequest;
import com.travelplan.dto.CoverRequest;
import com.travelplan.dto.TripRequest;
import com.travelplan.dto.TripResponse;
import com.travelplan.entity.Expense;
import com.travelplan.entity.ItineraryItem;
import com.travelplan.entity.Trip;
import com.travelplan.entity.User;
import com.travelplan.exception.BadRequestException;
import com.travelplan.exception.NotFoundException;
import com.travelplan.repository.TripRepository;
import com.travelplan.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class TripService {

    private final TripRepository tripRepository;
    private final UserRepository userRepository;

    private final CoverStorage coverStorage;

    public TripService(TripRepository tripRepository, UserRepository userRepository, CoverStorage coverStorage) {
        this.tripRepository = tripRepository;
        this.userRepository = userRepository;
        this.coverStorage = coverStorage;
    }

    @Transactional(readOnly = true)
    public List<TripResponse> list(Long userId) {
        return tripRepository.findByUserIdOrderByStartDateDesc(userId).stream()
                .map(TripResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public TripResponse get(Long userId, Long tripId) {
        return TripResponse.from(getOwnedTrip(userId, tripId));
    }

    @Transactional
    public TripResponse create(Long userId, TripRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));
        Trip trip = new Trip();
        trip.setUser(user);
        apply(trip, req);
        return TripResponse.from(tripRepository.save(trip));
    }

    @Transactional
    public TripResponse update(Long userId, Long tripId, TripRequest req) {
        Trip trip = getOwnedTrip(userId, tripId);
        apply(trip, req);
        return TripResponse.from(trip);
    }

    @Transactional
    public void delete(Long userId, Long tripId) {
        Trip trip = getOwnedTrip(userId, tripId);
        String cover = trip.getCoverImageUrl();
        tripRepository.delete(trip);
        if (cover != null) {
            coverStorage.deleteIfOwned(cover);
        }
    }

    @Transactional(readOnly = true)
    public BudgetSummaryResponse budgetSummary(Long userId, Long tripId) {
        Trip trip = getOwnedTrip(userId, tripId);
        Map<String, BigDecimal> byCategory = new LinkedHashMap<>();
        BigDecimal total = BigDecimal.ZERO;
        for (Expense e : trip.getExpenses()) {
            byCategory.merge(e.getCategory().name(), e.getAmount(), BigDecimal::add);
            total = total.add(e.getAmount());
        }
        BigDecimal budget = trip.getBudget() == null ? BigDecimal.ZERO : trip.getBudget();
        return new BudgetSummaryResponse(budget, total, budget.subtract(total), byCategory);
    }

    /** Lấy chuyến đi và đảm bảo nó thuộc về người dùng hiện tại. */
    @Transactional(readOnly = true)
    public Trip getOwnedTrip(Long userId, Long tripId) {
        return tripRepository.findByIdAndUserId(tripId, userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy chuyến đi"));
    }

    @Transactional
    public TripResponse updateCover(Long userId, Long tripId, CoverRequest req) {
        Trip trip = getOwnedTrip(userId, tripId);
        String oldUrl = trip.getCoverImageUrl();
        trip.setCoverImageUrl(blankToNull(req.coverImageUrl()));
        trip.setCoverColor(blankToNull(req.coverColor()));
        if (oldUrl != null && !oldUrl.equals(trip.getCoverImageUrl())) {
            coverStorage.deleteIfOwned(oldUrl);
        }
        return TripResponse.from(trip);
    }

    @Transactional
    public TripResponse uploadCover(Long userId, Long tripId, MultipartFile file, String baseUrl) {
        Trip trip = getOwnedTrip(userId, tripId);
        String oldUrl = trip.getCoverImageUrl();
        trip.setCoverImageUrl(coverStorage.store(file, baseUrl));
        if (oldUrl != null) {
            coverStorage.deleteIfOwned(oldUrl);
        }
        return TripResponse.from(trip);
    }

    /** "Dùng lại": chép lịch trình của một chuyến công khai (hoặc của chính mình) thành chuyến mới. */
    @Transactional
    public TripResponse cloneTrip(Long userId, Long sourceId, CloneRequest req) {
        Trip source = tripRepository.findById(sourceId)
                .filter(t -> t.isPublicTrip() || t.getUser().getId().equals(userId))
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lịch trình này hoặc chủ nhân đã tắt chia sẻ"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));

        long shift = ChronoUnit.DAYS.between(source.getStartDate(), req.startDate());
        Trip copy = new Trip();
        copy.setUser(user);
        copy.setName(source.getName());
        copy.setDestination(source.getDestination());
        copy.setDestinationAddress(source.getDestinationAddress());
        copy.setLatitude(source.getLatitude());
        copy.setLongitude(source.getLongitude());
        copy.setStartDate(req.startDate());
        copy.setEndDate(source.getEndDate().plusDays(shift));
        copy.setBudget(source.getBudget());
        copy.setDescription(source.getDescription());
        copy.setCoverColor(source.getCoverColor());
        copy.setClonedFromId(source.getId());
        for (ItineraryItem it : source.getItineraryItems()) {
            if (it.getDayDate().isBefore(source.getStartDate()) || it.getDayDate().isAfter(source.getEndDate())) {
                continue;
            }
            ItineraryItem c = new ItineraryItem();
            c.setTrip(copy);
            c.setDayDate(it.getDayDate().plusDays(shift));
            c.setStartTime(it.getStartTime());
            c.setEndTime(it.getEndTime());
            c.setActivity(it.getActivity());
            c.setLocation(it.getLocation());
            c.setNote(it.getNote());
            copy.getItineraryItems().add(c);
        }
        return TripResponse.from(tripRepository.save(copy));
    }

    private static void apply(Trip trip, TripRequest req) {
        if (req.endDate().isBefore(req.startDate())) {
            throw new BadRequestException("Ngày về phải sau hoặc bằng ngày đi");
        }
        if ((req.latitude() == null) != (req.longitude() == null)) {
            throw new BadRequestException("Tọa độ điểm đến phải có đủ vĩ độ và kinh độ");
        }
        trip.setName(req.name().trim());
        trip.setDestination(req.destination().trim());
        trip.setDestinationAddress(blankToNull(req.destinationAddress()));
        trip.setLatitude(req.latitude());
        trip.setLongitude(req.longitude());
        trip.setStartDate(req.startDate());
        trip.setEndDate(req.endDate());
        trip.setBudget(req.budget());
        trip.setDescription(blankToNull(req.description()));
        trip.setPublicTrip(Boolean.TRUE.equals(req.isPublic()));
    }

    static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
