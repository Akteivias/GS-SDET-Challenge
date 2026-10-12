import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import {
  validateUser,
  validateErrorResponse,
  validateUserArray,
} from './helpers/user-validator';
import { authenticationHeaders } from './helpers/auth';

test.describe('Contract Validation Rules', () => {
  test.describe('GET /users (Collection)', () => {
    test('R01: GET /users returns list containing test-owned users', {
      tag: ['@contract', '@rule-r01'],
      annotation: [
        { type: 'contract', description: 'GET /users returns user collection.' },
        { type: 'rule', description: 'R01: GET /users returns list containing test-owned users.' },
      ],
    }, async ({ request }) => {
      const email1 = `list-user1-${randomUUID()}@example.com`;
      const email2 = `list-user2-${randomUUID()}@example.com`;

      let created1 = false;
      let created2 = false;

      try {
        const res1 = await request.post('users', {
          data: { name: 'List User 1', email: email1, age: 25 },
        });
        expect(res1.status()).toBe(201);
        created1 = true;

        const res2 = await request.post('users', {
          data: { name: 'List User 2', email: email2, age: 35 },
        });
        expect(res2.status()).toBe(201);
        created2 = true;

        const listRes = await request.get('users');
        expect(listRes.status()).toBe(200);
        expect(listRes.headers()['content-type']).toMatch(/^application\/json\b/i);

        const list = await listRes.json();
        const listValid = validateUserArray(list);
        const listErrors = validateUserArray.errors;
        expect(listValid, JSON.stringify(listErrors, null, 2)).toBe(true);

        const emails = (list as Array<{ email: string }>).map((u) => u.email);
        expect(emails).toContain(email1);
        expect(emails).toContain(email2);
      } finally {
        for (const { email, created } of [
          { email: email1, created: created1 },
          { email: email2, created: created2 },
        ]) {
          try {
            const deleteRes = await request.delete(`users/${encodeURIComponent(email)}`, {
              headers: authenticationHeaders(),
            });
            const status = deleteRes.status();
            if (created) {
              expect.soft([204, 404], `cleanup DELETE status for ${email}`).toContain(status);
            }
          } catch {
            expect.soft(false, `cleanup DELETE request failed for ${email}`).toBe(true);
          }
        }
      }
    });
  });

  test.describe('POST /users (Create & Validation)', () => {
    test('R04: POST /users returns 400 when required field is missing', {
      tag: ['@contract', '@rule-r04'],
      annotation: [
        { type: 'contract', description: 'POST /users rejects missing required field with 400.' },
        { type: 'rule', description: 'R04: POST /users returns 400 when required field is missing.' },
      ],
    }, async ({ request }) => {
      const res = await request.post('users', {
        data: { email: `missing-name-${randomUUID()}@example.com`, age: 25 },
      });

      expect(res.status()).toBe(400);
      expect(res.headers()['content-type']).toMatch(/^application\/json\b/i);

      const body = await res.json();
      const valid = validateErrorResponse(body);
      const errors = validateErrorResponse.errors;
      expect(valid, JSON.stringify(errors, null, 2)).toBe(true);
    });

    test('R07: POST /users returns 400 when email format is invalid', {
      tag: ['@contract', '@rule-r07', '@bug-005'],
      annotation: [
        { type: 'contract', description: 'POST /users rejects invalid email format with 400.' },
        { type: 'rule', description: 'R07: POST /users returns 400 when email format is invalid.' },
        { type: 'issue', description: 'BUG-005: Invalid email input is accepted instead of rejected.' },
      ],
    }, async ({ request }) => {
      const invalidEmail = `invalid-email-${randomUUID()}`;
      let attempted = false;
      let created = false;

      try {
        attempted = true;
        const res = await request.post('users', {
          data: { name: 'Invalid Email User', email: invalidEmail, age: 30 },
        });

        if (res.status() === 201) {
          created = true;
        }

        expect(res.status()).toBe(400);
        expect(res.headers()['content-type']).toMatch(/^application\/json\b/i);

        const body = await res.json();
        const valid = validateErrorResponse(body);
        const errors = validateErrorResponse.errors;
        expect(valid, JSON.stringify(errors, null, 2)).toBe(true);
      } finally {
        if (attempted) {
          try {
            const deleteRes = await request.delete(`users/${encodeURIComponent(invalidEmail)}`, {
              headers: authenticationHeaders(),
            });
            const status = deleteRes.status();
            const expectedStatuses = created ? [204] : [204, 404];
            expect.soft(expectedStatuses, 'cleanup DELETE status').toContain(status);
          } catch {
            expect.soft(false, 'cleanup DELETE request failed').toBe(true);
          }
        }
      }
    });

    test('R06: POST /users returns 409 when creating user with duplicate email', {
      tag: ['@contract', '@rule-r06', '@bug-003'],
      annotation: [
        { type: 'contract', description: 'POST /users rejects duplicate email with 409.' },
        { type: 'rule', description: 'R06: POST /users returns 409 when creating user with duplicate email.' },
        { type: 'issue', description: 'BUG-003: Duplicate user creation returns 500 instead of documented 409.' },
      ],
    }, async ({ request }) => {
      const email = `dup-${randomUUID()}@example.com`;
      let created = false;

      try {
        const firstRes = await request.post('users', {
          data: { name: 'Initial User', email, age: 30 },
        });
        expect(firstRes.status()).toBe(201);
        created = true;

        const dupRes = await request.post('users', {
          data: { name: 'Duplicate User', email, age: 35 },
        });

        expect(dupRes.status()).toBe(409);
        expect(dupRes.headers()['content-type']).toMatch(/^application\/json\b/i);

        const body = await dupRes.json();
        const valid = validateErrorResponse(body);
        const errors = validateErrorResponse.errors;
        expect(valid, JSON.stringify(errors, null, 2)).toBe(true);
      } finally {
        if (created) {
          try {
            const deleteRes = await request.delete(`users/${encodeURIComponent(email)}`, {
              headers: authenticationHeaders(),
            });
            const status = deleteRes.status();
            expect.soft([204, 404], 'cleanup DELETE status').toContain(status);
          } catch {
            expect.soft(false, 'cleanup DELETE request failed').toBe(true);
          }
        }
      }
    });
  });

  test.describe('GET /users/{email} (Read)', () => {
    test('R08: GET /users/{email} returns 404 for non-existent user', {
      tag: ['@contract', '@rule-r08', '@bug-002'],
      annotation: [
        { type: 'contract', description: 'GET /users/{email} returns 404 for non-existent user.' },
        { type: 'rule', description: 'R08: GET /users/{email} returns 404 for non-existent user.' },
        { type: 'issue', description: 'BUG-002: GET for a missing user returns 500 instead of documented 404.' },
      ],
    }, async ({ request }) => {
      const nonexistentEmail = `nonexistent-${randomUUID()}@example.com`;
      const res = await request.get(`users/${encodeURIComponent(nonexistentEmail)}`);

      expect(res.status()).toBe(404);
      expect(res.headers()['content-type']).toMatch(/^application\/json\b/i);

      const body = await res.json();
      const valid = validateErrorResponse(body);
      const errors = validateErrorResponse.errors;
      expect(valid, JSON.stringify(errors, null, 2)).toBe(true);
    });
  });

  test.describe('PUT /users/{email} (Update)', () => {
    test('R10: PUT /users/{email} returns 400 when body is invalid or missing required field', {
      tag: ['@contract', '@rule-r10'],
      annotation: [
        { type: 'contract', description: 'PUT /users/{email} rejects invalid body or missing required field with 400.' },
        { type: 'rule', description: 'R10: PUT /users/{email} returns 400 when body is invalid or missing required field.' },
      ],
    }, async ({ request }) => {
      const email = `missing-name-put-${randomUUID()}@example.com`;
      let attempted = false;
      let created = false;

      try {
        attempted = true;
        const setupRes = await request.post('users', {
          data: { name: 'R10 Setup User', email, age: 30 },
        });
        expect(setupRes.status()).toBe(201);
        created = true;

        const res = await request.put(`users/${encodeURIComponent(email)}`, {
          data: { email, age: 30 }, // missing required 'name'
        });

        expect(res.status()).toBe(400);
        expect(res.headers()['content-type']).toMatch(/^application\/json\b/i);

        const body = await res.json();
        const valid = validateErrorResponse(body);
        const errors = validateErrorResponse.errors;
        expect(valid, JSON.stringify(errors, null, 2)).toBe(true);
      } finally {
        if (attempted) {
          try {
            const deleteRes = await request.delete(`users/${encodeURIComponent(email)}`, {
              headers: authenticationHeaders(),
            });
            const status = deleteRes.status();
            const expectedStatuses = created ? [204] : [204, 404];
            expect.soft(expectedStatuses, 'cleanup DELETE status').toContain(status);
          } catch {
            expect.soft(false, 'cleanup DELETE request failed').toBe(true);
          }
        }
      }
    });

    test('R11: PUT /users/{email} returns 404 when user does not exist', {
      tag: ['@contract', '@rule-r11'],
      annotation: [
        { type: 'contract', description: 'PUT /users/{email} returns 404 when user does not exist.' },
        { type: 'rule', description: 'R11: PUT /users/{email} returns 404 when user does not exist.' },
      ],
    }, async ({ request }) => {
      const nonexistentEmail = `nonexistent-put-${randomUUID()}@example.com`;
      const res = await request.put(`users/${encodeURIComponent(nonexistentEmail)}`, {
        data: { name: 'Non Existent', email: nonexistentEmail, age: 35 },
      });

      expect(res.status()).toBe(404);
      expect(res.headers()['content-type']).toMatch(/^application\/json\b/i);

      const body = await res.json();
      const valid = validateErrorResponse(body);
      const errors = validateErrorResponse.errors;
      expect(valid, JSON.stringify(errors, null, 2)).toBe(true);
    });

    test('R12: PUT /users/{email} returns 409 when updating email to an existing email', {
      tag: ['@contract', '@rule-r12'],
      annotation: [
        { type: 'contract', description: 'PUT /users/{email} returns 409 when updating email to an existing email.' },
        { type: 'rule', description: 'R12: PUT /users/{email} returns 409 when updating email to an existing email.' },
      ],
    }, async ({ request }) => {
      const email1 = `put-dup1-${randomUUID()}@example.com`;
      const email2 = `put-dup2-${randomUUID()}@example.com`;
      let attempted1 = false;
      let created1 = false;
      let attempted2 = false;
      let created2 = false;

      try {
        attempted1 = true;
        const res1 = await request.post('users', {
          data: { name: 'User One', email: email1, age: 25 },
        });
        expect(res1.status()).toBe(201);
        created1 = true;

        attempted2 = true;
        const res2 = await request.post('users', {
          data: { name: 'User Two', email: email2, age: 30 },
        });
        expect(res2.status()).toBe(201);
        created2 = true;

        const dupPutRes = await request.put(`users/${encodeURIComponent(email1)}`, {
          data: { name: 'User One Updated', email: email2, age: 26 },
        });

        expect(dupPutRes.status()).toBe(409);
        expect(dupPutRes.headers()['content-type']).toMatch(/^application\/json\b/i);

        const body = await dupPutRes.json();
        const valid = validateErrorResponse(body);
        const errors = validateErrorResponse.errors;
        expect(valid, JSON.stringify(errors, null, 2)).toBe(true);
      } finally {
        for (const { email, attempted, created } of [
          { email: email1, attempted: attempted1, created: created1 },
          { email: email2, attempted: attempted2, created: created2 },
        ]) {
          if (attempted) {
            try {
              const deleteRes = await request.delete(`users/${encodeURIComponent(email)}`, {
                headers: authenticationHeaders(),
              });
              const status = deleteRes.status();
              const expectedStatuses = created ? [204] : [204, 404];
              expect.soft(expectedStatuses, `cleanup DELETE status for ${email}`).toContain(status);
            } catch {
              expect.soft(false, `cleanup DELETE request failed for ${email}`).toBe(true);
            }
          }
        }
      }
    });
  });

  test.describe('DELETE /users/{email} (Delete & Security)', () => {
    test('R14: DELETE /users/{email} returns 404 for non-existent user', {
      tag: ['@contract', '@rule-r14'],
      annotation: [
        { type: 'contract', description: 'DELETE /users/{email} returns 404 for non-existent user.' },
        { type: 'rule', description: 'R14: DELETE /users/{email} returns 404 for non-existent user.' },
      ],
    }, async ({ request }) => {
      const nonexistentEmail = `nonexistent-del-${randomUUID()}@example.com`;
      const res = await request.delete(`users/${encodeURIComponent(nonexistentEmail)}`, {
        headers: authenticationHeaders(),
      });

      expect(res.status()).toBe(404);
      expect(res.headers()['content-type']).toMatch(/^application\/json\b/i);

      const body = await res.json();
      const valid = validateErrorResponse(body);
      const errors = validateErrorResponse.errors;
      expect(valid, JSON.stringify(errors, null, 2)).toBe(true);
    });

    test('R16: DELETE /users/{email} returns 401 when Authentication header is missing', {
      tag: ['@contract', '@rule-r16', '@bug-004'],
      annotation: [
        { type: 'contract', description: 'DELETE /users/{email} requires Authentication header and returns 401 when missing.' },
        { type: 'rule', description: 'R16: DELETE /users/{email} returns 401 when Authentication header is missing.' },
        { type: 'issue', description: 'BUG-004: Dev accepts unauthorized DELETE requests and removes the user.' },
      ],
    }, async ({ request }) => {
      const email = `unauth-readback-${randomUUID()}@example.com`;
      const expectedName = 'Auth Test User';
      const expectedAge = 28;
      let creationAttempted = false;
      let creationConfirmed = false;

      try {
        await test.step('Create the user for the missing-authentication check', async () => {
          creationAttempted = true;
          const createRes = await request.post('users', {
            data: { name: expectedName, email, age: expectedAge },
          });
          if (createRes.status() === 201) {
            creationConfirmed = true;
          }
          expect(createRes.status()).toBe(201);
          expect(createRes.headers()['content-type']).toMatch(/^application\/json\b/i);

          const createJson = await createRes.json();
          const createValid = validateUser(createJson);
          const createErrors = validateUser.errors;
          expect(createValid, JSON.stringify(createErrors, null, 2)).toBe(true);
        });

        const unauthDeleteRes = await test.step('Attempt DELETE without authentication', async () => {
          const res = await request.delete(`users/${encodeURIComponent(email)}`);
          expect.soft(res.status(), 'unauthorized DELETE status').toBe(401);
          return res;
        });

        await test.step('Validate the rejection response when returned', async () => {
          if (unauthDeleteRes.status() === 401) {
            expect(unauthDeleteRes.headers()['content-type']).toMatch(/^application\/json\b/i);
            const body = await unauthDeleteRes.json();
            const valid = validateErrorResponse(body);
            const errors = validateErrorResponse.errors;
            expect(valid, JSON.stringify(errors, null, 2)).toBe(true);
          }
        });

        await test.step('Verify the user remains in the collection', async () => {
          const listRes = await request.get('users');
          expect(listRes.status()).toBe(200);
          expect(listRes.headers()['content-type']).toMatch(/^application\/json\b/i);

          const list = await listRes.json();
          const listValid = validateUserArray(list);
          const listErrors = validateUserArray.errors;
          expect(listValid, JSON.stringify(listErrors, null, 2)).toBe(true);

          const entry = (list as Array<{ name: string; email: string; age: number }>).find(
            (u) => u.email === email
          );
          expect.soft(entry, 'user must remain in collection after unauthorized DELETE').toBeDefined();
          if (entry) {
            expect.soft(entry.name).toBe(expectedName);
            expect.soft(entry.email).toBe(email);
            expect.soft(entry.age).toBe(expectedAge);
          }
        });
      } finally {
        if (creationAttempted) {
          try {
            const deleteRes = await request.delete(`users/${encodeURIComponent(email)}`, {
              headers: authenticationHeaders(),
            });
            const status = deleteRes.status();
            expect.soft([204, 404], 'cleanup DELETE status').toContain(status);
          } catch {
            expect.soft(false, 'cleanup DELETE request failed').toBe(true);
          }
        }
      }
    });

    test('R17: DELETE /users/{email} returns 401 when Authentication token is invalid', {
      tag: ['@contract', '@rule-r17', '@bug-004'],
      annotation: [
        { type: 'contract', description: 'DELETE /users/{email} validates Authentication token and returns 401 when invalid.' },
        { type: 'rule', description: 'R17: DELETE /users/{email} returns 401 when Authentication token is invalid.' },
        { type: 'issue', description: 'BUG-004: Dev accepts unauthorized DELETE requests and removes the user.' },
      ],
    }, async ({ request }) => {
      const email = `invalidtoken-readback-${randomUUID()}@example.com`;
      const expectedName = 'Invalid Token User';
      const expectedAge = 28;
      let creationAttempted = false;
      let creationConfirmed = false;

      try {
        await test.step('Create the user for the invalid-token check', async () => {
          creationAttempted = true;
          const createRes = await request.post('users', {
            data: { name: expectedName, email, age: expectedAge },
          });
          if (createRes.status() === 201) {
            creationConfirmed = true;
          }
          expect(createRes.status()).toBe(201);
          expect(createRes.headers()['content-type']).toMatch(/^application\/json\b/i);

          const createJson = await createRes.json();
          const createValid = validateUser(createJson);
          const createErrors = validateUser.errors;
          expect(createValid, JSON.stringify(createErrors, null, 2)).toBe(true);
        });

        const invalidDeleteRes = await test.step('Attempt DELETE with an invalid authentication token', async () => {
          const res = await request.delete(`users/${encodeURIComponent(email)}`, {
            headers: { Authentication: 'wrong_secret_token_123' },
          });
          expect.soft(res.status(), 'unauthorized DELETE status').toBe(401);
          return res;
        });

        await test.step('Validate the rejection response when returned', async () => {
          if (invalidDeleteRes.status() === 401) {
            expect(invalidDeleteRes.headers()['content-type']).toMatch(/^application\/json\b/i);
            const body = await invalidDeleteRes.json();
            const valid = validateErrorResponse(body);
            const errors = validateErrorResponse.errors;
            expect(valid, JSON.stringify(errors, null, 2)).toBe(true);
          }
        });

        await test.step('Verify the user remains in the collection', async () => {
          const listRes = await request.get('users');
          expect(listRes.status()).toBe(200);
          expect(listRes.headers()['content-type']).toMatch(/^application\/json\b/i);

          const list = await listRes.json();
          const listValid = validateUserArray(list);
          const listErrors = validateUserArray.errors;
          expect(listValid, JSON.stringify(listErrors, null, 2)).toBe(true);

          const entry = (list as Array<{ name: string; email: string; age: number }>).find(
            (u) => u.email === email
          );
          expect.soft(entry, 'user must remain in collection after unauthorized DELETE').toBeDefined();
          if (entry) {
            expect.soft(entry.name).toBe(expectedName);
            expect.soft(entry.email).toBe(email);
            expect.soft(entry.age).toBe(expectedAge);
          }
        });
      } finally {
        if (creationAttempted) {
          try {
            const deleteRes = await request.delete(`users/${encodeURIComponent(email)}`, {
              headers: authenticationHeaders(),
            });
            const status = deleteRes.status();
            expect.soft([204, 404], 'cleanup DELETE status').toContain(status);
          } catch {
            expect.soft(false, 'cleanup DELETE request failed').toBe(true);
          }
        }
      }
    });
  });
});
