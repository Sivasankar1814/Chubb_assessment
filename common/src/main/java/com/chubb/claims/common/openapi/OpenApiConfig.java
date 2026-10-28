package com.chubb.claims.common.openapi;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** OpenAPI metadata plus a bearer-JWT scheme so "Authorize" works in Swagger UI. */
@Configuration
public class OpenApiConfig {

    private static final String SCHEME = "bearerAuth";

    @Bean
    public OpenAPI claimsOpenApi(@Value("${spring.application.name}") String appName) {
        return new OpenAPI()
                .info(new Info().title("Chubb APAC Claims - " + appName).version("1.0.0")
                        .description("Part of Chubb APAC Backend Claim Management"))
                .components(new Components().addSecuritySchemes(SCHEME,
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")
                                .description("Paste the accessToken returned by POST /api/auth/login")))
                .addSecurityItem(new SecurityRequirement().addList(SCHEME));
    }
}
