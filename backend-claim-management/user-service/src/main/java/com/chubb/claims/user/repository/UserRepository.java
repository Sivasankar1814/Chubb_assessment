package com.chubb.claims.user.repository;

import com.chubb.claims.user.entity.Role;
import com.chubb.claims.user.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    @Query("""
            select u from User u
            where (:role is null or u.role = :role)
              and (:active is null or u.active = :active)
            order by u.id""")
    List<User> search(@Param("role") Role role, @Param("active") Boolean active);
}
