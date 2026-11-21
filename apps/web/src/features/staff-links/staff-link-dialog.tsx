import { firstNameOf, type StaffMember } from '@rota-ready/shared';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RegenerateStaffLinkDialog } from '@/features/staff-links/regenerate-staff-link-dialog';
import { staffLinkQuery, staffLinkUrl } from '@/features/staff-links/staff-link-queries';
import { apiErrorMessage } from '@/i18n/api-error-message';

interface StaffLinkDialogProps {
  venueId: string;
  staffMember: StaffMember;
}

export function StaffLinkDialog({ venueId, staffMember }: StaffLinkDialogProps) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const staffLink = useQuery({ ...staffLinkQuery(venueId, staffMember.id), enabled: open });
  const firstName = firstNameOf(staffMember.name);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('staffLink.copied'));
    } catch {
      toast.error(t('staffLink.copyFailed'));
    }
  }

  function renderLink() {
    if (staffLink.isError) {
      return (
        <div className="flex flex-col items-start gap-3">
          <p role="alert">{apiErrorMessage(t, staffLink.error)}</p>
          <Button variant="outline" size="sm" onClick={() => void staffLink.refetch()}>
            {t('staffLink.tryAgain')}
          </Button>
        </div>
      );
    }
    if (!staffLink.data) {
      return <p className="text-sm text-muted-foreground">{t('loading.title')}</p>;
    }
    const url = staffLinkUrl(staffLink.data.token);
    return (
      <>
        <Field>
          <FieldLabel htmlFor={`${id}-url`}>{t('staffLink.url')}</FieldLabel>
          <Input
            id={`${id}-url`}
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
          />
        </Field>
        <DialogFooter>
          <RegenerateStaffLinkDialog venueId={venueId} staffMember={staffMember} />
          <Button onClick={() => void copy(url)}>{t('staffLink.copy')}</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={t('staffLink.label', { name: staffMember.name })}
        >
          {t('staffLink.button')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('staffLink.title', { name: staffMember.name })}</DialogTitle>
          <DialogDescription>{t('staffLink.description', { firstName })}</DialogDescription>
        </DialogHeader>
        {renderLink()}
      </DialogContent>
    </Dialog>
  );
}
