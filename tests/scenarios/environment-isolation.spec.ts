import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { validateUser, validateUserArray } from '../helpers/user-validator';
import { authenticationHeaders } from '../helpers/auth';

test.describe('Dual-Environment Cross-Namespace Isolation', () => {

  test('SDET-ISO-01: Deleting user in dev does not delete or mutate same-email user in prod', {
    tag: ['@contract', '@isolation'],
    annotation: [
      { type: 'contract', description: 'Dual-environment cross-namespace state isolation: DELETE /dev/users/{email}.' },
      { type: 'note', description: 'Cross-namespace forward isolation: dev deletion preserves prod state; collection list deletion oracle avoids BUG-002.' },
    ],
  }, async ({ request }) => {
    const email = `iso-${randomUUID()}@example.com`;
    const devName = 'Dev Isolation User';
    const devAge = 25;
    const prodName = 'Prod Isolation User';
    const prodAge = 45;

    let devAttempted = false;
    let createdInDev = false;
    let prodAttempted = false;
    let createdInProd = false;
    let devDeletedInMain = false;

    try {
      await test.step('Create same-email users in dev and prod', async () => {
        devAttempted = true;
        const devPost = await request.post('/dev/users', {
          data: { name: devName, email, age: devAge },
        });
        expect(devPost.status()).toBe(201);
        createdInDev = true;

        expect(devPost.headers()['content-type']).toMatch(/^application\/json\b/i);
        const devPostJson = await devPost.json();
        const devPostValid = validateUser(devPostJson);
        const devPostErrors = validateUser.errors;
        expect(devPostValid, JSON.stringify(devPostErrors, null, 2)).toBe(true);
        expect(devPostJson.name).toBe(devName);
        expect(devPostJson.email).toBe(email);
        expect(devPostJson.age).toBe(devAge);

        prodAttempted = true;
        const prodPost = await request.post('/prod/users', {
          data: { name: prodName, email, age: prodAge },
        });
        expect(prodPost.status()).toBe(201);
        createdInProd = true;

        expect(prodPost.headers()['content-type']).toMatch(/^application\/json\b/i);
        const prodPostJson = await prodPost.json();
        const prodPostValid = validateUser(prodPostJson);
        const prodPostErrors = validateUser.errors;
        expect(prodPostValid, JSON.stringify(prodPostErrors, null, 2)).toBe(true);
        expect(prodPostJson.name).toBe(prodName);
        expect(prodPostJson.email).toBe(email);
        expect(prodPostJson.age).toBe(prodAge);
      });

      await test.step('Verify initial state in both namespaces', async () => {
        const devGet = await request.get(`/dev/users/${encodeURIComponent(email)}`);
        expect(devGet.status()).toBe(200);
        const devGetJson = await devGet.json();
        const devGetValid = validateUser(devGetJson);
        const devGetErrors = validateUser.errors;
        expect(devGetValid, JSON.stringify(devGetErrors, null, 2)).toBe(true);
        expect(devGetJson.name).toBe(devName);
        expect(devGetJson.email).toBe(email);
        expect(devGetJson.age).toBe(devAge);

        const prodGet = await request.get(`/prod/users/${encodeURIComponent(email)}`);
        expect(prodGet.status()).toBe(200);
        const prodGetJson = await prodGet.json();
        const prodGetValid = validateUser(prodGetJson);
        const prodGetErrors = validateUser.errors;
        expect(prodGetValid, JSON.stringify(prodGetErrors, null, 2)).toBe(true);
        expect(prodGetJson.name).toBe(prodName);
        expect(prodGetJson.email).toBe(email);
        expect(prodGetJson.age).toBe(prodAge);
      });

      await test.step('Delete the dev user', async () => {
        const devDelete = await request.delete(`/dev/users/${encodeURIComponent(email)}`, {
          headers: authenticationHeaders(),
        });
        expect(devDelete.status()).toBe(204);
        devDeletedInMain = true;
      });

      await test.step('Verify prod user remains intact', async () => {
        const prodReadback = await request.get(`/prod/users/${encodeURIComponent(email)}`);
        expect(prodReadback.status()).toBe(200);
        expect(prodReadback.headers()['content-type']).toMatch(/^application\/json\b/i);
        const prodReadbackJson = await prodReadback.json();
        const prodReadbackValid = validateUser(prodReadbackJson);
        const prodReadbackErrors = validateUser.errors;
        expect(prodReadbackValid, JSON.stringify(prodReadbackErrors, null, 2)).toBe(true);
        expect(prodReadbackJson.name).toBe(prodName);
        expect(prodReadbackJson.email).toBe(email);
        expect(prodReadbackJson.age).toBe(prodAge);
      });

      await test.step('Verify dev collection no longer contains the user', async () => {
        // Use the collection endpoint because deleted-user GET returns 500 (BUG-002).
        const devListRes = await request.get('/dev/users');
        expect(devListRes.status()).toBe(200);
        expect(devListRes.headers()['content-type']).toMatch(/^application\/json\b/i);
        const devListJson = await devListRes.json();
        const devListValid = validateUserArray(devListJson);
        const devListErrors = validateUserArray.errors;
        expect(devListValid, JSON.stringify(devListErrors, null, 2)).toBe(true);
        const devListEmails = (devListJson as Array<{ email: string }>).map((u) => u.email);
        expect(devListEmails).not.toContain(email);
      });

    } finally {
      // Clean up dev only if the main delete did not succeed.
      if (devAttempted && !devDeletedInMain) {
        try {
          const devCleanupRes = await request.delete(`/dev/users/${encodeURIComponent(email)}`, {
            headers: authenticationHeaders(),
          });
          const expectedStatuses = createdInDev ? [204] : [204, 404];
          expect.soft(
            expectedStatuses.includes(devCleanupRes.status()),
            `Dev cleanup returned status ${devCleanupRes.status()}, expected [${expectedStatuses.join(', ')}]`
          ).toBe(true);
        } catch {
          expect.soft(false, 'Dev cleanup request failed').toBe(true);
        }
      }

      // Clean up prod after its POST attempt.
      if (prodAttempted) {
        try {
          const prodCleanupRes = await request.delete(`/prod/users/${encodeURIComponent(email)}`, {
            headers: authenticationHeaders(),
          });
          const expectedStatuses = createdInProd ? [204] : [204, 404];
          expect.soft(
            expectedStatuses.includes(prodCleanupRes.status()),
            `Prod cleanup returned status ${prodCleanupRes.status()}, expected [${expectedStatuses.join(', ')}]`
          ).toBe(true);
        } catch {
          expect.soft(false, 'Prod cleanup request failed').toBe(true);
        }
      }
    }
  });

  test('SDET-ISO-02: Deleting user in prod does not delete or mutate same-email user in dev', {
    tag: ['@contract', '@isolation'],
    annotation: [
      { type: 'contract', description: 'Dual-environment cross-namespace state isolation: DELETE /prod/users/{email}.' },
      { type: 'note', description: 'Cross-namespace reverse isolation: prod deletion preserves dev state; collection list deletion oracle avoids BUG-002.' },
    ],
  }, async ({ request }) => {
    const email = `iso-prod-del-${randomUUID()}@example.com`;
    const devName = 'Dev Reverse Isolation User';
    const devAge = 26;
    const prodName = 'Prod Reverse Isolation User';
    const prodAge = 46;

    let devAttempted = false;
    let createdInDev = false;
    let prodAttempted = false;
    let createdInProd = false;
    let prodDeletedInMain = false;

    try {
      await test.step('Create same-email users in dev and prod', async () => {
        devAttempted = true;
        const devPost = await request.post('/dev/users', {
          data: { name: devName, email, age: devAge },
        });
        if (devPost.status() === 201) {
          createdInDev = true;
        }

        expect(devPost.status()).toBe(201);
        expect(devPost.headers()['content-type']).toMatch(/^application\/json\b/i);
        const devPostJson = await devPost.json();
        const devPostValid = validateUser(devPostJson);
        const devPostErrors = validateUser.errors;
        expect(devPostValid, JSON.stringify(devPostErrors, null, 2)).toBe(true);
        expect(devPostJson.name).toBe(devName);
        expect(devPostJson.email).toBe(email);
        expect(devPostJson.age).toBe(devAge);

        prodAttempted = true;
        const prodPost = await request.post('/prod/users', {
          data: { name: prodName, email, age: prodAge },
        });
        if (prodPost.status() === 201) {
          createdInProd = true;
        }

        expect(prodPost.status()).toBe(201);
        expect(prodPost.headers()['content-type']).toMatch(/^application\/json\b/i);
        const prodPostJson = await prodPost.json();
        const prodPostValid = validateUser(prodPostJson);
        const prodPostErrors = validateUser.errors;
        expect(prodPostValid, JSON.stringify(prodPostErrors, null, 2)).toBe(true);
        expect(prodPostJson.name).toBe(prodName);
        expect(prodPostJson.email).toBe(email);
        expect(prodPostJson.age).toBe(prodAge);
      });

      await test.step('Verify initial state in both namespaces', async () => {
        const devGet = await request.get(`/dev/users/${encodeURIComponent(email)}`);
        expect(devGet.status()).toBe(200);
        expect(devGet.headers()['content-type']).toMatch(/^application\/json\b/i);
        const devGetJson = await devGet.json();
        const devGetValid = validateUser(devGetJson);
        const devGetErrors = validateUser.errors;
        expect(devGetValid, JSON.stringify(devGetErrors, null, 2)).toBe(true);
        expect(devGetJson.name).toBe(devName);
        expect(devGetJson.email).toBe(email);
        expect(devGetJson.age).toBe(devAge);

        const prodGet = await request.get(`/prod/users/${encodeURIComponent(email)}`);
        expect(prodGet.status()).toBe(200);
        expect(prodGet.headers()['content-type']).toMatch(/^application\/json\b/i);
        const prodGetJson = await prodGet.json();
        const prodGetValid = validateUser(prodGetJson);
        const prodGetErrors = validateUser.errors;
        expect(prodGetValid, JSON.stringify(prodGetErrors, null, 2)).toBe(true);
        expect(prodGetJson.name).toBe(prodName);
        expect(prodGetJson.email).toBe(email);
        expect(prodGetJson.age).toBe(prodAge);
      });

      await test.step('Delete the prod user', async () => {
        const prodDelete = await request.delete(`/prod/users/${encodeURIComponent(email)}`, {
          headers: authenticationHeaders(),
        });
        if (prodDelete.status() === 204) {
          prodDeletedInMain = true;
        }

        expect(prodDelete.status()).toBe(204);
      });

      await test.step('Verify prod collection no longer contains the user', async () => {
        // Use the collection endpoint because deleted-user GET returns 500 (BUG-002).
        const prodListRes = await request.get('/prod/users');
        expect(prodListRes.status()).toBe(200);
        expect(prodListRes.headers()['content-type']).toMatch(/^application\/json\b/i);
        const prodListJson = await prodListRes.json();
        const prodListValid = validateUserArray(prodListJson);
        const prodListErrors = validateUserArray.errors;
        expect(prodListValid, JSON.stringify(prodListErrors, null, 2)).toBe(true);
        const prodListEmails = (prodListJson as Array<{ email: string }>).map((u) => u.email);
        expect(prodListEmails).not.toContain(email);
      });

      await test.step('Verify dev user remains intact', async () => {
        const devReadback = await request.get(`/dev/users/${encodeURIComponent(email)}`);
        expect(devReadback.status()).toBe(200);
        expect(devReadback.headers()['content-type']).toMatch(/^application\/json\b/i);
        const devReadbackJson = await devReadback.json();
        const devReadbackValid = validateUser(devReadbackJson);
        const devReadbackErrors = validateUser.errors;
        expect(devReadbackValid, JSON.stringify(devReadbackErrors, null, 2)).toBe(true);
        expect(devReadbackJson.name).toBe(devName);
        expect(devReadbackJson.email).toBe(email);
        expect(devReadbackJson.age).toBe(devAge);
      });
    } finally {
      // Clean up dev after its POST attempt.
      if (devAttempted) {
        try {
          const devCleanupRes = await request.delete(`/dev/users/${encodeURIComponent(email)}`, {
            headers: authenticationHeaders(),
          });
          expect.soft([204, 404], `Dev cleanup returned status ${devCleanupRes.status()}`).toContain(devCleanupRes.status());
        } catch {
          expect.soft(false, 'Dev cleanup request failed').toBe(true);
        }
      }

      // Clean up prod only if the main delete did not succeed.
      if (prodAttempted && !prodDeletedInMain) {
        try {
          const prodCleanupRes = await request.delete(`/prod/users/${encodeURIComponent(email)}`, {
            headers: authenticationHeaders(),
          });
          expect.soft([204, 404], `Prod cleanup returned status ${prodCleanupRes.status()}`).toContain(prodCleanupRes.status());
        } catch {
          expect.soft(false, 'Prod cleanup request failed').toBe(true);
        }
      }
    }
  });

});
