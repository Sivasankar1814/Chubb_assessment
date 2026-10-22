package com.chubb.claims.workload.model;

import java.math.BigDecimal;

public record StaffWorkload(Long staffId, String fullName, String specialization, int maxCapacity, long openClaims,
                            long availableCapacity, BigDecimal utilizationPercent, Level level) {

    public enum Level {
        LOW, MODERATE, HIGH, FULL;

        public static Level of(BigDecimal utilizationPercent) {
            double u = utilizationPercent.doubleValue();
            if (u >= 100) {
                return FULL;
            }
            if (u >= 80) {
                return HIGH;
            }
            if (u >= 50) {
                return MODERATE;
            }
            return LOW;
        }
    }
}
