import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { staffLinkUrl } from '@/features/staff-links/staff-link-queries';

export function useCopyStaffLink() {
  const { t } = useTranslation();
  return async function copyStaffLink(token: string) {
    try {
      await navigator.clipboard.writeText(staffLinkUrl(token));
      toast.success(t('staffLink.copied'));
    } catch {
      toast.error(t('staffLink.copyFailed'));
    }
  };
}
