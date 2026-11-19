import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validationMessage } from './form-resolver';

describe('validationMessage', () => {
  let messages: string[];

  function messagesFor(schema: z.ZodType, input: unknown) {
    const result = schema.safeParse(input, { error: validationMessage });
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  }

  describe('when a required text field is empty', () => {
    beforeEach(() => {
      messages = messagesFor(z.string().trim().min(1), '   ');
    });

    it('says the field is required', () => {
      expect(messages).toEqual(['This field is required.']);
    });
  });

  describe('when a field is missing altogether', () => {
    beforeEach(() => {
      messages = messagesFor(z.object({ name: z.string() }), {});
    });

    it('says the field is required', () => {
      expect(messages).toEqual(['This field is required.']);
    });
  });

  describe('when text is shorter than a minimum above one', () => {
    beforeEach(() => {
      messages = messagesFor(z.string().min(6), 'abc');
    });

    it('gives the minimum length', () => {
      expect(messages).toEqual(['Use at least 6 characters.']);
    });
  });

  describe('when text is longer than the maximum', () => {
    beforeEach(() => {
      messages = messagesFor(z.string().max(100), 'x'.repeat(101));
    });

    it('gives the maximum length', () => {
      expect(messages).toEqual(['Use 100 characters or fewer.']);
    });
  });

  describe('when an email address is malformed', () => {
    beforeEach(() => {
      messages = messagesFor(z.email(), 'alex-at-example');
    });

    it('asks for a valid email address', () => {
      expect(messages).toEqual(['Enter a valid email address.']);
    });
  });

  describe('when a number is below its minimum of one', () => {
    beforeEach(() => {
      messages = messagesFor(z.number().min(1), 0);
    });

    it('falls back to the generic message rather than saying it is required', () => {
      expect(messages).toEqual(['Check this field and try again.']);
    });
  });

  describe('when a custom rule fails', () => {
    beforeEach(() => {
      messages = messagesFor(
        z.string().refine(() => false),
        'anything',
      );
    });

    it('falls back to the generic message', () => {
      expect(messages).toEqual(['Check this field and try again.']);
    });
  });
});
