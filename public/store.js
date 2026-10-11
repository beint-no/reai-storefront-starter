import {
  quantityControl,
  undoControl,
  rememberCartFocus,
  restoreCartFocus,
} from "./assets/cart-controls.js";
const CART_KEY = "reai-storefront-cart-v1";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const nb = /^(?:nb|nn|no)(?:-|$)/i.test(document.documentElement.lang);
const text = nb
  ? {
      outOfStock: "Utsolgt",
      stockLimit: (n) => `Bare ${n} kan kjøpes. Reduser antallet.`,
      added: "Lagt i handlekurven.",
      saveError: "Nettleseren kunne ikke lagre handlekurven.",
      empty: "Handlekurven er tom.",
      unavailable: "Utilgjengelig produkt",
      removeToContinue: "Fjern produktet for å fortsette",
      quantity: "Antall for",
      remove: "Fjern",
      total: "Estimert totalsum",
      loading: "Laster handlekurven…",
      cartError: "Handlekurven kunne ikke lastes. Prøv igjen.",
      retry: "Prøv igjen",
      checkout: "Gå til kassen",
      opening: "Åpner kassen…",
      checkoutError: "Kunne ikke starte kassen.",
      signingUp: "Sender påmelding…",
      signupSuccess: "Påmeldingen er mottatt.",
      signupError: "Påmelding er midlertidig utilgjengelig. Prøv igjen senere.",
      subscribe: "Meld meg på",
    }
  : {
      outOfStock: "Out of stock",
      stockLimit: (n) => `Only ${n} can be purchased. Reduce the quantity.`,
      added: "Added to cart.",
      saveError: "Your browser could not save the cart.",
      empty: "Your cart is empty.",
      unavailable: "Unavailable product",
      removeToContinue: "Remove this item to continue",
      quantity: "Quantity for",
      remove: "Remove",
      total: "Estimated total",
      loading: "Loading cart…",
      cartError: "The cart could not be loaded. Please try again.",
      retry: "Try again",
      checkout: "Continue to checkout",
      opening: "Opening checkout…",
      checkoutError: "Checkout could not be started.",
      signingUp: "Submitting…",
      signupSuccess: "Your signup has been received.",
      signupError: "Signup is temporarily unavailable. Please try again later.",
      subscribe: "Subscribe",
    };
const context = new URLSearchParams();
for (const key of ["market", "locale"]) {
  const value =
    document.body.dataset[key === "market" ? "storeMarket" : "storeLocale"];
  if (value) context.set(key, value);
}
const route = (path) =>
  `${document.body.dataset.storeBase || ""}${path}${context.size ? "?" + context : ""}`;
const money = (amount, catalog) =>
  new Intl.NumberFormat(catalog.locale, {
    style: "currency",
    currency: catalog.currency,
  }).format(amount);
