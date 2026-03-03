import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Simple Upstash Redis helper (same env vars as update-link / track-click)
const redis = {
  async del(key: string) {
    const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

    if (!url || !token) return;

    await fetch(`${url}/del/${key}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { ids, id } = body as { ids?: string[]; id?: string };

    // Normalize to an array of IDs
    const linkIds: string[] = Array.isArray(ids)
      ? ids.filter(Boolean)
      : id
      ? [id]
      : [];

    if (linkIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "No link IDs provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch short_codes for Redis invalidation
    const { data: links, error: fetchError } = await supabase
      .from("links")
      .select("id, short_code")
      .in("id", linkIds);

    if (fetchError) {
      console.error("Error fetching links before delete:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch links before delete" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const foundIds = (links ?? []).map((l: any) => l.id);

    if (foundIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, deleted: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete related analytics first (clicks + analytics_daily)
    const { error: clicksError } = await supabase
      .from("clicks")
      .delete()
      .in("link_id", foundIds);

    if (clicksError) {
      console.error("Error deleting clicks:", clicksError);
      // continue; not fatal for link delete
    }

    const { error: analyticsError } = await supabase
      .from("analytics_daily")
      .delete()
      .in("link_id", foundIds);

    if (analyticsError) {
      console.error("Error deleting analytics_daily:", analyticsError);
      // continue
    }

    // Delete links themselves
    const { error: linksError } = await supabase
      .from("links")
      .delete()
      .in("id", foundIds);

    if (linksError) {
      console.error("Error deleting links:", linksError);
      return new Response(
        JSON.stringify({ error: "Failed to delete links" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invalidate Redis cache for each short_code
    try {
      await Promise.all(
        (links ?? []).map((link: any) =>
          link.short_code
            ? redis.del(`link:${link.short_code}`)
            : Promise.resolve()
        )
      );
    } catch (cacheError) {
      console.error("Error clearing Redis cache for deleted links:", cacheError);
      // not fatal
    }

    return new Response(
      JSON.stringify({ success: true, deleted: foundIds.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("delete-link function error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: err?.message ?? "Unexpected error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

