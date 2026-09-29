const CART_KEY = "reai-storefront-cart-v1";
const CHECKOUT_KEY = "reai-storefront-checkout-started";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readCart() {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => UUID.test(item.variantId)
      && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 20) : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  document.querySelectorAll("[data-cart-count]").forEach((node) => {
    node.textContent = String(cart.reduce((sum, item) => sum + item.quantity, 0));
  });
}

try { saveCart(readCart()); } catch { /* The cart will report storage failure when used. */ }

const addForm = document.querySelector("[data-add-to-cart]");
addForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const variantId = addForm.elements.variantId.value;
  const quantity = Number(addForm.elements.quantity.value);
  const message = addForm.querySelector("[data-add-message]");
  if (!UUID.test(variantId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return;
  const cart = readCart();
  const existing = cart.find((item) => item.variantId === variantId);
  if (existing) existing.quantity = Math.min(existing.quantity + quantity, 20);
  else cart.push({ variantId, quantity });
  try {
    saveCart(cart);
    message.textContent = "Added to cart.";
  } catch {
    message.textContent = "Your browser could not save the cart.";
  }
});

const cartRoot = document.querySelector("[data-cart-items]");
if (cartRoot) {
  const checkoutButton = document.querySelector("[data-start-checkout]");
  const checkoutError = document.querySelector("[data-checkout-error]");
  const cartTotal = document.querySelector("[data-cart-total]");
  let catalog = null;

  function render() {
    const cart = readCart();
    const variants = new Map((catalog?.products || []).flatMap((product) =>
      (product.variants || []).map((variant) => [variant.id, { product, variant }])));
    cartRoot.replaceChildren();
    if (!cart.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Your cart is empty.";
      cartRoot.append(empty);
      checkoutButton.disabled = true;
      cartTotal.textContent = "";
      return;
    }
    let total = 0;
    for (const item of cart) {
      const found = variants.get(item.variantId);
      const row = document.createElement("div");
      row.className = "cart-row";
      const title = document.createElement(found ? "a" : "span");
      if (found) title.href = `/products/${encodeURIComponent(found.product.handle)}`;
      title.textContent = found?.product.title || "Unavailable product";
      const detail = document.createElement("span");
      detail.textContent = found ? new Intl.NumberFormat(catalog.locale, { style: "currency", currency: catalog.currency })
        .format(Number(found.variant.price)) : "Remove this item to continue";
      const quantity = document.createElement("input");
      quantity.type = "number";
      quantity.min = "1";
      quantity.max = "20";
      quantity.value = String(item.quantity);
      quantity.setAttribute("aria-label", `Quantity for ${title.textContent}`);
      quantity.addEventListener("change", () => {
        const next = Number(quantity.value);
        if (Number.isInteger(next) && next >= 1 && next <= 20) {
          item.quantity = next;
          saveCart(cart);
        }
        render();
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        saveCart(cart.filter((entry) => entry.variantId !== item.variantId));
        render();
      });
      row.append(title, detail, quantity, remove);
      cartRoot.append(row);
      if (found) total += Number(found.variant.price) * item.quantity;
    }
    checkoutButton.disabled = cart.some((item) => !variants.has(item.variantId));
    cartTotal.textContent = `Estimated total: ${new Intl.NumberFormat(catalog.locale, { style: "currency", currency: catalog.currency }).format(total)}`;
  }

  fetch("/catalog.json").then((response) => {
    if (!response.ok) throw new Error("Catalog unavailable");
    return response.json();
  }).then((value) => {
    catalog = value;
    render();
  }).catch(() => {
    cartRoot.textContent = "The cart is temporarily unavailable. Please try again.";
  });

  checkoutButton.addEventListener("click", async () => {
    if (checkoutButton.disabled) return;
    checkoutButton.disabled = true;
    checkoutButton.textContent = "Opening checkout…";
    checkoutError.hidden = true;
    try {
      const response = await fetch("/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ lines: readCart() }),
      });
      const result = await response.json();
      if (!response.ok || !result.checkoutUrl) throw new Error(result.detail || result.error || "Checkout could not be started.");
      sessionStorage.setItem(CHECKOUT_KEY, "1");
      location.assign(result.checkoutUrl);
    } catch (error) {
      checkoutError.textContent = error.message || "Checkout could not be started.";
      checkoutError.hidden = false;
      checkoutError.focus();
      checkoutButton.textContent = "Continue to checkout";
      render();
    }
  });
}

if (document.querySelector("[data-checkout-complete]")) {
  if (sessionStorage.getItem(CHECKOUT_KEY) === "1") {
    localStorage.removeItem(CART_KEY);
    sessionStorage.removeItem(CHECKOUT_KEY);
    saveCart([]);
  }
}
