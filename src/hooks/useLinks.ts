import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Utility function to format time since last click
export const formatTimeAgo = (dateString: string | null): string => {
  if (!dateString) return 'Never';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const diffInMonths = Math.floor(diffInDays / 30);
  const diffInYears = Math.floor(diffInDays / 365);
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  if (diffInDays < 30) return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  if (diffInMonths < 12) return `${diffInMonths} month${diffInMonths === 1 ? '' : 's'} ago`;
  return `${diffInYears} year${diffInYears === 1 ? '' : 's'} ago`;
};

export interface Link {
  id: string;
  original_url: string;
  short_code: string;
  short_url: string;
  title?: string;
  status: 'active' | 'inactive' | 'expired';
  created_at: string;
  expires_at?: string;
  analytics_enabled: boolean;
  total_clicks?: number;
  unique_clicks?: number;
  yesterday_clicks?: number;
  today_clicks?: number;
  last_click_time?: string;
}

export interface LinkSettings {
  customDomain?: string;
  analyticsEnabled: boolean;
  expiresAt?: string;
  password?: string;
  // new optional fields for advanced creation
  customAlias?: string;
  description?: string;
  channelId?: string;
  campaignId?: string;
  pixelIds?: string[];
  redirectType?: string;
}

export const useLinks = () => {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);
  const [hasMore, setHasMore] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const { toast } = useToast();
  
  // Set up real-time subscription for clicks
  useEffect(() => {
    console.log('🔔 Setting up real-time subscriptions for clicks');
    
    // Subscribe to clicks table insertions
    const clicksSubscription = supabase
      .channel('clicks-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'clicks'
        },
        (payload) => {
          console.log('🔔 New click received:', payload);
          const newClick = payload.new;
          if (newClick.link_id) {
            // Update stats for this specific link
            updateLinkStats(newClick.link_id);
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      console.log('🔕 Cleaning up real-time subscriptions');
      clicksSubscription.unsubscribe();
    };
  }, []); // Empty dependency array - set up once on mount

  // Function to update individual link statistics
  const updateLinkStats = async (linkId: string) => {
    try {
      const { data: clicksData, error } = await supabase
        .from('clicks')
        .select('id, ip_address, created_at')
        .eq('link_id', linkId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`Error fetching clicks for link ${linkId}:`, error);
        return;
      }

      const totalClicks = clicksData?.length || 0;
      const uniqueIPs = new Set(clicksData?.map(click => click.ip_address).filter(Boolean) || []);
      const uniqueClicks = uniqueIPs.size;

      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const todayClicks = clicksData?.filter(click => 
        click.created_at?.startsWith(today)
      ).length || 0;

      const yesterdayClicks = clicksData?.filter(click => 
        click.created_at?.startsWith(yesterday)
      ).length || 0;

      const lastClickTime = clicksData?.[0]?.created_at || null;

      // Update the specific link in the state
      setLinks(prevLinks => 
        prevLinks.map(link => 
          link.id === linkId 
            ? {
                ...link,
                total_clicks: totalClicks,
                unique_clicks: uniqueClicks,
                today_clicks: todayClicks,
                yesterday_clicks: yesterdayClicks,
                last_click_time: lastClickTime
              }
            : link
        )
      );
    } catch (error) {
      console.error(`Error updating stats for link ${linkId}:`, error);
    }
  };

  const fetchLinks = async (showLogs = false, pageArg?: number) => {
    try {
      setLoading(true);
      const currentPage = pageArg ?? page;
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLinks([]);
        return;
      }
      
      console.log('🔗🔄 fetchLinks called - showLogs:', showLogs, 'user:', user?.id);
      
      if (showLogs) {
        console.log('Fetching links for user:', user.id);
      }
      
      // Get links for current user only (exclude archived) with pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      const result = await (supabase as any)
        .from('links')
        .select('id, original_url, short_code, short_url, title, status, created_at, expires_at, analytics_enabled')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .range(from, to);
      
      const { data: linksData, error: linksError } = result;

      if (linksError) {
        console.error('Error fetching links:', linksError);
        throw linksError;
      }

      // Process links to include total click counts from actual clicks table
      const processedLinks = await Promise.all(linksData?.map(async (link) => {
        // Get actual click counts from clicks table
        const { data: clicksData, error: clicksError } = await supabase
          .from('clicks')
          .select('id, ip_address, clicked_at')
          .eq('link_id', link.id)
          .order('clicked_at', { ascending: false });
        
        if (clicksError) {
          console.error(`Error fetching clicks for link ${link.short_code}:`, clicksError);
        }
        
        const totalClicks = clicksData?.length || 0;
        
        // Calculate unique clicks based on IP address
        const uniqueIPs = new Set(clicksData?.map(click => click.ip_address).filter(Boolean) || []);
        const uniqueClicks = uniqueIPs.size;
        
        // Calculate today's and yesterday's clicks
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const todayClicks = clicksData?.filter(click => 
          click.clicked_at?.startsWith(today)
        ).length || 0;
        
        const yesterdayClicks = clicksData?.filter(click => 
          click.clicked_at?.startsWith(yesterday)
        ).length || 0;
        
        // Get the most recent click time
        const lastClickTime = clicksData?.[0]?.clicked_at || null;
        
        if (showLogs) {
          console.log(`Link ${link.short_code}: total=${totalClicks}, unique=${uniqueClicks}, today=${todayClicks}, yesterday=${yesterdayClicks}`);
        }
        
        return {
          ...link,
          total_clicks: totalClicks,
          unique_clicks: uniqueClicks,
          today_clicks: todayClicks,
          yesterday_clicks: yesterdayClicks,
          last_click_time: lastClickTime
        };
      }) || []);

      console.log('🔗📊 Processed links with updated counts:', processedLinks.map(l => `${l.short_code}: ${l.total_clicks}/${l.unique_clicks}`));
      
      if (showLogs) {
        console.log('Processed links:', processedLinks);
      }
      setLinks(processedLinks);
      // Determine if more pages are available by checking if we got a full page
      setHasMore((linksData?.length || 0) === pageSize);
      console.log('🔗✅ Links state updated with new counts');
      
      // Force a re-render to ensure UI updates
      if (processedLinks.length > 0) {
        console.log('🔗🔄 Forcing UI update for individual link cards');
      }
    } catch (error) {
      console.error('Error fetching links:', error);
      toast({
        title: "Error",
        description: "Failed to fetch links",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const shortenUrl = async (url: string, settings: LinkSettings = { analyticsEnabled: true }) => {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('shorten-url', {
        body: {
          url,
          customDomain: settings.customDomain,
          expiresAt: settings.expiresAt,
          password: settings.password,
          analyticsEnabled: settings.analyticsEnabled,
          customAlias: settings.customAlias,
          description: settings.description,
          channelId: settings.channelId,
          campaignId: settings.campaignId,
          pixelIds: settings.pixelIds,
          redirectType: settings.redirectType
        }
      });

      // Check for Supabase function invocation errors
      if (error) {
        console.error('Edge Function invocation error:', error);
        const errorMessage = error.message || 'Failed to invoke shorten-url function';
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        throw new Error(errorMessage);
      }

      // Check for errors in the response data
      if (data?.error) {
        console.error('Edge Function returned error:', data.error);
        const errorMessage = typeof data.error === 'string' 
          ? data.error 
          : data.error?.message || 'Failed to shorten URL';
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        throw new Error(errorMessage);
      }

      if (data?.success) {
        toast({
          title: "Success!",
          description: "Link shortened successfully",
        });
        
        // Refresh links list
        await fetchLinks();
        
        return data.data;
      } else {
        // Fallback error if no success flag and no error message
        const errorMessage = 'Failed to shorten URL. Please try again.';
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error shortening URL:', error);
      
      // Only show toast if we haven't already shown one
      if (!(error instanceof Error && error.message.includes('Failed to invoke') || error.message.includes('Edge Function returned'))) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to shorten URL",
        variant: "destructive",
      });
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteLink = async (linkId: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('delete-link', {
        body: {
          ids: [linkId],
        },
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Link deleted successfully",
      });

      await fetchLinks();
      return data;
    } catch (error) {
      console.error('Error deleting link:', error);
      toast({
        title: "Error",
        description: "Failed to delete link",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateLink = async (linkId: string, updateData: any) => {
    try {
      setLoading(true);
  
      const { data, error } = await supabase.functions.invoke("update-link", {
        body: {
          id: linkId,
          ...updateData
        }
      });
  
      if (error) throw error;
  
      toast({
        title: "Success!",
        description: "Link updated successfully",
      });
  
      await fetchLinks();
  
      return data;
  
    } catch (error) {
      console.error("Error updating link:", error);
  
      toast({
        title: "Error",
        description: "Failed to update link",
        variant: "destructive",
      });
  
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch only - no automatic refreshes
    fetchLinks(true, 1);

    // Set up real-time subscription for link updates
    console.log('🔗🔧 useLinks: Setting up links subscription');
    const linksSubscription = supabase
      .channel('links-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'clicks'
      }, async (payload) => {
        console.log('🔗📊 useLinks: Real-time click detected:', payload);
        const newClick = payload.new;
        
        // Get current user to check if this click belongs to their links
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get the link details for this click
        const { data: link } = await supabase
          .from('links')
          .select('id, user_id')
          .eq('id', newClick.link_id)
          .eq('user_id', user.id)
          .single();

        if (link) {
          // Update the specific link's statistics efficiently
          await updateLinkStats(link.id);
          setLastRefresh(Date.now());
          
          // Show a subtle notification for new clicks
          console.log('🎉 New click detected for link:', link.id);
        }
      })
      .subscribe();
    console.log('🔗✅ useLinks: Links subscription established');

    // Auto-refresh every 60 seconds to ensure data stays current
    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing links data...');
      fetchLinks(false, 1); // Refresh first page
      setLastRefresh(Date.now());
    }, 60000);
    
    return () => {
      supabase.removeChannel(linksSubscription);
      clearInterval(refreshInterval);
    };
  }, []);

  const nextPage = async () => {
    const next = page + 1;
    setPage(next);
    await fetchLinks(false, next);
  };

  const prevPage = async () => {
    const prev = Math.max(1, page - 1);
    setPage(prev);
    await fetchLinks(false, prev);
  };

  return {
    links,
    loading,
    page,
    pageSize,
    hasMore,
    nextPage,
    prevPage,
    shortenUrl,
    deleteLink,
    updateLink,
    refreshLinks: fetchLinks
  };
};