import { redirect } from 'next/navigation';
import { APP_ROUTES } from '@zalobot/contracts';

export default function IncomeRedirectPage() {
  redirect(`${APP_ROUTES.transactions}?type=income`);
}
