// ============================================================
// supabase/functions/verify-whatsapp-webhook/index.ts
// Handles Meta webhook verification challenge (GET request)
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url    = new URL(req.url);
  const mode   = url.searchParams.get("hub.mode");
  const token  = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  // Retrieve secret verify token from Supabase secrets
  const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

  if (!verifyToken) {
    console.error("WHATSAPP_VERIFY_TOKEN secret not set");
    return new Response("Server configuration error", { status: 500 });
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("Webhook verified successfully");
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("Webhook verification failed", { mode, token });
  return new Response("Forbidden", { status: 403 });
});
