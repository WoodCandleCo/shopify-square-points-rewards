import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AppSettings {
  square_environment: 'sandbox' | 'production';
  loyalty_widget_enabled: boolean;
  show_points_balance: boolean;
  allow_phone_lookup: boolean;
  widget_title: string;
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>({
    square_environment: 'sandbox',
    loyalty_widget_enabled: true,
    show_points_balance: true,
    allow_phone_lookup: true,
    widget_title: 'Loyalty Program'
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value');

      if (error) throw error;

      if (data) {
        const settingsMap: any = {};
        data.forEach(item => {
          // Handle different value types properly
          let parsedValue = item.value;
          if (typeof item.value === 'string') {
            try {
              parsedValue = JSON.parse(item.value);
            } catch {
              // If JSON.parse fails, use the string value as-is
              parsedValue = item.value;
            }
          }
          settingsMap[item.key] = parsedValue;
        });
        setSettings(prev => ({ ...prev, ...settingsMap }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: "Error loading settings",
        description: "Could not load app settings. Using defaults.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ 
          key, 
          value: JSON.stringify(value) 
        }, {
          onConflict: 'key'
        });

      if (error) throw error;

      setSettings(prev => ({ ...prev, [key]: value }));
      toast({
        title: "Setting updated",
        description: `${key} has been updated successfully.`
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      toast({
        title: "Error updating setting",
        description: "Could not save the setting. Please try again.",
        variant: "destructive"
      });
    }
  };

  const testSquareConnection = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('square-test-connection', {
        body: {}
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Connection successful",
          description: `Square API connection working in ${data.environment} environment. Found ${data.locations || 0} locations.`
        });
        return true;
      } else {
        throw new Error(data?.error || 'Connection failed');
      }
    } catch (error: any) {
      console.error('Square connection test failed:', error);
      const details = error?.message || 'Unknown error';
      toast({
        title: "Connection failed",
        description: 'Could not connect to Square API. Check your credentials and environment setting.',
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return {
    settings,
    loading,
    updateSetting,
    testSquareConnection,
    refreshSettings: loadSettings
  };
}