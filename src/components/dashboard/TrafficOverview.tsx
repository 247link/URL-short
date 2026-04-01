import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
 
import DailyClicksChart from "@/components/analytics/DailyClicksChart";

const TrafficOverview = () => {
  // Set to current month for real data
  const now = new Date();
  // Default to last 15 days
  const [startDate, setStartDate] = useState(
  new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
);
  const [endDate, setEndDate] = useState<Date>(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const formatDateRange = (start: Date, end: Date) => {
    return `${format(start, "MM/dd/yyyy")} - ${format(end, "MM/dd/yyyy")}`;
  };

  

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-card-foreground bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
            Traffic Overview
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Monitor your link performance in real-time</p>
        </div>
        
        {/* Date Range Picker */}
        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className="flex items-center space-x-2 w-full sm:w-fit hover-lift hover:border-primary transition-all duration-300 group"
            >
              <CalendarDays className="w-4 h-4 group-hover:text-primary transition-colors" />
              <span className="text-sm font-medium truncate">{formatDateRange(startDate, endDate)}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-card border-card-border shadow-lg z-50 mx-4 sm:mx-0" align="start">
            <div className="p-3 sm:p-4 space-y-4">
              <div className="text-sm font-medium text-card-foreground">Select Date Range</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Start Date</label>
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    className={cn("p-2 sm:p-3 pointer-events-auto")}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">End Date</label>
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    className={cn("p-2 sm:p-3 pointer-events-auto")}
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2">
                <Button variant="outline" size="sm" onClick={() => setIsDatePickerOpen(false)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button size="sm" onClick={() => setIsDatePickerOpen(false)} className="w-full sm:w-auto">
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Metrics removed from graph view as requested */}

      {/* New dynamic chart component */}
      <DailyClicksChart from={startDate} to={endDate} />
    </div>
  );
};

export default TrafficOverview;