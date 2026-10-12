import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { validateUser, validateErrorResponse } from '../helpers/user-validator';
import { authenticationHeaders } from '../helpers/auth';

test('PUT update to a new unused email is readable via the new email', {
  tag: ['@contract', '@rule-r23', '@bug-001', '@bug-002'],
  annotation: [
    {
      type: 'contract',
      description: 'PUT /users/{email} with an updated email address.',
    },
    {
      type: 'rule',
      description: 'R23: Update a user email to a new unused address.',
    },
    {
      type: 'issue',
      description: 'BUG-001 and BUG-002 affect persistence and old-email verification.',
    },
  ],
}, async ({ request }) => {
  const originalEmail = `put-email-original-${randomUUID()}@example.com`;
  const updatedEmail = `put-email-updated-${randomUUID()}@example.com`;
  const originalName = 'Original Name';
  const updatedName = 'Updated Name';
  const originalAge = 30;
  const updatedAge = 31;

  let created = false;

  try {
    const createResponse = await request.post('users', {
      data: { name: originalName, email: originalEmail, age: originalAge },
    });

    expect(createResponse.status()).toBe(201);
    expect(createResponse.headers()['content-type']).toMatch(/^application\/json\b/i);
    created = true;

    const createdBody = await createResponse.json();
    const createdValid = validateUser(createdBody);
    const createdErrors = validateUser.errors;
    expect(createdValid, JSON.stringify(createdErrors, null, 2)).toBe(true);

    const encodedOriginalEmail = encodeURIComponent(originalEmail);

    const putResponse = await request.put(`users/${encodedOriginalEmail}`, {
      data: { name: updatedName, email: updatedEmail, age: updatedAge },
    });

    expect(putResponse.status()).toBe(200);
    expect(putResponse.headers()['content-type']).toMatch(/^application\/json\b/i);

    const updatedBody = await putResponse.json();
    const updatedValid = validateUser(updatedBody);
    const updatedErrors = validateUser.errors;
    expect(updatedValid, JSON.stringify(updatedErrors, null, 2)).toBe(true);
    expect(updatedBody.name).toBe(updatedName);
    expect(updatedBody.email).toBe(updatedEmail);
    expect(updatedBody.age).toBe(updatedAge);

    const encodedUpdatedEmail = encodeURIComponent(updatedEmail);

    const getUpdatedResponse = await request.get(`users/${encodedUpdatedEmail}`);
    expect(getUpdatedResponse.status()).toBe(200);
    expect(getUpdatedResponse.headers()['content-type']).toMatch(/^application\/json\b/i);

    const retrievedUpdated = await getUpdatedResponse.json();
    const retrievedUpdatedValid = validateUser(retrievedUpdated);
    const retrievedUpdatedErrors = validateUser.errors;
    expect(retrievedUpdatedValid, JSON.stringify(retrievedUpdatedErrors, null, 2)).toBe(true);
    expect(retrievedUpdated.name).toBe(updatedName);
    expect(retrievedUpdated.email).toBe(updatedEmail);
    expect(retrievedUpdated.age).toBe(updatedAge);

    const getOriginalResponse = await request.get(`users/${encodedOriginalEmail}`);
    expect(getOriginalResponse.status()).toBe(404);
    expect(getOriginalResponse.headers()['content-type']).toMatch(/^application\/json\b/i);

    const originalErrorBody = await getOriginalResponse.json();
    const originalErrorValid = validateErrorResponse(originalErrorBody);
    const originalErrorErrors = validateErrorResponse.errors;
    expect(originalErrorValid, JSON.stringify(originalErrorErrors, null, 2)).toBe(true);
  } finally {
    for (const email of [updatedEmail, originalEmail]) {
      try {
        const deleteResponse = await request.delete(`users/${encodeURIComponent(email)}`, {
          headers: authenticationHeaders(),
        });
        const status = deleteResponse.status();
        expect.soft([204, 404], `cleanup DELETE status for ${email}`).toContain(status);
      } catch {
        expect.soft(false, `cleanup DELETE request failed for ${email}`).toBe(true);
      }
    }
  }
});
