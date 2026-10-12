# Known API Contract Discrepancies

This report records five confirmed, externally observable discrepancies between the running User Management API container and its authoritative OpenAPI contract (`sdet_challenge_api.yml`).

---

## Shared reproduction baseline

Reproduction commands assume an active local container instance matching the challenge specification:

- **Base URL:** `http://localhost:3000`
- **Image:** `ghcr.io/danielsilva-loanpro/sdet-interview-challenge:latest`
- **Verified digest:** `sha256:c80c42ffafccb6ba9cd9a128421445d308225f09902c03aeadbc99e321176bbc`
- **Namespaces:** `dev` and `prod` (e.g., `${BASE_URL}/dev/users` and `${BASE_URL}/prod/users`)
- **Published challenge auth fixture:** `mysecrettoken`
- **UUID-safe setup:**
  ```bash
  export BASE_URL=http://localhost:3000
  export AUTH_TOKEN=mysecrettoken
  export RUN_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
  export ENV=dev  # Repeat each applicable sequence with ENV=prod.
  ```
- **Curl standard:** Commands use `curl -i -sS` with explicit JSON payloads where required. Status lines and JSON bodies provide the primary evidence; transient `Date`, `Server`, and `Connection` headers are omitted from observed outputs.
- **Impact scale:**
  - **High:** Security control bypass, inconsistent resource state, or unexpected HTTP 500 error preventing normal client recovery.
  - **Medium:** Validation omission that permits invalid data without a server crash or security bypass.

---

## Finding summary

| Bug ID | Observable discrepancy | Environments | Operation | Impact | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| BUG-001 | PUT response shows updates but later GET returns original fields | dev, prod | `PUT /users/{email}` | High | Confirmed |
| BUG-002 | GET for a non-existent user returns 500 instead of 404 | dev, prod | `GET /users/{email}` | High | Confirmed |
| BUG-003 | Duplicate POST returns 500 instead of 409 | dev, prod | `POST /users` | High | Confirmed |
| BUG-004 | DELETE accepts missing or invalid Authentication in dev | dev only; prod conforms | `DELETE /users/{email}` | High | Confirmed |
| BUG-005 | Invalid email POST succeeds and persists the record | dev, prod | `POST /users` | Medium | Confirmed |

---

## BUG-001 — PUT response shows updates but subsequent GET returns original values

| Field | Value |
| :--- | :--- |
| Status | Confirmed |
| Affected environments | `dev`, `prod` |
| Impact | High — successful HTTP 200 update representation is not reflected in subsequent reads, presenting an inconsistent resource state to clients |
| Automated regression | `tests/scenarios/put-contract.spec.ts`<br>`tests/scenarios/put-email-update.spec.ts` (R23) |
| Tags | `@contract`, `@bug-001`, `@rule-r23` |

### Contract reference
- **Method & path:** `PUT /users/{email}` (`operationId: updateUser`)
- **Readback operation:** `GET /users/{email}` (`operationId: getUser`)
- **Schemas:** `UpdateUserRequest` (request), `User` (response)
- **Expected behavior:** `PUT /users/{email}` returns HTTP 200 with `application/json` conforming to `User`. Subsequent `GET /users/{email}` requests must return the updated property values.

### Preconditions
A user resource exists at target email `bug-001-${RUN_ID}@example.com` with initial values (`Original Name`, age 30).

### Steps to reproduce

1. **Create initial user:**
   ```bash
   curl -i -sS -X POST "${BASE_URL}/${ENV}/users" \
     -H "Content-Type: application/json" \
     -d "{\"name\":\"Original Name\",\"email\":\"bug-001-${RUN_ID}@example.com\",\"age\":30}"
   ```

2. **Send PUT update request:**
   ```bash
   curl -i -sS -X PUT "${BASE_URL}/${ENV}/users/bug-001-${RUN_ID}@example.com" \
     -H "Content-Type: application/json" \
     -d "{\"name\":\"Updated Name\",\"email\":\"bug-001-${RUN_ID}@example.com\",\"age\":35}"
   ```
   *Observed response:*
   ```http
   HTTP/1.1 200 OK
   Content-Type: application/json

   {
     "age": 35,
     "email": "bug-001-...@example.com",
     "name": "Updated Name"
   }
   ```

