import { redirect } from 'next/navigation'

export default function InvestorTokensPage() {
  redirect('/marketplace?tab=portfolio')
}
