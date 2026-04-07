import { redirect } from 'next/navigation'

export default function InvestorPortfolioPage() {
  redirect('/marketplace?tab=portfolio')
}