3. **Read back user via GET:**
   ```bash
   curl -i -sS "${BASE_URL}/${ENV}/users/bug-001-${RUN_ID}@example.com"
   ```
   *Observed response:*
   ```http
   HTTP/1.1 200 OK
   Content-Type: application/json

   {
     "age": 30,
     "email": "bug-001-...@example.com",
     "name": "Original Name"
   }
   ```

4. **Authenticated cleanup:**
   ```bash
   curl -i -sS -X DELETE "${BASE_URL}/${ENV}/users/bug-001-${RUN_ID}@example.com" \
     -H "Authentication: ${AUTH_TOKEN}"
   ```

### Field comparison

| Field | Initial state | PUT request payload | PUT response payload | Subsequent GET readback |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `"Original Name"` | `"Updated Name"` | `"Updated Name"` | `"Original Name"` |
| `age` | `30` | `35` | `35` | `30` |
| `email` | `bug-001-${RUN_ID}@example.com` | `bug-001-${RUN_ID}@example.com` | `bug-001-${RUN_ID}@example.com` | `bug-001-${RUN_ID}@example.com` |

### Expected result
Following a successful `PUT /users/{email}` returning HTTP 200, subsequent `GET /users/{email}` requests return the updated property values (`name: "Updated Name"`, `age: 35`).

### Actual result
`PUT /users/{email}` returns HTTP 200 with updated fields in the response body, but the subsequent GET returned the original values (`name: "Original Name"`, `age: 30`).

### Automated evidence
- `tests/scenarios/put-contract.spec.ts` — `PUT update persists and is readable via GET` (`@bug-001`)
- `tests/scenarios/put-email-update.spec.ts` — `PUT update to a new unused email is readable via the new email` (`@bug-001`, `@rule-r23`)
- **Runtime verification:** `dev` exited with code 1 (0 passed, 2 failed); `prod` exited with code 1 (0 passed, 2 failed).

---

## BUG-002 — GET for a non-existent user returns 500 instead of 404

| Field | Value |
| :--- | :--- |
| Status | Confirmed |
| Affected environments | `dev`, `prod` |
| Impact | High — unexpected HTTP 500 server error prevents clients from distinguishing missing resources through standard HTTP 404 handling |
| Automated regression | `tests/user-contract-rules.spec.ts` (R08)<br>`tests/scenarios/delete-contract.spec.ts`<br>`tests/scenarios/put-email-update.spec.ts` (R23) |
| Tags | `@contract`, `@rule-r08`, `@bug-002`, `@rule-r23` |

### Contract reference
- **Method & path:** `GET /users/{email}` (`operationId: getUser`)
- **Schema:** `ErrorResponse` (`error: string`)
- **Expected behavior:** When a user does not exist, the server must return HTTP 404 Not Found with `Content-Type: application/json` matching `ErrorResponse`.

### Preconditions
The defect manifests under two distinct non-existent resource conditions:
1. Target email was never created in the environment.
2. Target email belonged to a user successfully deleted via `DELETE /users/{email}` (HTTP 204).

### Steps to reproduce

#### Case A: Never-created email address
```bash
curl -i -sS "${BASE_URL}/${ENV}/users/never-created-${RUN_ID}@example.com"
```
*Observed response:*
```http
HTTP/1.1 500 INTERNAL SERVER ERROR
Content-Type: application/json

{
  "error": "Internal server error"
}
```

#### Case B: Deleted user readback
1. **Create user:**
   ```bash
   curl -i -sS -X POST "${BASE_URL}/${ENV}/users" \
     -H "Content-Type: application/json" \
     -d "{\"name\":\"Delete User\",\"email\":\"bug-002-${RUN_ID}@example.com\",\"age\":40}"
   ```

