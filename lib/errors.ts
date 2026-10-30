/**
 * LocalizedError — thrown from server actions instead of plain Error.
 *
 * The `code` is a dot-notation key into messages/{locale}.json under the
 * `errors` namespace (e.g. "errors.employees.notFound"). The `fallback` is
 * the English message used for server-side logging and as a last-resort
 * display string if the translation key is missing.
 *
 * Pattern:
 *   throw new LocalizedError("errors.users.usernameTaken", "A user with this username already exists.")
 *
 * In withPermission(), LocalizedError is caught and its `code` is surfaced in
 * ActionResult.error.code so client forms can call t(code) to show a
 * translated message.
 */
export class LocalizedError extends Error {
  constructor(
    public readonly code: string,
    fallback: string
  ) {
    super(fallback);
    this.name = "LocalizedError";
  }
}
