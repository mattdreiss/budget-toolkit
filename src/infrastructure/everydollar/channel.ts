/**
 * The one-way channel from the MAIN-world interceptor to the content script.
 *
 * The two run in different JS worlds and share no module state, so this
 * constant is compiled into both bundles independently — keep the name here and
 * import it, rather than writing the string twice.
 *
 * The payload crosses as a structured clone, so it must stay plain JSON: raw
 * DTO only, never domain objects.
 */
export const BUDGET_DETAIL_EVENT = "budget-toolkit:budget-detail";

/** Matches EveryDollar's own budget-detail endpoint, `/app/api/budgets/{uuid}`. */
export const BUDGET_DETAIL_URL_PATTERN =
  /\/app\/api\/budgets\/[0-9a-f-]{36}(?:[/?#]|$)/;
