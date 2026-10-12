import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { validateUser, validateErrorResponse } from '../helpers/user-validator';
import { authenticationHeaders } from '../helpers/auth';

test('DELETE a user makes subsequent GET return 404', {
  tag: ['@contract', '@bug-002'],
  annotation: [
    {
      type: 'contract',
      description: 'DELETE /users/{email} and GET /users/{email}.',
    },
    {
      type: 'issue',
      description: 'BUG-002: GET for a deleted or missing user returns 500 instead of documented 404.',
    },
  ],
}, async ({ request }) => {
  const email = `delete-test-${randomUUID()}@example.com`;
  const name = 'Delete Test User';
  const age = 40;

  let creationConfirmed = false;

  try {
    const createResponse = await request.post('users', {
      data: { name, email, age },
    });

    expect(createResponse.status()).toBe(201);
    expect(createResponse.headers()['content-type']).toMatch(/^application\/json\b/i);
    creationConfirmed = true;

    const created = await createResponse.json();
    const createdValid = validateUser(created);
    const createdErrors = validateUser.errors;
    expect(createdValid, JSON.stringify(createdErrors, null, 2)).toBe(true);

    const encodedEmail = encodeURIComponent(email);

    const deleteResponse = await request.delete(`users/${encodedEmail}`, {
      headers: authenticationHeaders(),
    });
    expect(deleteResponse.status()).toBe(204);

    const getResponse = await request.get(`users/${encodedEmail}`);

    expect(getResponse.status()).toBe(404);
    expect(getResponse.headers()['content-type']).toMatch(/^application\/json\b/i);

    const errorBody = await getResponse.json();
    const errorValid = validateErrorResponse(errorBody);
    const errorErrors = validateErrorResponse.errors;
    expect(errorValid, JSON.stringify(errorErrors, null, 2)).toBe(true);
  } finally {
    const encodedEmail = encodeURIComponent(email);

    try {
      const deleteResponse = await request.delete(`users/${encodedEmail}`, {
        headers: authenticationHeaders(),
      });

      const status = deleteResponse.status();

      expect.soft([204, 404], 'cleanup DELETE status').toContain(status);
    } catch {
      expect.soft(false, 'cleanup DELETE request failed').toBe(true);
    }
  }
});
