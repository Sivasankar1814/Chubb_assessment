package com.chubb.claims.common.security;

import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings shared by the service that issues tokens (auth-service) and every service that validates them.
 * All services must use the same secret; override it with {@code CHUBB_SECURITY_JWT_SECRET} outside local demos.
 */
@ConfigurationProperties(prefix = "chubb.security.jwt")
public class JwtProperties {

    /** HS256 needs at least 32 bytes. */
    private String secret = "chubb-apac-claims-demo-secret-change-me-0123456789";
    private String issuer = "chubb-claims-auth";
    private long expirationMinutes = 120;

    public SecretKey secretKey() {
        return new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public String getIssuer() {
        return issuer;
    }

    public void setIssuer(String issuer) {
        this.issuer = issuer;
    }

    public long getExpirationMinutes() {
        return expirationMinutes;
    }

    public void setExpirationMinutes(long expirationMinutes) {
        this.expirationMinutes = expirationMinutes;
    }
}
