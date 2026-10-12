import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { validateUser, validateErrorResponse } from '../helpers/user-validator';
import { authenticationHeaders } from '../helpers/auth';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type PostCase = {
  label: string;
  makePayload: (email: string) => Record<string, unknown>;
};

type PutCase = {
  label: string;
  makePayload: (email: string) => Record<string, unknown>;
};

const postCases: PostCase[] = [
  {
    label: 'missing email',
    makePayload: () => ({ name: 'Missing Email User', age: 30 }),
  },
  {
    label: 'missing age',
    makePayload: (email) => ({ name: 'Missing Age User', email }),
  },
  {
    label: 'empty object',
    makePayload: () => ({}),
  },
];

const putCases: PutCase[] = [
  {
    label: 'missing email',
    makePayload: () => ({ name: 'Missing Email PUT', age: 30 }),
  },
  {
    label: 'missing age',
    makePayload: (email) => ({ name: 'Missing Age PUT', email }),
  },
  {
    label: 'empty object',
    makePayload: () => ({}),
  },
];

for (const testCase of postCases) {
  test(`POST /users rejects ${testCase.label} with 400`, {
    tag: ['@contract', '@validation'],
    annotation: [
      { type: 'contract', description: 'POST /users required fields validation.' },
      { type: 'note', description: `Omitted required property: rejects ${testCase.label}.` },
    ],
  }, async ({ request }) => {
    const knownEmail =
      testCase.label === 'missing age'
        ? `missing-field-post-age-${randomUUID()}@example.com`
        : undefined;
    let creationAttempted = false;
    let creationConfirmed = false;
    let cleanupEmail: string | undefined;

    try {
      creationAttempted = true;
      const payload = testCase.makePayload(knownEmail ?? '');
      const res = await request.post('users', { data: payload });
      const status = res.status();

      if (status === 201) {
        creationConfirmed = true;
        try {
          const body = await res.json();
          if (isRecord(body) && typeof body.email === 'string' && body.email.startsWith('missing-field-')) {
            cleanupEmail = body.email;
          } else {
            expect.soft(
              false,
              'unexpected 201 response did not contain a safe missing-field- email for cleanup'
            ).toBe(true);
          }
        } catch {
          expect.soft(false, 'failed to parse unexpected 201 response for cleanup').toBe(true);
        }
      }

      expect(status).toBe(400);

      if (status === 400) {
        expect(res.headers()['content-type']).toMatch(/^application\/json\b/i);
        const body = await res.json();
        const valid = validateErrorResponse(body);
        const errors = validateErrorResponse.errors;
        expect(valid, JSON.stringify(errors, null, 2)).toBe(true);
      }
    } finally {
      const targetEmail = cleanupEmail ?? knownEmail;
      if (creationAttempted && targetEmail) {
        try {
          const deleteRes = await request.delete(`users/${encodeURIComponent(targetEmail)}`, {
            headers: authenticationHeaders(),
          });
          const deleteStatus = deleteRes.status();
          const expectedStatuses = creationConfirmed ? [204] : [204, 404];
          expect.soft(expectedStatuses, 'cleanup DELETE status').toContain(deleteStatus);
        } catch {
          expect.soft(false, 'cleanup DELETE request failed').toBe(true);
        }
      } else if (creationAttempted && creationConfirmed && !cleanupEmail) {
        expect.soft(
          false,
          'unexpected 201 occurred but no safe test-owned email was available for cleanup'
        ).toBe(true);
      }
    }
  });
}

for (const testCase of putCases) {
  test(`PUT /users/{email} rejects ${testCase.label} with 400`, {
    tag: ['@contract', '@validation'],
    annotation: [
      { type: 'contract', description: 'PUT /users/{email} required fields validation.' },
      { type: 'note', description: `Omitted required property: rejects ${testCase.label}.` },
    ],
  }, async ({ request }) => {
    const setupEmail = `missing-field-put-${testCase.label.replace(/\s+/g, '-')}-${randomUUID()}@example.com`;
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

      const payload = testCase.makePayload(setupEmail);
      const res = await request.put(`users/${encodeURIComponent(setupEmail)}`, { data: payload });

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
          const deleteStatus = deleteRes.status();
          const expectedStatuses = setupConfirmed ? [204] : [204, 404];
          expect.soft(expectedStatuses, 'cleanup DELETE status').toContain(deleteStatus);
        } catch {
          expect.soft(false, 'cleanup DELETE request failed').toBe(true);
        }
      }
    }
  });
}
