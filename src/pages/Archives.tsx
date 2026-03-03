import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, Search, MoreHorizontal, Archive, RotateCcw, Trash2, BarChart3, Share, Edit, Eye, QrCode, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

const Archives = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [archivedLinks, setArchivedLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchArchivedLinks();
  }, []);

  const fetchArchivedLinks = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Get archived links for current user
      const { data: linksData, error: linksError } = await supabase
        .from('links')
        .select(`
          *,
          analytics_daily(
            total_clicks,
            unique_clicks
          )
        `)
        .eq('user_id', user.id)
        .eq('is_archived', true)
        .order('created_at', { ascending: false });

      if (linksError) {
        console.error('Error fetching archived links:', linksError);
        throw linksError;
      }

      // Process links to include total click counts
      const processedLinks = linksData?.map(link => {
        const totalClicks = link.analytics_daily?.reduce((sum: number, day: any) => sum + (day.total_clicks || 0), 0) || 0;
        const uniqueClicks = link.analytics_daily?.reduce((sum: number, day: any) => sum + (day.unique_clicks || 0), 0) || 0;
        
        return {
          ...link,
          totalClicks,
          uniqueClicks
        };
      }) || [];

      setArchivedLinks(processedLinks);
    } catch (error) {
      console.error('Error fetching archived links:', error);
      toast({
        title: "Error",
        description: "Failed to load archived links",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnarchive = async (link: any) => {
    try {
      const { error } = await supabase
        .from('links')
        .update({ is_archived: false })
        .eq('id', link.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Link unarchived successfully",
      });

      fetchArchivedLinks();
    } catch (error) {
      console.error('Error unarchiving link:', error);
      toast({
        title: "Error",
        description: "Failed to unarchive link",
        variant: "destructive",
      });
    }
  };

  const handleExportStatistics = async (link: any) => {
    try {
      // Fetch detailed click data for this link
      const { data: clicksData, error: clicksError } = await supabase
        .from('clicks')
        .select('*')
        .eq('link_id', link.id)
        .order('created_at', { ascending: false });

      if (clicksError) throw clicksError;

      if (!clicksData || clicksData.length === 0) {
        toast({
          title: "No Data",
          description: "No click data available for this link",
          variant: "destructive",
        });
        return;
      }

      // Prepare CSV data
      const csvHeaders = [
        'Date',
        'Time',
        'Country',
        'City',
        'Region',
        'IP Address',
        'Device Type',
        'Browser',
        'Operating System',
        'User Agent',
        'Referrer',
        'Is Unique Click'
      ];

      const csvRows = clicksData.map(click => [
        new Date(click.created_at).toLocaleDateString(),
        new Date(click.created_at).toLocaleTimeString(),
        click.country_name || click.country || 'Unknown',
        click.city || 'Unknown',
        click.region || 'Unknown',
        click.ip_address || 'Unknown',
        click.device_type || 'Unknown',
        click.browser || 'Unknown',
        click.os || 'Unknown',
        click.user_agent || 'Unknown',
        click.referer || 'Direct',
        click.is_unique ? 'Yes' : 'No'
      ]);

      // Create CSV content
      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const downloadLink = document.createElement('a');
      const url = URL.createObjectURL(blob);
      downloadLink.setAttribute('href', url);
      downloadLink.setAttribute('download', `statistics_${link.short_code}_${new Date().toISOString().split('T')[0]}.csv`);
      downloadLink.style.visibility = 'hidden';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      toast({
        title: "Success",
        description: "Statistics exported successfully",
      });
    } catch (error) {
      console.error('Error exporting statistics:', error);
      toast({
        title: "Error",
        description: "Failed to export statistics",
        variant: "destructive",
      });
    }
  };

  const handleResetStats = async (link: any) => {
    if (!confirm('Are you sure you want to reset all statistics for this link? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete all clicks for this link
      const { error: clicksError } = await supabase
        .from('clicks')
        .delete()
        .eq('link_id', link.id);

      if (clicksError) throw clicksError;

      // Delete all analytics_daily for this link
      const { error: analyticsError } = await supabase
        .from('analytics_daily')
        .delete()
        .eq('link_id', link.id);

      if (analyticsError) throw analyticsError;

      toast({
        title: "Success",
        description: "Statistics reset successfully",
      });

      fetchArchivedLinks();
    } catch (error) {
      console.error('Error resetting statistics:', error);
      toast({
        title: "Error",
        description: "Failed to reset statistics",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (link: any) => {
    if (!confirm('Are you sure you want to permanently delete this link? This action cannot be undone.')) {
      return;
    }
  
    try {
      const { data, error } = await supabase.functions.invoke('delete-link', {
        body: {
          ids: [link.id],
        },
      });
  
      if (error) throw error;
  
      toast({
        title: "Success",
        description: "Link deleted permanently",
      });
  
      fetchArchivedLinks();
      return data;
    } catch (error) {
      console.error('Error deleting link:', error);
      toast({
        title: "Error",
        description: "Failed to delete link",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleStatisticsClick = (link: any) => {
    navigate(`/statistics/${link.id}`);
  };

  const handleShareClick = (link: any) => {
    // Copy to clipboard
    navigator.clipboard.writeText(link.short_url);
    toast({
      title: "Copied!",
      description: "Short link copied to clipboard",
    });
  };

  const filteredLinks = archivedLinks.filter(link =>
    link.original_url.toLowerCase().includes(searchTerm.toLowerCase()) ||
    link.short_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading archived links...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Archived Links</h1>
                <p className="text-muted-foreground">
                  Manage your archived links
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search archived links..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Links List */}
        {filteredLinks.length === 0 ? (
          <Card className="p-8 text-center">
            <Archive className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Archived Links</h3>
            <p className="text-muted-foreground">
              {searchTerm ? 'No links match your search.' : 'You haven\'t archived any links yet.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredLinks.map((link) => (
              <Card key={link.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        Archived
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(link.created_at), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                          {link.short_code}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {link.totalClicks} clicks • {link.uniqueClicks} unique
                        </span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground truncate">
                        {link.original_url}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnarchive(link)}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Unarchive
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleShareClick(link)}>
                          <Share className="w-4 h-4 mr-2" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatisticsClick(link)}>
                          <BarChart3 className="w-4 h-4 mr-2" />
                          Statistics
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleExportStatistics(link)}>
                          <Download className="w-4 h-4 mr-2" />
                          Export Statistics
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResetStats(link)}>
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Reset Stats
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600 focus:text-red-600"
                          onClick={() => handleDelete(link)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Permanently
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Archives;