function readCart() {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    const rows = new Map();
    if (Array.isArray(value))
      for (const item of value) {
        if (
          UUID.test(item?.variantId) &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0 &&
          item.quantity <= 20
        )
          rows.set(item.variantId, {
            variantId: item.variantId,
            quantity: Math.min(
              20,
              (rows.get(item.variantId)?.quantity || 0) + item.quantity,
            ),
          });
      }
    return [...rows.values()];
  } catch {
    return [];
  }
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCount(cart);
}
function updateCount(cart = readCart()) {
  document
    .querySelectorAll("[data-cart-count]")
    .forEach(
      (node) =>
        (node.textContent = String(
          cart.reduce((sum, item) => sum + item.quantity, 0),
        )),
    );
}
updateCount();
const dialog = document.querySelector("[data-cart-dialog]");
let opener;
async function openCart(source) {
  if (!dialog) {
    location.assign(route("/cart"));
    return;
  }
  opener = source;
  if (!dialog.open) dialog.showModal();
  await loadCart();
}
document.querySelectorAll("[data-open-cart]").forEach((link) =>
  link.addEventListener("click", (event) => {
    if (
      !dialog ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    openCart(link);
  }),
);
document
  .querySelector("[data-close-cart]")
  ?.addEventListener("click", () => dialog.close());
dialog?.addEventListener("close", () => opener?.focus());
dialog?.addEventListener("click", (event) => {
  const box = dialog.getBoundingClientRect();
  if (
    event.target === dialog &&
    (event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom)
  )
    dialog.close();
});
document.querySelectorAll("[data-add-to-cart]").forEach((form) =>
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const selected = form.elements.variantId.selectedOptions?.[0];
    if (button.disabled || selected?.dataset.outOfStock === "true") return;
    const variantId = form.elements.variantId.value,
      quantity = Number(form.elements.quantity.value);
    if (
      !UUID.test(variantId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    )
      return;
    const cart = readCart(),
      existing = cart.find((item) => item.variantId === variantId);
    if (existing)
      existing.quantity = Math.min(existing.quantity + quantity, 20);
    else cart.push({ variantId, quantity });
    const message = form.querySelector("[data-add-message]");
    try {
      saveCart(cart);
      message.textContent = text.added;
      openCart(button);
    } catch {
      message.textContent = text.saveError;
    }
  }),
);
const variantSelect = document.querySelector("#variant");
variantSelect?.addEventListener("change", () => {
  const option = variantSelect.selectedOptions[0];
  const price = document.querySelector("[data-variant-price]");
  price.textContent = option.dataset.price;
  if (option.dataset.reference) {
    const strike = document.createElement("s");
    strike.textContent = option.dataset.reference;
    price.append(" ", strike);
  }
  document.querySelector("[data-variant-sku]").textContent = option.dataset.sku
    ? `SKU: ${option.dataset.sku}`
    : "";
});
document.querySelectorAll("[data-gallery-image]").forEach((button) =>
  button.addEventListener("click", () => {
    const image = button.querySelector("img");
    if (!image) return;
    document
      .querySelector("[data-gallery-main]")
      .replaceChildren(image.cloneNode());
    document
      .querySelectorAll("[data-gallery-image]")
      .forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
  }),
);
const cartRoot = document.querySelector("[data-cart-items]");
const checkoutButton = document.querySelector("[data-start-checkout]");
const checkoutError = document.querySelector("[data-checkout-error]");
const cartTotal = document.querySelector("[data-cart-total]");
let catalog,
  stockIssues = new Map(),
  loading,
  starting = false,
  removed = null;
