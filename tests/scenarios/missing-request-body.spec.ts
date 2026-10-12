import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { validateUser, validateErrorResponse } from '../helpers/user-validator';
import { authenticationHeaders } from '../helpers/auth';

test('POST /users rejects a missing request body with 400', {
  tag: ['@contract', '@validation'],
  annotation: [
    { type: 'contract', description: 'POST /users rejects missing request body with 400.' },
    { type: 'note', description: 'Missing request body validation.' },
  ],
}, async ({ request }) => {
  const res = await request.post('users');

  expect(res.status()).toBe(400);
  expect(res.headers()['content-type']).toMatch(/^application\/json\b/i);

  const body = await res.json();
  const valid = validateErrorResponse(body);
  const errors = validateErrorResponse.errors;
  expect(valid, JSON.stringify(errors, null, 2)).toBe(true);
});

test('PUT /users/{email} rejects a missing request body with 400', {
  tag: ['@contract', '@validation'],
  annotation: [
    { type: 'contract', description: 'PUT /users/{email} rejects missing request body with 400.' },
    { type: 'note', description: 'Missing request body validation.' },
  ],
}, async ({ request }) => {
  const email = `missing-body-${randomUUID()}@example.com`;
  let setupAttempted = false;
  let setupConfirmed = false;

  try {
    setupAttempted = true;
    const setupRes = await request.post('users', {
      data: { name: 'Setup User', email, age: 30 },
    });
    if (setupRes.status() === 201) {
      setupConfirmed = true;
    }

    expect(setupRes.status()).toBe(201);
    expect(setupRes.headers()['content-type']).toMatch(/^application\/json\b/i);

    const setupJson = await setupRes.json();
    const setupValid = validateUser(setupJson);
    const setupErrors = validateUser.errors;
    expect(setupValid, JSON.stringify(setupErrors, null, 2)).toBe(true);
    expect(setupJson.name).toBe('Setup User');
    expect(setupJson.email).toBe(email);
    expect(setupJson.age).toBe(30);

    const res = await request.put(`users/${encodeURIComponent(email)}`);

    expect(res.status()).toBe(400);
    expect(res.headers()['content-type']).toMatch(/^application\/json\b/i);

    const body = await res.json();
    const valid = validateErrorResponse(body);
    const errors = validateErrorResponse.errors;
    expect(valid, JSON.stringify(errors, null, 2)).toBe(true);
  } finally {
    if (setupAttempted) {
      try {
        const deleteRes = await request.delete(`users/${encodeURIComponent(email)}`, {
          headers: authenticationHeaders(),
        });
        const status = deleteRes.status();
        const expectedStatuses = setupConfirmed ? [204] : [204, 404];
        expect.soft(expectedStatuses, 'cleanup DELETE status').toContain(status);
      } catch {
        expect.soft(false, 'cleanup DELETE request failed').toBe(true);
      }
    }
  }
});
