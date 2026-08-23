(function () {
  const BUDGET_DETAIL_PATTERN = /\/app\/api\/budgets\/[0-9a-f-]{36}(?:[/?#]|$)/;
  const originalFetch = window.fetch;

  window.fetch = function interceptedFetch(...args) {
    return originalFetch.apply(this, args).then((response) => {
      const request = args[0];
      const url = typeof request === "string" ? request : request?.url;

      if (url && BUDGET_DETAIL_PATTERN.test(url)) {
        response
          .clone()
          .json()
          .then((data) => {
            window.dispatchEvent(
              new CustomEvent("budget-toolkit:budget-detail", { detail: data })
            );
          })
          .catch(() => {});
      }

      return response;
    });
  };
})();
