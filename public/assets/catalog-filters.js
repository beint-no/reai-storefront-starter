import { catalogReturn } from "./catalog-context.js";
import {
  matchingVariants,
  facetCounts,
  readFilterState,
  writeFilterState,
} from "./catalog-filter-data.js";
const root = document.querySelector("[data-catalog]");
if (root) {
  const {
    products,
    facets,
    currency,
    locale,
    availability: fixtureStock,
  } = JSON.parse(
    root.querySelector("[data-catalog-model]").dataset.catalogModel,
  );
  const nb = locale === "nb",
    grid = root.querySelector(".product-grid"),
    cards = grid ? [...grid.children] : [];
  const byId = new Map(products.map((p) => [p.id, p])),
    statuses = new Map(fixtureStock || []);
  const originalPrices = new Map(
    cards.map((c) => [c, c.querySelector("[data-product-price]").innerHTML]),
  );
  const search = root.querySelector("[data-catalog-search]"),
    min = root.querySelector("[data-filter-min]"),
    max = root.querySelector("[data-filter-max]"),
    available = root.querySelector("[data-filter-available]"),
    sort = root.querySelector("[data-catalog-sort]");
  const checks = [...root.querySelectorAll("[data-facet-key]")],
    active = root.querySelector("[data-catalog-active]"),
    result = root.querySelector("[data-catalog-results]");
  const format = (value) =>
    new Intl.NumberFormat(nb ? "nb-NO" : "en", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(value);
  const languageLinks = [
    ...document.querySelectorAll('a.language, a[data-language-link]'),
  ].map((link) => ({
    link,
    key: link.hasAttribute("data-language-link") ? "locale" : "lang",
    language: new URL(link.href).searchParams.get(
      link.hasAttribute("data-language-link") ? "locale" : "lang",
    ),
    market: new URL(link.href).searchParams.get("market"),
  }));
  let state = readFilterState(new URL(location.href).searchParams, facets),
    stockPromise,
    stockReady = !!fixtureStock;
  const panel = root.querySelector("[data-catalog-panel]");
  const mobile = matchMedia("(max-width: 700px)");
  const body = root.querySelector("[data-filter-body]");
  let draft = null,
    dialogOpener;
  // The same controls are moved into a native modal on mobile, not duplicated.
  const mobileDialog = document.createElement("dialog");
  mobileDialog.className = "catalog-mobile-dialog";
  mobileDialog.setAttribute(
    "aria-label",
    nb ? "Filtrer produkter" : "Filter products",
  );
  document.body.append(mobileDialog);
  if (mobile.matches) panel.open = false;
  panel.querySelector("summary").addEventListener("click", (event) => {
    if (!mobile.matches) return;
    event.preventDefault();
    dialogOpener = event.currentTarget;
    draft = structuredClone(state);
    controls();
    mobileDialog.append(body);
    mobileDialog.showModal();
    previewDraft();
  });
  function closeFilters() {
    draft = null;
    panel.append(body);
    controls();
    mobileDialog.close();
  }
  mobileDialog.addEventListener("close", () => {
    draft = null;
    panel.append(body);
    controls();
    render();
    dialogOpener?.focus();
  });
  body
    .querySelector("[data-filter-cancel]")
    .addEventListener("click", closeFilters);
  body
    .querySelector("[data-filter-apply]")
    .addEventListener("click", async () => {
      if (draft.min != null && draft.max != null && draft.min > draft.max) {
        body.querySelector("[data-price-error]").hidden = false;
        min.focus();
        return;
      }
      state = draft;
      closeFilters();
      await update("push");
    });
  mobile.addEventListener("change", () => {
    if (mobileDialog.open) closeFilters();
    panel.open = !mobile.matches;
  });
  function previewDraft() {
    const filtered =
      draft.available && !stockReady ? { ...draft, available: false } : draft;
    const count = products.filter(
      (p) => matchingVariants(p, filtered, statuses).length,
    ).length;
    const counts = facetCounts(products, facets, filtered, statuses);
    for (const check of checks) {
      const count = counts.get(check.dataset.facetKey)?.get(check.value) || 0;
      check.disabled = !check.checked && count === 0;
      check.closest("label").querySelector("[data-facet-count]").textContent =
        String(count);
    }
    body.querySelector("[data-filter-preview]").textContent =
      draft.available && !stockReady
        ? nb
          ? "Lager kontrolleres når du viser produktene."
          : "Availability is checked when you show products."
        : `${count} ${nb ? "produkter" : "products"}`;
    const invalid =
      draft.min != null && draft.max != null && draft.min > draft.max;
    body.querySelector("[data-price-error]").hidden = !invalid;
    min.setAttribute("aria-invalid", String(invalid));
    max.setAttribute("aria-invalid", String(invalid));
  }
  function changeState(change, mode) {
    change(draft || state);
    if (draft) previewDraft();
    else update(mode);
  }

  function controls() {
    const current = draft || state;
    search.value = state.query;
    min.value = current.min ?? "";
    max.value = current.max ?? "";
    available.checked = current.available;
    sort.value = state.sort;
    for (const check of checks)
      check.checked = current.selected[check.dataset.facetKey]?.includes(
        check.value,
      );
    for (const button of root.querySelectorAll("[data-catalog-view]"))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.catalogView === state.view),
      );
  }
  function url(mode) {
    const target = new URL(location.href);
    writeFilterState(target.searchParams, state);
    if (target.href !== location.href)
      history[mode === "push" ? "pushState" : "replaceState"](null, "", target);
    languageLinks.forEach(({ link, language, key, market }) => {
      const next = new URL(target);
      next.searchParams.set(key, language);
      if (market) next.searchParams.set("market", market);
      link.href = next.pathname + next.search;
    });
  }
  function chips() {
    active.replaceChildren();
    const add = (label, remove) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label + " ×";
      button.setAttribute(
        "aria-label",
        (nb ? "Fjern filter " : "Remove filter ") + label,
      );
      button.addEventListener("click", () => {
        remove();
        controls();
        update("push");
      });
      active.append(button);
    };
    if (state.query)
      add((nb ? "Søk: " : "Search: ") + state.query, () => (state.query = ""));
    if (state.min != null || state.max != null)
      add(
        `${state.min == null ? "0" : format(state.min)} – ${state.max == null ? "∞" : format(state.max)}`,
        () => {
          state.min = null;
          state.max = null;
        },
      );
    if (state.available)
      add(nb ? "Tilgjengelig" : "Available", () => (state.available = false));
    for (const facet of facets)
      for (const value of state.selected[facet.key] || []) {
        const label = facet.values.find((v) => v.value === value)?.label;
        add(
          `${facet.name}: ${label}`,
          () =>
            (state.selected[facet.key] = state.selected[facet.key].filter(
              (v) => v !== value,
            )),
        );
      }
    const count = active.children.length;
    root.querySelector("[data-filter-count]").textContent = count
      ? String(count)
      : "";
    active.hidden = !count;
    if (count) {
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "catalog-clear";
      clear.textContent = nb ? "Fjern alle" : "Clear all";
      clear.addEventListener("click", () => {
        state = {
          ...state,
          query: "",
          min: null,
          max: null,
          available: false,
          selected: {},
        };
        controls();
        update("push");
      });
      active.append(clear);
    }
  }
  function render() {
    const invalid =
      state.min != null && state.max != null && state.min > state.max;
    root.querySelector("[data-price-error]").hidden = !invalid;
    min.setAttribute("aria-invalid", String(invalid));
    max.setAttribute("aria-invalid", String(invalid));
    const matches = new Map(
      products.map((p) => [p.id, matchingVariants(p, state, statuses)]),
    );
    let count = 0;
    for (const card of cards) {
      const variants = matches.get(card.dataset.productId) || [];
      card.hidden = !variants.length;
      if (!card.hidden) count++;
      const price = card.querySelector("[data-product-price]");
      const constrained =
        !!state.query ||
        state.min != null ||
        state.max != null ||
        state.available ||
        Object.entries(state.selected).some(
          ([key, values]) =>
            values.length &&
            (key.startsWith("attribute:") || key.startsWith("option:")),
        );
      price.innerHTML = originalPrices.get(card);
      if (constrained && variants.length) {
        const prices = [
          ...new Set(
            variants.map((v) => Number(v.price)).filter(Number.isFinite),
          ),
        ];
        if (prices.length) {
          const lowest = Math.min(...prices);
          price.textContent =
            (prices.length > 1 ? (nb ? "Fra " : "From ") : "") + format(lowest);
          const reference = variants.find(
            (v) =>
              Number(v.price) === lowest && Number(v.compareAtPrice) > lowest,
          )?.compareAtPrice;
          if (reference) {
            const strike = document.createElement("s");
            strike.className = "reference-price";
            strike.textContent = format(reference);
            price.append(" ", strike);
          }
        }
      }
      // Keep links on the matching variant without bypassing normal product-page availability checks.
      const preferred =
        constrained && variants.length
          ? variants.reduce((a, b) =>
              Number(a.price) <= Number(b.price) ? a : b,
            )
          : null;
      card.dataset.catalogVariant = preferred?.id || "";
      card.id = "product-" + card.dataset.productId;
      const back = new URL(location.href);
      back.hash = card.id;
      const returnPath = catalogReturn(back.pathname + back.search + back.hash);
      for (const link of card.querySelectorAll('a[href*="/products/"]')) {
        const target = new URL(link.href);
        target.searchParams.delete("variant");
        if (preferred) target.searchParams.set("variant", preferred.id);
        if (returnPath) target.searchParams.set("return", returnPath);
        link.href = target.pathname + target.search;
      }
    }
    result.textContent = nb
      ? `${count} av ${products.length} produkter`
      : `${count} of ${products.length} products`;
    root.querySelector("[data-catalog-empty]").hidden = count > 0;
    root.querySelector("[data-catalog-recovery]").hidden = count > 0;
    root.querySelector("[data-clear-search]").hidden = !state.query;
    root.querySelector("[data-clear-filters]").hidden = !(
      state.min != null ||
      state.max != null ||
      state.available ||
      Object.values(state.selected).some((v) => v.length)
    );
    const counts = facetCounts(products, facets, state, statuses);
    for (const check of checks) {
      const count = counts.get(check.dataset.facetKey)?.get(check.value) || 0;
      check.disabled = !check.checked && count === 0;
      check.closest("label").querySelector("[data-facet-count]").textContent =
        String(count);
    }
    if (grid) {
      const ordered = [...cards];
      const price = (card) => {
        const values = (
          matches.get(card.dataset.productId) ||
          byId.get(card.dataset.productId).variants
        )
          .map((v) => Number(v.price))
          .filter(Number.isFinite);
        return values.length ? Math.min(...values) : Infinity;
      };
      if (state.sort !== "featured")
        ordered.sort((a, b) =>
          state.sort === "asc" ? price(a) - price(b) : price(b) - price(a),
        );
      grid.append(...ordered);
      grid.classList.toggle("list-view", state.view === "list");
    }
    chips();
    root.dispatchEvent(new Event("reai:catalog-render", { bubbles: true }));
  }
  async function loadStock() {
    if (stockReady) return;
    if (!stockPromise)
      stockPromise = (async () => {
        const ids = [
          ...new Set(products.flatMap((p) => p.variants.map((v) => v.id))),
        ];
        for (let i = 0; i < ids.length; i += 100) {
          const stockParams = new URLSearchParams({
            resource: ids.slice(i, i + 100).join(","),
          });
          for (const key of ["market", "locale"]) {
            const value = new URL(location.href).searchParams.get(key);
            if (value) stockParams.set(key, value);
          }
          const response = await fetch(
            `${document.body.dataset.storeBase || ""}/reai/availabilities?${stockParams}`,
            { cache: "no-store" },
          );
          if (!response.ok) throw new Error("Availability unavailable");
          const data = await response.json();
          for (const variant of data.variants)
            statuses.set(variant.variantId, variant.status);
        }
        stockReady = true;
      })();
    await stockPromise;
  }
  async function update(mode) {
    url(mode);
    controls();
    chips();
    if (state.available && !stockReady) {
      root.setAttribute("aria-busy", "true");
      result.textContent = nb
        ? "Kontrollerer tilgjengelighet…"
        : "Checking availability…";
      try {
        await loadStock();
      } catch {
        stockPromise = null;
        state.available = false;
        controls();
        url("replace");
        root.querySelector("[data-stock-note]").textContent = nb
          ? "Tilgjengelighet kunne ikke kontrolleres. Prøv igjen."
          : "Could not check availability. Try again.";
      }
      root.setAttribute("aria-busy", "false");
    }
    render();
  }
  search.addEventListener("input", () => {
    state.query = search.value;
    update("replace");
  });
  root
    .querySelector(".catalog-search-form")
    .addEventListener("submit", (event) => {
      event.preventDefault();
      state.query = search.value;
      update("push");
    });
  root.querySelector("[data-clear-search]").addEventListener("click", () => {
    state.query = "";
    update("push");
    search.focus();
  });
  root.querySelector("[data-clear-filters]").addEventListener("click", () => {
    state = { ...state, min: null, max: null, available: false, selected: {} };
    update("push");
  });
  for (const input of [min, max])
    input.addEventListener("input", () =>
      changeState((current) => {
        current[input === min ? "min" : "max"] =
          input.value &&
          Number(input.value) >= 0 &&
          Number.isFinite(Number(input.value))
            ? Number(input.value)
            : null;
      }, "replace"),
    );
  checks.forEach((check) =>
    check.addEventListener("change", () =>
      changeState((current) => {
        current.selected[check.dataset.facetKey] = checks
          .filter(
            (c) => c.dataset.facetKey === check.dataset.facetKey && c.checked,
          )
          .map((c) => c.value);
      }, "push"),
    ),
  );
  available.addEventListener("change", () => {
    body.querySelector("[data-stock-note]").textContent = "";
    changeState((current) => {
      current.available = available.checked;
    }, "push");
  });
  sort.addEventListener("change", () => {
    state.sort = sort.value;
    update("push");
  });
  root.querySelectorAll("[data-catalog-view]").forEach((button) =>
    button.addEventListener("click", () => {
      state.view = button.dataset.catalogView;
      update("push");
    }),
  );
  addEventListener("popstate", () => {
    if (mobileDialog.open) closeFilters();
    state = readFilterState(new URL(location.href).searchParams, facets);
    update("replace");
  });
  update("replace");
}