2. **Delete user with authentication:**
   ```bash
   curl -i -sS -X DELETE "${BASE_URL}/${ENV}/users/bug-002-${RUN_ID}@example.com" \
     -H "Authentication: ${AUTH_TOKEN}"
   ```

3. **Read back deleted user via GET:**
   ```bash
   curl -i -sS "${BASE_URL}/${ENV}/users/bug-002-${RUN_ID}@example.com"
   ```
   *Observed response:*
   ```http
   HTTP/1.1 500 INTERNAL SERVER ERROR
   Content-Type: application/json

   {
     "error": "Internal server error"
   }
   ```

### Expected result
`GET /users/{email}` returns HTTP 404 Not Found with an `ErrorResponse`-conformant JSON body (`{"error": "<string>"}`).

### Actual result
`GET /users/{email}` returns HTTP 500 Internal Server Error with body `{"error":"Internal server error"}` for both never-created and deleted user identifiers.

### Automated evidence
- `tests/user-contract-rules.spec.ts` — `R08: GET /users/{email} returns 404 for non-existent user` (`@bug-002`, `@rule-r08`)
- `tests/scenarios/delete-contract.spec.ts` — `DELETE a user makes subsequent GET return 404` (`@bug-002`)
- `tests/scenarios/put-email-update.spec.ts` — `PUT update to a new unused email is readable via the new email` (`@bug-002`, `@rule-r23`)
- **Runtime verification:** `dev` exited with code 1 (0 passed, 3 failed); `prod` exited with code 1 (0 passed, 3 failed).

---

## BUG-003 — Duplicate POST returns 500 instead of 409

| Field | Value |
| :--- | :--- |
| Status | Confirmed |
| Affected environments | `dev`, `prod` |
| Impact | High — unexpected HTTP 500 server error on duplicate entity submission obscures client collision detection |
| Automated regression | `tests/user-contract-rules.spec.ts` (R06) |
| Tags | `@contract`, `@rule-r06`, `@bug-003` |

### Contract reference
- **Method & path:** `POST /users` (`operationId: createUser`)
- **Schemas:** `CreateUserRequest` (request), `ErrorResponse` (conflict response)
- **Expected behavior:** When a user with the specified email already exists, the server must return HTTP 409 Conflict with `Content-Type: application/json` matching `ErrorResponse`.

### Preconditions
A user with email `bug-003-${RUN_ID}@example.com` has already been created.

### Steps to reproduce

1. **Create initial user:**
   ```bash
   curl -i -sS -X POST "${BASE_URL}/${ENV}/users" \
     -H "Content-Type: application/json" \
     -d "{\"name\":\"Initial User\",\"email\":\"bug-003-${RUN_ID}@example.com\",\"age\":25}"
   ```

2. **Submit duplicate POST with identical email:**
   ```bash
   curl -i -sS -X POST "${BASE_URL}/${ENV}/users" \
     -H "Content-Type: application/json" \
     -d "{\"name\":\"Duplicate User\",\"email\":\"bug-003-${RUN_ID}@example.com\",\"age\":26}"
   ```
   *Observed response:*
   ```http
   HTTP/1.1 500 INTERNAL SERVER ERROR
   Content-Type: application/json

   {
     "error": "Internal server error"
   }
   ```

3. **Authenticated cleanup:**
   ```bash
   curl -i -sS -X DELETE "${BASE_URL}/${ENV}/users/bug-003-${RUN_ID}@example.com" \
     -H "Authentication: ${AUTH_TOKEN}"
   ```

### Expected result
Attempting to create a user with an email that already exists returns HTTP 409 Conflict with an `ErrorResponse`-conformant JSON body.

### Actual result
The server returns HTTP 500 Internal Server Error with body `{"error":"Internal server error"}` instead of HTTP 409 Conflict.

### Automated evidence
- `tests/user-contract-rules.spec.ts` — `R06: POST /users returns 409 when creating user with duplicate email` (`@bug-003`, `@rule-r06`)
- **Runtime verification:** `dev` exited with code 1 (0 passed, 1 failed); `prod` exited with code 1 (0 passed, 1 failed).

