package com.chubb.claims.claim.config;

import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableFeignClients(basePackages = "com.chubb.claims.claim.client")
public class FeignClientsConfig {
}
