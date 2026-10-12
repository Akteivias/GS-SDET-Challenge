import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { validateUser } from '../helpers/user-validator';
import { authenticationHeaders } from '../helpers/auth';

test('create and retrieve a user', {
  tag: ['@lifecycle', '@contract'],
  annotation: [
    {
      type: 'contract',
      description: 'POST /users followed by GET /users/{email}.',
    },
    {
      type: 'note',
      description: 'Verifies successful creation and immediate retrieval of a test-owned user.',
    },
  ],
}, async ({ request }) => {
  const email = `test-${randomUUID()}@example.com`;
  const name = 'Test User';
  const age = 30;

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

    expect(created.name).toBe(name);
    expect(created.email).toBe(email);
    expect(created.age).toBe(age);

    const encodedEmail = encodeURIComponent(email);
    const getResponse = await request.get(`users/${encodedEmail}`);
    expect(getResponse.status()).toBe(200);
    expect(getResponse.headers()['content-type']).toMatch(/^application\/json\b/i);

    const retrieved = await getResponse.json();
    const retrievedValid = validateUser(retrieved);
    const retrievedErrors = validateUser.errors;
    expect(retrievedValid, JSON.stringify(retrievedErrors, null, 2)).toBe(true);

    expect(retrieved.name).toBe(name);
    expect(retrieved.email).toBe(email);
    expect(retrieved.age).toBe(age);
  } finally {
    const encodedEmail = encodeURIComponent(email);

    try {
      const deleteResponse = await request.delete(`users/${encodedEmail}`, {
        headers: authenticationHeaders(),
      });

      const status = deleteResponse.status();

      if (creationConfirmed) {
        expect.soft(status, 'cleanup DELETE status after confirmed creation').toBe(204);
      } else {
        expect.soft([204, 404], 'cleanup DELETE status after unconfirmed creation').toContain(status);
      }
    } catch {
      expect.soft(false, 'cleanup DELETE request failed').toBe(true);
    }
  }
});
