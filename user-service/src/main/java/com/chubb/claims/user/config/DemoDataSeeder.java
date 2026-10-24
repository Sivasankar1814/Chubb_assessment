package com.chubb.claims.user.config;

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
        users.save(claimant("claimant1", "Aiko Tanaka", "aiko.tanaka@example.com", "+81-90-1234-5678", "Japan",
                "POL-JP-0001"));
        users.save(claimant("claimant2", "Wei Lim", "wei.lim@example.com", "+65-9123-4567", "Singapore",
                "POL-SG-0002"));
        users.save(officer("officer1", "Priya Nair", "priya.nair@chubb.example.com", "HEALTH", 5));
        users.save(officer("officer2", "Daniel Chen", "daniel.chen@chubb.example.com", "MOTOR", 8));
        users.save(new User("manager1", passwordEncoder.encode("manager123"), Role.MANAGER, "Maria Santos",
                "maria.santos@chubb.example.com", null, true));
    }

    private User claimant(String username, String fullName, String email, String phone, String country,
                          String policyNumber) {
        User user = new User(username, passwordEncoder.encode("claimant123"), Role.CLAIMANT, fullName, email, phone,
                true);
        user.setClaimantDetails(country, policyNumber);
        return user;
    }

    private User officer(String username, String fullName, String email, String specialization, int maxCapacity) {
        User user = new User(username, passwordEncoder.encode("officer123"), Role.OFFICER, fullName, email, null, true);
        user.setOfficerDetails(specialization, maxCapacity);
        return user;
    }
}
