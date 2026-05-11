// tests/fixtures/handler.ts
//
// One function, six responsibilities. The classic shape srp-refactor is
// built to attack: an HTTP handler that grew to own routing, validation,
// pricing, persistence, customer notifications, and observability — all
// in one place.
//
// This file exists purely as fixture material for the test specs in
// tests/. It is not imported anywhere; the imports below are deliberately
// fictional so the file stays self-contained.

import { db } from "../../src/db";
import { logger } from "../../src/logger";
import { mailer } from "../../src/mailer";
import { metrics } from "../../src/metrics";

export async function handleOrder(req: Request): Promise<Response> {
	// 1. Parse + validate request.
	const body = await req.json();
	if (!body.userId || typeof body.userId !== "string") {
		return new Response("missing userId", { status: 400 });
	}
	if (!Array.isArray(body.items) || body.items.length === 0) {
		return new Response("missing items", { status: 400 });
	}
	for (const it of body.items) {
		if (
			typeof it.sku !== "string" ||
			typeof it.qty !== "number" ||
			it.qty < 1
		) {
			return new Response("bad item", { status: 400 });
		}
	}

	// 2. Compute pricing.
	let subtotal = 0;
	for (const it of body.items) {
		const price = await db.query("SELECT price FROM products WHERE sku = ?", [
			it.sku,
		]);
		subtotal += price * it.qty;
	}
	const tax = subtotal * 0.2;
	const total = subtotal + tax;

	// 3. Persist.
	const orderId = await db.insert("orders", {
		userId: body.userId,
		items: JSON.stringify(body.items),
		subtotal,
		tax,
		total,
		status: "pending",
		createdAt: new Date().toISOString(),
	});

	// 4. Send confirmation email.
	const user = await db.queryOne("SELECT email, name FROM users WHERE id = ?", [
		body.userId,
	]);
	await mailer.send({
		to: user.email,
		subject: `Order ${orderId} confirmed`,
		body: `Hi ${user.name},\n\nWe got your order. Total: $${total.toFixed(2)}.`,
	});

	// 5. Audit log.
	logger.info("order.created", { orderId, userId: body.userId, total });

	// 6. Metrics.
	metrics.increment("orders.created");
	metrics.gauge("orders.last_total", total);

	return new Response(JSON.stringify({ orderId, total }), {
		status: 201,
		headers: { "content-type": "application/json" },
	});
}
