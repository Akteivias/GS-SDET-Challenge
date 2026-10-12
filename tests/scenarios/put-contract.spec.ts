import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { validateUser } from '../helpers/user-validator';
import { authenticationHeaders } from '../helpers/auth';

test('PUT update persists and is readable via GET', {
  tag: ['@contract', '@bug-001'],
  annotation: [
    {
      type: 'contract',
      description: 'PUT /users/{email} followed by GET /users/{email}.',
    },
    {
      type: 'issue',
      description: 'BUG-001: PUT returns updated values but the subsequent GET returns the original user data.',
    },
  ],
}, async ({ request }) => {
  const email = `put-test-${randomUUID()}@example.com`;
  const originalName = 'Original Name';
  const originalAge = 30;
  const updatedName = 'Updated Name';
  const updatedAge = 31;

  let creationConfirmed = false;

  try {
    const createResponse = await request.post('users', {
      data: { name: originalName, email, age: originalAge },
    });

    expect(createResponse.status()).toBe(201);
    expect(createResponse.headers()['content-type']).toMatch(/^application\/json\b/i);
    creationConfirmed = true;

    const created = await createResponse.json();
    const createdValid = validateUser(created);
    const createdErrors = validateUser.errors;
    expect(createdValid, JSON.stringify(createdErrors, null, 2)).toBe(true);

    const encodedEmail = encodeURIComponent(email);

    const putResponse = await request.put(`users/${encodedEmail}`, {
      data: { name: updatedName, email, age: updatedAge },
    });

    expect(putResponse.status()).toBe(200);
    expect(putResponse.headers()['content-type']).toMatch(/^application\/json\b/i);

    const updated = await putResponse.json();
    const updatedValid = validateUser(updated);
    const updatedErrors = validateUser.errors;
    expect(updatedValid, JSON.stringify(updatedErrors, null, 2)).toBe(true);
    expect(updated.name).toBe(updatedName);
    expect(updated.age).toBe(updatedAge);
    expect(updated.email).toBe(email);

    const getResponse = await request.get(`users/${encodedEmail}`);

    expect(getResponse.status()).toBe(200);
    expect(getResponse.headers()['content-type']).toMatch(/^application\/json\b/i);

    const retrieved = await getResponse.json();
    const retrievedValid = validateUser(retrieved);
    const retrievedErrors = validateUser.errors;
    expect(retrievedValid, JSON.stringify(retrievedErrors, null, 2)).toBe(true);
    expect(retrieved.name).toBe(updatedName);
    expect(retrieved.age).toBe(updatedAge);
    expect(retrieved.email).toBe(email);
  } finally {
    const encodedEmail = encodeURIComponent(email);

    try {
      const deleteResponse = await request.delete(`users/${encodedEmail}`, {
        headers: authenticationHeaders(),
      });

      const status = deleteResponse.status();

      if (creationConfirmed) {
        expect.soft([204, 404], 'cleanup DELETE status after confirmed creation').toContain(status);
      } else {
        expect.soft([204, 404], 'cleanup DELETE status after unconfirmed creation').toContain(status);
      }
    } catch {
      expect.soft(false, 'cleanup DELETE request failed').toBe(true);
    }
  }
});
