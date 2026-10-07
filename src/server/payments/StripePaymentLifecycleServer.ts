import "server-only";
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { adminDb } from "@/src/lib/firebaseAdmin";
import {
  applyPaymentSignal,
  paymentAccessStatus,
  type PaymentSignal,
} from "./PaymentLifecycle";

const lifecycleRef = (paymentIntentId: string) =>
  adminDb.collection("stripePaymentLifecycle").doc(paymentIntentId);

// Both checkout activation and lifecycle changes read this document transactionally.
// A delayed checkout event can never reactivate a refunded payment.
export async function activatePaidEntitlement(
  reference: DocumentReference,
  data: Record<string, unknown>,
) {
  const intentId =
    typeof data.paymentIntentId === "string" ? data.paymentIntentId : null;
  await adminDb.runTransaction(async (transaction) => {
    const [current, lifecycle] = await Promise.all([
      transaction.get(reference),
      intentId
        ? transaction.get(lifecycleRef(intentId))
        : Promise.resolve(null),
    ]);
    const status = paymentAccessStatus(lifecycle?.data() ?? {});
    // A revoked old purchase must not downgrade access obtained through a newer purchase/code.
    if (
      status !== "active" &&
      current.exists &&
      current.data()?.status === "active" &&
      current.data()?.paymentIntentId !== intentId
    )
      return;
    transaction.set(
      reference,
      {
        ...data,
        status,
        active: status === "active",
        createdAt: current.data()?.createdAt ?? data.createdAt,
      },
      { merge: true },
    );
  });
}

export async function recordPaymentLifecycle({
  paymentIntentId,
  signal,
  eventId,
}: {
  paymentIntentId: string;
  signal: PaymentSignal;
  eventId: string;
}) {
  const reference = lifecycleRef(paymentIntentId);
  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    transaction.set(
      reference,
      {
        ...applyPaymentSignal(snapshot.data() ?? {}, signal),
        paymentIntentId,
        lastEventId: eventId,
        updatedAt: FieldValue.serverTimestamp(),
        ...(signal.type === "refund" && !signal.full
          ? { partialRefund: true }
          : {}),
      },
      { merge: true },
    );
  });
  for (const collection of ["gamesSubscriptions", "gamesGamePurchases"]) {
    const matches = await adminDb
      .collection(collection)
      .where("paymentIntentId", "==", paymentIntentId)
      .get();
    for (const match of matches.docs) {
      await adminDb.runTransaction(async (transaction) => {
        const [current, lifecycle] = await Promise.all([
          transaction.get(match.ref),
          transaction.get(reference),
        ]);
        if (current.data()?.paymentIntentId !== paymentIntentId) return;
        const state = lifecycle.data() ?? {};
        const status = paymentAccessStatus(state);
        // Restore only access suspended by this lifecycle, not access manually disabled elsewhere.
        if (
          status === "active" &&
          (current.data()?.paymentLifecycleManaged !== true ||
            current.data()?.status !== "suspended")
        )
          return;
        transaction.set(
          match.ref,
          {
            status,
            active: status === "active",
            paymentLifecycleManaged: true,
            partialRefund: state.partialRefund === true,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });
    }
  }
}
