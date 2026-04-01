import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useMemo, useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, TrendingUp, BarChart3 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type DailyClicksChartProps = {
  from: Date;
  to: Date;
  linkId?: string;
  showMetrics?: boolean;
};

type ChartDataPoint = {
  date: string;
  clicks: number;
  unique: number;
  formattedDate: string;
};

const chartConfig = {
  clicks: {
    label: "Total Clicks",
    color: "hsl(217 91% 60%)",
  },
};

export default function DailyClicksChart({ from, to, showMetrics = true }: DailyClicksChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  const [totalAllTime, setTotalAllTime] = useState(0);
  const [totalInPeriod, setTotalInPeriod] = useState(0);
  const [totalToday, setTotalToday] = useState(0);

  const rangeLabel = useMemo(() => {
    const fmt = (d: Date) =>
      `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
    return `${fmt(from)} – ${fmt(to)}`;
  }, [from, to]);

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        setLoading(true);

        const {
          data: { user }
        } = await supabase.auth.getUser();

        if (!user) {
          setChartData([]);
          setLoading(false);
          return;
        }

        // ✅ Fetch aggregated daily data
        const { data, error } = await supabase
          .from("daily_clicks_view")
          .select("date, total_clicks")
          .eq("user_id", user.id)
          .gte("date", format(from, "yyyy-MM-dd"))
          .lte("date", format(to, "yyyy-MM-dd"))
          .order("date", { ascending: true });

        if (error) throw error;

        // ✅ Build chart data
        const dataPoints: ChartDataPoint[] = (data || []).map((row: any) => ({
          date: row.date,
          clicks: row.total_clicks,
          unique: 0,
          formattedDate: format(new Date(row.date), "dd MMM")
        }));

        // ✅ Total in selected range
        const periodCount = (data || []).reduce(
          (sum: number, d: any) => sum + d.total_clicks,
          0
        );

        // ✅ Today count (NO timezone bug)
        const todayStr = format(new Date(), "yyyy-MM-dd");

        const todayCount =
          (data || []).find((d: any) => d.date === todayStr)?.total_clicks || 0;

        setChartData(dataPoints);
        setTotalInPeriod(periodCount);
        setTotalToday(todayCount);

        // (optional: keep or remove)
        setTotalAllTime(periodCount);

      } catch (error) {
        console.error("Error fetching chart data:", error);
        setChartData([]);
        setTotalAllTime(0);
        setTotalInPeriod(0);
        setTotalToday(0);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [from, to]);

  if (loading) {
    return (
      <Card className="p-4 md:p-6">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">Daily Clicks</h3>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
          <div className="mt-4 flex items-center justify-center py-8">
            <div className="text-center">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading chart data...</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const maxClicks = Math.max(...chartData.map(d => d.clicks), 0);
  const yAxisMax = Math.max(10, Math.ceil(maxClicks * 1.1));

  return (
    <Card className="p-4 md:p-6 shadow-card border-card-border">
      <div className="flex flex-col gap-4">

        <div className="flex justify-between">
          <h3 className="text-lg font-semibold">Daily Clicks</h3>
          {showMetrics && (
            <div className="flex gap-4 text-sm">
              <div>Total: {totalAllTime}</div>
              <div>Period: {totalInPeriod}</div>
              <div>Today: {totalToday}</div>
            </div>
          )}
        </div>

        {chartData.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">
            No data available
          </div>
        ) : (
          <div className="h-64 w-full">
            <ChartContainer config={chartConfig}>
  <div className="w-full h-full">
    <BarChart
      width={isMobile ? 300 : 800}
      height={250}
      data={chartData}
      margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
    >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="formattedDate" />
                <YAxis domain={[0, yAxisMax]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="clicks" fill="hsl(217 91% 60%)" />
              </BarChart>
              </div>
            </ChartContainer>
          </div>
        )}
      </div>
    </Card>
  );
}