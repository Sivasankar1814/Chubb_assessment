package com.chubb.claims.common.model;

/** The APAC markets claims are handled in. Serialised by name (e.g. {@code "SG"}). */
public enum Market {
    SG("Singapore"),
    HK("Hong Kong"),
    JP("Japan"),
    TH("Thailand"),
    IN("India"),
    ID("Indonesia");

    private final String displayName;

    Market(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
