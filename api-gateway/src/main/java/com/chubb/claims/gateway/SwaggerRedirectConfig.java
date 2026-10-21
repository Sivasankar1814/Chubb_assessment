package com.chubb.claims.gateway;

import java.net.URI;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerResponse;

/** Sends the common "wrong" entry URLs to the aggregated Swagger UI instead of an error page. */
@Configuration
public class SwaggerRedirectConfig {

    @Bean
    public RouterFunction<ServerResponse> swaggerRedirects() {
        URI target = URI.create("/swagger-ui.html");
        return RouterFunctions.route()
                .GET("/", request -> redirect(target))
                .GET("/swagger-ui", request -> redirect(target))
                .GET("/swagger-ui/", request -> redirect(target))
                .GET("/swagger-ui/index.html", request -> redirect(target))
                .build();
    }

    private static reactor.core.publisher.Mono<ServerResponse> redirect(URI target) {
        return ServerResponse.status(HttpStatus.FOUND).location(target).build();
    }
}
