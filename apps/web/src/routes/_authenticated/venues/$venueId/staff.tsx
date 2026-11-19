import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AddStaffMemberForm } from '@/components/add-staff-member-form';
import { ArchiveStaffMemberDialog } from '@/components/archive-staff-member-dialog';
import { EditStaffMemberForm } from '@/components/edit-staff-member-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { staffMembersQuery } from '@/lib/staff-members';

export const Route = createFileRoute('/_authenticated/venues/$venueId/staff')({
  loader: ({ context, params }) =>
    context.queryClient.query(staffMembersQuery(params.venueId)),
  component: StaffPage,
});

function StaffPage() {
  const { t } = useTranslation();
  const { venueId } = Route.useParams();
  const { data: staffMembers } = useSuspenseQuery(staffMembersQuery(venueId));
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t('staff.title')}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {staffMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('staff.empty')}</p>
          ) : (
            <ul aria-label={t('staff.title')} className="flex flex-col divide-y">
              {staffMembers.map((staffMember) => (
                <li key={staffMember.id} className="py-3 first:pt-0 last:pb-0">
                  {editingId === staffMember.id ? (
                    <EditStaffMemberForm
                      venueId={venueId}
                      staffMember={staffMember}
                      onDone={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{staffMember.name}</span>
                          <Badge variant="secondary">{staffMember.role}</Badge>
                        </div>
                        <div className="flex flex-col text-sm break-words text-muted-foreground">
                          <span>{staffMember.email}</span>
                          {staffMember.phone && <span>{staffMember.phone}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={t('staff.edit.label', { name: staffMember.name })}
                          onClick={() => setEditingId(staffMember.id)}
                        >
                          {t('staff.edit.button')}
                        </Button>
                        <ArchiveStaffMemberDialog venueId={venueId} staffMember={staffMember} />
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t('staff.add.title')}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AddStaffMemberForm venueId={venueId} />
        </CardContent>
      </Card>
    </div>
  );
}
