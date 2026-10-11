// Small shared DOM controls, also shipped with the standalone starter.
export function quantityControl(value, label, key, change, nb) {
  const wrap = document.createElement("div");
  wrap.className = "cart-quantity-control";
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = "20";
  input.value = String(value);
  input.setAttribute(
    "aria-label",
    `${nb ? "Antall for" : "Quantity for"} ${label}`,
  );
  input.dataset.cartFocus = key + ":input";
  input.addEventListener("focus", () => input.select());
  input.addEventListener("change", () => {
    const next = Number(input.value);
    if (Number.isInteger(next) && next >= 0 && next <= 20) change(next);
    else input.value = String(value);
  });
  for (const delta of [-1, 1]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = delta < 0 ? "−" : "+";
    button.setAttribute(
      "aria-label",
      `${delta < 0 ? (nb ? "Reduser" : "Decrease") : nb ? "Øk" : "Increase"} ${label}`,
    );
    button.dataset.cartFocus = key + (delta < 0 ? ":minus" : ":plus");
    button.disabled = delta > 0 && value >= 20;
    button.addEventListener("click", () => change(value + delta));
    wrap.append(button);
    if (delta < 0) wrap.append(input);
  }
  return wrap;
}
export function undoControl(label, restore, nb) {
  const box = document.createElement("div");
  box.className = "cart-undo";
  box.setAttribute("role", "status");
  const text = document.createElement("span");
  text.textContent = `${label} ${nb ? "er fjernet." : "was removed."}`;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = nb ? "Angre" : "Undo";
  button.dataset.cartUndo = "";
  button.dataset.cartFocus = "undo";
  button.addEventListener("click", restore);
  box.append(text, button);
  return box;
}
export function rememberCartFocus(root) {
  const active = document.activeElement;
  return root.contains(active) ? active.dataset.cartFocus : null;
}
export function restoreCartFocus(root, key) {
  if (!key) return;
  const button = [...root.querySelectorAll("[data-cart-focus]")].find(
    (b) => b.dataset.cartFocus === key,
  );
  if (button && !button.disabled) button.focus();
  else
    (
      root.querySelector("[data-cart-undo]") ||
      root.querySelector(".cart-quantity-control input")
    )?.focus();
}
