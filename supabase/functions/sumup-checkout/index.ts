import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const sumupKey = Deno.env.get("SUMUP_API_KEY");
    if (!sumupKey) {
      return new Response(
        JSON.stringify({ error: "SumUp API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const merchantCode = Deno.env.get("SUMUP_MERCHANT_CODE");
    if (!merchantCode) {
      return new Response(
        JSON.stringify({ error: "SumUp merchant code not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // POST: create a checkout, store checkout_id, redirect to SumUp
    if (req.method === "POST") {
      const { orderId, amount, customerEmail, returnUrl } = await req.json();

      if (!orderId || !amount || !customerEmail || !returnUrl) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const checkoutRes = await fetch("https://api.sumup.com/v0.1/checkouts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sumupKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          checkout_reference: `declic-${orderId}`,
          amount: Number(amount),
          currency: "EUR",
          merchant_code: merchantCode,
          description: `Déclic Studio — Commande ${orderId}`,
          return_url: returnUrl,
          hosted_checkout: { enabled: true },
          custom_attributes: {
            receipt_email: customerEmail,
          },
        }),
      });

      if (!checkoutRes.ok) {
        const errText = await checkoutRes.text();
        return new Response(
          JSON.stringify({ error: "SumUp checkout creation failed", detail: errText }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const checkout = await checkoutRes.json();
      const checkoutId = checkout.id;
      const hostedCheckoutUrl = checkout.hosted_checkout_url || null;

      // Store checkout_id; do NOT mark as paid yet
      await supabase
        .from("orders")
        .update({ checkout_id: checkoutId })
        .eq("id", orderId);

      return new Response(
        JSON.stringify({ checkoutId, hostedCheckoutUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // GET: verify payment status for an order
    if (req.method === "GET") {
      const url = new URL(req.url);
      const orderId = url.searchParams.get("orderId");

      if (!orderId) {
        return new Response(
          JSON.stringify({ error: "Missing orderId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: order } = await supabase
        .from("orders")
        .select("id, checkout_id, payment_status")
        .eq("id", orderId)
        .maybeSingle();

      if (!order || !order.checkout_id) {
        return new Response(
          JSON.stringify({ paymentStatus: "pending" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Already marked paid in DB
      if (order.payment_status === "paid") {
        return new Response(
          JSON.stringify({ paymentStatus: "paid" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Query SumUp for the actual checkout status
      const statusRes = await fetch(
        `https://api.sumup.com/v0.1/checkouts/${order.checkout_id}`,
        {
          headers: { Authorization: `Bearer ${sumupKey}` },
        },
      );

      if (!statusRes.ok) {
        return new Response(
          JSON.stringify({ paymentStatus: "pending" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const checkoutData = await statusRes.json();
      const checkoutStatus = checkoutData.status; // "PAID" | "PENDING" | "FAILED"

      if (checkoutStatus === "PAID") {
        await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            paid_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        // Send receipt email only now, after confirmed payment
        const emailUrl = `${supabaseUrl}/functions/v1/send-email`;
        fetch(emailUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")!}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ type: "receipt", orderId }),
        }).catch(() => {});

        return new Response(
          JSON.stringify({ paymentStatus: "paid" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (checkoutStatus === "FAILED" || checkoutStatus === "EXPIRED") {
        return new Response(
          JSON.stringify({ paymentStatus: "failed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ paymentStatus: "pending" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
