'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SectionEditForm } from './section-edit-form';
import type { ReportSectionWithAssignments, VettingPermissions, CommitteeMemberOption } from '../types';
import type { VettingSectionStatus } from '@/types';

const statusColors: Record<VettingSectionStatus, string> = {
  section_not_started: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  section_assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  section_in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  section_completed: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  needs_revision: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
};

function formatLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface VettingSectionsTabProps {
  vettingId: string;
  sections: ReportSectionWithAssignments[];
  permissions: VettingPermissions;
  committeeMembers: CommitteeMemberOption[];
}

export function VettingSectionsTab({
  vettingId,
  sections,
  permissions,
  committeeMembers,
}: VettingSectionsTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-3 mt-4">
      {sections.map((section) => (
        <div key={section.id} className="rounded-lg border bg-card">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <h4 className="text-sm font-medium">{formatLabel(section.section)}</h4>
              <Badge
                variant="outline"
                className={cn('border-transparent text-xs', statusColors[section.status])}
              >
                {formatLabel(section.status)}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {section.assignments.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {section.assignments
                    .map((a) =>
                      a.committee_member?.contact
                        ? `${a.committee_member.contact.first_name} ${a.committee_member.contact.last_name[0]}.`
                        : 'Unknown'
                    )
                    .join(', ')}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setExpandedId(expandedId === section.id ? null : section.id)
                }
              >
                {expandedId === section.id ? 'Collapse' : 'Edit'}
              </Button>
            </div>
          </div>

          {expandedId === section.id && (
            <div className="px-4 pb-4">
              <SectionEditForm
                vettingId={vettingId}
                section={section}
                permissions={permissions}
                committeeMembers={committeeMembers}
                onClose={() => setExpandedId(null)}
              />
            </div>
          )}
        </div>
      ))}

      {sections.length === 0 && (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No report sections initialized for this vetting.
        </div>
      )}
    </div>
  );
}
