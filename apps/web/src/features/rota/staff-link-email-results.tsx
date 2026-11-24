import { emailStatusSchema, type EmailStatus, type StaffLinkEmail } from '@rota-ready/shared';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from '@/components/ui/item';

const variants = {
  sent: 'secondary',
  no_email: 'outline',
  failed: 'destructive',
} as const satisfies Record<EmailStatus, string>;

interface StaffLinkEmailResultsProps {
  emails: StaffLinkEmail[];
}

export function StaffLinkEmailResults({ emails }: StaffLinkEmailResultsProps) {
  const { t } = useTranslation();

  if (emails.length === 0) return null;

  return (
    <>
      <ItemGroup aria-label={t('rota.emails.label')} className="max-h-[50vh] gap-2 overflow-y-auto">
        {emails.map(({ staffMemberId, name, status }) => (
          <Item key={staffMemberId} role="listitem" variant="outline" size="sm" className="flex-nowrap">
            <ItemContent className="min-w-0">
              <ItemTitle>{name}</ItemTitle>
            </ItemContent>
            <ItemActions>
              <Badge variant={variants[status]}>{t(`rota.emails.status.${status}`)}</Badge>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
      {emails.some(({ status }) => status === emailStatusSchema.enum.failed) && (
        <Alert variant="destructive">
          <AlertDescription>{t('rota.emails.someFailed')}</AlertDescription>
        </Alert>
      )}
    </>
  );
}
