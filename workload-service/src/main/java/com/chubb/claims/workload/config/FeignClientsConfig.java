package com.chubb.claims.workload.config;

import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableFeignClients(basePackages = "com.chubb.claims.workload.client")
public class FeignClientsConfig {
}
