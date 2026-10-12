import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { validateUser, validateErrorResponse } from '../helpers/user-validator';
import { authenticationHeaders } from '../helpers/auth';

type AgeTypeCase = {
  method: 'POST' | 'PUT';
  age: string | number | boolean | null;
  label: string;
};

const cases: AgeTypeCase[] = [
  { method: 'POST', age: '30', label: 'string age "30"' },
  { method: 'POST', age: 30.5, label: 'fractional age 30.5' },
  { method: 'POST', age: true, label: 'boolean age true' },
  { method: 'POST', age: null, label: 'null age' },
  { method: 'PUT', age: '30', label: 'string age "30"' },
  { method: 'PUT', age: 30.5, label: 'fractional age 30.5' },
  { method: 'PUT', age: true, label: 'boolean age true' },
  { method: 'PUT', age: null, label: 'null age' },
];

for (const testCase of cases) {
  if (testCase.method === 'POST') {
    test(`POST /users rejects ${testCase.label} with 400`, {
      tag: ['@contract', '@validation'],
      annotation: [
        { type: 'contract', description: 'POST /users age integer validation.' },
        { type: 'note', description: `Age type validation: rejects ${testCase.label}.` },
      ],
    }, async ({ request }) => {
      const email = `age-type-post-${randomUUID()}@example.com`;
      let creationAttempted = false;
      let creationConfirmed = false;

      try {
        creationAttempted = true;
        const res = await request.post('users', {
          data: { name: 'Age Type User', email, age: testCase.age },
        });

        if (res.status() === 201) {
          creationConfirmed = true;
        }

        expect(res.status()).toBe(400);
        expect(res.headers()['content-type']).toMatch(/^application\/json\b/i);

        const body = await res.json();
        const valid = validateErrorResponse(body);
        const errors = validateErrorResponse.errors;
        expect(valid, JSON.stringify(errors, null, 2)).toBe(true);
      } finally {
        if (creationAttempted) {
          try {
            const deleteRes = await request.delete(`users/${encodeURIComponent(email)}`, {
              headers: authenticationHeaders(),
            });
            const status = deleteRes.status();
            const expectedStatuses = creationConfirmed ? [204] : [204, 404];
            expect.soft(expectedStatuses, 'cleanup DELETE status').toContain(status);
          } catch {
            expect.soft(false, 'cleanup DELETE request failed').toBe(true);
          }
        }
      }
    });
  } else {
    test(`PUT /users/{email} rejects ${testCase.label} with 400`, {
      tag: ['@contract', '@validation'],
      annotation: [
        { type: 'contract', description: 'PUT /users/{email} age integer validation.' },
        { type: 'note', description: `Age type validation: rejects ${testCase.label}.` },
      ],
    }, async ({ request }) => {
      const setupEmail = `age-type-put-${randomUUID()}@example.com`;
      let setupAttempted = false;
      let setupConfirmed = false;

      try {
        setupAttempted = true;
        const setupRes = await request.post('users', {
          data: { name: 'Setup User', email: setupEmail, age: 30 },
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
        expect(setupJson.email).toBe(setupEmail);
        expect(setupJson.age).toBe(30);

        const res = await request.put(`users/${encodeURIComponent(setupEmail)}`, {
          data: { name: 'Age Type Updated User', email: setupEmail, age: testCase.age },
        });

        expect(res.status()).toBe(400);
        expect(res.headers()['content-type']).toMatch(/^application\/json\b/i);

        const body = await res.json();
        const valid = validateErrorResponse(body);
        const errors = validateErrorResponse.errors;
        expect(valid, JSON.stringify(errors, null, 2)).toBe(true);
      } finally {
        if (setupAttempted) {
          try {
            const deleteRes = await request.delete(`users/${encodeURIComponent(setupEmail)}`, {
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
  }
}
