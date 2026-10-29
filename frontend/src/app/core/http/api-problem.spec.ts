import { HttpErrorResponse } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { applyFieldErrors, toApiProblem } from './api-problem';

describe('toApiProblem', () => {
  it('reads the backend ApiError and splits "field: message" details', () => {
    const problem = toApiProblem(
      new HttpErrorResponse({
        status: 400,
        error: {
          status: 400,
          error: 'Bad Request',
          message: 'Validation failed',
          details: ['claimAmount: must be greater than zero', 'description: must not be blank'],
        },
      }),
    );

    expect(problem.status).toBe(400);
    expect(problem.message).toBe('Some of the information is not valid.');
    expect(problem.fieldErrors).toEqual({
      claimAmount: 'must be greater than zero',
      description: 'must not be blank',
    });
  });

  it('shows the server message for a business-rule conflict', () => {
    const problem = toApiProblem(
      new HttpErrorResponse({
        status: 409,
        error: { status: 409, message: 'Officer Priya Nair is at full capacity (5/5 open claims)' },
      }),
    );

    expect(problem.message).toBe('Officer Priya Nair is at full capacity (5/5 open claims)');
  });

  it('copes with the leaner 401 body the security entry point sends', () => {
    const problem = toApiProblem(
      new HttpErrorResponse({
        status: 401,
        error: { status: 401, error: 'Unauthorized', message: 'Token is invalid or has expired' },
      }),
    );

    expect(problem.status).toBe(401);
    expect(problem.message).toBe('Token is invalid or has expired');
    expect(problem.details).toEqual([]);
  });

  it('explains a network failure, which has no body at all', () => {
    const problem = toApiProblem(
      new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }),
    );

    expect(problem.message).toContain('Cannot reach the server');
  });

  it('never repeats a 5xx body, which can name internal services', () => {
    const problem = toApiProblem(
      new HttpErrorResponse({
        status: 502,
        error: { message: 'Downstream service error: connect to user-service:8081 refused' },
      }),
    );

    expect(problem.message).not.toContain('user-service');
    expect(problem.message).toContain('Something went wrong');
  });

  it('gives a generic message for something that is not an HTTP error', () => {
    expect(toApiProblem(new Error('boom')).status).toBe(-1);
  });
});

describe('applyFieldErrors', () => {
  it('puts matching details on their controls and returns the rest', () => {
    const amount = new FormControl('');
    const problem = toApiProblem(
      new HttpErrorResponse({
        status: 400,
        error: {
          message: 'Validation failed',
          details: ['claimAmount: too large', 'market: required'],
        },
      }),
    );

    const unmatched = applyFieldErrors({ claimAmount: amount }, problem);

    expect(amount.getError('server')).toBe('too large');
    expect(amount.touched).toBe(true);
    expect(unmatched).toEqual(['market: required']);
  });
});
