import { BUDGET_DETAIL_EVENT, BUDGET_DETAIL_URL_PATTERN } from "./channel.js";

/**
 * Observes EveryDollar's own budget fetches from inside the page's JS world.
 *
 * The extension issues no requests of its own — it reads the responses the page
 * was already going to load, which is why it needs no API credentials and sends
 * nothing anywhere.
 *
 * This runs in the MAIN world, where it can see `window.fetch`, but has no
 * access to `chrome.*` or to the content script's modules. It therefore stays
 * deliberately dumb: republish the raw JSON and let the content script decide
 * what it means. Anything richer could not survive the structured clone anyway.
 */
export function installFetchInterceptor(target: Window = window): void {
  const originalFetch = target.fetch;

  target.fetch = function interceptedFetch(
    this: unknown,
    ...args: Parameters<typeof fetch>
  ): Promise<Response> {
    const result = originalFetch.apply(this as never, args);

    const url = requestUrl(args[0]);
    if (url !== null && BUDGET_DETAIL_URL_PATTERN.test(url)) {
      void result.then((response) => {
        // Clone first: the page still needs to read this body itself, and a
        // Response body can only be consumed once.
        response
          .clone()
          .json()
          .then((payload: unknown) => {
            target.dispatchEvent(
              new CustomEvent(BUDGET_DETAIL_EVENT, { detail: payload }),
            );
          })
          // A body that is not JSON is not ours to care about.
          .catch(() => {});
      });
    }

    return result;
  } as typeof fetch;
}

function requestUrl(input: Parameters<typeof fetch>[0]): string | null {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (typeof input === "object" && input !== null && "url" in input) {
    return (input as Request).url;
  }
  return null;
}
