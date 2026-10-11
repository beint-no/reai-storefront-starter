const unique = (items) => [...new Set(items)];
const clean = (value) => String(value || "").trim();
export const normalize = (value) =>
  clean(value).normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();

export function productValues(product, key, variant) {
  if (key === "brand") return product.brand ? [product.brand] : [];
  if (key === "type") return product.productType ? [product.productType] : [];
  if (key === "category")
    return product.category?.id ? [product.category.id] : [];
  if (key.startsWith("option:"))
    return (variant?.options || [])
      .filter((o) => o.name === key.slice(7))
      .map((o) => o.value);
  return unique(
    [...(product.attributes || []), ...(variant?.attributes || [])]
      .filter((a) => `attribute:${a.key}` === key)
      .flatMap((a) => a.values.map((v) => v.id)),
  );
}

export function catalogFacets(products, locale = "nb") {
  const nb = locale === "nb",
    groups = new Map();
  const add = (key, name, value, label, colors = []) => {
    if (!clean(value) || !clean(label)) return;
    if (!groups.has(key)) groups.set(key, { key, name, values: new Map() });
    const values = groups.get(key).values;
    if (!values.has(value)) values.set(value, { value, label, colors });
  };
  const names = {
    color: nb ? "Farge" : "Color",
    pattern: nb ? "Mønster" : "Pattern",
    "footwear-material": nb ? "Materiale" : "Material",
    "shoe-features": nb ? "Egenskaper" : "Features",
  };
  for (const product of products) {
    add(
      "type",
      nb ? "Produkttype" : "Product type",
      product.productType,
      product.productType,
    );
    add(
      "category",
      nb ? "Kategori" : "Category",
      product.category?.id,
      product.category?.name || product.category?.id,
    );
    add("brand", nb ? "Merke" : "Brand", product.brand, product.brand);
    for (const attribute of [
      ...(product.attributes || []),
      ...product.variants.flatMap((v) => v.attributes || []),
    ])
      for (const value of attribute.values)
        add(
          `attribute:${attribute.key}`,
          names[attribute.key] || attribute.name,
          value.id,
          value.label,
          value.colors,
        );
    for (const variant of product.variants)
      for (const option of variant.options || [])
        add(
          `option:${option.name}`,
          nb && option.name === "Size" ? "Størrelse" : option.name,
          option.value,
          option.value,
        );
  }
  return (
    [...groups.values()]
      .map((g) => ({ ...g, values: [...g.values.values()] }))
      // Omit any choice that would match every variant of every product.
      .filter(
        (g) =>
          g.values.length > 1 ||
          products.some((p) =>
            p.variants.some((v) => !productValues(p, g.key, v).length),
          ),
      )
      .sort((a, b) => {
        const rank = (key) =>
          key === "type"
            ? 0
            : key.startsWith("attribute:")
              ? 1
              : key === "category"
                ? 2
                : key === "brand"
                  ? 3
                  : 4;
        return rank(a.key) - rank(b.key);
      })
  );
}

export function matchingVariants(product, state = {}, statuses = new Map()) {
  const query = normalize(state.query);
  const base = [product.title, product.description, product.brand, product.productType, product.category?.name];
  return product.variants.filter((variant) => {
    const search = normalize([
      ...base, variant.sku,
      ...[...(product.attributes || []), ...(variant.attributes || [])].flatMap((a) => a.values.flatMap((v) => [v.label, ...(v.aliases || []), ...(v.taxonomyValues || []).map((t) => t.name)])),
      ...(variant.options || []).map((o) => o.value),
    ].join(" "));
    if (query && !query.split(/\s+/).every((word) => search.includes(word))) return false;
    const price = Number(variant.price);
    if (state.min != null && (!Number.isFinite(price) || price < state.min))
      return false;
    if (state.max != null && (!Number.isFinite(price) || price > state.max))
      return false;
    if (state.available && statuses.get(variant.id) !== "AVAILABLE")
      return false;
    return Object.entries(state.selected || {}).every(
      ([key, values]) =>
        !values.length ||
        productValues(product, key, variant).some((value) =>
          values.includes(value),
        ),
    );
  });
}

export function facetCounts(products, facets, state, statuses = new Map()) {
  return new Map(
    facets.map((facet) => [
      facet.key,
      new Map(
        facet.values.map(({ value }) => {
          const candidate = {
            ...state,
            selected: { ...state.selected, [facet.key]: [value] },
          };
          return [
            value,
            products.filter(
              (p) => matchingVariants(p, candidate, statuses).length,
            ).length,
          ];
        }),
      ),
    ]),
  );
}

export function readFilterState(params, facets) {
  const number = (name) => {
    const value = params.get(name);
    return value?.trim() && Number.isFinite(Number(value)) && Number(value) >= 0
      ? Number(value)
      : null;
  };
  return {
    query: params.get("q") || "",
    min: number("min"),
    max: number("max"),
    available: params.get("available") === "1",
    selected: Object.fromEntries(
      facets.map((f) => [
        f.key,
        unique(params.getAll(`f.${f.key}`)).filter((value) =>
          f.values.some((v) => v.value === value),
        ),
      ]),
    ),
    sort: ["asc", "desc"].includes(params.get("sort"))
      ? params.get("sort")
      : "featured",
    view: params.get("view") === "list" ? "list" : "grid",
  };
}

export function writeFilterState(params, state) {
  for (const key of [...params.keys()])
    if (
      key.startsWith("f.") ||
      ["q", "min", "max", "available", "sort", "view"].includes(key)
    )
      params.delete(key);
  if (state.query) params.set("q", state.query);
  if (state.min != null) params.set("min", String(state.min));
  if (state.max != null) params.set("max", String(state.max));
  if (state.available) params.set("available", "1");
  if (state.sort !== "featured") params.set("sort", state.sort);
  if (state.view !== "grid") params.set("view", state.view);
  for (const [key, values] of Object.entries(state.selected))
    for (const value of values) params.append(`f.${key}`, value);
  return params;
}
