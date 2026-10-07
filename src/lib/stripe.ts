import "server-only";

import Stripe from "stripe";

const stripeSecretKey =
  process.env.STRIPE_SECRET_KEY;

export const stripeLiveMode =
  process.env.STRIPE_LIVE_MODE
    ?.trim()
    .toLowerCase() ===
  "true";

if (!stripeSecretKey) {
  throw new Error(
    "Variabile STRIPE_SECRET_KEY non configurata.",
  );
}

if (
  stripeLiveMode &&
  !stripeSecretKey.startsWith(
    "sk_live_",
  ) &&
  !stripeSecretKey.startsWith(
    "rk_live_",
  )
) {
  throw new Error(
    "STRIPE_LIVE_MODE è attivo, ma STRIPE_SECRET_KEY non è una chiave live.",
  );
}

export const stripe =
  new Stripe(
    stripeSecretKey,
  );
