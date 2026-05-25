# Ecommerce Adapter Templates

This directory contains contract-compliant reference adapters and a standard template.

## Structure

```
ecommerce/
├── TEMPLATE.js          ← Standard template with all required contract fields
├── reference/
│   └── search.js        ← ysbang/search (13/13 bb-eval pass, the gold standard)
└── fixed/
    ├── auth.js           ← Fixed: added HOME_URL constant (was 1 fail)
    ├── cart-update.js    ← Fixed: added HOME_URL + readOnly check (was 2 fail)
    ├── cart-remove.js    ← Already compliant (was false positive from bb-eval bug)
    ├── add-to-cart.js    ← Already compliant (was false positive)
    ├── checkout.js       ← Already compliant (was false positive)
    ├── select-best-add.js ← Already compliant (was false positive)
    ├── store-select.js   ← Already compliant (was false positive)
    ├── switch-store.js   ← Already compliant (was false positive)
    └── product-detail.js ← Fixed: added HOME_URL constant (was 1 fail)
```

## How to use

1. Copy `TEMPLATE.js` as your starting point
2. Replace `EXAMPLE_SITE` with your actual site name
3. Run `tools/bb-eval <your-adapter.js>` — must get 0 fail
4. Warnings are OK (they indicate areas for improvement)

## bb-eval bug fix (2026-05-18)

The `meta_get()` function used `jq -r '.field // empty'` which treats `false` and `0` 
as missing (jq's `//` operator is "alternative", not "default"). This caused adapters 
with `"readOnly": false` to falsely fail the meta-field-readOnly check.

**Fix**: Added `meta_has()` function using `jq -e --arg k "$key" 'has($k) and (.[$k] != null)'`
which correctly checks field existence regardless of value.

Affected adapters: cart-remove, add-to-cart, checkout, select-best-add, store-select, 
switch-store (all had `readOnly: false`).
