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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
            <Table aria-label={t('staff.title')}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('staff.name')}</TableHead>
                  <TableHead>{t('staff.role')}</TableHead>
                  <TableHead>{t('staff.contact')}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t('staff.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffMembers.map((staffMember) =>
                  editingId === staffMember.id ? (
                    <TableRow key={staffMember.id}>
                      <TableCell colSpan={4} className="whitespace-normal">
                        <EditStaffMemberForm
                          venueId={venueId}
                          staffMember={staffMember}
                          onDone={() => setEditingId(null)}
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={staffMember.id}>
                      <TableCell className="font-medium">{staffMember.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{staffMember.role}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex flex-col">
                          <span>{staffMember.email}</span>
                          {staffMember.phone && <span>{staffMember.phone}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
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
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
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
