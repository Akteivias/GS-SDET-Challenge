import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { validateUser, validateErrorResponse } from '../helpers/user-validator';
import { authenticationHeaders } from '../helpers/auth';

test.describe('Age Boundary Rule Scenarios', () => {
  test.describe('POST /users Age Boundaries', () => {
    test('POST /users accepts valid minimum age 1', {
      tag: ['@contract', '@validation'],
      annotation: [
        { type: 'contract', description: 'POST /users age integer validation [1, 150].' },
        { type: 'note', description: 'Age boundary: minimum valid value 1.' },
      ],
    }, async ({ request }) => {
      const email = `age-post-1-${randomUUID()}@example.com`;
      const name = 'Min Age User';
      const age = 1;

      let creationAttempted = false;
      let creationConfirmed = false;

      try {
        creationAttempted = true;
        const res = await request.post('users', {
          data: { name, email, age },
        });

        expect(res.status()).toBe(201);
        creationConfirmed = true;

        expect(res.headers()['content-type']).toMatch(/^application\/json\b/i);

        const body = await res.json();
        const valid = validateUser(body);
        const errors = validateUser.errors;
        expect(valid, JSON.stringify(errors, null, 2)).toBe(true);

        expect(body.name).toBe(name);
        expect(body.email).toBe(email);
        expect(body.age).toBe(age);
      } finally {
        if (creationAttempted) {
          try {
            const deleteRes = await request.delete(`users/${encodeURIComponent(email)}`, {
              headers: authenticationHeaders(),
            });
            const status = deleteRes.status();
            if (creationConfirmed) {
              expect.soft(status, 'cleanup DELETE status').toBe(204);
            } else {
              expect.soft([204, 404].includes(status), 'cleanup DELETE status').toBe(true);
            }
          } catch {
            expect.soft(false, 'cleanup DELETE request failed').toBe(true);
          }
        }
      }
    });

    test('POST /users accepts valid maximum age 150', {
      tag: ['@contract', '@validation'],
      annotation: [
        { type: 'contract', description: 'POST /users age integer validation [1, 150].' },
        { type: 'note', description: 'Age boundary: maximum valid value 150.' },
      ],
    }, async ({ request }) => {
      const email = `age-post-150-${randomUUID()}@example.com`;
      const name = 'Max Age User';
      const age = 150;

      let creationAttempted = false;
      let creationConfirmed = false;

      try {
        creationAttempted = true;
        const res = await request.post('users', {
          data: { name, email, age },
        });

        expect(res.status()).toBe(201);
        creationConfirmed = true;

        expect(res.headers()['content-type']).toMatch(/^application\/json\b/i);

        const body = await res.json();
        const valid = validateUser(body);
        const errors = validateUser.errors;
        expect(valid, JSON.stringify(errors, null, 2)).toBe(true);

        expect(body.name).toBe(name);
        expect(body.email).toBe(email);
        expect(body.age).toBe(age);
      } finally {
        if (creationAttempted) {
          try {
            const deleteRes = await request.delete(`users/${encodeURIComponent(email)}`, {
              headers: authenticationHeaders(),
            });
            const status = deleteRes.status();
            if (creationConfirmed) {
              expect.soft(status, 'cleanup DELETE status').toBe(204);
            } else {
              expect.soft([204, 404].includes(status), 'cleanup DELETE status').toBe(true);
            }
          } catch {
            expect.soft(false, 'cleanup DELETE request failed').toBe(true);
          }
        }
      }
    });

    test('POST /users rejects invalid age 0 with 400', {
      tag: ['@contract', '@validation'],
      annotation: [
        { type: 'contract', description: 'POST /users age integer validation [1, 150].' },
        { type: 'note', description: 'Age boundary: rejects invalid value 0 with 400.' },
      ],
    }, async ({ request }) => {
      const email = `age-post-0-${randomUUID()}@example.com`;
      const name = 'Under Age User';
      const age = 0;

      let creationAttempted = false;
      let creationConfirmed = false;

      try {
        creationAttempted = true;
        const res = await request.post('users', {
          data: { name, email, age },
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
            if (creationConfirmed) {
              expect.soft(status, 'cleanup DELETE status').toBe(204);
            } else {
              expect.soft([204, 404].includes(status), 'cleanup DELETE status').toBe(true);
            }
          } catch {
            expect.soft(false, 'cleanup DELETE request failed').toBe(true);
          }
        }
      }
    });

    test('POST /users rejects invalid age 151 with 400', {
      tag: ['@contract', '@validation'],
      annotation: [
        { type: 'contract', description: 'POST /users age integer validation [1, 150].' },
        { type: 'note', description: 'Age boundary: rejects invalid value 151 with 400.' },
      ],
    }, async ({ request }) => {
      const email = `age-post-151-${randomUUID()}@example.com`;
      const name = 'Over Age User';
      const age = 151;

      let creationAttempted = false;
      let creationConfirmed = false;

      try {
        creationAttempted = true;
        const res = await request.post('users', {
          data: { name, email, age },
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
            if (creationConfirmed) {
              expect.soft(status, 'cleanup DELETE status').toBe(204);
            } else {
              expect.soft([204, 404].includes(status), 'cleanup DELETE status').toBe(true);
            }
          } catch {
            expect.soft(false, 'cleanup DELETE request failed').toBe(true);
          }
        }
      }
    });
  });

  test.describe('PUT /users/{email} Age Boundaries', () => {
    test('PUT /users/{email} accepts valid minimum age 1', {
      tag: ['@contract', '@validation'],
      annotation: [
        { type: 'contract', description: 'PUT /users/{email} age integer validation [1, 150].' },
        { type: 'note', description: 'Age boundary: minimum valid value 1.' },
      ],
    }, async ({ request }) => {
      const email = `age-put-1-${randomUUID()}@example.com`;
      const setupName = 'Setup User';
      const setupAge = 30;
      const putName = 'Min Age PUT User';
      const putAge = 1;

      let setupAttempted = false;
      let setupConfirmed = false;

      try {
        setupAttempted = true;
        const setupRes = await request.post('users', {
          data: { name: setupName, email, age: setupAge },
        });

        expect(setupRes.status()).toBe(201);
        setupConfirmed = true;

        const putRes = await request.put(`users/${encodeURIComponent(email)}`, {
          data: { name: putName, email, age: putAge },
        });

        expect(putRes.status()).toBe(200);
        expect(putRes.headers()['content-type']).toMatch(/^application\/json\b/i);

        const body = await putRes.json();
        const valid = validateUser(body);
        const errors = validateUser.errors;
        expect(valid, JSON.stringify(errors, null, 2)).toBe(true);

        expect(body.name).toBe(putName);
        expect(body.email).toBe(email);
        expect(body.age).toBe(putAge);
      } finally {
        if (setupAttempted) {
          try {
            const deleteRes = await request.delete(`users/${encodeURIComponent(email)}`, {
              headers: authenticationHeaders(),
            });
            const status = deleteRes.status();
            if (setupConfirmed) {
              expect.soft(status, 'cleanup DELETE status').toBe(204);
            } else {
              expect.soft([204, 404].includes(status), 'cleanup DELETE status').toBe(true);
            }
          } catch {
            expect.soft(false, 'cleanup DELETE request failed').toBe(true);
          }
        }
      }
    });

    test('PUT /users/{email} accepts valid maximum age 150', {
      tag: ['@contract', '@validation'],
      annotation: [
        { type: 'contract', description: 'PUT /users/{email} age integer validation [1, 150].' },
        { type: 'note', description: 'Age boundary: maximum valid value 150.' },
      ],
    }, async ({ request }) => {
      const email = `age-put-150-${randomUUID()}@example.com`;
      const setupName = 'Setup User';
      const setupAge = 30;
      const putName = 'Max Age PUT User';
      const putAge = 150;

      let setupAttempted = false;
      let setupConfirmed = false;

      try {
        setupAttempted = true;
        const setupRes = await request.post('users', {
          data: { name: setupName, email, age: setupAge },
        });

        expect(setupRes.status()).toBe(201);
        setupConfirmed = true;

        const putRes = await request.put(`users/${encodeURIComponent(email)}`, {
          data: { name: putName, email, age: putAge },
        });

        expect(putRes.status()).toBe(200);
        expect(putRes.headers()['content-type']).toMatch(/^application\/json\b/i);

        const body = await putRes.json();
        const valid = validateUser(body);
        const errors = validateUser.errors;
        expect(valid, JSON.stringify(errors, null, 2)).toBe(true);

        expect(body.name).toBe(putName);
        expect(body.email).toBe(email);
        expect(body.age).toBe(putAge);
      } finally {
        if (setupAttempted) {
          try {
            const deleteRes = await request.delete(`users/${encodeURIComponent(email)}`, {
              headers: authenticationHeaders(),
            });
            const status = deleteRes.status();
            if (setupConfirmed) {
              expect.soft(status, 'cleanup DELETE status').toBe(204);
            } else {
              expect.soft([204, 404].includes(status), 'cleanup DELETE status').toBe(true);
            }
          } catch {
            expect.soft(false, 'cleanup DELETE request failed').toBe(true);
          }
        }
      }
    });

    test('PUT /users/{email} rejects invalid age 0 with 400', {
      tag: ['@contract', '@validation'],
      annotation: [
        { type: 'contract', description: 'PUT /users/{email} age integer validation [1, 150].' },
        { type: 'note', description: 'Age boundary: rejects invalid value 0 with 400.' },
      ],
    }, async ({ request }) => {
      const email = `age-put-0-${randomUUID()}@example.com`;
      const setupName = 'Setup User';
      const setupAge = 30;
      const putName = 'Under Age PUT User';
      const putAge = 0;

      let setupAttempted = false;
      let setupConfirmed = false;

      try {
        setupAttempted = true;
        const setupRes = await request.post('users', {
          data: { name: setupName, email, age: setupAge },
        });

        expect(setupRes.status()).toBe(201);
        setupConfirmed = true;

        const putRes = await request.put(`users/${encodeURIComponent(email)}`, {
          data: { name: putName, email, age: putAge },
        });

        expect(putRes.status()).toBe(400);
        expect(putRes.headers()['content-type']).toMatch(/^application\/json\b/i);

        const body = await putRes.json();
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
            if (setupConfirmed) {
              expect.soft(status, 'cleanup DELETE status').toBe(204);
            } else {
              expect.soft([204, 404].includes(status), 'cleanup DELETE status').toBe(true);
            }
          } catch {
            expect.soft(false, 'cleanup DELETE request failed').toBe(true);
          }
        }
      }
    });

    test('PUT /users/{email} rejects invalid age 151 with 400', {
      tag: ['@contract', '@validation'],
      annotation: [
        { type: 'contract', description: 'PUT /users/{email} age integer validation [1, 150].' },
        { type: 'note', description: 'Age boundary: rejects invalid value 151 with 400.' },
      ],
    }, async ({ request }) => {
      const email = `age-put-151-${randomUUID()}@example.com`;
      const setupName = 'Setup User';
      const setupAge = 30;
      const putName = 'Over Age PUT User';
      const putAge = 151;

      let setupAttempted = false;
      let setupConfirmed = false;

      try {
        setupAttempted = true;
        const setupRes = await request.post('users', {
          data: { name: setupName, email, age: setupAge },
        });

        expect(setupRes.status()).toBe(201);
        setupConfirmed = true;

        const putRes = await request.put(`users/${encodeURIComponent(email)}`, {
          data: { name: putName, email, age: putAge },
        });

        expect(putRes.status()).toBe(400);
        expect(putRes.headers()['content-type']).toMatch(/^application\/json\b/i);

        const body = await putRes.json();
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
            if (setupConfirmed) {
              expect.soft(status, 'cleanup DELETE status').toBe(204);
            } else {
              expect.soft([204, 404].includes(status), 'cleanup DELETE status').toBe(true);
            }
          } catch {
            expect.soft(false, 'cleanup DELETE request failed').toBe(true);
          }
        }
      }
    });
  });
});
