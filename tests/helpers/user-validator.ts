import fs from 'fs';
import { parse } from 'yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getProperty(value: unknown, key: string): unknown {
  if (!isRecord(value)) {
    throw new Error(`Expected an object at property "${key}", but received ${typeof value}.`);
  }
  if (!(key in value)) {
    throw new Error(`Missing expected property "${key}".`);
  }
  return value[key];
}

function loadOpenApiDoc(): unknown {
  const yamlContent = fs.readFileSync('sdet_challenge_api.yml', 'utf8');
  return parse(yamlContent);
}

function loadSchema(name: string): Record<string, unknown> {
  const openApiDoc = loadOpenApiDoc();
  const components = getProperty(openApiDoc, 'components');
  const schemas = getProperty(components, 'schemas');
  const schema = getProperty(schemas, name);

  if (!isRecord(schema)) {
    throw new Error(`Expected components.schemas.${name} to be an object.`);
  }

  return schema;
}

/**
 * Load the User schema from the local OpenAPI contract.
 *
 * Assumes the process working directory is the repository root so that
 * `sdet_challenge_api.yml` is resolved correctly.
 */
export function loadUserSchema(): Record<string, unknown> {
  return loadSchema('User');
}

/**
 * Load the ErrorResponse schema from the local OpenAPI contract.
 *
 * Assumes the process working directory is the repository root so that
 * `sdet_challenge_api.yml` is resolved correctly.
 */
export function loadErrorResponseSchema(): Record<string, unknown> {
  return loadSchema('ErrorResponse');
}

/**
 * Create a reusable AJV instance configured for the contract.
 *
 * Strict mode is enabled, the OpenAPI `example` annotation is allowed,
 * and mutation options (coercion, defaults, stripping) are disabled.
 * Only the `email` format is registered.
 */
function createAjv() {
  const ajv = new Ajv({
    strict: true,
    allErrors: true,
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false,
  });

  ajv.addKeyword('example');
  addFormats(ajv, ['email']);

  return ajv;
}

/**
 * Create all contract validators against a single AJV instance.
 *
 * Compilation happens once per module instance. A schema/setup problem throws
 * here; a nonconforming payload later returns false from the returned function.
 */
function createValidators() {
  const ajv = createAjv();

  const userSchema = loadUserSchema();
  const errorResponseSchema = loadErrorResponseSchema();
  const userArraySchema: Record<string, unknown> = {
    type: 'array',
    items: userSchema,
  };

  return {
    validateUser: ajv.compile(userSchema),
    validateErrorResponse: ajv.compile(errorResponseSchema),
    validateUserArray: ajv.compile(userArraySchema),
  };
}

/**
 * Compiled contract validators.
 *
 * Call any validator to get a boolean result. If it returns false,
 * read `<validator>.errors` immediately — it is overwritten on the next call.
 */
export const { validateUser, validateErrorResponse, validateUserArray } = createValidators();
