import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Globe, Sparkles, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLinks } from '@/hooks/useLinks';

interface EditUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  link: any;
  onUpdate: () => void;
}

export default function EditUrlModal({ isOpen, onClose, link, onUpdate }: EditUrlModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const { updateLink } = useLinks();
  // Settings state
  const [settings, setSettings] = useState({
    customDomain: false,
    customDomainUrl: '',
    analyticsEnabled: true,
    expirationEnabled: false,
    expirationDate: undefined as Date | undefined,
    passwordEnabled: false,
    passwordValue: ''
  });

  const [domainValidation, setDomainValidation] = useState({
    isValid: true,
    message: ''
  });

  // New editable fields: destination URL and custom alias (short code)
  const [destinationUrl, setDestinationUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [aliasValidation, setAliasValidation] = useState({ isValid: true, message: '' });

  // Initialize settings from link data
  useEffect(() => {
    if (link) {
      setSettings({
        customDomain: !!link.custom_domain,
        customDomainUrl: link.custom_domain || '',
        analyticsEnabled: link.analytics_enabled !== false,
        expirationEnabled: !!link.expires_at,
        expirationDate: link.expires_at ? new Date(link.expires_at) : undefined,
        passwordEnabled: !!link.password_hash,
        passwordValue: ''
      });

      setDestinationUrl(link.original_url || '');
      // Prefer existing short_code; fall back to custom_alias if present
      setCustomAlias(link.short_code || link.custom_alias || '');
    }
  }, [link]);

  const validateDomain = async (domain: string) => {
    if (!domain) {
      setDomainValidation({ isValid: true, message: '' });
      return;
    }

    // Basic domain format validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      setDomainValidation({ isValid: false, message: 'Invalid domain format' });
      return;
    }

    // Check if domain is reachable
    try {
      const response = await fetch(`https://${domain}`, { 
        method: 'HEAD',
        mode: 'no-cors',
        signal: AbortSignal.timeout(5000)
      });
      setDomainValidation({ isValid: true, message: 'Domain is valid' });
    } catch (error) {
      setDomainValidation({ isValid: false, message: 'Domain is not reachable' });
    }
  };

  const convertISTToUTC = (istDate: Date): Date => {
    // IST is UTC+5:30
    const utcDate = new Date(istDate.getTime() - (5.5 * 60 * 60 * 1000));
    return utcDate;
  };

  const isValidUrl = (value: string) => {
    try {
      // Ensure protocol is present for consistency
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const isValidAliasFormat = (value: string) => {
    if (!value) return false;
    // 3-15 chars, alphanumerics, hyphen and underscore
    const re = /^[A-Za-z0-9-_]{3,15}$/;
    return re.test(value);
  };

  const getBaseDomain = (): string => {
    if (settings.customDomain && settings.customDomainUrl) {
      return `https://${settings.customDomainUrl}`;
    }
    try {
      const parsed = new URL(link.short_url);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return 'https://247l.ink';
    }
  };

  const previewShortUrl = `${getBaseDomain()}/s/${customAlias || link?.short_code || ''}`;

  const handleSave = async () => {
    if (!link) return;

    setLoading(true);
    try {
      // Validate destination URL
      if (!destinationUrl || !isValidUrl(destinationUrl)) {
        toast({
          title: "Error",
          description: "Please enter a valid destination URL (http/https)",
          variant: "destructive",
        });
        return;
      }

      // Validate alias format
      if (customAlias.length > 15) {
        setAliasValidation({ isValid: false, message: 'Alias must be 15 characters or less' });
        toast({
          title: "Alias too long",
          description: "Custom alias must be 15 characters or less. Please choose a shorter alias.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      
      if (!isValidAliasFormat(customAlias)) {
        setAliasValidation({ isValid: false, message: 'Alias must be 3-15 chars: letters, numbers, - or _' });
        toast({
          title: "Error",
          description: 'Alias must be 3-15 characters and contain only letters, numbers, hyphens, or underscores',
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Uniqueness check for alias (exclude current link)
      if (customAlias !== link.short_code) {
        const { data: existing, error: existingError } = await supabase
          .from('links')
          .select('id')
          .eq('short_code', customAlias)
          .neq('id', link.id)
          .maybeSingle();

        if (existingError) {
          console.error('Alias uniqueness check error:', existingError);
        }
        if (existing) {
          setAliasValidation({ isValid: false, message: 'This alias is already in use' });
          toast({
            title: "Alias already taken",
            description: "Please choose a different alias",
            variant: "destructive",
          });
          return;
        }
      }

      // Validate settings
      if (settings.customDomain && !settings.customDomainUrl) {
        toast({
          title: "Error",
          description: "Please enter a custom domain",
          variant: "destructive",
        });
        return;
      }

      if (settings.customDomain && !domainValidation.isValid) {
        toast({
          title: "Error",
          description: domainValidation.message,
          variant: "destructive",
        });
        return;
      }

      if (settings.expirationEnabled && !settings.expirationDate) {
        toast({
          title: "Error",
          description: "Please select an expiration date",
          variant: "destructive",
        });
        return;
      }

      if (settings.passwordEnabled && !settings.passwordValue) {
        toast({
          title: "Error",
          description: "Please enter a password",
          variant: "destructive",
        });
        return;
      }

      // Prepare update data
      const updateData: any = {
        analytics_enabled: settings.analyticsEnabled,
        original_url: destinationUrl,
        short_code: customAlias,
        short_url: `${getBaseDomain()}/s/${customAlias}`,
        custom_alias: customAlias
      };

      if (settings.customDomain) {
        updateData.custom_domain = settings.customDomainUrl;
      } else {
        updateData.custom_domain = null;
      }

      if (settings.expirationEnabled && settings.expirationDate) {
        updateData.expires_at = convertISTToUTC(settings.expirationDate).toISOString();
      } else {
        updateData.expires_at = null;
      }

      if (settings.passwordEnabled && settings.passwordValue) {
        // Hash the password using SHA-256
        const encoder = new TextEncoder();
        const data = encoder.encode(settings.passwordValue);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        updateData.password_hash = hashHex;
      } else {
        updateData.password_hash = null;
      }

      // Update the link in database
      await updateLink(link.id, updateData);

      toast({
        title: "Success",
        description: "Link settings updated successfully",
      });

      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating link settings:', error);
      toast({
        title: "Error",
        description: "Failed to update link settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!link) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Link Settings</DialogTitle>
          <DialogDescription>
            Update settings for your shortened URL
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Destination URL */}
          <div className="space-y-2">
            <Label htmlFor="destination-url">Destination URL</Label>
            <Input
              id="destination-url"
              placeholder="https://example.com/page"
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
            />
          </div>

          {/* Custom Alias */}
          <div className="space-y-2">
            <Label htmlFor="custom-alias">Custom alias</Label>
            <Input
              id="custom-alias"
              placeholder="my-custom-code"
              value={customAlias}
              onChange={(e) => {
                const v = e.target.value.trim();
                setCustomAlias(v);
                if (v.length > 15) {
                  setAliasValidation({ isValid: false, message: 'Alias must be 15 characters or less' });
                } else {
                  setAliasValidation({ isValid: isValidAliasFormat(v), message: isValidAliasFormat(v) ? '' : '3-15 chars: letters, numbers, - or _' });
                }
              }}
            />
            {!aliasValidation.isValid && (
              <p className="text-sm text-red-600">{aliasValidation.message}</p>
            )}
            <p className="text-xs text-muted-foreground">Preview: {previewShortUrl}</p>
          </div>

          {/* Custom Domain */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4" />
                <Label htmlFor="custom-domain">Use Custom Domain</Label>
              </div>
              <Switch
                id="custom-domain"
                checked={settings.customDomain}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, customDomain: checked }))}
              />
            </div>
            {settings.customDomain && (
              <div className="space-y-2">
                <Input
                  placeholder="yourdomain.com"
                  value={settings.customDomainUrl}
                  onChange={(e) => {
                    setSettings(prev => ({ ...prev, customDomainUrl: e.target.value }));
                    validateDomain(e.target.value);
                  }}
                  className={cn(
                    domainValidation.isValid ? '' : 'border-red-500'
                  )}
                />
                {domainValidation.message && (
                  <p className={cn(
                    "text-sm",
                    domainValidation.isValid ? "text-green-600" : "text-red-600"
                  )}>
                    {domainValidation.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Analytics */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4" />
              <Label htmlFor="analytics">Enable Analytics</Label>
            </div>
            <Switch
              id="analytics"
              checked={settings.analyticsEnabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, analyticsEnabled: checked }))}
            />
          </div>

          {/* Expiration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CalendarIcon className="w-4 h-4" />
                <Label htmlFor="expiration">Set Expiration</Label>
              </div>
              <Switch
                id="expiration"
                checked={settings.expirationEnabled}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, expirationEnabled: checked }))}
              />
            </div>
            {settings.expirationEnabled && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !settings.expirationDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {settings.expirationDate ? (
                      format(settings.expirationDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={settings.expirationDate}
                    onSelect={(date) => setSettings(prev => ({ ...prev, expirationDate: date }))}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Password Protection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4" />
                <Label htmlFor="password">Password Protection</Label>
              </div>
              <Switch
                id="password"
                checked={settings.passwordEnabled}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, passwordEnabled: checked }))}
              />
            </div>
            {settings.passwordEnabled && (
              <Input
                type="password"
                placeholder="Enter password"
                value={settings.passwordValue}
                onChange={(e) => setSettings(prev => ({ ...prev, passwordValue: e.target.value }))}
              />
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
