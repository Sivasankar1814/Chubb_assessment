package com.chubb.claims.common.exception;

/** Raised when a request is well-formed but violates a business rule (e.g. illegal status transition). */
public class BusinessRuleException extends RuntimeException {

    public BusinessRuleException(String message) {
        super(message);
    }
}