function report(message) {
  checkoutError.textContent = message;
  checkoutError.hidden = false;
}
function mutate(cart) {
  try {
    saveCart(cart);
    stockIssues.clear();
    checkoutError.hidden = true;
  } catch {
    report(text.saveError);
  }
  renderCart();
}
function renderCart() {
  if (!catalog || !cartRoot) return;
  const cart = readCart();
  const variants = new Map(
    catalog.products.flatMap((p) =>
      p.variants.map((v) => [v.id, { product: p, variant: v }]),
    ),
  );
  const focus = rememberCartFocus(cartRoot);
  cartRoot.replaceChildren();
  if (removed)
    cartRoot.append(
      undoControl(
        removed.label,
        () => {
          const rows = readCart();
          if (!rows.some((x) => x.variantId === removed.item.variantId))
            rows.splice(removed.index, 0, removed.item);
          removed = null;
          mutate(rows);
        },
        nb,
      ),
    );
  if (!cart.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = text.empty;
    cartRoot.append(empty);
    checkoutButton.disabled = true;
    cartTotal.textContent = "";
    restoreCartFocus(cartRoot, focus);
    return;
  }
  let total = 0;
  for (const item of cart) {
    const found = variants.get(item.variantId),
      row = document.createElement("div");
    row.className = "cart-row";
    const name = document.createElement("div"),
      title = document.createElement(found ? "a" : "span");
    title.textContent = found?.product.title || text.unavailable;
    if (found) {
      const target = new URL(
        route(`/products/${encodeURIComponent(found.product.handle)}`),
        location.origin,
      );
      target.searchParams.set("variant", item.variantId);
      title.href = target.pathname + target.search;
    }
    name.append(title);
    if (found) {
      const options = document.createElement("small");
      options.textContent = found.variant.options
        .map((o) => `${o.name}: ${o.value}`)
        .join(" · ");
      name.append(options);
    }
    const detail = document.createElement("span");
    detail.textContent = found
      ? money(Number(found.variant.price) * item.quantity, catalog)
      : text.removeToContinue;
    function removeLine() {
      removed = {
        item: { ...item },
        label: title.textContent,
        index: cart.indexOf(item),
      };
      mutate(cart.filter((i) => i.variantId !== item.variantId));
    }
    const quantity = quantityControl(
      item.quantity,
      title.textContent,
      item.variantId,
      (next) => {
        if (next === 0) removeLine();
        else {
          item.quantity = next;
          mutate(cart);
        }
      },
      nb,
    );
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = text.remove;
    remove.setAttribute("aria-label", `${text.remove} ${title.textContent}`);
    remove.dataset.cartFocus = item.variantId + ":remove";
    remove.addEventListener("click", removeLine);
    row.append(name, detail, quantity, remove);
    const issue = stockIssues.get(item.variantId);
    if (found?.variant.outOfStock || issue) {
      const warning = document.createElement("p");
      warning.className = "cart-stock-error";
      warning.setAttribute("role", "status");
      warning.textContent =
        found?.variant.outOfStock || issue.maximumQuantity === 0
          ? text.outOfStock
          : text.stockLimit(issue.maximumQuantity);
      row.append(warning);
    }
    cartRoot.append(row);
    if (found) total += Number(found.variant.price) * item.quantity;
  }
  checkoutButton.disabled =
    starting ||
    cart.some(
      (i) =>
        !variants.has(i.variantId) ||
        variants.get(i.variantId).variant.outOfStock ||
        stockIssues.has(i.variantId),
    );
  cartTotal.textContent = `${text.total}: ${money(total, catalog)}`;
  restoreCartFocus(cartRoot, focus);
}
async function loadCart() {
  if (!cartRoot || loading) return loading;
  checkoutButton.disabled = true;
  cartRoot.textContent = text.loading;
  cartTotal.textContent = "";
  checkoutError.hidden = true;
  loading = (async () => {
    try {
      const response = await fetch(route("/catalog.json"), {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Catalog unavailable");
      catalog = await response.json();
      renderCart();
    } catch {
      catalog = null;
      cartRoot.textContent = text.cartError;
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "text-button";
      retry.textContent = text.retry;
      retry.addEventListener("click", loadCart);
      cartRoot.append(retry);
      checkoutButton.disabled = true;
    } finally {
      loading = null;
    }
  })();
  return loading;
}
if (cartRoot && !dialog) loadCart();
checkoutButton?.addEventListener("click", async () => {
  if (checkoutButton.disabled || starting) return;
  starting = true;
  checkoutButton.disabled = true;
  checkoutButton.textContent = text.opening;
  checkoutError.hidden = true;
  try {
    const response = await fetch(route("/checkout/start"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ lines: readCart() }),
    });
    const result = await response.json();
    if (!response.ok || !result.checkoutUrl) {
      stockIssues = new Map(
        (result.stockIssues || []).map((i) => [i.variantId, i]),
      );
      throw new Error(result.error || text.checkoutError);
    }
    location.assign(result.checkoutUrl);
  } catch (error) {
    report(error.message || text.checkoutError);
    checkoutError.focus();
    starting = false;
    checkoutButton.textContent = text.checkout;
    renderCart();
  }
});
window.addEventListener("storage", (event) => {
  if (event.key === CART_KEY) {
    updateCount();
    renderCart();
  }
});
document
  .querySelectorAll("[data-newsletter], [data-stock-signup]")
  .forEach((signup) =>
    signup.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget,
        button = form.querySelector("button"),
        status = form.querySelector("[data-newsletter-status]");
      if (
        button.disabled ||
        !form.reportValidity() ||
        !form.elements.consent.checked
      )
        return;
      button.disabled = true;
      status.textContent = text.signingUp;
      try {
        const response = await fetch(
          route(
            form.hasAttribute("data-stock-signup")
              ? "/stock/subscribe"
              : "/newsletter/subscribe",
          ),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: form.elements.email.value.trim(),
              consent: form.elements.consent.checked,
              website: form.elements.website?.value || "",
              locale: document.body.dataset.storeLocale,
              ...(form.hasAttribute("data-stock-signup")
                ? { variantId: form.elements.variantId.value }
                : {}),
            }),
          },
        );
        const result = await response.json();
        if (!response.ok || result.accepted !== true)
          throw new Error("Signup unavailable");
        status.textContent = text.signupSuccess;
        form.reset();
      } catch {
        status.textContent = text.signupError;
      } finally {
        button.disabled = false;
      }
    }),
  );
