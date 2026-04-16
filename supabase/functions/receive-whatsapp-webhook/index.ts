// ============================================================
// supabase/functions/receive-whatsapp-webhook/index.ts
// Receives incoming WhatsApp webhook events (POST)
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  // Meta sends a GET for verification - delegate to verify function
  // (In production, you may want a single unified endpoint)
  if (req.method === "GET") {
    const url       = new URL(req.url);
    const mode      = url.searchParams.get("hub.mode");
    const token     = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

    if (mode === "subscribe" && token === verifyToken) {
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  // ---- Determine event type ---- //
  const entry   = payload?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value   = changes?.value;

  let eventType = "unknown";
  if (value?.statuses) eventType = "status_update";
  if (value?.messages) eventType = "incoming_message";

  // ---- Find user by WABA ID or phone number ID ---- //
  let userId: string | null = null;
  const wabaId = entry?.id;

  if (wabaId) {
    const { data: settings } = await supabase
      .from("integration_settings")
      .select("user_id")
      .eq("waba_id", wabaId)
      .maybeSingle();

    userId = settings?.user_id ?? null;
  }

  // ---- Log webhook ---- //
  await supabase.from("webhook_logs").insert({
    user_id:    userId,
    event_type: eventType,
    payload,
  });

  // ---- Update last_webhook_at ---- //
  if (userId) {
    await supabase
      .from("integration_settings")
      .update({ last_webhook_at: new Date().toISOString() })
      .eq("user_id", userId);
  }

  // ---- Process status updates ---- //
  if (eventType === "status_update" && value?.statuses) {
    await processStatusUpdates(supabase, value.statuses);
  }

  // ---- Phase 2: Process incoming messages ---- //
  // if (eventType === "incoming_message" && value?.messages) {
  //   await processIncomingMessages(supabase, userId, value.messages, value.contacts);
  // }

  return new Response("OK", { status: 200 });
});

// ---- Status Update Handler ---- //

async function processStatusUpdates(supabase: any, statuses: any[]) {
  for (const status of statuses) {
    const waMessageId = status.id;
    const newStatus   = mapWaStatus(status.status);
    const timestamp   = status.timestamp
      ? new Date(parseInt(status.timestamp) * 1000).toISOString()
      : new Date().toISOString();

    if (!waMessageId || !newStatus) continue;

    // Build update payload
    const update: any = {
      status:     newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === "sent")      update.sent_at      = timestamp;
    if (newStatus === "delivered") update.delivered_at = timestamp;
    if (newStatus === "read")      update.read_at      = timestamp;
    if (newStatus === "failed") {
      update.failed_at      = timestamp;
      update.error_message  = status.errors?.[0]?.message || "Unknown error";
    }

    const { error } = await supabase
      .from("campaign_recipients")
      .update(update)
      .eq("wa_message_id", waMessageId);

    if (error) {
      console.error("Error updating recipient status:", error, { waMessageId });
    }
  }
}

// Map WhatsApp status strings to our DB values
function mapWaStatus(waStatus: string): string | null {
  const map: Record<string, string> = {
    sent:      "sent",
    delivered: "delivered",
    read:      "read",
    failed:    "failed",
  };
  return map[waStatus] ?? null;
}
