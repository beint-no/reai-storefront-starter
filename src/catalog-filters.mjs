import { catalogFacets } from "../public/assets/catalog-filter-data.js";
const h = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (x) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        x
      ],
  );
export function renderCatalogFilters(
  products,
  store,
  locale,
  { explain = true, availability = null } = {},
) {
  const nb = locale === "nb",
    facets = catalogFacets(products, locale);
  const model = products.map(
    ({
      id,
      title,
      description,
      brand,
      category,
      productType,
      attributes,
      variants,
    }) => ({
      id,
      title,
      description,
      brand,
      category,
      productType,
      attributes,
      variants: variants.map(
        ({ id, price, compareAtPrice, options, attributes }) => ({
          id,
          price,
          compareAtPrice,
          options,
          attributes,
        }),
      ),
    }),
  );
  return `<details class="catalog-filters" data-catalog-panel open><summary>${nb ? "Filtrer produkter" : "Filter products"}<span data-filter-count></span><span aria-hidden="true">＋</span></summary><div class="catalog-filter-body" data-filter-body><div class="catalog-mobile-heading"><b>${nb ? "Filtrer produkter" : "Filter products"}</b><button type="button" data-filter-cancel>${nb ? "Avbryt" : "Cancel"}</button></div><fieldset class="catalog-price"><legend>${nb ? "Pris" : "Price"} (${h(store.currency)})</legend><div><label>${nb ? "Fra" : "From"}<input type="number" min="0" step="any" inputmode="decimal" data-filter-min placeholder="0"></label><label>${nb ? "Til" : "To"}<input type="number" min="0" step="any" inputmode="decimal" data-filter-max placeholder="${nb ? "Ingen grense" : "No limit"}"></label></div><p data-price-error hidden>${nb ? "Fra-prisen må være lavere enn til-prisen." : "The minimum must not exceed the maximum."}</p></fieldset><label class="catalog-stock"><input type="checkbox" data-filter-available><span>${nb ? "Kun tilgjengelige varianter" : "Available variants only"}</span></label><p class="catalog-stock-note" data-stock-note role="status"></p>${facets
    .map(
      (f) =>
        `<details class="catalog-facet" ${f.key === "type" || f.key === "attribute:color" ? "open" : ""}><summary>${h(f.name)}<span aria-hidden="true">＋</span></summary><fieldset><legend class="sr-only">${h(f.name)}</legend>${f.values
          .map(
            (v) =>
              `<label><input type="checkbox" data-facet-key="${h(f.key)}" value="${h(v.value)}">${(
                v.colors || []
              )
                .filter((color) => /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color))
                .map(
                  (color) =>
                    `<svg class="catalog-swatch" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="${h(color)}"/></svg>`,
                )
                .join(
                  "",
                )}<span>${h(v.label)}</span><small data-facet-count></small></label>`,
          )
          .join("")}</fieldset></details>`,
    )
    .join(
      "",
    )}<div class="catalog-filter-actions"><button type="button" data-filter-apply>${nb ? "Vis produkter" : "Show products"}</button><span data-filter-preview role="status"></span></div>${explain ? `<p class="catalog-filter-note">${nb ? "Valgene kommer fra denne samlingens produktdata i ReAI." : "Choices come from this collection’s ReAI product data."}</p>` : ""}</div></details><div hidden data-catalog-model="${h(JSON.stringify({ products: model, facets, currency: store.currency, locale, availability }))}"></div>`;
}
export function renderCatalogTools(products, locale) {
  const nb = locale === "nb";
  return `<div class="index-toolbar"><b data-catalog-results role="status">${products.length} ${nb ? "produkter" : "products"}</b><form class="catalog-search-form" role="search"><label class="search"><span class="sr-only">${nb ? "Søk i denne samlingen" : "Search this collection"}</span><input data-catalog-search type="search" placeholder="${nb ? "Søk i denne samlingen" : "Search this collection"}"></label><button type="submit">${nb ? "Søk" : "Search"}</button></form><label class="index-sort">${nb ? "Sorter" : "Sort"}<select data-catalog-sort><option value="featured">${nb ? "Utvalgt" : "Featured"}</option><option value="asc">${nb ? "Pris: lav til høy" : "Price: low to high"}</option><option value="desc">${nb ? "Pris: høy til lav" : "Price: high to low"}</option></select></label><div class="index-view" role="group" aria-label="${nb ? "Visning" : "View"}"><button data-catalog-view="grid" aria-pressed="true">${nb ? "Rutenett" : "Grid"}</button><button data-catalog-view="list" aria-pressed="false">${nb ? "Liste" : "List"}</button></div></div><div class="catalog-recovery" data-catalog-recovery hidden><p>${nb ? "Ingen treff. Behold samlingen og fjern søket eller filtrene for å prøve igjen." : "No results. Keep this collection and clear the search or filters to try again."}</p><button type="button" data-clear-search>${nb ? "Fjern søket" : "Clear search"}</button><button type="button" data-clear-filters>${nb ? "Fjern filtre" : "Clear filters"}</button></div><div class="catalog-active" data-catalog-active aria-label="${nb ? "Aktive filtre" : "Active filters"}" hidden></div>`;
}
