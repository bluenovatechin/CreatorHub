/**
 * TESTS: email HTML is safe (user text is escaped) and the code email contains no personal details.
 */
import { describe, expect, it } from 'vitest';
import { emails, renderHtml } from '../src/providers/email';

describe('email HTML', () => {
  it('escapes user-supplied text and renders the link as a button', () => {
    const msg = emails.reset('a@example.com', '<script>alert(1)</script> Riya', 'http://localhost:5180/reset-password#token=abc_DEF-123');
    const html = renderHtml(msg);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('href="http://localhost:5180/reset-password#token=abc_DEF-123"');
    expect(html).toContain('Set a new password');
  });

  it('keeps the signup code email minimal: just the code, no personal details', () => {
    const msg = emails.otp('a@example.com', '123456');
    expect(msg.code).toBe('123456');
    expect(msg.text).not.toContain('+91');
    expect(renderHtml(msg)).toContain('123456');
  });
});
