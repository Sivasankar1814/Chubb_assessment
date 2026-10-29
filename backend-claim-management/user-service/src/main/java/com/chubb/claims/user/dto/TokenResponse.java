package com.chubb.claims.user.dto;

import java.util.List;

public record TokenResponse(String accessToken, String tokenType, long expiresInSeconds, String username,
                            List<String> roles) {
}
