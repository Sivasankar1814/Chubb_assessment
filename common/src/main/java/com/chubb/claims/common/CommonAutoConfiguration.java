package com.chubb.claims.common;

import com.chubb.claims.common.exception.GlobalExceptionHandler;
import com.chubb.claims.common.feign.FeignConfig;
import com.chubb.claims.common.openapi.OpenApiConfig;
import com.chubb.claims.common.security.SecurityConfig;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.Import;

/** Wires the shared cross-cutting concerns into every servlet-based microservice. */
@AutoConfiguration
@Import({SecurityConfig.class, GlobalExceptionHandler.class, FeignConfig.class, OpenApiConfig.class})
public class CommonAutoConfiguration {
}
