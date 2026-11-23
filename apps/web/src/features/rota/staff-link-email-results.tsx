import { emailStatusSchema, type EmailStatus, type StaffLinkEmailsResult } from '@rota-ready/shared';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

const variants = {
  sent: 'secondary',
  no_email: 'outline',
  failed: 'destructive',
} as const satisfies Record<EmailStatus, string>;

interface StaffLinkEmailResultsProps {
  emails: StaffLinkEmailsResult['emails'];
}

export function StaffLinkEmailResults({ emails }: StaffLinkEmailResultsProps) {
  const { t } = useTranslation();

  if (emails.length === 0) return null;

  return (
    <>
      <ul aria-label={t('rota.emails.label')} className="flex flex-col gap-2 text-sm">
        {emails.map(({ staffMemberId, name, status }) => (
          <li key={staffMemberId} className="flex items-center justify-between gap-2">
            <span>{name}</span>
            <Badge variant={variants[status]}>{t(`rota.emails.status.${status}`)}</Badge>
          </li>
        ))}
      </ul>
      {emails.some(({ status }) => status === emailStatusSchema.enum.failed) && (
        <Alert variant="destructive">
          <AlertDescription>{t('rota.emails.someFailed')}</AlertDescription>
        </Alert>
      )}
    </>
  );
}