---

## BUG-004 — DELETE accepts missing or invalid Authentication in dev

| Field | Value |
| :--- | :--- |
| Status | Confirmed |
| Affected environments | `dev` only (`prod` conforms to contract) |
| Impact | High — security control bypass in `dev` allows unauthenticated clients to delete user records; represents an environment divergence defect |
| Automated regression | `tests/user-contract-rules.spec.ts` (R16, R17) |
| Tags | `@contract`, `@rule-r16`, `@rule-r17`, `@bug-004` |

### Contract reference
- **Method & path:** `DELETE /users/{email}` (`operationId: deleteUser`)
- **Header parameter:** `Authentication` (`required: true`, `type: string`)
- **Schemas:** `ErrorResponse` (unauthorized response)
- **Expected behavior:** In all environments, omitting `Authentication` or providing an invalid token must return HTTP 401 Unauthorized with `ErrorResponse`, and preserve the resource.

### Preconditions
A user resource exists at target email `bug-004-missing-${RUN_ID}@example.com` or `bug-004-invalid-${RUN_ID}@example.com`.

### Steps to reproduce

#### Scenario 1: Missing Authentication header (R16)
1. **Create user in dev:**
   ```bash
   curl -i -sS -X POST "${BASE_URL}/dev/users" \
     -H "Content-Type: application/json" \
     -d "{\"name\":\"Auth User\",\"email\":\"bug-004-missing-${RUN_ID}@example.com\",\"age\":28}"
   ```

2. **Send DELETE without Authentication header:**
   ```bash
   curl -i -sS -X DELETE "${BASE_URL}/dev/users/bug-004-missing-${RUN_ID}@example.com"
   ```
   *Observed response in `dev`:*
   ```http
   HTTP/1.1 204 NO CONTENT
   ```

3. **Verify collection state in dev:**
   ```bash
   curl -i -sS "${BASE_URL}/dev/users"
   ```
   *Observed result: `bug-004-missing-${RUN_ID}@example.com` is absent from the array, confirming deletion occurred without credentials.*

#### Scenario 2: Invalid Authentication token (R17)
1. **Create user in dev:**
   ```bash
   curl -i -sS -X POST "${BASE_URL}/dev/users" \
     -H "Content-Type: application/json" \
     -d "{\"name\":\"Auth User\",\"email\":\"bug-004-invalid-${RUN_ID}@example.com\",\"age\":28}"
   ```

2. **Send DELETE with invalid token:**
   ```bash
   curl -i -sS -X DELETE "${BASE_URL}/dev/users/bug-004-invalid-${RUN_ID}@example.com" \
     -H "Authentication: wrong_secret_token_123"
   ```
   *Observed response in `dev`:*
   ```http
   HTTP/1.1 204 NO CONTENT
   ```

3. **Verify collection state in dev:**
   ```bash
   curl -i -sS "${BASE_URL}/dev/users"
   ```
   *Observed result: `bug-004-invalid-${RUN_ID}@example.com` is absent from the array, confirming deletion occurred with an invalid token.*

### Environment comparison

| Request condition | `dev` namespace result | `prod` namespace result | Contract expectation |
| :--- | :--- | :--- | :--- |
| **Missing Authentication header (R16)** | **HTTP 204 No Content** (resource deleted) | **HTTP 401 Unauthorized** (resource preserved) | HTTP 401 Unauthorized |
| **Invalid Authentication token (R17)** | **HTTP 204 No Content** (resource deleted) | **HTTP 401 Unauthorized** (resource preserved) | HTTP 401 Unauthorized |

### Expected result
`DELETE /users/{email}` requires a valid `Authentication` header in both environments. Requests omitting the header (R16) or providing an invalid token (R17) must return HTTP 401 Unauthorized with `ErrorResponse` and preserve the user in the collection.

