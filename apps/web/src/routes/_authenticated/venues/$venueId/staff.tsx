import {
  byStaffMemberName,
  staffMemberSchema,
  type StaffMember,
  type StaffMemberDetails,
} from '@rota-ready/shared';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { StaffMemberForm } from '@/components/staff-member-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiErrorMessage } from '@/i18n/api-error-message';
import { apiPatch, apiPost } from '@/lib/api';
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
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const staffMembersPath = `/api/venues/${venueId}/staff-members`;

  function updateList(update: (staffMembers: StaffMember[]) => StaffMember[]) {
    queryClient.setQueryData(staffMembersQuery(venueId).queryKey, (current = []) =>
      update(current).sort(byStaffMemberName),
    );
  }

  const add = useMutation({
    mutationFn: (details: StaffMemberDetails) =>
      apiPost(staffMembersPath, details, staffMemberSchema),
    onSuccess: (added) => updateList((current) => [...current, added]),
  });

  const edit = useMutation({
    mutationFn: ({ id, details }: { id: string; details: StaffMemberDetails }) =>
      apiPatch(`${staffMembersPath}/${id}`, details, staffMemberSchema),
    onSuccess: (edited) => {
      updateList((current) =>
        current.map((staffMember) => (staffMember.id === edited.id ? edited : staffMember)),
      );
      setEditingId(null);
    },
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      apiPost(`${staffMembersPath}/${id}/archive`, undefined, z.undefined()),
    onSuccess: (_result, id) =>
      updateList((current) => current.filter((staffMember) => staffMember.id !== id)),
  });

  function startEditing(id: string) {
    edit.reset();
    setEditingId(id);
  }

  function confirmArchive(staffMember: StaffMember) {
    if (window.confirm(t('staff.archive.confirm', { name: staffMember.name }))) {
      archive.mutate(staffMember.id);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t('staff.title')}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {archive.isError && (
            <p role="alert" className="text-sm text-destructive">
              {apiErrorMessage(t, archive.error)}
            </p>
          )}
          {staffMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('staff.empty')}</p>
          ) : (
            <ul aria-label={t('staff.title')} className="flex flex-col divide-y">
              {staffMembers.map((staffMember) => (
                <li key={staffMember.id} className="py-3 first:pt-0 last:pb-0">
                  {editingId === staffMember.id ? (
                    <StaffMemberForm
                      staffMember={staffMember}
                      submitLabel={t('staff.edit.submit')}
                      isPending={edit.isPending}
                      error={edit.error}
                      onSubmit={(details) => edit.mutate({ id: staffMember.id, details })}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{staffMember.name}</span>
                          <Badge variant="secondary">{staffMember.role}</Badge>
                        </div>
                        <div className="flex flex-col text-sm break-words text-muted-foreground">
                          {staffMember.email && <span>{staffMember.email}</span>}
                          {staffMember.phone && <span>{staffMember.phone}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={t('staff.edit.label', { name: staffMember.name })}
                          onClick={() => startEditing(staffMember.id)}
                        >
                          {t('staff.edit.button')}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          aria-label={t('staff.archive.label', { name: staffMember.name })}
                          disabled={archive.isPending}
                          onClick={() => confirmArchive(staffMember)}
                        >
                          {t('staff.archive.button')}
                        </Button>
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
          <StaffMemberForm
            submitLabel={t('staff.add.submit')}
            isPending={add.isPending}
            error={add.error}
            onSubmit={(details, form) => add.mutate(details, { onSuccess: () => form.reset() })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
