import {
  STAFF_MEMBER_EMAIL_MAX_LENGTH,
  STAFF_MEMBER_NAME_MAX_LENGTH,
  STAFF_MEMBER_PHONE_MAX_LENGTH,
  STAFF_MEMBER_ROLE_MAX_LENGTH,
  staffMemberDetailsSchema,
  type StaffMember,
  type StaffMemberDetails,
} from '@rota-ready/shared';
import type { ParseKeys } from 'i18next';
import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/i18n/api-error-message';

interface StaffMemberFormProps {
  staffMember?: StaffMember;
  submitLabel: string;
  isPending: boolean;
  error: unknown;
  onSubmit: (details: StaffMemberDetails, form: HTMLFormElement) => void;
  onCancel?: () => void;
}

export function StaffMemberForm({
  staffMember,
  submitLabel,
  isPending,
  error,
  onSubmit,
  onCancel,
}: StaffMemberFormProps) {
  const { t } = useTranslation();
  const id = useId();
  const [invalidMessage, setInvalidMessage] = useState<ParseKeys | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const details = {
      name: String(form.get('name')),
      role: String(form.get('role')),
      email: String(form.get('email')),
      phone: String(form.get('phone')),
    };
    const parsed = staffMemberDetailsSchema.safeParse(details);
    if (parsed.success) {
      setInvalidMessage(null);
      onSubmit(details, formElement);
    } else {
      const contactMissing = parsed.error.issues.some((issue) => issue.code === 'custom');
      setInvalidMessage(contactMissing ? 'staff.errors.contactRequired' : 'errors.invalidRequest');
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-name`}>{t('staff.name')}</Label>
          <Input
            id={`${id}-name`}
            name="name"
            defaultValue={staffMember?.name}
            maxLength={STAFF_MEMBER_NAME_MAX_LENGTH}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-role`}>{t('staff.role')}</Label>
          <Input
            id={`${id}-role`}
            name="role"
            defaultValue={staffMember?.role}
            maxLength={STAFF_MEMBER_ROLE_MAX_LENGTH}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-email`}>{t('staff.email')}</Label>
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            defaultValue={staffMember?.email ?? ''}
            maxLength={STAFF_MEMBER_EMAIL_MAX_LENGTH}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-phone`}>{t('staff.phone')}</Label>
          <Input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            defaultValue={staffMember?.phone ?? ''}
            maxLength={STAFF_MEMBER_PHONE_MAX_LENGTH}
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{t('staff.contactHint')}</p>
      {(invalidMessage !== null || error !== null) && (
        <p role="alert" className="text-sm text-destructive">
          {invalidMessage !== null ? t(invalidMessage) : apiErrorMessage(t, error)}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('staff.edit.cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}
