import { redirect } from 'next/navigation'

export default function InvestorPage() {
  redirect('/marketplace?tab=portfolio')
}
