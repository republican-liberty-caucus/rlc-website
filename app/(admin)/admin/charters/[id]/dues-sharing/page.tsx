'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Settings, Save, Plus, Trash2, AlertCircle } from 'lucide-react';

interface SplitRule {
  id?: string;
  recipientCharterId: string;
  percentage: number;
  sortOrder: number;
  isActive: boolean;
  charter_name?: string;
  charter_level?: string;
}

interface SplitConfig {
  disbursement_model: string;
  is_active: boolean;
}

export default function CharterDuesSharingPage() {
  const params = useParams();
  const charterId = params.id as string;

  const [config, setConfig] = useState<SplitConfig | null>(null);
  const [rules, setRules] = useState<SplitRule[]>([]);
  const [disbursementModel, setDisbursementModel] = useState<'national_managed' | 'state_managed'>('national_managed');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [childCharters, setChildCharters] = useState<{ id: string; name: string; charter_level: string }[]>([]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/admin/charters/${charterId}/split-config`);
      const data = await res.json();

      if (data.config) {
        setConfig(data.config);
        setDisbursementModel(data.config.disbursement_model);
        setIsActive(data.config.is_active);
      }

      if (data.rules) {
        setRules(data.rules.map((r: Record<string, unknown>) => ({
          id: r.id,
          recipientCharterId: r.recipient_charter_id,
          percentage: Number(r.percentage),
          sortOrder: Number(r.sort_order || 0),
          isActive: r.is_active !== false,
          charter_name: r.charter_name,
          charter_level: r.charter_level,
        })));
      }
    } catch {
      setError('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, [charterId]);

  useEffect(() => {
    fetchConfig();
    fetchChildCharters();
  }, [charterId, fetchConfig]);

  async function fetchChildCharters() {
    // Get charters that could be recipients (self + descendants)
    const res = await fetch(`/api/v1/admin/charters/${charterId}/split-config`);
    // For now, we just provide an input for charter ID
    // In a full implementation, we'd fetch the tree
    void res;
  }

  function addRule() {
    setRules([...rules, {
      recipientCharterId: '',
      percentage: 0,
      sortOrder: rules.length,
      isActive: true,
    }]);
  }

  function removeRule(index: number) {
    setRules(rules.filter((_, i) => i !== index));
  }

  function updateRule(index: number, field: keyof SplitRule, value: string | number | boolean) {
    const updated = [...rules];
    updated[index] = { ...updated[index], [field]: value };
    setRules(updated);
  }

  const activeRules = rules.filter((r) => r.isActive);
  const percentageSum = activeRules.reduce((sum, r) => sum + r.percentage, 0);
  const isValidPercentage = activeRules.length === 0 || Math.abs(percentageSum - 100) < 0.01;

  async function handleSave() {
    if (!isValidPercentage) {
      setError('Active rule percentages must sum to 100%');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/v1/admin/charters/${charterId}/split-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disbursementModel,
          isActive,
          rules: rules.map((r) => ({
            recipientCharterId: r.recipientCharterId,
            percentage: r.percentage,
            sortOrder: r.sortOrder,
            isActive: r.isActive,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save');
        return;
      }

      setSuccessMessage('Configuration saved successfully');
      await fetchConfig();
    } catch {
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dues Sharing Configuration" description="Loading..." />
        <div className="animate-pulse space-y-4">
          <div className="h-32 rounded-lg bg-muted" />
          <div className="h-32 rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dues Sharing Configuration"
        description="Configure how membership dues are split between this charter and its sub-charters"
      />

      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="flex items-center gap-3 p-4">
            <Settings className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Disbursement Model */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Disbursement Model
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="space-y-2">
            <Label>Model</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDisbursementModel('national_managed')}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  disbursementModel === 'national_managed'
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-muted-foreground/50'
                }`}
              >
                <p className="font-medium">National Managed</p>
                <p className="text-sm text-muted-foreground">
                  National distributes to all sub-charters per your configured rules
                </p>
              </button>
              <button
                type="button"
                onClick={() => setDisbursementModel('state_managed')}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  disbursementModel === 'state_managed'
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-muted-foreground/50'
                }`}
              >
                <p className="font-medium">State Managed</p>
                <p className="text-sm text-muted-foreground">
                  State receives full remainder and handles sub-charter distribution internally
                </p>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sub-Split Rules (only for national_managed) */}
      {disbursementModel === 'national_managed' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Split Rules</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={isValidPercentage ? 'secondary' : 'destructive'}>
                  Total: {percentageSum.toFixed(2)}%
                </Badge>
                <Button size="sm" variant="outline" onClick={addRule}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add Rule
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No rules configured. The full remainder after National&apos;s $15 fee will go to this charter.
              </p>
            ) : (
              <div className="space-y-3">
                {rules.map((rule, index) => (
                  <div key={index} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex-1">
                      <Label className="text-xs">Recipient Charter ID</Label>
                      <Input
                        value={rule.recipientCharterId}
                        onChange={(e) => updateRule(index, 'recipientCharterId', e.target.value)}
                        placeholder="Charter UUID"
                        className="mt-1"
                      />
                      {rule.charter_name && (
                        <p className="mt-1 text-xs text-muted-foreground">{rule.charter_name}</p>
                      )}
                    </div>
                    <div className="w-28">
                      <Label className="text-xs">Percentage</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={rule.percentage}
                        onChange={(e) => updateRule(index, 'percentage', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={(v) => updateRule(index, 'isActive', v)}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeRule(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !isValidPercentage}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  );
}
