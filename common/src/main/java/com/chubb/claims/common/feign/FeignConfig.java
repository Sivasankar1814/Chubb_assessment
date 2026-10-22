package com.chubb.claims.common.feign;

import com.chubb.claims.common.exception.ResourceNotFoundException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import feign.RequestInterceptor;
import feign.Response;
import feign.codec.ErrorDecoder;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** Propagates the caller's credentials to downstream services and maps 404s to domain exceptions. */
@Configuration
public class FeignConfig {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Bean
    public RequestInterceptor authorizationForwardingInterceptor() {
        return template -> {
            if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
                String auth = attrs.getRequest().getHeader(HttpHeaders.AUTHORIZATION);
                if (auth != null) {
                    template.header(HttpHeaders.AUTHORIZATION, auth);
                }
            }
        };
    }

    @Bean
    public ErrorDecoder downstreamErrorDecoder() {
        ErrorDecoder fallback = new ErrorDecoder.Default();
        return (methodKey, response) -> {
            if (response.status() == 404) {
                return new ResourceNotFoundException(extractMessage(response));
            }
            return fallback.decode(methodKey, response);
        };
    }

    private static String extractMessage(Response response) {
        if (response.body() != null) {
            try (InputStream in = response.body().asInputStream()) {
                JsonNode node = MAPPER.readTree(new String(in.readAllBytes(), StandardCharsets.UTF_8));
                if (node.hasNonNull("message")) {
                    return node.get("message").asText();
                }
            } catch (IOException ignored) {
                // fall through to generic message
            }
        }
        return "Resource not found in downstream service";
    }
}
