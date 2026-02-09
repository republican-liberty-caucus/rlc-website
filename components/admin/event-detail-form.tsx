'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { ADMIN_INPUT_CLASS, ADMIN_LABEL_CLASS } from '@/components/admin/form-styles';
import type { Event } from '@/types';

interface OrganizerInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface EventDetailFormProps {
  event: Event | null;
  charters: { id: string; name: string }[];
  organizer?: OrganizerInfo | null;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function EventDetailForm({ event, charters, organizer }: EventDetailFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [autoSlug, setAutoSlug] = useState(!event);

  // Organizer search state
  const [organizerId, setOrganizerId] = useState<string | null>(event?.organizer_id || null);
  const [organizerQuery, setOrganizerQuery] = useState(
    organizer ? `${organizer.first_name} ${organizer.last_name}` : ''
  );
  const [organizerResults, setOrganizerResults] = useState<OrganizerInfo[]>([]);
  const [showOrganizerDropdown, setShowOrganizerDropdown] = useState(false);
  const organizerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const searchContacts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setOrganizerResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/v1/admin/contacts/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setOrganizerResults(data.contacts || []);
        setShowOrganizerDropdown(true);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (organizerRef.current && !organizerRef.current.contains(e.target as Node)) {
        setShowOrganizerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const fd = new FormData(e.currentTarget);

    const body: Record<string, unknown> = {
      title: fd.get('title') as string,
      slug: fd.get('slug') as string,
      description: (fd.get('description') as string) || null,
      featuredImageUrl: (fd.get('featuredImageUrl') as string) || null,
      eventType: (fd.get('eventType') as string) || null,
      startDate: fd.get('startDate') as string,
      endDate: (fd.get('endDate') as string) || null,
      timezone: fd.get('timezone') as string,
      isVirtual: fd.get('isVirtual') === 'on',
      locationName: (fd.get('locationName') as string) || null,
      address: (fd.get('address') as string) || null,
      city: (fd.get('city') as string) || null,
      state: (fd.get('state') as string) || null,
      postalCode: (fd.get('postalCode') as string) || null,
      virtualUrl: (fd.get('virtualUrl') as string) || null,
      registrationRequired: fd.get('registrationRequired') === 'on',
      maxAttendees: fd.get('maxAttendees') ? Number(fd.get('maxAttendees')) : null,
      registrationFee: fd.get('registrationFee') ? Number(fd.get('registrationFee')) : null,
      registrationDeadline: (fd.get('registrationDeadline') as string) || null,
      charterId: (fd.get('charterId') as string) || null,
      organizerId: organizerId || null,
      status: fd.get('status') as string,
    };

    const isCreate = !event;
    const url = isCreate ? '/api/v1/admin/events' : `/api/v1/admin/events/${event.id}`;
    const method = isCreate ? 'POST' : 'PATCH';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = `Failed to ${isCreate ? 'create' : 'update'} event`;
        try {
          const err = await res.json();
          msg = err.error || msg;
        } catch {
          // non-JSON response
        }
        throw new Error(msg);
      }

      const data = await res.json();
      toast({
        title: isCreate ? 'Event created' : 'Event updated',
        description: `"${body.title}" has been ${isCreate ? 'created' : 'updated'}.`,
      });

      if (isCreate && data.event?.id) {
        router.push(`/admin/events/${data.event.id}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  function formatDateForInput(dateStr: string | null): string {
    if (!dateStr) return '';
    return new Date(dateStr).toISOString().slice(0, 16);
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Basic Info */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Event Details</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={ADMIN_LABEL_CLASS}>Title</label>
            <input
              name="title"
              defaultValue={event?.title || ''}
              required
              className={ADMIN_INPUT_CLASS}
              onChange={(e) => {
                if (autoSlug) {
                  const slugEl = e.currentTarget.form?.elements.namedItem('slug') as HTMLInputElement;
                  if (slugEl) slugEl.value = slugify(e.target.value);
                }
              }}
            />
          </div>
          <div className="md:col-span-2">
            <label className={ADMIN_LABEL_CLASS}>Slug</label>
            <input
              name="slug"
              defaultValue={event?.slug || ''}
              required
              className={ADMIN_INPUT_CLASS}
              onFocus={() => setAutoSlug(false)}
            />
          </div>
          <div className="md:col-span-2">
            <label className={ADMIN_LABEL_CLASS}>Description</label>
            <textarea
              name="description"
              defaultValue={event?.description || ''}
              rows={4}
              className={ADMIN_INPUT_CLASS}
            />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Event Type</label>
            <input name="eventType" defaultValue={event?.event_type || ''} className={ADMIN_INPUT_CLASS} placeholder="e.g. meeting, convention, fundraiser" />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Status</label>
            <select name="status" defaultValue={event?.status || 'draft'} className={ADMIN_INPUT_CLASS}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Charter</label>
            <select name="charterId" defaultValue={event?.charter_id || ''} className={ADMIN_INPUT_CLASS}>
              <option value="">National (no charter)</option>
              {charters.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={ADMIN_LABEL_CLASS}>Featured Image URL</label>
            <input
              name="featuredImageUrl"
              type="url"
              defaultValue={event?.featured_image_url || ''}
              className={ADMIN_INPUT_CLASS}
              placeholder="https://example.com/image.jpg"
            />
          </div>
          <div className="md:col-span-2" ref={organizerRef}>
            <label className={ADMIN_LABEL_CLASS}>Event Organizer</label>
            <div className="relative">
              <input
                type="text"
                value={organizerQuery}
                onChange={(e) => {
                  setOrganizerQuery(e.target.value);
                  clearTimeout(debounceRef.current);
                  debounceRef.current = setTimeout(() => searchContacts(e.target.value), 300);
                }}
                className={ADMIN_INPUT_CLASS}
                placeholder="Search contacts by name..."
              />
              {showOrganizerDropdown && organizerResults.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-md">
                  {organizerResults.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => {
                          setOrganizerId(c.id);
                          setOrganizerQuery(`${c.first_name} ${c.last_name}`);
                          setShowOrganizerDropdown(false);
                        }}
                      >
                        {c.first_name} {c.last_name}
                        {c.email && <span className="ml-2 text-muted-foreground">({c.email})</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {organizerId && (
              <p className="mt-1 text-xs text-muted-foreground">
                Selected: {organizerQuery}{' '}
                <button
                  type="button"
                  className="text-rlc-red hover:underline"
                  onClick={() => {
                    setOrganizerId(null);
                    setOrganizerQuery('');
                  }}
                >
                  Clear
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Date & Time */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Date &amp; Time</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={ADMIN_LABEL_CLASS}>Start Date &amp; Time</label>
            <input
              name="startDate"
              type="datetime-local"
              defaultValue={formatDateForInput(event?.start_date || null)}
              required
              className={ADMIN_INPUT_CLASS}
            />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>End Date &amp; Time</label>
            <input
              name="endDate"
              type="datetime-local"
              defaultValue={formatDateForInput(event?.end_date || null)}
              className={ADMIN_INPUT_CLASS}
            />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Timezone</label>
            <input name="timezone" defaultValue={event?.timezone || 'America/New_York'} className={ADMIN_INPUT_CLASS} />
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Location</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="flex items-center gap-2">
              <input name="isVirtual" type="checkbox" defaultChecked={event?.is_virtual || false} />
              <span className="text-sm font-medium">Virtual Event</span>
            </label>
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Venue Name</label>
            <input name="locationName" defaultValue={event?.location_name || ''} className={ADMIN_INPUT_CLASS} />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Address</label>
            <input name="address" defaultValue={event?.address || ''} className={ADMIN_INPUT_CLASS} />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>City</label>
            <input name="city" defaultValue={event?.city || ''} className={ADMIN_INPUT_CLASS} />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>State</label>
            <input name="state" defaultValue={event?.state || ''} maxLength={2} className={ADMIN_INPUT_CLASS} />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Postal Code</label>
            <input name="postalCode" defaultValue={event?.postal_code || ''} className={ADMIN_INPUT_CLASS} />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Virtual URL</label>
            <input name="virtualUrl" type="url" defaultValue={event?.virtual_url || ''} className={ADMIN_INPUT_CLASS} placeholder="https://zoom.us/..." />
          </div>
        </div>
      </div>

      {/* Registration */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Registration</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="flex items-center gap-2">
              <input name="registrationRequired" type="checkbox" defaultChecked={event?.registration_required ?? true} />
              <span className="text-sm font-medium">Registration Required</span>
            </label>
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Max Attendees</label>
            <input name="maxAttendees" type="number" min={1} defaultValue={event?.max_attendees || ''} className={ADMIN_INPUT_CLASS} />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Registration Fee ($)</label>
            <input name="registrationFee" type="number" min={0} step={0.01} defaultValue={event?.registration_fee || ''} className={ADMIN_INPUT_CLASS} />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Registration Deadline</label>
            <input
              name="registrationDeadline"
              type="datetime-local"
              defaultValue={formatDateForInput(event?.registration_deadline || null)}
              className={ADMIN_INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-rlc-red hover:bg-rlc-red/90">
          {saving ? 'Saving...' : event ? 'Save Changes' : 'Create Event'}
        </Button>
      </div>
    </form>
  );
}
