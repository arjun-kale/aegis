/**
 * Runtime validator for JSON Schema inputs.
 */

export interface ValidationError {
  field: string;
  expected: string;
  actual: string;
  message: string;
}

export function validateSchema(
  input: unknown,
  schema: {
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  }
): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (schema.type === 'object') {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      errors.push({
        field: 'root',
        expected: 'object',
        actual: input === null ? 'null' : Array.isArray(input) ? 'array' : typeof input,
        message: 'Input must be a JSON object.',
      });
      return { valid: false, errors };
    }

    const obj = input as Record<string, unknown>;

    // Check required fields
    if (schema.required) {
      for (const reqField of schema.required) {
        if (!(reqField in obj) || obj[reqField] === undefined) {
          errors.push({
            field: reqField,
            expected: schema.properties?.[reqField]?.type ?? 'defined',
            actual: 'undefined',
            message: `Required property '${reqField}' is missing.`,
          });
        }
      }
    }

    // Check properties types if specified
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj && obj[key] !== undefined) {
          const val = obj[key];
          const expectedType = propSchema.type;
          
          if (expectedType === 'string' && typeof val !== 'string') {
            errors.push({
              field: key,
              expected: 'string',
              actual: typeof val,
              message: `Property '${key}' must be a string.`,
            });
          } else if (expectedType === 'number' && typeof val !== 'number') {
            errors.push({
              field: key,
              expected: 'number',
              actual: typeof val,
              message: `Property '${key}' must be a number.`,
            });
          } else if (expectedType === 'boolean' && typeof val !== 'boolean') {
            errors.push({
              field: key,
              expected: 'boolean',
              actual: typeof val,
              message: `Property '${key}' must be a boolean.`,
            });
          }

          if (propSchema.enum && Array.isArray(propSchema.enum)) {
            if (!propSchema.enum.includes(val)) {
              errors.push({
                field: key,
                expected: `one of [${propSchema.enum.join(', ')}]`,
                actual: String(val),
                message: `Property '${key}' must be one of: ${propSchema.enum.join(', ')}.`,
              });
            }
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
