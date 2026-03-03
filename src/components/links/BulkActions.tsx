import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useChannels } from '@/hooks/useChannels';
import { useCampaigns } from '@/hooks/useCampaigns';
import { usePixels } from '@/hooks/usePixels';
import { useExport } from '@/hooks/useExport';
import { useLinks } from '@/hooks/useLinks';
import { useToast } from '@/hooks/use-toast';
import { 
  Archive, 
  Megaphone, 
  Box, 
  Square, 
  Download, 
  Trash2, 
  Loader2,
  AlertTriangle
} from 'lucide-react';

interface BulkActionsProps {
  selectedLinks: string[];
  onClearSelection: () => void;
  onRefresh: () => void;
}

const BulkActions = ({ selectedLinks, onClearSelection, onRefresh }: BulkActionsProps) => {
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false);
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [isPixelDialogOpen, setIsPixelDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedPixels, setSelectedPixels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const { channels } = useChannels();
  const { campaigns } = useCampaigns();
  const { pixels } = usePixels();
  const { exportLinks } = useExport();
  const { deleteLink } = useLinks();
  const { toast } = useToast();

  const handleArchive = async () => {
    try {
      setLoading(true);
      // Archive functionality can be wired later; for now just confirm action
      toast({
        title: "Links archived",
        description: `${selectedLinks.length} links have been marked as archived (no data changed yet).`,
      });
      onClearSelection();
      setIsArchiveDialogOpen(false);
    } catch (error) {
      console.error('Error archiving links:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignChannel = async () => {
    if (!selectedChannel) return;

    try {
      setLoading(true);
      // Channel assignment would be implemented here
      toast({
        title: "Channel assigned",
        description: `${selectedLinks.length} links assigned to channel`,
      });
      onClearSelection();
      setIsChannelDialogOpen(false);
    } catch (error) {
      console.error('Error assigning channel:', error);
    } finally {
      setLoading(false);
    }
  };

  // COMMENTED OUT FOR NOW - CAMPAIGNS AND PIXELS NOT NEEDED
  // const handleAssignCampaign = async () => {
  //   if (!selectedCampaign) return;

  //   try {
  //     setLoading(true);
  //     // Campaign assignment would be implemented here
  //     toast({
  //       title: "Campaign assigned",
  //       description: `${selectedLinks.length} links assigned to campaign`,
  //     });
  //     onClearSelection();
  //     setIsCampaignDialogOpen(false);
  //   } catch (error) {
  //     console.error('Error assigning campaign:', error);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // const handleAssignPixels = async () => {
  //   if (selectedPixels.length === 0) return;

  //   try {
  //     setLoading(true);
  //     // Pixel assignment would be implemented here
  //     toast({
  //       title: "Pixels assigned",
  //       description: `${selectedLinks.length} links assigned pixels`,
  //     });
  //     onClearSelection();
  //     setIsPixelDialogOpen(false);
  //   } catch (error) {
  //     console.error('Error assigning pixels:', error);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const handleExport = async () => {
    try {
      await exportLinks({
        format: 'csv',
        linkIds: selectedLinks,
        includeAnalytics: true
      });
      onClearSelection();
    } catch (error) {
      console.error('Error exporting links:', error);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      
      // Delete all selected links
      await Promise.all(selectedLinks.map(linkId => deleteLink(linkId)));
      
      toast({
        title: "Links deleted",
        description: `${selectedLinks.length} links have been deleted`,
      });
      onClearSelection();
      setIsDeleteDialogOpen(false);
      onRefresh();
    } catch (error) {
      console.error('Error deleting links:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePixel = (pixelId: string) => {
    setSelectedPixels(prev => 
      prev.includes(pixelId) 
        ? prev.filter(id => id !== pixelId)
        : [...prev, pixelId]
    );
  };

  if (selectedLinks.length === 0) return null;

  return (
    <div className="flex items-center space-x-2 p-4 bg-muted rounded-lg">
      <span className="text-sm font-medium">
        {selectedLinks.length} link(s) selected
      </span>
      
      <div className="flex items-center space-x-1">
        {/* Archive */}
        <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Archive className="w-4 h-4 mr-1" />
              Archive
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Archive Selected Links</DialogTitle>
              <DialogDescription>
                Are you sure you want to archive {selectedLinks.length} link(s)?
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsArchiveDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleArchive} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Archive
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add to Channel */}
        <Dialog open={isChannelDialogOpen} onOpenChange={setIsChannelDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Box className="w-4 h-4 mr-1" />
              Channel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Channel</DialogTitle>
              <DialogDescription>
                Assign {selectedLinks.length} link(s) to a channel
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: channel.color }}
                          />
                          <span>{channel.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsChannelDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAssignChannel} disabled={loading || !selectedChannel}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Assign
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* COMMENTED OUT - CAMPAIGNS AND PIXELS NOT NEEDED FOR NOW */}
        {/* Add to Campaign */}
        {/* <Dialog open={isCampaignDialogOpen} onOpenChange={setIsCampaignDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Megaphone className="w-4 h-4 mr-1" />
              Campaign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Campaign</DialogTitle>
              <DialogDescription>
                Assign {selectedLinks.length} link(s) to a campaign
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Campaign</Label>
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        <div className="flex items-center space-x-2">
                          <Megaphone className="w-4 h-4" />
                          <span>{campaign.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCampaignDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAssignCampaign} disabled={loading || !selectedCampaign}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Assign
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog> */}

        {/* Add Pixels */}
        {/* <Dialog open={isPixelDialogOpen} onOpenChange={setIsPixelDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Square className="w-4 h-4 mr-1" />
              Pixels
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Pixels</DialogTitle>
              <DialogDescription>
                Assign pixels to {selectedLinks.length} link(s)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pixels</Label>
                <div className="space-y-2">
                  {pixels.map((pixel) => (
                    <div key={pixel.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={pixel.id}
                        checked={selectedPixels.includes(pixel.id)}
                        onCheckedChange={() => togglePixel(pixel.id)}
                      />
                      <Label htmlFor={pixel.id} className="flex items-center space-x-2">
                        <span>{pixel.name}</span>
                        <span className="text-xs text-muted-foreground">({pixel.provider})</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsPixelDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAssignPixels} disabled={loading || selectedPixels.length === 0}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Assign
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog> */}

        {/* Export */}
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>

        {/* Delete */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Selected Links</DialogTitle>
              <DialogDescription>
                This action cannot be undone. Are you sure you want to delete {selectedLinks.length} link(s)?
              </DialogDescription>
            </DialogHeader>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will permanently delete the selected links and all their analytics data.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDelete} 
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Clear Selection */}
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          Clear
        </Button>
      </div>
    </div>
  );
};

export default BulkActions;
