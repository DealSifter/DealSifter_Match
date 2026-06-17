export const CARD_STATUS = {
  exclusive: 'exclusive',
  partialExclusive: 'partialExclusive',
  verified: 'verified',
  pending: 'pending',
  hot: 'hot',
  trending: 'trending',
};

export function pickPriorityStatus(statuses = []) {
  const order = [
    CARD_STATUS.exclusive,
    CARD_STATUS.partialExclusive,
    CARD_STATUS.pending,
    CARD_STATUS.hot,
    CARD_STATUS.trending,
    CARD_STATUS.verified,
  ];
  return order.find((status) => statuses.includes(status)) || null;
}
