package com.chubb.claims.user.config;

import com.chubb.claims.common.model.Market;
import com.chubb.claims.user.entity.Role;
import com.chubb.claims.user.entity.User;
import com.chubb.claims.user.repository.UserRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Creates the demo users on first start (passwords are BCrypt-hashed like any other user's). */
@Component
@ConditionalOnProperty(name = "chubb.seed-demo-users", havingValue = "true", matchIfMissing = true)
public class DemoDataSeeder implements ApplicationRunner {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public DemoDataSeeder(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (users.count() > 0) {
            return;
        }
        users.save(claimant("claimant1", "Aiko Tanaka", "aiko.tanaka@example.com", "+81-90-1234-5678", Market.JP,
                "POL-JP-0001"));
        users.save(claimant("claimant2", "Wei Lim", "wei.lim@example.com", "+65-9123-4567", Market.SG,
                "POL-SG-0002"));
        users.save(officer("officer1", "Priya Nair", "priya.nair@chubb.example.com", "HEALTH", 5));
        users.save(officer("officer2", "Daniel Chen", "daniel.chen@chubb.example.com", "MOTOR", 8));
        users.save(new User("manager1", passwordEncoder.encode("manager123"), Role.MANAGER, "Maria Santos",
                "maria.santos@chubb.example.com", null, true));
        // Appended after the original five so their ids (1-5) stay put. claim-service's DemoClaimSeeder relies on
        // these ids: claimant3 = 6 (HK), claimant4 = 7 (TH), claimant5 = 8 (IN), claimant6 = 9 (ID).
        users.save(claimant("claimant3", "Mei Chen", "mei.chen@example.com", "+852-9123-4567", Market.HK,
                "POL-HK-0003"));
        users.save(claimant("claimant4", "Somchai Prasert", "somchai.prasert@example.com", "+66-81-234-5678",
                Market.TH, "POL-TH-0004"));
        users.save(claimant("claimant5", "Arjun Mehta", "arjun.mehta@example.com", "+91-98765-43210", Market.IN,
                "POL-IN-0005"));
        users.save(claimant("claimant6", "Budi Santoso", "budi.santoso@example.com", "+62-812-3456-7890", Market.ID,
                "POL-ID-0006"));
    }

    private User claimant(String username, String fullName, String email, String phone, Market market,
                          String policyNumber) {
        User user = new User(username, passwordEncoder.encode("claimant123"), Role.CLAIMANT, fullName, email, phone,
                true);
        user.setClaimantDetails(market, policyNumber);
        return user;
    }

    private User officer(String username, String fullName, String email, String specialization, int maxCapacity) {
        User user = new User(username, passwordEncoder.encode("officer123"), Role.OFFICER, fullName, email, null, true);
        user.setOfficerDetails(specialization, maxCapacity);
        return user;
    }
}
