import type { Contribution } from '../types'

export function isContributionApproved(item: Contribution): boolean {
  return item.status !== 'pending'
}
