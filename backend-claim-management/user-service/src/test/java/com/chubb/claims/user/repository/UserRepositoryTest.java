package com.chubb.claims.user.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.chubb.claims.user.entity.Role;
import com.chubb.claims.user.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

@DataJpaTest
class UserRepositoryTest {

    @Autowired
    private UserRepository users;

    private User save(String username, Role role, boolean active) {
        User user = new User(username, "hash", role, username, username + "@example.com", null, active);
        return users.saveAndFlush(user);
    }

    @Test
    void saveGeneratesIdAndCreatedAt() {
        User saved = save("claimant1", Role.CLAIMANT, true);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(users.findByUsername("claimant1")).isPresent();
    }

    @Test
    void usernameMustBeUnique() {
        save("dup", Role.CLAIMANT, true);

        assertThatThrownBy(() -> save("dup", Role.OFFICER, true)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void searchFiltersByRoleAndActiveFlag() {
        save("c1", Role.CLAIMANT, true);
        save("s1", Role.OFFICER, true);
        save("s2", Role.OFFICER, false);

        assertThat(users.search(null, null)).hasSize(3);
        assertThat(users.search(Role.OFFICER, null)).extracting(User::getUsername).containsExactly("s1", "s2");
        assertThat(users.search(Role.OFFICER, true)).extracting(User::getUsername).containsExactly("s1");
        assertThat(users.search(null, false)).extracting(User::getUsername).containsExactly("s2");
    }
}
