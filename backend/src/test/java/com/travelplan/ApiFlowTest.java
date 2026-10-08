package com.travelplan;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Kiểm tra các API mới: ảnh bìa, chia sẻ công khai, dùng lại lịch trình, quy tắc giờ. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiFlowTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private String register(String name) throws Exception {
        String email = UUID.randomUUID() + "@test.vn";
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"" + name + "\",\"email\":\"" + email + "\",\"password\":\"123456\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(body).get("token").asText();
    }

    private JsonNode createTrip(String token, String dest, LocalDate start, LocalDate end, boolean isPublic) throws Exception {
        String req = """
                {"name":"Đi %s","destination":"%s","destinationAddress":"Việt Nam","latitude":11.94,"longitude":108.45,
                 "startDate":"%s","endDate":"%s","budget":6000000,"isPublic":%s}
                """.formatted(dest, dest, start, end, isPublic);
        String body = mvc.perform(post("/api/trips").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content(req))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body);
    }

    private void addItem(String token, long tripId, LocalDate day, String start, String end, String activity) throws Exception {
        mvc.perform(post("/api/trips/" + tripId + "/itinerary").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dayDate\":\"" + day + "\",\"startTime\":\"" + start + "\",\"endTime\":\"" + end
                                + "\",\"activity\":\"" + activity + "\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void tripStoresPlaceAndPublicFlag() throws Exception {
        String token = register("Nguyễn Minh Anh");
        LocalDate start = LocalDate.now().plusDays(10);
        JsonNode trip = createTrip(token, "Đà Lạt", start, start.plusDays(2), true);
        mvc.perform(get("/api/trips/" + trip.get("id").asLong()).header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.latitude").value(11.94))
                .andExpect(jsonPath("$.destinationAddress").value("Việt Nam"))
                .andExpect(jsonPath("$.isPublic").value(true))
                .andExpect(jsonPath("$.days").value(3))
                .andExpect(jsonPath("$.expenseCount").value(0));
    }

    @Test
    void endTimeMustBeAfterStartTime() throws Exception {
        String token = register("Test Giờ");
        LocalDate start = LocalDate.now().plusDays(3);
        long id = createTrip(token, "Huế", start, start, false).get("id").asLong();
        mvc.perform(post("/api/trips/" + id + "/itinerary").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dayDate\":\"" + start + "\",\"startTime\":\"14:00\",\"endTime\":\"14:00\",\"activity\":\"A\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Giờ kết thúc phải sau giờ bắt đầu"));
    }

    @Test
    void coverColorUrlAndUpload() throws Exception {
        String token = register("Test Bìa");
        LocalDate start = LocalDate.now().plusDays(3);
        long id = createTrip(token, "Sa Pa", start, start, false).get("id").asLong();

        mvc.perform(put("/api/trips/" + id + "/cover").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"coverColor\":\"#CFF54A\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.coverColor").value("#CFF54A"));

        mvc.perform(put("/api/trips/" + id + "/cover").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"coverImageUrl\":\"javascript:alert(1)\"}"))
                .andExpect(status().isBadRequest());

        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
        String body = mvc.perform(multipart("/api/trips/" + id + "/cover/upload")
                        .file(new MockMultipartFile("file", "a.png", "image/png", png))
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.coverImageUrl", containsString("/api/public/uploads/covers/")))
                .andReturn().getResponse().getContentAsString();
        String url = json.readTree(body).get("coverImageUrl").asText();
        mvc.perform(get(url.substring(url.indexOf("/api/public"))))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"));

        mvc.perform(multipart("/api/trips/" + id + "/cover/upload")
                        .file(new MockMultipartFile("file", "a.png", "image/png", "not an image".getBytes()))
                        .header("Authorization", token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Chỉ nhận ảnh JPG, PNG hoặc WEBP"));
    }

    @Test
    void communityTrendingPublicListAndClone() throws Exception {
        String owner = register("Trần Thu Trang");
        LocalDate saturday = LocalDate.now().getDayOfWeek() == DayOfWeek.SUNDAY
                ? LocalDate.now().minusDays(1)
                : LocalDate.now().with(TemporalAdjusters.nextOrSame(DayOfWeek.SATURDAY));
        JsonNode pub = createTrip(owner, "Quy Nhơn", saturday, saturday.plusDays(1), true);
        long pubId = pub.get("id").asLong();
        addItem(owner, pubId, saturday, "08:00", "10:00", "Kỳ Co");
        addItem(owner, pubId, saturday.plusDays(1), "09:00", "11:00", "Ghềnh Ráng");
        createTrip(owner, "quy nhơn ", saturday, saturday, false);
        JsonNode priv = createTrip(owner, "Hội An", saturday, saturday, false);

        mvc.perform(get("/api/public/trending-destinations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.basis").value("weekend"))
                .andExpect(jsonPath("$.items[?(@.destination == 'Quy Nhơn')].tripCount", hasItem(greaterThanOrEqualTo(2))));

        mvc.perform(get("/api/public/itineraries"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + pubId + ")].authorName", hasItem("Thu Trang")))
                .andExpect(jsonPath("$[?(@.id == " + priv.get("id").asLong() + ")]", empty()));

        String other = register("Lê Văn Long");
        LocalDate newStart = saturday.plusDays(14);
        String body = mvc.perform(post("/api/trips/" + pubId + "/clone").header("Authorization", other)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"startDate\":\"" + newStart + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.startDate").value(newStart.toString()))
                .andExpect(jsonPath("$.endDate").value(newStart.plusDays(1).toString()))
                .andExpect(jsonPath("$.itineraryCount").value(2))
                .andExpect(jsonPath("$.isPublic").value(false))
                .andReturn().getResponse().getContentAsString();
        long cloneId = json.readTree(body).get("id").asLong();
        mvc.perform(get("/api/trips/" + cloneId + "/itinerary").header("Authorization", other))
                .andExpect(jsonPath("$[0].dayDate").value(newStart.toString()))
                .andExpect(jsonPath("$[1].activity").value("Ghềnh Ráng"));

        mvc.perform(get("/api/public/itineraries"))
                .andExpect(jsonPath("$[?(@.id == " + pubId + ")].reuseCount", hasItem(1)));

        // Chuyến riêng tư thì người khác không dùng lại được
        mvc.perform(post("/api/trips/" + priv.get("id").asLong() + "/clone").header("Authorization", other)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"startDate\":\"" + newStart + "\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void publicEndpointsNeedNoLoginButTripsDo() throws Exception {
        mvc.perform(get("/api/public/itineraries")).andExpect(status().isOk());
        mvc.perform(get("/api/trips")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/trips/1/clone").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }
}