### Actual result
This is a dev-only security and contract discrepancy:
- **In `dev`:** Requests without `Authentication` or with an invalid token return HTTP 204 No Content and delete the target user from the collection.
- **In `prod`:** Requests are properly rejected with HTTP 401 Unauthorized, and the user is preserved in the collection.

### Automated evidence
- `tests/user-contract-rules.spec.ts` — `R16: DELETE /users/{email} returns 401 when Authentication header is missing` (`@bug-004`, `@rule-r16`)
- `tests/user-contract-rules.spec.ts` — `R17: DELETE /users/{email} returns 401 when Authentication token is invalid` (`@bug-004`, `@rule-r17`)
- **Runtime verification:**
  - `dev` exited with code 1 (0 passed, 2 failed);
  - `prod` exited with code 0 (2 passed, 0 failed), confirming the dev-only divergence.

---

## BUG-005 — Invalid email POST succeeds and persists the record

| Field | Value |
| :--- | :--- |
| Status | Confirmed |
| Affected environments | `dev`, `prod` |
| Impact | Medium — omission of email syntax validation permits data that violates the published `format: email` constraint |
| Automated regression | `tests/user-contract-rules.spec.ts` (R07) |
| Tags | `@contract`, `@rule-r07`, `@bug-005` |

### Contract reference
- **Method & path:** `POST /users` (`operationId: createUser`)
- **Schemas:** `CreateUserRequest` (`email` specifies `type: string`, `format: email`), `ErrorResponse` (validation error)
- **Expected behavior:** Submitting an email string that violates standard email syntax must return HTTP 400 Bad Request with `Content-Type: application/json` matching `ErrorResponse`.

### Preconditions
None.

### Steps to reproduce

1. **Send POST with malformed email format:**
   ```bash
   curl -i -sS -X POST "${BASE_URL}/${ENV}/users" \
     -H "Content-Type: application/json" \
     -d "{\"name\":\"Invalid Email User\",\"email\":\"not-a-valid-email-${RUN_ID}\",\"age\":30}"
   ```
   *Observed response:*
   ```http
   HTTP/1.1 201 CREATED
   Content-Type: application/json

   {
     "age": 30,
     "email": "not-a-valid-email-...",
     "name": "Invalid Email User"
   }
   ```

2. **Read back collection via GET:**
   ```bash
   curl -i -sS "${BASE_URL}/${ENV}/users"
   ```
   *Observed result: The returned JSON array contains the created user object with property `"email":"not-a-valid-email-..."`, confirming the malformed identifier is in the collection.*

3. **Authenticated cleanup:**
   ```bash
   curl -i -sS -X DELETE "${BASE_URL}/${ENV}/users/not-a-valid-email-${RUN_ID}" \
     -H "Authentication: ${AUTH_TOKEN}"
   ```

### Expected result
`POST /users` rejects malformed email strings with HTTP 400 Bad Request and an `ErrorResponse`-conformant JSON body.

### Actual result
The server returns HTTP 201 Created and persists the user record with the invalid email string, which is then returned in collection listings (`GET /users`).

### Automated evidence
- `tests/user-contract-rules.spec.ts` — `R07: POST /users returns 400 when email format is invalid` (`@bug-005`, `@rule-r07`)
- **Runtime verification:** `dev` exited with code 1 (0 passed, 1 failed); `prod` exited with code 1 (0 passed, 1 failed).

---

## Evidence provenance

- **Verified repository commit:** `dbe49ff32e9e0c1fd7cc272056058ae6d2d4cbc9`
- **Verified image digest:** `sha256:c80c42ffafccb6ba9cd9a128421445d308225f09902c03aeadbc99e321176bbc`
- **GitHub Actions run:** [Run 38210081755](https://github.com/Akteivias/GS-SDET-Challenge/actions/runs/38210081755)
- **Fresh independent runtime verification:**
  - BUG-001, BUG-002, BUG-003, and BUG-005 failed as expected in dev and prod.
  - BUG-004 failed in dev and passed in prod, confirming the documented environment divergence.
  - UUID-scoped verification data was cleaned up.
