import "server-only";
import { randomUUID } from "node:crypto";
import { adminDb } from "@/src/lib/firebaseAdmin";
import type { OperationalTask } from "@/src/types/OperationalTask";
import { validateTaskInput } from "./OperationsPolicy";
import {
  nextWeeklyDeadline,
  reminderTimes,
} from "@/functions/src/operationsPolicy";
import type { Transaction } from "firebase-admin/firestore";
const tasks = () => adminDb.collection("adminOperationalTasks");
function enqueue(transaction: Transaction, task: OperationalTask, now: number) {
  if (!task.pushEnabled) return;
  for (const reminder of reminderTimes(
    task.dueAtMs,
    task.reminderMinutes,
    now,
  )) {
    const id = `${task.id}_${task.revision}_${reminder.offset}`;
    transaction.create(
      adminDb.collection("adminOperationalReminders").doc(id),
      {
        taskId: task.id,
        taskRevision: task.revision,
        ownerId: task.ownerId,
        dueAtMs: reminder.sendAtMs,
        nextAttemptAtMs: reminder.sendAtMs,
        status: "pending",
        attempts: 0,
        createdAtMs: now,
      },
    );
  }
}
export async function listOperationalTasks(uid: string) {
  const [active, done, reminders] = await Promise.all([
    tasks()
      .where("ownerId", "==", uid)
      .where("status", "==", "open")
      .orderBy("dueAtMs", "asc")
      .limit(101)
      .get(),
    tasks()
      .where("ownerId", "==", uid)
      .where("status", "==", "done")
      .orderBy("completedAtMs", "desc")
      .limit(20)
      .get(),
    adminDb
      .collection("adminOperationalReminders")
      .where("ownerId", "==", uid)
      .orderBy("dueAtMs", "desc")
      .limit(30)
      .get(),
  ]);
  return {
    tasks: active.docs
      .slice(0, 100)
      .map((d) => ({ ...d.data(), id: d.id }) as OperationalTask),
    completed: done.docs.map(
      (d) => ({ ...d.data(), id: d.id }) as OperationalTask,
    ),
    hasMore: active.size > 100,
    reminders: reminders.docs.map((d) => ({
      id: d.id,
      taskId: d.data().taskId,
      status: d.data().status,
      reason: d.data().reason ?? null,
      dueAtMs: d.data().dueAtMs,
      taskRevision: d.data().taskRevision,
    })),
    serverNowMs: Date.now(),
  };
}
export async function createOperationalTask(uid: string, input: unknown) {
  const now = Date.now();
  const data = validateTaskInput(input, now);
  const task: OperationalTask = {
    ...data,
    id: randomUUID(),
    ownerId: uid,
    status: "open",
    revision: 1,
    createdAtMs: now,
    updatedAtMs: now,
  };
  await adminDb.runTransaction(async (transaction) => {
    transaction.create(tasks().doc(task.id), task);
    enqueue(transaction, task, now);
  });
  return task;
}
export async function mutateOperationalTask(
  uid: string,
  body: Record<string, unknown>,
) {
  const id = body.id;
  if (typeof id !== "string" || !/^[\w-]{1,128}$/.test(id))
    throw new Error("INVALID_INPUT");
  const now = Date.now();
  let nextId: string | null = null;
  await adminDb.runTransaction(async (transaction) => {
    const ref = tasks().doc(id);
    const snapshot = await transaction.get(ref);
    const task = snapshot.data() as OperationalTask | undefined;
    if (!task || task.ownerId !== uid) throw new Error("NOT_FOUND");
    if (typeof body.revision !== "number" || body.revision !== task.revision)
      throw new Error("CONFLICT");
    if (body.action === "complete") {
      if (task.status !== "open") throw new Error("CONFLICT");
      transaction.update(ref, {
        status: "done",
        completedAtMs: now,
        updatedAtMs: now,
        revision: task.revision + 1,
      });
      if (task.repeat === "weekly") {
        const next: OperationalTask = {
          ...task,
          id: randomUUID(),
          dueAtMs: nextWeeklyDeadline(task.dueAtMs, now),
          status: "open",
          revision: 1,
          createdAtMs: now,
          updatedAtMs: now,
        };
        delete next.completedAtMs;
        transaction.create(tasks().doc(next.id), next);
        enqueue(transaction, next, now);
        nextId = next.id;
      }
    } else if (body.action === "archive") {
      transaction.update(ref, {
        status: "archived",
        revision: task.revision + 1,
        updatedAtMs: now,
      });
    } else if (body.action === "update") {
      if (task.status !== "open") throw new Error("CONFLICT");
      const data = validateTaskInput(body.task, now);
      const next: OperationalTask = {
        ...task,
        ...data,
        revision: task.revision + 1,
        updatedAtMs: now,
      };
      transaction.set(ref, next);
      enqueue(transaction, next, now);
    } else throw new Error("INVALID_INPUT");
  });
  return { id, nextId };
}
