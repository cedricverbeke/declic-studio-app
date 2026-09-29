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
    const { orderId, amount, customerEmail, returnUrl } = await req.json();

    if (!orderId || !amount || !customerEmail || !returnUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
        merchant_code: Deno.env.get("SUMUP_MERCHANT_CODE") || "",
        description: `Déclic Studio — Commande ${orderId}`,
        return_url: returnUrl,
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
    const clientSecret = checkout.client_secret;

    const checkoutUrl = `https://api.sumup.com/v0.1/checkouts/${checkoutId}`;

    await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({ checkoutId, clientSecret, checkoutUrl, hostedCheckoutUrl: checkout.hosted_checkout_url || null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
